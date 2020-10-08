import * as _ from 'underscore'
import { Rundown, Rundowns, DBRundown, RundownId } from '../../lib/collections/Rundowns'
import {
	RundownPlaylist,
	RundownPlaylists,
	DBRundownPlaylist,
	RundownPlaylistId,
} from '../../lib/collections/RundownPlaylists'
import { Meteor } from 'meteor/meteor'
import {
	DbCacheReadCollection,
	isDbCacheReadCollection,
	isDbCacheWritable,
	DbCacheWriteCollection,
	DbCacheReadObject,
	DbCacheWriteObject,
	DbCacheWriteOptionalObject,
} from './lib'
import { Segment, Segments, DBSegment } from '../../lib/collections/Segments'
import { Parts, DBPart, Part } from '../../lib/collections/Parts'
import { Piece, Pieces } from '../../lib/collections/Pieces'
import { PartInstances, DBPartInstance, PartInstance } from '../../lib/collections/PartInstances'
import { PieceInstance, PieceInstances } from '../../lib/collections/PieceInstances'
import { Studio, Studios, StudioId } from '../../lib/collections/Studios'
import { Timeline, TimelineComplete } from '../../lib/collections/Timeline'
import { RundownBaselineObj, RundownBaselineObjs } from '../../lib/collections/RundownBaselineObjs'
import { PeripheralDevice, PeripheralDevices } from '../../lib/collections/PeripheralDevices'
import {
	protectString,
	waitForPromiseAll,
	waitForPromise,
	makePromise,
	getCurrentTime,
	clone,
	unprotectString,
	waitTime,
	sumChanges,
	anythingChanged,
	ProtectedString,
} from '../../lib/lib'
import { logger } from '../logging'
import { AdLibPiece, AdLibPieces } from '../../lib/collections/AdLibPieces'
import { RundownBaselineAdLibItem, RundownBaselineAdLibPieces } from '../../lib/collections/RundownBaselineAdLibPieces'
import { AdLibAction, AdLibActions } from '../../lib/collections/AdLibActions'
import {
	RundownBaselineAdLibAction,
	RundownBaselineAdLibActions,
} from '../../lib/collections/RundownBaselineAdLibActions'
import { isInTestWrite } from '../security/lib/securityVerify'
import { ActivationCache, getActivationCache } from './ActivationCache'
import { profiler } from '../api/profiler'
import { getRundownId } from '../api/ingest/lib'
import { ExpectedPlayoutItem, ExpectedPlayoutItems } from '../../lib/collections/ExpectedPlayoutItems'
import { ExpectedMediaItem, ExpectedMediaItems } from '../../lib/collections/ExpectedMediaItems'
import { removeRundownsFromDb, removeRundownPlaylistFromDb } from '../api/playout/lib'

type DeferredFunction<Cache> = (cache: Cache) => void

/** This cache contains data relevant in a studio */
export abstract class Cache {
	private _deferredFunctions: DeferredFunction<Cache>[] = []
	private _deferredAfterSaveFunctions: (() => void)[] = []
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

		// Execute cache.defer()'s
		for (let i = 0; i < this._deferredFunctions.length; i++) {
			this._deferredFunctions[i](this)
		}
		this._deferredFunctions.length = 0 // clear the array

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

	/** Defer provided function (it will be run just before cache.saveAllToDatabase() ) */
	defer(fcn: DeferredFunction<Cache>): void {
		this._deferredFunctions.push(fcn)
	}
	deferAfterSave(fcn: () => void) {
		this._deferredAfterSaveFunctions.push(fcn)
	}
}
type DbCacheWritable<T1, T2> = DbCacheWriteCollection<any, any> | DbCacheWriteObject<any, any>

export type ReadOnlyCacheInner<T> = T extends DbCacheWriteCollection<infer A, infer B>
	? DbCacheReadCollection<A, B>
	: T extends DbCacheWriteObject<infer A, infer B>
	? DbCacheReadObject<A, B>
	: T extends DbCacheWriteOptionalObject<infer A, infer B>
	? DbCacheReadObject<A, B, true>
	: T
export type ReadOnlyCache<T extends Cache> = Omit<
	{ [K in keyof T]: ReadOnlyCacheInner<T[K]> },
	'defer' | 'deferAfterSave'
>

export class CacheForIngest extends Cache {
	public readonly isIngest = true
	private toBeRemoved = false

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

