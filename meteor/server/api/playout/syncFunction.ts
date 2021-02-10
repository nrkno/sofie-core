import { Meteor } from 'meteor/meteor'
import { ReadonlyDeep } from 'type-fest'
import { MethodContext } from '../../../lib/api/methods'
import { RundownPlaylistId, RundownPlaylist, RundownPlaylists } from '../../../lib/collections/RundownPlaylists'
import { waitForPromise } from '../../../lib/lib'
import { ReadOnlyCache } from '../../cache/DatabaseCaches'
import { syncFunction } from '../../codeControl'
import { RundownSyncFunctionPriority } from '../ingest/rundownInput'
import { checkAccessAndGetPlaylist } from '../lib'
import { CacheForStudio } from '../studio/cache'
import { studioLockFunction } from '../studio/syncFunction'
import { CacheForPlayout, CacheForPlayoutPreInit } from './cache'

/**
 * Lock the playlist for performing a playout operation and load a cache of data.
 * Note: This also locks the studio, if that is already locked then use 'rundownPlaylistPlayoutFromStudioLockFunction' instead
 * @param context Meteor call context, to authenticate the request. Pass null if already authenticated
 * @param contextStr Contextual information for the call to this function. to aid debugging
 * @param rundownPlaylistId Id of the playlist to lock
 * @param fcn Function to run while holding the lock
 */
export function rundownPlaylistPlayoutLockFunction<T>(
	context: MethodContext | null,
	contextStr: string,
	rundownPlaylistId: RundownPlaylistId,
	preInitFcn: null | ((cache: ReadOnlyCache<CacheForPlayoutPreInit>) => Promise<void> | void),
	fcn: (cache: CacheForPlayout) => Promise<T> | T
): T {
	let tmpPlaylist: RundownPlaylist
	if (context) {
		tmpPlaylist = checkAccessAndGetPlaylist(context, rundownPlaylistId)
	} else {
		const pl = RundownPlaylists.findOne(rundownPlaylistId)
		if (!pl) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found!`)
		tmpPlaylist = pl
	}

	return studioLockFunction(contextStr, tmpPlaylist.studioId, () =>
		rundownPlaylistPlayoutLockFunctionInner(contextStr, tmpPlaylist, preInitFcn, fcn)
	)
}

/**
 * Lock the playlist for performing a playout operation and load a cache of data.
 * Note: If the studio lock is not currently held, use 'rundownPlaylistPlayoutLockFunction' insted
 * @param context Contextual information for the call to this function. to aid debugging
 * @param studioCache Cache of Studio data (used to verify the lock order)
 * @param rundownPlaylistId Id of the playlist to lock
 * @param fcn Function to run while holding the lock
 */
export function rundownPlaylistPlayoutFromStudioLockFunction<T>(
	context: string,
	studioCache: CacheForStudio,
	rundownPlaylistId: RundownPlaylistId,
	preInitFcn: null | ((cache: ReadOnlyCache<CacheForPlayoutPreInit>) => void),
	fcn: (cache: CacheForPlayout) => T
): T {
	const tmpPlaylist = studioCache.RundownPlaylists.findOne(rundownPlaylistId)
	if (!tmpPlaylist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found!`)
	return rundownPlaylistPlayoutLockFunctionInner(context, tmpPlaylist, preInitFcn, fcn)
}

/**
 * Lock the playlist for performing a playout operation and load a cache of data.
 * Warning: This MUST be called from inside the studio lock
 * @param context Contextual information for the call to this function. to aid debugging
 * @param studioCache Cache of Studio or another Playlist data (used to verify the lock order)
 * @param rundownPlaylistId Id of the playlist to lock
 * @param priority Priority of function execution
 * @param fcn Function to run while holding the lock
 */
export function rundownPlaylistNoCacheLockFunction<T>(
	context: string,
	rundownPlaylistId: RundownPlaylistId,
	priority: RundownSyncFunctionPriority,
	fcn: () => T
): T {
	return syncFunction(fcn, context, `rundown_playlist_${rundownPlaylistId}`, undefined, priority)()
}

/** TODO: when is this one needed like this? */
/**
 * Lock the playlist for performing a playout operation and load a cache of data.
 * Warning: The Studio lock must be held
 * @param context Contextual information for the call to this function. to aid debugging
 * @param studioCache Cache of Studio data (used to verify the lock order)
 * @param rundownPlaylistId Id of the playlist to lock
 * @param priority Priority of function execution
 * @param fcn Function to run while holding the lock
 */
export function rundownPlaylistPlayoutLockFunctionInner<T>(
	context: string,
	tmpPlaylist: ReadonlyDeep<RundownPlaylist>,
	preInitFcn: null | ((cache: ReadOnlyCache<CacheForPlayoutPreInit>) => Promise<void> | void),
	fcn: (cache: CacheForPlayout) => Promise<T> | T,
	options?: { skipPlaylistLock?: boolean }
): T {
	function doPlaylistInner() {
		const cache = waitForPromise(CacheForPlayout.create(tmpPlaylist))

		if (preInitFcn) {
			waitForPromise(preInitFcn(cache))
		}

		waitForPromise(cache.initContent())

		const res = waitForPromise(fcn(cache))

		waitForPromise(cache.saveAllToDatabase())

		return res
	}

	if (options?.skipPlaylistLock) {
		// TODO-PartInstances remove this once new data flow
		return doPlaylistInner()
	} else {
		return rundownPlaylistNoCacheLockFunction(
			context,
			tmpPlaylist._id,
			RundownSyncFunctionPriority.USER_PLAYOUT,
			doPlaylistInner
		)
	}
}
