import { Meteor } from 'meteor/meteor'
import { Mongo } from 'meteor/mongo'
import { TransformedCollection } from '../typings/meteor'
import { registerCollection, Time } from '../lib'

export interface ExpectedMediaItem {
	_id: string

	/** Source label that can be used to identify the EMI */
	label?: string

	/** Local path to the media object */
	path: string

	/** Global path to the media object */
	url: string

	/** The rundown id that is the source of this MediaItem */
	rundownId: string

	/** The part id that is the source of this Media Item */
	partId: string

	/** The studio installation this ExpectedMediaItem was generated in */
	studioId: string

	/** True if the media item has been marked as possibly unavailable */
	disabled: boolean

	/** A label defining a pool of resources */
	mediaFlowId: string

	/** The last time the object was seen / used in Core */
	lastSeen: Time

	/** Time to wait before removing file */
	lingerTime?: number
}

export const ExpectedMediaItems: TransformedCollection<ExpectedMediaItem, ExpectedMediaItem>
	= new Mongo.Collection<ExpectedMediaItem>('expectedMediaItems')
registerCollection('ExpectedMediaItems', ExpectedMediaItems)
Meteor.startup(() => {
	if (Meteor.isServer) {
		ExpectedMediaItems._ensureIndex({
			path: 1
		})
		ExpectedMediaItems._ensureIndex({
			mediaFlowId: 1,
			studioId: 1
		})
		ExpectedMediaItems._ensureIndex({
			rundownId: 1
		})
	}
})
