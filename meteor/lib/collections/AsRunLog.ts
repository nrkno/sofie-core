import { Mongo } from 'meteor/mongo'
import { TransformedCollection } from '../typings/meteor'
import { Time, registerCollection } from '../lib'
import { Meteor } from 'meteor/meteor'
import {
	IBlueprintAsRunLogEvent,
	IBlueprintAsRunLogEventContent
} from 'tv-automation-sofie-blueprints-integration'

export interface AsRunLogEventBase {
	studioId: string,
	runningOrderId: string,
	segmentId?: string,
	segmentLineId?: string,
	segmentLineItemId?: string,
	timelineObjectId?: string

	/** Name/id of the content */
	content: IBlueprintAsRunLogEventContent
	/** Name/id of the sub-content */
	content2?: string
	/** Metadata about the content */
	metadata?: any
}
export interface AsRunLogEvent extends AsRunLogEventBase, IBlueprintAsRunLogEvent {
	_id: string,
	/** Timestamp of the event */
	timestamp: Time
	/** If the event was done in rehersal */
	rehersal: boolean,
}

export const AsRunLog: TransformedCollection<AsRunLogEvent, AsRunLogEvent>
	= new Mongo.Collection<AsRunLogEvent>('asRunLog')
registerCollection('AsRunLog', AsRunLog)

Meteor.startup(() => {
	if (Meteor.isServer) {
		AsRunLog._ensureIndex({
			studioId: 1,
			runningOrderId: 1
		})
	}
})
