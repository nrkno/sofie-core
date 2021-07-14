import { CacheForPlayout } from '../playout/cache'
import { updateTimeline, updateStudioTimeline } from '../playout/timeline'
import { CacheForStudio } from '../studio/cache'
import { JobContext } from '.'

export enum StudioJobs {
	UpdateTimeline = 'updateTimeline',
}

/** Job Id vs data type */
export type StudioJobTypes = [StudioJobs.UpdateTimeline, null]

export const studioJobHandlers: { [key in StudioJobs]: (context: JobContext, data: any) => Promise<any> } = {
	[StudioJobs.UpdateTimeline]: updateTimelineDebug,
}

async function updateTimelineDebug(context: JobContext, _data: unknown): Promise<void> {
	console.log('running updateTimelineDebug')
	const studioCache = await CacheForStudio.create(context, context.studioId)

	const activePlaylists = studioCache.getActiveRundownPlaylists()
	if (activePlaylists.length > 1) {
		throw new Error(`Too many active playlists`)
	} else if (activePlaylists.length > 0) {
		studioCache._abortActiveTimeout() // no changes have been made or should be kept

		const playlist = activePlaylists[0]
		console.log('for playlist', playlist._id)

		const initCache = await CacheForPlayout.createPreInit(context, playlist, false)
		// TODO - any extra validity checks?

		const playoutCache = await CacheForPlayout.fromInit(context, initCache)

		await updateTimeline(context, playoutCache)

		await playoutCache.saveAllToDatabase()
	} else {
		console.log('for studio')
		await updateStudioTimeline(context, studioCache)
		await studioCache.saveAllToDatabase()
	}
	console.log('done')
}
