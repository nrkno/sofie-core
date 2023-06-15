import { RundownId, RundownPlaylistId, ShowStyleBaseId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DbCacheWriteObject, DbCacheWriteOptionalObject } from '../cache/CacheObject'
import { CacheBase, ReadOnlyCache } from '../cache/CacheBase'
import { DbCacheReadCollection, DbCacheWriteCollection } from '../cache/CacheCollection'
import { PeripheralDevice, PeripheralDeviceType } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
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
import { cleanupRundownsForRemovedPlaylist } from '../rundownPlaylists'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { PlaylistLock } from '../jobs/lock'
import { CacheForIngest } from '../ingest/cache'
import { IMongoTransaction, MongoQuery } from '../db'
import { logger } from '../logging'
import { getOrderedSegmentsAndPartsFromCacheCollections } from '../cache/utils'

/**
 * This is a cache used for playout operations.
 * It is intentionally very lightweight, with the intention of it to be used only for some initial verification that a playout operation can be performed.
 */
export class CacheForPlayoutPreInit extends CacheBase<CacheForPlayout> {
	public readonly isPlayout = true
	public readonly PlaylistId: RundownPlaylistId

	public readonly PlaylistLock: PlaylistLock

	public readonly PeripheralDevices: DbCacheReadCollection<PeripheralDevice>

	public readonly Playlist: DbCacheWriteObject<DBRundownPlaylist>
	public readonly Rundowns: DbCacheReadCollection<DBRundown>

	protected constructor(
		context: JobContext,
		playlistLock: PlaylistLock,
		playlistId: RundownPlaylistId,
		peripheralDevices: DbCacheReadCollection<PeripheralDevice>,
		playlist: DbCacheWriteObject<DBRundownPlaylist>,
		rundowns: DbCacheReadCollection<DBRundown>
	) {
		super(context)

		this.PlaylistId = playlistId
		this.PlaylistLock = playlistLock

		this.PeripheralDevices = peripheralDevices
		this.Playlist = playlist
		this.Rundowns = rundowns
	}

	public get DisplayName(): string {
		return `CacheForPlayoutPreInit "${this.PlaylistId}"`
	}

