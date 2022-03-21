import { Meteor } from 'meteor/meteor'
import { check } from '../../lib/check'
import * as _ from 'underscore'
import { logger } from '../logging'
import {
	ExternalMessageQueue,
	ExternalMessageQueueObj,
	ExternalMessageQueueObjId,
} from '../../lib/collections/ExternalMessageQueue'
import {
	ExternalMessageQueueObjSOAP,
	IBlueprintExternalMessageQueueType,
	ExternalMessageQueueObjRabbitMQ,
	StatusCode,
} from '@sofie-automation/blueprints-integration'
import { getCurrentTime } from '../../lib/lib'
import { registerClassToMeteorMethods } from '../methods'
import { NewExternalMessageQueueAPI, ExternalMessageQueueAPIMethods } from '../../lib/api/ExternalMessageQueue'
import { sendSOAPMessage } from './integration/soap'
import { sendSlackMessageToWebhook } from './integration/slack'
import { sendRabbitMQMessage } from './integration/rabbitMQ'
import { StatusObject, setSystemStatus } from '../systemStatus/systemStatus'
import { MethodContextAPI, MethodContext } from '../../lib/api/methods'
import { StudioContentWriteAccess } from '../security/studio'
import { triggerWriteAccessBecauseNoCheckNecessary } from '../security/lib/securityVerify'

let runMessageQueue = true
let errorOnLastRunCount: number = 0

