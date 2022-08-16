import { PlayoutChangedResults } from '@sofie-automation/shared-lib/dist/peripheralDevice/peripheralDeviceAPI'
import {
	AdLibActionId,
	PartId,
	PartInstanceId,
	PieceId,
	PieceInstanceId,
	RundownBaselineAdLibActionId,
	RundownId,
	RundownPlaylistId,
	SegmentId,
	StudioId,
} from '../dataModel/Ids'

/** List of all Jobs performed by the Worker related to a certain Studio */
export enum StudioJobs {
	UpdateTimeline = 'updateTimeline',
	UpdateTimelineAfterIngest = 'updateTimelineAfterIngest',

	AdlibPieceStart = 'adLibPieceStart',
	TakePieceAsAdlibNow = 'takePieceAsAdlibNow',
	StartStickyPieceOnSourceLayer = 'startStickyPieceOnSourceLayer',
	StopPiecesOnSourceLayers = 'stopPiecesOnSourceLayers',
	MoveNextPart = 'moveNextPart',
	ActivateHold = 'activateHold',
	DeactivateHold = 'deactivateHold',
	PrepareRundownForBroadcast = 'prepareRundownForBroadcast',
	ResetRundownPlaylist = 'resetRundownPlaylist',
	ActivateRundownPlaylist = 'activateRundownPlaylist',
	DeactivateRundownPlaylist = 'deactivateRundownPlaylist',
	SetNextPart = 'setNextPart',
	SetNextSegment = 'setNextSegment',
	ExecuteAction = 'executeAction',
	TakeNextPart = 'takeNextPart',
	DisableNextPiece = 'disableNextPiece',
	RemovePlaylist = 'removePlaylist',
	RegeneratePlaylist = 'regeneratePlaylist',

	OnPlayoutPlaybackChanged = 'onPlayoutPlaybackChanged',
	OnTimelineTriggerTime = 'onTimelineTriggerTime',

	UpdateStudioBaseline = 'updateStudioBaseline',
	CleanupEmptyPlaylists = 'cleanupEmptyPlaylists',

	OrderRestoreToDefault = 'orderRestoreToDefault',
	OrderMoveRundownToPlaylist = 'orderMoveRundownToPlaylist',

	DebugRegenerateNextPartInstance = 'debugRegenerateNextPartInstance',
	DebugSyncInfinitesForNextPartInstance = 'debugSyncInfinitesForNextPartInstance',

	GeneratePlaylistSnapshot = 'generatePlaylistSnapshot',
	RestorePlaylistSnapshot = 'restorePlaylistSnapshot',
	DebugCrash = 'debugCrash',
}

export interface RundownPlayoutPropsBase {
	playlistId: RundownPlaylistId
}
export type UpdateTimelineAfterIngestProps = RundownPlayoutPropsBase

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
export type PrepareRundownForBroadcastProps = RundownPlayoutPropsBase
export interface ResetRundownPlaylistProps extends RundownPlayoutPropsBase {
	activate?: 'active' | 'rehearsal'
	forceActivate?: boolean
}
export interface ActivateRundownPlaylistProps extends RundownPlayoutPropsBase {
	rehearsal: boolean
}
export type DeactivateRundownPlaylistProps = RundownPlayoutPropsBase
export interface SetNextPartProps extends RundownPlayoutPropsBase {
	nextPartId: PartId | null
	setManually?: boolean
	nextTimeOffset?: number
	clearNextSegment?: boolean
}
export interface SetNextSegmentProps extends RundownPlayoutPropsBase {
	nextSegmentId: SegmentId | null
}
export interface ExecuteActionProps extends RundownPlayoutPropsBase {
	actionDocId: AdLibActionId | RundownBaselineAdLibActionId
	actionId: string
	userData: any
	triggerMode?: string
}
export interface ExecuteActionResult {
	queuedPartInstanceId?: PartInstanceId
	taken?: boolean
}
export interface TakeNextPartProps extends RundownPlayoutPropsBase {
	fromPartInstanceId: PartInstanceId | null
}
export interface DisableNextPieceProps extends RundownPlayoutPropsBase {
	undo: boolean
}
export type RemovePlaylistProps = RundownPlayoutPropsBase
export type RegeneratePlaylistProps = RundownPlayoutPropsBase

export interface OnPlayoutPlaybackChangedProps extends RundownPlayoutPropsBase {
	changes: PlayoutChangedResults['changes']
}
export interface OnTimelineTriggerTimeProps {
	results: Array<{ id: string; time: number }>
}

