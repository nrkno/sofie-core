import { TransformedCollection } from '../typings/meteor'
import { registerCollection, Time } from '../lib'
import { Meteor } from 'meteor/meteor'
import { createMongoCollection } from './lib'

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
	= createMongoCollection<RecordedFile>('recordedFiles')
registerCollection('RecordedFiles', RecordedFiles)
Meteor.startup(() => {
	if (Meteor.isServer) {
		RecordedFiles._ensureIndex({
			studioId: 1
		})
	}
})
