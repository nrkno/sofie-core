import * as _ from 'underscore'
import { Rundown, Rundowns, DBRundown, RundownId } from '../lib/collections/Rundowns'
import { RundownPlaylist, RundownPlaylists, DBRundownPlaylist, RundownPlaylistId } from '../lib/collections/RundownPlaylists'
import { Meteor } from 'meteor/meteor'
import { DbCacheCollection, isDbCacheCollection } from './DatabaseCache'
import { Segment, Segments, DBSegment } from '../lib/collections/Segments'
import { Parts, DBPart, Part } from '../lib/collections/Parts'
import { Piece, Pieces } from '../lib/collections/Pieces'
import { PartInstances, DBPartInstance, PartInstance } from '../lib/collections/PartInstances'
import { PieceInstance, PieceInstances } from '../lib/collections/PieceInstances'
import { Studio, Studios, StudioId } from '../lib/collections/Studios'
import { Timeline, TimelineObjGeneric } from '../lib/collections/Timeline'
import { RundownBaselineObj, RundownBaselineObjs } from '../lib/collections/RundownBaselineObjs'
import { RecordedFile, RecordedFiles } from '../lib/collections/RecordedFiles'
import { PeripheralDevice, PeripheralDevices } from '../lib/collections/PeripheralDevices'
import { protectString, waitForPromiseAll, waitForPromise, makePromise } from '../lib/lib'
import { logger } from './logging'
import { AdLibPiece, AdLibPieces } from '../lib/collections/AdLibPieces'
import { MongoSelector } from '../lib/typings/meteor'
import { RundownBaselineAdLibItem, RundownBaselineAdLibPieces } from '../lib/collections/RundownBaselineAdLibPieces'
import { AdLibAction, AdLibActions } from '../lib/collections/AdLibActions'
import { RundownBaselineAdLibAction, RundownBaselineAdLibActions } from '../lib/collections/RundownBaselineAdLibActions'

type DeferredFunction<Cache> = (cache: Cache) => void

/** This cache contains data relevant in a studio */
export class Cache {
	private _deferredFunctions: (DeferredFunction<Cache>)[] = []
	private _activeTimeout: number | null = null

	constructor () {
		if (!Meteor.isProduction) {
			// When this is set up, we expect saveAllToDatabase() to have been called at the end, otherwise something is wrong
			const futureError = new Meteor.Error(500, `saveAllToDatabase never called`)
			this._activeTimeout = Meteor.setTimeout(() => {
				logger.error(futureError)
			}, 2000)
		}
	}

	_abortActiveTimeout () {
		if (this._activeTimeout) {
			Meteor.clearTimeout(this._activeTimeout)
		}
	}
	_extendWithData (extendFromCache: Cache) {
		extendFromCache._abortActiveTimeout()

		_.each(extendFromCache as any, (their, key) => {
			const our = this[key]
			if (
				isDbCacheCollection(their)
			) {
				if (isDbCacheCollection(our)) {
					our.extendWithData(their)
				} else {
					throw new Meteor.Error(500, `Unable to extendWithData "${key}"`)
				}
			}
		})
	}
	async saveAllToDatabase () {
		this._abortActiveTimeout()

		// shouldn't the deferred functions be executed after updating the db?
		_.each(this._deferredFunctions, (fcn) => {
			fcn(this)
		})
		await Promise.all(
			_.map(_.values(this), async (db) => {
				if (isDbCacheCollection(db)) {
					await db.updateDatabaseWithData()
				}
			})
		)
	}
	/** Defer provided function (it will be run just before cache.saveAllToDatabase() ) */
	defer (fcn: DeferredFunction<Cache>): void {
		this._deferredFunctions.push(fcn)
	}
}
export class CacheForStudio extends Cache {
	containsDataFromStudio: StudioId // Just to get the typings to alert on different cache types

	/** Contains all playlists in the Studio */
	RundownPlaylists: DbCacheCollection<RundownPlaylist, DBRundownPlaylist>
	Studios: DbCacheCollection<Studio, Studio>
	Timeline: DbCacheCollection<TimelineObjGeneric, TimelineObjGeneric>
	RecordedFiles: DbCacheCollection<RecordedFile, RecordedFile>
	PeripheralDevices: DbCacheCollection<PeripheralDevice, PeripheralDevice>