	public readonly RundownBaselineObjs: DbCacheWriteCollection<RundownBaselineObj, RundownBaselineObj>
	public readonly RundownBaselineAdLibPieces: DbCacheWriteCollection<
		RundownBaselineAdLibItem,
		RundownBaselineAdLibItem
	>
	public readonly RundownBaselineAdLibActions: DbCacheWriteCollection<
		RundownBaselineAdLibAction,
		RundownBaselineAdLibAction
	>

	private constructor(rundownExternalId: string) {
		super()

		this.Studio = new DbCacheReadObject(Studios, false)
		this.Rundown = new DbCacheWriteOptionalObject(Rundowns)
		this.RundownExternalId = rundownExternalId

		this.Segments = new DbCacheWriteCollection(Segments)
		this.Parts = new DbCacheWriteCollection(Parts)
		this.Pieces = new DbCacheWriteCollection(Pieces)

		this.AdLibPieces = new DbCacheWriteCollection(AdLibPieces)
		this.AdLibActions = new DbCacheWriteCollection(AdLibActions)

		this.ExpectedMediaItems = new DbCacheWriteCollection(ExpectedMediaItems)
		this.ExpectedPlayoutItems = new DbCacheWriteCollection(ExpectedPlayoutItems)

		this.RundownBaselineObjs = new DbCacheWriteCollection(RundownBaselineObjs)
		this.RundownBaselineAdLibPieces = new DbCacheWriteCollection(RundownBaselineAdLibPieces)
		this.RundownBaselineAdLibActions = new DbCacheWriteCollection(RundownBaselineAdLibActions)
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
			res.Segments.prepareInit({ rundownId: rundownId }, true),
			res.Parts.prepareInit({ rundownId: rundownId }, true),
			res.Pieces.prepareInit({ startRundownId: rundownId }, true),

			res.AdLibPieces.prepareInit({ rundownId: rundownId }, true),
			res.AdLibActions.prepareInit({ rundownId: rundownId }, true),

			res.ExpectedMediaItems.prepareInit({ rundownId: rundownId }, true),
			res.ExpectedPlayoutItems.prepareInit({ rundownId: rundownId }, true),

			res.RundownBaselineObjs.prepareInit({ rundownId: rundownId }, false),
			res.RundownBaselineAdLibPieces.prepareInit({ rundownId: rundownId }, false),
			res.RundownBaselineAdLibActions.prepareInit({ rundownId: rundownId }, false),
		])

		return res
	}

	async loadBaselineCollections(): Promise<void> {
		await Promise.all([
			makePromise(() => this.RundownBaselineObjs._initialize()),
			makePromise(() => this.RundownBaselineAdLibPieces._initialize()),
			makePromise(() => this.RundownBaselineAdLibActions._initialize()),
		])
	}

	removeRundown() {
		this.toBeRemoved = true
	}

	async saveAllToDatabase() {
		if (this.toBeRemoved) {
			const span = profiler.startSpan('CacheForIngest.saveAllToDatabase')
			this._abortActiveTimeout()

			// TODO - run any of the defers?

			if (this.Rundown.doc) {
				waitForPromise(removeRundownsFromDb([this.Rundown.doc._id]))
			}

			span?.end()
		} else {
			return super.saveAllToDatabase()
		}
	}
}

export abstract class CacheForPlayoutPreInit extends Cache {
	public readonly isPlayout = true

	public readonly activationCache: ActivationCache

	public readonly Studio: DbCacheReadObject<Studio, Studio>
	public readonly PeripheralDevices: DbCacheReadCollection<PeripheralDevice, PeripheralDevice>

	public readonly Playlist: DbCacheWriteObject<RundownPlaylist, DBRundownPlaylist>
	public readonly Rundowns: DbCacheWriteCollection<Rundown, DBRundown> // TODO DbCacheReadCollection??

	protected constructor(studioId: StudioId, playlistId: RundownPlaylistId) {
		super()

		this.activationCache = getActivationCache(studioId, playlistId)

		this.Studio = new DbCacheReadObject(Studios, false)
		this.PeripheralDevices = new DbCacheReadCollection(PeripheralDevices)

		this.Playlist = new DbCacheWriteObject(RundownPlaylists, false)
		this.Rundowns = new DbCacheWriteCollection(Rundowns)
	}

