import { Time } from '@sofie-automation/blueprints-integration'
import { PieceInstanceInfiniteId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PeripheralDeviceType } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { TimelineObjRundown } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { normalizeArray } from '@sofie-automation/corelib/dist/lib'
import { PieceTimelineMetadata } from './pieceGroup'
import { StudioPlayoutModelBase } from '../../studio/model/StudioPlayoutModel'
import { JobContext } from '../../jobs'
import { getCurrentTime } from '../../lib'
import { PlayoutModel } from '../model/PlayoutModel'
import { RundownTimelineTimingContext, getInfinitePartGroupId } from './rundown'
import { getExpectedLatency } from '@sofie-automation/corelib/dist/studio/playout'
import { getPieceControlObjectId } from '@sofie-automation/corelib/dist/playout/ids'
import { PlayoutPartInstanceModel } from '../model/PlayoutPartInstanceModel'
import { PlayoutPieceInstanceModel } from '../model/PlayoutPieceInstanceModel'

/**
 * We want it to be possible to generate a timeline without it containing any `start: 'now'`.
 * This is challenging to do while we are generating it, as the generation will take an unpredictable amount of time.
 * There are some db calls, and a call into the blueprint for `onTimelineGenerate`
 * Instead, this fixes up the timeline after we have finished generating it
 * This does introduce a risk of error when changes are made to how we generate the timeline, but that risk should be small.
 */
export function deNowifyMultiGatewayTimeline(
	context: JobContext,
	playoutModel: PlayoutModel,
	timelineObjs: TimelineObjRundown[],
	timeOffsetIntoPart: Time | undefined,
	timingContext: RundownTimelineTimingContext | undefined
): void {
	if (!timingContext) return

	const timelineObjsMap = normalizeArray(timelineObjs, 'id')

	const nowOffsetLatency = calculateNowOffsetLatency(context, playoutModel, timeOffsetIntoPart)
	const targetNowTime = getCurrentTime() + (nowOffsetLatency ?? 0)

	// Replace `start: 'now'` in currentPartInstance on timeline
	const currentPartInstance = playoutModel.CurrentPartInstance
	if (!currentPartInstance) return

	const partGroupTimings = updatePartInstancePlannedTimes(
		playoutModel,
		targetNowTime,
		timingContext,
		currentPartInstance,
		playoutModel.NextPartInstance
	)

	deNowifyCurrentPieces(
		targetNowTime,
		timingContext,
		currentPartInstance,
		partGroupTimings.currentStartTime,
		timelineObjsMap
	)

	updatePlannedTimingsForPieceInstances(playoutModel, currentPartInstance, partGroupTimings, timelineObjsMap)
}

export function calculateNowOffsetLatency(
	context: JobContext,
	studioPlayoutModel: StudioPlayoutModelBase,
	timeOffsetIntoPart: Time | undefined
): Time | undefined {
	/** The timestamp that "now" was set to */
	let nowOffsetLatency: Time | undefined

	if (studioPlayoutModel.isMultiGatewayMode) {
		const playoutDevices = studioPlayoutModel.PeripheralDevices.filter(
			(device) => device.type === PeripheralDeviceType.PLAYOUT
		)
		const worstLatency = Math.max(0, ...playoutDevices.map((device) => getExpectedLatency(device).safe))
		/** Add a little more latency, to account for network latency variability */
		const ADD_SAFE_LATENCY = context.studio.settings.multiGatewayNowSafeLatency || 30
		nowOffsetLatency = worstLatency + ADD_SAFE_LATENCY
	}

	if (timeOffsetIntoPart) {
		// Include the requested offset
		nowOffsetLatency = (nowOffsetLatency ?? 0) - timeOffsetIntoPart
	}

	return nowOffsetLatency
}

interface PartGroupTimings {
	currentStartTime: number
	currentEndTime: number | undefined
	nextStartTime: number | undefined
}

