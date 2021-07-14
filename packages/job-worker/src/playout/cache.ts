import { RundownId, RundownPlaylistId, ShowStyleBaseId } from '@sofie-automation/corelib/dist/dataModel/Ids'
// import { ActivationCache, getActivationCache } from '../cache/ActivationCache'
import { DbCacheReadObject, DbCacheWriteObject } from '../cache/CacheObject'
import { CacheBase } from '../cache/CacheBase'
import { DbCacheReadCollection, DbCacheWriteCollection } from '../cache/CacheCollection'
import { PeripheralDevice } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { ReadonlyDeep } from 'type-fest'
import { JobContext } from '../jobs'
import { CacheForStudioBase } from '../studio/cache'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { TimelineComplete } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import _ = require('underscore')
import { RundownBaselineObj } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineObj'
import { removeRundownPlaylistFromDb } from 'src/rundownPlaylists'

/**
 * This is a cache used for playout operations.
 * It is intentionally very lightweight, with the intention of it to be used only for some initial verification that a playout operation can be performed.
 */
export class CacheForPlayoutPreInit extends CacheBase<CacheForPlayout> {
	public readonly isPlayout = true
	public readonly PlaylistId: RundownPlaylistId

	// public readonly activationCache: ActivationCache

	public readonly Studio: DbCacheReadObject<DBStudio>
	public readonly PeripheralDevices: DbCacheReadCollection<PeripheralDevice>

	public readonly Playlist: DbCacheWriteObject<DBRundownPlaylist>
	public readonly Rundowns: DbCacheReadCollection<DBRundown>

	protected constructor(
		playlistId: RundownPlaylistId,
		// activationCache: ActivationCache,
		studio: DbCacheReadObject<DBStudio>,
		peripheralDevices: DbCacheReadCollection<PeripheralDevice>,
		playlist: DbCacheWriteObject<DBRundownPlaylist>,
		rundowns: DbCacheReadCollection<DBRundown>
	) {
		super()

		this.PlaylistId = playlistId
		// this.activationCache = activationCache

		this.Studio = studio
		this.PeripheralDevices = peripheralDevices
		this.Playlist = playlist
		this.Rundowns = rundowns
	}

	static async createPreInit(
		context: JobContext,
		tmpPlaylist: ReadonlyDeep<DBRundownPlaylist>
	): Promise<CacheForPlayoutPreInit> {
		const initData = await CacheForPlayoutPreInit.loadInitData(context, tmpPlaylist, true, undefined)
		return new CacheForPlayoutPreInit(tmpPlaylist._id, ...initData)
	}

	protected static async loadInitData(
		context: JobContext,
		tmpPlaylist: ReadonlyDeep<DBRundownPlaylist>,
		reloadPlaylist: boolean,
		existingRundowns: DbCacheReadCollection<DBRundown> | undefined
	): Promise<
		[
			// ActivationCache,
			DbCacheReadObject<DBStudio>,
			DbCacheReadCollection<PeripheralDevice>,
			DbCacheWriteObject<DBRundownPlaylist>,
			DbCacheReadCollection<DBRundown>
		]
	> {
		// const activationCache = getActivationCache(tmpPlaylist.studioId, tmpPlaylist._id)

		// const [playlist, rundowns] = await Promise.all([
		// 	reloadPlaylist
		// 		? await DbCacheWriteObject.createFromDatabase(
		// 				context.directCollections.RundownPlaylists,
		// 				false,
		// 				tmpPlaylist._id
		// 		  )
		// 		: DbCacheWriteObject.createFromDoc<DBRundownPlaylist>(
		// 				context.directCollections.RundownPlaylists,
		// 				false,
		// 				tmpPlaylist
		// 		  ),
		// 	existingRundowns ??
		// 		DbCacheReadCollection.createFromDatabase(context.directCollections.Rundowns, {
		// 			playlistId: tmpPlaylist._id,
		// 		}),
		// ])

		// // await activationCache.initialize(playlist.doc, rundowns.findFetch())

		// const studio = DbCacheReadObject.createFromDoc(
		// 	context.directCollections.Studios,
		// 	false,
		// 	activationCache.getStudio()
		// )
		// const rawPeripheralDevices = await activationCache.getPeripheralDevices()
		// const peripheralDevices = DbCacheReadCollection.createFromArray(
		// 	context.directCollections.PeripheralDevices,
		// 	rawPeripheralDevices
		// )

		// return [activationCache, studio, peripheralDevices, playlist, rundowns]

		return Promise.all([
			DbCacheReadObject.createFromDatabase(context.directCollections.Studios, false, tmpPlaylist.studioId),
			DbCacheReadCollection.createFromDatabase(context.directCollections.PeripheralDevices, {
				studioId: tmpPlaylist.studioId,
			}),
			reloadPlaylist
				? await DbCacheWriteObject.createFromDatabase(
						context.directCollections.RundownPlaylists,
						false,
						tmpPlaylist._id
				  )
				: DbCacheWriteObject.createFromDoc<DBRundownPlaylist>(
						context.directCollections.RundownPlaylists,
						false,
						tmpPlaylist
				  ),
			existingRundowns ??
				DbCacheReadCollection.createFromDatabase(context.directCollections.Rundowns, {
					playlistId: tmpPlaylist._id,
				}),
		])
	}
}

