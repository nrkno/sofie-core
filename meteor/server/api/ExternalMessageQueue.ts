import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { logger } from '../logging'
import {
	ExternalMessageQueue,
	ExternalMessageQueueObj,
	ExternalMessageQueueObjId
} from '../../lib/collections/ExternalMessageQueue'
import {
	ExternalMessageQueueObjSOAP,
	IBlueprintExternalMessageQueueObj,
	IBlueprintExternalMessageQueueType,
	ExternalMessageQueueObjRabbitMQ
} from 'tv-automation-sofie-blueprints-integration'
import {
	getCurrentTime,
	removeNullyProperties,
	getRandomId,
	makePromise,
	check
} from '../../lib/lib'
import { registerClassToMeteorMethods } from '../methods'
import { Rundown } from '../../lib/collections/Rundowns'
import { NewExternalMessageQueueAPI, ExternalMessageQueueAPIMethods } from '../../lib/api/ExternalMessageQueue'
import { sendSOAPMessage } from './integration/soap'
import { sendSlackMessageToWebhook } from './integration/slack'
import { sendRabbitMQMessage } from './integration/rabbitMQ'
import { StatusObject, StatusCode, setSystemStatus } from '../systemStatus/systemStatus'

export function queueExternalMessages (rundown: Rundown, messages: Array<IBlueprintExternalMessageQueueObj>) {
	_.each(messages, (message) => {

		// check the output:
		if (!message) 			throw new Meteor.Error('Falsy result!')
		if (!message.type) 		throw new Meteor.Error('attribute .type missing!')
		if (!message.receiver) 	throw new Meteor.Error('attribute .receiver missing!')
		if (!message.message) 	throw new Meteor.Error('attribute .message missing!')

		// Save the output into the message queue, for later processing:
		let now = getCurrentTime()
		let message2: ExternalMessageQueueObj = {
			_id: getRandomId(),
			type: message.type,
			receiver: message.receiver,
			message: message.message,
			retryUntil: message.retryUntil,
			studioId: rundown.studioId,
			rundownId: rundown._id,
			created: now,
			tryCount: 0,
			expires: now + 35 * 24 * 3600 * 1000, // 35 days
			manualRetry: false,
		}

		message2 = removeNullyProperties(message2)

		const playlist = rundown.getRundownPlaylist()
		if (!playlist.rehearsal) { // Don't save the message when running rehearsals
			ExternalMessageQueue.insert(message2)

			triggerdoMessageQueue() // trigger processing of the queue
		}
	})
}

let runMessageQueue = true
let errorOnLastRunCount: number = 0

let triggerdoMessageQueueTimeout: number = 0
export function triggerdoMessageQueue (time?: number) {
	if (!time) time = 1000
	if (triggerdoMessageQueueTimeout) {
		Meteor.clearTimeout(triggerdoMessageQueueTimeout)
	}
	if (runMessageQueue) {
		triggerdoMessageQueueTimeout = Meteor.setTimeout(() => {
			triggerdoMessageQueueTimeout = 0
			doMessageQueue()
		}, time)
	}
}
Meteor.startup(() => {
	triggerdoMessageQueue(5000)
})
function doMessageQueue () {
	// console.log('doMessageQueue', ExternalMessageQueue.find().fetch())
	let tryInterval = 1 * 60 * 1000 // 1 minute
	let limit = (errorOnLastRunCount === 0 ? 100 : 5) // if there were errors on last send, don't run too many next time
	let probablyHasMoreToSend = false
	try {
		let now = getCurrentTime()
		let messagesToSend = ExternalMessageQueue.find({
			expires: { $gt: now },
		  lastTry: { $not: { $gt: now - tryInterval } },
			sent: { $not: { $gt: 0 } },
			hold: { $not: { $eq: true } },
			errorFatal: { $not: { $eq: true } },
		}, {
			sort: {
				lastTry: 1
			},
			limit: limit
		}).fetch()

		if (messagesToSend.length === limit) probablyHasMoreToSend = true

		errorOnLastRunCount = 0

		let ps: Array<Promise<any>> = []
		// console.log('>>>', now, messagesToSend)
	 	messagesToSend = _.filter(messagesToSend, (msg: ExternalMessageQueueObj): boolean => {
			return msg.retryUntil === undefined || msg.manualRetry || now < msg.retryUntil
		})
		// console.log('<<<', now, messagesToSend)
		_.each(messagesToSend, (msg) => {
			try {
				logger.debug(`Trying to send externalMessage, id: ${msg._id}, type: "${msg.type}"`)
				msg.manualRetry = false
				ExternalMessageQueue.update(msg._id, {$set: {
					tryCount: (msg.tryCount || 0) + 1,
					lastTry: now,
					manualRetry: false,
				}})

				let p: Promise<any>
				if (msg.type === IBlueprintExternalMessageQueueType.SOAP) {
					p = sendSOAPMessage(msg as ExternalMessageQueueObjSOAP & ExternalMessageQueueObj)
				} else if (msg.type === IBlueprintExternalMessageQueueType.SLACK) {
					// let m = msg as ExternalMessageQueueObjSlack & ExternalMessageQueueObj
					p = sendSlackMessageToWebhook(msg.message, msg.receiver)
				} else if (msg.type === IBlueprintExternalMessageQueueType.RABBIT_MQ) {
					p = sendRabbitMQMessage(msg as ExternalMessageQueueObjRabbitMQ & ExternalMessageQueueObj)
				} else {
					throw new Meteor.Error(500, `Unknown / Unsupported externalMessage type: "${msg.type}"`)
				}
				ps.push(
					Promise.resolve(p)
					.then((result) => {

						ExternalMessageQueue.update(msg._id, {$set: {
							sent: getCurrentTime(),
							sentReply: result
						}})
						logger.debug(`ExternalMessage sucessfully sent, id: ${msg._id}, type: "${msg.type}"`)
					})
					.catch((e) => {
						logMessageError(msg, e)
					})
				)
			} catch (e) {
				logMessageError(msg, e)
			}
		})
		Promise.all(ps)
		.then(() => {
			// all messages have been sent
			if (probablyHasMoreToSend && errorOnLastRunCount === 0) {
				// override default timeout
				triggerdoMessageQueue(1000)
			}
		})
		.catch(error => logger.error(error))
	} catch (e) {
		logger.error(e)
	}
	triggerdoMessageQueue(tryInterval)
}
export function logMessageError (msg: ExternalMessageQueueObj, e: any) {
	try {
		errorOnLastRunCount++
		logger.warn(e || e.reason || e.toString())
		ExternalMessageQueue.update(msg._id, {$set: {
			errorMessage: (e['reason'] || e['message'] || e.toString()),
			errorMessageTime: getCurrentTime()
		}})
	} catch (e) {
		logger.error(e)
	}
}
export function throwFatalError (msg: ExternalMessageQueueObj, e: Meteor.Error) {

	ExternalMessageQueue.update(msg._id, {$set: {
		errorFatal: true
	}})

	throw e
}