	constructor (studioId: StudioId) {
		super()
		this.containsDataFromStudio = studioId

		this.RundownPlaylists = new DbCacheCollection<RundownPlaylist, DBRundownPlaylist>(RundownPlaylists)
		this.Studios = new DbCacheCollection<Studio, Studio>(Studios)
		this.Timeline = new DbCacheCollection<TimelineObjGeneric, TimelineObjGeneric>(Timeline)
		this.RecordedFiles = new DbCacheCollection<RecordedFile, RecordedFile>(RecordedFiles)
		this.PeripheralDevices = new DbCacheCollection<PeripheralDevice, PeripheralDevice>(PeripheralDevices)
	}
	defer (fcn: DeferredFunction<CacheForStudio>) {
		return super.defer(fcn)
	}
}
function emptyCacheForStudio (studioId: StudioId): CacheForStudio {
	return new CacheForStudio(studioId)
}
async function fillCacheForStudioWithData (cache: CacheForStudio, studioId: StudioId, initializeImmediately: boolean) {
	await Promise.all([
		makePromise(() => cache.RundownPlaylists.prepareInit({ studioId: studioId }, initializeImmediately)),
		makePromise(() => cache.Studios.prepareInit({ _id: studioId }, initializeImmediately)),
		makePromise(() => cache.Timeline.prepareInit({ studioId: studioId }, initializeImmediately)),
		makePromise(() => cache.RecordedFiles.prepareInit({ studioId: studioId }, initializeImmediately)),
		makePromise(() => cache.PeripheralDevices.prepareInit({ studioId: studioId }, initializeImmediately)),
	])

	return cache
}
export async function initCacheForStudio (studioId: StudioId, initializeImmediately: boolean = true) {
	const cache: CacheForStudio = emptyCacheForStudio(studioId)
	await fillCacheForStudioWithData(cache, studioId, initializeImmediately)

	return cache
}

/** This Cache contains data for a playlist */
export class CacheForRundownPlaylist extends CacheForStudio {
	containsDataFromPlaylist: RundownPlaylistId // Just to get the typings to alert on different cache types

	Rundowns: DbCacheCollection<Rundown, DBRundown>
	Segments: DbCacheCollection<Segment, DBSegment>
	Parts: DbCacheCollection<Part, DBPart>
	Pieces: DbCacheCollection<Piece, Piece>
	PartInstances: DbCacheCollection<PartInstance, DBPartInstance>
	PieceInstances: DbCacheCollection<PieceInstance, PieceInstance>
	RundownBaselineObjs: DbCacheCollection<RundownBaselineObj, RundownBaselineObj>

	// Note: These are not present in the cache because they do not directly affect output:
	// IngestDataCache
	// ExpectedMediaItems
	// ExpectedPlayoutItems

	// These are optional and will be initialized when needed:
	AdLibPieces: DbCacheCollection<AdLibPiece, AdLibPiece>
	AdLibActions: DbCacheCollection<AdLibAction, AdLibAction>
	RundownBaselineAdLibPieces: DbCacheCollection<RundownBaselineAdLibItem, RundownBaselineAdLibItem>
	RundownBaselineAdLibActions: DbCacheCollection<RundownBaselineAdLibAction, RundownBaselineAdLibAction>

