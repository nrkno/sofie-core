import { PeripheralDeviceType } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import {
	DBRundownPlaylist,
	RundownHoldState,
	SelectedPartInstance,
} from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { UserError, UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import { logger } from '../logging'
import { JobContext, ProcessedShowStyleCompound } from '../jobs'
import { PlayoutModel } from './model/PlayoutModel'
import { PlayoutPartInstanceModel } from './model/PlayoutPartInstanceModel'
import { isTooCloseToAutonext } from './lib'
import { selectNextPart } from './selectNextPart'
import { setNextPart } from './setNext'
import { getCurrentTime } from '../lib'
import { PartEndState, VTContent } from '@sofie-automation/blueprints-integration'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { ReadonlyDeep } from 'type-fest'
import { getResolvedPiecesForCurrentPartInstance } from './resolvedPieces'
import { clone, getRandomId } from '@sofie-automation/corelib/dist/lib'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { updateTimeline } from './timeline/generate'
import { OnTakeContext, PartEventContext, RundownContext } from '../blueprints/context'
import { WrappedShowStyleBlueprint } from '../blueprints/cache'
import { innerStopPieces } from './adlibUtils'
import { reportPartInstanceHasStarted, reportPartInstanceHasStopped } from './timings/partPlayback'
import { calculatePartTimings } from '@sofie-automation/corelib/dist/playout/timings'
import { convertPartInstanceToBlueprints, convertResolvedPieceInstanceToBlueprints } from '../blueprints/context/lib'
import { processAndPrunePieceInstanceTimings } from '@sofie-automation/corelib/dist/playout/processAndPrune'
import { TakeNextPartProps } from '@sofie-automation/corelib/dist/worker/studio'
import { runJobWithPlayoutModel } from './lock'
import _ = require('underscore')
import { ReadonlyObjectDeep } from 'type-fest/source/readonly-deep'
import { WatchedPackagesHelper } from '../blueprints/context/watchedPackages'
import {
	PartAndPieceInstanceActionService,
	applyActionSideEffects,
} from '../blueprints/context/services/PartAndPieceInstanceActionService'
import { PlayoutRundownModel } from './model/PlayoutRundownModel'

/**
 * Take the currently Next:ed Part (start playing it)
 */
export async function handleTakeNextPart(context: JobContext, data: TakeNextPartProps): Promise<void> {
	const now = getCurrentTime()

	return runJobWithPlayoutModel(
		context,
		data,
		async (playoutModel) => {
			const playlist = playoutModel.playlist

			if (!playlist.activationId) throw UserError.create(UserErrorMessage.InactiveRundown, undefined, 412)

			if (!playlist.nextPartInfo && playlist.holdState !== RundownHoldState.ACTIVE)
				throw UserError.create(UserErrorMessage.TakeNoNextPart, undefined, 412)

			if ((playlist.currentPartInfo?.partInstanceId ?? null) !== data.fromPartInstanceId)
				throw UserError.create(UserErrorMessage.TakeFromIncorrectPart, undefined, 412)
		},
		async (playoutModel) => {
			const playlist = playoutModel.playlist

			let lastTakeTime = playlist.lastTakeTime ?? 0

			if (playlist.currentPartInfo) {
				const currentPartInstance = playoutModel.currentPartInstance?.partInstance
				if (currentPartInstance?.timings?.plannedStartedPlayback) {
					lastTakeTime = Math.max(lastTakeTime, currentPartInstance.timings.plannedStartedPlayback)
				} else {
					// Don't throw an error here. It's bad, but it's more important to be able to continue with the take.
					logger.error(
						`PartInstance "${playlist.currentPartInfo.partInstanceId}", set as currentPart in "${playlist._id}", not found!`
					)
				}
			}

			if (lastTakeTime && now - lastTakeTime < context.studio.settings.minimumTakeSpan) {
				logger.debug(
					`Time since last take is shorter than ${context.studio.settings.minimumTakeSpan} for ${
						playlist.currentPartInfo?.partInstanceId
					}: ${now - lastTakeTime}`
				)
				throw UserError.create(UserErrorMessage.TakeRateLimit, {
					duration: context.studio.settings.minimumTakeSpan,
				})
			}

			return performTakeToNextedPart(context, playoutModel, now)
		}
	)
}

/**
 * Perform a Take into the nexted Part, and prepare a new nexted Part
 * @param context Context for current job
 * @param playoutModel Model for the active Playlist
 * @param now Current timestamp
 */
export async function performTakeToNextedPart(
	context: JobContext,
	playoutModel: PlayoutModel,
	now: number
): Promise<void> {
	const span = context.startSpan('takeNextPartInner')

	if (!playoutModel.playlist.activationId)
		throw new Error(`Rundown Playlist "${playoutModel.playlist._id}" is not active!`)

	const timeOffset: number | null = playoutModel.playlist.nextTimeOffset || null

	const currentPartInstance = playoutModel.currentPartInstance
	const nextPartInstance = playoutModel.nextPartInstance
	const previousPartInstance = playoutModel.previousPartInstance

	const currentOrNextPartInstance = nextPartInstance ?? currentPartInstance
	if (!currentOrNextPartInstance) {
		// Some temporary logging to diagnose some cases where this route is hit
		logger.warn(`No partinstance was found during take`, JSON.stringify(playoutModel.playlist))
		logger.warn(
			'All PartInstances in cache',
			playoutModel.sortedLoadedPartInstances.map((p) => p.partInstance._id)
		)
		logger.warn('Deleted PartInstances in cache', playoutModel.hackDeletedPartInstanceIds)
		logger.warn(
			'Parts in cache',
			playoutModel.getAllOrderedParts().map((d) => d._id)
		)

		const validIds = _.compact([
			playoutModel.playlist.currentPartInfo?.partInstanceId,
			playoutModel.playlist.nextPartInfo?.partInstanceId,
		])
		if (validIds.length) {
			const mongoDocs = await context.directCollections.PartInstances.findFetch({ _id: { $in: validIds } })
			logger.warn('Matching partInstances in mongo', mongoDocs)
		}

		throw new Error(`No partInstance could be found!`)
	}
	const currentRundown = currentOrNextPartInstance
		? playoutModel.getRundown(currentOrNextPartInstance.partInstance.rundownId)
		: undefined
	if (!currentRundown)
		throw new Error(`Rundown "${currentOrNextPartInstance?.partInstance?.rundownId ?? ''}" could not be found!`)

	const pShowStyle = context.getShowStyleCompound(
		currentRundown.rundown.showStyleVariantId,
		currentRundown.rundown.showStyleBaseId
	)

	if (currentPartInstance) {
		const now = getCurrentTime()
		if (currentPartInstance.partInstance.blockTakeUntil && currentPartInstance.partInstance.blockTakeUntil > now) {
			const remainingTime = currentPartInstance.partInstance.blockTakeUntil - now
			// Adlib-actions can arbitrarily block takes from being done
			logger.debug(
				`Take is blocked until ${currentPartInstance.partInstance.blockTakeUntil}. Which is in: ${remainingTime}`
			)
			throw UserError.create(UserErrorMessage.TakeBlockedDuration, { duration: remainingTime })
		}

		// If there was a transition from the previous Part, then ensure that has finished before another take is permitted
		const allowTransition = previousPartInstance && !previousPartInstance.partInstance.part.disableNextInTransition
		const start = currentPartInstance.partInstance.timings?.plannedStartedPlayback
		if (
			allowTransition &&
			currentPartInstance.partInstance.part.inTransition &&
			start &&
			now < start + currentPartInstance.partInstance.part.inTransition.blockTakeDuration
		) {
			throw UserError.create(UserErrorMessage.TakeDuringTransition)
		}

		if (isTooCloseToAutonext(currentPartInstance.partInstance, true)) {
			throw UserError.create(UserErrorMessage.TakeCloseToAutonext)
		}
	}

	if (playoutModel.playlist.holdState === RundownHoldState.COMPLETE) {
		playoutModel.setHoldState(RundownHoldState.NONE)

		// If hold is active, then this take is to clear it
	} else if (playoutModel.playlist.holdState === RundownHoldState.ACTIVE) {
		await completeHold(context, playoutModel, await pShowStyle, currentPartInstance)

		if (span) span.end()

		return
	}

	const takePartInstance = nextPartInstance
	if (!takePartInstance) throw new Error('takePart not found!')
	const takeRundown = playoutModel.getRundown(takePartInstance.partInstance.rundownId)
	if (!takeRundown)
		throw new Error(`takeRundown: takeRundown not found! ("${takePartInstance.partInstance.rundownId}")`)

	const showStyle = await pShowStyle
	const blueprint = await context.getShowStyleBlueprint(showStyle._id)

	const { isTakeAborted } = await executeOnTakeCallback(context, playoutModel, showStyle, blueprint, currentRundown)

	if (isTakeAborted) {
		await updateTimeline(context, playoutModel)
		return
	}

	// Autonext may have setup the plannedStartedPlayback. Clear it so that a new value is generated
	takePartInstance.setPlannedStartedPlayback(undefined)
	takePartInstance.setPlannedStoppedPlayback(undefined)

	// it is only a first take if the Playlist has no startedPlayback and the taken PartInstance is not untimed
	const isFirstTake = !playoutModel.playlist.startedPlayback && !takePartInstance.partInstance.part.untimed

	clearQueuedSegmentId(playoutModel, takePartInstance.partInstance, playoutModel.playlist.nextPartInfo)

	const nextPart = selectNextPart(
		context,
		playoutModel.playlist,
		takePartInstance.partInstance,
		null,
		playoutModel.getAllOrderedSegments(),
		playoutModel.getAllOrderedParts()
	)

	if (blueprint.blueprint.onPreTake) {
		const span = context.startSpan('blueprint.onPreTake')
		try {
			await blueprint.blueprint.onPreTake(
				new PartEventContext(
					'onPreTake',
					context.studio,
					context.getStudioBlueprintConfig(),
					showStyle,
					context.getShowStyleBlueprintConfig(showStyle),
					takeRundown.rundown,
					takePartInstance.partInstance
				)
			)
		} catch (err) {
			logger.error(`Error in showStyleBlueprint.onPreTake: ${stringifyError(err)}`)
		}
		if (span) span.end()
	}

	updatePartInstanceOnTake(
		context,
		playoutModel.playlist,
		showStyle,
		blueprint,
		takeRundown.rundown,
		takePartInstance,
		currentPartInstance
	)

	playoutModel.cycleSelectedPartInstances()

	takePartInstance.setTaken(now, timeOffset)

	resetPreviousSegment(playoutModel)

	// Once everything is synced, we can choose the next part
	await setNextPart(context, playoutModel, nextPart, false)

	// Setup the parts for the HOLD we are starting
	if (
		playoutModel.playlist.previousPartInfo &&
		(playoutModel.playlist.holdState as RundownHoldState) === RundownHoldState.ACTIVE
	) {
		startHold(context, currentPartInstance, nextPartInstance)
	}
	await afterTake(context, playoutModel, takePartInstance)

	// Last:
	const takeDoneTime = getCurrentTime()
	playoutModel.deferBeforeSave(async (playoutModel2) => {
		await afterTakeUpdateTimingsAndEvents(context, playoutModel2, showStyle, blueprint, isFirstTake, takeDoneTime)
	})

	if (span) span.end()
}

async function executeOnTakeCallback(
	context: JobContext,
	playoutModel: PlayoutModel,
	showStyle: ReadonlyObjectDeep<ProcessedShowStyleCompound>,
	blueprint: ReadonlyObjectDeep<WrappedShowStyleBlueprint>,
	currentRundown: PlayoutRundownModel
): Promise<{ isTakeAborted: boolean }> {
	let isTakeAborted = false
	if (blueprint.blueprint.onTake) {
		const watchedPackagesHelper = WatchedPackagesHelper.empty(context)
		const onSetAsNextContext = new OnTakeContext(
			{
				name: `${currentRundown.rundown.name}(${playoutModel.playlist.name})`,
				identifier: `playlist=${playoutModel.playlist._id},rundown=${
					currentRundown.rundown._id
				},currentPartInstance=${
					playoutModel.playlist.currentPartInfo?.partInstanceId
				},execution=${getRandomId()}`,
				tempSendUserNotesIntoBlackHole: true, // TODO-CONTEXT store these notes
			},
			context,
			playoutModel,
			showStyle,
			watchedPackagesHelper,
			new PartAndPieceInstanceActionService(context, playoutModel, showStyle, currentRundown)
		)
		try {
			await blueprint.blueprint.onTake(onSetAsNextContext)
			await applyOnTakeSideEffects(context, playoutModel, onSetAsNextContext)
			isTakeAborted = onSetAsNextContext.isTakeAborted
		} catch (err) {
			logger.error(`Error in showStyleBlueprint.onTake: ${stringifyError(err)}`)
		}
	}
	return { isTakeAborted }
}

async function applyOnTakeSideEffects(context: JobContext, playoutModel: PlayoutModel, onTakeContext: OnTakeContext) {
	await applyActionSideEffects(context, playoutModel, onTakeContext)
}

/**
 * Clear the nexted Segment, if taking into a PartInstance that consumes it
 * @param playoutModel Model for the active Playlist
 * @param takenPartInstance PartInstance to check
 */
export function clearQueuedSegmentId(
	playoutModel: PlayoutModel,
	takenPartInstance: ReadonlyDeep<DBPartInstance> | undefined,
	takenPartInfo: ReadonlyDeep<SelectedPartInstance> | null
): void {
	if (
		takenPartInfo?.consumesQueuedSegmentId &&
		takenPartInstance &&
		playoutModel.playlist.queuedSegmentId === takenPartInstance.segmentId
	) {
		// clear the queuedSegmentId if the newly taken partInstance says it was selected because of it
		playoutModel.setQueuedSegment(null)
	}
}

/**
 * Reset the Segment of the previousPartInstance, if playback has left that Segment and the Rundown is looping
 * @param playoutModel Model for the active Playlist
 */
export function resetPreviousSegment(playoutModel: PlayoutModel): void {
	const previousPartInstance = playoutModel.previousPartInstance
	const currentPartInstance = playoutModel.currentPartInstance

	// If the playlist is looping and
	// If the previous and current part are not in the same segment, then we have just left a segment
	if (
		playoutModel.playlist.loop &&
		previousPartInstance &&
		previousPartInstance.partInstance.segmentId !== currentPartInstance?.partInstance?.segmentId
	) {
		// Reset the old segment
		const segmentId = previousPartInstance.partInstance.segmentId
		for (const partInstance of playoutModel.loadedPartInstances) {
			if (partInstance.partInstance.segmentId === segmentId) {
				partInstance.markAsReset()
			}
		}
	}
}

async function afterTakeUpdateTimingsAndEvents(
	context: JobContext,
	playoutModel: PlayoutModel,
	showStyle: ReadonlyDeep<ProcessedShowStyleCompound>,
	blueprint: ReadonlyDeep<WrappedShowStyleBlueprint>,
	isFirstTake: boolean,
	takeDoneTime: number
): Promise<void> {
	const takePartInstance = playoutModel.currentPartInstance
	const previousPartInstance = playoutModel.previousPartInstance

	if (takePartInstance) {
		// Simulate playout, if no gateway
		const playoutDevices = playoutModel.peripheralDevices.filter((d) => d.type === PeripheralDeviceType.PLAYOUT)
		if (playoutDevices.length === 0) {
			logger.info(
				`No Playout gateway attached to studio, reporting PartInstance "${
					takePartInstance.partInstance._id
				}" to have started playback on timestamp ${new Date(takeDoneTime).toISOString()}`
			)
			reportPartInstanceHasStarted(context, playoutModel, takePartInstance, takeDoneTime)

			if (previousPartInstance) {
				logger.info(
					`Also reporting PartInstance "${
						previousPartInstance.partInstance._id
					}" to have stopped playback on timestamp ${new Date(takeDoneTime).toISOString()}`
				)
				reportPartInstanceHasStopped(context, playoutModel, previousPartInstance, takeDoneTime)
			}

			// Future: is there anything we can do for simulating autoNext?
		}

		const takeRundown = takePartInstance
			? playoutModel.getRundown(takePartInstance.partInstance.rundownId)
			: undefined

		if (isFirstTake && takeRundown) {
			if (blueprint.blueprint.onRundownFirstTake) {
				const span = context.startSpan('blueprint.onRundownFirstTake')
				try {
					await blueprint.blueprint.onRundownFirstTake(
						new PartEventContext(
							'onRundownFirstTake',
							context.studio,
							context.getStudioBlueprintConfig(),
							showStyle,
							context.getShowStyleBlueprintConfig(showStyle),
							takeRundown.rundown,
							takePartInstance.partInstance
						)
					)
				} catch (err) {
					logger.error(`Error in showStyleBlueprint.onRundownFirstTake: ${stringifyError(err)}`)
				}
				if (span) span.end()
			}
		}

		if (blueprint.blueprint.onPostTake && takeRundown) {
			const span = context.startSpan('blueprint.onPostTake')
			try {
				await blueprint.blueprint.onPostTake(
					new PartEventContext(
						'onPostTake',
						context.studio,
						context.getStudioBlueprintConfig(),
						showStyle,
						context.getShowStyleBlueprintConfig(showStyle),
						takeRundown.rundown,
						takePartInstance.partInstance
					)
				)
			} catch (err) {
				logger.error(`Error in showStyleBlueprint.onPostTake: ${stringifyError(err)}`)
			}
			if (span) span.end()
		}
	}
}

export function updatePartInstanceOnTake(
	context: JobContext,
	playlist: ReadonlyDeep<DBRundownPlaylist>,
	showStyle: ReadonlyDeep<ProcessedShowStyleCompound>,
	blueprint: ReadonlyDeep<WrappedShowStyleBlueprint>,
	takeRundown: ReadonlyDeep<DBRundown>,
	takePartInstance: PlayoutPartInstanceModel,
	currentPartInstance: PlayoutPartInstanceModel | null
): void {
	// TODO - the state could change after this sampling point. This should be handled properly
	let previousPartEndState: PartEndState | undefined = undefined
	if (blueprint.blueprint.getEndStateForPart && currentPartInstance) {
		try {
			const time = getCurrentTime()

			const resolvedPieces = getResolvedPiecesForCurrentPartInstance(
				context,
				showStyle.sourceLayers,
				currentPartInstance
			)

			const span = context.startSpan('blueprint.getEndStateForPart')
			const context2 = new RundownContext(
				{
					name: `${playlist.name}`,
					identifier: `playlist=${playlist._id},currentPartInstance=${
						currentPartInstance.partInstance._id
					},execution=${getRandomId()}`,
				},
				context.studio,
				context.getStudioBlueprintConfig(),
				showStyle,
				context.getShowStyleBlueprintConfig(showStyle),
				takeRundown
			)
			previousPartEndState = blueprint.blueprint.getEndStateForPart(
				context2,
				playlist.previousPersistentState,
				convertPartInstanceToBlueprints(currentPartInstance.partInstance),
				resolvedPieces.map(convertResolvedPieceInstanceToBlueprints),
				time
			)
			if (span) span.end()
			logger.info(`Calculated end state in ${getCurrentTime() - time}ms`)
		} catch (err) {
			logger.error(`Error in showStyleBlueprint.getEndStateForPart: ${stringifyError(err)}`)
			previousPartEndState = undefined
		}
	}

	// calculate and cache playout timing properties, so that we don't depend on the previousPartInstance:
	const tmpTakePieces = processAndPrunePieceInstanceTimings(
		showStyle.sourceLayers,
		takePartInstance.pieceInstances.map((p) => p.pieceInstance),
		0
	)
	const partPlayoutTimings = calculatePartTimings(
		playlist.holdState,
		currentPartInstance?.partInstance?.part,
		currentPartInstance?.pieceInstances?.map((p) => p.pieceInstance.piece) ?? [],
		takePartInstance.partInstance.part,
		tmpTakePieces.filter((p) => !p.infinite || p.infinite.infiniteInstanceIndex === 0).map((p) => p.piece)
	)

	takePartInstance.storePlayoutTimingsAndPreviousEndState(partPlayoutTimings, previousPartEndState)
}

export async function afterTake(
	context: JobContext,
	playoutModel: PlayoutModel,
	takePartInstance: PlayoutPartInstanceModel
): Promise<void> {
	const span = context.startSpan('afterTake')
	// This function should be called at the end of a "take" event (when the Parts have been updated)
	// or after a new part has started playing

	await updateTimeline(context, playoutModel)

	playoutModel.queueNotifyCurrentlyPlayingPartEvent(takePartInstance.partInstance.rundownId, takePartInstance)

	if (span) span.end()
}

/**
 * A Hold starts by extending the "extendOnHold"-able pieces in the previous Part.
 */
function startHold(
	context: JobContext,
	holdFromPartInstance: PlayoutPartInstanceModel | null,
	holdToPartInstance: PlayoutPartInstanceModel | undefined
) {
	if (!holdFromPartInstance) throw new Error('previousPart not found!')
	if (!holdToPartInstance) throw new Error('currentPart not found!')
	const span = context.startSpan('startHold')

	// Make a copy of any item which is flagged as an 'infinite' extension
	const pieceInstancesToCopy = holdFromPartInstance.pieceInstances.filter((p) => !!p.pieceInstance.piece.extendOnHold)
	pieceInstancesToCopy.forEach((instance) => {
		if (!instance.pieceInstance.infinite) {
			// mark current one as infinite
			instance.prepareForHold()

			// This gets deleted once the nextpart is activated, so it doesnt linger for long
			const extendedPieceInstance = holdToPartInstance.insertHoldPieceInstance(instance)

			const content = clone(instance.pieceInstance.piece.content) as VTContent | undefined
			if (content?.fileName && content.sourceDuration && instance.pieceInstance.plannedStartedPlayback) {
				content.seek = Math.min(
					content.sourceDuration,
					getCurrentTime() - instance.pieceInstance.plannedStartedPlayback
				)
			}
			extendedPieceInstance.updatePieceProps({ content })
		}
	})
	if (span) span.end()
}

async function completeHold(
	context: JobContext,
	playoutModel: PlayoutModel,
	showStyleCompound: ReadonlyDeep<ProcessedShowStyleCompound>,
	currentPartInstance: PlayoutPartInstanceModel | null
): Promise<void> {
	playoutModel.setHoldState(RundownHoldState.COMPLETE)

	if (playoutModel.playlist.currentPartInfo) {
		if (!currentPartInstance) throw new Error('currentPart not found!')

		// Clear the current extension line
		innerStopPieces(
			context,
			playoutModel,
			showStyleCompound.sourceLayers,
			currentPartInstance,
			(p) => !!p.infinite?.fromHold,
			undefined
		)
	}

	await updateTimeline(context, playoutModel)
}
