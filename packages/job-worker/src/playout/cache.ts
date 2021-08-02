import { RundownId, RundownPlaylistId, ShowStyleBaseId } from '@sofie-automation/corelib/dist/dataModel/Ids'
// import { ActivationCache, getActivationCache } from '../cache/ActivationCache'
import { DbCacheReadObject, DbCacheWriteObject } from '../cache/CacheObject'
import { CacheBase, ReadOnlyCache } from '../cache/CacheBase'
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
import { removeRundownPlaylistFromDb } from '../rundownPlaylists'
import { getRundownsSegmentsAndPartsFromCache } from './lib'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { lockPlaylist, PlaylistLock } from '../jobs/lock'
import { RundownPlayoutPropsBase } from '@sofie-automation/corelib/dist/worker/studio'
import { DBShowStyleBase, ShowStyleCompound } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { getShowStyleCompound } from '../showStyles'

/**
 * This is a cache used for playout operations.
 * It is intentionally very lightweight, with the intention of it to be used only for some initial verification that a playout operation can be performed.
 */
export class CacheForPlayoutPreInit extends CacheBase<CacheForPlayout> {
	public readonly isPlayout = true
	public readonly PlaylistId: RundownPlaylistId

	public readonly PlaylistLock: PlaylistLock

	// public readonly activationCache: ActivationCache

	public readonly Studio: DbCacheReadObject<DBStudio>
	public readonly PeripheralDevices: DbCacheReadCollection<PeripheralDevice>

	public readonly Playlist: DbCacheWriteObject<DBRundownPlaylist>
	public readonly Rundowns: DbCacheReadCollection<DBRundown>

	protected constructor(
		context: JobContext,
		playlistLock: PlaylistLock,
		playlistId: RundownPlaylistId,
		// activationCache: ActivationCache,
		studio: DbCacheReadObject<DBStudio>,
		peripheralDevices: DbCacheReadCollection<PeripheralDevice>,
		playlist: DbCacheWriteObject<DBRundownPlaylist>,
		rundowns: DbCacheReadCollection<DBRundown>
	) {
		super(context)

		this.PlaylistId = playlistId
		// this.activationCache = activationCache
		this.PlaylistLock = playlistLock

		this.Studio = studio
		this.PeripheralDevices = peripheralDevices
		this.Playlist = playlist
		this.Rundowns = rundowns
	}

