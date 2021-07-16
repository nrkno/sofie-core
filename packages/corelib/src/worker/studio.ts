import { PartInstanceId, PieceId, RundownPlaylistId, StudioId } from '../dataModel/Ids'

export enum StudioJobs {
	UpdateTimeline = 'updateTimeline',
	AdlibPieceStart = 'adLibPieceStart',
}

export interface RundownPlayoutPropsBase {
	playlistId: RundownPlaylistId
}
export interface AdlibPieceStartProps extends RundownPlayoutPropsBase {
	partInstanceId: PartInstanceId
	adLibPieceId: PieceId
	pieceType: 'baseline' | 'normal'
	queue?: boolean
}

/**
 * Set of valid functions, of form:
 * `id: [data, return]`
 */
export type StudioJobFunc = {
	[StudioJobs.UpdateTimeline]: () => void
	[StudioJobs.AdlibPieceStart]: (data: AdlibPieceStartProps) => void
}

export function getStudioQueueName(id: StudioId): string {
	return `studio:${id}`
}

// export type WrappedResult<T> = {
// 	startedExecution: number
// 	finishedExecution: number
// } & ({ error: string } | { result: T })
