import { ExternalMessageQueueObj } from '../lib/collections/ExternalMessageQueue'
import {
	ExternalMessageQueueObjSOAP
} from 'tv-automation-sofie-blueprints-integration'

export async function sendSOAPMessage (msg: ExternalMessageQueueObjSOAP & ExternalMessageQueueObj) {
	return new Promise((resolve, reject) => {
		setImmediate(() => resolve())
	})
}

const sendSOAPMock = jest.fn(sendSOAPMessage)

export function setup () {
	return {
		sendSOAPMessage: sendSOAPMock
	}
}
