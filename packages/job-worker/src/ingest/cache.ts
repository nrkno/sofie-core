import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { ExpectedMediaItem } from '@sofie-automation/corelib/dist/dataModel/ExpectedMediaItem'
import { ExpectedPackageDB } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { ExpectedPlayoutItem } from '@sofie-automation/corelib/dist/dataModel/ExpectedPlayoutItem'
import { RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { RundownBaselineAdLibAction } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibAction'
import { RundownBaselineAdLibItem } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibPiece'
import { RundownBaselineObj } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineObj'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { JobContext } from '../jobs'
import { LazyInitialise } from '../lib/lazy'
import { CacheBase } from '../cache/CacheBase'
import { DbCacheWriteCollection } from '../cache/CacheCollection'
import { DbCacheWriteOptionalObject } from '../cache/CacheObject'
import { removeRundownFromDb } from '../rundownPlaylists'
import { getRundownId } from './lib'
import { RundownLock } from '../jobs/lock'

/**
 * Cache of relevant documents for an Ingest Operation
 */
export class CacheForIngest extends CacheBase<CacheForIngest> {
	public readonly isIngest = true
	private toBeRemoved = false

	public readonly RundownLock: RundownLock

	public readonly Rundown: DbCacheWriteOptionalObject<DBRundown>
	public readonly RundownExternalId: string

	public readonly Segments: DbCacheWriteCollection<DBSegment>
	public readonly Parts: DbCacheWriteCollection<DBPart>
	public readonly Pieces: DbCacheWriteCollection<Piece>

	public readonly AdLibPieces: DbCacheWriteCollection<AdLibPiece>
	public readonly AdLibActions: DbCacheWriteCollection<AdLibAction>

	public readonly ExpectedMediaItems: DbCacheWriteCollection<ExpectedMediaItem>
	public readonly ExpectedPlayoutItems: DbCacheWriteCollection<ExpectedPlayoutItem>
	public readonly ExpectedPackages: DbCacheWriteCollection<ExpectedPackageDB>

	public readonly RundownBaselineObjs: LazyInitialise<DbCacheWriteCollection<RundownBaselineObj>>
	public readonly RundownBaselineAdLibPieces: LazyInitialise<DbCacheWriteCollection<RundownBaselineAdLibItem>>
	public readonly RundownBaselineAdLibActions: LazyInitialise<DbCacheWriteCollection<RundownBaselineAdLibAction>>

	public get RundownId(): RundownId {
		return this.Rundown.doc?._id ?? getRundownId(this.context.studioId, this.RundownExternalId)
	}

	public get DisplayName(): string {
		return `CacheForIngest "${this.RundownExternalId}"`
	}

	private constructor(
		context: JobContext,
		rundownLock: RundownLock,
		rundownExternalId: string,
		rundown: DbCacheWriteOptionalObject<DBRundown>,
		segments: DbCacheWriteCollection<DBSegment>,
		parts: DbCacheWriteCollection<DBPart>,
		pieces: DbCacheWriteCollection<Piece>,
		adLibPieces: DbCacheWriteCollection<AdLibPiece>,
		adLibActions: DbCacheWriteCollection<AdLibAction>,
		expectedMediaItems: DbCacheWriteCollection<ExpectedMediaItem>,
		expectedPlayoutItems: DbCacheWriteCollection<ExpectedPlayoutItem>,
		expectedPackages: DbCacheWriteCollection<ExpectedPackageDB>
	) {
		super(context)

		this.RundownLock = rundownLock

		this.Rundown = rundown
		this.RundownExternalId = rundownExternalId

		this.Segments = segments
		this.Parts = parts
		this.Pieces = pieces

		this.AdLibPieces = adLibPieces
		this.AdLibActions = adLibActions

		this.ExpectedMediaItems = expectedMediaItems
		this.ExpectedPlayoutItems = expectedPlayoutItems
		this.ExpectedPackages = expectedPackages

		this.RundownBaselineObjs = new LazyInitialise(async () =>
			DbCacheWriteCollection.createFromDatabase(context, this.context.directCollections.RundownBaselineObjects, {
				rundownId: this.RundownId,
			})
		)
		this.RundownBaselineAdLibPieces = new LazyInitialise(async () =>
			DbCacheWriteCollection.createFromDatabase(
				context,
				this.context.directCollections.RundownBaselineAdLibPieces,
				{
					rundownId: this.RundownId,
				}
			)
		)
		this.RundownBaselineAdLibActions = new LazyInitialise(async () =>
			DbCacheWriteCollection.createFromDatabase(
				context,
				this.context.directCollections.RundownBaselineAdLibActions,
				{
					rundownId: this.RundownId,
				}
			)
		)
	}

	static async create(
		context: JobContext,
		rundownLock: RundownLock,
		rundownExternalId: string
	): Promise<CacheForIngest> {
		const rundownId = getRundownId(context.studioId, rundownExternalId)
		if (rundownId !== rundownLock.rundownId)
			throw new Error(
				`CacheForIngest.create: RundownLock "${rundownLock.rundownId}" is for the wrong Rundown. Expected ${rundownId}`
			)
		if (!rundownLock.isLocked) {
			throw new Error('Cannot create cache with released RundownLock')
		}

		const rundownObj = await DbCacheWriteOptionalObject.createOptionalFromDatabase(
			context,
			context.directCollections.Rundowns,
			rundownId
		)

		const collections = await CacheForIngest.loadCollections(context, rundownId)

		const res = new CacheForIngest(context, rundownLock, rundownExternalId, rundownObj, ...collections)

		return res
	}

	static async createFromRundown(
		context: JobContext,
		rundownLock: RundownLock,
		rundown: DBRundown
	): Promise<CacheForIngest> {
		const collections = await CacheForIngest.loadCollections(context, rundown._id)
		if (rundown._id !== rundownLock.rundownId)
			throw new Error(
				`CacheForIngest.create: RundownLock "${rundownLock.rundownId}" is for the wrong Rundown. Expected ${rundown._id}`
			)
		if (!rundownLock.isLocked) {
			throw new Error('Cannot create cache with released RundownLock')
		}

		const rundownObj = DbCacheWriteOptionalObject.createOptionalFromDoc(
			context,
			context.directCollections.Rundowns,
			rundown
		)

		const res = new CacheForIngest(context, rundownLock, rundown.externalId, rundownObj, ...collections)

		return res
	}

	private static async loadCollections(context: JobContext, rundownId: RundownId) {
		return Promise.all([
			DbCacheWriteCollection.createFromDatabase(context, context.directCollections.Segments, {
				rundownId: rundownId,
			}),
			DbCacheWriteCollection.createFromDatabase(context, context.directCollections.Parts, {
				rundownId: rundownId,
			}),
			DbCacheWriteCollection.createFromDatabase(context, context.directCollections.Pieces, {
				startRundownId: rundownId,
			}),

			DbCacheWriteCollection.createFromDatabase(context, context.directCollections.AdLibPieces, {
				rundownId: rundownId,
			}),
			DbCacheWriteCollection.createFromDatabase(context, context.directCollections.AdLibActions, {
				rundownId: rundownId,
			}),

			DbCacheWriteCollection.createFromDatabase(context, context.directCollections.ExpectedMediaItems, {
				rundownId: rundownId,
			}),
			DbCacheWriteCollection.createFromDatabase(context, context.directCollections.ExpectedPlayoutItems, {
				rundownId: rundownId,
			}),
			DbCacheWriteCollection.createFromDatabase(context, context.directCollections.ExpectedPackages, {
				rundownId: rundownId,
			}),
		])
	}

	/**
	 * Load the Lazy Baseline collections
	 * @returns Loaded Baseline collections
	 */
	async loadBaselineCollections(): Promise<{
		baselineObjects: DbCacheWriteCollection<RundownBaselineObj>
		baselineAdlibPieces: DbCacheWriteCollection<RundownBaselineAdLibItem>
		baselineAdlibActions: DbCacheWriteCollection<RundownBaselineAdLibAction>
	}> {
		const [baselineObjects, baselineAdlibPieces, baselineAdlibActions] = await Promise.all([
			this.RundownBaselineObjs.get(),
			this.RundownBaselineAdLibPieces.get(),
			this.RundownBaselineAdLibActions.get(),
		])

		return {
			baselineObjects,
			baselineAdlibPieces,
			baselineAdlibActions,
		}
	}

	/**
	 * Remove the rundown when this cache is saved.
	 * The cache is cleared of any documents, and any deferred functions are discarded
	 * Note: any deferred functions that get added after this will be ignoted
	 */
	removeRundown(): void {
		this.toBeRemoved = true

		super.markCollectionsForRemoval()

		// Discard any hooks too
		this._deferredAfterSaveFunctions.length = 0
		this._deferredDuringSaveTransactionFunctions.length = 0
		this._deferredBeforeSaveFunctions.length = 0
	}

	discardChanges(): void {
		this.toBeRemoved = false
		super.discardChanges()

		this.assertNoChanges()
	}

	async saveAllToDatabase(): Promise<void> {
		if (!this.RundownLock.isLocked) {
			throw new Error('Cannot save changes with released RundownLock')
		}

		if (this.toBeRemoved) {
			const span = this.context.startSpan('CacheForIngest.saveAllToDatabase')

			// Ignoring any deferred functions
			this._deferredAfterSaveFunctions.length = 0
			this._deferredDuringSaveTransactionFunctions.length = 0
			this._deferredBeforeSaveFunctions.length = 0

			if (this.Rundown.doc) {
				await this.context.directCollections.runInTransaction(async (transaction) => {
					await removeRundownFromDb(this.context, this.RundownLock, transaction)
				})
			}

			super.assertNoChanges()
			span?.end()
		} else {
			await super.saveAllToDatabase()
		}
	}
}
