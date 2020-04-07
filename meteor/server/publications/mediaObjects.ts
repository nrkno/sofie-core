import { Meteor } from 'meteor/meteor'
import { check } from 'meteor/check'
import { StudiosSecurity } from '../security/collections/studios'
import { MediaObjects } from '../../lib/collections/MediaObjects'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'

meteorPublish(PubSub.mediaObjects, (studioId, selector, token) => {
	if (!studioId) throw new Meteor.Error(400, 'studioId argument missing')
	selector = selector || {}
	check(studioId, String)
	check(selector, Object)
	const modifier = {
		fields: {
			token: 0
		}
	}
	if (StudiosSecurity.allowReadAccess({ _id: studioId }, token, this)) {
		selector.studioId = studioId
		return MediaObjects.find(selector, modifier)
	}
	return null
})