let updateExternalMessageQueueStatusTimeout: number = 0
function updateExternalMessageQueueStatus (): void {

	if (!updateExternalMessageQueueStatusTimeout) {
		updateExternalMessageQueueStatusTimeout = Meteor.setTimeout(() => {
			updateExternalMessageQueueStatusTimeout = 0

			const messagesOnQueueCursor = ExternalMessageQueue.find({
				sent: { $not: { $gt: 0 } },
				tryCount: { $gt: 3 }
			})
			const messagesOnQueueCount: number = messagesOnQueueCursor.count()
			let status: StatusObject = {
				statusCode: StatusCode.GOOD
			}
			if (messagesOnQueueCount > 0) {
				const messagesOnQueueExample = messagesOnQueueCursor.fetch()[0]
				status = {
					statusCode: (
						StatusCode.WARNING_MAJOR
					),
					messages: [
						`There are ${messagesOnQueueCount} unsent messages on queue (one of the unsent messages has the error message: "${messagesOnQueueExample.errorMessage}", to receiver "${messagesOnQueueExample.type}", "${JSON.stringify(messagesOnQueueExample.receiver)}")`
					]
				}
			}
			setSystemStatus('External Message queue', status)
		}, 5000)
	}
}

ExternalMessageQueue.find({
	sent: { $not: { $gt: 0 } },
	tryCount: { $gt: 3 }
}).observeChanges({
	added: updateExternalMessageQueueStatus,
	changed: updateExternalMessageQueueStatus,
	removed: updateExternalMessageQueueStatus
})
Meteor.startup(() => {
	updateExternalMessageQueueStatus()
})

function removeExternalMessage (messageId: ExternalMessageQueueObjId): void {
	check(messageId, String)
	ExternalMessageQueue.remove(messageId)
}
function toggleHold (messageId: ExternalMessageQueueObjId): void {
	check(messageId, String)
	let m = ExternalMessageQueue.findOne(messageId)
	if (!m) throw new Meteor.Error(404, `ExternalMessageQueue "${messageId}" not found on toggleHold`)
	ExternalMessageQueue.update(messageId, {$set: {
		hold: !m.hold
	}})
}
function retry (messageId: ExternalMessageQueueObjId): void {
	check(messageId, String)
	let m = ExternalMessageQueue.findOne(messageId)
	if (!m) throw new Meteor.Error(404, `ExternalMessageQueue "${messageId}" not found on retry`)
	let tryGap = getCurrentTime() - 1 * 60 * 1000
	ExternalMessageQueue.update(messageId, {$set: {
		manualRetry: true,
		hold: false,
		errorFatal: false,
		lastTry: m.lastTry !== undefined && m.lastTry > tryGap ? tryGap : m.lastTry
	}})
	triggerdoMessageQueue(1000)
}
function setRunMessageQueue (value: boolean): void {
	check(value, Boolean)
	logger.info('setRunMessageQueue: set to ' + value)
	runMessageQueue = value
	if (runMessageQueue) {
		triggerdoMessageQueue(1000)
	}
}

class ServerExternalMessageQueueAPI implements NewExternalMessageQueueAPI {
	remove (messageId: ExternalMessageQueueObjId) {
		return makePromise(() => removeExternalMessage(messageId))
	}
	toggleHold (messageId: ExternalMessageQueueObjId) {
		return makePromise(() => toggleHold(messageId))
	}
	retry (messageId: ExternalMessageQueueObjId) {
		return makePromise(() => retry(messageId))
	}
	setRunMessageQueue (value: boolean) {
		return makePromise(() => setRunMessageQueue(value))
	}
}
registerClassToMeteorMethods(ExternalMessageQueueAPIMethods, ServerExternalMessageQueueAPI, false)
