import * as _ from 'underscore'
import { Rundown, Rundowns, DBRundown, RundownId } from '../lib/collections/Rundowns'
import {
	RundownPlaylist,
	RundownPlaylists,
	DBRundownPlaylist,
	RundownPlaylistId,
} from '../lib/collections/RundownPlaylists'
import { Meteor } from 'meteor/meteor'
import {
	DbCacheReadCollection,
	isDbCacheReadCollection,
	isDbCacheWriteCollection,
	DbCacheWriteCollection,
	DbCacheReadObject,
	isDbCacheWriteObject,
	DbCacheWriteObject,
	DbCacheWriteOptionalObject,
} from './DatabaseCache'
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
import {
	protectString,
	waitForPromiseAll,
	waitForPromise,
	makePromise,
	getCurrentTime,
	clone,
	unprotectString,
} from '../lib/lib'
import { logger } from './logging'
import { AdLibPiece, AdLibPieces } from '../lib/collections/AdLibPieces'
import { RundownBaselineAdLibItem, RundownBaselineAdLibPieces } from '../lib/collections/RundownBaselineAdLibPieces'
import { AdLibAction, AdLibActions } from '../lib/collections/AdLibActions'
import { RundownBaselineAdLibAction, RundownBaselineAdLibActions } from '../lib/collections/RundownBaselineAdLibActions'
import { isInTestWrite } from './security/lib/securityVerify'
import { ActivationCache, getActivationCache } from './ActivationCache'
import { profiler } from './api/profiler'
import { getRundownId } from './api/ingest/lib'
import { run } from 'tslint/lib/runner'
import { ExpectedPlayoutItem, ExpectedPlayoutItems } from '../lib/collections/ExpectedPlayoutItems'
import { ExpectedMediaItem, ExpectedMediaItems } from '../lib/collections/ExpectedMediaItems'

type DeferredFunction<Cache> = (cache: Cache) => void

/** This cache contains data relevant in a studio */
export abstract class Cache {
	private _deferredFunctions: DeferredFunction<Cache>[] = []
	private _activeTimeout: number | null = null

	constructor() {
		if (!Meteor.isProduction) {
			// When this is set up, we expect saveAllToDatabase() to have been called at the end, otherwise something is wrong
			if (!isInTestWrite()) {
				const futureError = new Meteor.Error(500, `saveAllToDatabase never called`)
				this._activeTimeout = Meteor.setTimeout(() => {
					logger.error(futureError)
				}, 2000)
			}
		}
	}

	_abortActiveTimeout() {
		if (this._activeTimeout) {
			Meteor.clearTimeout(this._activeTimeout)
		}
	}
	_extendWithData(extendFromCache: Cache) {
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
	async saveAllToDatabase() {
		const span = profiler.startSpan('Cache.saveAllToDatabase')
		this._abortActiveTimeout()

		// shouldn't the deferred functions be executed after updating the db?
		_.each(this._deferredFunctions, (fcn) => {
			fcn(this)
		})
		await Promise.all(
			_.map(_.values(this), async (db) => {
				if (isDbCacheWriteCollection(db)) {
					await db.updateDatabaseWithData()
				}
				if (isDbCacheWriteObject(db)) {
					await db.savePendingUpdateToDatabase()
				}
			})
		)
		if (span) span.end()
	}
	/** Defer provided function (it will be run just before cache.saveAllToDatabase() ) */
	defer(fcn: DeferredFunction<Cache>): void {
		this._deferredFunctions.push(fcn)
	}
}

export type ReadOnlyCacheInner<T> = T extends DbCacheWriteCollection<infer A, infer B>
	? DbCacheReadCollection<A, B>
	: T extends DbCacheWriteObject<infer A, infer B>
	? DbCacheReadObject<A, B>
	: T extends DbCacheWriteOptionalObject<infer A, infer B>
	? DbCacheReadObject<A, B, true>
	: T
export type ReadOnlyCache<T extends Cache> = { [K in keyof T]: ReadOnlyCacheInner<T[K]> }

export class CacheForIngest extends Cache {
	public readonly isIngest = true

