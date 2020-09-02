import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { check } from '../../../lib/check'
import { IngestActions } from './actions'
import { updateTimeline } from '../playout/timeline'
import { RundownPlaylistId } from '../../../lib/collections/RundownPlaylists'
import { StudioId } from '../../../lib/collections/Studios'

import { Settings } from '../../../lib/Settings'
import { studioSyncFunction } from './rundownInput'
import { getActiveRundownPlaylistsInStudio2 } from '../playout/studio'

if (!Settings.enableUserAccounts) {
	Meteor.methods({
		debug_playlistRunBlueprints: (rundownPlaylistId: RundownPlaylistId, purgeExisting?: boolean) => {
			check(rundownPlaylistId, String)
			IngestActions.regenerateRundownPlaylist(rundownPlaylistId, purgeExisting)
		},
		debug_updateTimeline: (studioId: StudioId) => {
			check(studioId, String)

			return studioSyncFunction(studioId, (cache) => {
				const activePlaylists = getActiveRundownPlaylistsInStudio2(cache)
				if (activePlaylists.length === 0) {
					updateStudioTimeline(cache)
				} else if (activePlaylists.length === 1) {
					// TODO
					updateTimeline(cache, studioId)
				} else {
					throw new Meteor.Error(500, `Cannot updateTimeline of studio with multiple active timelines!`)
				}
			})
		},
	})
}