	static async createPreInit(
		context: JobContext,
		playlistLock: PlaylistLock,
		tmpPlaylist: ReadonlyDeep<DBRundownPlaylist>,
		reloadPlaylist = true
	): Promise<CacheForPlayoutPreInit> {
		const span = context.startSpan('CacheForPlayoutPreInit.createPreInit')
		if (span) span.setLabel('playlistId', unprotectString(tmpPlaylist._id))

		if (!playlistLock.isLocked) {
			throw new Error('Cannot create cache with released playlist lock')
		}

		const initData = await CacheForPlayoutPreInit.loadInitData(context, tmpPlaylist, reloadPlaylist, undefined)
		const res = new CacheForPlayoutPreInit(context, playlistLock, tmpPlaylist._id, ...initData)
		if (span) span.end()
		return res
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
			DbCacheReadObject.createFromDatabase(
				context,
				context.directCollections.Studios,
				false,
				tmpPlaylist.studioId
			),
			DbCacheReadCollection.createFromDatabase(context, context.directCollections.PeripheralDevices, {
				studioId: tmpPlaylist.studioId,
			}),
			reloadPlaylist
				? await DbCacheWriteObject.createFromDatabase(
						context,
						context.directCollections.RundownPlaylists,
						false,
						tmpPlaylist._id
				  )
				: DbCacheWriteObject.createFromDoc<DBRundownPlaylist>(
						context,
						context.directCollections.RundownPlaylists,
						false,
						tmpPlaylist
				  ),
			existingRundowns ??
				DbCacheReadCollection.createFromDatabase(context, context.directCollections.Rundowns, {
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

	public readonly Timeline: DbCacheWriteCollection<TimelineComplete>

	public readonly Segments: DbCacheReadCollection<DBSegment>
	public readonly Parts: DbCacheReadCollection<DBPart>
	public readonly PartInstances: DbCacheWriteCollection<DBPartInstance>
	public readonly PieceInstances: DbCacheWriteCollection<PieceInstance>

	public readonly BaselineObjects: DbCacheReadCollection<RundownBaselineObj>

	protected constructor(
		context: JobContext,
		initCache: CacheForPlayoutPreInit,
		segments: DbCacheReadCollection<DBSegment>,
		parts: DbCacheReadCollection<DBPart>,
		partInstances: DbCacheWriteCollection<DBPartInstance>,
		pieceInstances: DbCacheWriteCollection<PieceInstance>,
		timeline: DbCacheWriteCollection<TimelineComplete>,
		baselineObjects: DbCacheReadCollection<RundownBaselineObj>
	) {
		super(
			context,
			initCache.PlaylistLock,
			initCache.PlaylistId,
			initCache.Studio,
			initCache.PeripheralDevices,
			initCache.Playlist,
			initCache.Rundowns
		)

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
		const span = context.startSpan('CacheForPlayout.fromInit')
		if (span) span.setLabel('playlistId', unprotectString(initCache.PlaylistId))

		// we are claiming the collections
		initCache._abortActiveTimeout()

		const content = await CacheForPlayout.loadContent(
			context,
			null,
			initCache.Playlist.doc,
			initCache.Rundowns.findFetch({}).map((r) => r._id)
		)

		const res = new CacheForPlayout(context, initCache, ...content)

		if (span) span.end()
		return res
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
			DbCacheReadCollection.createFromDatabase(context, context.directCollections.Segments, {
				rundownId: { $in: loadRundownIds },
			}),
			DbCacheReadCollection.createFromDatabase(context, context.directCollections.Parts, {
				rundownId: { $in: loadRundownIds },
			}),
			DbCacheWriteCollection.createFromDatabase(context, context.directCollections.PartInstances, {
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
			DbCacheWriteCollection.createFromDatabase(context, context.directCollections.PieceInstances, {
				playlistActivationId: playlist.activationId,
				rundownId: { $in: rundownIds },
				partInstanceId: { $in: selectedPartInstanceIds },
			}),
			// Future: This could be defered until we get to updateTimeline. It could be a small performance boost
			DbCacheWriteCollection.createFromDatabase(context, context.directCollections.Timelines, {
				_id: playlist.studioId,
			}),
			DbCacheReadCollection.createFromDatabase(context, context.directCollections.RundownBaselineObjects, {
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

	async getShowStyleBase(rundown: DBRundown): Promise<DBShowStyleBase> {
		// TODO - implement with caching
		const showStyleBase = await this.context.directCollections.ShowStyleBases.findOne(rundown.showStyleBaseId)
		if (!showStyleBase)
			throw new Error(`ShowStyleBase "${rundown.showStyleBaseId}" for Rundown "${rundown._id}" not found!`)
		return showStyleBase
	}

	async getShowStyleCompound(rundown: DBRundown): Promise<ShowStyleCompound> {
		// TODO - implement with caching
		const showStyleCompound = await getShowStyleCompound(this.context, rundown.showStyleVariantId)
		if (!showStyleCompound)
			throw new Error(`ShowStyleBase "${rundown.showStyleBaseId}" for Rundown "${rundown._id}" not found!`)
		return showStyleCompound
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
		if (!this.PlaylistLock.isLocked) {
			throw new Error('Cannot save changes with released playlist lock')
		}

		if (this.toBeRemoved) {
			const span = this.context.startSpan('CacheForPlayout.saveAllToDatabase')
			this._abortActiveTimeout()

			// Ignoring any deferred functions

			await removeRundownPlaylistFromDb(this.context, this.Playlist.doc)

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

/**
 * Run a typical playout job
 * This means loading the playout cache in stages, doing some calculations and saving the result
 */
export async function runAsPlayoutJob<TRes>(
	context: JobContext,
	data: RundownPlayoutPropsBase,
	preInitFcn: null | ((cache: ReadOnlyCache<CacheForPlayoutPreInit>) => Promise<void>),
	fcn: (cache: CacheForPlayout) => Promise<TRes>
): Promise<TRes> {
	if (!data.playlistId) {
		throw new Error(`Job is missing playlistId`)
	}

	const playlist = await context.directCollections.RundownPlaylists.findOne(data.playlistId)
	if (!playlist || playlist.studioId !== context.studioId) {
		throw new Error(`Job playlist "${data.playlistId}" not found or for another studio`)
	}

	const playlistLock = await lockPlaylist(context, playlist._id)
	try {
		const initCache = await CacheForPlayoutPreInit.createPreInit(context, playlistLock, playlist, false)

		if (preInitFcn) {
			await preInitFcn(initCache)
		}

		const fullCache = await CacheForPlayout.fromInit(context, initCache)

		const res = await fcn(fullCache)

		await fullCache.saveAllToDatabase()

		return res
	} finally {
		await playlistLock.release()
	}
}

/**
 * Run a minimal playout job
 * This avoids loading the cache
 */
export async function runAsPlayoutLock<TRes>(
	context: JobContext,
	data: RundownPlayoutPropsBase,
	fcn: (playlist: DBRundownPlaylist) => Promise<TRes>
): Promise<TRes> {
	if (!data.playlistId) {
		throw new Error(`Job is missing playlistId`)
	}

	const playlist = await context.directCollections.RundownPlaylists.findOne(data.playlistId)
	if (!playlist || playlist.studioId !== context.studioId) {
		throw new Error(`Job playlist "${data.playlistId}" not found or for another studio`)
	}

	const playlistLock = await lockPlaylist(context, playlist._id)
	try {
		return await fcn(playlist)
	} finally {
		await playlistLock.release()
	}
}
