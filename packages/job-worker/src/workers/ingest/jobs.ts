import { JobContext } from '../../jobs'
import { IngestJobs, IngestJobFunc } from '@sofie-automation/corelib/dist/worker/ingest'
import {
	handleMosDeleteStory,
	handleMosFullStory,
	handleMosInsertStories,
	handleMosMoveStories,
	handleMosRundownData,
	handleMosRundownMetadata,
	handleMosSwapStories,
} from '../../ingest/mosDevice/ingest'
import {
	handleRegenerateRundown,
	handleRegenerateSegment,
	handleRemovedPart,
	handleRemovedRundown,
	handleRemovedSegment,
	handleUpdatedPart,
	handleUpdatedRundown,
	handleUpdatedSegment,
	handleUpdatedSegmentRanks,
} from '../../ingest/rundownInput'
import { handleUpdatedPackageInfoForRundown } from 'src/ingest/packageInfo'

type ExecutableFunction<T extends keyof IngestJobFunc> = (
	context: JobContext,
	data: Parameters<IngestJobFunc[T]>[0]
) => Promise<ReturnType<IngestJobFunc[T]>>

export type IngestJobHandlers = {
	[T in keyof IngestJobFunc]: ExecutableFunction<T>
}

export const ingestJobHandlers: IngestJobHandlers = {
	[IngestJobs.RemoveRundown]: handleRemovedRundown,
	[IngestJobs.UpdateRundown]: handleUpdatedRundown,
	[IngestJobs.RemoveSegment]: handleRemovedSegment,
	[IngestJobs.UpdateSegment]: handleUpdatedSegment,
	[IngestJobs.UpdateSegmentRanks]: handleUpdatedSegmentRanks,
	[IngestJobs.RemovePart]: handleRemovedPart,
	[IngestJobs.UpdatePart]: handleUpdatedPart,
	[IngestJobs.RegenerateRundown]: handleRegenerateRundown,
	[IngestJobs.RegenerateSegment]: handleRegenerateSegment,

	[IngestJobs.MosRundown]: handleMosRundownData,
	[IngestJobs.MosRundownMetadata]: handleMosRundownMetadata,
	[IngestJobs.MosFullStory]: handleMosFullStory,
	[IngestJobs.MosDeleteStory]: handleMosDeleteStory,
	[IngestJobs.MosInsertStory]: handleMosInsertStories,
	[IngestJobs.MosMoveStory]: handleMosMoveStories,
	[IngestJobs.MosSwapStory]: handleMosSwapStories,

	[IngestJobs.UpdatedPackageInfos]: handleUpdatedPackageInfoForRundown,
}
