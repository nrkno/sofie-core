import { PartId, RundownId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'

export type WithSortingMetadata<T> = {
	obj: T
	id: string
	label: string
	_rank?: number
	rundownId?: RundownId
	segmentId?: SegmentId
	partId?: PartId
}

export function sortContent<T>(
	contentData: WithSortingMetadata<T>[],
	rundownIdsInOrder: RundownId[],
	segments: ReadonlyMap<SegmentId, DBSegment>,
	parts: ReadonlyMap<PartId, DBPart>
): T[] {
	function comparator(a: WithSortingMetadata<T>, b: WithSortingMetadata<T>): number {
		if (a.rundownId !== b.rundownId)
			return (
				(a.rundownId ? rundownIdsInOrder.indexOf(a.rundownId) : -1) -
				(b.rundownId ? rundownIdsInOrder.indexOf(b.rundownId) : -1)
			)
		if (a.segmentId !== b.segmentId) return getRank(segments, a.segmentId) - getRank(segments, b.segmentId)
		if (a.partId !== b.partId) return getRank(parts, a.partId) - getRank(parts, b.partId)
		if (a.label !== b.label) return a.label?.localeCompare(b.label)
		// if everything else fails, fall back to sorting on the ID for a stable sort
		return a.id.localeCompare(b.id)
	}

	return contentData.sort(comparator).map((res) => res.obj)
}

function getRank<Key, Value extends { _rank?: number }>(map: ReadonlyMap<Key, Value>, key: Key | undefined): number {
	if (key === undefined) return -1
	return map.get(key)?._rank ?? -1
}
