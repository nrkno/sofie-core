import { AdLibAction, AdLibActions } from '../../../lib/collections/AdLibActions'
import { AdLibPiece, AdLibPieces } from '../../../lib/collections/AdLibPieces'
import { ExpectedMediaItem, ExpectedMediaItems } from '../../../lib/collections/ExpectedMediaItems'
import { ExpectedPlayoutItem, ExpectedPlayoutItems } from '../../../lib/collections/ExpectedPlayoutItems'
import { Part, Parts } from '../../../lib/collections/Parts'
import { Piece, Pieces } from '../../../lib/collections/Pieces'
import {
	RundownBaselineAdLibAction,
	RundownBaselineAdLibActions,
} from '../../../lib/collections/RundownBaselineAdLibActions'
import {
	RundownBaselineAdLibItem,
	RundownBaselineAdLibPieces,
} from '../../../lib/collections/RundownBaselineAdLibPieces'
import { RundownBaselineObj, RundownBaselineObjs } from '../../../lib/collections/RundownBaselineObjs'
import { Rundown, Rundowns } from '../../../lib/collections/Rundowns'
import { Segment, Segments } from '../../../lib/collections/Segments'
import { Studio, Studios, StudioId } from '../../../lib/collections/Studios'
import { DbCacheWriteCollection } from '../../cache/CacheCollection'
import { DbCacheReadObject, DbCacheWriteOptionalObject } from '../../cache/CacheObject'
import { CacheBase } from '../../cache/CacheBase'
import { profiler } from '../profiler'
import { removeRundownsFromDb } from '../rundownPlaylist'
import { getRundownId } from './lib'
import { ExpectedPackageDB, ExpectedPackages } from '../../../lib/collections/ExpectedPackages'
import { LazyInitialise } from '../../lib/lazy'

export class CacheForIngest extends CacheBase<CacheForIngest> {
	public readonly isIngest = true
	private toBeRemoved = false

	public readonly Studio: DbCacheReadObject<Studio>
	public readonly Rundown: DbCacheWriteOptionalObject<Rundown>
	public readonly RundownExternalId: string

	public readonly Segments: DbCacheWriteCollection<Segment>
	public readonly Parts: DbCacheWriteCollection<Part>
	public readonly Pieces: DbCacheWriteCollection<Piece>

	public readonly AdLibPieces: DbCacheWriteCollection<AdLibPiece>
	public readonly AdLibActions: DbCacheWriteCollection<AdLibAction>

	public readonly ExpectedMediaItems: DbCacheWriteCollection<ExpectedMediaItem>
	public readonly ExpectedPlayoutItems: DbCacheWriteCollection<ExpectedPlayoutItem>
	public readonly ExpectedPackages: DbCacheWriteCollection<ExpectedPackageDB>

	public readonly RundownBaselineObjs: LazyInitialise<DbCacheWriteCollection<RundownBaselineObj>>
	public readonly RundownBaselineAdLibPieces: LazyInitialise<DbCacheWriteCollection<RundownBaselineAdLibItem>>
	public readonly RundownBaselineAdLibActions: LazyInitialise<DbCacheWriteCollection<RundownBaselineAdLibAction>>

	public get RundownId() {
		return this.Rundown.doc?._id ?? getRundownId(this.Studio.doc._id, this.RundownExternalId)
	}

	private constructor(
		rundownExternalId: string,
		studio: DbCacheReadObject<Studio>,
		rundown: DbCacheWriteOptionalObject<Rundown>,
		segments: DbCacheWriteCollection<Segment>,
		parts: DbCacheWriteCollection<Part>,
		pieces: DbCacheWriteCollection<Piece>,
		adLibPieces: DbCacheWriteCollection<AdLibPiece>,
		adLibActions: DbCacheWriteCollection<AdLibAction>,
		expectedMediaItems: DbCacheWriteCollection<ExpectedMediaItem>,
		expectedPlayoutItems: DbCacheWriteCollection<ExpectedPlayoutItem>,
		expectedPackages: DbCacheWriteCollection<ExpectedPackageDB>
	) {
		super()

		this.Studio = studio
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
			DbCacheWriteCollection.createFromDatabase(RundownBaselineObjs, { rundownId: this.RundownId })
		)
		this.RundownBaselineAdLibPieces = new LazyInitialise(async () =>
			DbCacheWriteCollection.createFromDatabase(RundownBaselineAdLibPieces, { rundownId: this.RundownId })
		)
		this.RundownBaselineAdLibActions = new LazyInitialise(async () =>
			DbCacheWriteCollection.createFromDatabase(RundownBaselineAdLibActions, { rundownId: this.RundownId })
		)
	}

	static async create(studioId: StudioId, rundownExternalId: string): Promise<CacheForIngest> {
		const rundownId = getRundownId(studioId, rundownExternalId)

		const [studio, rundown] = await Promise.all([
			DbCacheReadObject.createFromDatabase(Studios, false, studioId),
			DbCacheWriteOptionalObject.createOptionalFromDatabase(Rundowns, rundownId),
		])

		const collections = await Promise.all([
			DbCacheWriteCollection.createFromDatabase(Segments, { rundownId: rundownId }),
			DbCacheWriteCollection.createFromDatabase(Parts, { rundownId: rundownId }),
			DbCacheWriteCollection.createFromDatabase(Pieces, { startRundownId: rundownId }),

			DbCacheWriteCollection.createFromDatabase(AdLibPieces, { rundownId: rundownId }),
			DbCacheWriteCollection.createFromDatabase(AdLibActions, { rundownId: rundownId }),

			DbCacheWriteCollection.createFromDatabase(ExpectedMediaItems, { rundownId: rundownId }),
			DbCacheWriteCollection.createFromDatabase(ExpectedPlayoutItems, { rundownId: rundownId }),
			DbCacheWriteCollection.createFromDatabase(ExpectedPackages, { rundownId: rundownId }),
		])

		const res = new CacheForIngest(rundownExternalId, studio, rundown, ...collections)

		return res
	}

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
	removeRundown() {
		this.toBeRemoved = true

		super.markCollectionsForRemoval()

		// Discard any hooks too
		this._deferredAfterSaveFunctions.length = 0
		this._deferredFunctions.length = 0
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
			const span = profiler.startSpan('CacheForIngest.saveAllToDatabase')
			this._abortActiveTimeout()

			// Ignoring any deferred functions

			if (this.Rundown.doc) {
				await removeRundownsFromDb([this.Rundown.doc._id])
			}

			super.assertNoChanges()
			span?.end()
		} else {
			await super.saveAllToDatabase()
		}
	}
}
