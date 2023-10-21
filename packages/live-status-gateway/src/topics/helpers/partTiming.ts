import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'

export interface PartTiming {
	startTime: number
	expectedDurationMs: number
	expectedEndTime: number
}

export function calculateCurrentPartTiming(
	currentPartInstance: DBPartInstance,
	segmentPartInstances: DBPartInstance[]
): PartTiming {
	const isMemberOfDisplayDurationGroup = currentPartInstance.part.displayDurationGroup !== undefined
	let expectedDuration = currentPartInstance.part.expectedDuration ?? 0

	if (isMemberOfDisplayDurationGroup && currentPartInstance.part.expectedDuration === 0) {
		// TODO: support partInstance order edge case
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

	return {
		startTime: currentPartInstance.timings?.plannedStartedPlayback ?? 0,
		expectedDurationMs: currentPartInstance.part.expectedDuration ?? 0,
		expectedEndTime: (currentPartInstance.timings?.plannedStartedPlayback ?? 0) + expectedDuration,
	}
}
