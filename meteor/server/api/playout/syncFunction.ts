import { Meteor } from 'meteor/meteor'
import { ReadonlyDeep } from 'type-fest'
import { MethodContext } from '../../../lib/api/methods'
import { RundownPlaylistId, RundownPlaylist, RundownPlaylists } from '../../../lib/collections/RundownPlaylists'
import { waitForPromise } from '../../../lib/lib'
import { ReadOnlyCache } from '../../cache/CacheBase'
import { syncFunction } from '../../codeControl'
import { RundownSyncFunctionPriority } from '../ingest/rundownInput'
import { checkAccessAndGetPlaylist } from '../lib'
import { CacheForStudio } from '../studio/cache'
import {
	getStudioIdFromCacheOrLock,
	isStudioLock,
	StudioLock,
	runStudioOperationWithLock,
} from '../studio/syncFunction'
import { CacheForPlayout, CacheForPlayoutPreInit } from './cache'

export interface PlaylistLock extends StudioLock {
	readonly _playlistId: RundownPlaylistId
}

export function isPlaylistLock(obj: any): obj is PlaylistLock {
	const obj0 = obj as PlaylistLock
	return isStudioLock(obj) && !!obj0._playlistId
}

export function getPlaylistIdFromCacheOrLock(cacheOrLock: any): RundownPlaylistId | undefined {
	if (isPlaylistLock(cacheOrLock)) {
		return cacheOrLock._playlistId
	} else {
		return (cacheOrLock as Partial<ReadOnlyCache<CacheForPlayoutPreInit>>).PlaylistId
	}
}

/**
 * Lock the playlist for performing a playout operation and load a cache of data.
 * Note: This also locks the studio, if that is already locked then use 'rundownPlaylistPlayoutFromStudioLockFunction' instead
 * @param context Meteor call context, to authenticate the request. Pass null if already authenticated
 * @param contextStr Contextual information for the call to this function. to aid debugging
 * @param rundownPlaylistId Id of the playlist to lock
 * @param fcn Function to run while holding the lock
 */
export function runPlayoutOperationWithCache<T>(
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

	return runStudioOperationWithLock(contextStr, tmpPlaylist.studioId, (lock) =>
		playoutLockFunctionInner(contextStr, lock, tmpPlaylist, preInitFcn, fcn)
	)
}

/**
 * Lock the playlist for performing a playout operation and load a cache of data.
 * Warning: This will get the studio lock
 * @param context Contextual information for the call to this function. to aid debugging
 * @param studioCache Cache of Studio or another Playlist data (used to verify the lock order)
 * @param rundownPlaylistId Id of the playlist to lock
 * @param priority Priority of function execution
 * @param fcn Function to run while holding the lock
 */
