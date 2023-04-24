import { Time } from '@sofie-automation/blueprints-integration'
import { PieceInstanceInfiniteId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PeripheralDeviceType } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { TimelineObjRundown } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { normalizeArray } from '@sofie-automation/corelib/dist/lib'
import { PieceTimelineMetadata } from '@sofie-automation/corelib/dist/playout/pieces'
import { CacheForStudioBase } from '../../studio/cache'
import { JobContext } from '../../jobs'
import { getCurrentTime } from '../../lib'
import { CacheForPlayout, getSelectedPartInstancesFromCache } from '../cache'
import { RundownTimelineTimingContext, getInfinitePartGroupId } from './rundown'
import { getExpectedLatency } from '@sofie-automation/corelib/dist/studio/playout'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { getPieceControlObjectId } from '@sofie-automation/corelib/dist/playout/ids'

/**
 * We want it to be possible to generate a timeline without it containing any `start: 'now'`.
 * This is challenging to do while we are generating it, as the generation will take an unpredictable amount of time.
 * There are some db calls, and a call into the blueprint for `onTimelineGenerate`
 * Instead, this fixes up the timeline after we have finished generating it
 * This does introduce a risk of error when changes are made to how we generate the timeline, but that risk should be small.
 */
export function deNowifyMultiGatewayTimeline(
	context: JobContext,
	cache: CacheForPlayout,
	timelineObjs: TimelineObjRundown[],
	timeOffsetIntoPart: Time | undefined,
	timingContext: RundownTimelineTimingContext | undefined
): void {
	if (!timingContext) return

	const timelineObjsMap = normalizeArray(timelineObjs, 'id')

	const nowOffsetLatency = calculateNowOffsetLatency(context, cache, timeOffsetIntoPart)
	const targetNowTime = getCurrentTime() + (nowOffsetLatency ?? 0)

	// Replace `start: 'now'` in currentPartInstance on timeline
	const { currentPartInstance, nextPartInstance } = getSelectedPartInstancesFromCache(cache)
	if (!currentPartInstance) return

	const partGroupTimings = updatePartInstancePlannedTimes(
		cache,
		targetNowTime,
		timingContext,
		currentPartInstance,
		nextPartInstance
	)

	deNowifyCurrentPieces(
		cache,
		targetNowTime,
		timingContext,
		currentPartInstance,
		partGroupTimings.currentStartTime,
		timelineObjsMap
	)

	updatePlannedTimingsForPieceInstances(cache, currentPartInstance, partGroupTimings, timelineObjsMap)
}

