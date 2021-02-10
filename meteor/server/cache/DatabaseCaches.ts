import * as _ from 'underscore'
import { Rundown, Rundowns, DBRundown, RundownId } from '../../lib/collections/Rundowns'
import {
	RundownPlaylist,
	RundownPlaylists,
	DBRundownPlaylist,
	RundownPlaylistId,
} from '../../lib/collections/RundownPlaylists'
import { Meteor } from 'meteor/meteor'
import { isDbCacheReadCollection, isDbCacheWritable } from './lib'
import { Segment, Segments, DBSegment } from '../../lib/collections/Segments'
import { Parts, DBPart, Part } from '../../lib/collections/Parts'
import { Piece, Pieces } from '../../lib/collections/Pieces'
import { PartInstances, DBPartInstance, PartInstance } from '../../lib/collections/PartInstances'
import { PieceInstance, PieceInstances } from '../../lib/collections/PieceInstances'
import { Studio, Studios, StudioId } from '../../lib/collections/Studios'
import { Timeline, TimelineComplete } from '../../lib/collections/Timeline'
import { RundownBaselineObj, RundownBaselineObjs } from '../../lib/collections/RundownBaselineObjs'
import { PeripheralDevice, PeripheralDevices } from '../../lib/collections/PeripheralDevices'
import { waitForPromise, makePromise, waitTime, sumChanges, anythingChanged, ProtectedString } from '../../lib/lib'
import { logger } from '../logging'
import { AdLibPiece, AdLibPieces } from '../../lib/collections/AdLibPieces'
import { AdLibAction, AdLibActions } from '../../lib/collections/AdLibActions'
import { isInTestWrite } from '../security/lib/securityVerify'
import { ActivationCache, getActivationCache } from './ActivationCache'
import { profiler } from '../api/profiler'
import { DbCacheReadCollection, DbCacheWriteCollection } from './CacheCollection'
import { DbCacheReadObject, DbCacheWriteObject, DbCacheWriteOptionalObject } from './CacheObject'

type DeferredFunction<Cache> = (cache: Cache) => void

type DbCacheWritable<T1 extends T2, T2 extends { _id: ProtectedString<any> }> =
	| DbCacheWriteCollection<T1, T2>
	| DbCacheWriteObject<T1, T2>
	| DbCacheWriteOptionalObject<T1, T2>

export type ReadOnlyCacheInner<T> = T extends DbCacheWriteCollection<infer A, infer B>
	? DbCacheReadCollection<A, B>
	: T extends DbCacheWriteObject<infer A, infer B>
	? DbCacheReadObject<A, B>
	: T extends DbCacheWriteOptionalObject<infer A, infer B>
	? DbCacheReadObject<A, B, true>
	: T
export type ReadOnlyCache<T extends CacheBase<any>> = Omit<
	{ [K in keyof T]: ReadOnlyCacheInner<T[K]> },
	'defer' | 'deferAfterSave' | 'saveAllToDatabase'
>

/** This cache contains data relevant in a studio */
export abstract class ReadOnlyCacheBase {
	protected _deferredFunctions: DeferredFunction<ReadOnlyCacheBase>[] = []
	protected _deferredAfterSaveFunctions: (() => void)[] = []
	private _activeTimeout: number | null = null

	constructor() {
		if (!Meteor.isProduction) {
			// When this is set up, we expect saveAllToDatabase() to have been called at the end, otherwise something is wrong
			if (!isInTestWrite()) {
				const futureError = new Meteor.Error(500, `saveAllToDatabase never called`)
				this._activeTimeout = Meteor.setTimeout(() => {
					logger.error(futureError)
					logger.error(futureError.stack)
				}, 2000)
			}
		}
	}

