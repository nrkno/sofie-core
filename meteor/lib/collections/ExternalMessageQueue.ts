import { Mongo } from 'meteor/mongo'
import { TransformedCollection } from '../typings/meteor'
import { Time, registerCollection } from '../lib'
import { Meteor } from 'meteor/meteor'
import { IBlueprintExternalMessageQueueObj, IBlueprintExternalMessageQueueType } from 'tv-automation-sofie-blueprints-integration'

export interface ExternalMessageQueueObj extends IBlueprintExternalMessageQueueObj {
	_id: string
	/** Id of the studio this message originates from */
	studioId: string
	/** (Optional) id of the running order this message originates from */
	roId?: string
	/** At this time the message will be removed */
	expires: Time
	/** Time of message creation */
	created: Time
	/** Number of times the message tried to be sent */
	tryCount: number
	/** Time of last send try: */
	lastTry?: Time
	/** If message send failed, last error message */
	errorMessage?: string
	/** If message send failed, last error message timestamp */
	errorMessageTime?: number
	/** Time of succeeded send: */
	sent?: Time
	/** Reply from receiver */
	sentReply?: any
	/** If true, wont retry no more */
	errorFatal?: boolean
	/** If true, wont retry (can be set from UI) */
	hold?: boolean

	/** Type of message */
	type: IBlueprintExternalMessageQueueType
	/** Receiver details */
	receiver: any
	/** Messate details */
	message: any
}

export const ExternalMessageQueue: TransformedCollection<ExternalMessageQueueObj, ExternalMessageQueueObj>
	= new Mongo.Collection<ExternalMessageQueueObj>('externalMessageQueue')
registerCollection('ExternalMessageQueue', ExternalMessageQueue)
Meteor.startup(() => {
	if (Meteor.isServer) {
		ExternalMessageQueue._ensureIndex({
			studioId: 1,
			created: 1
		})
		ExternalMessageQueue._ensureIndex({
			sent: 1,
			lastTry: 1
		})
	}
})
