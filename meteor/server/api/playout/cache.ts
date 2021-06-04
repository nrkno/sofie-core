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
import { Rundown, DBRundown, Rundowns, RundownId } from '../../../lib/collections/Rundowns'
import { Segment, DBSegment, Segments } from '../../../lib/collections/Segments'
import { Studio, StudioId, Studios } from '../../../lib/collections/Studios'
import { Timeline, TimelineComplete } from '../../../lib/collections/Timeline'
import { ActivationCache, getActivationCache } from '../../cache/ActivationCache'
import { DbCacheReadCollection, DbCacheWriteCollection } from '../../cache/CacheCollection'
import { DbCacheReadObject, DbCacheWriteObject } from '../../cache/CacheObject'
import { CacheBase, ReadOnlyCache } from '../../cache/CacheBase'
import { profiler } from '../profiler'
import { removeRundownPlaylistFromDb } from '../rundownPlaylist'
import { CacheForStudioBase } from '../studio/cache'
import { getRundownsSegmentsAndPartsFromCache } from './lib'
import { CacheForIngest } from '../ingest/cache'
import { Meteor } from 'meteor/meteor'
import { ShowStyleBaseId } from '../../../lib/collections/ShowStyleBases'

/**
 * This is a cache used for playout operations.
 * It is intentionally very lightweight, with the intention of it to be used only for some initial verification that a playout operation can be performed.
 */
export abstract class CacheForPlayoutPreInit extends CacheBase<CacheForPlayout> {
	public readonly isPlayout = true
	public readonly PlaylistId: RundownPlaylistId

	public readonly activationCache: ActivationCache

	public readonly Studio: DbCacheReadObject<Studio, Studio>
	public readonly PeripheralDevices: DbCacheReadCollection<PeripheralDevice, PeripheralDevice>

	public readonly Playlist: DbCacheWriteObject<RundownPlaylist, DBRundownPlaylist>
	public readonly Rundowns: DbCacheReadCollection<Rundown, DBRundown>

	protected constructor(studioId: StudioId, playlistId: RundownPlaylistId) {
		super()

		this.PlaylistId = playlistId
		this.activationCache = getActivationCache(studioId, playlistId)

		this.Studio = new DbCacheReadObject(Studios, false)
		this.PeripheralDevices = new DbCacheReadCollection(PeripheralDevices)

		this.Playlist = new DbCacheWriteObject(RundownPlaylists, false)
		this.Rundowns = new DbCacheReadCollection(Rundowns)
	}

	protected async preInit(tmpPlaylist: ReadonlyDeep<RundownPlaylist>) {
		await Promise.allSettled([
			this.Playlist._initialize(tmpPlaylist._id),
			this.Rundowns.prepareInit({ playlistId: tmpPlaylist._id }, true),
		])

		const rundowns = this.Rundowns.findFetch()
		await this.activationCache.initialize(this.Playlist.doc, rundowns)

		this.Studio._fromDoc(this.activationCache.getStudio())
		await this.PeripheralDevices.prepareInit(async () => {
			const data = await this.activationCache.getPeripheralDevices()
			this.PeripheralDevices.fillWithDataFromArray(data)
		}, true)
	}
}

/**
 * This is a cache used for playout operations.
 * It contains everything that is needed to generate the timeline, and everything except for pieces needed to update the partinstances.
 * Anything not in this cache should not be needed often, and only for specific operations (eg, AdlibActions needed to run one).
 */
export class CacheForPlayout extends CacheForPlayoutPreInit implements CacheForStudioBase {
	private toBeRemoved: boolean = false

	public readonly Timeline: DbCacheWriteCollection<TimelineComplete, TimelineComplete>

	public readonly Segments: DbCacheReadCollection<Segment, DBSegment>
	public readonly Parts: DbCacheReadCollection<Part, DBPart>
	public readonly PartInstances: DbCacheWriteCollection<PartInstance, DBPartInstance>
	public readonly PieceInstances: DbCacheWriteCollection<PieceInstance, PieceInstance>

	protected constructor(studioId: StudioId, playlistId: RundownPlaylistId) {
		super(studioId, playlistId)

		this.Timeline = new DbCacheWriteCollection<TimelineComplete, TimelineComplete>(Timeline)

		this.Segments = new DbCacheReadCollection<Segment, DBSegment>(Segments)
		this.Parts = new DbCacheReadCollection<Part, DBPart>(Parts)

		this.PartInstances = new DbCacheWriteCollection<PartInstance, DBPartInstance>(PartInstances)
		this.PieceInstances = new DbCacheWriteCollection<PieceInstance, PieceInstance>(PieceInstances)
	}

	static async create(tmpPlaylist: ReadonlyDeep<RundownPlaylist>): Promise<CacheForPlayout> {
		const res = new CacheForPlayout(tmpPlaylist.studioId, tmpPlaylist._id)

		await res.preInit(tmpPlaylist)

		return res
	}

