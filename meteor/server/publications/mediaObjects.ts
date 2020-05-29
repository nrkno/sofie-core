import { Meteor } from 'meteor/meteor'
import { StudiosSecurity } from '../security/studios'
import { MediaObjects, MediaObject } from '../../lib/collections/MediaObjects'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'
import { check } from '../../lib/lib'
import { FindOptions } from '../../lib/typings/meteor'

meteorPublish(PubSub.mediaObjects, (studioId, selector, token) => {
	if (!studioId) throw new Meteor.Error(400, 'studioId argument missing')
	selector = selector || {}
	check(studioId, String)
	check(selector, Object)
	const modifier: FindOptions<MediaObject> = {
		fields: {},
	}
	if (StudiosSecurity.allowReadAccess({ _id: studioId }, token, this)) {
		selector.studioId = studioId
		return MediaObjects.find(selector, modifier)
	}
	return null
})