	static async createPreInit(
		context: JobContext,
		playlistLock: PlaylistLock,
		tmpPlaylist: ReadonlyDeep<DBRundownPlaylist>,
		reloadPlaylist = true
	): Promise<ReadOnlyCache<CacheForPlayoutPreInit>> {
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
			DbCacheReadCollection<PeripheralDevice>,
			DbCacheWriteObject<DBRundownPlaylist>,
			DbCacheReadCollection<DBRundown>
		]
	> {
		return Promise.all([
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

	public readonly Timeline: DbCacheWriteOptionalObject<TimelineComplete>

	public readonly Segments: DbCacheReadCollection<DBSegment>
	public readonly Parts: DbCacheReadCollection<DBPart>
	public readonly PartInstances: DbCacheWriteCollection<DBPartInstance>
	public readonly PieceInstances: DbCacheWriteCollection<PieceInstance>

	public readonly BaselineObjects: DbCacheReadCollection<RundownBaselineObj>

	// public readonly mongoTransaction: IMongoTransaction // TODO-transactions

	protected constructor(
		context: JobContext,
		playlistLock: PlaylistLock,
		playlistId: RundownPlaylistId,
		peripheralDevices: DbCacheReadCollection<PeripheralDevice>,
		playlist: DbCacheWriteObject<DBRundownPlaylist>,
		rundowns: DbCacheReadCollection<DBRundown>,
		segments: DbCacheReadCollection<DBSegment>,
		parts: DbCacheReadCollection<DBPart>,
		partInstances: DbCacheWriteCollection<DBPartInstance>,
		pieceInstances: DbCacheWriteCollection<PieceInstance>,
		timeline: DbCacheWriteOptionalObject<TimelineComplete>,
		baselineObjects: DbCacheReadCollection<RundownBaselineObj>
	) {
		super(context, playlistLock, playlistId, peripheralDevices, playlist, rundowns)

		this.Timeline = timeline

		this.Segments = segments
		this.Parts = parts

		this.PartInstances = partInstances
		this.PieceInstances = pieceInstances

		this.BaselineObjects = baselineObjects
	}

	public get DisplayName(): string {
		return `CacheForPlayout "${this.PlaylistId}"`
	}

	static async fromInit(
		context: JobContext,
		initCache: ReadOnlyCache<CacheForPlayoutPreInit>
	): Promise<CacheForPlayout> {
		const span = context.startSpan('CacheForPlayout.fromInit')
		if (span) span.setLabel('playlistId', unprotectString(initCache.PlaylistId))

		// we are claiming the collections
		initCache.assertNoChanges()

		if (!initCache.PlaylistLock.isLocked) {
			throw new Error('Cannot create cache with released playlist lock')
		}

		const content = await CacheForPlayout.loadContent(
			context,
			null,
			initCache.Playlist.doc,
			initCache.Rundowns.findAll(null).map((r) => r._id)
		)

		// Not strictly necessary, but make a copy of the collection that we know is writable
		const mutablePlaylist = DbCacheWriteObject.createFromDoc<DBRundownPlaylist>(
			context,
			context.directCollections.RundownPlaylists,
			false,
			initCache.Playlist.doc
		)

		const res = new CacheForPlayout(
			context,
			initCache.PlaylistLock,
			initCache.PlaylistId,
			initCache.PeripheralDevices,
			mutablePlaylist,
			initCache.Rundowns,
			...content
		)

		if (span) span.end()
		return res
	}

	static async fromIngest(
		context: JobContext,
		playlistLock: PlaylistLock,
		newPlaylist: ReadonlyDeep<DBRundownPlaylist>,
		newRundowns: ReadonlyDeep<Array<DBRundown>>,
		ingestCache: ReadOnlyCache<CacheForIngest>
	): Promise<CacheForPlayout> {
		const initData = await CacheForPlayoutPreInit.loadInitData(
			context,
			newPlaylist,
			false,
			DbCacheReadCollection.createFromArray<DBRundown>(context, context.directCollections.Rundowns, newRundowns)
		)

		const contentData = await CacheForPlayout.loadContent(
			context,
			ingestCache,
			newPlaylist,
			newRundowns.map((r) => r._id)
		)
		const res = new CacheForPlayout(context, playlistLock, newPlaylist._id, ...initData, ...contentData)

		return res
	}

	/**
	 * Intitialise the full content of the cache
	 * @param ingestCache A CacheForIngest that is pending saving, if this is following an ingest operation
	 */
	private static async loadContent(
		context: JobContext,
		ingestCache: ReadOnlyCache<CacheForIngest> | null,
		playlist: ReadonlyDeep<DBRundownPlaylist>,
		rundownIds: RundownId[]
	): Promise<
		[
			DbCacheReadCollection<DBSegment>,
			DbCacheReadCollection<DBPart>,
			DbCacheWriteCollection<DBPartInstance>,
			DbCacheWriteCollection<PieceInstance>,
			DbCacheWriteOptionalObject<TimelineComplete>,
			DbCacheReadCollection<RundownBaselineObj>
		]
	> {
		const selectedPartInstanceIds = _.compact([
			playlist.currentPartInfo?.partInstanceId,
			playlist.nextPartInfo?.partInstanceId,
			playlist.previousPartInfo?.partInstanceId,
		])

		const partInstancesCollection = Promise.resolve().then(async () => {
			// Future: We could optimise away this query if we tracked the segmentIds of these PartInstances on the playlist
			const segmentIds = _.uniq(
				(
					await context.directCollections.PartInstances.findFetch(
						{
							_id: { $in: selectedPartInstanceIds },
						},
						{
							projection: {
								segmentId: 1,
							},
						},
						null
					)
				).map((p) => p.segmentId)
			)

			const partInstancesSelector: MongoQuery<DBPartInstance> = {
				rundownId: { $in: rundownIds },
				$or: [
					{
						segmentId: { $in: segmentIds },
						reset: { $ne: true },
					},
					{
						_id: { $in: selectedPartInstanceIds },
					},
				],
			}
			// TODO - is this correct? If the playlist isnt active do we want any of these?
			if (playlist.activationId) partInstancesSelector.playlistActivationId = playlist.activationId

			return DbCacheWriteCollection.createFromDatabase(
				context,
				context.directCollections.PartInstances,
				partInstancesSelector
			)
		})

		// If there is an ingestCache, then avoid loading some bits from the db for that rundown
		const loadRundownIds = ingestCache ? rundownIds.filter((id) => id !== ingestCache.RundownId) : rundownIds
		const baselineFromIngest = ingestCache && ingestCache.RundownBaselineObjs.getIfLoaded()
		const loadBaselineIds = baselineFromIngest ? loadRundownIds : rundownIds

		const pieceInstancesSelector: MongoQuery<PieceInstance> = {
			rundownId: { $in: rundownIds },
			partInstanceId: { $in: selectedPartInstanceIds },
		}
		// TODO - is this correct? If the playlist isnt active do we want any of these?
		if (playlist.activationId) pieceInstancesSelector.playlistActivationId = playlist.activationId

		const [segments, parts, baselineObjects, ...collections] = await Promise.all([
			DbCacheReadCollection.createFromDatabase(context, context.directCollections.Segments, {
				rundownId: { $in: loadRundownIds },
			}),
			DbCacheReadCollection.createFromDatabase(context, context.directCollections.Parts, {
				rundownId: { $in: loadRundownIds },
			}),
			DbCacheReadCollection.createFromDatabase(context, context.directCollections.RundownBaselineObjects, {
				rundownId: { $in: loadBaselineIds },
			}),
			partInstancesCollection,
			DbCacheWriteCollection.createFromDatabase(
				context,
				context.directCollections.PieceInstances,
				pieceInstancesSelector
			),
			// Future: This could be defered until we get to updateTimeline. It could be a small performance boost
			DbCacheWriteOptionalObject.createOptionalFromDatabase(
				context,
				context.directCollections.Timelines,
				context.studioId
			),
		])

		if (ingestCache) {
			// Populate the collections with the cached data instead
			segments.fillWithDataFromArray(ingestCache.Segments.findAll(null), true)
			parts.fillWithDataFromArray(ingestCache.Parts.findAll(null), true)
			if (baselineFromIngest) {
				baselineObjects.fillWithDataFromArray(baselineFromIngest.findAll(null), true)
			}
		}

		return [segments, parts, ...collections, baselineObjects]
	}

	/**
	 * Remove the playlist when this cache is saved.
	 * The cache is cleared of any documents, and any deferred functions are discarded
	 * Note: any deferred functions that get added after this will be ignoted
	 */
	removePlaylist(): void {
		if (this.Playlist.doc.activationId) {
			throw new Error('Cannot remove the active RundownPlaylist')
		}
		this.toBeRemoved = true

		super.markCollectionsForRemoval()
	}

	discardChanges(): void {
		this.toBeRemoved = false
		super.discardChanges()

		this.assertNoChanges()
	}

	async saveAllToDatabase(existingTransaction?: IMongoTransaction | null): Promise<void> {
		logger.silly('saveAllToDatabase')
		// TODO - ideally we should make sure to preserve the lock during this operation
		if (!this.PlaylistLock.isLocked) {
			throw new Error('Cannot save changes with released playlist lock')
		}

		if (this.toBeRemoved) {
			const span = this.context.startSpan('CacheForPlayout.saveAllToDatabase')

			// Ignoring any deferred functions
			this._deferredAfterSaveFunctions.length = 0
			this._deferredDuringSaveTransactionFunctions.length = 0
			this._deferredBeforeSaveFunctions.length = 0

			// Remove the playlist doc
			await this.context.directCollections.RundownPlaylists.remove(this.PlaylistId, existingTransaction ?? null) // No transaction, its a single operation

			// Cleanup the Rundowns in their own locks
			this.PlaylistLock.deferAfterRelease(async () => {
				await cleanupRundownsForRemovedPlaylist(this.context, this.PlaylistId)
			})

			super.assertNoChanges()
			span?.end()
		} else {
			return super.saveAllToDatabase(existingTransaction)
		}
	}

	#isMultiGatewayMode: boolean | undefined = undefined
	public get isMultiGatewayMode(): boolean {
		if (this.#isMultiGatewayMode === undefined) {
			if (this.context.studio.settings.forceMultiGatewayMode) {
				this.#isMultiGatewayMode = true
			} else {
				const playoutDevices = this.PeripheralDevices.findAll(
					(device) => device.type === PeripheralDeviceType.PLAYOUT
				)
				this.#isMultiGatewayMode = playoutDevices.length > 1
			}
		}
		return this.#isMultiGatewayMode
	}
}

export function getOrderedSegmentsAndPartsFromPlayoutCache(cache: ReadOnlyCache<CacheForPlayout>): {
	segments: DBSegment[]
	parts: DBPart[]
} {
	return getOrderedSegmentsAndPartsFromCacheCollections(
		cache.Parts,
		cache.Segments,
		cache.Playlist.doc.rundownIdsInOrder
	)
}

export function getRundownIDsFromCache(cache: ReadOnlyCache<CacheForPlayout>): RundownId[] {
	return cache.Rundowns.findAll(null).map((r) => r._id)
}
export function getSelectedPartInstancesFromCache(cache: ReadOnlyCache<CacheForPlayout>): {
	currentPartInstance: DBPartInstance | undefined
	nextPartInstance: DBPartInstance | undefined
	previousPartInstance: DBPartInstance | undefined
} {
	const playlist = cache.Playlist.doc

	return {
		currentPartInstance: playlist.currentPartInfo
			? cache.PartInstances.findOne(playlist.currentPartInfo.partInstanceId)
			: undefined,
		nextPartInstance: playlist.nextPartInfo
			? cache.PartInstances.findOne(playlist.nextPartInfo.partInstanceId)
			: undefined,
		previousPartInstance: playlist.previousPartInfo
			? cache.PartInstances.findOne(playlist.previousPartInfo.partInstanceId)
			: undefined,
	}
}
export function getShowStyleIdsRundownMappingFromCache(
	cache: ReadOnlyCache<CacheForPlayout>
): Map<RundownId, ShowStyleBaseId> {
	const rundowns = cache.Rundowns.findAll(null)
	const ret = new Map()

	for (const rundown of rundowns) {
		ret.set(rundown._id, rundown.showStyleBaseId)
	}

	return ret
}
