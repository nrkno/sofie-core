import { JobContext } from '../../jobs'
import { IntervalJobFunc } from '@sofie-automation/corelib/dist/worker/interval'
// import {
// 	handleNotifyCurrentlyPlayingPart,
// 	handlePartInstanceTimings,
// 	handleRundownDataHasChanged,
// } from '../../interval/handle'

type ExecutableFunction<T extends keyof IntervalJobFunc> = (
	context: JobContext,
	data: Parameters<IntervalJobFunc[T]>[0]
) => Promise<ReturnType<IntervalJobFunc[T]>>

export type IntervalJobHandlers = {
	[T in keyof IntervalJobFunc]: ExecutableFunction<T>
}

export const intervalJobHandlers: IntervalJobHandlers = {
	// [IntervalJobs.PartInstanceTimings]: handlePartInstanceTimings,
}
