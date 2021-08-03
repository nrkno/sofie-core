import { Meteor } from 'meteor/meteor'
import { ReadonlyDeep } from 'type-fest'
import { RundownPlaylistId, RundownPlaylist, RundownPlaylists } from '../../../lib/collections/RundownPlaylists'
import { assertNever } from '../../../lib/lib'
import { ReadOnlyCache } from '../../cache/CacheBase'
import { pushWorkToQueue } from '../../codeControl'
import { VerifiedRundownPlaylistContentAccess } from '../lib'
import { profiler } from '../profiler'
import { CacheForStudio } from '../studio/cache'
import {
	getStudioIdFromCacheOrLock,
	StudioLock,
	runStudioOperationWithLock,
	StudioLockFunctionPriority,
} from '../studio/lockFunction'

/** Priority for handling of synchronous events. Higher value means higher priority */
export enum PlayoutLockFunctionPriority {
	MISC = 0,
	/** Events initiated from user, for playout */
	USER_PLAYOUT = 10,
	/** Events initiated from playout-gateway callbacks */
	CALLBACK_PLAYOUT = 20,
}

function playoutToStudioLockPriority(priority: PlayoutLockFunctionPriority): StudioLockFunctionPriority {
	switch (priority) {
		case PlayoutLockFunctionPriority.CALLBACK_PLAYOUT:
			return StudioLockFunctionPriority.CALLBACK_PLAYOUT
		case PlayoutLockFunctionPriority.USER_PLAYOUT:
			return StudioLockFunctionPriority.USER_PLAYOUT
		case PlayoutLockFunctionPriority.MISC:
			return StudioLockFunctionPriority.MISC
		default:
			assertNever(priority)
			return StudioLockFunctionPriority.MISC
	}
}

export interface PlaylistLock extends StudioLock {
	readonly _playlistId: RundownPlaylistId
}

/**
 * Lock the playlist for performing a playout operation and load a cache of data.
 * Warning: This will get the studio lock
 * @param access Contextual information for the call to this function. to aid debugging
 * @param studioCache Cache of Studio or another Playlist data (used to verify the lock order)
 * @param rundownPlaylistId Id of the playlist to lock
 * @param priority Priority of function execution
 * @param fcn Function to run while holding the lock
 */
export async function runPlayoutOperationWithLock<T>(
	access: VerifiedRundownPlaylistContentAccess | null,
	contextStr: string,
	rundownPlaylistId: RundownPlaylistId,
	priority: PlayoutLockFunctionPriority,
	fcn: (lock: PlaylistLock, tmpPlaylist: ReadonlyDeep<RundownPlaylist>) => Promise<T>
): Promise<T> {
	let tmpPlaylist: RundownPlaylist
	if (access) {
		tmpPlaylist = access.playlist
		if (!tmpPlaylist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found!`)
	} else {
		const pl = await RundownPlaylists.findOneAsync(rundownPlaylistId)
		if (!pl) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found!`)
		tmpPlaylist = pl
	}

	return runStudioOperationWithLock(
		contextStr,
		tmpPlaylist.studioId,
		playoutToStudioLockPriority(priority),
		async (studioLock) =>
			runPlayoutOperationWithLockFromStudioOperation(
				contextStr,
				studioLock,
				tmpPlaylist,
				priority,
				async (playoutLock) => fcn(playoutLock, tmpPlaylist)
			)
	)
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
export async function runPlayoutOperationWithLockFromStudioOperation<T>(
	context: string,
	studioCacheOrLock: StudioLock | ReadOnlyCache<CacheForStudio>,
	tmpPlaylist: Pick<ReadonlyDeep<RundownPlaylist>, '_id' | 'studioId'>,
	priority: PlayoutLockFunctionPriority,
	fcn: (lock: PlaylistLock) => Promise<T>
): Promise<T> {
	const lockStudioId = getStudioIdFromCacheOrLock(studioCacheOrLock)
	if (lockStudioId != tmpPlaylist.studioId)
		throw new Meteor.Error(
			500,
			`Tried to lock Playlist "${tmpPlaylist._id}" for Studio "${lockStudioId}" but it belongs to "${tmpPlaylist.studioId}"`
		)

	return pushWorkToQueue(
		`rundown_playlist_${tmpPlaylist._id}`,
		context,
		async () => {
			const span = profiler.startSpan(`playoutLockFunction.${context}`)
			const res = await fcn({ _studioId: lockStudioId, _playlistId: tmpPlaylist._id })
			span?.end()
			return res
		},
		priority
	)
}
