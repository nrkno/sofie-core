import { applyClassToDocument, registerCollection } from '../lib'
import { PartHoldMode } from '@sofie-automation/blueprints-integration'
import { PartNote } from '../api/notes'
import { createMongoCollection } from './lib'
import { registerIndex } from '../database'
import { ITranslatableMessage } from '../api/TranslatableMessage'
import { PartId, RundownId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
export { PartId }

import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
export * from '@sofie-automation/corelib/dist/dataModel/Part'

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
	public expectedDuration?: number
	public holdMode?: PartHoldMode
	public shouldNotifyCurrentPlayingPart?: boolean
	public classes?: string[]
	public classesForNext?: string[]
	public displayDurationGroup?: string
	public displayDuration?: number
	public invalid?: boolean
	public invalidReason?: {
		message: ITranslatableMessage
		color?: string
	}
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
