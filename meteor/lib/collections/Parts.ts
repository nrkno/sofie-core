import * as _ from 'underscore'
import { TransformedCollection, FindOptions, MongoQuery } from '../typings/meteor'
import { Rundowns, Rundown, RundownId } from './Rundowns'
import { Piece, Pieces } from './Pieces'
import { AdLibPieces, AdLibPiece } from './AdLibPieces'
import { Segments, SegmentId } from './Segments'
import {
	applyClassToDocument,
	Time,
	registerCollection,
	normalizeArray,
	ProtectedString,
	ProtectedStringProperties,
} from '../lib'
import { RundownAPI } from '../api/rundown'
import { checkPieceContentStatus, getNoteTypeForPieceStatus } from '../mediaObjects'
import { Meteor } from 'meteor/meteor'
import {
	IBlueprintPartDB,
	PartHoldMode,
	IBlueprintPartDBTimings,
	PartEndState,
} from 'tv-automation-sofie-blueprints-integration'
import { PartNote, NoteType } from '../api/notes'
import { createMongoCollection } from './lib'
import { Studio } from './Studios'
import { ShowStyleBase } from './ShowStyleBases'

/** A string, identifying a Part */
export type PartId = ProtectedString<'PartId'>

/** A "Line" in NRK Lingo. */
export interface DBPart
	extends ProtectedStringProperties<IBlueprintPartDB, '_id' | 'segmentId' | 'dynamicallyInsertedAfterPartId'> {
	_id: PartId
	/** Position inside the segment */
	_rank: number

	/** The rundown this line belongs to */
	rundownId: RundownId
	segmentId: SegmentId

	status?: string

	/** Whether the part has started playback (the most recent time it was played).
	 * This is reset each time setAsNext is used.
	 * This is set from a callback from the playout gateway
	 */
	startedPlayback?: boolean
	/** Whether the part has stopped playback (the most recent time it was played & stopped).
	 * This is set from a callback from the playout gateway
	 */
	stoppedPlayback?: boolean
	/** Whether this part was taken (the most recent time it was played).
	 * This is reset each time setAsNext is used.
	 * This is set immediately by core
	 */
	taken?: boolean

	/** The time the system played back this part, null if not yet finished playing, in milliseconds.
	 * This is set when Take:ing the next part
	 */
	duration?: number
	// /** The end state of the previous part, to allow for bits of this to part to be based on what the previous did/was */
	// previousPartEndState?: PartEndState

	/** Holds notes (warnings / errors) thrown by the blueprints during creation */
	notes?: Array<PartNote>
	/** if the part is inserted after another (for adlibbing) */
	dynamicallyInsertedAfterPartId?: PartId
	// afterPart?: PartId // TODO-ASAP combine with dynamicallyInserted (call dynamicallyAfterPart)
	/** if the part was dunamically inserted (adlib) */
	// dynamicallyInserted?: boolean

	/** Human readable unqiue identifier of the part */
	identifier?: string
}
export interface PartTimings extends IBlueprintPartDBTimings {
	/** The playback offset that was set for the last take */
	playOffset: Array<Time>
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
		title: string
		description?: string
		color?: string
	}
	public floated?: boolean
	public gap?: boolean
	// From IBlueprintPartDB:
	public _id: PartId
	public segmentId: SegmentId
	public timings?: PartTimings
	// From DBPart:
	public _rank: number
	public rundownId: RundownId
	public status?: string
	public startedPlayback?: boolean
	public taken?: boolean
	public stoppedPlayback?: boolean
	public duration?: number
	// public previousPartEndState?: PartEndState
	public notes?: Array<PartNote>
	public dynamicallyInsertedAfterPartId?: PartId
	public identifier?: string

	constructor(document: DBPart) {
		for (let [key, value] of Object.entries(document)) {
			this[key] = value
		}
	}
	getRundown() {
		return Rundowns.findOne(this.rundownId)
	}
	getSegment() {
		return Segments.findOne(this.segmentId)
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

	getAdLibPieces(selector?: MongoQuery<AdLibPiece>, options?: FindOptions<AdLibPiece>) {
		selector = selector || {}
		options = options || {}
		return AdLibPieces.find(
			{
				rundownId: this.rundownId,
				partId: this._id,
				...selector,
			},
			{
				...options,
				sort: { _rank: 1, name: 1, ...options?.sort },
			}
		).fetch()
	}
	getAllAdLibPieces() {
		return this.getAdLibPieces()
	}
	getInvalidReasonNotes(): Array<PartNote> {
		return this.invalidReason
			? [
					{
						type: NoteType.ERROR,
						message:
							this.invalidReason.title +
							(this.invalidReason.description ? ': ' + this.invalidReason.description : ''),
						origin: {
							name: this.title,
						},
					},
			  ]
			: []
	}
	getMinimumReactiveNotes(studio: Studio, showStyleBase: ShowStyleBase): Array<PartNote> {
		let notes: Array<PartNote> = []
		notes = notes.concat(this.notes || [])

		const pieces = this.getPieces()
		const partLookup = showStyleBase && normalizeArray(showStyleBase.sourceLayers, '_id')
		for (let i = 0; i < pieces.length; i++) {
			const piece = pieces[i]
			// TODO: check statuses (like media availability) here

			if (partLookup && piece.sourceLayerId && partLookup[piece.sourceLayerId]) {
				const part = partLookup[piece.sourceLayerId]
				const st = checkPieceContentStatus(piece, part, studio ? studio.settings : undefined)
				if (st.status !== RundownAPI.PieceStatusCode.OK && st.status !== RundownAPI.PieceStatusCode.UNKNOWN) {
					notes.push({
						type: getNoteTypeForPieceStatus(st.status) || NoteType.WARNING,
						origin: {
							name: 'Media Check',
							pieceId: piece._id,
						},
						message: st.message || '',
					})
				}
			}
		}
		return notes
	}
	getLastTake() {
		if (!this.timings) return undefined

		if (!this.timings.take || this.timings.take.length === 0) return undefined

		return this.timings.take[this.timings.take.length - 1]
	}
	getLastStartedPlayback() {
		if (!this.timings) return undefined

		if (!this.timings.startedPlayback || this.timings.startedPlayback.length === 0) return undefined

		return this.timings.startedPlayback[this.timings.startedPlayback.length - 1]
	}
	getLastPlayOffset() {
		if (!this.timings) return undefined

		if (!this.timings.playOffset || this.timings.playOffset.length === 0) return undefined

		return this.timings.playOffset[this.timings.playOffset.length - 1]
	}
	isPlayable() {
		return isPartPlayable(this)
	}
}

export function isPartPlayable(part: DBPart) {
	return !part.invalid && !part.floated
}

export const Parts: TransformedCollection<Part, DBPart> = createMongoCollection<Part>('parts', {
	transform: (doc) => applyClassToDocument(Part, doc),
})
registerCollection('Parts', Parts)
Meteor.startup(() => {
	if (Meteor.isServer) {
		Parts._ensureIndex({
			rundownId: 1,
			segmentId: 1,
			_rank: 1,
		})
		Parts._ensureIndex({
			rundownId: 1,
			_rank: 1,
		})
	}
})
