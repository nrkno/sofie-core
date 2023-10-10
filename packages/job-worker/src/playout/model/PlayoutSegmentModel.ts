import { PartId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReadonlyDeep } from 'type-fest'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'

export interface PlayoutSegmentModel {
	readonly Segment: ReadonlyDeep<DBSegment>

	/**
	 * All the Parts in the segment
	 * Sorted by their rank
	 */
	readonly Parts: ReadonlyDeep<DBPart[]>

	getPartIds(): PartId[]

	getPart(id: PartId): ReadonlyDeep<DBPart> | undefined
}
