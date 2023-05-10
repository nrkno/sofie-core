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
import { JSONBlob } from '@sofie-automation/shared-lib/dist/lib/JSONBlob'
import { CoreRundownPlaylistSnapshot } from '../snapshots'
import { NoteSeverity } from '@sofie-automation/blueprints-integration'
import { ITranslatableMessage } from '../TranslatableMessage'

/** List of all Jobs performed by the Worker related to a certain Studio */
export enum StudioJobs {
	/**
	 * Debug: Regenerate the timeline for the Studio
	 */
	UpdateTimeline = 'updateTimeline',
	/**
	 * Regenerate the timeline for the specified Playlist in the Studio
	 * Has no effect if specified Playlist is not active
	 */
	UpdateTimelineAfterIngest = 'updateTimelineAfterIngest',

	/**
	 * Play an AdLib piece by its id
	 */
	AdlibPieceStart = 'adLibPieceStart',
	/**
	 * Play an existing Piece in the Rundown as an AdLib
	 */
	TakePieceAsAdlibNow = 'takePieceAsAdlibNow',
	/**
	 * Find and play a sticky Piece on a SourceLayer
	 */
	StartStickyPieceOnSourceLayer = 'startStickyPieceOnSourceLayer',
	/**
	 * Stop any playing Pieces on some SourceLayers
	 */
	StopPiecesOnSourceLayers = 'stopPiecesOnSourceLayers',
	/**
	 * Activate Hold
	 */
	ActivateHold = 'activateHold',
	/**
	 * Deactivate Hold
	 */
	DeactivateHold = 'deactivateHold',
	/**
	 * Prepare the rundown for transmission
	 * To be triggered well before the broadcast, since it may take time and cause outputs to flicker
	 */
	PrepareRundownForBroadcast = 'prepareRundownForBroadcast',
	/**
	 * Reset the rundown.
	 * Optionally activate the rundown at the end.
	 */
	ResetRundownPlaylist = 'resetRundownPlaylist',
	/**
	 * Only activate the rundown, don't reset anything
	 */
	ActivateRundownPlaylist = 'activateRundownPlaylist',
	/**
	 * Deactivate the rundown
	 */
	DeactivateRundownPlaylist = 'deactivateRundownPlaylist',
	/**
	 * Set the nexted Part to a specified id
	 */
	SetNextPart = 'setNextPart',
	/**
	 * Set the next Segment to a specified id
	 */
	SetNextSegment = 'setNextSegment',
	/**
	 * Move which Part is nexted by a Part(horizontal) or Segment (vertical) delta
	 */
	MoveNextPart = 'moveNextPart',
	/**
	 * Execute an AdLib Action
	 */
	ExecuteAction = 'executeAction',
	/**
	 * Take the currently Next:ed Part (start playing it)
	 */
	TakeNextPart = 'takeNextPart',
	/**
	 * Disable the next Piece which allows being disabled
	 */
	DisableNextPiece = 'disableNextPiece',
	/**
	 * Debug: Remove a Playlist and all its contents
	 */
	RemovePlaylist = 'removePlaylist',
	/**
	 * Run the cached data through blueprints in order to re-generate the Rundown
	 */
	RegeneratePlaylist = 'regeneratePlaylist',

	/**
	 * Called by playout-gateway when playback timings of any Parts or Pieces on the timeline have changed
	 */
	OnPlayoutPlaybackChanged = 'onPlayoutPlaybackChanged',
	/**
	 * Called from Playout-gateway when the trigger-time of a timeline object has updated
	 * ( typically when using the "now"-feature )
	 */
	OnTimelineTriggerTime = 'onTimelineTriggerTime',

	/**
	 * Update the timeline with a regenerated Studio Baseline
	 * Has no effect if a Playlist is active
	 */
	UpdateStudioBaseline = 'updateStudioBaseline',
	/**
	 * Cleanup any RundownPlaylists that contain no Rundowns
	 */
	CleanupEmptyPlaylists = 'cleanupEmptyPlaylists',

	/**
	 * Restore the order of rundowns in a playlist, giving control over the ordering back to the NRCS
	 */
	OrderRestoreToDefault = 'orderRestoreToDefault',
	/**
	 * Move a rundown manually into a specific Playlist (by a user in Sofie)
	 */
	OrderMoveRundownToPlaylist = 'orderMoveRundownToPlaylist',

	/**
	 * Debug: Regenerate the nexted-partinstance from its part.
	 */
	DebugRegenerateNextPartInstance = 'debugRegenerateNextPartInstance',
	/**
	 * Debug: Ensure that the infinite pieces on the nexted-part are correct
	 */
	DebugSyncInfinitesForNextPartInstance = 'debugSyncInfinitesForNextPartInstance',
	/**
	 * Debug: Force the worker to throw an error
	 */
	DebugCrash = 'debugCrash',

	/**
	 * Generate the Playlist owned portions of a Playlist snapshot
	 */
	GeneratePlaylistSnapshot = 'generatePlaylistSnapshot',
	/**
	 * Restore the Playlist owned portions of a Playlist snapshot
	 */
	RestorePlaylistSnapshot = 'restorePlaylistSnapshot',

	/**
	 * Run the Blueprint applyConfig for the studio
	 */
	BlueprintUpgradeForStudio = 'blueprintUpgradeForStudio',
	/**
	 * Validate the blueprintConfig for the Studio, with the Blueprint validateConfig
	 */
	BlueprintValidateConfigForStudio = 'blueprintValidateConfigForStudio',
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
	actionDocId: AdLibActionId | RundownBaselineAdLibActionId | null
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
	snapshotJson: JSONBlob<CoreRundownPlaylistSnapshot>
}
export interface RestorePlaylistSnapshotProps {
	/**
	 * Stringified JSON of the snapshot
	 * Note: it is kept as a string to avoid needing to parse the very large blob unnecesarily
	 */
	snapshotJson: JSONBlob<CoreRundownPlaylistSnapshot>
}
export interface RestorePlaylistSnapshotResult {
	playlistId: RundownPlaylistId
}

export interface BlueprintValidateConfigForStudioResult {
	messages: Array<{
		level: NoteSeverity
		message: ITranslatableMessage
	}>
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

	[StudioJobs.BlueprintUpgradeForStudio]: () => void
	[StudioJobs.BlueprintValidateConfigForStudio]: () => BlueprintValidateConfigForStudioResult
}

export function getStudioQueueName(id: StudioId): string {
	return `studio:${id}`
}