/**
 * This is a cache used for playout operations.
 * It contains everything that is needed to generate the timeline, and everything except for pieces needed to update the partinstances.
 * Anything not in this cache should not be needed often, and only for specific operations (eg, AdlibActions needed to run one).
 */
export class CacheForPlayout extends CacheForPlayoutPreInit implements CacheForStudioBase {
	private toBeRemoved = false

	private readonly context: JobContext

	public readonly Timeline: DbCacheWriteCollection<TimelineComplete>

	public readonly Segments: DbCacheReadCollection<DBSegment>
	public readonly Parts: DbCacheReadCollection<DBPart>
	public readonly PartInstances: DbCacheWriteCollection<DBPartInstance>
	public readonly PieceInstances: DbCacheWriteCollection<PieceInstance>

	public readonly BaselineObjects: DbCacheReadCollection<RundownBaselineObj>

	protected constructor(
		context: JobContext,
		playlistId: RundownPlaylistId,
		// activationCache: ActivationCache,
		studio: DbCacheReadObject<DBStudio>,
		peripheralDevices: DbCacheReadCollection<PeripheralDevice>,
		playlist: DbCacheWriteObject<DBRundownPlaylist>,
		rundowns: DbCacheReadCollection<DBRundown>,
		segments: DbCacheReadCollection<DBSegment>,
		parts: DbCacheReadCollection<DBPart>,
		partInstances: DbCacheWriteCollection<DBPartInstance>,
		pieceInstances: DbCacheWriteCollection<PieceInstance>,
		timeline: DbCacheWriteCollection<TimelineComplete>,
		baselineObjects: DbCacheReadCollection<RundownBaselineObj>
	) {
		super(playlistId, studio, peripheralDevices, playlist, rundowns)

		this.context = context

		this.Timeline = timeline

		this.Segments = segments
		this.Parts = parts

		this.PartInstances = partInstances
		this.PieceInstances = pieceInstances

		this.BaselineObjects = baselineObjects
	}

	// static async create(tmpPlaylist: ReadonlyDeep<RundownPlaylist>): Promise<CacheForPlayout> {
	// 	const initData = await CacheForPlayoutPreInit.loadInitData(tmpPlaylist, undefined)
	// 	const res = new CacheForPlayout(tmpPlaylist._id, ...initData)

	// 	return res
	// }

	static async fromInit(context: JobContext, initCache: CacheForPlayoutPreInit): Promise<CacheForPlayout> {
		// we are claiming the collections
		initCache._abortActiveTimeout()

		const content = await CacheForPlayout.loadContent(
			context,
			null,
			initCache.Playlist.doc,
			initCache.Rundowns.findFetch().map((r) => r._id)
		)

		return new CacheForPlayout(
			context,
			initCache.PlaylistId,
			// initCache.activationCache,
			initCache.Studio,
			initCache.PeripheralDevices,
			initCache.Playlist,
			initCache.Rundowns,
			...content
		)
	}

