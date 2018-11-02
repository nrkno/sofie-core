import { Mongo } from 'meteor/mongo'
import { TransformedCollection } from '../typings/meteor'
import { registerCollection } from '../lib'
import { Meteor } from 'meteor/meteor'

export interface RecordedFile {
	_id: string
	/** Id of the studio this file originates from */
	studioId: string
	modified: number
	name: string
	path: string
	startedAt: number
	stoppedAt?: number
}

export const RecordedFiles: TransformedCollection<RecordedFile, RecordedFile>
	= new Mongo.Collection<RecordedFile>('recordedFiles')
registerCollection('RecordedFiles', RecordedFiles)
Meteor.startup(() => {
	if (Meteor.isServer) {
		RecordedFiles._ensureIndex({
			roId: 1
		})
	}
})
