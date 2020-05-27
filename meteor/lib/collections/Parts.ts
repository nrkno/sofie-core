import * as _ from 'underscore'
import { TransformedCollection, FindOptions, MongoSelector } from '../typings/meteor'
import { Rundowns, Rundown, RundownId } from './Rundowns'
import { Piece, Pieces } from './Pieces'
import { AdLibPieces } from './AdLibPieces'
import { Segments, SegmentId } from './Segments'
import { applyClassToDocument, Time, registerCollection, normalizeArray, ProtectedString, ProtectedStringProperties } from '../lib'
import { RundownAPI } from '../api/rundown'
import { checkPieceContentStatus } from '../mediaObjects'
import { Meteor } from 'meteor/meteor'
import {
	IBlueprintPartDB,
	PartHoldMode,
	BlueprintRuntimeArguments,
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
export interface DBPart extends ProtectedStringProperties<IBlueprintPartDB, '_id' | 'segmentId'> {
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
	/** The end state of the previous part, to allow for bits of this to part to be based on what the previous did/was */
	previousPartEndState?: PartEndState

	/** Holds notes (warnings / errors) thrown by the blueprints during creation */
	notes?: Array<PartNote>
	/** if the part is inserted after another (for adlibbing) */
	afterPart?: PartId
	/** if the part was dunamically inserted (adlib) */
	dynamicallyInserted?: boolean

	/** Runtime blueprint arguments allows Sofie-side data to be injected into the blueprint for an part */
	runtimeArguments?: BlueprintRuntimeArguments
	/** An part should be marked as `dirty` if the part blueprint has been injected with runtimeArguments */
	dirty?: boolean
	canCombineQueue?: boolean
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
	public typeVariant: string
	public subTypeVariant?: string
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
	public canCombineQueue?: boolean
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
	public previousPartEndState?: PartEndState
	public notes?: Array<PartNote>
	public afterPart?: PartId
	public dynamicallyInserted?: boolean
	public runtimeArguments?: BlueprintRuntimeArguments
	public dirty?: boolean

	constructor (document: DBPart) {
		_.each(_.keys(document), (key) => {
			this[key] = document[key]
		})
	}
	getRundown () {
		return Rundowns.findOne(this.rundownId)
	}
	getSegment () {
		return Segments.findOne(this.segmentId)
	}
	getPieces (selector?: MongoSelector<Piece>, options?: FindOptions) {
		selector = selector || {}
		options = options || {}
		return Pieces.find(
			_.extend({
				rundownId: this.rundownId,
				partId: this._id
			}, selector),
			_.extend({
				sort: { _rank: 1 }
			}, options)
		).fetch()
	}
	getAllPieces () {
		return this.getPieces()
	}

	getAdLibPieces (selector?: MongoSelector<Piece>, options?: FindOptions) {
		selector = selector || {}
		options = options || {}
		return AdLibPieces.find(
			_.extend({
				rundownId: this.rundownId,
				partId: this._id
			}, selector),
			_.extend({
				sort: { _rank: 1, name: 1 }
			}, options)
		).fetch()
	}
	getAllAdLibPieces () {
		return this.getAdLibPieces()
	}
	getInvalidReasonNotes (): Array<PartNote> {
		return this.invalidReason ? [
			{
				type: NoteType.WARNING,
				message: this.invalidReason.title + (this.invalidReason.description ? ': ' + this.invalidReason.description : ''),
				origin: {
					name: this.title,
				}
			}
		] : []
	}
	getMinimumReactiveNotes (studio: Studio, showStyleBase: ShowStyleBase): Array<PartNote> {
		let notes: Array<PartNote> = []
		notes = notes.concat(this.notes || [])

		const pieces = this.getPieces()
		const partLookup = showStyleBase && normalizeArray(showStyleBase.sourceLayers, '_id')
		_.each(pieces, (piece) => {
			// TODO: check statuses (like media availability) here

			if (partLookup && piece.sourceLayerId && partLookup[piece.sourceLayerId]) {
				const part = partLookup[piece.sourceLayerId]
				const st = checkPieceContentStatus(piece, part, studio ? studio.settings : undefined)
				if (st.status === RundownAPI.PieceStatusCode.SOURCE_MISSING || st.status === RundownAPI.PieceStatusCode.SOURCE_BROKEN) {
					notes.push({
						type: NoteType.WARNING,
						origin: {
							name: 'Media Check',
							pieceId: piece._id
						},
						message: st.message || ''
					})
				}
			}
		})
		return notes
	}
	getLastTake () {
		if (!this.timings) return undefined

		if (!this.timings.take || this.timings.take.length === 0) return undefined

		return this.timings.take[this.timings.take.length - 1]
	}
	getLastStartedPlayback () {
		if (!this.timings) return undefined

		if (!this.timings.startedPlayback || this.timings.startedPlayback.length === 0) return undefined

		return this.timings.startedPlayback[this.timings.startedPlayback.length - 1]
	}
	getLastPlayOffset () {
		if (!this.timings) return undefined

		if (!this.timings.playOffset || this.timings.playOffset.length === 0) return undefined

		return this.timings.playOffset[this.timings.playOffset.length - 1]
	}
	isPlayable () {
		return isPartPlayable(this)
	}
}

export function isPartPlayable (part: DBPart) {
	return !part.invalid && !part.floated
}

export const Parts: TransformedCollection<Part, DBPart>
	= createMongoCollection<Part>('parts', { transform: (doc) => applyClassToDocument(Part, doc) })
registerCollection('Parts', Parts)
Meteor.startup(() => {
	if (Meteor.isServer) {
		Parts._ensureIndex({
			rundownId: 1,
			segmentId: 1,
			_rank: 1
		})
		Parts._ensureIndex({
			rundownId: 1,
			_rank: 1
		})
	}
})
