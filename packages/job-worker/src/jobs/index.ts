import { IDirectCollections } from '../db'
import { ReadonlyDeep } from 'type-fest'
import { WrappedShowStyleBlueprint, WrappedStudioBlueprint } from '../blueprints/cache'
import {
	RundownId,
	RundownPlaylistId,
	ShowStyleBaseId,
	ShowStyleVariantId,
	StudioId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ApmSpan } from '../profiler'
import { IngestJobFunc } from '@sofie-automation/corelib/dist/worker/ingest'
import { EventsJobFunc } from '@sofie-automation/corelib/dist/worker/events'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { ProcessedShowStyleConfig, ProcessedStudioConfig } from '../blueprints/config'
import { StudioJobFunc } from '@sofie-automation/corelib/dist/worker/studio'
import { PlaylistLock, RundownLock } from './lock'
import { ReadOnlyCacheBase } from '../cache/CacheBase'
import { TimelineComplete } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { ProcessedShowStyleBase, ProcessedShowStyleVariant, ProcessedShowStyleCompound } from './showStyle'

export { ApmSpan }
export { ProcessedShowStyleVariant, ProcessedShowStyleBase, ProcessedShowStyleCompound }

export interface WorkerJob<TRes> {
	/** Promise returning the result. Resolved upon completion of the job */
	complete: Promise<TRes>
}

export interface JobContext extends StudioCacheContext {
	/** Internal: Track a cache, to check it was saved at the end of the job */
	trackCache(cache: ReadOnlyCacheBase<any>): void

	/** Aquire the CacheForPlayout/write lock for a Playlist */
	lockPlaylist(playlistId: RundownPlaylistId): Promise<PlaylistLock>
	/** Aquire the CacheForIngest/write lock for a Rundown */
	lockRundown(rundownId: RundownId): Promise<RundownLock>

	/** Start an APM span, if there is an active APM transaction */
	startSpan(name: string): ApmSpan | null

	queueIngestJob<T extends keyof IngestJobFunc>(name: T, data: Parameters<IngestJobFunc[T]>[0]): Promise<void>
	queueStudioJob<T extends keyof StudioJobFunc>(name: T, data: Parameters<StudioJobFunc[T]>[0]): Promise<void>
	queueEventJob<T extends keyof EventsJobFunc>(name: T, data: Parameters<EventsJobFunc[T]>[0]): Promise<void>

	/** Hack: fast-track the timeline out to the playout-gateway. */
	hackPublishTimelineToFastTrack(newTimeline: TimelineComplete): void
}

export interface StudioCacheContext {
	readonly directCollections: Readonly<IDirectCollections>

	readonly studioId: StudioId
	readonly studio: ReadonlyDeep<DBStudio>

	readonly studioBlueprint: ReadonlyDeep<WrappedStudioBlueprint>

	getStudioBlueprintConfig(): ProcessedStudioConfig

	getShowStyleBases(): Promise<ReadonlyDeep<Array<ProcessedShowStyleBase>>>
	getShowStyleBase(id: ShowStyleBaseId): Promise<ReadonlyDeep<ProcessedShowStyleBase>>
	getShowStyleVariants(id: ShowStyleBaseId): Promise<ReadonlyDeep<Array<ProcessedShowStyleVariant>>>
	getShowStyleVariant(id: ShowStyleVariantId): Promise<ReadonlyDeep<ProcessedShowStyleVariant>>
	getShowStyleCompound(
		variantId: ShowStyleVariantId,
		baseId?: ShowStyleBaseId
	): Promise<ReadonlyDeep<ProcessedShowStyleCompound>>

	getShowStyleBlueprint(id: ShowStyleBaseId): Promise<ReadonlyDeep<WrappedShowStyleBlueprint>>
	getShowStyleBlueprintConfig(showStyle: ReadonlyDeep<ProcessedShowStyleCompound>): ProcessedShowStyleConfig
}