function updatePartInstancePlannedTimes(
	playoutModel: PlayoutModel,
	targetNowTime: number,
	timingContext: RundownTimelineTimingContext,
	currentPartInstance: PlayoutPartInstanceModel,
	nextPartInstance: PlayoutPartInstanceModel | null
): PartGroupTimings {
	let currentPartGroupStartTime: number
	if (!currentPartInstance.PartInstance.timings?.plannedStartedPlayback) {
		// Looks like the part is just being taken
		currentPartInstance.setPlannedStartedPlayback(targetNowTime)

		// Reflect this in the timeline
		timingContext.currentPartGroup.enable.start = targetNowTime
		currentPartGroupStartTime = targetNowTime
	} else {
		currentPartGroupStartTime = currentPartInstance.PartInstance.timings.plannedStartedPlayback
	}

	// Also mark the previous as ended
	const previousPartInstance = playoutModel.PreviousPartInstance
	if (previousPartInstance) {
		const previousPartEndTime = currentPartGroupStartTime + (timingContext.previousPartOverlap ?? 0)
		previousPartInstance.setPlannedStoppedPlayback(previousPartEndTime)
	}

	const currentPartGroupEndTime = timingContext.currentPartDuration
		? currentPartGroupStartTime + timingContext.currentPartDuration
		: undefined

	let nextPartGroupStartTime: number | undefined
	if (nextPartInstance && timingContext.nextPartGroup && currentPartGroupEndTime) {
		// Auto-next has been setup, make sure the start of the nexted group is planned and correct

		// Calculate the new start time for the auto-nexted group
		nextPartGroupStartTime = currentPartGroupEndTime - (timingContext.nextPartOverlap ?? 0)

		timingContext.nextPartGroup.enable.start = nextPartGroupStartTime

		nextPartInstance.setPlannedStartedPlayback(nextPartGroupStartTime)
	} else if (nextPartInstance) {
		// Make sure the next partInstance doesnt have a start time
		nextPartInstance.setPlannedStartedPlayback(undefined)
	}

	return {
		currentStartTime: currentPartGroupStartTime,
		currentEndTime: currentPartGroupEndTime,
		nextStartTime: nextPartGroupStartTime,
	}
}

function deNowifyCurrentPieces(
	targetNowTime: number,
	timingContext: RundownTimelineTimingContext,
	currentPartInstance: PlayoutPartInstanceModel,
	currentPartGroupStartTime: number,
	timelineObjsMap: Record<string, TimelineObjRundown>
) {
	// The relative time for 'now' to be resolved to, inside of the part group
	const nowInPart = targetNowTime - currentPartGroupStartTime

	// Ensure any pieces in the currentPartInstance have their now replaced
	for (const pieceInstance of currentPartInstance.PieceInstances) {
		if (pieceInstance.PieceInstance.piece.enable.start === 'now') {
			pieceInstance.updatePieceProps({
				enable: {
					...pieceInstance.PieceInstance.piece.enable,
					start: nowInPart,
				},
			})
		}
	}

	// Pieces without concrete times will add some special 'now' objects to the timeline that they can reference
	// Make sure that the all have concrete times attached
	for (const obj of Object.values<TimelineObjRundown>(timelineObjsMap)) {
		const objMetadata = obj.metaData as Partial<PieceTimelineMetadata> | undefined
		if (objMetadata?.isPieceTimeline && !Array.isArray(obj.enable) && obj.enable.start === 'now') {
			if (obj.inGroup === timingContext.currentPartGroup.id) {
				obj.enable = { start: nowInPart }
			} else if (!obj.inGroup) {
				obj.enable = { start: targetNowTime }
			}
		}
	}

	// Ensure any pieces with an unconfirmed userDuration is confirmed
	for (const pieceInstance of currentPartInstance.PieceInstances) {
		if (
			pieceInstance.PieceInstance.userDuration &&
			'endRelativeToNow' in pieceInstance.PieceInstance.userDuration
		) {
			const relativeToNow = pieceInstance.PieceInstance.userDuration.endRelativeToNow
			const endRelativeToPart = relativeToNow + nowInPart
			pieceInstance.setDuration({ endRelativeToPart })

			// Update the piece control obj
			const controlObj = timelineObjsMap[getPieceControlObjectId(pieceInstance.PieceInstance)]
			if (controlObj && !Array.isArray(controlObj.enable) && controlObj.enable.end === 'now') {
				controlObj.enable.end = endRelativeToPart
			}

			// If the piece is an infinite, there may be a now in the parent group
			const infiniteGroup = timelineObjsMap[getInfinitePartGroupId(pieceInstance.PieceInstance._id)]
			if (infiniteGroup && !Array.isArray(infiniteGroup.enable) && infiniteGroup.enable.end === 'now') {
				infiniteGroup.enable.end = targetNowTime + relativeToNow
			}
		}
	}
}

