import * as _ from 'underscore'
import { check } from 'meteor/check'
import { Methods, setMeteorMethods } from '../../methods'
import { IngestActions } from './actions'
import { updateTimeline } from '../playout/timeline'
import { RundownPlaylistId } from '../../../lib/collections/RundownPlaylists'
import { StudioId } from '../../../lib/collections/Studios'

let methods: Methods = {}

methods['debug_playlistRunBlueprints'] = (rundownPlaylistId: RundownPlaylistId, purgeExisting?: boolean) => {
	check(rundownPlaylistId, String)

	IngestActions.regenerateRundownPlaylist(rundownPlaylistId, purgeExisting)
}

methods['debug_updateTimeline'] = (studioId: StudioId) => {
	check(studioId, String)

	updateTimeline(studioId)
}


setMeteorMethods(methods)