	protected async preInit(tmpPlaylist: RundownPlaylist) {
		await Promise.all([
			this.Playlist._initialize(tmpPlaylist._id),
			this.Rundowns.prepareInit({ playlistId: tmpPlaylist._id }, true),
		])

		const rundowns = this.Rundowns.findFetch()
		await this.activationCache.initialize(tmpPlaylist, rundowns)

		this.Studio._fromDoc(this.activationCache.getStudio())
		await this.PeripheralDevices.prepareInit(
			() => waitForPromise(this.activationCache.getPeripheralDevices()),
			true
		)
	}
}

export interface CacheForStudioBase {
	readonly Studio: DbCacheReadObject<Studio, Studio>
	readonly PeripheralDevices: DbCacheReadCollection<PeripheralDevice, PeripheralDevice>

	readonly Timeline: DbCacheWriteCollection<TimelineComplete, TimelineComplete>
}

export class CacheForStudio extends Cache implements CacheForStudioBase {
	public readonly isStudio = true

	public readonly Studio: DbCacheReadObject<Studio, Studio>
	public readonly PeripheralDevices: DbCacheReadCollection<PeripheralDevice, PeripheralDevice>

	public readonly RundownPlaylists: DbCacheReadCollection<RundownPlaylist, DBRundownPlaylist>
	public readonly Timeline: DbCacheWriteCollection<TimelineComplete, TimelineComplete>

	private constructor() {
		super()

		this.Studio = new DbCacheReadObject(Studios, false)
		this.PeripheralDevices = new DbCacheReadCollection(PeripheralDevices)

		this.RundownPlaylists = new DbCacheReadCollection(RundownPlaylists)
		this.Timeline = new DbCacheWriteCollection(Timeline)
	}

	static async create(studioId: StudioId): Promise<CacheForStudio> {
		const res = new CacheForStudio()

		res.Studio._initialize(studioId)

		await Promise.all([
			res.PeripheralDevices.prepareInit({ studioId }, true), // TODO - immediate?
			res.RundownPlaylists.prepareInit({ studioId }, true), // TODO - immediate?
			res.Timeline.prepareInit({ studioId }, true), // TODO - immediate?
		])

		return res
	}

	public getActiveRundownPlaylists(excludeRundownPlaylistId?: RundownPlaylistId): RundownPlaylist[] {
		return this.RundownPlaylists.findFetch({
			active: true,
			_id: {
				$ne: excludeRundownPlaylistId || protectString(''),
			},
		})
	}
}

export class CacheForPlayout extends CacheForPlayoutPreInit implements CacheForStudioBase {
	private toBeRemoved: boolean = false

	public readonly Timeline: DbCacheWriteCollection<TimelineComplete, TimelineComplete>

	public readonly Segments: DbCacheReadCollection<Segment, DBSegment>
	public readonly Parts: DbCacheWriteCollection<Part, DBPart> // TODO DbCacheReadCollection
	public readonly PartInstances: DbCacheWriteCollection<PartInstance, DBPartInstance>
	public readonly PieceInstances: DbCacheWriteCollection<PieceInstance, PieceInstance>

	private constructor(studioId: StudioId, playlistId: RundownPlaylistId) {
		super(studioId, playlistId)

		this.Timeline = new DbCacheWriteCollection<TimelineComplete, TimelineComplete>(Timeline)

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

		ps.push(this.Segments.prepareInit({ rundownId: { $in: rundownIds } }, true)) // TODO - omit if we cant or are unlikely to change the current part
		ps.push(this.Parts.prepareInit({ rundownId: { $in: rundownIds } }, true)) // TODO - omit if we cant or are unlikely to change the current part

		ps.push(
			this.PartInstances.prepareInit({ rundownId: { $in: rundownIds } }, true)
			// TODO - should this only load the non-reset?
		)

		ps.push(
			this.PieceInstances.prepareInit(
				{
					rundownId: { $in: rundownIds },
					partInstanceId: { $in: selectedPartInstanceIds },
				},
				true
			)
		)

		await Promise.all(ps)

		// This will be needed later, but we will do some other processing first
		// TODO-CACHE what happens if this errors? where should that go?
		Promise.all([this.Timeline.prepareInit({ studioId: playlist.studioId }, true)])
	}

	removePlaylist() {
		this.toBeRemoved = true
	}

	async saveAllToDatabase() {
		if (this.toBeRemoved) {
			const span = profiler.startSpan('CacheForPlayout.saveAllToDatabase')
			this._abortActiveTimeout()

			// TODO - run any of the defers?

			waitForPromise(removeRundownPlaylistFromDb(this.Playlist.doc._id))

			span?.end()
		} else {
			return super.saveAllToDatabase()
		}
	}
}
