import { JobContext } from '.'
import { IngestJobs, IngestJobFunc } from '@sofie-automation/corelib/dist/worker/ingest'

type ExecutableFunction<T extends keyof IngestJobFunc> = (
	context: JobContext,
	data: Parameters<IngestJobFunc[T]>[0]
) => Promise<ReturnType<IngestJobFunc[T]>>

export type IngestJobHandlers = {
	[T in keyof IngestJobFunc]: ExecutableFunction<T>
}

export const ingestJobHandlers: IngestJobHandlers = {
	[IngestJobs.MosFullStory]: mosFullStory,
}

async function mosFullStory(_data: unknown): Promise<void> {
	// TODO
}
