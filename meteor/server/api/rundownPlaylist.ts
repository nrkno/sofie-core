import { StudioId } from '../../lib/collections/Studios'
import { Rundowns } from '../../lib/collections/Rundowns'
import { waitForPromiseAll, makePromise, waitForPromise, getHash, protectString } from '../../lib/lib'
import * as _ from 'underscore'
import {
	studioSyncFunction,
	rundownPlaylistCustomSyncFunction,
	RundownSyncFunctionPriority,
} from './ingest/rundownInput'
import { removeRundownPlaylistFromDb } from './playout/lib'
import { RundownPlaylistId } from '../../lib/collections/RundownPlaylists'

export function removeEmptyPlaylists(studioId: StudioId) {
	return studioSyncFunction('removeEmptyPlaylists', studioId, (cache) => {
		const playlists = cache.RundownPlaylists.findFetch({})

		// We want to run them all in parallel fibers
		waitForPromiseAll(
			playlists.map(async (playlist) =>
				makePromise(() => {
					// Take the playlist lock, to ensure we don't fight something else
					rundownPlaylistCustomSyncFunction(
						'removeEmptyPlaylists',
						playlist._id,
						RundownSyncFunctionPriority.USER_INGEST,
						() => {
							// TODO - is this correct priority?

							const rundowns = Rundowns.find({ playlistId: playlist._id }).count()
							if (rundowns === 0) {
								waitForPromise(removeRundownPlaylistFromDb(playlist._id))
							}
						}
					)
				})
			)
		)
	})
}
/**
 * Convert the playlistExternalId into a playlistId.
 * When we've received an externalId for a playlist, that can directly be used to reference a playlistId
 */
export function getPlaylistIdFromExternalId(studioId: StudioId, playlistExternalId: string): RundownPlaylistId {
	return protectString(getHash(`${studioId}_${playlistExternalId}`))
}
