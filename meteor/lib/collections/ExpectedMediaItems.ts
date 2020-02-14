import { Meteor } from 'meteor/meteor'
import { TransformedCollection } from '../typings/meteor'
import { registerCollection, Time } from '../lib'
import { createMongoCollection } from './lib'

export interface ExpectedMediaItemBase {
	_id: string

	/** Source label that can be used to identify the EMI */
	label?: string

	/** Local path to the media object */
	path: string

	/** Global path to the media object */
	url: string

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

export interface ExpectedMediaItemRundown extends ExpectedMediaItemBase {
	/** The rundown id that is the source of this MediaItem */
	rundownId: string

	/** The part id that is the source of this Media Item */
	partId: string

}

export interface ExpectedMediaItemBucket extends ExpectedMediaItemBase {
	/** The bucket id that is the source of this Media Item */
	bucketId: string

	/** The bucked adLib piece that is the source of this Media Item */
	bucketAdLibPieceId: string
}

export type ExpectedMediaItem = ExpectedMediaItemRundown | ExpectedMediaItemBucket

export const ExpectedMediaItems: TransformedCollection<ExpectedMediaItem, ExpectedMediaItem>
	= createMongoCollection<ExpectedMediaItem>('expectedMediaItems')
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