export function runPlayoutOperationWithLock<T>(
	context: MethodContext | null,
	contextStr: string,
	rundownPlaylistId: RundownPlaylistId,
	priority: RundownSyncFunctionPriority,
	fcn: (lock: PlaylistLock, tmpPlaylist: ReadonlyDeep<RundownPlaylist>) => Promise<T> | T
): T {
	let tmpPlaylist: RundownPlaylist
	if (context) {
		tmpPlaylist = checkAccessAndGetPlaylist(context, rundownPlaylistId)
	} else {
		const pl = RundownPlaylists.findOne(rundownPlaylistId)
		if (!pl) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found!`)
		tmpPlaylist = pl
	}

	return runStudioOperationWithLock(contextStr, tmpPlaylist.studioId, (lock) =>
		runPlayoutOperationWithLockFromStudioOperation(contextStr, lock, tmpPlaylist, priority, (lock) =>
			fcn(lock, tmpPlaylist)
		)
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
export function runPlayoutOperationWithCacheFromStudioOperation<T>(
	context: string,
	cacheOrLock: ReadOnlyCache<CacheForStudio> | ReadOnlyCache<CacheForPlayoutPreInit> | StudioLock | PlaylistLock, // Important to verify correct lock is held
	tmpPlaylist: ReadonlyDeep<RundownPlaylist>,
	preInitFcn: null | ((cache: ReadOnlyCache<CacheForPlayoutPreInit>) => Promise<void> | void),
	fcn: (cache: CacheForPlayout) => Promise<T> | T
): T {
	// Validate the lock is correct
	const options: PlayoutLockOptions = {}
	const lockStudioId = getStudioIdFromCacheOrLock(cacheOrLock)
	const lockPlaylistId = getPlaylistIdFromCacheOrLock(cacheOrLock)
	if (lockPlaylistId === tmpPlaylist._id) options.skipPlaylistLock = true

	if (lockStudioId != tmpPlaylist.studioId)
		throw new Meteor.Error(
			500,
			`Tried to lock Playlist "${tmpPlaylist._id}" for Studio "${lockStudioId}" but it belongs to "${tmpPlaylist.studioId}"`
		)

	return playoutLockFunctionInner(context, { _studioId: lockStudioId }, tmpPlaylist, preInitFcn, fcn, options)
}

/**
 * Lock the playlist for performing a playout operation and load a cache of data.
 * Warning: This MUST be called with the correct studio lock
 * @param context Contextual information for the call to this function. to aid debugging
 * @param studioCache Cache of Studio or another Playlist data (used to verify the lock order)
 * @param rundownPlaylistId Id of the playlist to lock
 * @param priority Priority of function execution
 * @param fcn Function to run while holding the lock
 */
export function runPlayoutOperationWithLockFromStudioOperation<T>(
	context: string,
	studioCacheOrLock: StudioLock | ReadOnlyCache<CacheForStudio>,
	tmpPlaylist: Pick<ReadonlyDeep<RundownPlaylist>, '_id' | 'studioId'>,
	priority: RundownSyncFunctionPriority,
	fcn: (lock: PlaylistLock) => Promise<T> | T
): T {
	const lockStudioId = getStudioIdFromCacheOrLock(studioCacheOrLock)
	if (lockStudioId != tmpPlaylist.studioId)
		throw new Meteor.Error(
			500,
			`Tried to lock Playlist "${tmpPlaylist._id}" for Studio "${lockStudioId}" but it belongs to "${tmpPlaylist.studioId}"`
		)

	return syncFunction(
		() => waitForPromise(fcn({ _studioId: lockStudioId, _playlistId: tmpPlaylist._id })),
		context,
		`rundown_playlist_${tmpPlaylist._id}`,
		undefined,
		priority
	)()
}

interface PlayoutLockOptions {
	skipPlaylistLock?: boolean
}

/**
 * Lock the playlist for performing a playout operation and load a cache of data.
 * Warning: The Studio lock must be held
 * @param context Contextual information for the call to this function. to aid debugging
 * @param studioCache Cache of Studio data (used to verify the lock order)
 * @param rundownPlaylistId Id of the playlist to lock
 * @param priority Priority of function execution
 * @param fcn Function to run while holding the lock
 */
function playoutLockFunctionInner<T>(
	context: string,
	lock: StudioLock,
	tmpPlaylist: ReadonlyDeep<RundownPlaylist>,
	preInitFcn: null | ((cache: ReadOnlyCache<CacheForPlayoutPreInit>) => Promise<void> | void),
	fcn: (cache: CacheForPlayout) => Promise<T> | T,
	options?: PlayoutLockOptions
): T {
	async function doPlaylistInner() {
		const cache = await CacheForPlayout.create(tmpPlaylist)

		if (preInitFcn) {
			await preInitFcn(cache)
		}

		await cache.initContent(null)

		const res = await fcn(cache)

		await cache.saveAllToDatabase()

		return res
	}

	if (options?.skipPlaylistLock) {
		// TODO-PartInstances remove this once new data flow
		return waitForPromise(doPlaylistInner())
	} else {
		return runPlayoutOperationWithLockFromStudioOperation(
			context,
			lock,
			tmpPlaylist,
			RundownSyncFunctionPriority.USER_PLAYOUT,
			doPlaylistInner
		)
	}
}
