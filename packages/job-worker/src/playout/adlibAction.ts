import { ExpectedPackageDBType } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { UserError, UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import { getRandomId, stringifyError } from '@sofie-automation/corelib/dist/lib'
import { ExecuteActionProps, ExecuteActionResult } from '@sofie-automation/corelib/dist/worker/studio'
import { WrappedShowStyleBlueprint } from '../blueprints/cache'
import { DatastoreActionExecutionContext, ActionExecutionContext, ActionPartChange } from '../blueprints/context'
import { WatchedPackagesHelper } from '../blueprints/context/watchedPackages'
import { JobContext, ProcessedShowStyleCompound } from '../jobs'
import { getCurrentTime } from '../lib'
import { ReadonlyDeep } from 'type-fest'
import { CacheForPlayoutPreInit, CacheForPlayout } from './cache'
import { syncPlayheadInfinitesForNextPartInstance } from './infinites'
import { updateExpectedDurationWithPrerollForPartInstance } from './lib'
import { runJobWithPlaylistLock } from './lock'
import { updateTimeline } from './timeline/generate'
import { performTakeToNextedPart } from './take'
import { ActionUserData } from '@sofie-automation/blueprints-integration'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { logger } from '../logging'

/**
 * Execute an AdLib Action
 */
export async function handleExecuteAdlibAction(
	context: JobContext,
	data: ExecuteActionProps
): Promise<ExecuteActionResult> {
	return runJobWithPlaylistLock(context, data, async (playlist, lock) => {
		// First load the minimum amount of data required to run the executeDataStoreAction handler
		if (!playlist) throw new Error(`Job playlist "${data.playlistId}" not found `)

		if (!playlist.activationId) throw UserError.create(UserErrorMessage.InactiveRundown, undefined, 412)
		if (!playlist.currentPartInfo) throw UserError.create(UserErrorMessage.NoCurrentPart, undefined, 412)

		const initCache = await CacheForPlayoutPreInit.createPreInit(context, lock, playlist, false)

		const rundown = initCache.Rundowns.findOne(playlist.currentPartInfo.rundownId)
		if (!rundown) throw new Error(`Current Rundown "${playlist.currentPartInfo.rundownId}" could not be found`)

		const showStyle = await context.getShowStyleCompound(rundown.showStyleVariantId, rundown.showStyleBaseId)

		const blueprint = await context.getShowStyleBlueprint(showStyle._id)

		if (!blueprint.blueprint.executeAction && !blueprint.blueprint.executeDataStoreAction) {
			throw UserError.create(UserErrorMessage.ActionsNotSupported)
		}

		const watchedPackages = await WatchedPackagesHelper.create(context, context.studio._id, {
			pieceId: data.actionDocId,
			fromPieceType: {
				$in: [ExpectedPackageDBType.ADLIB_ACTION, ExpectedPackageDBType.BASELINE_ADLIB_ACTION],
			},
		})

		const actionParameters: ExecuteActionParameters = {
			actionId: data.actionId,
			userData: data.userData,
			triggerMode: data.triggerMode,
		}

		try {
			await executeDataStoreAction(
				context,
				playlist,
				rundown,
				showStyle,
				blueprint,
				watchedPackages,
				actionParameters
			)
		} catch (err) {
			logger.error(`Error in showStyleBlueprint.executeDatastoreAction: ${stringifyError(err)}`)
		}

		if (blueprint.blueprint.executeAction) {
			// load a full cache for the regular actions & executet the handler
			const fullCache: CacheForPlayout = await CacheForPlayout.fromInit(context, initCache)
			try {
				const res: ExecuteActionResult = await executeActionInner(
					context,
					fullCache,
					rundown,
					showStyle,
					blueprint,
					watchedPackages,
					actionParameters
				)

				await fullCache.saveAllToDatabase()

				return res
			} catch (err) {
				fullCache.dispose()
				throw err
			}
		}

		// if we haven't returned yet, these defaults should be correct
		return {
			queuedPartInstanceId: undefined,
			taken: false,
		}
	})
}

export interface ExecuteActionParameters {
	/** Id of the action */
	actionId: string
	/** Properties defining the action behaviour */
	userData: ActionUserData

	triggerMode: string | undefined
}

export async function executeActionInner(
	context: JobContext,
	cache: CacheForPlayout,
	rundown: DBRundown,
	showStyle: ReadonlyDeep<ProcessedShowStyleCompound>,
	blueprint: ReadonlyDeep<WrappedShowStyleBlueprint>,
	watchedPackages: WatchedPackagesHelper,
	actionParameters: ExecuteActionParameters
): Promise<ExecuteActionResult> {
	const now = getCurrentTime()

	const playlist = cache.Playlist.doc

	const actionContext = new ActionExecutionContext(
		{
			name: `${rundown.name}(${playlist.name})`,
			identifier: `playlist=${playlist._id},rundown=${rundown._id},currentPartInstance=${
				playlist.currentPartInfo?.partInstanceId
			},execution=${getRandomId()}`,
			tempSendUserNotesIntoBlackHole: true, // TODO-CONTEXT store these notes
		},
		context,
		cache,
		showStyle,
		context.getShowStyleBlueprintConfig(showStyle),
		rundown,
		watchedPackages
	)

	// If any action cannot be done due to timings, that needs to be rejected by the context
	if (!blueprint.blueprint.executeAction) throw UserError.create(UserErrorMessage.ActionsNotSupported)

	logger.info(
		`Executing AdlibAction "${actionParameters.actionId}": ${JSON.stringify(actionParameters.userData)} (${
			actionParameters.triggerMode
		})`
	)

	try {
		await blueprint.blueprint.executeAction(
			actionContext,
			actionParameters.actionId,
			actionParameters.userData,
			actionParameters.triggerMode
		)
	} catch (err) {
		logger.error(`Error in showStyleBlueprint.executeAction: ${stringifyError(err)}`)
		throw UserError.fromUnknown(err, UserErrorMessage.InternalError)
	}

	await applyAnyExecutionSideEffects(context, cache, actionContext, now)

	return {
		queuedPartInstanceId: actionContext.queuedPartInstanceId,
		taken: actionContext.takeAfterExecute,
	}
}

async function applyAnyExecutionSideEffects(
	context: JobContext,
	cache: CacheForPlayout,
	actionContext: ActionExecutionContext,
	now: number
) {
	if (
		actionContext.currentPartState !== ActionPartChange.NONE ||
		actionContext.nextPartState !== ActionPartChange.NONE
	) {
		await syncPlayheadInfinitesForNextPartInstance(context, cache)
	}

	if (actionContext.nextPartState !== ActionPartChange.NONE) {
		const nextPartInstanceId = cache.Playlist.doc.nextPartInfo?.partInstanceId
		if (nextPartInstanceId) {
			updateExpectedDurationWithPrerollForPartInstance(cache, nextPartInstanceId)
		}
	}

	if (actionContext.takeAfterExecute) {
		await performTakeToNextedPart(context, cache, now)
	} else {
		if (
			actionContext.currentPartState !== ActionPartChange.NONE ||
			actionContext.nextPartState !== ActionPartChange.NONE
		) {
			await updateTimeline(context, cache)
		}
	}
}

async function executeDataStoreAction(
	context: JobContext,
	playlist: DBRundownPlaylist,
	rundown: DBRundown,
	showStyle: ReadonlyDeep<ProcessedShowStyleCompound>,
	blueprint: ReadonlyDeep<WrappedShowStyleBlueprint>,
	watchedPackages: WatchedPackagesHelper,
	actionParameters: ExecuteActionParameters
) {
	const executeDataStoreAction = blueprint.blueprint.executeDataStoreAction
	if (executeDataStoreAction) {
		await context.directCollections.runInTransaction(async (transaction) => {
			// now we can execute any datastore actions
			const actionContext = new DatastoreActionExecutionContext(
				{
					name: `${rundown.name}(${playlist.name})`,
					identifier: `playlist=${playlist._id},rundown=${rundown._id},currentPartInstance=${
						playlist.currentPartInfo?.partInstanceId
					},execution=${getRandomId()}`,
					tempSendUserNotesIntoBlackHole: true, // TODO-CONTEXT store these notes
				},
				context,
				transaction,
				showStyle,
				watchedPackages
			)

			logger.info(
				`Executing Datastore AdlibAction "${actionParameters.actionId}": ${JSON.stringify(
					actionParameters.userData
				)}`
			)

			try {
				await executeDataStoreAction(
					actionContext,
					actionParameters.actionId,
					actionParameters.userData,
					actionParameters.triggerMode
				)
			} catch (err) {
				logger.error(`Error in showStyleBlueprint.executeDatastoreAction: ${stringifyError(err)}`)
				throw err
			}
		})
	}
}
