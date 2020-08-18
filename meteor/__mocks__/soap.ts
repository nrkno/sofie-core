import { Meteor } from 'meteor/meteor'
import { ExternalMessageQueueObjSOAP } from 'tv-automation-sofie-blueprints-integration'
import { ExternalMessageQueue, ExternalMessageQueueObj } from '../lib/collections/ExternalMessageQueue'

export function throwFatalError(msg: ExternalMessageQueueObj, e: Meteor.Error) {
	ExternalMessageQueue.update(msg._id, {
		$set: {
			errorFatal: true,
		},
	})

	throw e
}

export async function sendSOAPMessage(msg: ExternalMessageQueueObjSOAP & ExternalMessageQueueObj) {
	return new Promise((resolve, reject) => {
		process.nextTick(() => {
			if (msg.message.fcn.match(/fatal/)) {
				try {
					throwFatalError(msg, new Meteor.Error(401, 'Fatal error sending SOAP message.'))
				} catch (e) {
					reject(e)
				}
			} else if (msg.message.fcn.match(/error/)) {
				reject(new Meteor.Error(500, 'Failed to send SOAP message'))
			} else {
				resolve()
			}
		})
	})
}

const sendSOAPMock = jest.fn(sendSOAPMessage)

export function setup() {
	return {
		sendSOAPMessage: sendSOAPMock,
	}
}
