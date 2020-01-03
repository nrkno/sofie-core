import { Meteor } from 'meteor/meteor'
import { Mongo } from 'meteor/mongo'
import { TransformedCollection, MongoSelector, FindOptions } from '../typings/meteor'
import * as _ from 'underscore'
import { Time, applyClassToDocument, registerCollection, normalizeArray, makePromise, waitForPromiseAll, getCurrentTime } from '../lib'
import { RundownHoldState, Rundowns, Rundown } from './Rundowns'
import { Studio, Studios } from './Studios'
import { Segments, Segment } from './Segments'
import { Parts, Part } from './Parts'
import { Pieces, Piece } from './Pieces'
import { TimelinePersistentState } from 'tv-automation-sofie-blueprints-integration'

export interface DBRundownPlaylist {
	_id: string
	externalId: string
	studioId: string
	peripheralDeviceId: string
	name: string
	created: Time
	modified: Time
	expectedStart?: Time
	expectedDuration?: number
	rehearsal?: boolean
	holdState?: RundownHoldState

	active?: boolean
	/** the id of the Live Part - if empty, no part in this rundown is live */
	currentPartId: string | null
	/** the id of the Next Part - if empty, no segment will follow Live Part */
	nextPartId: string | null
	/** The time offset of the next line */
	nextTimeOffset?: number | null
	/** if nextPartId was set manually (ie from a user action) */
	nextPartManual?: boolean
	/** the id of the Previous Part */
	previousPartId: string | null

	/** Actual time of playback starting */
	startedPlayback?: Time
}

export interface RundownPlaylistData {
	rundownPlaylist: RundownPlaylist,
	rundowns: Rundown[],
	rundownsMap: { [key: string]: Rundown },
	segments: Segment[],
	segmentsMap: { [key: string]: Segment},
	parts: Part[],
	partsMap: { [key: string]: Part },
	pieces: Piece[]
}

export class RundownPlaylist implements DBRundownPlaylist {
	public _id: string
	public externalId: string
	public studioId: string
	public peripheralDeviceId: string
	public name: string
	public created: Time
	public modified: Time
	public startedPlayback?: Time
	public expectedStart?: Time
	public expectedDuration?: number
	public rehearsal?: boolean
	public holdState?: RundownHoldState
	public active?: boolean
	public currentPartId: string | null
	public nextPartId: string | null
	public nextTimeOffset?: number | null
	public nextPartManual?: boolean
	public previousPartId: string | null

	public previousPersistentState?: TimelinePersistentState