	public readonly Studio: DbCacheReadObject<Studio, Studio>
	public readonly Rundown: DbCacheWriteOptionalObject<Rundown, DBRundown>
	public readonly RundownExternalId: string

	public readonly Segments: DbCacheWriteCollection<Segment, DBSegment>
	public readonly Parts: DbCacheWriteCollection<Part, DBPart>
	public readonly Pieces: DbCacheWriteCollection<Piece, Piece>

	public readonly AdLibPieces: DbCacheWriteCollection<AdLibPiece, AdLibPiece>
	public readonly AdLibActions: DbCacheWriteCollection<AdLibAction, AdLibAction>

	public readonly ExpectedMediaItems: DbCacheWriteCollection<ExpectedMediaItem, ExpectedMediaItem>
	public readonly ExpectedPlayoutItems: DbCacheWriteCollection<ExpectedPlayoutItem, ExpectedPlayoutItem>

	private constructor(rundownExternalId: string) {
		super()

		this.Studio = new DbCacheReadObject<Studio, Studio>(Studios)
		this.Rundown = new DbCacheWriteOptionalObject<Rundown, DBRundown>(Rundowns)
		this.RundownExternalId = rundownExternalId

		this.Segments = new DbCacheWriteCollection<Segment, DBSegment>(Segments)
		this.Parts = new DbCacheWriteCollection<Part, DBPart>(Parts)
		this.Pieces = new DbCacheWriteCollection<Piece, Piece>(Pieces)

		this.AdLibPieces = new DbCacheWriteCollection<AdLibPiece, AdLibPiece>(AdLibPieces)
		this.AdLibActions = new DbCacheWriteCollection<AdLibAction, AdLibAction>(AdLibActions)

		this.ExpectedMediaItems = new DbCacheWriteCollection<ExpectedMediaItem, ExpectedMediaItem>(ExpectedMediaItems)
		this.ExpectedPlayoutItems = new DbCacheWriteCollection<ExpectedPlayoutItem, ExpectedPlayoutItem>(
			ExpectedPlayoutItems
		)
	}

	static async create(studioId: StudioId, rundownExternalId: string): Promise<CacheForIngest> {
		const res = new CacheForIngest(rundownExternalId)

		await Promise.all([
			res.Studio._initialize(studioId),
			res.Rundown._initialize(getRundownId(studioId, rundownExternalId)),
		])

		// TODO - we need to ensure to not wipe playout changes to Rundown when saving

		const rundownId = res.Rundown.doc?._id ?? protectString('')
		await Promise.all([
			makePromise(() => res.Segments.prepareInit({ rundownId: rundownId }, true)),
			makePromise(() => res.Parts.prepareInit({ rundownId: rundownId }, true)),
			makePromise(() => res.Pieces.prepareInit({ startRundownId: rundownId }, true)),

			makePromise(() => res.AdLibPieces.prepareInit({ rundownId: rundownId }, true)),
			makePromise(() => res.AdLibActions.prepareInit({ rundownId: rundownId }, true)),

			makePromise(() => res.ExpectedMediaItems.prepareInit({ rundownId: rundownId }, true)),
			makePromise(() => res.ExpectedPlayoutItems.prepareInit({ rundownId: rundownId }, true)),
		])

		return res
	}
}

export abstract class CacheForPlayoutPreInit extends Cache {
	public readonly isPlayout = true

	public readonly activationCache: ActivationCache

	public readonly Studio: DbCacheReadObject<Studio, Studio>
	public readonly Playlist: DbCacheWriteObject<RundownPlaylist, DBRundownPlaylist>

	public readonly Rundowns: DbCacheWriteCollection<Rundown, DBRundown> // TODO DbCacheReadCollection??

	protected constructor(studioId: StudioId, playlistId: RundownPlaylistId) {
		super()

		this.activationCache = getActivationCache(studioId, playlistId)

		this.Studio = new DbCacheReadObject<Studio, Studio>(Studios)
		this.Playlist = new DbCacheWriteObject<RundownPlaylist, DBRundownPlaylist>(RundownPlaylists)

		this.Rundowns = new DbCacheWriteCollection<Rundown, DBRundown>(Rundowns)
	}

