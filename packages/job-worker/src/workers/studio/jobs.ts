import { runJobWithPlayoutCache } from '../../playout/lock'
import { updateTimeline, updateStudioTimeline } from '../../playout/timeline'
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
	handleTimelineTriggerTime,
	handleUpdateTimelineAfterIngest,
	moveNextPart,
	onPartPlaybackStarted,
	onPartPlaybackStopped,
	onPiecePlaybackStarted,
	onPiecePlaybackStopped,
	prepareRundownPlaylistForBroadcast,
	resetRundownPlaylist,
	setNextPart,
	setNextSegment,
	stopPiecesOnSourceLayers,
	takeNextPart,
	updateStudioBaseline,
} from '../../playout/playout'
import { runJobWithStudioCache } from '../../studio/lock'
import {
	handleDebugSyncPlayheadInfinitesForNextPartInstance,
	handleDebugRegenerateNextPartInstance,
	handleDebugCrash,
} from '../../playout/debug'
import { removeEmptyPlaylists } from '../../studio/cleanup'
import {
	handleRegenerateRundownPlaylist,
	handleRemoveRundownPlaylist,
	moveRundownIntoPlaylist,
	restoreRundownsInPlaylistToDefaultOrder,
} from '../../rundownPlaylists'

type ExecutableFunction<T extends keyof StudioJobFunc> = (
	context: JobContext,
	data: Parameters<StudioJobFunc[T]>[0]
) => Promise<ReturnType<StudioJobFunc[T]>>

export type StudioJobHandlers = {
	[T in keyof StudioJobFunc]: ExecutableFunction<T>
}

export const studioJobHandlers: StudioJobHandlers = {
	[StudioJobs.UpdateTimeline]: updateTimelineDebug,
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
	[StudioJobs.SetNextPart]: setNextPart,
	[StudioJobs.SetNextSegment]: setNextSegment,
	[StudioJobs.ExecuteAction]: executeAction,
	[StudioJobs.TakeNextPart]: takeNextPart,
	[StudioJobs.DisableNextPiece]: disableNextPiece,
	[StudioJobs.RemovePlaylist]: handleRemoveRundownPlaylist,
	[StudioJobs.RegeneratePlaylist]: handleRegenerateRundownPlaylist,

	[StudioJobs.OnPiecePlaybackStarted]: onPiecePlaybackStarted,
	[StudioJobs.OnPiecePlaybackStopped]: onPiecePlaybackStopped,
	[StudioJobs.OnPartPlaybackStarted]: onPartPlaybackStarted,
	[StudioJobs.OnPartPlaybackStopped]: onPartPlaybackStopped,
	[StudioJobs.OnTimelineTriggerTime]: handleTimelineTriggerTime,

	[StudioJobs.UpdateStudioBaseline]: updateStudioBaseline,
	[StudioJobs.CleanupEmptyPlaylists]: removeEmptyPlaylists,

	[StudioJobs.OrderRestoreToDefault]: restoreRundownsInPlaylistToDefaultOrder,
	[StudioJobs.OrderMoveRundownToPlaylist]: moveRundownIntoPlaylist,

	[StudioJobs.DebugSyncInfinitesForNextPartInstance]: handleDebugSyncPlayheadInfinitesForNextPartInstance,
	[StudioJobs.DebugRegenerateNextPartInstance]: handleDebugRegenerateNextPartInstance,
	[StudioJobs.DebugCrash]: handleDebugCrash,
}

async function updateTimelineDebug(context: JobContext, _data: void): Promise<void> {
	await runJobWithStudioCache(context, async (studioCache) => {
		const activePlaylists = studioCache.getActiveRundownPlaylists()
		if (activePlaylists.length > 1) {
			throw new Error(`Too many active playlists`)
		} else if (activePlaylists.length > 0) {
			const playlist = activePlaylists[0]

			await runJobWithPlayoutCache(context, { playlistId: playlist._id }, null, async (playoutCache) => {
				await updateTimeline(context, playoutCache)
			})
		} else {
			await updateStudioTimeline(context, studioCache)
			await studioCache.saveAllToDatabase()
		}
	})
}
