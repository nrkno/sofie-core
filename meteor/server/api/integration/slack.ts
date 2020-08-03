import { IncomingWebhook, IncomingWebhookResult } from '@slack/client'
import { Meteor } from 'meteor/meteor'

const webHookCache: { [webhookURL: string]: IncomingWebhook } = {}

/**
 * Send a message to a Slack webhook
 * @param message
 * @param webhookURL
 */
export function sendSlackMessageToWebhook(message: string, webhookURL: string): Promise<IncomingWebhookResult> {
	return new Promise((resolve, reject) => {
		let webhook: IncomingWebhook = webHookCache[webhookURL]
		if (!webhook) {
			webhook = new IncomingWebhook(webhookURL)
			webHookCache[webhookURL] = webhook
		}
		return webhook.send(message)
	})
}
export const sendSlackMessageToWebhookSync: (
	message: string,
	webhookURL: string
) => IncomingWebhookResult = Meteor.wrapAsync(
	(
		message: string,
		webhookURL: string,
		callback: (err: Error | undefined, result?: IncomingWebhookResult) => void
	) => {
		sendSlackMessageToWebhook(message, webhookURL)
			.then((result) => callback(undefined, result))
			.catch((err) => callback(err))
	}
)