function updatePlannedTimingsForPieceInstances(
	playoutModel: PlayoutModel,
	currentPartInstance: PlayoutPartInstanceModel,
	partGroupTimings: PartGroupTimings,
	timelineObjsMap: Record<string, TimelineObjRundown>
) {
	const existingInfiniteTimings = new Map<PieceInstanceInfiniteId, Time>()
	const previousPartInstance = playoutModel.PreviousPartInstance
	if (previousPartInstance) {
		const pieceInstances = previousPartInstance.PieceInstances
		for (const pieceInstance of pieceInstances) {
			// Track the timings for the infinites
			const plannedStartedPlayback = pieceInstance.PieceInstance.plannedStartedPlayback
			if (pieceInstance.PieceInstance.infinite && plannedStartedPlayback) {
				existingInfiniteTimings.set(
					pieceInstance.PieceInstance.infinite.infiniteInstanceId,
					plannedStartedPlayback
				)
			}
		}
	}

	// Ensure any pieces have up to date timings
	for (const pieceInstance of currentPartInstance.PieceInstances) {
		setPlannedTimingsOnPieceInstance(
			pieceInstance,
			partGroupTimings.currentStartTime,
			partGroupTimings.currentEndTime
		)
		preserveOrTrackInfiniteTimings(existingInfiniteTimings, timelineObjsMap, pieceInstance)
	}

	const nextPartInstance = playoutModel.NextPartInstance
	if (nextPartInstance && partGroupTimings.nextStartTime) {
		const nextPartGroupStartTime0 = partGroupTimings.nextStartTime
		for (const pieceInstance of nextPartInstance.PieceInstances) {
			setPlannedTimingsOnPieceInstance(pieceInstance, nextPartGroupStartTime0, undefined)
			preserveOrTrackInfiniteTimings(existingInfiniteTimings, timelineObjsMap, pieceInstance)
		}
	}
}

function setPlannedTimingsOnPieceInstance(
	pieceInstance: PlayoutPieceInstanceModel,
	partPlannedStart: Time,
	partPlannedEnd: Time | undefined
): void {
	if (
		pieceInstance.PieceInstance.infinite &&
		pieceInstance.PieceInstance.infinite.infiniteInstanceIndex > 0 &&
		pieceInstance.PieceInstance.plannedStartedPlayback
	) {
		// If not the start of an infinite chain, then the plannedStartedPlayback flows differently
		return
	}

	if (typeof pieceInstance.PieceInstance.piece.enable.start === 'number') {
		const plannedStart = partPlannedStart + pieceInstance.PieceInstance.piece.enable.start
		pieceInstance.setPlannedStartedPlayback(plannedStart)

		const userDurationEnd =
			pieceInstance.PieceInstance.userDuration && 'endRelativeToPart' in pieceInstance.PieceInstance.userDuration
				? pieceInstance.PieceInstance.userDuration.endRelativeToPart
				: null
		const plannedEnd =
			userDurationEnd ??
			(pieceInstance.PieceInstance.piece.enable.duration
				? plannedStart + pieceInstance.PieceInstance.piece.enable.duration
				: partPlannedEnd)

		pieceInstance.setPlannedStoppedPlayback(plannedEnd)
	}
}

function preserveOrTrackInfiniteTimings(
	existingInfiniteTimings: Map<PieceInstanceInfiniteId, Time>,
	timelineObjsMap: Record<string, TimelineObjRundown>,
	pieceInstance: PlayoutPieceInstanceModel
): void {
	if (!pieceInstance.PieceInstance.infinite) return

	const plannedStartedPlayback = existingInfiniteTimings.get(pieceInstance.PieceInstance.infinite.infiniteInstanceId)
	if (plannedStartedPlayback) {
		// Found a value from the previousPartInstance, lets preserve it
		pieceInstance.setPlannedStartedPlayback(plannedStartedPlayback)
	} else {
		const plannedStartedPlayback = pieceInstance.PieceInstance.plannedStartedPlayback
		if (plannedStartedPlayback) {
			existingInfiniteTimings.set(pieceInstance.PieceInstance.infinite.infiniteInstanceId, plannedStartedPlayback)
		}
	}

	// Update the timeline group
	const startedPlayback = plannedStartedPlayback ?? pieceInstance.PieceInstance.plannedStartedPlayback
	if (startedPlayback) {
		const infinitePartGroupId = getInfinitePartGroupId(pieceInstance.PieceInstance._id)
		const infinitePartGroupObj = timelineObjsMap[infinitePartGroupId]
		if (
			infinitePartGroupObj &&
			!Array.isArray(infinitePartGroupObj.enable) &&
			typeof infinitePartGroupObj.enable.start === 'string'
		) {
			infinitePartGroupObj.enable.start = startedPlayback
		}
	}
}