	constructor (studioId: StudioId, playlistId: RundownPlaylistId) {
		super(studioId)
		this.containsDataFromPlaylist = playlistId

		this.Rundowns = new DbCacheCollection<Rundown, DBRundown>(Rundowns)
		this.Segments = new DbCacheCollection<Segment, DBSegment>(Segments)
		this.Parts = new DbCacheCollection<Part, DBPart>(Parts)
		this.Pieces = new DbCacheCollection<Piece, Piece>(Pieces)

		this.PartInstances = new DbCacheCollection<PartInstance, DBPartInstance>(PartInstances)
		this.PieceInstances = new DbCacheCollection<PieceInstance, PieceInstance>(PieceInstances)

		this.RundownBaselineObjs = new DbCacheCollection<RundownBaselineObj, RundownBaselineObj>(RundownBaselineObjs)

		this.AdLibPieces = new DbCacheCollection<AdLibPiece, AdLibPiece>(AdLibPieces)
		this.AdLibActions = new DbCacheCollection<AdLibAction, AdLibAction>(AdLibActions)
		this.RundownBaselineAdLibPieces = new DbCacheCollection<RundownBaselineAdLibItem, RundownBaselineAdLibItem>(RundownBaselineAdLibPieces)
		this.RundownBaselineAdLibActions = new DbCacheCollection<RundownBaselineAdLibAction, RundownBaselineAdLibAction>(RundownBaselineAdLibActions)
	}
	defer (fcn: DeferredFunction<CacheForRundownPlaylist>) {
		return super.defer(fcn)
	}
}
function emptyCacheForRundownPlaylist (studioId: StudioId, playlistId: RundownPlaylistId): CacheForRundownPlaylist {
	return new CacheForRundownPlaylist(studioId, playlistId)
}
async function fillCacheForRundownPlaylistWithData (cache: CacheForRundownPlaylist, playlist: RundownPlaylist, initializeImmediately: boolean) {
	const ps: Promise<any>[] = []
	cache.Rundowns.prepareInit({ playlistId: playlist._id }, true)

	const rundownsInPlaylist = cache.Rundowns.findFetch()
	const rundownIds = rundownsInPlaylist.map(r => r._id)

	ps.push(makePromise(() => cache.Segments.prepareInit({ rundownId: { $in: rundownIds } }, initializeImmediately)))
	ps.push(makePromise(() => cache.Parts.prepareInit({ rundownId: { $in: rundownIds } }, initializeImmediately)))
	ps.push(makePromise(() => cache.Pieces.prepareInit({ rundownId: { $in: rundownIds } }, initializeImmediately)))

	ps.push(makePromise(() => cache.PartInstances.prepareInit({ rundownId: { $in: rundownIds } }, initializeImmediately)))

	ps.push(makePromise(() => cache.PieceInstances.prepareInit(async () => {

		const selectedPartInstanceIds = _.compact([
			playlist.currentPartInstanceId,
			playlist.nextPartInstanceId,
			playlist.previousPartInstanceId
		])

		await cache.PieceInstances.fillWithDataFromDatabase({
			rundownId: { $in: rundownIds },
			partInstanceId: { $in: selectedPartInstanceIds }
		})
	}, initializeImmediately)))

	ps.push(makePromise(() => cache.RundownBaselineObjs.prepareInit({
		rundownId: { $in: rundownIds },
	}, initializeImmediately)))

	ps.push(makePromise(() => cache.AdLibPieces.prepareInit({
		rundownId: { $in: rundownIds },
	}, false)))
	ps.push(makePromise(() => cache.AdLibActions.prepareInit({
		rundownId: { $in: rundownIds },
	}, false)))

	ps.push(makePromise(() => cache.RundownBaselineAdLibPieces.prepareInit({
		rundownId: { $in: rundownIds },
	}, false)))
	ps.push(makePromise(() => cache.RundownBaselineAdLibActions.prepareInit({
		rundownId: { $in: rundownIds },
	}, false)))

	await Promise.all(ps)
}
export async function initCacheForRundownPlaylist (playlist: RundownPlaylist, extendFromCache?: CacheForStudio, initializeImmediately: boolean = true) {
	if (!extendFromCache) extendFromCache = await initCacheForStudio(playlist.studioId, initializeImmediately)
	let cache: CacheForRundownPlaylist = emptyCacheForRundownPlaylist(playlist.studioId, playlist._id)
	if (extendFromCache) {
		cache._extendWithData(extendFromCache)
	}
	await fillCacheForRundownPlaylistWithData(cache, playlist, initializeImmediately)
	return cache
}
/** Cache for playout, but there is no playlist playing */
export async function initCacheForNoRundownPlaylist (studioId: StudioId, extendFromCache?: CacheForStudio, initializeImmediately: boolean = true) {
	if (!extendFromCache) extendFromCache = await initCacheForStudio(studioId, initializeImmediately)
	let cache: CacheForRundownPlaylist = emptyCacheForRundownPlaylist(studioId, protectString(''))
	if (extendFromCache) {
		cache._extendWithData(extendFromCache)
	}
	return cache
}
export async function initCacheForRundownPlaylistFromRundown (rundownId: RundownId) {
	const rundown = Rundowns.findOne(rundownId)
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
	const playlist = RundownPlaylists.findOne(rundown.playlistId)
	if (!playlist) throw new Meteor.Error(404, `RundownPlaylist "${rundown.playlistId}" not found!`)
	return initCacheForRundownPlaylist(playlist)
}
export async function initCacheForRundownPlaylistFromStudio (studioId: StudioId) {
	const playlist = RundownPlaylists.findOne({
		studioId: studioId,
		active: true
	})
	if (!playlist) {
		return initCacheForNoRundownPlaylist(studioId)
	} else {
		return initCacheForRundownPlaylist(playlist)
	}
}

/** Initialize a cache, run the function, then store the cache */
export function wrapWithCacheForRundownPlaylist<T> (playlist: RundownPlaylist, fcn: (cache: CacheForRundownPlaylist) => T): T {
	const cache = waitForPromise(initCacheForRundownPlaylist(playlist))
	const r = fcn(cache)
	waitForPromise(cache.saveAllToDatabase())
	return r
}
export function wrapWithCacheForRundownPlaylistFromRundown<T> (rundownId: RundownId, fcn: (cache: CacheForRundownPlaylist) => T): T {
	const cache = waitForPromise(initCacheForRundownPlaylistFromRundown(rundownId))
	const r = fcn(cache)
	waitForPromise(cache.saveAllToDatabase())
	return r
}
export function wrapWithCacheForRundownPlaylistFromStudio<T> (studioId: StudioId, fcn: (cache: CacheForRundownPlaylist) => T): T {
	const cache = waitForPromise(initCacheForRundownPlaylistFromStudio(studioId))
	const r = fcn(cache)
	waitForPromise(cache.saveAllToDatabase())
	return r
}
