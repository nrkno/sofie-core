import { Mongo } from 'meteor/mongo'
import { TransformedCollection } from '../typings/meteor'
import { registerCollection, Time } from '../lib'
import { Meteor } from 'meteor/meteor'

export enum WorkFlowSource {
	EXPECTED_MEDIA_ITEM = 'expected_media_item',
	SOURCE_STORAGE_REMOVE = 'source_storage_remove',
	LOCAL_MEDIA_ITEM = 'local_media_item',
	TARGET_STORAGE_REMOVE = 'local_storage_remove'
}

export interface MediaWorkFlow {
	_id: string
	_rev: string

	name?: string
	/** A secondary name, some kind of a comment about the workFlow */
	comment?: string

	/** Which device this workflow originated from */
	deviceId: string
	studioId: string

	source: WorkFlowSource
	/** Id of the expectedMedia Item */
	expectedMediaItemId?: string[]
	mediaObjectId?: string
	created: Time

	priority: number

	finished: boolean
	success: boolean
}

export const MediaWorkFlows: TransformedCollection<MediaWorkFlow, MediaWorkFlow>
	= new Mongo.Collection<MediaWorkFlow>('mediaWorkFlows')
registerCollection('MediaWorkFlows', MediaWorkFlows)
Meteor.startup(() => {
	if (Meteor.isServer) {
		MediaWorkFlows._ensureIndex({
			// TODO: add deviceId: 1,
			mediaObjectId: 1
		})
		MediaWorkFlows._ensureIndex({
			finished: 1,
			success: 1,
			priority: 1
		})
	}
})
