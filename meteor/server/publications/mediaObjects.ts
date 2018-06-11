import { Meteor } from 'meteor/meteor'
import { check } from 'meteor/check'
import { StudioInstallationsSecurity } from '../security/studioInstallations'
import { MediaObjects } from '../../lib/collections/MediaObjects'

Meteor.publish('mediaObjects', (studioId, selector, token) => {
	if (!studioId) throw new Meteor.Error(400, 'studioId argument missing')
	selector = selector || {}
	check(studioId, String)
	check(selector, Object)
	const modifier = {
		fields: {
			token: 0
		}
	}
	console.log('pub mediaObjects')
	if (StudioInstallationsSecurity.allowReadAccess({_id: studioId}, token, this)) {
		selector.studioId = studioId
		return MediaObjects.find(selector, modifier)
	}
	return this.ready()
})
