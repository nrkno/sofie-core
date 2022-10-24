import { RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { RundownPlayoutPropsBase } from '@sofie-automation/corelib/dist/worker/studio'
import { logger } from '../logging'
import { ReadonlyDeep } from 'type-fest'
import { ReadOnlyCache } from '../cache/CacheBase'
import { JobContext } from '../jobs'
import { PlaylistLock } from '../jobs/lock'
import { CacheForPlayoutPreInit, CacheForPlayout } from './cache'

/**
 * Run a typical playout job
 * This means loading the playout cache in stages, doing some calculations and saving the result
 */
export async function runJobWithPlayoutCache<TRes>(
	context: JobContext,
	data: RundownPlayoutPropsBase,
	preInitFcn: null | ((cache: ReadOnlyCache<CacheForPlayoutPreInit>) => Promise<void> | void),
	fcn: (cache: CacheForPlayout) => Promise<TRes> | TRes
): Promise<TRes> {
	if (!data.playlistId) {
		throw new Error(`Job is missing playlistId`)
	}

	// We can lock before checking ownership, as the locks are scoped to the studio
	return runWithPlaylistLock(context, data.playlistId, async (playlistLock) => {
		const playlist = await context.directCollections.RundownPlaylists.findOne(data.playlistId)
		if (!playlist || playlist.studioId !== context.studioId) {
			throw new Error(`Job playlist "${data.playlistId}" not found or for another studio`)
		}

		return runWithPlaylistCache(context, playlist, playlistLock, preInitFcn, fcn)
	})
}

/**
 * Run a minimal playout job
 * This avoids loading the cache
 */
export async function runJobWithPlaylistLock<TRes>(
	context: JobContext,
	data: RundownPlayoutPropsBase,
	fcn: (playlist: DBRundownPlaylist | undefined, lock: PlaylistLock) => Promise<TRes>
): Promise<TRes> {
	if (!data.playlistId) {
		throw new Error(`Job is missing playlistId`)
	}

	// We can lock before checking ownership, as the locks are scoped to the studio
	return runWithPlaylistLock(context, data.playlistId, async (lock) => {
		const playlist = await context.directCollections.RundownPlaylists.findOne(data.playlistId)
		if (playlist && playlist.studioId !== context.studioId) {
			throw new Error(`Job playlist "${data.playlistId}" not found or for another studio`)
		}

		return fcn(playlist, lock)
	})
}

/**
 * Lock the playlist for a quick task without the cache
 */
export async function runWithPlaylistLock<TRes>(
	context: JobContext,
	playlistId: RundownPlaylistId,
	fcn: (lock: PlaylistLock) => Promise<TRes>
): Promise<TRes> {
	const playlistLock = await context.lockPlaylist(playlistId)
	try {
		const res = await fcn(playlistLock)
		// Explicitly await fcn, before releasing the lock
		return res
	} finally {
		await playlistLock.release()
	}
}

export async function runWithPlaylistCache<TRes>(
	context: JobContext,
	playlist: ReadonlyDeep<DBRundownPlaylist>,
	lock: PlaylistLock,
	preInitFcn: null | ((cache: ReadOnlyCache<CacheForPlayoutPreInit>) => Promise<void> | void),
	fcn: (cache: CacheForPlayout) => Promise<TRes> | TRes
): Promise<TRes> {
	const initCache = await CacheForPlayoutPreInit.createPreInit(context, lock, playlist, false)

	if (preInitFcn) {
		await preInitFcn(initCache)
	}

	const fullCache = await CacheForPlayout.fromInit(context, initCache)

	try {
		const res = await fcn(fullCache)
		logger.silly('runWithPlaylistCache: saveAllToDatabase')
		await fullCache.saveAllToDatabase()

		return res
	} catch (err) {
		fullCache.discardChanges()
		throw err
	}
}
