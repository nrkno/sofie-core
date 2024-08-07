import { IBlueprintPartDB, NoteSeverity } from '@sofie-automation/blueprints-integration'
import { ITranslatableMessage } from '../TranslatableMessage'
import { ProtectedStringProperties } from '../protectedString'
import { PartId, RundownId, SegmentId } from './Ids'
import { PartNote } from './Notes'

export interface PartInvalidReason {
	message: ITranslatableMessage
	severity?: NoteSeverity
	color?: string
}

/** A "Line" in NRK Lingo. */
export interface DBPart extends ProtectedStringProperties<IBlueprintPartDB, '_id' | 'segmentId'> {
	_id: PartId
	/**
	 * Position inside the segment
	 * Parts always have a integer rank, spaced by one. This is defined during the core portion of ingest.
	 * When an orphaned PartInstance this can be a decimal value.
	 */
	_rank: number

	/** The rundown this line belongs to */
	rundownId: RundownId
	segmentId: SegmentId

	/** Holds notes (warnings / errors) thrown by the blueprints during creation */
	notes?: Array<PartNote>

	/** Holds the user-facing explanation for why the part is invalid */
	invalidReason?: PartInvalidReason

	/** Human readable unqiue identifier of the part */
	identifier?: string

	/** A modified expectedDuration with the piece/transition derived timings factored in */
	expectedDurationWithTransition: number | undefined
}

export function isPartPlayable(part: DBPart): boolean {
	return !part.invalid && !part.floated
}
