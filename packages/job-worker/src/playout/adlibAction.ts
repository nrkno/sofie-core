import { ExpectedPackageDBType } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { UserError, UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import { getRandomId, stringifyError } from '@sofie-automation/corelib/dist/lib'
import { ExecuteActionProps, ExecuteActionResult } from '@sofie-automation/corelib/dist/worker/studio'
import { logger } from 'elastic-apm-node'
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

		if (!playlist.activationId) throw UserError.create(UserErrorMessage.InactiveRundown)
		if (!playlist.currentPartInstanceId) throw UserError.create(UserErrorMessage.NoCurrentPart)

		const initCache = await CacheForPlayoutPreInit.createPreInit(context, lock, playlist, false)

		const currentPartInstance = playlist.currentPartInstanceId
			? await context.directCollections.PartInstances.findOne(playlist.currentPartInstanceId)
			: undefined
		if (!currentPartInstance)
			throw new Error(`Current PartInstance "${playlist.currentPartInstanceId}" could not be found.`)

		const rundown = initCache.Rundowns.findOne(currentPartInstance.rundownId)
		if (!rundown) throw new Error(`Current Rundown "${currentPartInstance.rundownId}" could not be found`)

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

		if (blueprint.blueprint.executeDataStoreAction) {
			// now we can execute any datastore actions
			const actionContext = new DatastoreActionExecutionContext(
				{
					name: `${rundown.name}(${playlist.name})`,
					identifier: `playlist=${playlist._id},rundown=${rundown._id},currentPartInstance=${
						currentPartInstance._id
					},execution=${getRandomId()}`,
					tempSendUserNotesIntoBlackHole: true, // TODO-CONTEXT store these notes
				},
				context,
				showStyle,
				watchedPackages
			)

			logger.info(`Executing Datastore AdlibAction "${data.actionId}": ${JSON.stringify(data.userData)}`)

			try {
				await blueprint.blueprint.executeDataStoreAction(
					actionContext,
					data.actionId,
					data.userData,
					data.triggerMode
				)
			} catch (err) {
				logger.error(`Error in showStyleBlueprint.executeDatastoreAction: ${stringifyError(err)}`)
				throw err
			}
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
					currentPartInstance,
					watchedPackages,
					async (actionContext, _rundown, _currentPartInstance, _blueprint) => {
						if (!blueprint.blueprint.executeAction) {
							throw new Error('Blueprint exports no executeAction function')
						}

						// If any action cannot be done due to timings, that needs to be rejected by the context
						logger.info(
							`Executing AdlibAction "${data.actionId}": ${JSON.stringify(data.userData)} (${
								data.triggerMode
							})`
						)

						try {
							await blueprint.blueprint.executeAction(
								actionContext,
								data.actionId,
								data.userData,
								data.triggerMode
							)
						} catch (err) {
							logger.error(`Error in showStyleBlueprint.executeAction: ${stringifyError(err)}`)
							throw err
						}
					}
				)

				await fullCache.saveAllToDatabase()

				return res
			} catch (err) {
				fullCache.discardChanges()
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

export async function executeActionInner(
	context: JobContext,
	cache: CacheForPlayout,
	rundown: DBRundown,
	showStyle: ReadonlyDeep<ProcessedShowStyleCompound>,
	blueprint: ReadonlyDeep<WrappedShowStyleBlueprint>,
	currentPartInstance: DBPartInstance,
	watchedPackages: WatchedPackagesHelper,
	func: (
		context: ActionExecutionContext,
		rundown: DBRundown,
		currentPartInstance: DBPartInstance,
		blueprint: ReadonlyDeep<WrappedShowStyleBlueprint>
	) => Promise<void>
): Promise<ExecuteActionResult> {
	const now = getCurrentTime()

	const playlist = cache.Playlist.doc

	const actionContext = new ActionExecutionContext(
		{
			name: `${rundown.name}(${playlist.name})`,
			identifier: `playlist=${playlist._id},rundown=${rundown._id},currentPartInstance=${
				currentPartInstance._id
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
	await func(actionContext, rundown, currentPartInstance, blueprint)

	if (
		actionContext.currentPartState !== ActionPartChange.NONE ||
		actionContext.nextPartState !== ActionPartChange.NONE
	) {
		await syncPlayheadInfinitesForNextPartInstance(context, cache)
	}

	if (actionContext.nextPartState !== ActionPartChange.NONE) {
		const nextPartInstanceId = cache.Playlist.doc.nextPartInstanceId
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

	return {
		queuedPartInstanceId: actionContext.queuedPartInstanceId,
		taken: actionContext.takeAfterExecute,
	}
}
