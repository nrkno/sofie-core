import { Meteor } from 'meteor/meteor'
import { IncomingWebhook, IncomingWebhookResult } from '@slack/client'

export function sendSlackMessageToWebhook(message: string, webhookURL: string): Promise<IncomingWebhookResult> {
	return new Promise((resolve, reject) => {
		let result: IncomingWebhookResult = { text: message } as IncomingWebhookResult
		process.nextTick(() => {
			if (message.match(/error/)) {
				reject(new Meteor.Error(500, 'Failed to send slack message'))
			} else {
				resolve(result)
			}
		})
	})
}

const mockSender = jest.fn(sendSlackMessageToWebhook)

export function setup() {
	return {
		sendSlackMessageToWebhook: mockSender,
	}
}
