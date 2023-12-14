import { PartId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReadonlyDeep } from 'type-fest'
import { DBSegment, SegmentOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { IngestPartModel, IngestPartModelReadonly } from './IngestPartModel'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'

export interface IngestSegmentModelReadonly {
	/**
	 * The Segment properties
	 */
	readonly segment: ReadonlyDeep<DBSegment>

	/**
	 * All the Parts in the Segment
	 * Sorted by their rank
	 */
	readonly parts: IngestPartModelReadonly[]

	/**
	 * Get a Part which belongs to this Segment
	 * @param id Id of the Part
	 */
	getPart(id: PartId): IngestPartModelReadonly | undefined

	/**
	 * Get all the PartIds in this Segment
	 * Sorted by the Part ranks
	 */
	getPartIds(): PartId[]
}

/**
 * Wrap a Segment and its Parts in a view for Ingest operations
 */
export interface IngestSegmentModel extends IngestSegmentModelReadonly {
	/**
	 * All the Parts in the Segment
	 * Sorted by their rank
	 */
	readonly parts: IngestPartModel[]

	/**
	 * Get a Part which belongs to this Segment
	 * @param id Id of the Part
	 */
	getPart(id: PartId): IngestPartModel | undefined

	setRank(rank: number): boolean

	setOrphaned(orphaned: SegmentOrphanedReason | undefined): void

	setHidden(hidden: boolean): void

	removeAllParts(): PartId[]

	replacePart(part: DBPart, pieces: Piece[], adLibPiece: AdLibPiece[], adLibActions: AdLibAction[]): IngestPartModel
}
