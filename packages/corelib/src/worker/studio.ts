import { PartId, PartInstanceId, PieceId, PieceInstanceId, RundownPlaylistId, StudioId } from '../dataModel/Ids'

export enum StudioJobs {
	UpdateTimeline = 'updateTimeline',
	AdlibPieceStart = 'adLibPieceStart',
	TakePieceAsAdlibNow = 'takePieceAsAdlibNow',
	StartStickyPieceOnSourceLayer = 'startStickyPieceOnSourceLayer',
	StopPiecesOnSourceLayers = 'stopPiecesOnSourceLayers',
	MoveNextPart = 'moveNextPart',
	ActivateHold = 'activateHold',
	DeactivateHold = 'deactivateHold',
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
export interface StopPiecesOnSourceLayersProps extends RundownPlayoutPropsBase {
	partInstanceId: PartInstanceId
	sourceLayerIds: string[]
}
export interface MoveNextPartProps extends RundownPlayoutPropsBase {
	partDelta: number
	segmentDelta: number
}
export type ActivateHoldProps = RundownPlayoutPropsBase
export type DeactivateHoldProps = RundownPlayoutPropsBase

/**
 * Set of valid functions, of form:
 * `id: [data, return]`
 */
export type StudioJobFunc = {
	[StudioJobs.UpdateTimeline]: () => void
	[StudioJobs.AdlibPieceStart]: (data: AdlibPieceStartProps) => void
	[StudioJobs.TakePieceAsAdlibNow]: (data: TakePieceAsAdlibNowProps) => void
	[StudioJobs.StartStickyPieceOnSourceLayer]: (data: StartStickyPieceOnSourceLayerProps) => void
	[StudioJobs.StopPiecesOnSourceLayers]: (data: StopPiecesOnSourceLayersProps) => void
	[StudioJobs.MoveNextPart]: (data: MoveNextPartProps) => PartId | null
	[StudioJobs.ActivateHold]: (data: ActivateHoldProps) => void
	[StudioJobs.DeactivateHold]: (data: DeactivateHoldProps) => void
}

export function getStudioQueueName(id: StudioId): string {
	return `studio:${id}`
}

// export type WrappedResult<T> = {
// 	startedExecution: number
// 	finishedExecution: number
// } & ({ error: string } | { result: T })