	_abortActiveTimeout() {
		if (this._activeTimeout) {
			Meteor.clearTimeout(this._activeTimeout)
		}
	}
	_extendWithData(extendFromCache: CacheBase<any>) {
		extendFromCache._abortActiveTimeout()

		_.each(extendFromCache as any, (their, key) => {
			const our = this[key]
			if (isDbCacheReadCollection(their)) {
				if (isDbCacheReadCollection(our)) {
					our.extendWithData(their)
				}
			}
		})
	}

	protected getAllCollections() {
		const highPrioDBs: DbCacheWritable<any, any>[] = []
		const lowPrioDBs: DbCacheWritable<any, any>[] = []

		_.map(_.keys(this), (key) => {
			const db = this[key]
			if (isDbCacheWritable(db)) {
				if (key.match(/timeline/i)) {
					highPrioDBs.push(db)
				} else {
					lowPrioDBs.push(db)
				}
			}
		})

		return {
			allDBs: [...highPrioDBs, ...lowPrioDBs],
			highPrioDBs,
			lowPrioDBs,
		}
	}

	async saveAllToDatabase() {
		const span = profiler.startSpan('Cache.saveAllToDatabase')
		this._abortActiveTimeout()

		// Execute cache.defer()'s
		for (let i = 0; i < this._deferredFunctions.length; i++) {
			this._deferredFunctions[i](this)
		}
		this._deferredFunctions.length = 0 // clear the array

		const { highPrioDBs, lowPrioDBs } = this.getAllCollections()

		if (highPrioDBs.length) {
			const anyThingChanged = anythingChanged(
				sumChanges(...(await Promise.all(highPrioDBs.map((db) => db.updateDatabaseWithData()))))
			)
			if (anyThingChanged) {
				// Wait a little bit before saving the rest.
				// The idea is that this allows for the high priority publications to update (such as the Timeline),
				// sending the updated timeline to Playout-gateway
				waitTime(2)
			}
		}

		if (lowPrioDBs.length) {
			await Promise.all(lowPrioDBs.map((db) => db.updateDatabaseWithData()))
		}

		// Execute cache.deferAfterSave()'s
		for (let i = 0; i < this._deferredAfterSaveFunctions.length; i++) {
			this._deferredAfterSaveFunctions[i]()
		}
		this._deferredAfterSaveFunctions.length = 0 // clear the array

		if (span) span.end()
	}

	/**
	 * Discard all changes to documents in the cache.
	 * This essentially acts as rolling back this transaction, and lets the cache be reused for another operation instead
	 */
	discardChanges() {
		const { allDBs } = this.getAllCollections()
		for (const coll of allDBs) {
			coll.discardChanges()
		}

		// Discard any hooks too
		this._deferredAfterSaveFunctions.length = 0
		this._deferredFunctions.length = 0
	}

	/**
	 * Assert that no changes should have been made to the cache, will throw an Error otherwise. This can be used in
	 * place of `saveAllToDatabase()`, when the code controlling the cache expects no changes to have been made and any
	 * changes made are an error and will cause issues.
	 */
	assertNoChanges() {
		const span = profiler.startSpan('Cache.assertNoChanges')

		function logOrThrowError(error: Meteor.Error) {
			if (!Meteor.isProduction) {
				throw error
			} else {
				logger.error(error)
				logger.error(error.stack)
			}
		}

		const { allDBs } = this.getAllCollections()

		if (this._deferredFunctions.length > 0)
			logOrThrowError(
				new Meteor.Error(
					500,
					`Failed no changes in cache assertion, there were ${this._deferredFunctions.length} deferred functions`
				)
			)

		if (this._deferredAfterSaveFunctions.length > 0)
			logOrThrowError(
				new Meteor.Error(
					500,
					`Failed no changes in cache assertion, there were ${this._deferredAfterSaveFunctions.length} after-save deferred functions`
				)
			)

		_.map(allDBs, (db) => {
			if (db.isModified()) {
				logOrThrowError(
					new Meteor.Error(
						500,
						`Failed no changes in cache assertion, cache was modified: collection: ${db.name}`
					)
				)
			}
		})

		this._abortActiveTimeout()

		if (span) span.end()
	}
}
export abstract class CacheBase<T extends CacheBase<any>> extends ReadOnlyCacheBase {
	/** Defer provided function (it will be run just before cache.saveAllToDatabase() ) */
	defer(fcn: DeferredFunction<T>): void {
		this._deferredFunctions.push(fcn)
	}
	/** Defer provided function to after cache.saveAllToDatabase().
	 * Note that at the time of execution, the cache is no longer available.
	 * */
	deferAfterSave(fcn: () => void) {
		this._deferredAfterSaveFunctions.push(fcn)
	}
}
export class CacheForStudioBase extends CacheBase<CacheForStudioBase> {
	containsDataFromStudio: StudioId // Just to get the typings to alert on different cache types

