import { Mongo } from 'meteor/mongo'
import { TransformedCollection } from '../typings/meteor'
import { registerCollection, Time } from '../lib'
import { Meteor } from 'meteor/meteor'

export interface RecordedFile {
	_id: string
	/** Id of the studio this file originates from */
	studioId: string
	modified: Time
	name: string
	path: string
	startedAt: Time
	stoppedAt?: Time
}

export const RecordedFiles: TransformedCollection<RecordedFile, RecordedFile>
	= new Mongo.Collection<RecordedFile>('recordedFiles')
registerCollection('RecordedFiles', RecordedFiles)
Meteor.startup(() => {
	if (Meteor.isServer) {
		RecordedFiles._ensureIndex({
			studioId: 1
		})
	}
})
