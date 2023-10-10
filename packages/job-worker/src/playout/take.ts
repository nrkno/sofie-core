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
import { PartEventContext, RundownContext } from '../blueprints/context'
import { WrappedShowStyleBlueprint } from '../blueprints/cache'
import { innerStopPieces } from './adlibUtils'
import { reportPartInstanceHasStarted, reportPartInstanceHasStopped } from './timings/partPlayback'
import { EventsJobs } from '@sofie-automation/corelib/dist/worker/events'
import { calculatePartTimings } from '@sofie-automation/corelib/dist/playout/timings'
import { convertPartInstanceToBlueprints, convertResolvedPieceInstanceToBlueprints } from '../blueprints/context/lib'
import { processAndPrunePieceInstanceTimings } from '@sofie-automation/corelib/dist/playout/processAndPrune'
import { TakeNextPartProps } from '@sofie-automation/corelib/dist/worker/studio'
import { runJobWithPlayoutCache } from './lock'
import _ = require('underscore')

/**
 * Take the currently Next:ed Part (start playing it)
 */
export async function handleTakeNextPart(context: JobContext, data: TakeNextPartProps): Promise<void> {
	const now = getCurrentTime()

	return runJobWithPlayoutCache(
		context,
		data,
		async (cache) => {
			const playlist = cache.Playlist

			if (!playlist.activationId) throw UserError.create(UserErrorMessage.InactiveRundown, undefined, 412)

			if (!playlist.nextPartInfo && playlist.holdState !== RundownHoldState.ACTIVE)
				throw UserError.create(UserErrorMessage.TakeNoNextPart, undefined, 412)

			if ((playlist.currentPartInfo?.partInstanceId ?? null) !== data.fromPartInstanceId)
				throw UserError.create(UserErrorMessage.TakeFromIncorrectPart, undefined, 412)
		},
		async (cache) => {
			const playlist = cache.Playlist

			let lastTakeTime = playlist.lastTakeTime ?? 0

			if (playlist.currentPartInfo) {
				const currentPartInstance = cache.CurrentPartInstance?.PartInstance
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

			return performTakeToNextedPart(context, cache, now)
		}
	)
}

/**
 * Perform a Take into the nexted Part, and prepare a new nexted Part
 * @param context Context for current job
 * @param cache Cache for the active Playlist
 * @param now Current timestamp
 */
export async function performTakeToNextedPart(context: JobContext, cache: PlayoutModel, now: number): Promise<void> {
	const span = context.startSpan('takeNextPartInner')

	if (!cache.Playlist.activationId) throw new Error(`Rundown Playlist "${cache.Playlist._id}" is not active!`)

	const timeOffset: number | null = cache.Playlist.nextTimeOffset || null

	const currentPartInstance = cache.CurrentPartInstance
	const nextPartInstance = cache.NextPartInstance
	const previousPartInstance = cache.PreviousPartInstance

	const currentOrNextPartInstance = nextPartInstance ?? currentPartInstance
	if (!currentOrNextPartInstance) {
		// Some temporary logging to diagnose some cases where this route is hit
		logger.warn(`No partinstance was found during take`, JSON.stringify(cache.Playlist))
		logger.warn(
			'All PartInstances in cache',
			cache.SortedLoadedPartInstances.map((p) => p.PartInstance._id)
		)
		logger.warn('Deleted PartInstances in cache', cache.HackDeletedPartInstanceIds)
		logger.warn(
			'Parts in cache',
			cache.getAllOrderedParts().map((d) => d._id)
		)

		const validIds = _.compact([
			cache.Playlist.currentPartInfo?.partInstanceId,
			cache.Playlist.nextPartInfo?.partInstanceId,
		])
		if (validIds.length) {
			const mongoDocs = await context.directCollections.PartInstances.findFetch({ _id: { $in: validIds } })
			logger.warn('Matching partInstances in mongo', mongoDocs)
		}

		throw new Error(`No partInstance could be found!`)
	}
	const currentRundown = currentOrNextPartInstance
		? cache.getRundown(currentOrNextPartInstance.PartInstance.rundownId)
		: undefined
	if (!currentRundown)
		throw new Error(`Rundown "${currentOrNextPartInstance?.PartInstance?.rundownId ?? ''}" could not be found!`)

	const pShowStyle = context.getShowStyleCompound(
		currentRundown.Rundown.showStyleVariantId,
		currentRundown.Rundown.showStyleBaseId
	)

	if (currentPartInstance) {
		const now = getCurrentTime()
		if (currentPartInstance.PartInstance.blockTakeUntil && currentPartInstance.PartInstance.blockTakeUntil > now) {
			const remainingTime = currentPartInstance.PartInstance.blockTakeUntil - now
			// Adlib-actions can arbitrarily block takes from being done
			logger.debug(
				`Take is blocked until ${currentPartInstance.PartInstance.blockTakeUntil}. Which is in: ${remainingTime}`
			)
			throw UserError.create(UserErrorMessage.TakeBlockedDuration, { duration: remainingTime })
		}

		// If there was a transition from the previous Part, then ensure that has finished before another take is permitted
		const allowTransition = previousPartInstance && !previousPartInstance.PartInstance.part.disableNextInTransition
		const start = currentPartInstance.PartInstance.timings?.plannedStartedPlayback
		if (
			allowTransition &&
			currentPartInstance.PartInstance.part.inTransition &&
			start &&
			now < start + currentPartInstance.PartInstance.part.inTransition.blockTakeDuration
		) {
			throw UserError.create(UserErrorMessage.TakeDuringTransition)
		}

		if (isTooCloseToAutonext(currentPartInstance.PartInstance, true)) {
			throw UserError.create(UserErrorMessage.TakeCloseToAutonext)
		}
	}

	if (cache.Playlist.holdState === RundownHoldState.COMPLETE) {
		cache.setHoldState(RundownHoldState.NONE)

		// If hold is active, then this take is to clear it
	} else if (cache.Playlist.holdState === RundownHoldState.ACTIVE) {
		await completeHold(context, cache, await pShowStyle, currentPartInstance)

		if (span) span.end()

		return
	}

	const takePartInstance = nextPartInstance
	if (!takePartInstance) throw new Error('takePart not found!')
	const takeRundown = cache.getRundown(takePartInstance.PartInstance.rundownId)
	if (!takeRundown)
		throw new Error(`takeRundown: takeRundown not found! ("${takePartInstance.PartInstance.rundownId}")`)

	// Autonext may have setup the plannedStartedPlayback. Clear it so that a new value is generated
	takePartInstance.clearPlannedTimings()

	// it is only a first take if the Playlist has no startedPlayback and the taken PartInstance is not untimed
	const isFirstTake = !cache.Playlist.startedPlayback && !takePartInstance.PartInstance.part.untimed

	clearQueuedSegmentId(cache, takePartInstance.PartInstance, cache.Playlist.nextPartInfo)

	const nextPart = selectNextPart(
		context,
		cache.Playlist,
		takePartInstance.PartInstance,
		null,
		cache.getAllOrderedSegments(),
		cache.getAllOrderedParts()
	)

	const showStyle = await pShowStyle
	const blueprint = await context.getShowStyleBlueprint(showStyle._id)
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
					takeRundown.Rundown,
					takePartInstance.PartInstance
				)
			)
		} catch (err) {
			logger.error(`Error in showStyleBlueprint.onPreTake: ${stringifyError(err)}`)
		}
		if (span) span.end()
	}

	updatePartInstanceOnTake(
		context,
		cache.Playlist,
		showStyle,
		blueprint,
		takeRundown.Rundown,
		takePartInstance,
		currentPartInstance
	)

	cache.cycleSelectedPartInstances()

	takePartInstance.setTaken(now, timeOffset ?? 0)

	resetPreviousSegment(cache)

	// Once everything is synced, we can choose the next part
	await setNextPart(context, cache, nextPart, false)

	// Setup the parts for the HOLD we are starting
	if (cache.Playlist.previousPartInfo && (cache.Playlist.holdState as RundownHoldState) === RundownHoldState.ACTIVE) {
		startHold(context, currentPartInstance, nextPartInstance)
	}
	await afterTake(context, cache, takePartInstance, timeOffset)

	// Last:
	const takeDoneTime = getCurrentTime()
	cache.deferBeforeSave(async (cache2) => {
		await afterTakeUpdateTimingsAndEvents(context, cache2, showStyle, blueprint, isFirstTake, takeDoneTime)
	})

	if (span) span.end()
}

