
import { IncomingWebhook, IncomingWebhookResult } from '@slack/client'
import { Meteor } from 'meteor/meteor'

const webHookCache: {[webhookURL: string]: IncomingWebhook} = {}

export const sendSlackMessageToWebhook: (message: string, webhookURL: string) => IncomingWebhookResult =
Meteor.wrapAsync((message: string, webhookURL: string, callback: () => void) => {
	let webhook: IncomingWebhook = webHookCache[webhookURL]
	if (!webhook) {
		webhook = new IncomingWebhook(webhookURL)
		webHookCache[webhookURL] = webhook
	}
	webhook.send(message, callback)
})
