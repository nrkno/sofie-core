import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { check } from '../../../lib/check'
import { IngestActions } from './actions'
import { updateTimeline } from '../playout/timeline'
import { RundownPlaylistId } from '../../../lib/collections/RundownPlaylists'
import { StudioId } from '../../../lib/collections/Studios'
import { Settings } from '../../../lib/Settings'

if (!Settings.enableUserAccounts) {
	Meteor.methods({
		'debug_playlistRunBlueprints': (rundownPlaylistId: RundownPlaylistId, purgeExisting?: boolean) => {
			check(rundownPlaylistId, String)
			IngestActions.regenerateRundownPlaylist(rundownPlaylistId, purgeExisting)
		},
		'debug_updateTimeline': (studioId: StudioId) => {
			check(studioId, String)

			updateTimeline(studioId)
		}
	})
}
