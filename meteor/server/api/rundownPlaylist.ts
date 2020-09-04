import { StudioId } from '../../lib/collections/Studios'
import { Rundowns } from '../../lib/collections/Rundowns'
import { waitForPromiseAll, makePromise } from '../../lib/lib'
import * as _ from 'underscore'
import {
	studioSyncFunction,
	rundownPlaylistCustomSyncFunction,
	RundownSyncFunctionPriority,
} from './ingest/rundownInput'

export function removeEmptyPlaylists(studioId: StudioId) {
	return studioSyncFunction(studioId, (cache) => {
		const playlists = cache.RundownPlaylists.findFetch({})

		// We want to run them all in parallel fibers
		waitForPromiseAll(
			playlists.map(async (playlist) =>
				makePromise(() => {
					// Take the playlist lock, to ensure we don't fight something else
					rundownPlaylistCustomSyncFunction(playlist._id, RundownSyncFunctionPriority.USER_INGEST, () => {
						// TODO - is this correct priority?

						const rundowns = Rundowns.find({ playlistId: playlist._id }).count()
						if (rundowns === 0) {
							// TODO - is this the best way?
							playlist.removeTOBEREMOVED()
						}
					})
				})
			)
		)
	})
}
