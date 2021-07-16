import { PartInstanceId, PieceId, PieceInstanceId, RundownPlaylistId, StudioId } from '../dataModel/Ids'

export enum StudioJobs {
	UpdateTimeline = 'updateTimeline',
	AdlibPieceStart = 'adLibPieceStart',
	TakePieceAsAdlibNow = 'takePieceAsAdlibNow',
	StartStickyPieceOnSourceLayer = 'startStickyPieceOnSourceLayer',
}

export interface RundownPlayoutPropsBase {
	playlistId: RundownPlaylistId
}
export interface AdlibPieceStartProps extends RundownPlayoutPropsBase {
	partInstanceId: PartInstanceId
	adLibPieceId: PieceId
	pieceType: 'baseline' | 'normal' | 'bucket'
	queue?: boolean
}
export interface TakePieceAsAdlibNowProps extends RundownPlayoutPropsBase {
	partInstanceId: PartInstanceId
	pieceInstanceIdOrPieceIdToCopy: PieceInstanceId | PieceId
}
export interface StartStickyPieceOnSourceLayerProps extends RundownPlayoutPropsBase {
	sourceLayerId: string
}

/**
 * Set of valid functions, of form:
 * `id: [data, return]`
 */
export type StudioJobFunc = {
	[StudioJobs.UpdateTimeline]: () => void
	[StudioJobs.AdlibPieceStart]: (data: AdlibPieceStartProps) => void
	[StudioJobs.TakePieceAsAdlibNow]: (data: TakePieceAsAdlibNowProps) => void
	[StudioJobs.StartStickyPieceOnSourceLayer]: (data: StartStickyPieceOnSourceLayerProps) => void
}

export function getStudioQueueName(id: StudioId): string {
	return `studio:${id}`
}

// export type WrappedResult<T> = {
// 	startedExecution: number
// 	finishedExecution: number
// } & ({ error: string } | { result: T })
