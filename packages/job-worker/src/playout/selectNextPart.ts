import { DBPart, isPartPlayable } from '@sofie-automation/corelib/dist/dataModel/Part'
import { JobContext } from '../jobs'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'

/**
 * This wraps a Part which has been selected to be next, to include some additional data about that choice
 */
export interface SelectNextPartResult {
	/**
	 * The Part selected to be nexted
	 */
	part: DBPart

	/**
	 * The index of the Part in the provided list of all sorted Parts
	 */
	index: number

	/**
	 * Whether this Part consumes the `nextSegmentId` property on the rundown.
	 * If true, when this PartInstance is taken, the `nextSegmentId` property on the Playlist will be cleared
	 */
	consumesNextSegmentId: boolean
}
export interface PartsAndSegments {
	segments: DBSegment[]
	parts: DBPart[]
}

/**
 * Select the Part in the Playlist which should be set as next
 */

export function selectNextPart(
	context: JobContext,
	rundownPlaylist: Pick<DBRundownPlaylist, 'nextSegmentId' | 'loop'>,
	previousPartInstance: DBPartInstance | null,
	currentlySelectedPartInstance: DBPartInstance | null,
	{ parts: parts0, segments }: PartsAndSegments,
	ignoreUnplayabale = true
): SelectNextPartResult | null {
	const span = context.startSpan('selectNextPart')

	// In the parts array, insert currentlySelectedPartInstance over its part, as it is already nexted, so wont change unless necessary
	const parts = currentlySelectedPartInstance
		? parts0.map((p) => (p._id === currentlySelectedPartInstance.part._id ? currentlySelectedPartInstance.part : p))
		: parts0

	/**
	 * Iterates over all the parts and searches for the first one to be playable
	 * @param offset the index from where to start the search
	 * @param condition whether the part will be returned
	 * @param length the maximum index or where to stop the search
	 */
	const findFirstPlayablePart = (
		offset: number,
		condition?: (part: DBPart) => boolean,
		length?: number
	): SelectNextPartResult | undefined => {
		// Filter to after and find the first playabale
		for (let index = offset; index < (length || parts.length); index++) {
			const part = parts[index]
			if ((!ignoreUnplayabale || isPartPlayable(part)) && (!condition || condition(part))) {
				return { part, index, consumesNextSegmentId: false }
			}
		}
		return undefined
	}

	let searchFromIndex = 0
	if (previousPartInstance) {
		const currentIndex = parts.findIndex((p) => p._id === previousPartInstance.part._id)
		if (currentIndex !== -1) {
			// Start looking at the next part
			searchFromIndex = currentIndex + 1
		} else {
			const segmentStarts = new Map<SegmentId, number>()
			parts.forEach((p, i) => {
				if (!segmentStarts.has(p.segmentId)) {
					segmentStarts.set(p.segmentId, i)
				}
			})

			// Look for other parts in the segment to reference
			const segmentStartIndex = segmentStarts.get(previousPartInstance.segmentId)
			if (segmentStartIndex !== undefined) {
				let nextInSegmentIndex: number | undefined
				for (let i = segmentStartIndex; i < parts.length; i++) {
					const part = parts[i]
					if (part.segmentId !== previousPartInstance.segmentId) break
					if (part._rank <= previousPartInstance.part._rank) {
						nextInSegmentIndex = i + 1
					}
				}

				searchFromIndex = nextInSegmentIndex ?? segmentStartIndex
			} else {
				// If we didn't find the segment in the list of parts, then look for segments after this one.
				const segmentIndex = segments.findIndex((s) => s._id === previousPartInstance.segmentId)
				let followingSegmentStart: number | undefined
				if (segmentIndex !== -1) {
					// Find the first segment with parts that lies after this
					for (let i = segmentIndex + 1; i < segments.length; i++) {
						const segmentStart = segmentStarts.get(segments[i]._id)
						if (segmentStart !== undefined) {
							followingSegmentStart = segmentStart
							break
						}
					}

					// Either there is a segment after, or we are at the end of the rundown
					searchFromIndex = followingSegmentStart ?? parts.length + 1
				} else {
					// Somehow we cannot place the segment, so the start of the playlist is better than nothing
				}
			}
		}
	}

	// Filter to after and find the first playabale
	let nextPart = findFirstPlayablePart(searchFromIndex)

	if (rundownPlaylist.nextSegmentId) {
		// No previous part, or segment has changed
		if (!previousPartInstance || (nextPart && previousPartInstance.segmentId !== nextPart.part.segmentId)) {
			// Find first in segment
			const newSegmentPart = findFirstPlayablePart(0, (part) => part.segmentId === rundownPlaylist.nextSegmentId)
			if (newSegmentPart) {
				// If matched matched, otherwise leave on auto
				nextPart = {
					...newSegmentPart,
					consumesNextSegmentId: true,
				}
			}
		}
	}

	// if playlist should loop, check from 0 to currentPart
	if (rundownPlaylist.loop && !nextPart && previousPartInstance) {
		// Search up until the current part
		nextPart = findFirstPlayablePart(0, undefined, searchFromIndex - 1)
	}

	if (span) span.end()
	return nextPart ?? null
}
