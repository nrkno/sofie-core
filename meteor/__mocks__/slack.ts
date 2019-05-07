import { IncomingWebhook, IncomingWebhookResult } from '@slack/client'

export function sendSlackMessageToWebhook (message: string, webhookURL: string): Promise<IncomingWebhookResult> {
	return new Promise((resolve, reject) => {
		let result: IncomingWebhookResult = { text: message } as IncomingWebhookResult
	  process.nextTick(() => resolve(result))

	})
}

const mockSender = jest.fn(sendSlackMessageToWebhook)

export function setup () {
	return {
		sendSlackMessageToWebhook: mockSender
	}
}