	/** Contains contents in the Studio */
	RundownPlaylists: DbCacheWriteCollection<RundownPlaylist, DBRundownPlaylist>
	// Studios: DbCacheWriteCollection<Studio, Studio>
	Timeline: DbCacheWriteCollection<TimelineComplete, TimelineComplete>

	constructor(studioId: StudioId) {
		super()
		this.containsDataFromStudio = studioId

		this.RundownPlaylists = new DbCacheWriteCollection<RundownPlaylist, DBRundownPlaylist>(RundownPlaylists)
		// this.Studios = new DbCacheWriteCollection<Studio, Studio>(Studios)
		this.Timeline = new DbCacheWriteCollection<TimelineComplete, TimelineComplete>(Timeline)
	}
	defer(fcn: DeferredFunction<CacheForStudioBase>) {
		return super.defer(fcn)
	}
	deferAfterSave(fcn: () => void) {
		return super.deferAfterSave(fcn)
	}
}
export class CacheForStudio extends CacheForStudioBase {
	containsDataFromStudio: StudioId // Just to get the typings to alert on different cache types

	/** Contains contents in the Studio */
	Studios: DbCacheWriteCollection<Studio, Studio>
	PeripheralDevices: DbCacheWriteCollection<PeripheralDevice, PeripheralDevice>

	constructor(studioId: StudioId) {
		super(studioId)
		this.containsDataFromStudio = studioId

		this.Studios = new DbCacheWriteCollection<Studio, Studio>(Studios)
		this.PeripheralDevices = new DbCacheWriteCollection<PeripheralDevice, PeripheralDevice>(PeripheralDevices)
	}
	defer(fcn: DeferredFunction<CacheForStudio>) {
		return super.defer(fcn)
	}
}
async function fillCacheForStudioBaseWithData(
	cache: CacheForStudioBase,
	studioId: StudioId,
	initializeImmediately: boolean
) {
	await Promise.all([
		makePromise(() => cache.RundownPlaylists.prepareInit({ studioId: studioId }, initializeImmediately)),
		makePromise(() => cache.Timeline.prepareInit({ _id: studioId }, initializeImmediately)),
	])

	return cache
}
function emptyCacheForStudio(studioId: StudioId): CacheForStudio {
	return new CacheForStudio(studioId)
}
async function fillCacheForStudioWithData(cache: CacheForStudio, studioId: StudioId, initializeImmediately: boolean) {
	await Promise.all([
		fillCacheForStudioBaseWithData(cache, studioId, initializeImmediately),
		makePromise(() => cache.Studios.prepareInit({ _id: studioId }, initializeImmediately)),
		makePromise(() => cache.PeripheralDevices.prepareInit({ studioId: studioId }, initializeImmediately)),
	])

	return cache
}
export async function initCacheForStudio(studioId: StudioId, initializeImmediately: boolean = true) {
	const span = profiler.startSpan('Cache.initCacheForStudio')

	const cache: CacheForStudio = emptyCacheForStudio(studioId)
	await fillCacheForStudioWithData(cache, studioId, initializeImmediately)

	span?.end()
	return cache
}