	protected async preInit(tmpPlaylist: RundownPlaylist) {
		await Promise.all([
			this.Playlist._initialize(tmpPlaylist._id),
			makePromise(() => this.Rundowns.prepareInit({ playlistId: tmpPlaylist._id }, true)),
		])

		const rundowns = this.Rundowns.findFetch()
		await this.activationCache.initialize(tmpPlaylist, rundowns)

		this.Studio._fromDoc(this.activationCache.getStudio())
	}
}

export interface CacheForStudioBase2 {
	readonly Studio: DbCacheReadObject<Studio, Studio>

	readonly Timeline: DbCacheWriteCollection<TimelineObjGeneric, TimelineObjGeneric>
	readonly RecordedFiles: DbCacheReadCollection<RecordedFile, RecordedFile>
}

export class CacheForStudio2 extends Cache implements CacheForStudioBase2 {
	public readonly isStudio = true

	public readonly Studio: DbCacheReadObject<Studio, Studio>

	public readonly RundownPlaylists: DbCacheReadCollection<RundownPlaylist, DBRundownPlaylist>
	public readonly Timeline: DbCacheWriteCollection<TimelineObjGeneric, TimelineObjGeneric>
	public readonly RecordedFiles: DbCacheReadCollection<RecordedFile, RecordedFile>

	private constructor() {
		super()

		this.Studio = new DbCacheReadObject<Studio, Studio>(Studios)

		this.RundownPlaylists = new DbCacheReadCollection<RundownPlaylist, DBRundownPlaylist>(RundownPlaylists)
		this.Timeline = new DbCacheWriteCollection<TimelineObjGeneric, TimelineObjGeneric>(Timeline)
		this.RecordedFiles = new DbCacheReadCollection<RecordedFile, RecordedFile>(RecordedFiles)
	}

	static async create(studioId: StudioId): Promise<CacheForStudio2> {
		const res = new CacheForStudio2()

		res.Studio._initialize(studioId)

		await Promise.all([
			makePromise(() => res.RundownPlaylists.prepareInit({ studioId }, true)), // TODO - immediate?
			makePromise(() => res.Timeline.prepareInit({ studioId }, true)), // TODO - immediate?
			makePromise(() => res.RecordedFiles.prepareInit({ studioId }, true)), // TODO - immediate?
		])

		return res
	}
}

export class CacheForPlayout extends CacheForPlayoutPreInit implements CacheForStudioBase2 {
	public readonly Timeline: DbCacheWriteCollection<TimelineObjGeneric, TimelineObjGeneric>
	public readonly RecordedFiles: DbCacheReadCollection<RecordedFile, RecordedFile>

	public readonly Segments: DbCacheReadCollection<Segment, DBSegment>
	public readonly Parts: DbCacheWriteCollection<Part, DBPart> // TODO DbCacheReadCollection
	public readonly PartInstances: DbCacheWriteCollection<PartInstance, DBPartInstance>
	public readonly PieceInstances: DbCacheWriteCollection<PieceInstance, PieceInstance>

	private constructor(studioId: StudioId, playlistId: RundownPlaylistId) {
		super(studioId, playlistId)

		this.Timeline = new DbCacheWriteCollection<TimelineObjGeneric, TimelineObjGeneric>(Timeline)
		this.RecordedFiles = new DbCacheReadCollection<RecordedFile, RecordedFile>(RecordedFiles)

		this.Segments = new DbCacheReadCollection<Segment, DBSegment>(Segments)
		this.Parts = new DbCacheWriteCollection<Part, DBPart>(Parts)

		this.PartInstances = new DbCacheWriteCollection<PartInstance, DBPartInstance>(PartInstances)
		this.PieceInstances = new DbCacheWriteCollection<PieceInstance, PieceInstance>(PieceInstances)
	}

	static async create(tmpPlaylist: RundownPlaylist): Promise<CacheForPlayout> {
		const res = new CacheForPlayout(tmpPlaylist.studioId, tmpPlaylist._id)

		await res.preInit(tmpPlaylist)

		return res
	}

