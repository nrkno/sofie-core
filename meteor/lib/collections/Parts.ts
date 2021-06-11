import * as _ from 'underscore'
import { FindOptions, MongoQuery } from '../typings/meteor'
import { RundownId } from './Rundowns'
import { Piece, Pieces } from './Pieces'
import { SegmentId } from './Segments'
import {
	applyClassToDocument,
	registerCollection,
	normalizeArray,
	ProtectedString,
	ProtectedStringProperties,
} from '../lib'
import { RundownAPI } from '../api/rundown'
import { checkPieceContentStatus, getNoteTypeForPieceStatus } from '../mediaObjects'
import { IBlueprintPartDB, PartHoldMode } from '@sofie-automation/blueprints-integration'
import { PartNote, NoteType } from '../api/notes'
import { createMongoCollection } from './lib'
import { Studio } from './Studios'
import { ShowStyleBase } from './ShowStyleBases'
import { registerIndex } from '../database'
import { ITranslatableMessage } from '../api/TranslatableMessage'

/** A string, identifying a Part */
export type PartId = ProtectedString<'PartId'>

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
	getPieces(selector?: MongoQuery<Piece>, options?: FindOptions<Piece>) {
		selector = selector || {}
		options = options || {}
		return Pieces.find(
			{
				startRundownId: this.rundownId,
				startPartId: this._id,
				...selector,
			},
			{
				...options,
			}
		).fetch()
	}
	getAllPieces() {
		return this.getPieces()
	}

	getInvalidReasonNotes(): Array<PartNote> {
		return this.invalidReason
			? [
					{
						type: NoteType.ERROR,
						message: this.invalidReason.message,
						origin: {
							name: this.title,
						},
					},
			  ]
			: []
	}
	getMinimumReactivePieceNotes(studio: Studio, showStyleBase: ShowStyleBase): Array<PartNote> {
		const notes: Array<PartNote> = []

		const pieces = this.getPieces()
		const partLookup = showStyleBase && normalizeArray(showStyleBase.sourceLayers, '_id')
		for (let i = 0; i < pieces.length; i++) {
			const piece = pieces[i]
			// TODO: check statuses (like media availability) here

			if (partLookup && piece.sourceLayerId && partLookup[piece.sourceLayerId]) {
				const part = partLookup[piece.sourceLayerId]
				const st = checkPieceContentStatus(piece, part, studio)
				if (st.status !== RundownAPI.PieceStatusCode.OK && st.status !== RundownAPI.PieceStatusCode.UNKNOWN) {
					notes.push({
						type: getNoteTypeForPieceStatus(st.status) || NoteType.WARNING,
						origin: {
							name: 'Media Check',
							pieceId: piece._id,
						},
						message: {
							key: st.message || '',
						},
					})
				}
			}
		}
		return notes
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
