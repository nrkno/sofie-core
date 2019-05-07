import { Meteor } from 'meteor/meteor'
import { ExternalMessageQueue, ExternalMessageQueueObj } from '../lib/collections/ExternalMessageQueue'
import {
	ExternalMessageQueueObjSOAP
} from 'tv-automation-sofie-blueprints-integration'
// Cyclic dependency issues with import of throwFatalError
// import { throwFatalError } from '../server/api/ExternalMessageQueue'

export function throwFatalError (msg: ExternalMessageQueueObj, e: Meteor.Error) {

	ExternalMessageQueue.update(msg._id, {$set: {
		errorFatal: true
	}})

	throw e
}

export async function sendSOAPMessage (msg: ExternalMessageQueueObjSOAP & ExternalMessageQueueObj) {
	return new Promise((resolve, reject) => {
		process.nextTick(() => {
			if (msg.message.fcn.match(/fatal/)) {
				throwFatalError(msg, new Meteor.Error(401, 'Fatal error sending SOAP message'))
			} else {
				resolve()
			}
		})
	})
}

const sendSOAPMock = jest.fn(sendSOAPMessage)

export function setup () {
	return {
		sendSOAPMessage: sendSOAPMock
	}
}
