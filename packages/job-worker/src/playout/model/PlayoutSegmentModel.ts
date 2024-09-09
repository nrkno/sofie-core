import { PartId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReadonlyDeep } from 'type-fest'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'

/**
 * Wrap a Segment and its Parts in a readonly and simplified view for Playout operations
 */
export interface PlayoutSegmentModel {
	/**
	 * The Segment properties
	 */
	readonly segment: ReadonlyDeep<DBSegment>

	/**
	 * All the Parts in the Segment
	 * Sorted by their rank
	 */
	readonly parts: ReadonlyDeep<DBPart[]>

	/**
	 * Get a Part which belongs to this Segment
	 * @param id Id of the Part
	 */
	getPart(id: PartId): ReadonlyDeep<DBPart> | undefined

	/**
	 * Get all the PartIds in this Segment
	 * Sorted by the Part ranks
	 */
	getPartIds(): PartId[]
}
