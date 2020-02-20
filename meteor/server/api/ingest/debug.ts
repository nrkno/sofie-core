import * as _ from 'underscore'
import { check } from 'meteor/check'
import { Methods, setMeteorMethods } from '../../methods'
import { IngestActions } from './actions'
import { updateTimeline } from '../playout/timeline'

let methods: Methods = {}

methods['debug_playlistRunBlueprints'] = (rundownPlaylistId: string, purgeExisting?: boolean) => {
	check(rundownPlaylistId, String)

	IngestActions.regenerateRundownPlaylist(rundownPlaylistId, purgeExisting)
}

methods['debug_updateTimeline'] = (studioId: string) => {
	check(studioId, String)

	updateTimeline(studioId)
}


setMeteorMethods(methods)
