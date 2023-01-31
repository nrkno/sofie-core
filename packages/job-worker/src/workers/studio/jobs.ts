import { JobContext } from '../../jobs'
import { adLibPieceStart, startStickyPieceOnSourceLayer, takePieceAsAdlibNow } from '../../playout/adlib'
import { StudioJobs, StudioJobFunc } from '@sofie-automation/corelib/dist/worker/studio'
import {
	activateHold,
	activateRundownPlaylist,
	deactivateHold,
	deactivateRundownPlaylist,
	disableNextPiece,
	executeAction,
	handleUpdateTimelineAfterIngest,
	moveNextPart,
	prepareRundownPlaylistForBroadcast,
	resetRundownPlaylist,
	handleSetNextPart,
	handleSetNextSegment,
	stopPiecesOnSourceLayers,
	takeNextPart,
	updateStudioBaseline,
} from '../../playout/playout'
import {
	handleDebugSyncPlayheadInfinitesForNextPartInstance,
	handleDebugRegenerateNextPartInstance,
	handleDebugCrash,
	handleDebugUpdateTimeline,
} from '../../playout/debug'
import { removeEmptyPlaylists } from '../../studio/cleanup'
import {
	handleRegenerateRundownPlaylist,
	handleRemoveRundownPlaylist,
	moveRundownIntoPlaylist,
	restoreRundownsInPlaylistToDefaultOrder,
} from '../../rundownPlaylists'
import { handleGeneratePlaylistSnapshot, handleRestorePlaylistSnapshot } from '../../playout/snapshot'
import { handleBlueprintUpgradeForStudio, handleBlueprintValidateConfigForStudio } from '../../playout/upgrade'
import { handleTimelineTriggerTime, onPlayoutPlaybackChanged } from '../../playout/timings'

type ExecutableFunction<T extends keyof StudioJobFunc> = (
	context: JobContext,
	data: Parameters<StudioJobFunc[T]>[0]
) => Promise<ReturnType<StudioJobFunc[T]>>

export type StudioJobHandlers = {
	[T in keyof StudioJobFunc]: ExecutableFunction<T>
}

export const studioJobHandlers: StudioJobHandlers = {
	[StudioJobs.UpdateTimeline]: handleDebugUpdateTimeline,
	[StudioJobs.UpdateTimelineAfterIngest]: handleUpdateTimelineAfterIngest,

	[StudioJobs.AdlibPieceStart]: adLibPieceStart,
	[StudioJobs.TakePieceAsAdlibNow]: takePieceAsAdlibNow,
	[StudioJobs.StartStickyPieceOnSourceLayer]: startStickyPieceOnSourceLayer,
	[StudioJobs.StopPiecesOnSourceLayers]: stopPiecesOnSourceLayers,
	[StudioJobs.MoveNextPart]: moveNextPart,
	[StudioJobs.ActivateHold]: activateHold,
	[StudioJobs.DeactivateHold]: deactivateHold,
	[StudioJobs.PrepareRundownForBroadcast]: prepareRundownPlaylistForBroadcast,
	[StudioJobs.ResetRundownPlaylist]: resetRundownPlaylist,
	[StudioJobs.ActivateRundownPlaylist]: activateRundownPlaylist,
	[StudioJobs.DeactivateRundownPlaylist]: deactivateRundownPlaylist,
	[StudioJobs.SetNextPart]: handleSetNextPart,
	[StudioJobs.SetNextSegment]: handleSetNextSegment,
	[StudioJobs.ExecuteAction]: executeAction,
	[StudioJobs.TakeNextPart]: takeNextPart,
	[StudioJobs.DisableNextPiece]: disableNextPiece,
	[StudioJobs.RemovePlaylist]: handleRemoveRundownPlaylist,
	[StudioJobs.RegeneratePlaylist]: handleRegenerateRundownPlaylist,

	[StudioJobs.OnPlayoutPlaybackChanged]: onPlayoutPlaybackChanged,
	[StudioJobs.OnTimelineTriggerTime]: handleTimelineTriggerTime,

	[StudioJobs.UpdateStudioBaseline]: updateStudioBaseline,
	[StudioJobs.CleanupEmptyPlaylists]: removeEmptyPlaylists,

	[StudioJobs.OrderRestoreToDefault]: restoreRundownsInPlaylistToDefaultOrder,
	[StudioJobs.OrderMoveRundownToPlaylist]: moveRundownIntoPlaylist,

	[StudioJobs.DebugSyncInfinitesForNextPartInstance]: handleDebugSyncPlayheadInfinitesForNextPartInstance,
	[StudioJobs.DebugRegenerateNextPartInstance]: handleDebugRegenerateNextPartInstance,

	[StudioJobs.GeneratePlaylistSnapshot]: handleGeneratePlaylistSnapshot,
	[StudioJobs.RestorePlaylistSnapshot]: handleRestorePlaylistSnapshot,
	[StudioJobs.DebugCrash]: handleDebugCrash,

	[StudioJobs.BlueprintUpgradeForStudio]: handleBlueprintUpgradeForStudio,
	[StudioJobs.BlueprintValidateConfigForStudio]: handleBlueprintValidateConfigForStudio,
}
