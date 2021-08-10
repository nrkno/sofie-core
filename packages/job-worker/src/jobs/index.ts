import { IDirectCollections } from '../db'
import { ReadonlyDeep } from 'type-fest'
import { WrappedShowStyleBlueprint, WrappedStudioBlueprint } from '../blueprints/cache'
import {
	RundownPlaylistId,
	ShowStyleBaseId,
	ShowStyleVariantId,
	StudioId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ISettings } from '@sofie-automation/corelib/dist/settings'
import { ApmSpan } from '../profiler'
import { IngestJobFunc } from '@sofie-automation/corelib/dist/worker/ingest'
import { EventsJobFunc } from '@sofie-automation/corelib/dist/worker/events'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { DBShowStyleBase, ShowStyleCompound } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { DBShowStyleVariant } from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant'
import { ProcessedShowStyleConfig, ProcessedStudioConfig } from '../blueprints/config'
import { StudioJobFunc } from '@sofie-automation/corelib/dist/worker/studio'
import { PlaylistLock } from './lock'
import { ReadOnlyCacheBase } from '../cache/CacheBase'

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

	/** Internal: Track a cache, to check it was saved at the end of the job */
	trackCache(cache: ReadOnlyCacheBase<any>): void

	/** Aquire the read/write lock for a Playlist */
	lockPlaylist(playlistId: RundownPlaylistId): Promise<PlaylistLock>

	/** Start an APM span, if there is an active APM transaction */
	startSpan(name: string): ApmSpan | null

	queueIngestJob<T extends keyof IngestJobFunc>(name: T, data: Parameters<IngestJobFunc[T]>[0]): Promise<void>
	queueStudioJob<T extends keyof StudioJobFunc>(name: T, data: Parameters<StudioJobFunc[T]>[0]): Promise<void>
	queueEventJob<T extends keyof EventsJobFunc>(name: T, data: Parameters<EventsJobFunc[T]>[0]): Promise<void>

	getStudioBlueprintConfig(): ProcessedStudioConfig

	getShowStyleBase(id: ShowStyleBaseId): Promise<DBShowStyleBase>
	getShowStyleVariant(id: ShowStyleVariantId): Promise<DBShowStyleVariant>
	getShowStyleCompound(variantId: ShowStyleVariantId, baseId?: ShowStyleBaseId): Promise<ShowStyleCompound>

	getShowStyleBlueprint(id: ShowStyleBaseId): Promise<WrappedShowStyleBlueprint>
	getShowStyleBlueprintConfig(showStyle: ReadonlyDeep<ShowStyleCompound>): ProcessedShowStyleConfig
}
