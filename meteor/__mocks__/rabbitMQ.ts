import { ExternalMessageQueueObjRabbitMQ } from 'tv-automation-sofie-blueprints-integration'
import { ExternalMessageQueueObj } from '../lib/collections/ExternalMessageQueue'

export async function sendRabbitMQMessage (msg0: ExternalMessageQueueObjRabbitMQ & ExternalMessageQueueObj) {
	return new Promise((resolve, reject) => {
		process.nextTick(() => resolve())
	})
}

const sendRabbitMQMock = jest.fn(sendRabbitMQMessage)

export function setup () {
	return {
	  sendRabbitMQMessage: sendRabbitMQMock
	}
}