/** This Cache contains data for a playlist */
export class CacheForRundownPlaylist extends CacheForStudioBase {
	containsDataFromPlaylist: RundownPlaylistId // Just to get the typings to alert on different cache types

	Rundowns: DbCacheWriteCollection<Rundown, DBRundown>
	Segments: DbCacheWriteCollection<Segment, DBSegment>
	Parts: DbCacheWriteCollection<Part, DBPart>
	Pieces: DbCacheWriteCollection<Piece, Piece>
	PartInstances: DbCacheWriteCollection<PartInstance, DBPartInstance>
	PieceInstances: DbCacheWriteCollection<PieceInstance, PieceInstance>
	RundownBaselineObjs: DbCacheWriteCollection<RundownBaselineObj, RundownBaselineObj>

	// Note: These are not present in the cache because they do not directly affect output:
	// IngestDataCache
	// ExpectedMediaItems
	// ExpectedPlayoutItems

	// These are optional and will be initialized when needed:
	AdLibPieces: DbCacheWriteCollection<AdLibPiece, AdLibPiece>
	AdLibActions: DbCacheWriteCollection<AdLibAction, AdLibAction>

	// These have been moved into ActivationCache:
	// RundownBaselineAdLibPieces
	// RundownBaselineAdLibActions

	activationCache: ActivationCache

