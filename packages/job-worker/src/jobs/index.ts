import { IDirectCollections } from '../db'
import { ReadonlyDeep } from 'type-fest'
import { WrappedShowStyleBlueprint, WrappedStudioBlueprint } from '../blueprints/cache'
import { ShowStyleBaseId, ShowStyleVariantId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ISettings } from '@sofie-automation/corelib/dist/settings'
import { ApmSpan } from '../profiler'
import { IngestJobFunc } from '@sofie-automation/corelib/dist/worker/ingest'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { DBShowStyleBase, ShowStyleCompound } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { DBShowStyleVariant } from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant'
import { ProcessedShowStyleConfig, ProcessedStudioConfig } from '../blueprints/config'
import { StudioJobFunc } from '@sofie-automation/corelib/dist/worker/studio'

export { ApmSpan }

export interface WorkerJob<TRes> {
	/** Promise returning the result. Resolved upon completion of the job */
	complete: Promise<TRes>
}

export interface JobContext {
	readonly directCollections: Readonly<IDirectCollections>

	readonly settings: ReadonlyDeep<ISettings>

	readonly studioId: StudioId
	readonly studio: ReadonlyDeep<DBStudio>

	readonly studioBlueprint: ReadonlyDeep<WrappedStudioBlueprint>

	startSpan(name: string): ApmSpan

	queueIngestJob<T extends keyof IngestJobFunc>(
		name: T,
		data: Parameters<IngestJobFunc[T]>[0]
	): Promise<WorkerJob<ReturnType<IngestJobFunc[T]>>> // TODO - this return type isnt the best..
	queueStudioJob<T extends keyof StudioJobFunc>(
		name: T,
		data: Parameters<StudioJobFunc[T]>[0]
	): Promise<WorkerJob<ReturnType<StudioJobFunc[T]>>> // TODO - this return type isnt the best..

	getStudioBlueprintConfig(): ProcessedStudioConfig

	getShowStyleBase(id: ShowStyleBaseId): Promise<DBShowStyleBase>
	getShowStyleVariant(id: ShowStyleVariantId): Promise<DBShowStyleVariant>
	getShowStyleCompound(variantId: ShowStyleVariantId, baseId?: ShowStyleBaseId): Promise<ShowStyleCompound>

	getShowStyleBlueprint(id: ShowStyleBaseId): Promise<WrappedShowStyleBlueprint>
	getShowStyleBlueprintConfig(showStyle: ReadonlyDeep<ShowStyleCompound>): ProcessedShowStyleConfig
}
