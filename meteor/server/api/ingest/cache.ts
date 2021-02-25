import { AdLibAction, AdLibActions } from '../../../lib/collections/AdLibActions'
import { AdLibPiece, AdLibPieces } from '../../../lib/collections/AdLibPieces'
import { ExpectedMediaItem, ExpectedMediaItems } from '../../../lib/collections/ExpectedMediaItems'
import { ExpectedPlayoutItem, ExpectedPlayoutItems } from '../../../lib/collections/ExpectedPlayoutItems'
import { Part, DBPart, Parts } from '../../../lib/collections/Parts'
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
import { Rundown, DBRundown, Rundowns } from '../../../lib/collections/Rundowns'
import { Segment, DBSegment, Segments } from '../../../lib/collections/Segments'
import { Studio, Studios, StudioId } from '../../../lib/collections/Studios'
import { protectString, makePromise } from '../../../lib/lib'
import { DbCacheWriteCollection } from '../../cache/CacheCollection'
import { DbCacheReadObject, DbCacheWriteOptionalObject } from '../../cache/CacheObject'
import { CacheBase } from '../../cache/CacheBase'
import { profiler } from '../profiler'
import { removeRundownsFromDb } from '../rundownPlaylist'
import { getRundownId } from './lib'

export class CacheForIngest extends CacheBase<CacheForIngest> {
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

	public get RundownId() {
		return this.Rundown.doc?._id ?? getRundownId(this.Studio.doc, this.RundownExternalId)
	}

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
		await Promise.allSettled([
			this.RundownBaselineObjs._initialize(),
			this.RundownBaselineAdLibPieces._initialize(),
			this.RundownBaselineAdLibActions._initialize(),
		])
	}

	removeRundown() {
		this.toBeRemoved = true

		super.markCollectionsForRemoval()
	}

	discardChanges() {
		this.toBeRemoved = false
		super.discardChanges()

		this.assertNoChanges()
	}

	async saveAllToDatabase() {
		if (this.toBeRemoved) {
			const span = profiler.startSpan('CacheForIngest.saveAllToDatabase')
			this._abortActiveTimeout()

			// TODO-CACHE - run any of the defers?

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