export type OrderRestoreToDefaultProps = RundownPlayoutPropsBase
export interface OrderMoveRundownToPlaylistProps {
	/** The rundown to be moved */
	rundownId: RundownId
	/** Which playlist to move into. If null, move into a (new) separate playlist */
	intoPlaylistId: RundownPlaylistId | null
	/** The new rundowns in the new playlist */
	rundownsIdsInPlaylistInOrder: RundownId[]
}

export type DebugRegenerateNextPartInstanceProps = RundownPlayoutPropsBase
export type DebugSyncInfinitesForNextPartInstanceProps = RundownPlayoutPropsBase

export interface GeneratePlaylistSnapshotProps extends RundownPlayoutPropsBase {
	// Include all Instances, or just recent ones
	full: boolean
}
export interface GeneratePlaylistSnapshotResult {
	/**
	 * Stringified JSON of the snapshot
	 * Note: it is kept as a string to avoid needing to parse the very large blob unnecesarily
	 */
	snapshotJson: string
}
export interface RestorePlaylistSnapshotProps {
	/**
	 * Stringified JSON of the snapshot
	 * Note: it is kept as a string to avoid needing to parse the very large blob unnecesarily
	 */
	snapshotJson: string
}
export interface RestorePlaylistSnapshotResult {
	playlistId: RundownPlaylistId
}

/**
 * Set of valid functions, of form:
 * `id: (data) => return`
 */
export type StudioJobFunc = {
	[StudioJobs.UpdateTimeline]: () => void
	[StudioJobs.UpdateTimelineAfterIngest]: (data: UpdateTimelineAfterIngestProps) => void

	[StudioJobs.AdlibPieceStart]: (data: AdlibPieceStartProps) => void
	[StudioJobs.TakePieceAsAdlibNow]: (data: TakePieceAsAdlibNowProps) => void
	[StudioJobs.StartStickyPieceOnSourceLayer]: (data: StartStickyPieceOnSourceLayerProps) => void
	[StudioJobs.StopPiecesOnSourceLayers]: (data: StopPiecesOnSourceLayersProps) => void
	[StudioJobs.MoveNextPart]: (data: MoveNextPartProps) => PartId | null
	[StudioJobs.ActivateHold]: (data: ActivateHoldProps) => void
	[StudioJobs.DeactivateHold]: (data: DeactivateHoldProps) => void
	[StudioJobs.PrepareRundownForBroadcast]: (data: PrepareRundownForBroadcastProps) => void
	[StudioJobs.ResetRundownPlaylist]: (data: ResetRundownPlaylistProps) => void
	[StudioJobs.ActivateRundownPlaylist]: (data: ActivateRundownPlaylistProps) => void
	[StudioJobs.DeactivateRundownPlaylist]: (data: DeactivateRundownPlaylistProps) => void
	[StudioJobs.SetNextPart]: (data: SetNextPartProps) => void
	[StudioJobs.SetNextSegment]: (data: SetNextSegmentProps) => void
	[StudioJobs.ExecuteAction]: (data: ExecuteActionProps) => ExecuteActionResult
	[StudioJobs.TakeNextPart]: (data: TakeNextPartProps) => void
	[StudioJobs.DisableNextPiece]: (data: DisableNextPieceProps) => void
	[StudioJobs.RemovePlaylist]: (data: RemovePlaylistProps) => void
	[StudioJobs.RegeneratePlaylist]: (data: RegeneratePlaylistProps) => void

	[StudioJobs.OnPlayoutPlaybackChanged]: (data: OnPlayoutPlaybackChangedProps) => void
	[StudioJobs.OnTimelineTriggerTime]: (data: OnTimelineTriggerTimeProps) => void

	[StudioJobs.UpdateStudioBaseline]: () => string | false
	[StudioJobs.CleanupEmptyPlaylists]: () => void

	[StudioJobs.OrderRestoreToDefault]: (data: OrderRestoreToDefaultProps) => void
	[StudioJobs.OrderMoveRundownToPlaylist]: (data: OrderMoveRundownToPlaylistProps) => void

	[StudioJobs.DebugRegenerateNextPartInstance]: (data: DebugRegenerateNextPartInstanceProps) => void
	[StudioJobs.DebugSyncInfinitesForNextPartInstance]: (data: DebugSyncInfinitesForNextPartInstanceProps) => void

	[StudioJobs.GeneratePlaylistSnapshot]: (data: GeneratePlaylistSnapshotProps) => GeneratePlaylistSnapshotResult
	[StudioJobs.RestorePlaylistSnapshot]: (data: RestorePlaylistSnapshotProps) => RestorePlaylistSnapshotResult
	[StudioJobs.DebugCrash]: (data: DebugRegenerateNextPartInstanceProps) => void
}

export function getStudioQueueName(id: StudioId): string {
	return `studio:${id}`
}
