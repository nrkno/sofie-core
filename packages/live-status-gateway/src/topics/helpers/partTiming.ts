import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'

export interface PartTiming {
	startTime: number
	expectedDurationMs: number
	projectedEndTime: number
}

export function calculateCurrentPartTiming(
	currentPartInstance: DBPartInstance,
	segmentPartInstances: DBPartInstance[]
): PartTiming {
	const isMemberOfDisplayDurationGroup = currentPartInstance.part.displayDurationGroup !== undefined
	let expectedDuration = currentPartInstance.part.expectedDuration ?? 0

	if (isMemberOfDisplayDurationGroup && currentPartInstance.part.expectedDuration === 0) {
		// TODO: This implementation currently only handles the simplest use case of Display Duration Groups,
		// where all members of a group are within a single Segment, and one or more Parts with expectedDuration===0
		// follow (not necessarily immediately) a Part with expectedDuration!==0.
		const displayDurationGroup = segmentPartInstances.filter(
			(partInstance) => partInstance.part.displayDurationGroup === currentPartInstance.part.displayDurationGroup
		)
		const groupDuration = displayDurationGroup.reduce((sum, partInstance) => {
			return sum + (partInstance.part.expectedDurationWithPreroll ?? 0)
		}, 0)
		const groupPlayed = displayDurationGroup.reduce((sum, partInstance) => {
			return (partInstance.timings?.duration ?? 0) + sum
		}, 0)
		expectedDuration = groupDuration - groupPlayed
	}

	const startTime =
		currentPartInstance.timings?.reportedStartedPlayback ??
		currentPartInstance.timings?.plannedStartedPlayback ??
		Date.now()

	return {
		startTime,
		expectedDurationMs: currentPartInstance.part.expectedDuration ?? 0,
		projectedEndTime: startTime + expectedDuration,
	}
}
