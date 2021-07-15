import { PartInstanceId, PieceId, RundownPlaylistId, StudioId } from '../dataModel/Ids'

export enum StudioJobs {
	UpdateTimeline = 'updateTimeline',
	RundownBaselineAdlibStart = 'rundownBaselineAdLibPieceStart',
}

export interface RundownPlayoutPropsBase {
	playlistId: RundownPlaylistId
}
export interface RundownBaselineAdlibStartProps extends RundownPlayoutPropsBase {
	partInstanceId: PartInstanceId
	baselineAdLibPieceId: PieceId
	queue?: boolean
}

/**
 * Set of valid functions, of form:
 * `id: [data, return]`
 */
export type StudioJobFunc = {
	[StudioJobs.UpdateTimeline]: () => void
	[StudioJobs.RundownBaselineAdlibStart]: (data: RundownBaselineAdlibStartProps) => void
}

export function getStudioQueueName(id: StudioId): string {
	return `studio:${id}`
}

// export type WrappedResult<T> = {
// 	startedExecution: number
// 	finishedExecution: number
// } & ({ error: string } | { result: T })