	async initContent(): Promise<void> {
		const playlist = this.Playlist.doc

		const ps: Promise<any>[] = []

		const rundownIds = this.Rundowns.findFetch().map((r) => r._id)

		const selectedPartInstanceIds = _.compact([
			playlist.currentPartInstanceId,
			playlist.nextPartInstanceId,
			playlist.previousPartInstanceId,
		])

		ps.push(makePromise(() => this.Segments.prepareInit({ rundownId: { $in: rundownIds } }, true))) // TODO - omit if we cant or are unlikely to change the current part
		ps.push(makePromise(() => this.Parts.prepareInit({ rundownId: { $in: rundownIds } }, true))) // TODO - omit if we cant or are unlikely to change the current part

		ps.push(
			makePromise(() => this.PartInstances.prepareInit({ rundownId: { $in: rundownIds } }, true))
			// TODO - should this only load the non-reset?
		)

		ps.push(
			makePromise(() =>
				this.PieceInstances.prepareInit(
					{
						rundownId: { $in: rundownIds },
						partInstanceId: { $in: selectedPartInstanceIds },
					},
					true
				)
			)
		)

		await Promise.all(ps)

		// This will be needed later, but we will do some other processing first
		// TODO-CACHE what happens if this errors? where should that go?
		Promise.all([
			makePromise(() => this.Timeline.prepareInit({ studioId: playlist.studioId }, true)),
			makePromise(() => this.RecordedFiles.prepareInit({ studioId: playlist.studioId }, true)),
		])
	}
}

export class CacheForStudioBase extends Cache {
	containsDataFromStudio: StudioId // Just to get the typings to alert on different cache types

	/** Contains contents in the Studio */
	RundownPlaylists: DbCacheWriteCollection<RundownPlaylist, DBRundownPlaylist>
	// Studios: DbCacheWriteCollection<Studio, Studio>
	Timeline: DbCacheWriteCollection<TimelineObjGeneric, TimelineObjGeneric>
	RecordedFiles: DbCacheWriteCollection<RecordedFile, RecordedFile>

