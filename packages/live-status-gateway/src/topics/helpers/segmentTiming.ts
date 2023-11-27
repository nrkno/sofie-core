import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'

export interface SegmentTiming {
	budgetDurationMs?: number
	expectedDurationMs: number
}

export interface CurrentSegmentTiming extends SegmentTiming {
	projectedEndTime: number
}

export function calculateCurrentSegmentTiming(
	currentPartInstance: DBPartInstance,
	firstInstanceInSegmentPlayout: DBPartInstance | undefined,
	segmentPartInstances: DBPartInstance[],
	segmentParts: DBPart[]
): CurrentSegmentTiming {
	const segmentTiming = calculateSegmentTiming(segmentParts)
	const playedDurations = segmentPartInstances.reduce((sum, partInstance) => {
		return (partInstance.timings?.duration ?? 0) + sum
	}, 0)
	const currentPartInstanceStart =
		currentPartInstance.timings?.reportedStartedPlayback ??
		currentPartInstance.timings?.plannedStartedPlayback ??
		Date.now()
	const leftToPlay = segmentTiming.expectedDurationMs - playedDurations
	const projectedEndTime = leftToPlay + currentPartInstanceStart
	const projectedBudgetEndTime =
		(firstInstanceInSegmentPlayout?.timings?.reportedStartedPlayback ??
			firstInstanceInSegmentPlayout?.timings?.plannedStartedPlayback ??
			0) + (segmentTiming.budgetDurationMs ?? 0)
	return {
		...segmentTiming,
		projectedEndTime: segmentTiming.budgetDurationMs != null ? projectedBudgetEndTime : projectedEndTime,
	}
}

export function calculateSegmentTiming(segmentParts: DBPart[]): SegmentTiming {
	return {
		budgetDurationMs: segmentParts.reduce<number | undefined>((sum, part): number | undefined => {
			return part.budgetDuration != null && !part.untimed ? (sum ?? 0) + part.budgetDuration : sum
		}, undefined),
		expectedDurationMs: segmentParts.reduce<number>((sum, part): number => {
			return part.expectedDurationWithPreroll != null && !part.untimed
				? sum + part.expectedDurationWithPreroll
				: sum
		}, 0),
	}
}
