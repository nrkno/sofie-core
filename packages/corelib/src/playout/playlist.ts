import { DBRundown } from '../dataModel/Rundown'
import { DBSegment } from '../dataModel/Segment'
import { DBPart } from '../dataModel/Part'
import { SegmentId } from '../dataModel/Ids'
import { ReadonlyDeep } from 'type-fest'
import { normalizeArrayToMap } from '../lib'

export function sortSegmentsInRundowns<TSegment extends Pick<DBSegment, '_id' | 'rundownId' | '_rank'>>(
	segments: TSegment[],
	rundowns: Array<ReadonlyDeep<DBRundown>>
): TSegment[] {
	const rundownsMap = normalizeArrayToMap(rundowns, '_id')
	return segments.sort((a, b) => {
		if (a.rundownId === b.rundownId) {
			return a._rank - b._rank
		} else {
			const rdA = rundownsMap.get(a.rundownId)?._rank ?? Number.POSITIVE_INFINITY
			const rdB = rundownsMap.get(b.rundownId)?._rank ?? Number.POSITIVE_INFINITY
			return rdA - rdB
		}
	})
}
export function sortPartsInSegments(
	parts: DBPart[],
	rundowns: DBRundown[],
	segments: Array<Pick<DBSegment, '_id' | 'rundownId' | '_rank'>>
): DBPart[] {
	return sortPartsInSortedSegments(parts, sortSegmentsInRundowns(segments, rundowns))
}
export function sortPartsInSortedSegments<P extends DBPart>(
	parts: P[],
	sortedSegments: Array<Pick<DBSegment, '_id'>>
): P[] {
	const segmentRanks = new Map<SegmentId, number>()
	for (let i = 0; i < sortedSegments.length; i++) {
		segmentRanks.set(sortedSegments[i]._id, i)
	}

	return parts.sort((a, b) => {
		if (a.segmentId === b.segmentId) {
			return a._rank - b._rank
		} else {
			const segA = segmentRanks.get(a.segmentId) ?? Number.POSITIVE_INFINITY
			const segB = segmentRanks.get(b.segmentId) ?? Number.POSITIVE_INFINITY
			return segA - segB
		}
	})
}
