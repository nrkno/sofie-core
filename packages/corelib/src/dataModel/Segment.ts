import { IBlueprintSegmentDB } from '@sofie-automation/blueprints-integration'
import { MongoFieldSpecifierOnes } from '../mongo'
import { ProtectedStringProperties } from '../protectedString'
import { SegmentId, RundownId } from './Ids'
import { SegmentNote } from './Notes'

export enum SegmentOrphanedReason {
	/** Segment is deleted from the NRCS but we still need it */
	DELETED = 'deleted',
	/** Segment should be hidden, but it is still playing */
	HIDDEN = 'hidden',
}

// TV 2 uses this for the not-yet-contributed MiniShelf
export const orphanedHiddenSegmentPropertiesToPreserve: MongoFieldSpecifierOnes<DBSegment> = {}

/** A "Title" in NRK Lingo / "Stories" in ENPS Lingo. */
export interface DBSegment extends ProtectedStringProperties<IBlueprintSegmentDB, '_id'> {
	_id: SegmentId
	/** Position inside rundown */
	_rank: number
	/** ID of the source object in the gateway */
	externalId: string
	/** Timestamp when the externalData was last modified */
	externalModified: number
	/** The rundown this segment belongs to */
	rundownId: RundownId

	/** Is the segment in an unsynced state? */
	orphaned?: SegmentOrphanedReason

	/** Holds notes (warnings / errors) thrown by the blueprints during creation */
	notes?: Array<SegmentNote>
}
