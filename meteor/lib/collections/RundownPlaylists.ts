import { Meteor } from 'meteor/meteor'
import { Mongo } from 'meteor/mongo'
import { TransformedCollection, MongoSelector, FindOptions } from '../typings/meteor'
import * as _ from 'underscore'
import { Time, applyClassToDocument, registerCollection, normalizeArray, makePromise, waitForPromiseAll, getCurrentTime, asyncCollectionFindFetch, waitForPromise } from '../lib'
import { RundownHoldState, Rundowns, Rundown, DBRundown } from './Rundowns'
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
		const segments = Segments.find(_.extend({
			rundownId: {
				$in: rundowns.map(i => i._id)
			}
		}, selector), _.extend({
			sort: {
				rundownId: 1,
				_rank: 1
			}
		}, options)).fetch()
		return RundownPlaylist._sortSegments(segments, rundowns)
	}
	getParts (selector?: MongoSelector<DBRundownPlaylist>, options?: FindOptions): Part[] { // TODO - remove ordering, and rename to getUnorderedParts?
		// const rundowns = this.getRundowns(undefined, {
		// 	fields: {
		// 		_id: 1,
		// 		_rank: 1,
		// 		name: 1
		// 	}
		// })
		// const parts = Parts.find(_.extend({
		// 	rundownId: {
		// 		$in: rundowns.map(i => i._id)
		// 	}
		// }, selector), {
		// 	sort: {
		// 		rundownId: 1,
		// 		_rank: 1
		// 	}
		// }).fetch()
		// return RundownPlaylist._sortParts(parts, rundowns)
		const { parts } = this.getSegmentsAndPartsSync()
		return parts
	}
	/**
	 * Return ordered lists of all Segments and Parts in the rundown
	 */
	async getSegmentsAndParts (rundowns0?: DBRundown[]): Promise<{ segments: Segment[], parts: Part[] }> {
		let rundowns = rundowns0
		if (!rundowns) {
			rundowns = this.getRundowns(undefined, {
				fields: {
					_id: 1,
					_rank: 1,
					name: 1
				}
			})
		}
		const rundownIds = rundowns.map(i => i._id)

		const pSegments = asyncCollectionFindFetch(Segments, {
			$in: rundownIds
		}, {
			sort: {
				rundownId: 1,
				_rank: 1
			}
		})

		const pParts = asyncCollectionFindFetch(Parts, {
			$in: rundownIds
		}, {
			sort: {
				rundownId: 1,
				_rank: 1
			}
		})

		const segments = RundownPlaylist._sortSegments(await pSegments, rundowns)
		return {
			segments: segments,
			parts: RundownPlaylist._sortPartsInner(await pParts, segments)
		}
	}
	/** Synchronous version of getSegmentsAndParts, to be used client-side */
	getSegmentsAndPartsSync (): { segments: Segment[], parts: Part[] } {

		const rundowns = this.getRundowns(undefined, {
			fields: {
				_rank: 1,
				playlistId: 1
			}
		})
		const segments = Segments.find({
			rundownId: {
				$in: rundowns.map(i => i._id)
			}
		}, {
			sort: {
				rundownId: 1,
				_rank: 1
			}
		}).fetch()

		const parts = Parts.find({
			rundownId: {
				$in: rundowns.map(i => i._id)
			}
		}, {
			sort: {
				rundownId: 1,
				_rank: 1
			}
		}).fetch()

		const sortedSegments = RundownPlaylist._sortSegments(segments, rundowns)
		return {
			segments: sortedSegments,
			parts: RundownPlaylist._sortPartsInner(parts, segments)
		}
	}
	fetchAllData (): RundownPlaylistData {
		const rundowns = Rundowns.find({ playlistId: this._id }, {
			sort: {
				_rank: 1
			}
		}).fetch()
		const rundownIds = rundowns.map(i => i._id)

		const pSegmentsAndParts = this.getSegmentsAndParts(rundowns)
		const pPieces = asyncCollectionFindFetch(Pieces, { rundownId: { $in: rundownIds } })

		// Do fetches in parallell:
		const segmentsAndParts = waitForPromise(pSegmentsAndParts)
		const pieces = waitForPromise(pPieces)

		// Force parts to use preloaded pieces when possible
		_.each(segmentsAndParts.parts, part => {
			part.getAllPieces = () => {
				return _.map(_.filter(pieces, (piece) => {
					return (
						piece.partId === part._id
					)
				}), (part) => {
					return _.clone(part)
				})
			}
		})

		return {
			rundownPlaylist: this,
			rundowns,
			rundownsMap: normalizeArray(rundowns, '_id'),
			segments: segmentsAndParts.segments,
			segmentsMap: normalizeArray(segmentsAndParts.segments, '_id'),
			parts: segmentsAndParts.parts,
			partsMap: normalizeArray(segmentsAndParts.parts, '_id'),
			pieces
		}
	}

	static _sortSegments (segments: Segment[], rundowns: Rundown[]) {
		const rundownsMap = normalizeArray(rundowns, '_id')
		return segments.sort((a, b) => {
			if (a.rundownId === b.rundownId) {
				return a._rank - b._rank
			} else {
				const rdA = rundownsMap[a.rundownId]
				const rdB = rundownsMap[b.rundownId]
				return rdA._rank - rdB._rank
			}
		})
	}
	static _sortParts (parts: Part[], rundowns: Rundown[], segments: Segment[]) {
		return RundownPlaylist._sortPartsInner(parts, RundownPlaylist._sortSegments(segments, rundowns))
	}
	static _sortPartsInner (parts: Part[], sortedSegments: Segment[]) {
		const segmentRanks: {[segmentId: string]: number} = {}
		_.each(sortedSegments, (segment, i) => segmentRanks[segment._id] = i)

		return parts.sort((a, b) => {
			if (a.segmentId === b.segmentId) {
				return a._rank - b._rank
			} else {
				const segA = segmentRanks[a.segmentId]
				const segB = segmentRanks[b.segmentId]
				return segA - segB
			}
		})
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
