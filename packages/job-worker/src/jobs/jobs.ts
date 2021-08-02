import { CacheForPlayout } from '../playout/cache'
import { updateTimeline, updateStudioTimeline } from '../playout/timeline'
import { CacheForStudio } from '../studio/cache'
import { JobContext } from '.'
import { adLibPieceStart, startStickyPieceOnSourceLayer, takePieceAsAdlibNow } from '../playout/adlib'
import { StudioJobs, StudioJobFunc } from '@sofie-automation/corelib/dist/worker/studio'
import { lockPlaylist } from './lock'
import {
	activateHold,
	activateRundownPlaylist,
	deactivateHold,
	deactivateRundownPlaylist,
	executeAction,
	moveNextPart,
	onPartPlaybackStarted,
	onPartPlaybackStopped,
	onPiecePlaybackStarted,
	onPiecePlaybackStopped,
	prepareRundownPlaylistForBroadcast,
	resetRundownPlaylist,
	setNextPart,
	stopPiecesOnSourceLayers,
	takeNextPart,
} from '../playout/playout'

type ExecutableFunction<T extends keyof StudioJobFunc> = (
	context: JobContext,
	data: Parameters<StudioJobFunc[T]>[0]
) => Promise<ReturnType<StudioJobFunc[T]>>

export type StudioJobHandlers = {
	[T in keyof StudioJobFunc]: ExecutableFunction<T>
}

export const studioJobHandlers: StudioJobHandlers = {
	[StudioJobs.UpdateTimeline]: updateTimelineDebug,
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
	[StudioJobs.ExecuteAction]: executeAction,
	[StudioJobs.TakeNextPart]: takeNextPart,
	[StudioJobs.OnPiecePlaybackStarted]: onPiecePlaybackStarted,
	[StudioJobs.OnPiecePlaybackStopped]: onPiecePlaybackStopped,
	[StudioJobs.OnPartPlaybackStarted]: onPartPlaybackStarted,
	[StudioJobs.OnPartPlaybackStopped]: onPartPlaybackStopped,
}

async function updateTimelineDebug(context: JobContext, _data: void): Promise<void> {
	console.log('running updateTimelineDebug')
	const studioCache = await CacheForStudio.create(context, context.studioId)

	const activePlaylists = studioCache.getActiveRundownPlaylists()
	if (activePlaylists.length > 1) {
		throw new Error(`Too many active playlists`)
	} else if (activePlaylists.length > 0) {
		studioCache._abortActiveTimeout() // no changes have been made or should be kept

		const playlist = activePlaylists[0]
		console.log('for playlist', playlist._id)

		const playlistLock = await lockPlaylist(context, playlist._id)
		try {
			const initCache = await CacheForPlayout.createPreInit(context, playlistLock, playlist, false)
			// TODO - any extra validity checks?

			const playoutCache = await CacheForPlayout.fromInit(context, initCache)

			await updateTimeline(context, playoutCache)

			await playoutCache.saveAllToDatabase()
		} finally {
			await playlistLock.release()
		}
	} else {
		console.log('for studio')
		await updateStudioTimeline(context, studioCache)
		await studioCache.saveAllToDatabase()
	}
	console.log('done')
}
