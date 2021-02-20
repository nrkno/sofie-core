import { IBlueprintPartDB } from '@sofie-automation/blueprints-integration'
import { ITranslatableMessage } from '../lib'
import { ProtectedStringProperties } from '../protectedString'
import { PartId, RundownId, SegmentId } from './Ids'
import { PartNote } from './Notes'

/** A "Line" in NRK Lingo. */
export interface DBPart extends ProtectedStringProperties<IBlueprintPartDB, '_id' | 'segmentId'> {
	_id: PartId
	/** Position inside the segment */
	_rank: number

	/** The rundown this line belongs to */
	rundownId: RundownId
	segmentId: SegmentId

	status?: string

	/** Holds notes (warnings / errors) thrown by the blueprints during creation */
	notes?: Array<PartNote>

	/** Holds the user-facing explanation for why the part is invalid */
	invalidReason?: {
		message: ITranslatableMessage
		color?: string
	}

	/** Human readable unqiue identifier of the part */
	identifier?: string
}

export function isPartPlayable(part: DBPart) {
	return !part.invalid && !part.floated
}
