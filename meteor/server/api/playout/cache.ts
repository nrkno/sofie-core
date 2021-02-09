import { ReadonlyDeep } from 'type-fest'
import _ from 'underscore'
import { PartInstance, DBPartInstance, PartInstances } from '../../../lib/collections/PartInstances'
import { Part, DBPart, Parts } from '../../../lib/collections/Parts'
import { PeripheralDevice, PeripheralDevices } from '../../../lib/collections/PeripheralDevices'
import { PieceInstance, PieceInstances } from '../../../lib/collections/PieceInstances'
import {
	RundownPlaylist,
	DBRundownPlaylist,
	RundownPlaylistId,
	RundownPlaylists,
} from '../../../lib/collections/RundownPlaylists'
import { Rundown, DBRundown, Rundowns } from '../../../lib/collections/Rundowns'
import { Segment, DBSegment, Segments } from '../../../lib/collections/Segments'
import { Studio, StudioId, Studios } from '../../../lib/collections/Studios'
import { Timeline, TimelineComplete } from '../../../lib/collections/Timeline'
import { waitForPromise } from '../../../lib/lib'
import { ActivationCache, getActivationCache } from '../../cache/ActivationCache'
import { DbCacheReadCollection, DbCacheWriteCollection } from '../../cache/CacheCollection'
import { DbCacheReadObject, DbCacheWriteObject } from '../../cache/CacheObject'
import { CacheBase } from '../../cache/DatabaseCaches'
import { profiler } from '../profiler'
import { removeRundownPlaylistFromDb } from '../rundownPlaylist'
import { CacheForStudioBase } from '../studio/cache'

export abstract class CacheForPlayoutPreInit extends CacheBase {
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

	protected async preInit(tmpPlaylist: ReadonlyDeep<RundownPlaylist>) {
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

	static async create(tmpPlaylist: ReadonlyDeep<RundownPlaylist>): Promise<CacheForPlayout> {
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
			this.PartInstances.prepareInit(
				{
					playlistActivationId: playlist.activationId,
					rundownId: { $in: rundownIds },
					reset: { $ne: true },
				},
				true
			)
		)

		ps.push(
			this.PieceInstances.prepareInit(
				{
					playlistActivationId: playlist.activationId,
					rundownId: { $in: rundownIds },
					partInstanceId: { $in: selectedPartInstanceIds },
					reset: { $ne: true },
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

	discardChanges() {
		this.toBeRemoved = false
		super.discardChanges()
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
