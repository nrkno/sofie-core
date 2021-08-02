import { RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { RundownPlayoutPropsBase } from '@sofie-automation/corelib/dist/worker/studio'
import { ReadOnlyCache } from '../cache/CacheBase'
import { JobContext } from '../jobs'
import { PlaylistLock, lockPlaylist } from '../jobs/lock'
import { CacheForPlayoutPreInit, CacheForPlayout } from './cache'

/**
 * Run a typical playout job
 * This means loading the playout cache in stages, doing some calculations and saving the result
 */
export async function runAsPlayoutJob<TRes>(
	context: JobContext,
	data: RundownPlayoutPropsBase,
	preInitFcn: null | ((cache: ReadOnlyCache<CacheForPlayoutPreInit>) => Promise<void>),
	fcn: (cache: CacheForPlayout) => Promise<TRes>
): Promise<TRes> {
	if (!data.playlistId) {
		throw new Error(`Job is missing playlistId`)
	}

	const playlist = await context.directCollections.RundownPlaylists.findOne(data.playlistId)
	if (!playlist || playlist.studioId !== context.studioId) {
		throw new Error(`Job playlist "${data.playlistId}" not found or for another studio`)
	}

	return runInPlaylistLock(context, playlist._id, async (playlistLock) => {
		const initCache = await CacheForPlayoutPreInit.createPreInit(context, playlistLock, playlist, false)

		if (preInitFcn) {
			await preInitFcn(initCache)
		}

		const fullCache = await CacheForPlayout.fromInit(context, initCache)

		const res = await fcn(fullCache)

		await fullCache.saveAllToDatabase()

		return res
	})
}

/**
 * Run a minimal playout job
 * This avoids loading the cache
 */
export async function runAsPlayoutLock<TRes>(
	context: JobContext,
	data: RundownPlayoutPropsBase,
	fcn: (playlist: DBRundownPlaylist) => Promise<TRes>
): Promise<TRes> {
	if (!data.playlistId) {
		throw new Error(`Job is missing playlistId`)
	}

	const playlist = await context.directCollections.RundownPlaylists.findOne(data.playlistId)
	if (!playlist || playlist.studioId !== context.studioId) {
		throw new Error(`Job playlist "${data.playlistId}" not found or for another studio`)
	}

	return runInPlaylistLock(context, playlist._id, async () => fcn(playlist))
}

export async function runInPlaylistLock<TRes>(
	context: JobContext,
	playlistId: RundownPlaylistId,
	fcn: (lock: PlaylistLock) => Promise<TRes>
): Promise<TRes> {
	const playlistLock = await lockPlaylist(context, playlistId)
	try {
		return await fcn(playlistLock)
	} finally {
		await playlistLock.release()
	}
}
