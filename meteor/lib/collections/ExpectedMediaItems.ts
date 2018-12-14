import { Meteor } from 'meteor/meteor'
import { Mongo } from 'meteor/mongo'
import { TransformedCollection } from "../typings/meteor"
import { registerCollection, Time } from '../lib'

export interface ExpectedMediaItem {
	_id: string
	/** Local path to the media object */
	path: string

	/** The running order id of the source RO */
	runningOrderId: string

	/** True if the media item has been marked as possibly unavailable */
	disabled: boolean

	/** A label defining a pool of resources */
	mediaFlowId: string

	/** The last time the object was seen / used in Core */
	lastSeen: Time

	/** Time to wait before removing file */
	lingerTime: number
}

export const ExpectedMediaItems: TransformedCollection<ExpectedMediaItem, ExpectedMediaItem>
	= new Mongo.Collection<ExpectedMediaItem>('expectedMediaItems')
registerCollection('ExpectedMediaItems', ExpectedMediaItems)
Meteor.startup(() => {
	if (Meteor.isServer) {
		ExpectedMediaItems._ensureIndex({
			path: 1
		})
	}
})
