import { IDirectCollections } from '../db'
import { JobContext } from '../jobs'
import { ReadonlyDeep } from 'type-fest'
import { WorkerDataCache } from './caches'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import {
	RundownId,
	RundownPlaylistId,
	ShowStyleBaseId,
	ShowStyleVariantId,
	StudioId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { getIngestQueueName, IngestJobFunc } from '@sofie-automation/corelib/dist/worker/ingest'
import { loadBlueprintById, WrappedShowStyleBlueprint, WrappedStudioBlueprint } from '../blueprints/cache'
import { ReadonlyObjectDeep } from 'type-fest/source/readonly-deep'
import { ApmSpan, ApmTransaction } from '../profiler'
import { DBShowStyleBase, ShowStyleCompound } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { DBShowStyleVariant } from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant'
import { clone, deepFreeze, getRandomString, stringifyError } from '@sofie-automation/corelib/dist/lib'
import { createShowStyleCompound } from '../showStyles'
import { BlueprintManifestType } from '@sofie-automation/blueprints-integration'
import {
	preprocessShowStyleConfig,
	preprocessStudioConfig,
	ProcessedShowStyleConfig,
	ProcessedStudioConfig,
} from '../blueprints/config'
import { getStudioQueueName, StudioJobFunc } from '@sofie-automation/corelib/dist/worker/studio'
import { LockBase, PlaylistLock, RundownLock } from '../jobs/lock'
import { logger } from '../logging'
import { ReadOnlyCacheBase } from '../cache/CacheBase'
import { IS_PRODUCTION } from '../environment'
import { LocksManager } from './locks'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { EventsJobFunc, getEventsQueueName } from '@sofie-automation/corelib/dist/worker/events'
import { FastTrackTimelineFunc } from '../main'
import { TimelineComplete } from '@sofie-automation/corelib/dist/dataModel/Timeline'

export type QueueJobFunc = (queueName: string, jobName: string, jobData: unknown) => Promise<void>

export class JobContextImpl implements JobContext {
	private readonly locks: Array<LockBase> = []
	private readonly caches: Array<ReadOnlyCacheBase<any>> = []

	constructor(
		readonly directCollections: Readonly<IDirectCollections>,
		private readonly cacheData: WorkerDataCache,
		private readonly locksManager: LocksManager,
		private readonly transaction: ApmTransaction | undefined,
		private readonly queueJob: QueueJobFunc,
		private readonly fastTrackTimeline: FastTrackTimelineFunc | null
	) {}

	get studio(): ReadonlyDeep<DBStudio> {
		// This is frozen at the point of populating the cache
		return this.cacheData.studio
	}

	get studioId(): StudioId {
		return this.studio._id
	}

	get studioBlueprint(): ReadonlyObjectDeep<WrappedStudioBlueprint> {
		// This is frozen at the point of populating the cache
		return this.cacheData.studioBlueprint
	}

	trackCache(cache: ReadOnlyCacheBase<any>): void {
		this.caches.push(cache)
	}

	async lockPlaylist(playlistId: RundownPlaylistId): Promise<PlaylistLock> {
		const span = this.startSpan('lockPlaylist')
		if (span) span.setLabel('playlistId', unprotectString(playlistId))

		const lockId = getRandomString()
		logger.silly(`PlaylistLock: Locking "${playlistId}"`)

		const resourceId = `playlist:${playlistId}`
		await this.locksManager.aquire(lockId, resourceId)

		const doRelease = async () => {
			const span = this.startSpan('unlockPlaylist')
			if (span) span.setLabel('playlistId', unprotectString(playlistId))

			await this.locksManager.release(lockId, resourceId)

			if (span) span.end()
		}
		const lock = new PlaylistLockImpl(playlistId, doRelease)
		this.locks.push(lock)

		logger.silly(`PlaylistLock: Locked "${playlistId}"`)

		if (span) span.end()

		return lock
	}

	async lockRundown(rundownId: RundownId): Promise<RundownLock> {
		const span = this.startSpan('lockRundown')
		if (span) span.setLabel('rundownId', unprotectString(rundownId))

		const lockId = getRandomString()
		logger.info(`RundownLock: Locking "${rundownId}"`)

		const resourceId = `rundown:${rundownId}`
		await this.locksManager.aquire(lockId, resourceId)

		const doRelease = async () => {
			const span = this.startSpan('unlockRundown')
			if (span) span.setLabel('rundownId', unprotectString(rundownId))

			await this.locksManager.release(lockId, resourceId)

			if (span) span.end()
		}
		const lock = new RundownLockImpl(rundownId, doRelease)
		this.locks.push(lock)

		logger.info(`RundownLock: Locked "${rundownId}"`)

		if (span) span.end()

		return lock
	}

	/** Ensure resources are cleaned up after the job completes */
	async cleanupResources(): Promise<void> {
		// Ensure all locks are freed
		for (const lock of this.locks) {
			if (lock.isLocked) {
				logger.warn(`Lock never freed: ${lock}`)
				await lock.release().catch((e) => {
					logger.error(`Lock free failed: ${e}`)
				})
			}
		}

		// Ensure all caches were saved/aborted
		if (!IS_PRODUCTION) {
			for (const cache of this.caches) {
				if (cache.hasChanges()) {
					logger.warn(`Cache has unsaved changes: ${cache.DisplayName}`)
				}
			}
		}
	}

	startSpan(spanName: string): ApmSpan | null {
		if (this.transaction) return this.transaction.startSpan(spanName)
		return null
	}

	async queueIngestJob<T extends keyof IngestJobFunc>(name: T, data: Parameters<IngestJobFunc[T]>[0]): Promise<void> {
		await this.queueJob(getIngestQueueName(this.studioId), name, data)
	}
	async queueStudioJob<T extends keyof StudioJobFunc>(name: T, data: Parameters<StudioJobFunc[T]>[0]): Promise<void> {
		await this.queueJob(getStudioQueueName(this.studioId), name, data)
	}
	async queueEventJob<T extends keyof EventsJobFunc>(name: T, data: Parameters<EventsJobFunc[T]>[0]): Promise<void> {
		await this.queueJob(getEventsQueueName(this.studioId), name, data)
	}

	getStudioBlueprintConfig(): ProcessedStudioConfig {
		if (!this.cacheData.studioBlueprintConfig) {
			this.cacheData.studioBlueprintConfig = deepFreeze(
				clone(preprocessStudioConfig(this.cacheData.studio, this.cacheData.studioBlueprint.blueprint) ?? null)
			)
		}

		return this.cacheData.studioBlueprintConfig
	}

	async getShowStyleBases(): Promise<ReadonlyDeep<Array<DBShowStyleBase>>> {
		const docsToLoad: ShowStyleBaseId[] = []
		const loadedDocs: Array<ReadonlyDeep<DBShowStyleBase>> = []

		// Figure out what is already cached, and what needs loading
		for (const id of this.cacheData.studio.supportedShowStyleBase) {
			const doc = this.cacheData.showStyleBases.get(id)
			if (doc === undefined) {
				docsToLoad.push(id)
			} else if (doc) {
				loadedDocs.push(doc)
			} else {
				// Doc missing in db
			}
		}

		// Load the uncached docs
		if (docsToLoad.length > 0) {
			const newDocs = await this.directCollections.ShowStyleBases.findFetch({ _id: { $in: docsToLoad } })

			// First mark them all in the cache as loaded
			for (const id of docsToLoad) {
				this.cacheData.showStyleBases.set(id, null)
			}

			// Now fill it in with the loaded docs
			for (const doc0 of newDocs) {
				// Freeze and cache it
				const doc = deepFreeze(doc0)
				this.cacheData.showStyleBases.set(doc._id, doc ?? null)

				// Add it to the result
				loadedDocs.push(doc)
			}
		}

		return loadedDocs
	}

	async getShowStyleBase(id: ShowStyleBaseId): Promise<ReadonlyDeep<DBShowStyleBase>> {
		// Check if allowed
		if (!this.cacheData.studio.supportedShowStyleBase.includes(id)) {
			throw new Error(`ShowStyleBase "${id}" is not allowed in studio`)
		}

		let doc = this.cacheData.showStyleBases.get(id)
		if (doc === undefined) {
			// Load the document
			doc = await this.directCollections.ShowStyleBases.findOne(id)

			// Freeze and cache it
			doc = deepFreeze(doc)
			this.cacheData.showStyleBases.set(id, doc ?? null)
		}

		if (doc) {
			// Return the raw doc, as it was frozen before being cached
			return doc
		}

		throw new Error(`ShowStyleBase "${id}" does not exist`)
	}

	async getShowStyleVariants(id: ShowStyleBaseId): Promise<ReadonlyDeep<Array<DBShowStyleVariant>>> {
		// Check if allowed
		if (!this.cacheData.studio.supportedShowStyleBase.includes(id)) {
			throw new Error(`ShowStyleBase "${id}" is not allowed in studio`)
		}

		// This is a weirder one, as we can't efficiently know if we have them all loaded, due to needing to lookup docs that contain the id, with no master list of ids to check

		const loadedDocs: Array<ReadonlyDeep<DBShowStyleVariant>> = []

		// Find all the ones already cached
		for (const doc of this.cacheData.showStyleVariants.values()) {
			if (doc && doc.showStyleBaseId === id) {
				loadedDocs.push(doc)
			}
		}

		// Do a search for more
		const uncachedDocs = await this.directCollections.ShowStyleVariants.findFetch({
			showStyleBaseId: id,
			_id: { $nin: loadedDocs.map((d) => d._id) },
		})

		// Cache the freshly loaded docs,
		for (const doc0 of uncachedDocs) {
			// Freeze and cache it
			const doc = deepFreeze(doc0)
			this.cacheData.showStyleVariants.set(doc._id, doc)

			loadedDocs.push(doc)
		}

		loadedDocs.sort((a, b) => {
			if (a.name > b.name) return 1
			if (a.name < b.name) return -1
			if (a._id > b._id) return 1
			if (a._id < b._id) return -1
			return 0
		})

		return loadedDocs
	}
	async getShowStyleVariant(id: ShowStyleVariantId): Promise<ReadonlyDeep<DBShowStyleVariant>> {
		let doc = this.cacheData.showStyleVariants.get(id)
		if (doc === undefined) {
			// Load the document
			doc = await this.directCollections.ShowStyleVariants.findOne(id)

			// Check allowed
			if (doc && !this.cacheData.studio.supportedShowStyleBase.includes(doc.showStyleBaseId)) {
				throw new Error(`ShowStyleVariant "${id}" is not allowed in studio`)
			}

			// Freeze and cache it
			doc = deepFreeze(doc)
			this.cacheData.showStyleVariants.set(id, doc ?? null)
		}

		if (doc) {
			// Check allowed
			if (!this.cacheData.studio.supportedShowStyleBase.includes(doc.showStyleBaseId)) {
				throw new Error(`ShowStyleVariant "${id}" is not allowed in studio`)
			}

			// Return the raw doc, as it was frozen before being cached
			return doc
		}

		throw new Error(`ShowStyleBase "${id}" does not exist`)
	}
	async getShowStyleCompound(
		variantId: ShowStyleVariantId,
		baseId?: ShowStyleBaseId
	): Promise<ReadonlyDeep<ShowStyleCompound>> {
		const [variant, base0] = await Promise.all([
			this.getShowStyleVariant(variantId),
			baseId ? this.getShowStyleBase(baseId) : null,
		])

		const base = base0 ?? (await this.getShowStyleBase(variant.showStyleBaseId))

		const compound = createShowStyleCompound(base, variant)

		if (!compound) {
			throw new Error(`Failed to compile ShowStyleCompound for base "${base._id}" and variant  "${variant._id}"`)
		}

		return compound
	}

	async getShowStyleBlueprint(id: ShowStyleBaseId): Promise<ReadonlyDeep<WrappedShowStyleBlueprint>> {
		const showStyle = await this.getShowStyleBase(id)

		let blueprint = this.cacheData.showStyleBlueprints.get(showStyle.blueprintId)
		if (blueprint === undefined) {
			// Load the document
			blueprint = await loadShowStyleBlueprint(this.directCollections, showStyle).catch(() => undefined)

			// cache it. It is frozen by the loader
			this.cacheData.showStyleBlueprints.set(showStyle.blueprintId, blueprint ?? null)
		}

		if (blueprint) {
			// Return the raw doc, as it was frozen before being cached
			return blueprint
		}

		throw new Error(`Blueprint for ShowStyleBase "${id}" does not exist`)
	}
	getShowStyleBlueprintConfig(showStyle: ShowStyleCompound): ProcessedShowStyleConfig {
		const existing = this.cacheData.showStyleBlueprintConfig.get(showStyle.showStyleVariantId)
		if (existing) {
			return existing
		}

		const blueprint = this.cacheData.showStyleBlueprints.get(showStyle.blueprintId)
		if (!blueprint)
			throw new Error(`Blueprint "${showStyle.blueprintId}" must be loaded before its config can be retrieved`)

		const config = deepFreeze(clone(preprocessShowStyleConfig(showStyle, blueprint.blueprint)))
		this.cacheData.showStyleBlueprintConfig.set(showStyle.showStyleVariantId, config)

		// Return the raw object, as it was frozen before being cached
		return config
	}

	hackPublishTimelineToFastTrack(newTimeline: TimelineComplete): void {
		if (this.fastTrackTimeline) {
			this.fastTrackTimeline(newTimeline).catch((e) => {
				logger.error(`Failed to publish timeline to fast track: ${stringifyError(e)}`)
			})
		}
	}
}

async function loadShowStyleBlueprint(
	context: IDirectCollections,
	showStyleBase: ReadonlyDeep<DBShowStyleBase>
): Promise<ReadonlyDeep<WrappedShowStyleBlueprint>> {
	if (!showStyleBase.blueprintId) {
		throw new Error(`ShowStyleBase "${showStyleBase._id}" has no defined blueprint!`)
	}

	const blueprintManifest = await loadBlueprintById(context, showStyleBase.blueprintId)
	if (!blueprintManifest) {
		throw new Error(
			`Blueprint "${showStyleBase.blueprintId}" not found! (referenced by ShowStyleBase "${showStyleBase._id}")`
		)
	}

	if (blueprintManifest.blueprintType !== BlueprintManifestType.SHOWSTYLE) {
		throw new Error(
			`Blueprint "${showStyleBase.blueprintId}" is not valid for a ShowStyle "${showStyleBase._id}" (${blueprintManifest.blueprintType})!`
		)
	}

	return Object.freeze({
		blueprintId: showStyleBase.blueprintId,
		blueprint: blueprintManifest,
	})
}

class PlaylistLockImpl extends PlaylistLock {
	#isLocked = true

	public constructor(playlistId: RundownPlaylistId, private readonly doRelease: () => Promise<void>) {
		super(playlistId)
	}

	get isLocked(): boolean {
		return this.#isLocked
	}

	async release(): Promise<void> {
		if (!this.#isLocked) {
			logger.warn(`PlaylistLock: Already released "${this.playlistId}"`)
		} else {
			logger.silly(`PlaylistLock: Releasing "${this.playlistId}"`)

			this.#isLocked = false

			await this.doRelease()

			logger.silly(`PlaylistLock: Released "${this.playlistId}"`)

			if (this.deferedFunctions.length > 0) {
				for (const fcn of this.deferedFunctions) {
					await fcn()
				}
			}
		}
	}
}

class RundownLockImpl extends RundownLock {
	#isLocked = true

	public constructor(rundownId: RundownId, private readonly doRelease: () => Promise<void>) {
		super(rundownId)
	}

	get isLocked(): boolean {
		return this.#isLocked
	}

	async release(): Promise<void> {
		if (!this.#isLocked) {
			logger.warn(`RundownLock: Already released "${this.rundownId}"`)
		} else {
			logger.info(`RundownLock: Releasing "${this.rundownId}"`)

			this.#isLocked = false

			await this.doRelease()

			logger.info(`RundownLock: Released "${this.rundownId}"`)

			if (this.deferedFunctions.length > 0) {
				for (const fcn of this.deferedFunctions) {
					await fcn()
				}
			}
		}
	}
}
