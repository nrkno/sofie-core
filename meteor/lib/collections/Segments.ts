import * as _ from 'underscore'
import { applyClassToDocument, registerCollection, ProtectedString, ProtectedStringProperties } from '../lib'
import { Parts } from './Parts'
import { Rundowns, RundownId } from './Rundowns'
import { FindOptions, MongoSelector, TransformedCollection } from '../typings/meteor'
import { Meteor } from 'meteor/meteor'
import { IBlueprintSegmentDB } from 'tv-automation-sofie-blueprints-integration'
import { PartNote, SegmentNote } from '../api/notes'
import { createMongoCollection } from './lib'

/** A string, identifying a Segment */
export type SegmentId = ProtectedString<'SegmentId'>
/** A "Title" in NRK Lingo / "Stories" in ENPS Lingo. */
export interface DBSegment extends ProtectedStringProperties<IBlueprintSegmentDB, '_id'> {
	_id: SegmentId
	/** Position inside rundown */
	_rank: number
	/** ID of the source object in the gateway */
	externalId: string
	/** The rundown this segment belongs to */
	rundownId: RundownId

	status?: string
	expanded?: boolean

	/** Holds notes (warnings / errors) thrown by the blueprints during creation */
	notes?: Array<SegmentNote>
}
export class Segment implements DBSegment {
	public _id: SegmentId
	public _rank: number
	public externalId: string
	public rundownId: RundownId
	public name: string
	public metaData?: { [key: string]: any }
	public status?: string
	public expanded?: boolean
	public notes?: Array<SegmentNote>
	public isHidden?: boolean

	constructor (document: DBSegment) {
		_.each(_.keys(document), (key) => {
			this[key] = document[key]
		})
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