	static async from(
		newPlaylist: ReadonlyDeep<RundownPlaylist>,
		newRundowns: ReadonlyDeep<Array<Rundown>>,
		ingestCache: ReadOnlyCache<CacheForIngest>
	): Promise<CacheForPlayout> {
		const res = new CacheForPlayout(newPlaylist.studioId, newPlaylist._id)

		res.Playlist._fromDoc(newPlaylist)
		await res.Rundowns.prepareInit(async () => {
			// newRundowns should already contain the update Rundown from ingestCache
			res.Rundowns.fillWithDataFromArray(newRundowns)
		}, true)

		await res.preInit(res.Playlist.doc)

		await res.initContent(ingestCache)

		return res
	}

	/**
	 * Intitialise the full content of the cache
	 * @param ingestCache A CacheForIngest that is pending saving, if this is following an ingest operation
	 */
	async initContent(ingestCache: ReadOnlyCache<CacheForIngest> | null): Promise<void> {
		const playlist = this.Playlist.doc

		const ps: Promise<any>[] = []

		const rundownIds = this.Rundowns.findFetch().map((r) => r._id)

		const selectedPartInstanceIds = _.compact([
			playlist.currentPartInstanceId,
			playlist.nextPartInstanceId,
			playlist.previousPartInstanceId,
		])

		// If there is an ingestCache, then avoid loading some bits from the db for that rundown
		const loadRundownIds = ingestCache ? rundownIds.filter((id) => id !== ingestCache.RundownId) : rundownIds
		ps.push(this.Segments.prepareInit({ rundownId: { $in: loadRundownIds } }, true))
		ps.push(this.Parts.prepareInit({ rundownId: { $in: loadRundownIds } }, true))

		ps.push(
			// Load all instances which are not reset, or which are selected
			this.PartInstances.prepareInit(
				{
					playlistActivationId: playlist.activationId,
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
				true
			)
		)

		ps.push(
			// Load all instances for the selected partInstances
			this.PieceInstances.prepareInit(
				{
					playlistActivationId: playlist.activationId,
					rundownId: { $in: rundownIds },
					partInstanceId: { $in: selectedPartInstanceIds },
				},
				true
			)
		)

		// Future: This could be defered until we get to updateTimeline. It could be a small performance boost
		ps.push(this.Timeline.prepareInit({ _id: playlist.studioId }, true))

		await Promise.allSettled(ps)

		if (ingestCache) {
			// Populate the collections with the cached data instead
			this.Segments.fillWithDataFromArray(ingestCache.Segments.findFetch(), true)
			this.Parts.fillWithDataFromArray(ingestCache.Parts.findFetch(), true)
		}
	}

	/**
	 * Remove the playlist when this cache is saved.
	 * The cache is cleared of any documents, and any deferred functions are discarded
	 * Note: any deferred functions that get added after this will be ignoted
	 */
	removePlaylist() {
		if (this.Playlist.doc.activationId) {
			throw new Meteor.Error(500, 'Cannot remove the active RundownPlaylist')
		}
		this.toBeRemoved = true

		super.markCollectionsForRemoval()
	}

	discardChanges() {
		this._abortActiveTimeout()

		this.toBeRemoved = false
		super.discardChanges()

		// Discard any hooks too
		this._deferredAfterSaveFunctions.length = 0
		this._deferredFunctions.length = 0

		this.assertNoChanges()
	}

	async saveAllToDatabase() {
		if (this.toBeRemoved) {
			const span = profiler.startSpan('CacheForPlayout.saveAllToDatabase')
			this._abortActiveTimeout()

			// Ignoring any deferred functions

			await removeRundownPlaylistFromDb(this.Playlist.doc)

			super.assertNoChanges()
			span?.end()
		} else {
			return super.saveAllToDatabase()
		}
	}
}

export function getOrderedSegmentsAndPartsFromPlayoutCache(
	cache: CacheForPlayout
): {
	segments: Segment[]
	parts: Part[]
} {
	const rundowns = cache.Rundowns.findFetch(
		{},
		{
			sort: {
				_rank: 1,
				_id: 1,
			},
		}
	)
	return getRundownsSegmentsAndPartsFromCache(cache.Parts, cache.Segments, rundowns)
}
export function getRundownIDsFromCache(cache: CacheForPlayout) {
	return cache.Rundowns.findFetch({}).map((r) => r._id)
}
export function getSelectedPartInstancesFromCache(
	cache: CacheForPlayout
): {
	currentPartInstance: PartInstance | undefined
	nextPartInstance: PartInstance | undefined
	previousPartInstance: PartInstance | undefined
} {
	const playlist = cache.Playlist.doc

	return {
		currentPartInstance: playlist.currentPartInstanceId
			? cache.PartInstances.findOne(playlist.currentPartInstanceId)
			: undefined,
		nextPartInstance: playlist.nextPartInstanceId
			? cache.PartInstances.findOne(playlist.nextPartInstanceId)
			: undefined,
		previousPartInstance: playlist.previousPartInstanceId
			? cache.PartInstances.findOne(playlist.previousPartInstanceId)
			: undefined,
	}
}
export function getShowStyleIdsRundownMappingFromCache(cache: CacheForPlayout): Map<RundownId, ShowStyleBaseId> {
	const rundowns = cache.Rundowns.findFetch({})
	const ret = new Map()

	for (let rundown of rundowns) {
		ret.set(rundown._id, rundown.showStyleBaseId)
	}

	return ret
}
