import { ISettings } from '@sofie-automation/corelib/dist/settings'
import { IDirectCollections } from '../db'
import { JobContext, WorkerJob } from '../jobs'
import { ReadonlyDeep } from 'type-fest'
import { WorkerDataCache } from './caches'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { ShowStyleBaseId, ShowStyleVariantId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { IngestJobFunc } from '@sofie-automation/corelib/dist/worker/ingest'
import { loadShowStyleBlueprint, WrappedShowStyleBlueprint, WrappedStudioBlueprint } from '../blueprints/cache'
import { ReadonlyObjectDeep } from 'type-fest/source/readonly-deep'
import { ApmSpan, ApmTransaction } from '../profiler'
import { DBShowStyleBase, ShowStyleCompound } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { DBShowStyleVariant } from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant'
import { clone } from '@sofie-automation/corelib/dist/lib'
import { createShowStyleCompound } from '../showStyles'

export class JobContextBase implements JobContext {
	constructor(
		readonly directCollections: Readonly<IDirectCollections>,
		readonly settings: ReadonlyDeep<ISettings>,
		private readonly cacheData: WorkerDataCache,
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
}
