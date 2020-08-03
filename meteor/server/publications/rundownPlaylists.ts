import { Meteor } from 'meteor/meteor'

import { RundownPlaylists, DBRundownPlaylist } from '../../lib/collections/RundownPlaylists'
import { RundownPlaylistSecurity } from '../security/rundownPlaylists'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'
import { FindOptions } from '../../lib/typings/meteor'

meteorPublish(PubSub.rundownPlaylists, function(selector, token) {
	if (!selector) throw new Meteor.Error(400, 'selector argument missing')
	const modifier: FindOptions<DBRundownPlaylist> = {
		fields: {},
	}
	if (RundownPlaylistSecurity.allowReadAccess(selector, token, this)) {
		return RundownPlaylists.find(selector, modifier)
	}
	return null
})