let triggerdoMessageQueueTimeout: number = 0
function triggerdoMessageQueue(time?: number) {
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
function doMessageQueue() {
	const tryInterval = 1 * 60 * 1000 // 1 minute
	const limit = errorOnLastRunCount === 0 ? 100 : 5 // if there were errors on last send, don't run too many next time
	let probablyHasMoreToSend = false
	try {
		const now = getCurrentTime()
		let messagesToSend = ExternalMessageQueue.find(
			{
				sent: { $not: { $gt: 0 } },
				lastTry: { $not: { $gt: now - tryInterval } },
				expires: { $gt: now },
				hold: { $not: { $eq: true } },
				errorFatal: { $not: { $eq: true } },
				queueForLaterReason: { $exists: false },
			},
			{
				sort: {
					lastTry: 1,
				},
				limit: limit,
			}
		).fetch()

		if (messagesToSend.length === limit) probablyHasMoreToSend = true

		errorOnLastRunCount = 0

		const ps: Array<Promise<any>> = []

		messagesToSend = _.filter(messagesToSend, (msg: ExternalMessageQueueObj): boolean => {
			return msg.retryUntil === undefined || msg.manualRetry || now < msg.retryUntil
		})

		_.each(messagesToSend, (msg) => {
			try {
				logger.debug(`Trying to send externalMessage, id: ${msg._id}, type: "${msg.type}"`)
				msg.manualRetry = false
				ExternalMessageQueue.update(msg._id, {
					$set: {
						tryCount: (msg.tryCount || 0) + 1,
						lastTry: now,
						manualRetry: false,
					},
				})

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
							ExternalMessageQueue.update(msg._id, {
								$set: {
									sent: getCurrentTime(),
									sentReply: result,
								},
							})
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
			.catch((error) => logger.error(error))
	} catch (e) {
		logger.error(e)
	}
	triggerdoMessageQueue(tryInterval)
}
export function logMessageError(msg: ExternalMessageQueueObj, e: any) {
	try {
		errorOnLastRunCount++
		logger.warn(e || e.reason || e.toString())
		ExternalMessageQueue.update(msg._id, {
			$set: {
				errorMessage: e['reason'] || e['message'] || e.toString(),
				errorMessageTime: getCurrentTime(),
			},
		})
	} catch (e) {
		logger.error(e)
	}
}
export function throwFatalError(msg: ExternalMessageQueueObj, e: Meteor.Error) {
	ExternalMessageQueue.update(msg._id, {
		$set: {
			errorFatal: true,
		},
	})

	throw e
}

let updateExternalMessageQueueStatusTimeout: number = 0
function updateExternalMessageQueueStatus(): void {
	if (!updateExternalMessageQueueStatusTimeout) {
		updateExternalMessageQueueStatusTimeout = Meteor.setTimeout(() => {
			updateExternalMessageQueueStatusTimeout = 0

			const messagesOnQueueCursor = ExternalMessageQueue.find({
				sent: { $not: { $gt: 0 } },
				tryCount: { $gt: 3 },
			})
			const messagesOnQueueCount: number = messagesOnQueueCursor.count()
			let status: StatusObject = {
				statusCode: StatusCode.GOOD,
			}
			if (messagesOnQueueCount > 0) {
				const messagesOnQueueExample = messagesOnQueueCursor.fetch()[0]
				status = {
					statusCode: StatusCode.WARNING_MAJOR,
					messages: [
						`There are ${messagesOnQueueCount} unsent messages on queue (one of the unsent messages has the error message: "${
							messagesOnQueueExample.errorMessage
						}", to receiver "${messagesOnQueueExample.type}", "${JSON.stringify(
							messagesOnQueueExample.receiver
						)}")`,
					],
				}
			}
			setSystemStatus('External Message queue', status)
		}, 5000)
	}
}

ExternalMessageQueue.find({}).observeChanges({
	added: () => triggerdoMessageQueue(),
	changed: () => triggerdoMessageQueue(),
	removed: () => triggerdoMessageQueue(),
})
ExternalMessageQueue.find({
	sent: { $not: { $gt: 0 } },
	tryCount: { $gt: 3 },
}).observeChanges({
	added: updateExternalMessageQueueStatus,
	changed: updateExternalMessageQueueStatus,
	removed: updateExternalMessageQueueStatus,
})
Meteor.startup(() => {
	updateExternalMessageQueueStatus()
	triggerdoMessageQueue(5000)
})

async function removeExternalMessage(context: MethodContext, messageId: ExternalMessageQueueObjId): Promise<void> {
	check(messageId, String)
	await StudioContentWriteAccess.externalMessage(context, messageId)

	await ExternalMessageQueue.removeAsync(messageId)
}
async function toggleHold(context: MethodContext, messageId: ExternalMessageQueueObjId): Promise<void> {
	check(messageId, String)
	const access = await StudioContentWriteAccess.externalMessage(context, messageId)
	const m = access.message
	if (!m) throw new Meteor.Error(404, `ExternalMessage "${messageId}" not found!`)

	await ExternalMessageQueue.updateAsync(messageId, {
		$set: {
			hold: !m.hold,
		},
	})
}
async function retry(context: MethodContext, messageId: ExternalMessageQueueObjId): Promise<void> {
	check(messageId, String)
	const access = await StudioContentWriteAccess.externalMessage(context, messageId)
	const m = access.message
	if (!m) throw new Meteor.Error(404, `ExternalMessage "${messageId}" not found!`)

	const tryGap = getCurrentTime() - 1 * 60 * 1000
	await ExternalMessageQueue.updateAsync(messageId, {
		$set: {
			manualRetry: true,
			hold: false,
			errorFatal: false,
			lastTry: m.lastTry !== undefined && m.lastTry > tryGap ? tryGap : m.lastTry,
		},
	})
	triggerdoMessageQueue(1000)
}
async function setRunMessageQueue(_context: MethodContext, value: boolean): Promise<void> {
	check(value, Boolean)
	triggerWriteAccessBecauseNoCheckNecessary()

	logger.info('setRunMessageQueue: set to ' + value)
	runMessageQueue = value
	if (runMessageQueue) {
		triggerdoMessageQueue(1000)
	}
}

class ServerExternalMessageQueueAPI extends MethodContextAPI implements NewExternalMessageQueueAPI {
	async remove(messageId: ExternalMessageQueueObjId) {
		return removeExternalMessage(this, messageId)
	}
	async toggleHold(messageId: ExternalMessageQueueObjId) {
		return toggleHold(this, messageId)
	}
	async retry(messageId: ExternalMessageQueueObjId) {
		return retry(this, messageId)
	}
	async setRunMessageQueue(value: boolean) {
		return setRunMessageQueue(this, value)
	}
}
registerClassToMeteorMethods(ExternalMessageQueueAPIMethods, ServerExternalMessageQueueAPI, false)