	constructor (document: DBRundownPlaylist) {
		_.each(_.keys(document), (key) => {
			this[key] = document[key]
		})
	}
	getRundowns (selector?: MongoSelector<DBRundownPlaylist>, options?: FindOptions): Rundown[] {
		return Rundowns.find(
			_.extend({
				playlistId: this._id
			}, selector),
			_.extend({
				sort: {
					_rank: 1,
					_id: 1
				}
			}, options)
		).fetch()
	}
	getRundownIDs (selector?: MongoSelector<DBRundownPlaylist>, options?: FindOptions): string[] {
		return Rundowns.find(
			_.extend({
				playlistId: this._id
			}, selector),
			_.extend({
				sort: {
					_rank: 1
				},
				fields: {
					_rank: 1,
					_id: 1
				}
			}, options)
		).fetch().map(i => i._id)
	}
	getRundownsMap (selector?: MongoSelector<DBRundownPlaylist>, options?: FindOptions): { [key: string]: Rundown } {
		return normalizeArray(this.getRundowns(selector, options), '_id')
	}
	touch () {
		if (!Meteor.isServer) throw new Meteor.Error('The "remove" method is available server-side only (sorry)')
		if (getCurrentTime() - this.modified > 3600 * 1000) {
			const m = getCurrentTime()
			this.modified = m
			RundownPlaylists.update(this._id, { $set: { modified: m } })
		}
	}
	remove () {
		if (!Meteor.isServer) throw new Meteor.Error('The "remove" method is available server-side only (sorry)')
		const allRundowns = Rundowns.find({
			playlistId: this._id
		}).fetch()
		allRundowns.forEach(i => i.remove())
	}
	getStudio (): Studio {
		if (!this.studioId) throw new Meteor.Error(500,'Rundown is not in a studio!')
		let studio = Studios.findOne(this.studioId)
		if (studio) {
			return studio

		} else throw new Meteor.Error(404, 'Studio "' + this.studioId + '" not found!')
	}
	getSegments (selector?: MongoSelector<DBRundownPlaylist>, options?: FindOptions): Segment[] {
		const rundowns = this.getRundowns(undefined, {
			fields: {
				_rank: 1,
				playlistId: 1
			}
		})
		let rundownsMap = normalizeArray(rundowns, '_id')
		const segments = Segments.find(_.extend({
			rundownId: {
				$in: rundowns.map(i => i._id)
			}
		}, selector), _.extend({
			sort: {
				rundownId: 1,
				_rank: 1
			}
		}, options)).fetch().sort((a, b) => {
			if (a.rundownId === b.rundownId) {
				return a._rank - b._rank
			} else {
				const rdA = rundownsMap[a.rundownId]
				const rdB = rundownsMap[b.rundownId]
				return rdA._rank - rdB._rank
			}
		})
		return segments
	}
	getParts (selector?: MongoSelector<DBRundownPlaylist>, options?: FindOptions): Part[] {
		const rundowns = this.getRundowns(undefined, {
			fields: {
				_id: 1,
				_rank: 1,
				name: 1
			}
		})
		let rundownsMap = normalizeArray(rundowns, '_id')
		const parts = Parts.find(_.extend({
			rundownId: {
				$in: rundowns.map(i => i._id)
			}
		}, selector), {
			sort: {
				rundownId: 1,
				_rank: 1
			}
		}).fetch().sort((a, b) => {
			if (a.rundownId === b.rundownId) {
				return a._rank - b._rank
			} else {
				const rdA = rundownsMap[a.rundownId]
				const rdB = rundownsMap[b.rundownId]
				return rdA._rank - rdB._rank
			}
		})
		return parts
	}
	fetchAllData (): RundownPlaylistData {
		// Do fetches in parallell:
		const rundowns = Rundowns.find({ playlistId: this._id }, {
			sort: {
				_rank: 1
			}
		}).fetch()
		const rundownIds = rundowns.map(i => i._id)
		let ps: [
			Promise<{ segments: Segment[], segmentsMap: any }>,
			// Promise<{ parts: Part[], partsMap: any }>,
			Promise<Piece[]>,
			Promise<{ rundowns: Rundown[], rundownsMap: any }>
		] = [
			makePromise(() => {
				let segments = Segments.find({ rundownId: { $in: rundownIds } }).fetch()
				let segmentsMap = normalizeArray(segments, '_id')
				return { segments, segmentsMap }
			}),
			// makePromise(() => {
			// 	let parts = _.map(Parts.find({ rundownId: { $in: rundownIds } }).fetch(), (part) => {
			// 		// Override member function to use cached data instead:
			// 		part.getAllPieces = () => {
			// 			return _.map(_.filter(pieces, (piece) => {
			// 				return (
			// 					piece.partId === part._id
			// 				)
			// 			}), (part) => {
			// 				return _.clone(part)
			// 			})
			// 		}
			// 		part.getRundown = () => {
			// 			return rundowns[part.rundownId]
			// 		}
			// 		return part

			// 	})
			// 	let partsMap = normalizeArray(parts, '_id')
			// 	return { parts, partsMap }
			// }),
			makePromise(() => {
				return Pieces.find({ rundownId: { $in: rundownIds } }).fetch()
			}),
			makePromise(() => {
				return { rundowns, rundownsMap: normalizeArray(rundowns, '_id') }
			})
		]
		const r = waitForPromiseAll(ps as any) as any[]
		const segments: Segment[] = r[0].segments
		const segmentsMap: { [key: string]: Segment } = r[0].segmentsMap
		// let partsMap: { [key: string]: Part } = r[1].partsMap
		// let parts: Part[] = r[1].parts
		const pieces: Piece[] = r[1]
		const rundownsMap: { [key: string]: Rundown } = r[2].rundownsMap

		const parts = Parts.find({
			rundownId: {
				$in: rundowns.map(i => i._id)
			}
		}, {
			sort: {
				rundownId: 1,
				_rank: 1
			}
		}).fetch().sort((a, b) => {
			if (a.rundownId === b.rundownId) {
				return a._rank - b._rank
			} else {
				const rdA = rundownsMap[a.rundownId]
				const rdB = rundownsMap[b.rundownId]
				return rdA._rank - rdB._rank
			}
		})
		const partsMap = normalizeArray(parts, '_id')

		return {
			rundownPlaylist: this,
			rundowns,
			rundownsMap,
			segments,
			segmentsMap,
			parts,
			partsMap,
			pieces
		}
	}
}

export const RundownPlaylists: TransformedCollection<RundownPlaylist, DBRundownPlaylist>
	= new Mongo.Collection<RundownPlaylist>('rundownPlaylists', { transform: (doc) => applyClassToDocument(RundownPlaylist, doc) })
registerCollection('RundownPlaylists', RundownPlaylists)
Meteor.startup(() => {
	if (Meteor.isServer) {
		RundownPlaylists._ensureIndex({
			studioId: 1,
			active: 1
		})
	}
})
