import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { check } from '../../../lib/check'
import { IngestActions } from './actions'
import { updateTimeline, getActiveRundownPlaylist } from '../playout/timeline'
import { RundownPlaylistId } from '../../../lib/collections/RundownPlaylists'
import { StudioId } from '../../../lib/collections/Studios'

import { Settings } from '../../../lib/Settings'
import { initCacheForNoRundownPlaylist, initCacheForRundownPlaylist } from '../../DatabaseCaches'
import { waitForPromise } from '../../../lib/lib'
import { rundownPlaylistPlayoutSyncFunction } from '../playout/playout'

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
