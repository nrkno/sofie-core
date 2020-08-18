import { Meteor } from 'meteor/meteor'
import { ProtectedString, registerCollection, Time } from '../lib'
import { TransformedCollection } from '../typings/meteor'
import { createMongoCollection } from './lib'
import { StudioId } from './Studios'

/** A string, identifying a RecordedFile */
export type RecordedFileId = ProtectedString<'RecordedFileId'>

export interface RecordedFile {
	_id: RecordedFileId
	/** Id of the studio this file originates from */
	studioId: StudioId
	modified: Time
	name: string
	path: string
	startedAt: Time
	stoppedAt?: Time
}

export const RecordedFiles: TransformedCollection<RecordedFile, RecordedFile> = createMongoCollection<RecordedFile>(
	'recordedFiles'
)
registerCollection('RecordedFiles', RecordedFiles)
Meteor.startup(() => {
	if (Meteor.isServer) {
		RecordedFiles._ensureIndex({
			studioId: 1,
		})
	}
})
