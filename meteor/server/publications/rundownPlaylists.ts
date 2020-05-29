import { Meteor } from 'meteor/meteor'

import { RundownPlaylists } from '../../lib/collections/RundownPlaylists'
import { RundownPlaylistSecurity } from '../security/rundownPlaylists'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'

meteorPublish(PubSub.rundownPlaylists, function(selector, token) {
	if (!selector) throw new Meteor.Error(400, 'selector argument missing')
	const modifier = {
		fields: {
			token: 0,
		},
	}
	if (RundownPlaylistSecurity.allowReadAccess(selector, token, this)) {
		return RundownPlaylists.find(selector, modifier)
	}
	return null
})