	// static async fromIngest(
	// 	context: JobContext,
	// 	newPlaylist: ReadonlyDeep<DBRundownPlaylist>,
	// 	newRundowns: ReadonlyDeep<Array<DBRundown>>,
	// 	ingestCache: ReadOnlyCache<CacheForIngest>
	// ): Promise<CacheForPlayout> {
	// 	const initData = await CacheForPlayoutPreInit.loadInitData(
	// 		newPlaylist,
	// 		false,
	// 		DbCacheReadCollection.createFromArray<Rundown, DBRundown>(Rundowns, newRundowns)
	// 	)

	// 	const contentData = await CacheForPlayout.loadContent(
	// 		ingestCache,
	// 		newPlaylist,
	// 		newRundowns.map((r) => r._id)
	// 	)
	// 	const res = new CacheForPlayout(newPlaylist._id, ...initData, ...contentData)

	// 	return res
	// }

	/**
	 * Intitialise the full content of the cache
	 * @param ingestCache A CacheForIngest that is pending saving, if this is following an ingest operation
	 */
	private static async loadContent(
		context: JobContext,
		ingestCache: any, //ReadOnlyCache<CacheForIngest> | null,
		playlist: ReadonlyDeep<DBRundownPlaylist>,
		rundownIds: RundownId[]
	): Promise<
		[
			DbCacheReadCollection<DBSegment>,
			DbCacheReadCollection<DBPart>,
			DbCacheWriteCollection<DBPartInstance>,
			DbCacheWriteCollection<PieceInstance>,
			DbCacheWriteCollection<TimelineComplete>,
			DbCacheReadCollection<RundownBaselineObj>
		]
	> {
		const selectedPartInstanceIds = _.compact([
			playlist.currentPartInstanceId,
			playlist.nextPartInstanceId,
			playlist.previousPartInstanceId,
		])

		// If there is an ingestCache, then avoid loading some bits from the db for that rundown
		const loadRundownIds = ingestCache ? rundownIds.filter((id) => id !== ingestCache.RundownId) : rundownIds
		const loadBaselineIds = rundownIds // TODO

		const [segments, parts, ...collections] = await Promise.all([
			DbCacheReadCollection.createFromDatabase(context.directCollections.Segments, {
				rundownId: { $in: loadRundownIds },
			}),
			DbCacheReadCollection.createFromDatabase(context.directCollections.Parts, {
				rundownId: { $in: loadRundownIds },
			}),
			DbCacheWriteCollection.createFromDatabase(context.directCollections.PartInstances, {
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
			}),
			DbCacheWriteCollection.createFromDatabase(context.directCollections.PieceInstances, {
				playlistActivationId: playlist.activationId,
				rundownId: { $in: rundownIds },
				partInstanceId: { $in: selectedPartInstanceIds },
			}),
			// Future: This could be defered until we get to updateTimeline. It could be a small performance boost
			DbCacheWriteCollection.createFromDatabase(context.directCollections.Timelines, { _id: playlist.studioId }),
			DbCacheReadCollection.createFromDatabase(context.directCollections.RundownBaselineObjects, {
				rundownId: { $in: loadBaselineIds },
			}),
		])

		if (ingestCache) {
			// Populate the collections with the cached data instead
			segments.fillWithDataFromArray(ingestCache.Segments.findFetch(), true)
			parts.fillWithDataFromArray(ingestCache.Parts.findFetch(), true)
		}

		return [segments, parts, ...collections]
	}

	/**
	 * Remove the playlist when this cache is saved.
	 * The cache is cleared of any documents, and any deferred functions are discarded
	 * Note: any deferred functions that get added after this will be ignoted
	 */
	removePlaylist() {
		if (this.Playlist.doc.activationId) {
			throw new Error('Cannot remove the active RundownPlaylist')
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
			const span = this.context.startSpan('CacheForPlayout.saveAllToDatabase')
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

export function getOrderedSegmentsAndPartsFromPlayoutCache(cache: CacheForPlayout): {
	segments: DBSegment[]
	parts: DBPart[]
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
export function getSelectedPartInstancesFromCache(cache: CacheForPlayout): {
	currentPartInstance: DBPartInstance | undefined
	nextPartInstance: DBPartInstance | undefined
	previousPartInstance: DBPartInstance | undefined
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

	for (const rundown of rundowns) {
		ret.set(rundown._id, rundown.showStyleBaseId)
	}

	return ret
}