export function calculateNowOffsetLatency(
	context: JobContext,
	cache: CacheForStudioBase,
	timeOffsetIntoPart: Time | undefined
): Time | undefined {
	/** The timestamp that "now" was set to */
	let nowOffsetLatency: Time | undefined

	if (cache.isMultiGatewayMode) {
		const playoutDevices = cache.PeripheralDevices.findAll((device) => device.type === PeripheralDeviceType.PLAYOUT)
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
	cache: CacheForPlayout,
	targetNowTime: number,
	timingContext: RundownTimelineTimingContext,
	currentPartInstance: DBPartInstance,
	nextPartInstance: DBPartInstance | undefined
): PartGroupTimings {
	let currentPartGroupStartTime: number
	if (!currentPartInstance.timings?.plannedStartedPlayback) {
		// Looks like the part is just being taken
		cache.PartInstances.updateOne(
			currentPartInstance._id,
			(instance) => {
				if (instance.timings?.plannedStartedPlayback !== targetNowTime) {
					if (!instance.timings) instance.timings = {}
					instance.timings.plannedStartedPlayback = targetNowTime
					return instance
				} else {
					return false
				}
			},
			true
		)

		// Reflect this in the timeline
		timingContext.currentPartGroup.enable.start = targetNowTime
		currentPartGroupStartTime = targetNowTime
	} else {
		currentPartGroupStartTime = currentPartInstance.timings.plannedStartedPlayback
	}

	// Also mark the previous as ended
	if (cache.Playlist.doc.previousPartInfo) {
		const previousPartEndTime = currentPartGroupStartTime + (timingContext.previousPartOverlap ?? 0)
		cache.PartInstances.updateOne(
			cache.Playlist.doc.previousPartInfo.partInstanceId,
			(instance) => {
				if (
					instance.timings?.plannedStartedPlayback &&
					instance.timings?.plannedStoppedPlayback !== previousPartEndTime
				) {
					if (!instance.timings) instance.timings = {}
					instance.timings.plannedStoppedPlayback = previousPartEndTime
					return instance
				} else {
					return false
				}
			},
			true
		)
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

		cache.PartInstances.updateOne(
			nextPartInstance._id,
			(instance) => {
				if (instance.timings?.plannedStartedPlayback !== nextPartGroupStartTime) {
					if (!instance.timings) instance.timings = {}
					instance.timings.plannedStartedPlayback = nextPartGroupStartTime
					delete instance.timings.plannedStoppedPlayback
					return instance
				} else {
					return false
				}
			},
			true
		)
	} else if (nextPartInstance) {
		// Make sure the next partInstance doesnt have a start time
		cache.PartInstances.updateOne(
			nextPartInstance._id,
			(instance) => {
				if (instance.timings?.plannedStartedPlayback) {
					delete instance.timings.plannedStartedPlayback
					return instance
				} else {
					return false
				}
			},
			true
		)
	}

	return {
		currentStartTime: currentPartGroupStartTime,
		currentEndTime: currentPartGroupEndTime,
		nextStartTime: nextPartGroupStartTime,
	}
}

function deNowifyCurrentPieces(
	cache: CacheForPlayout,
	targetNowTime: number,
	timingContext: RundownTimelineTimingContext,
	currentPartInstance: DBPartInstance,
	currentPartGroupStartTime: number,
	timelineObjsMap: Record<string, TimelineObjRundown>
) {
	// The relative time for 'now' to be resolved to, inside of the part group
	const nowInPart = targetNowTime - currentPartGroupStartTime

	// Ensure any pieces in the currentPartInstance have their now replaced
	cache.PieceInstances.updateAll((p) => {
		if (p.partInstanceId === currentPartInstance._id && p.piece.enable.start === 'now') {
			p.piece.enable.start = nowInPart
			return p
		}

		return false
	}, true)

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
	cache.PieceInstances.updateAll((p) => {
		if (p.partInstanceId === currentPartInstance._id && p.userDuration && 'endRelativeToNow' in p.userDuration) {
			const relativeToNow = p.userDuration.endRelativeToNow
			p.userDuration = {
				endRelativeToPart: relativeToNow + nowInPart,
			}

			// Update the piece control obj
			const controlObj = timelineObjsMap[getPieceControlObjectId(p)]
			if (controlObj && !Array.isArray(controlObj.enable) && controlObj.enable.end === 'now') {
				controlObj.enable.end = p.userDuration.endRelativeToPart
			}

			// If the piece is an infinite, there may be a now in the parent group
			const infiniteGroup = timelineObjsMap[getInfinitePartGroupId(p._id)]
			if (infiniteGroup && !Array.isArray(infiniteGroup.enable) && infiniteGroup.enable.end === 'now') {
				infiniteGroup.enable.end = targetNowTime + relativeToNow
			}

			return p
		}

		return false
	})
}

function updatePlannedTimingsForPieceInstances(
	cache: CacheForPlayout,
	currentPartInstance: DBPartInstance,
	partGroupTimings: PartGroupTimings,
	timelineObjsMap: Record<string, TimelineObjRundown>
) {
	const existingInfiniteTimings = new Map<PieceInstanceInfiniteId, Time>()
	if (cache.Playlist.doc.previousPartInfo) {
		const previousPartInstanceId = cache.Playlist.doc.previousPartInfo.partInstanceId
		const pieceInstances = cache.PieceInstances.findAll((p) => p.partInstanceId === previousPartInstanceId)
		for (const pieceInstance of pieceInstances) {
			// Track the timings for the infinites
			const plannedStartedPlayback = pieceInstance.plannedStartedPlayback
			if (pieceInstance.infinite && plannedStartedPlayback) {
				existingInfiniteTimings.set(pieceInstance.infinite.infiniteInstanceId, plannedStartedPlayback)
			}
		}
	}

	// Ensure any pieces have up to date timings
	cache.PieceInstances.updateAll((p) => {
		if (p.partInstanceId === currentPartInstance._id) {
			let res = setPlannedTimingsOnPieceInstance(
				p,
				partGroupTimings.currentStartTime,
				partGroupTimings.currentEndTime
			)
			res = preserveOrTrackInfiniteTimings(existingInfiniteTimings, timelineObjsMap, res || p) || res

			return res
		} else {
			return false
		}
	}, true)

	if (cache.Playlist.doc.nextPartInfo && partGroupTimings.nextStartTime) {
		const nextPartGroupStartTime0 = partGroupTimings.nextStartTime
		cache.PieceInstances.updateAll((p) => {
			if (p.partInstanceId === currentPartInstance._id) {
				let res = setPlannedTimingsOnPieceInstance(p, nextPartGroupStartTime0, undefined)
				res = preserveOrTrackInfiniteTimings(existingInfiniteTimings, timelineObjsMap, res || p) || res

				return res
			} else {
				return false
			}
		}, true)
	}
}

function setPlannedTimingsOnPieceInstance(
	pieceInstance: PieceInstance,
	partPlannedStart: Time,
	partPlannedEnd: Time | undefined
): PieceInstance | false {
	if (
		pieceInstance.infinite &&
		pieceInstance.infinite.infiniteInstanceIndex > 0 &&
		pieceInstance.plannedStartedPlayback
	) {
		// If not the start of an infinite chain, then the plannedStartedPlayback flows differently
		return false
	}

	let changed = false

	if (typeof pieceInstance.piece.enable.start === 'number') {
		const plannedStart = partPlannedStart + pieceInstance.piece.enable.start
		if (pieceInstance.plannedStartedPlayback !== plannedStart) {
			pieceInstance.plannedStartedPlayback = plannedStart
			changed = true
		}

		const userDurationEnd =
			pieceInstance.userDuration && 'endRelativeToPart' in pieceInstance.userDuration
				? pieceInstance.userDuration.endRelativeToPart
				: null
		const plannedEnd =
			userDurationEnd ??
			(pieceInstance.piece.enable.duration ? plannedStart + pieceInstance.piece.enable.duration : partPlannedEnd)

		if (pieceInstance.plannedStoppedPlayback !== plannedEnd) {
			pieceInstance.plannedStoppedPlayback = plannedEnd
			changed = true
		}
	}

	return changed ? pieceInstance : false
}

function preserveOrTrackInfiniteTimings(
	existingInfiniteTimings: Map<PieceInstanceInfiniteId, Time>,
	timelineObjsMap: Record<string, TimelineObjRundown>,
	pieceInstance: PieceInstance
): PieceInstance | false {
	let changed = false
	if (pieceInstance.infinite) {
		const plannedStartedPlayback = existingInfiniteTimings.get(pieceInstance.infinite.infiniteInstanceId)
		if (plannedStartedPlayback) {
			// Found a value from the previousPartInstance, lets preserve it
			if (pieceInstance.plannedStartedPlayback !== plannedStartedPlayback) {
				pieceInstance.plannedStartedPlayback = plannedStartedPlayback
				changed = true
			}
		} else {
			const plannedStartedPlayback = pieceInstance.plannedStartedPlayback
			if (plannedStartedPlayback) {
				existingInfiniteTimings.set(pieceInstance.infinite.infiniteInstanceId, plannedStartedPlayback)
			}
		}

		// Update the timeline group
		const startedPlayback = plannedStartedPlayback ?? pieceInstance.plannedStartedPlayback
		if (startedPlayback) {
			const infinitePartGroupId = getInfinitePartGroupId(pieceInstance._id)
			const infinitePartGroupObj = timelineObjsMap[infinitePartGroupId]
			if (
				infinitePartGroupObj &&
				!Array.isArray(infinitePartGroupObj.enable) &&
				typeof infinitePartGroupObj.enable.start === 'string'
			) {
				infinitePartGroupObj.enable.start = startedPlayback
				changed = true
			}
		}
	}

	return changed ? pieceInstance : false
}
