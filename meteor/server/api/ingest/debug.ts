import { Meteor } from 'meteor/meteor'
import { check } from '../../../lib/check'
import { RundownPlaylistId } from '../../../lib/collections/RundownPlaylists'
import { StudioId } from '../../../lib/collections/Studios'
import { waitForPromise } from '../../../lib/lib'
import { Settings } from '../../../lib/Settings'
import { initCacheForNoRundownPlaylist, initCacheForRundownPlaylist } from '../../DatabaseCaches'
import { getActiveRundownPlaylist, updateTimeline } from '../playout/timeline'
import { IngestActions } from './actions'

if (!Settings.enableUserAccounts) {
	Meteor.methods({
		debug_playlistRunBlueprints: (rundownPlaylistId: RundownPlaylistId, purgeExisting?: boolean) => {
			check(rundownPlaylistId, String)
			IngestActions.regenerateRundownPlaylist(rundownPlaylistId, purgeExisting)
		},
		debug_updateTimeline: (studioId: StudioId) => {
			check(studioId, String)

			const cache = waitForPromise(initCacheForNoRundownPlaylist(studioId))

			const activePlaylist = getActiveRundownPlaylist(cache, studioId)
			if (activePlaylist) {
				const cacheForPlaylist = waitForPromise(initCacheForRundownPlaylist(activePlaylist, cache))
				updateTimeline(cacheForPlaylist, studioId)
				waitForPromise(cacheForPlaylist.saveAllToDatabase())
			} else {
				updateTimeline(cache, studioId)
				waitForPromise(cache.saveAllToDatabase())
			}
		},
	})
}
