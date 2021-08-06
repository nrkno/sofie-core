import { ISettings } from '@sofie-automation/corelib/dist/settings'
import { IDirectCollections } from '../db'
import { JobContext, WorkerJob } from '../jobs'
import { ReadonlyDeep } from 'type-fest'
import { WorkerDataCache } from './caches'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import {
	RundownPlaylistId,
	ShowStyleBaseId,
	ShowStyleVariantId,
	StudioId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { IngestJobFunc } from '@sofie-automation/corelib/dist/worker/ingest'
import { loadBlueprintById, WrappedShowStyleBlueprint, WrappedStudioBlueprint } from '../blueprints/cache'
import { ReadonlyObjectDeep } from 'type-fest/source/readonly-deep'
import { ApmSpan, ApmTransaction } from '../profiler'
import { DBShowStyleBase, ShowStyleCompound } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { DBShowStyleVariant } from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant'
import { clone, getRandomString } from '@sofie-automation/corelib/dist/lib'
import { createShowStyleCompound } from '../showStyles'
import { BlueprintManifestType } from '@sofie-automation/blueprints-integration'
import {
	preprocessShowStyleConfig,
	preprocessStudioConfig,
	ProcessedShowStyleConfig,
	ProcessedStudioConfig,
} from '../blueprints/config'
import { StudioJobFunc } from '@sofie-automation/corelib/dist/worker/studio'
import { LockBase, PlaylistLock } from '../jobs/lock'
import { logger } from '../logging'
import { ReadOnlyCacheBase } from '../cache/CacheBase'
import { IS_PRODUCTION } from '../environment'
import { LocksManager } from './locks'

export class JobContextBase implements JobContext {
	private readonly locks: Array<LockBase> = []
	private readonly caches: Array<ReadOnlyCacheBase<any>> = []

	constructor(
		readonly directCollections: Readonly<IDirectCollections>,
		readonly settings: ReadonlyDeep<ISettings>,
		private readonly cacheData: WorkerDataCache,
		private readonly locksManager: LocksManager,
		private readonly transaction: ApmTransaction | undefined
	) {}

	get studio(): ReadonlyDeep<DBStudio> {
		// TODO - Clone and seal to avoid mutations?
		return this.cacheData.studio
	}

	get studioId(): StudioId {
		return this.studio._id
	}

	get studioBlueprint(): ReadonlyObjectDeep<WrappedStudioBlueprint> {
		return this.cacheData.studioBlueprint
	}

	// trackLock(lock: LockBase): void {
	// 	this.locks.push(lock)
	// }

	trackCache(cache: ReadOnlyCacheBase<any>): void {
		this.caches.push(cache)
	}

	async lockPlaylist(playlistId: RundownPlaylistId): Promise<PlaylistLock> {
		const lockId = getRandomString()
		logger.info(`PlaylistLock: Locking "${playlistId}"`)

		const resourceId = `playlist:${playlistId}`
		await this.locksManager.aquire(lockId, resourceId)

		const doRelease = () => this.locksManager.release(lockId, resourceId)
		const lock = new PlaylistLockImpl(playlistId, doRelease)
		this.locks.push(lock)

		logger.info(`PlaylistLock: Locked "${playlistId}"`)

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
					// TODO - cache will not serialize well..
					logger.warn(`Cache has unsaved changes: ${cache}`)
				}
			}
		}
	}

	startSpan(spanName: string): ApmSpan | null {
		if (this.transaction) return this.transaction.startSpan(spanName)
		return null
	}

	queueIngestJob<T extends keyof IngestJobFunc>(
		_name: T,
		_data: Parameters<IngestJobFunc[T]>[0]
	): Promise<WorkerJob<ReturnType<IngestJobFunc[T]>>> {
		throw new Error('Method not implemented.')
	}
	queueStudioJob<T extends keyof StudioJobFunc>(
		_name: T,
		_data: Parameters<StudioJobFunc[T]>[0]
	): Promise<WorkerJob<ReturnType<StudioJobFunc[T]>>> {
		throw new Error('Method not implemented.')
	}

	getStudioBlueprintConfig(): ProcessedStudioConfig {
		if (!this.cacheData.studioBlueprintConfig) {
			this.cacheData.studioBlueprintConfig = preprocessStudioConfig(
				this.cacheData.studio,
				this.cacheData.studioBlueprint.blueprint
			)
		}

		return clone(this.cacheData.studioBlueprintConfig)
	}

	async getShowStyleBase(id: ShowStyleBaseId): Promise<DBShowStyleBase> {
		// Check if allowed
		if (!this.cacheData.studio.supportedShowStyleBase.includes(id)) {
			throw new Error(`ShowStyleBase "${id}" is not allowed in studio`)
		}

		let doc = this.cacheData.showStyleBases.get(id)
		if (doc === undefined) {
			// Load the document
			doc = await this.directCollections.ShowStyleBases.findOne(id)
			this.cacheData.showStyleBases.set(id, doc ?? null)
		}

		if (doc) {
			// TODO - freeze the raw doc instead
			return clone(doc)
		}

		throw new Error(`ShowStyleBase "${id}" does not exist`)
	}
	async getShowStyleVariant(id: ShowStyleVariantId): Promise<DBShowStyleVariant> {
		let doc = this.cacheData.showStyleVariants.get(id)
		if (doc === undefined) {
			// Load the document
			doc = await this.directCollections.ShowStyleVariants.findOne(id)

			// Check allowed
			if (doc && !this.cacheData.studio.supportedShowStyleBase.includes(doc.showStyleBaseId)) {
				throw new Error(`ShowStyleVariant "${id}" is not allowed in studio`)
			}

			this.cacheData.showStyleVariants.set(id, doc ?? null)
		}

		if (doc) {
			// Check allowed
			if (!this.cacheData.studio.supportedShowStyleBase.includes(doc.showStyleBaseId)) {
				throw new Error(`ShowStyleVariant "${id}" is not allowed in studio`)
			}

			// TODO - freeze the raw doc instead
			return clone(doc)
		}

		throw new Error(`ShowStyleBase "${id}" does not exist`)
	}
	async getShowStyleCompound(variantId: ShowStyleVariantId, baseId?: ShowStyleBaseId): Promise<ShowStyleCompound> {
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

	async getShowStyleBlueprint(id: ShowStyleBaseId): Promise<WrappedShowStyleBlueprint> {
		const showStyle = await this.getShowStyleBase(id)

		let blueprint = this.cacheData.showStyleBlueprints.get(showStyle.blueprintId)
		if (blueprint === undefined) {
			// Load the document
			blueprint = await loadShowStyleBlueprint(this.directCollections, showStyle).catch(() => undefined)
			this.cacheData.showStyleBlueprints.set(showStyle.blueprintId, blueprint ?? null)
		}

		if (blueprint) {
			// TODO - freeze the raw doc instead
			return blueprint
		}

		throw new Error(`Blueprint for ShowStyleBase "${id}" does not exist`)
	}
	getShowStyleBlueprintConfig(showStyle: ShowStyleCompound): ProcessedShowStyleConfig {
		const existing = this.cacheData.showStyleBlueprintConfig.get(showStyle.blueprintId)
		if (existing) {
			return existing
		}

		const blueprint = this.cacheData.showStyleBlueprints.get(showStyle.blueprintId)
		if (!blueprint)
			throw new Error(`Blueprint "${showStyle.blueprintId}" must be loaded before its config can be retrieved`)

		const config = preprocessShowStyleConfig(showStyle, blueprint.blueprint)
		this.cacheData.showStyleBlueprintConfig.set(showStyle.blueprintId, config)

		return clone(config)
	}
}

async function loadShowStyleBlueprint(
	context: IDirectCollections,
	showStyleBase: ReadonlyDeep<DBShowStyleBase>
): Promise<WrappedShowStyleBlueprint> {
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

	return {
		blueprintId: showStyleBase.blueprintId,
		blueprint: blueprintManifest,
	}
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
			logger.info(`PlaylistLock: Releasing "${this.playlistId}"`)

			this.#isLocked = false

			await this.doRelease()

			logger.info(`PlaylistLock: Released "${this.playlistId}"`)
		}
	}
}
