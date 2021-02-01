import { Meteor } from 'meteor/meteor'
import { ExternalMessageQueueObjRabbitMQ } from '@sofie-automation/blueprints-integration'
import { ExternalMessageQueueObj } from '../lib/collections/ExternalMessageQueue'

export async function sendRabbitMQMessage(msg0: ExternalMessageQueueObjRabbitMQ & ExternalMessageQueueObj) {
	return new Promise<void>((resolve, reject) => {
		process.nextTick(() => {
			if (msg0.message.message.match(/error/)) {
				reject(new Meteor.Error(500, 'Failed to send slack rabbitMQ message'))
			} else {
				resolve()
			}
		})
	})
}

const sendRabbitMQMock = jest.fn(sendRabbitMQMessage)

export function setup() {
	return {
		sendRabbitMQMessage: sendRabbitMQMock,
	}
}
