import { Meteor } from 'meteor/meteor'

import { RecordedFiles } from '../../lib/collections/RecordedFiles'
import { RecordedFileSecurity } from '../security/collections/recordedFiles'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'

meteorPublish(PubSub.recordedFiles, function (selector, token) {
	if (!selector) throw new Meteor.Error(400,'selector argument missing')
	const modifier = {
		fields: {
			token: 0
		}
	}
	if (RecordedFileSecurity.allowReadAccess(selector, token, this)) {
		return RecordedFiles.find(selector, modifier)
	}
	return null
})
