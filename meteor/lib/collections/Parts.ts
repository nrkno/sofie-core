import { RundownId } from './Rundowns'
import { SegmentId } from './Segments'
import { applyClassToDocument, registerCollection, ProtectedString, ProtectedStringProperties } from '../lib'
import { IBlueprintPartDB, NoteSeverity, PartHoldMode } from '@sofie-automation/blueprints-integration'
import { PartNote } from '../api/notes'
import { createMongoCollection } from './lib'
import { registerIndex } from '../database'
import { ITranslatableMessage } from '../api/TranslatableMessage'

/** A string, identifying a Part */
export type PartId = ProtectedString<'PartId'>

/** A "Line" in NRK Lingo. */

export interface PartInvalidReason {
	message: ITranslatableMessage
	level?: NoteSeverity
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

export class Part implements DBPart {
	// From IBlueprintPart:
	public externalId: string
	public title: string
	public metaData?: {
		[key: string]: any
	}
	public autoNext?: boolean
	public autoNextOverlap?: number
	public prerollDuration?: number
	public transitionPrerollDuration?: number | null
	public transitionKeepaliveDuration?: number | null
	public transitionDuration?: number | null
	public disableOutTransition?: boolean
	public outTransitionDuration?: number | null
	public expectedDuration?: number
	public budgetDuration?: number
	public holdMode?: PartHoldMode
	public shouldNotifyCurrentPlayingPart?: boolean
	public classes?: string[]
	public classesForNext?: string[]
	public displayDurationGroup?: string
	public displayDuration?: number
	public invalid?: boolean
	public invalidReason?: PartInvalidReason
	public untimed?: boolean
	public floated?: boolean
	public gap?: boolean
	// From IBlueprintPartDB:
	public _id: PartId
	public segmentId: SegmentId
	// From DBPart:
	public _rank: number
	public rundownId: RundownId
	public status?: string
	public notes?: Array<PartNote>
	public identifier?: string

	constructor(document: DBPart) {
		for (const [key, value] of Object.entries(document)) {
			this[key] = value
		}
	}

	isPlayable() {
		return isPartPlayable(this)
	}
}

export function isPartPlayable(part: DBPart) {
	return !part.invalid && !part.floated
}

export const Parts = createMongoCollection<Part, DBPart>('parts', {
	transform: (doc) => applyClassToDocument(Part, doc),
})
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