/**
 * Clear the nexted Segment, if taking into a PartInstance that consumes it
 * @param cache Cache for the active Playlist
 * @param takenPartInstance PartInstance to check
 */
export function clearQueuedSegmentId(
	cache: PlayoutModel,
	takenPartInstance: ReadonlyDeep<DBPartInstance> | undefined,
	takenPartInfo: ReadonlyDeep<SelectedPartInstance> | null
): void {
	if (
		takenPartInfo?.consumesQueuedSegmentId &&
		takenPartInstance &&
		cache.Playlist.queuedSegmentId === takenPartInstance.segmentId
	) {
		// clear the queuedSegmentId if the newly taken partInstance says it was selected because of it
		cache.setQueuedSegment(null)
	}
}

/**
 * Reset the Segment of the previousPartInstance, if playback has left that Segment and the Rundown is looping
 * @param cache Cache for the active Playlist
 */
export function resetPreviousSegment(cache: PlayoutModel): void {
	const previousPartInstance = cache.PreviousPartInstance
	const currentPartInstance = cache.CurrentPartInstance

	// If the playlist is looping and
	// If the previous and current part are not in the same segment, then we have just left a segment
	if (
		cache.Playlist.loop &&
		previousPartInstance &&
		previousPartInstance.PartInstance.segmentId !== currentPartInstance?.PartInstance?.segmentId
	) {
		// Reset the old segment
		const segmentId = previousPartInstance.PartInstance.segmentId
		for (const partInstance of cache.LoadedPartInstances) {
			if (partInstance.PartInstance.segmentId === segmentId) {
				partInstance.markAsReset()
			}
		}
	}
}

