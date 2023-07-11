import { DBSegment } from '../dataModel/Segment'
import { DBPart } from '../dataModel/Part'
import { DBPartInstance } from '../dataModel/PartInstance'
import { RundownId, SegmentId } from '../dataModel/Ids'
import { ReadonlyDeep } from 'type-fest'

export function sortSegmentsInRundowns<TSegment extends Pick<DBSegment, '_id' | 'rundownId' | '_rank'>>(
	segments: TSegment[],
	rundownIdsInOrder: ReadonlyDeep<RundownId[]>
): TSegment[] {
	const rundownRankLookup = new Map<RundownId, number>()
	rundownIdsInOrder.forEach((id, index) => rundownRankLookup.set(id, index))

	return segments.sort((a, b) => {
		if (a.rundownId === b.rundownId) {
			return a._rank - b._rank
		} else {
			const rdA = rundownRankLookup.get(a.rundownId) ?? Number.POSITIVE_INFINITY
			const rdB = rundownRankLookup.get(b.rundownId) ?? Number.POSITIVE_INFINITY
			return rdA - rdB
		}
	})
}
export function sortPartsInSegments(
	parts: DBPart[],
	rundownIdsInOrder: ReadonlyDeep<RundownId[]>,
	segments: Array<Pick<DBSegment, '_id' | 'rundownId' | '_rank'>>
): DBPart[] {
	return sortPartsInSortedSegments(parts, sortSegmentsInRundowns(segments, rundownIdsInOrder))
}
export function sortPartsInSortedSegments<P extends Pick<DBPart, '_id' | 'segmentId' | '_rank'>>(
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

type SortableDBPartInstance = Pick<DBPartInstance, '_id' | 'segmentId' | 'takeCount'> & {
	part: Pick<DBPart, '_id' | '_rank'>
}
export function sortPartInstancesInSortedSegments<P extends SortableDBPartInstance>(
	partInstances: P[],
	sortedSegments: Array<Pick<DBSegment, '_id'>>
): P[] {
	const segmentRanks = new Map<SegmentId, number>()
	for (let i = 0; i < sortedSegments.length; i++) {
		segmentRanks.set(sortedSegments[i]._id, i)
	}

	return partInstances.sort((a, b) => {
		if (a.segmentId === b.segmentId) {
			return a.part._rank - b.part._rank || a.takeCount - b.takeCount
		} else {
			const segA = segmentRanks.get(a.segmentId) ?? Number.POSITIVE_INFINITY
			const segB = segmentRanks.get(b.segmentId) ?? Number.POSITIVE_INFINITY
			return segA - segB
		}
	})
}

/**
 * Sort an array of RundownIds based on a reference list
 * @param sortedPossibleIds The already sorted ids. This may be missing some of the unsorted ones
 * @param unsortedRundownIds The ids to sort
 */
export function sortRundownIDsInPlaylist(
	sortedPossibleIds: ReadonlyDeep<RundownId[]>,
	unsortedRundownIds: RundownId[]
): RundownId[] {
	const sortedVerifiedExisting = sortedPossibleIds.filter((id) => unsortedRundownIds.includes(id))

	// Find the ids which are missing from the playlist (just in case)
	const missingIds = unsortedRundownIds
		.filter((id) => !sortedVerifiedExisting.includes(id))
		.sort((a, b) => a.toString().localeCompare(b.toString()))

	return [...sortedVerifiedExisting, ...missingIds]
}
