import {
	IBlueprintPieceType,
	PieceLifespan,
	TimelineObjClassesCore,
	TSR,
} from '@sofie-automation/blueprints-integration'
import { PartInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PieceInstanceInfinite } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { DBRundownPlaylist, RundownHoldState } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import {
	TimelineObjGroupPart,
	TimelineObjRundown,
	OnGenerateTimelineObjExt,
	TimelineObjType,
} from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { getPartGroupId } from '@sofie-automation/corelib/dist/playout/ids'
import { PieceInstanceWithTimings } from '@sofie-automation/corelib/dist/playout/infinites'
import {
	PartCalculatedTimings,
	getPartTimingsOrDefaults,
	calculatePartTimings,
} from '@sofie-automation/corelib/dist/playout/timings'
import { protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { JobContext } from '../../jobs'
import { Time } from 'superfly-timeline'
import { ReadonlyDeep } from 'type-fest'
import { SelectedPartInstancesTimelineInfo, SelectedPartInstanceTimelineInfo } from './generate'
import { createPartGroup, createPartGroupFirstObject, transformPartIntoTimeline } from './part'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { literal, normalizeArrayToMapFunc } from '@sofie-automation/corelib/dist/lib'
import { getCurrentTime } from '../../lib'
import _ = require('underscore')
import { CacheForPlayout } from '../cache'
import { getPieceEnableInsidePart, transformPieceGroupAndObjects } from './piece'
import { logger } from '../../logging'

export function buildTimelineObjsForRundown(
	context: JobContext,
	cache: CacheForPlayout,
	_activeRundown: DBRundown,
	partInstancesInfo: SelectedPartInstancesTimelineInfo
): (TimelineObjRundown & OnGenerateTimelineObjExt)[] {
	const span = context.startSpan('buildTimelineObjsForRundown')
	const timelineObjs: Array<TimelineObjRundown & OnGenerateTimelineObjExt> = []

	const activePlaylist = cache.Playlist.doc
	const currentTime = getCurrentTime()

	timelineObjs.push(
		literal<TimelineObjRundown & OnGenerateTimelineObjExt>({
			id: activePlaylist._id + '_status',
			objectType: TimelineObjType.RUNDOWN,
			enable: { while: 1 },
			layer: 'rundown_status',
			content: {
				deviceType: TSR.DeviceType.ABSTRACT,
			},
			classes: [
				activePlaylist.rehearsal
					? TimelineObjClassesCore.RundownRehearsal
					: TimelineObjClassesCore.RundownActive,
				!activePlaylist.currentPartInstanceId ? TimelineObjClassesCore.BeforeFirstPart : undefined,
				!activePlaylist.nextPartInstanceId ? TimelineObjClassesCore.NoNextPart : undefined,
			].filter((v): v is TimelineObjClassesCore => v !== undefined),
			partInstanceId: null,
			metaData: undefined,
		})
	)

	// Fetch the nextPart first, because that affects how the currentPart will be treated
	if (activePlaylist.nextPartInstanceId) {
		// We may be at the end of a show, where there is no next part
		if (!partInstancesInfo.next) throw new Error(`PartInstance "${activePlaylist.nextPartInstanceId}" not found!`)
	}
	if (activePlaylist.currentPartInstanceId) {
		// We may be before the beginning of a show, and there can be no currentPart and we are waiting for the user to Take
		if (!partInstancesInfo.current)
			throw new Error(`PartInstance "${activePlaylist.currentPartInstanceId}" not found!`)
	}
	if (activePlaylist.previousPartInstanceId) {
		// We may be at the beginning of a show, where there is no previous part
		if (!partInstancesInfo.previous)
			logger.warn(`Previous PartInstance "${activePlaylist.previousPartInstanceId}" not found!`)
	}

	if (!partInstancesInfo.next && !partInstancesInfo.current) {
		// maybe at the end of the show
		logger.info(`No next part and no current part set on RundownPlaylist "${activePlaylist._id}".`)
	}

	// Currently playing:
	if (partInstancesInfo.current) {
		const [currentInfinitePieces, currentNormalItems] = _.partition(
			partInstancesInfo.current.pieceInstances,
			(l) => !!(l.infinite && (l.piece.lifespan !== PieceLifespan.WithinPart || l.infinite.fromHold))
		)

		// Find all the infinites in each of the selected parts
		const currentInfinitePieceIds = new Set(
			_.compact(currentInfinitePieces.map((l) => l.infinite?.infiniteInstanceId))
		)
		const nextPartInfinites = new Map<PieceInstanceInfinite['infiniteInstanceId'], PieceInstanceWithTimings>()
		if (partInstancesInfo.current.partInstance.part.autoNext && partInstancesInfo.next) {
			partInstancesInfo.next.pieceInstances.forEach((piece) => {
				if (piece.infinite) {
					nextPartInfinites.set(piece.infinite.infiniteInstanceId, piece)
				}
			})
		}

		const previousPartInfinites: Map<PieceInstanceInfinite['infiniteInstanceId'], PieceInstanceWithTimings> =
			partInstancesInfo.previous
				? normalizeArrayToMapFunc(partInstancesInfo.previous.pieceInstances, (inst) =>
						inst.infinite ? inst.infinite.infiniteInstanceId : undefined
				  )
				: new Map()

		const currentPartInstanceTimings = getPartTimingsOrDefaults(
			partInstancesInfo.current.partInstance,
			partInstancesInfo.current.pieceInstances
		)

		// The startTime of this start is used as the reference point for the calculated timings, so we can use 'now' and everything will lie after this point
		const currentPartEnable: TSR.Timeline.TimelineEnable = { start: 'now' }
		if (partInstancesInfo.current.partInstance.timings?.startedPlayback) {
			// If we are recalculating the currentPart, then ensure it doesnt think it is starting now
			currentPartEnable.start = partInstancesInfo.current.partInstance.timings.startedPlayback
		}

		if (
			partInstancesInfo.next &&
			partInstancesInfo.current.partInstance.part.autoNext &&
			partInstancesInfo.current.partInstance.part.expectedDuration !== undefined
		) {
			// If there is a valid autonext out of the current part, then calculate the duration
			currentPartEnable.duration =
				partInstancesInfo.current.partInstance.part.expectedDuration + currentPartInstanceTimings.toPartDelay
		}
		const currentPartGroup = createPartGroup(partInstancesInfo.current.partInstance, currentPartEnable)

		// Start generating objects
		if (partInstancesInfo.previous) {
			timelineObjs.push(
				...generatePreviousPartInstanceObjects(
					context,
					activePlaylist,
					partInstancesInfo.previous,
					currentInfinitePieceIds,
					currentPartGroup.id,
					currentPartInstanceTimings
				)
			)
		}

		// any continued infinite lines need to skip the group, as they need a different start trigger
		for (const infinitePiece of currentInfinitePieces) {
			timelineObjs.push(
				...generateCurrentInfinitePieceObjects(
					activePlaylist,
					partInstancesInfo.current,
					partInstancesInfo.next,
					previousPartInfinites,
					nextPartInfinites,
					currentPartGroup,
					infinitePiece,
					currentTime,
					currentPartInstanceTimings
				)
			)
		}

		const groupClasses: string[] = ['current_part']
		timelineObjs.push(
			currentPartGroup,
			createPartGroupFirstObject(
				activePlaylist._id,
				partInstancesInfo.current.partInstance,
				currentPartGroup,
				partInstancesInfo.previous?.partInstance
			),
			...transformPartIntoTimeline(
				context,
				activePlaylist._id,
				currentNormalItems,
				groupClasses,
				currentPartGroup,
				partInstancesInfo.current.nowInPart,
				currentPartInstanceTimings,
				activePlaylist.holdState === RundownHoldState.ACTIVE,
				partInstancesInfo.current.partInstance.part.outTransition ?? null
			)
		)

		// only add the next objects into the timeline if the current partgroup has a duration, and can autoNext
		if (partInstancesInfo.next && currentPartEnable.duration) {
			timelineObjs.push(
				...generateNextPartInstanceObjects(
					context,
					activePlaylist,
					partInstancesInfo.current,
					partInstancesInfo.next,
					currentPartGroup
				)
			)
		}
	}

	if (span) span.end()
	return timelineObjs
}

function generateCurrentInfinitePieceObjects(
	activePlaylist: ReadonlyDeep<DBRundownPlaylist>,
	currentPartInfo: SelectedPartInstanceTimelineInfo,
	nextPartInfo: SelectedPartInstanceTimelineInfo | undefined,
	previousPartInfinites: Map<PieceInstanceInfinite['infiniteInstanceId'], PieceInstanceWithTimings>,
	nextPartInfinites: Map<PieceInstanceInfinite['infiniteInstanceId'], PieceInstanceWithTimings>,
	currentPartGroup: TimelineObjGroupPart,
	pieceInstance: PieceInstanceWithTimings,
	currentTime: Time,
	currentPartInstanceTimings: PartCalculatedTimings
): Array<TimelineObjRundown & OnGenerateTimelineObjExt> {
	if (!pieceInstance.infinite) {
		// Type guard, should never be hit
		return []
	}
	if (pieceInstance.disabled || pieceInstance.piece.pieceType !== IBlueprintPieceType.Normal) {
		// Can't be generated as infinites
		return []
	}

	const infiniteGroup = createPartGroup(currentPartInfo.partInstance, {
		start: `#${currentPartGroup.id}.start`, // This gets overriden with a concrete time if the original piece is known to have already started
	})
	infiniteGroup.id = getPartGroupId(protectString<PartInstanceId>(unprotectString(pieceInstance._id))) + '_infinite' // This doesnt want to belong to a part, so force the ids
	infiniteGroup.priority = 1

	const groupClasses: string[] = ['current_part']
	// If the previousPart also contains another segment of this infinite piece, then we label our new one as such
	if (previousPartInfinites.get(pieceInstance.infinite.infiniteInstanceId)) {
		groupClasses.push('continues_infinite')
	}

	let nowInParent = currentPartInfo.nowInPart
	let isAbsoluteInfinitePartGroup = false
	if (pieceInstance.startedPlayback) {
		// Make the start time stick
		infiniteGroup.enable = { start: pieceInstance.startedPlayback }
		nowInParent = currentTime - pieceInstance.startedPlayback
		isAbsoluteInfinitePartGroup = true

		// If an absolute time has been set by a hotkey, then update the duration to be correct
		if (pieceInstance.userDuration && pieceInstance.piece.enable.start !== 'now') {
			infiniteGroup.enable.duration = pieceInstance.userDuration.end - pieceInstance.piece.enable.start
		}
	}

	// If this infinite piece continues to the next part, and has a duration then we should respect that in case it is really close to the take
	const hasDurationOrEnd = (enable: TSR.Timeline.TimelineEnable) =>
		enable.duration !== undefined || enable.end !== undefined
	const infiniteInNextPart = nextPartInfinites.get(pieceInstance.infinite.infiniteInstanceId)
	if (
		infiniteInNextPart &&
		!hasDurationOrEnd(infiniteGroup.enable) &&
		hasDurationOrEnd(infiniteInNextPart.piece.enable)
	) {
		// infiniteGroup.enable.end = infiniteInNextPart.piece.enable.end
		infiniteGroup.enable.duration = infiniteInNextPart.piece.enable.duration
	}

	// If this piece does not continue in the next part, then set it to end with the part it belongs to
	if (nextPartInfo && currentPartInfo.partInstance.part.autoNext && infiniteGroup.enable.duration === undefined) {
		if (pieceInstance.infinite) {
			const infiniteInstanceId = pieceInstance.infinite.infiniteInstanceId
			const nextItem = nextPartInfo.pieceInstances.find(
				(p) => p.infinite && p.infinite.infiniteInstanceId === infiniteInstanceId
			)
			if (!nextItem) {
				infiniteGroup.enable.end = `#${currentPartGroup.id}.end`
				if (currentPartInstanceTimings.fromPartPostroll) {
					infiniteGroup.enable.end += ' - ' + currentPartInstanceTimings.fromPartPostroll
				}
				if (pieceInstance.piece.postrollDuration) {
					infiniteGroup.enable.end += ' + ' + pieceInstance.piece.postrollDuration
				}
			}
		}
	}

	const isInfiniteContinuation =
		pieceInstance.infinite && pieceInstance.piece.startPartId !== currentPartInfo.partInstance.part._id

	let pieceEnable: TSR.Timeline.TimelineEnable
	let pieceStartOffset = 0
	if (isAbsoluteInfinitePartGroup || isInfiniteContinuation) {
		pieceEnable = { start: 0 }

		if (pieceInstance.piece.enable.start !== 'now') pieceStartOffset = pieceInstance.piece.enable.start
	} else {
		pieceEnable = getPieceEnableInsidePart(pieceInstance, currentPartInstanceTimings, currentPartGroup.id)
	}

	if (pieceInstance.userDuration) {
		pieceEnable.end = pieceInstance.userDuration.end
		delete pieceEnable.duration
	}

	// Still show objects flagged as 'HoldMode.EXCEPT' if this is a infinite continuation as they belong to the previous too
	const isOriginOfInfinite = pieceInstance.piece.startPartId !== currentPartInfo.partInstance.part._id
	const isInHold = activePlaylist.holdState === RundownHoldState.ACTIVE

	return [
		infiniteGroup,
		...transformPieceGroupAndObjects(
			activePlaylist._id,
			infiniteGroup,
			nowInParent,
			pieceInstance,
			pieceEnable,
			pieceStartOffset,
			groupClasses,
			isInHold,
			isOriginOfInfinite
		),
	]
}

function generatePreviousPartInstanceObjects(
	context: JobContext,
	activePlaylist: ReadonlyDeep<DBRundownPlaylist>,
	previousPartInfo: SelectedPartInstanceTimelineInfo,
	currentInfinitePieceIds: Set<PieceInstanceInfinite['infinitePieceId']>,
	currentPartGroupId: string,
	currentPartInstanceTimings: PartCalculatedTimings
): Array<TimelineObjRundown & OnGenerateTimelineObjExt> {
	const partStartedPlayback = previousPartInfo.partInstance.timings?.startedPlayback
	if (partStartedPlayback) {
		// The previous part should continue for a while into the following part
		const prevPartOverlapDuration = currentPartInstanceTimings.fromPartRemaining

		const previousPartGroup = createPartGroup(previousPartInfo.partInstance, {
			start: partStartedPlayback,
			end: `#${currentPartGroupId}.start + ${prevPartOverlapDuration}`,
		})
		previousPartGroup.priority = -1

		// If a Piece is infinite, and continued in the new Part, then we want to add the Piece only there to avoid id collisions
		const previousContinuedPieces = previousPartInfo.pieceInstances.filter(
			(pi) => !pi.infinite || !currentInfinitePieceIds.has(pi.infinite.infiniteInstanceId)
		)

		const groupClasses: string[] = ['previous_part']

		return [
			previousPartGroup,
			...transformPartIntoTimeline(
				context,
				activePlaylist._id,
				previousContinuedPieces,
				groupClasses,
				previousPartGroup,
				previousPartInfo.nowInPart,
				getPartTimingsOrDefaults(previousPartInfo.partInstance, previousPartInfo.pieceInstances),
				activePlaylist.holdState === RundownHoldState.ACTIVE,
				previousPartInfo.partInstance.part.outTransition ?? null
			),
		]
	} else {
		return []
	}
}

function generateNextPartInstanceObjects(
	context: JobContext,
	activePlaylist: ReadonlyDeep<DBRundownPlaylist>,
	currentPartInfo: SelectedPartInstanceTimelineInfo,
	nextPartInfo: SelectedPartInstanceTimelineInfo,
	currentPartGroup: TimelineObjGroupPart
): Array<TimelineObjRundown & OnGenerateTimelineObjExt> {
	const currentToNextTimings = calculatePartTimings(
		activePlaylist.holdState,
		currentPartInfo.partInstance.part,
		currentPartInfo.pieceInstances.map((p) => p.piece),
		nextPartInfo.partInstance.part,
		nextPartInfo.pieceInstances
			.filter((p) => !p.infinite || p.infinite.infiniteInstanceIndex === 0)
			.map((p) => p.piece)
	)

	const nextPartGroup = createPartGroup(nextPartInfo.partInstance, {})

	nextPartGroup.enable = {
		start: `#${currentPartGroup.id}.end - ${currentToNextTimings.fromPartRemaining}`,
		duration: nextPartGroup.enable.duration,
	}

	const nextPieceInstances = nextPartInfo?.pieceInstances.filter(
		(i) => !i.infinite || i.infinite.infiniteInstanceIndex === 0
	)

	const groupClasses: string[] = ['next_part']

	return [
		nextPartGroup,
		createPartGroupFirstObject(
			activePlaylist._id,
			nextPartInfo.partInstance,
			nextPartGroup,
			currentPartInfo.partInstance
		),
		...transformPartIntoTimeline(
			context,
			activePlaylist._id,
			nextPieceInstances,
			groupClasses,
			nextPartGroup,
			0,
			currentToNextTimings,
			false,
			nextPartInfo.partInstance.part.outTransition ?? null
		),
	]
}
