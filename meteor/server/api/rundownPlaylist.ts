import * as _ from 'underscore'
import { RundownPlaylists } from '../../lib/collections/RundownPlaylists'
import { Rundowns } from '../../lib/collections/Rundowns'
import { Studio } from '../../lib/collections/Studios'
import { waitForPromise } from '../../lib/lib'
import { initCacheForRundownPlaylist } from '../DatabaseCaches'
import { removeRundownPlaylistFromCache } from './playout/lib'

export function removeEmptyPlaylists(studio: Studio) {
	const playlistsInStudio = RundownPlaylists.find({
		studioId: studio._id,
	}).fetch()
	const rundowns = Rundowns.find({
		playlistId: { $in: playlistsInStudio.map((p) => p._id) },
	}).fetch()

	_.each(playlistsInStudio, (playlist) => {
		if (rundowns.filter((r) => r.playlistId === playlist._id).length === 0) {
			// playlist is empty, remove it:

			const cache = waitForPromise(initCacheForRundownPlaylist(playlist))
			removeRundownPlaylistFromCache(cache, playlist)
			waitForPromise(cache.saveAllToDatabase())
		}
	})
}