	constructor(studioId: StudioId) {
		super()
		this.containsDataFromStudio = studioId

		this.RundownPlaylists = new DbCacheWriteCollection<RundownPlaylist, DBRundownPlaylist>(RundownPlaylists)
		// this.Studios = new DbCacheWriteCollection<Studio, Studio>(Studios)
		this.Timeline = new DbCacheWriteCollection<TimelineObjGeneric, TimelineObjGeneric>(Timeline)
		this.RecordedFiles = new DbCacheWriteCollection<RecordedFile, RecordedFile>(RecordedFiles)
	}
	defer(fcn: DeferredFunction<CacheForStudioBase>) {
		return super.defer(fcn)
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
function emptyCacheForStudioBase(studioId: StudioId): CacheForStudioBase {
	return new CacheForStudioBase(studioId)
}
async function fillCacheForStudioBaseWithData(
	cache: CacheForStudioBase,
	studioId: StudioId,
	initializeImmediately: boolean
) {
	await Promise.all([
		makePromise(() => cache.RundownPlaylists.prepareInit({ studioId: studioId }, initializeImmediately)),
		makePromise(() => cache.Timeline.prepareInit({ studioId: studioId }, initializeImmediately)),
		makePromise(() => cache.RecordedFiles.prepareInit({ studioId: studioId }, initializeImmediately)),
	])

	return cache
}
export async function initCacheForStudioBase(studioId: StudioId, initializeImmediately: boolean = true) {
	const cache: CacheForStudioBase = emptyCacheForStudioBase(studioId)
	await fillCacheForStudioBaseWithData(cache, studioId, initializeImmediately)

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
	const cache: CacheForStudio = emptyCacheForStudio(studioId)
	await fillCacheForStudioWithData(cache, studioId, initializeImmediately)

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

	constructor(studioId: StudioId, playlistId: RundownPlaylistId) {
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

		this.activationCache = getActivationCache(studioId, playlistId)
	}
	defer(fcn: DeferredFunction<CacheForRundownPlaylist>) {
		return super.defer(fcn)
	}
}

export class CacheForRundownPlaylistIngest extends CacheForRundownPlaylist {
	public readonly isIngest = true
}

function emptyCacheForRundownPlaylist(studioId: StudioId, playlistId: RundownPlaylistId): CacheForRundownPlaylist {
	return new CacheForRundownPlaylist(studioId, playlistId)
}
async function fillCacheForRundownPlaylistWithData(
	cache: CacheForRundownPlaylist,
	playlist: RundownPlaylist,
	initializeImmediately: boolean
) {
	const span = profiler.startSpan('Cache.fillCacheForRundownPlaylistWithData')
	const ps: Promise<any>[] = []
	cache.Rundowns.prepareInit({ playlistId: playlist._id }, true)

	const rundownsInPlaylist = cache.Rundowns.findFetch()
	const rundownIds = rundownsInPlaylist.map((r) => r._id)

	ps.push(makePromise(() => cache.Segments.prepareInit({ rundownId: { $in: rundownIds } }, initializeImmediately)))
	ps.push(makePromise(() => cache.Parts.prepareInit({ rundownId: { $in: rundownIds } }, initializeImmediately)))
	ps.push(makePromise(() => cache.Pieces.prepareInit({ startRundownId: { $in: rundownIds } }, false)))

	ps.push(
		makePromise(() => cache.PartInstances.prepareInit({ rundownId: { $in: rundownIds } }, initializeImmediately))
		// TODO - should this only load the non-reset?
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
	if (span) span.end()
}
export async function initCacheForRundownPlaylist(
	playlist: RundownPlaylist,
	extendFromCache?: CacheForStudioBase,
	initializeImmediately: boolean = true
): Promise<CacheForRundownPlaylist> {
	if (!extendFromCache) extendFromCache = await initCacheForStudio(playlist.studioId, initializeImmediately)
	let cache: CacheForRundownPlaylist = emptyCacheForRundownPlaylist(playlist.studioId, playlist._id)
	if (extendFromCache) {
		cache._extendWithData(extendFromCache)
	}
	await fillCacheForRundownPlaylistWithData(cache, playlist, initializeImmediately)
	return cache
}
/** Cache for playout, but there is no playlist playing */
export async function initCacheForNoRundownPlaylist(
	studioId: StudioId,
	extendFromCache?: CacheForStudio | CacheForStudioBase,
	initializeImmediately: boolean = true
): Promise<CacheForRundownPlaylist> {
	if (!extendFromCache) extendFromCache = await initCacheForStudioBase(studioId, initializeImmediately)
	let cache: CacheForRundownPlaylist = emptyCacheForRundownPlaylist(studioId, protectString(''))
	if (extendFromCache) {
		cache._extendWithData(extendFromCache)
	}
	const studio = Studios.findOne(studioId) as Studio
	if (!studio && !isInTestWrite()) throw new Meteor.Error(404, `Studio "${studioId}" not found`)
	await cache.activationCache.initializeForNoPlaylist(studio)

	return cache
}
export async function initCacheForRundownPlaylistFromRundown(rundownId: RundownId) {
	const rundown = Rundowns.findOne(rundownId)
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
	const playlist = RundownPlaylists.findOne(rundown.playlistId)
	if (!playlist) throw new Meteor.Error(404, `RundownPlaylist "${rundown.playlistId}" not found!`)
	return initCacheForRundownPlaylist(playlist)
}
export async function initCacheForRundownPlaylistFromStudio(studioId: StudioId) {
	const playlist = RundownPlaylists.findOne({
		studioId: studioId,
		active: true,
	})
	if (!playlist) {
		return initCacheForNoRundownPlaylist(studioId)
	} else {
		return initCacheForRundownPlaylist(playlist)
	}
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
export function wrapWithCacheForRundownPlaylistFromStudio<T>(
	studioId: StudioId,
	fcn: (cache: CacheForRundownPlaylist) => T
): T {
	const cache = waitForPromise(initCacheForRundownPlaylistFromStudio(studioId))
	const r = fcn(cache)
	waitForPromise(cache.saveAllToDatabase())
	return r
}