	constructor(studioId: StudioId, playlistId: RundownPlaylistId, playlistIsActive: boolean) {
		super(studioId)
		this.containsDataFromPlaylist = playlistId

		this.Rundowns = new DbCacheWriteCollection<Rundown, DBRundown>(Rundowns)
		this.Segments = new DbCacheWriteCollection<Segment, DBSegment>(Segments)
		this.Parts = new DbCacheWriteCollection<Part, DBPart>(Parts)
		this.Pieces = new DbCacheWriteCollection<Piece, Piece>(Pieces)

		this.PartInstances = new DbCacheWriteCollection<PartInstance, DBPartInstance>(PartInstances)
		this.PieceInstances = new DbCacheWriteCollection<PieceInstance, PieceInstance>(PieceInstances)

		this.RundownBaselineObjs = new DbCacheWriteCollection<RundownBaselineObj, RundownBaselineObj>(
			RundownBaselineObjs
		)

		this.AdLibPieces = new DbCacheWriteCollection<AdLibPiece, AdLibPiece>(AdLibPieces)
		this.AdLibActions = new DbCacheWriteCollection<AdLibAction, AdLibAction>(AdLibActions)

		if (playlistIsActive) {
			this.activationCache = getActivationCache(studioId, playlistId)
		} else {
			this.activationCache = new ActivationCache(playlistId)
		}
	}
	defer(fcn: DeferredFunction<CacheForRundownPlaylist>) {
		return super.defer(fcn)
	}
	deferAfterSave(fcn: () => void) {
		return super.deferAfterSave(fcn)
	}
}
function emptyCacheForRundownPlaylist(
	studioId: StudioId,
	playlistId: RundownPlaylistId,
	playlistIsActive: boolean
): CacheForRundownPlaylist {
	return new CacheForRundownPlaylist(studioId, playlistId, playlistIsActive)
}
async function fillCacheForRundownPlaylistWithData(
	cache: CacheForRundownPlaylist,
	playlist: RundownPlaylist,
	initializeImmediately: boolean
) {
	const span = profiler.startSpan('Cache.fillCacheForRundownPlaylistWithData')
	const ps: Promise<any>[] = []
	await cache.Rundowns.prepareInit({ playlistId: playlist._id }, true)

	const rundownsInPlaylist = cache.Rundowns.findFetch()
	const rundownIds = rundownsInPlaylist.map((r) => r._id)

	ps.push(makePromise(() => cache.Segments.prepareInit({ rundownId: { $in: rundownIds } }, initializeImmediately)))
	ps.push(makePromise(() => cache.Parts.prepareInit({ rundownId: { $in: rundownIds } }, initializeImmediately)))
	ps.push(makePromise(() => cache.Pieces.prepareInit({ startRundownId: { $in: rundownIds } }, false)))

	const selectedPartInstanceIds = _.compact([
		playlist.previousPartInstanceId,
		playlist.currentPartInstanceId,
		playlist.nextPartInstanceId,
	])
	ps.push(
		makePromise(() =>
			cache.PartInstances.prepareInit(
				{
					rundownId: { $in: rundownIds },
					$or: [
						{
							reset: { $ne: true },
						},
						{
							_id: { $in: selectedPartInstanceIds },
						},
					],
				},
				initializeImmediately
			)
		)
	)

	ps.push(
		makePromise(() =>
			cache.PieceInstances.prepareInit(async () => {
				const selectedPartInstanceIds = _.compact([
					playlist.currentPartInstanceId,
					playlist.nextPartInstanceId,
					playlist.previousPartInstanceId,
				])

				await cache.PieceInstances.fillWithDataFromDatabase({
					rundownId: { $in: rundownIds },
					partInstanceId: { $in: selectedPartInstanceIds },
					reset: { $ne: true },
				})
			}, initializeImmediately)
		)
	)

	ps.push(
		makePromise(() =>
			cache.RundownBaselineObjs.prepareInit(
				{
					rundownId: { $in: rundownIds },
				},
				initializeImmediately
			)
		)
	)

	ps.push(
		makePromise(() =>
			cache.AdLibPieces.prepareInit(
				{
					rundownId: { $in: rundownIds },
				},
				false
			)
		)
	)
	ps.push(
		makePromise(() =>
			cache.AdLibActions.prepareInit(
				{
					rundownId: { $in: rundownIds },
				},
				false
			)
		)
	)

	ps.push(cache.activationCache.initialize(playlist, rundownsInPlaylist))

	await Promise.all(ps)
	span?.end()
}
export async function initCacheForRundownPlaylist(
	playlist: RundownPlaylist,
	extendFromCache?: CacheForStudioBase,
	initializeImmediately: boolean = true
): Promise<CacheForRundownPlaylist> {
	const span = profiler.startSpan('Cache.initCacheForRundownPlaylist')

	if (!extendFromCache) extendFromCache = await initCacheForStudio(playlist.studioId, initializeImmediately)
	let cache: CacheForRundownPlaylist = emptyCacheForRundownPlaylist(
		playlist.studioId,
		playlist._id,
		!!playlist.activationId
	)
	if (extendFromCache) {
		cache._extendWithData(extendFromCache)
	}
	await fillCacheForRundownPlaylistWithData(cache, playlist, initializeImmediately)

	span?.end()
	return cache
}
export async function initCacheForRundownPlaylistFromRundown(rundownId: RundownId) {
	const rundown = Rundowns.findOne(rundownId)
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
	const playlist = RundownPlaylists.findOne(rundown.playlistId)
	if (!playlist) throw new Meteor.Error(404, `RundownPlaylist "${rundown.playlistId}" not found!`)
	return initCacheForRundownPlaylist(playlist)
}

/** Initialize a cache, run the function, then store the cache */
export function wrapWithCacheForRundownPlaylist<T>(
	playlist: RundownPlaylist,
	fcn: (cache: CacheForRundownPlaylist) => T
): T {
	const cache = waitForPromise(initCacheForRundownPlaylist(playlist))
	const r = fcn(cache)
	waitForPromise(cache.saveAllToDatabase())
	return r
}
export function wrapWithCacheForRundownPlaylistFromRundown<T>(
	rundownId: RundownId,
	fcn: (cache: CacheForRundownPlaylist) => T
): T {
	const cache = waitForPromise(initCacheForRundownPlaylistFromRundown(rundownId))
	const r = fcn(cache)
	waitForPromise(cache.saveAllToDatabase())
	return r
}
