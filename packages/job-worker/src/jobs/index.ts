import { IDirectCollections } from '../db'
import { ReadonlyDeep } from 'type-fest'
import { WrappedStudioBlueprint } from '../blueprints/cache'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ISettings } from '@sofie-automation/corelib/dist/settings'
import { ApmSpan } from '../profiler'
import { IngestJobFunc } from '@sofie-automation/corelib/dist/worker/ingest'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'

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

	// TODO - should this be here?
	readonly studioBlueprint: ReadonlyDeep<WrappedStudioBlueprint>

	startSpan(name: string): ApmSpan

	queueIngestJob<T extends keyof IngestJobFunc>(
		name: T,
		data: Parameters<IngestJobFunc[T]>[0]
	): Promise<WorkerJob<ReturnType<IngestJobFunc[T]>>> // TODO - this return type isnt the best..
}
