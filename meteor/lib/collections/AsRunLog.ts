import { TransformedCollection } from '../typings/meteor'
import { Time, registerCollection, Omit } from '../lib'
import { Meteor } from 'meteor/meteor'
import {
	IBlueprintAsRunLogEvent,
	IBlueprintAsRunLogEventContent
} from 'tv-automation-sofie-blueprints-integration'
import { createMongoCollection } from './lib'

export type AsRunLogEventBase = Omit<IBlueprintAsRunLogEvent, '_id' | 'timestamp' | 'rehersal'>
export interface AsRunLogEvent extends AsRunLogEventBase, IBlueprintAsRunLogEvent {
	_id: string,
	/** Timestamp of the event */
	timestamp: Time
	/** If the event was done in rehersal */
	rehersal: boolean,
}

export const AsRunLog: TransformedCollection<AsRunLogEvent, AsRunLogEvent>
	= createMongoCollection<AsRunLogEvent>('asRunLog')
registerCollection('AsRunLog', AsRunLog)

Meteor.startup(() => {
	if (Meteor.isServer) {
		AsRunLog._ensureIndex({
			studioId: 1,
			rundownId: 1
		})
	}
})
