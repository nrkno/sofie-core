import { RundownId } from './Rundowns'
import { SegmentId } from './Segments'
import { registerCollection, ProtectedString, ProtectedStringProperties } from '../lib'
import { IBlueprintPartDB, NoteSeverity } from '@sofie-automation/blueprints-integration'
import { PartNote } from '../api/notes'
import { createMongoCollection } from './lib'
import { registerIndex } from '../database'
import { ITranslatableMessage } from '../api/TranslatableMessage'

/** A string, identifying a Part */
export type PartId = ProtectedString<'PartId'>

/** A "Line" in NRK Lingo. */

export interface PartInvalidReason {
	message: ITranslatableMessage
	severity?: NoteSeverity
	color?: string
}
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
	invalidReason?: PartInvalidReason

	/** Human readable unqiue identifier of the part */
	identifier?: string
}

export type Part = DBPart

export function isPartPlayable(part: DBPart) {
	return !part.invalid && !part.floated
}

export const Parts = createMongoCollection<Part>('parts')
registerCollection('Parts', Parts)

registerIndex(Parts, {
	rundownId: 1,
	segmentId: 1,
	_rank: 1,
})
registerIndex(Parts, {
	rundownId: 1,
	_rank: 1,
})
