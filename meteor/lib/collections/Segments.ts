import * as _ from 'underscore'
import { applyClassToDocument, registerCollection } from '../lib'
import { Parts } from './Parts'
import { Rundowns, Rundown } from './Rundowns'
import { FindOptions, MongoSelector, TransformedCollection } from '../typings/meteor'
import { Meteor } from 'meteor/meteor'
import { IBlueprintSegmentDB } from 'tv-automation-sofie-blueprints-integration'
import { PartNote } from '../api/notes'
import { createMongoCollection } from './lib'
import { ShowStyleBase } from './ShowStyleBases'
import { Studio } from './Studios'

/** A "Title" in NRK Lingo / "Stories" in ENPS Lingo. */
export interface DBSegment extends IBlueprintSegmentDB {
	/** Position inside rundown */
	_rank: number
	/** ID of the source object in the gateway */
	externalId: string
	/** The rundown this segment belongs to */
	rundownId: string

	status?: string
	expanded?: boolean

	/** Holds notes (warnings / errors) thrown by the blueprints during creation */
	notes?: Array<PartNote>
}
export class Segment implements DBSegment {
	public _id: string
	public _rank: number
	public externalId: string
	public rundownId: string
	public name: string
	public metaData?: { [key: string]: any }
	public status?: string
	public expanded?: boolean
	public notes?: Array<PartNote>

	constructor (document: DBSegment) {
		_.each(_.keys(document), (key) => {
			this[key] = document[key]
		})
	}
	getRundown () {
		return Rundowns.findOne(this.rundownId)
	}
	getParts (selector?: MongoSelector<DBSegment>, options?: FindOptions) {
		selector = selector || {}
		options = options || {}
		return Parts.find(
			_.extend({
				rundownId: this.rundownId,
				segmentId: this._id
			}, selector),
			_.extend({
				sort: { _rank: 1 }
			}, options)
		).fetch()
	}
	getNotes (includeParts?: boolean, runtimeNotes?: boolean, context?: {rundown?: Rundown, studio?: Studio, showStyleBase?: ShowStyleBase }) {
		let notes: Array<PartNote> = []

		if (includeParts) {
			const parts = this.getParts()

			if (runtimeNotes && !context) { // Note: This is an optimization for part.getNotes()
				const rundown = this.getRundown()
				context = {
					rundown: rundown,
					studio: rundown && rundown.getStudio(),
					showStyleBase: rundown && rundown.getShowStyleBase()
				}
			}
			_.each(parts, part => {
				notes = notes.concat(part.getNotes(runtimeNotes, context)).concat(part.getInvalidReasonNotes())
			})
		}

		notes = notes.concat(this.notes || [])
		return notes
	}
}

// export const Segments = createMongoCollection<Segment>('segments', {transform: (doc) => applyClassToDocument(Segment, doc) })
export const Segments: TransformedCollection<Segment, DBSegment>
	= createMongoCollection<Segment>('segments', { transform: (doc) => applyClassToDocument(Segment, doc) })
registerCollection('Segments', Segments)
Meteor.startup(() => {
	if (Meteor.isServer) {
		Segments._ensureIndex({
			rundownId: 1,
			_rank: 1
		})
	}
})
