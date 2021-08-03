import { JobContext } from '../../jobs'
import { IngestJobs, IngestJobFunc } from '@sofie-automation/corelib/dist/worker/ingest'
import { handleMosDeleteStory, handleMosFullStory } from '../../ingest/mosDevice/ingest'

type ExecutableFunction<T extends keyof IngestJobFunc> = (
	context: JobContext,
	data: Parameters<IngestJobFunc[T]>[0]
) => Promise<ReturnType<IngestJobFunc[T]>>

export type IngestJobHandlers = {
	[T in keyof IngestJobFunc]: ExecutableFunction<T>
}

export const ingestJobHandlers: IngestJobHandlers = {
	[IngestJobs.MosFullStory]: handleMosFullStory,
	[IngestJobs.MosDeleteStory]: handleMosDeleteStory,
}