async function afterTakeUpdateTimingsAndEvents(
	context: JobContext,
	cache: PlayoutModel,
	showStyle: ReadonlyDeep<ProcessedShowStyleCompound>,
	blueprint: ReadonlyDeep<WrappedShowStyleBlueprint>,
	isFirstTake: boolean,
	takeDoneTime: number
): Promise<void> {
	const takePartInstance = cache.CurrentPartInstance
	const previousPartInstance = cache.PreviousPartInstance

	if (takePartInstance) {
		// Simulate playout, if no gateway
		const playoutDevices = cache.PeripheralDevices.filter((d) => d.type === PeripheralDeviceType.PLAYOUT)
		if (playoutDevices.length === 0) {
			logger.info(
				`No Playout gateway attached to studio, reporting PartInstance "${
					takePartInstance.PartInstance._id
				}" to have started playback on timestamp ${new Date(takeDoneTime).toISOString()}`
			)
			reportPartInstanceHasStarted(context, cache, takePartInstance, takeDoneTime)

			if (previousPartInstance) {
				logger.info(
					`Also reporting PartInstance "${
						previousPartInstance.PartInstance._id
					}" to have stopped playback on timestamp ${new Date(takeDoneTime).toISOString()}`
				)
				reportPartInstanceHasStopped(context, cache, previousPartInstance, takeDoneTime)
			}

			// Future: is there anything we can do for simulating autoNext?
		}

		const takeRundown = takePartInstance ? cache.getRundown(takePartInstance.PartInstance.rundownId) : undefined

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
							takeRundown.Rundown,
							takePartInstance.PartInstance
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
						takeRundown.Rundown,
						takePartInstance.PartInstance
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
						currentPartInstance.PartInstance._id
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
				convertPartInstanceToBlueprints(currentPartInstance.PartInstance),
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
		takePartInstance.PieceInstances,
		0
	)
	const partPlayoutTimings = calculatePartTimings(
		playlist.holdState,
		currentPartInstance?.PartInstance?.part,
		currentPartInstance?.PieceInstances?.map((p) => p.piece) ?? [],
		takePartInstance.PartInstance.part,
		tmpTakePieces.filter((p) => !p.infinite || p.infinite.infiniteInstanceIndex === 0).map((p) => p.piece)
	)

	takePartInstance.storePlayoutTimingsAndPreviousEndState(partPlayoutTimings, previousPartEndState)
}

export async function afterTake(
	context: JobContext,
	cache: PlayoutModel,
	takePartInstance: PlayoutPartInstanceModel,
	timeOffsetIntoPart: number | null = null
): Promise<void> {
	const span = context.startSpan('afterTake')
	// This function should be called at the end of a "take" event (when the Parts have been updated)
	// or after a new part has started playing

	await updateTimeline(context, cache, timeOffsetIntoPart || undefined)

	cache.deferAfterSave(async () => {
		// This is low-prio, defer so that it's executed well after publications has been updated,
		// so that the playout gateway has haf the chance to learn about the timeline changes
		if (takePartInstance.PartInstance.part.shouldNotifyCurrentPlayingPart) {
			context
				.queueEventJob(EventsJobs.NotifyCurrentlyPlayingPart, {
					rundownId: takePartInstance.PartInstance.rundownId,
					isRehearsal: !!cache.Playlist.rehearsal,
					partExternalId: takePartInstance.PartInstance.part.externalId,
				})
				.catch((e) => {
					logger.warn(`Failed to queue NotifyCurrentlyPlayingPart job: ${e}`)
				})
		}
	})

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
	const pieceInstancesToCopy = holdFromPartInstance.PieceInstances.filter((p) => !!p.piece.extendOnHold)
	pieceInstancesToCopy.forEach((instance) => {
		if (!instance.infinite) {
			// mark current one as infinite
			const infiniteInstanceId = holdFromPartInstance.preparePieceInstanceForHold(instance._id)

			// This gets deleted once the nextpart is activated, so it doesnt linger for long
			const extendedPieceInstance = holdToPartInstance.addHoldPieceInstance(instance, infiniteInstanceId)

			const content = clone(instance.piece.content) as VTContent | undefined
			if (content?.fileName && content.sourceDuration && instance.plannedStartedPlayback) {
				content.seek = Math.min(content.sourceDuration, getCurrentTime() - instance.plannedStartedPlayback)
			}
			holdToPartInstance.updatePieceProps(extendedPieceInstance._id, { content })
		}
	})
	if (span) span.end()
}

async function completeHold(
	context: JobContext,
	cache: PlayoutModel,
	showStyleCompound: ReadonlyDeep<ProcessedShowStyleCompound>,
	currentPartInstance: PlayoutPartInstanceModel | null
): Promise<void> {
	cache.setHoldState(RundownHoldState.COMPLETE)

	if (cache.Playlist.currentPartInfo) {
		if (!currentPartInstance) throw new Error('currentPart not found!')

		// Clear the current extension line
		innerStopPieces(
			context,
			cache,
			showStyleCompound.sourceLayers,
			currentPartInstance,
			(p) => !!p.infinite?.fromHold,
			undefined
		)
	}

	await updateTimeline(context, cache)
}
