import { Mongo } from 'meteor/mongo'
import { TransformedCollection } from '../typings/meteor'
import { Time, Collections, registerCollection } from '../lib'
import { Meteor } from 'meteor/meteor'
export interface ExternalMessageQueueObj {
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

	/** Type of message */
	type: 'soap' | 'slack'
	/** Receiver details */
	receiver: any
	/** Messate details */
	message: any
}

export interface ExternalMessageQueueObjSOAP extends ExternalMessageQueueObj {
	type: 'soap'
	receiver: {
		url: string
	}
	message: {
		fcn: string, // soap function to execute
		clip_key: ExternalMessageQueueObjSOAPMessageAttrOrFcn
		clip: ExternalMessageQueueObjSOAPMessageAttrOrFcn
	}
}
export type ExternalMessageQueueObjSOAPMessageAttrOrFcn = ExternalMessageQueueObjSOAPMessageAttrFcn | any
export interface ExternalMessageQueueObjSOAPMessageAttr {
	[attr: string]: ExternalMessageQueueObjSOAPMessageAttrOrFcn
}
export interface ExternalMessageQueueObjSOAPMessageAttrFcn {
	_fcn: {
		soapFetchFrom?: {
			fcn: string
			attrs: any[]
		}
		xmlEncode?: {
			value: any
		}
	}
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
