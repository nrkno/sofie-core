import { Meteor } from 'meteor/meteor'

import { RecordedFiles, RecordedFile } from '../../lib/collections/RecordedFiles'
import { RecordedFileSecurity } from '../security/recordedFiles'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'
import { FindOptions } from '../../lib/typings/meteor'

meteorPublish(PubSub.recordedFiles, function(selector, token) {
	if (!selector) throw new Meteor.Error(400, 'selector argument missing')
	const modifier: FindOptions<RecordedFile> = {
		fields: {},
	}
	if (RecordedFileSecurity.allowReadAccess(selector, token, this)) {
		return RecordedFiles.find(selector, modifier)
	}
	return null
})
