export type WithSortingMetadata<T> = {
	obj: T
	id: string
	label: string
	itemRank?: number
	rundownRank?: number
	segmentRank?: number
	partRank?: number
}

export function sortContent<T>(contentData: WithSortingMetadata<T>[]): T[] {
	function comparator(a: WithSortingMetadata<T>, b: WithSortingMetadata<T>): number {
		a.rundownRank = a.rundownRank ?? Number.POSITIVE_INFINITY
		b.rundownRank = b.rundownRank ?? Number.POSITIVE_INFINITY
		if (a.rundownRank > b.rundownRank) return 1
		if (a.rundownRank < b.rundownRank) return -1

		// Sort by segment rank, where applicable:
		a.segmentRank = a.segmentRank ?? Number.POSITIVE_INFINITY
		b.segmentRank = b.segmentRank ?? Number.POSITIVE_INFINITY
		if (a.segmentRank > b.segmentRank) return 1
		if (a.segmentRank < b.segmentRank) return -1

		// Sort by part rank, where applicable:
		a.partRank = a.partRank ?? Number.POSITIVE_INFINITY
		b.partRank = b.partRank ?? Number.POSITIVE_INFINITY
		if (a.partRank > b.partRank) return 1
		if (a.partRank < b.partRank) return -1

		a.itemRank = a.itemRank ?? Number.POSITIVE_INFINITY
		b.itemRank = b.itemRank ?? Number.POSITIVE_INFINITY
		if (a.itemRank > b.itemRank) return 1
		if (a.itemRank < b.itemRank) return -1

		if (a.label !== b.label) return a.label?.localeCompare(b.label)

		// if everything else fails, fall back to sorting on the ID for a stable sort
		// As a last resort, sort by ids:
		if (a.id > b.id) return 1
		if (a.id < b.id) return -1

		return 0
	}

	return contentData.sort(comparator).map((res) => res.obj)
}

export function getRank<Key, Value extends { _rank?: number }>(
	map: ReadonlyMap<Key, Value>,
	key: Key | undefined
): number | undefined {
	if (key === undefined) return undefined
	return map.get(key)?._rank
}
