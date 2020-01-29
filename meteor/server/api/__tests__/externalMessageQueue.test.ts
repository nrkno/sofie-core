import { Meteor } from 'meteor/meteor'
import { MeteorMock } from '../../../__mocks__/meteor'
import { queueExternalMessages } from '../ExternalMessageQueue'
import { ExternalMessageQueueAPI } from '../../../lib/api/ExternalMessageQueue'
import {
	ExternalMessageQueue,
	ExternalMessageQueueObj
} from '../../../lib/collections/ExternalMessageQueue'
import { Rundown, Rundowns } from '../../../lib/collections/Rundowns'
import {
	ExternalMessageQueueObjSOAP,
	IBlueprintExternalMessageQueueType,
	ExternalMessageQueueObjRabbitMQ,
	ExternalMessageQueueObjSlack
} from 'tv-automation-sofie-blueprints-integration'
import { testInFiber, testInFiberOnly } from '../../../__mocks__/helpers/jest'
import {
	setupDefaultStudioEnvironment
} from '../../../__mocks__/helpers/database'
import {
	getCurrentTime
} from '../../../lib/lib'
import { runInFiber } from '../../../__mocks__/Fibers'
import { sendSOAPMessage } from '../integration/soap'
import { sendSlackMessageToWebhook } from '../integration/slack'
import { sendRabbitMQMessage } from '../integration/rabbitMQ'
// import { setLoggerLevel } from '../../../server/api/logger'

const orgSetTimeout = setTimeout

export function waitTimeAsync (time: number) {
	return new Promise((resolve) => {
		orgSetTimeout(resolve, time)
	})
}
describe('Test external message queue static methods', () => {

	let studioEnv = setupDefaultStudioEnvironment()
	let rundown: Rundown
	beforeAll(async () => {
		await runInFiber(() => {
			let now = getCurrentTime()
			Rundowns.insert({
				_id: 'rundown_1',
				name: 'Mockito 1',
				externalId: 'mockito',
				currentPartId: 'part_now',
				nextPartId: 'partNext',
				studioId: studioEnv.studio._id,
				showStyleVariantId: studioEnv.showStyleVariant._id,
				showStyleBaseId: studioEnv.showStyleBase._id,
				peripheralDeviceId: studioEnv.ingestDevice._id,
				created: now,
				modified: now,
				importVersions: {
					studio: 'wibble',
					showStyleBase: 'wobble',
					showStyleVariant: 'jelly',
					blueprint: 'on',
					core: 'plate'
				},
				previousPartId: null,
				dataSource: 'frank'
			})
			rundown = Rundowns.findOne() as Rundown
		})
	})

	testInFiber('add a slack-type message', () => {
		// setLoggerLevel('debug')

		expect(ExternalMessageQueue.findOne()).toBeFalsy()

		const slackMessage: ExternalMessageQueueObjSlack = {
			type: IBlueprintExternalMessageQueueType.SLACK,
			receiver: 'fred',
			message: 'whats up doc?',
		}
		expect(rundown).toBeTruthy()
		queueExternalMessages(rundown, [ slackMessage ])

		expect(ExternalMessageQueue.findOne()).toBeTruthy()
		let message = ExternalMessageQueue.findOne() as ExternalMessageQueueObj
		expect(message).toBeTruthy()
		expect(message).toMatchObject({
			type: 'slack',
			receiver: slackMessage.receiver,
			tryCount: 0,
			studioId: rundown.studioId,
			rundownId: rundown._id,
		})
		expect(message.expires).toBeGreaterThan(getCurrentTime())
	})

	testInFiber('toggleHold', () => {
		let message = ExternalMessageQueue.findOne() as ExternalMessageQueueObj
		expect(message).toBeTruthy()
		expect(message.hold).toBeUndefined()

		Meteor.call(ExternalMessageQueueAPI.methods.toggleHold, message._id)
		message = ExternalMessageQueue.findOne() as ExternalMessageQueueObj
		expect(message).toBeTruthy()
		expect(message.hold).toBe(true)

		Meteor.call(ExternalMessageQueueAPI.methods.toggleHold, message._id)
		message = ExternalMessageQueue.findOne() as ExternalMessageQueueObj
		expect(message).toBeTruthy()
		expect(message.hold).toBe(false)
	})

	testInFiber('toggleHold unknown id', () => {
		try {
			Meteor.call(ExternalMessageQueueAPI.methods.toggleHold, 'cake')
			expect(true).toBe(false)
		} catch (e) {
			expect(e.message).toBe('[404] ExternalMessageQueue "cake" not found on toggleHold')
		}
	})

	testInFiber('retry', () => {
		let message = ExternalMessageQueue.findOne() as ExternalMessageQueueObj
		expect(message).toBeTruthy()

		Meteor.call(ExternalMessageQueueAPI.methods.retry, message._id)

		message = ExternalMessageQueue.findOne() as ExternalMessageQueueObj
	 	expect(message).toBeTruthy()
		expect(message).toMatchObject({
			hold: false,
			manualRetry: true,
			errorFatal: false
		})
	})

	testInFiber('retry unknown id', () => {
		try {
			Meteor.call(ExternalMessageQueueAPI.methods.retry, 'is_a_lie')
			expect(true).toBe(false)
		} catch (e) {
			expect(e.message).toBe('[404] ExternalMessageQueue "is_a_lie" not found on retry')
		}
	})

	testInFiber('setRunMessageQueue', () => {

		Meteor.call(ExternalMessageQueueAPI.methods.setRunMessageQueue, false, (err: Error) => {
			expect(err).toBeFalsy()
		})

		Meteor.call(ExternalMessageQueueAPI.methods.setRunMessageQueue, true, (err: Error) => {
			expect(err).toBeFalsy()
		})
	})

	testInFiber('remove', () => {
		let message = ExternalMessageQueue.findOne() as ExternalMessageQueueObj
		expect(message).toBeTruthy()

		Meteor.call(ExternalMessageQueueAPI.methods.remove, message._id)

		expect(ExternalMessageQueue.findOne()).toBeFalsy()
	})
})

describe('Test sending messages to mocked endpoints', () => {

	jest.useFakeTimers()

	let rundown: Rundown
	beforeAll(async () => {
		await runInFiber(() => {
			MeteorMock.mockRunMeteorStartup()
			rundown = Rundowns.findOne() as Rundown
		})
	})

	const sendSlackMessageToWebhookMock = sendSlackMessageToWebhook as jest.Mock

	testInFiber('send a slack-type message', async () => {
		// setLoggerLevel('debug')

		expect(ExternalMessageQueue.findOne()).toBeFalsy()

		const slackMessage: ExternalMessageQueueObjSlack = {
			type: IBlueprintExternalMessageQueueType.SLACK,
			receiver: 'fred',
			message: 'whats up doc?',
		}
		expect(rundown).toBeTruthy()
		queueExternalMessages(rundown, [ slackMessage ])

		expect(ExternalMessageQueue.findOne()).toBeTruthy()
		jest.runOnlyPendingTimers()
		jest.runOnlyPendingTimers() // Two turns of the wheel

		expect(sendSlackMessageToWebhookMock).toHaveBeenCalledTimes(1)
		await (sendSlackMessageToWebhookMock as jest.Mock).mock.results[0].value
		let message = ExternalMessageQueue.findOne() as ExternalMessageQueueObj
		expect(message).toBeTruthy()
		expect(message.sent).toBeGreaterThanOrEqual(getCurrentTime() - 100)
		expect(message.sent).toBeGreaterThanOrEqual(getCurrentTime() - 100)
		expect(message.sentReply).toBeTruthy()
		expect(message.tryCount).toBe(1)
		Meteor.call(ExternalMessageQueueAPI.methods.remove, message._id)

		expect(ExternalMessageQueue.findOne()).toBeFalsy()
	})

	describe('failing to send a message and retrying', () => {

		let message: ExternalMessageQueueObj

		afterAll(() => {
			if (!message) return
			Meteor.call(ExternalMessageQueueAPI.methods.remove, message._id)
			expect(ExternalMessageQueue.findOne()).toBeFalsy()
		})
		beforeEach(() => {
			sendSlackMessageToWebhookMock.mockClear()
		})

		testInFiber('fail to send a slack-type message', async () => {
			// setLoggerLevel('debug')
			expect(ExternalMessageQueue.findOne()).toBeFalsy()
			expect(sendSlackMessageToWebhookMock).toHaveBeenCalledTimes(0)

			const slackMessage: ExternalMessageQueueObjSlack = {
				type: IBlueprintExternalMessageQueueType.SLACK,
				receiver: 'fred',
				message: 'whats error doc?',
				retryUntil: getCurrentTime() + 1000000
			}
			expect(rundown).toBeTruthy()
			queueExternalMessages(rundown, [ slackMessage ])

			expect(ExternalMessageQueue.findOne()).toBeTruthy()
			jest.runOnlyPendingTimers()
			await waitTimeAsync(1) // to allow the sendSlackMessageToWebhookMock rejected promise to be handled

			expect(sendSlackMessageToWebhookMock).toHaveBeenCalledTimes(1)
			try {
				await (sendSlackMessageToWebhookMock as jest.Mock).mock.results[0].value
				fail('promise should reject')
			} catch (e) {
				expect(e.message).toBe('[500] Failed to send slack message')
			}

			expect(ExternalMessageQueue.find().count()).toBe(1)
			message = ExternalMessageQueue.findOne() as ExternalMessageQueueObj
			expect(message).toBeTruthy()
			expect(message.errorMessage).toBe('Failed to send slack message')
			expect(message.errorMessageTime).toBeGreaterThan(getCurrentTime() - 100)
			expect(message.lastTry).toBeGreaterThan(getCurrentTime() - 100)
			expect(message.tryCount).toBe(1)
			expect(message.sent).toBeUndefined()
		})

		test('does not try to send again immediately', async () => {
			// setLoggerLevel('debug')
			jest.runOnlyPendingTimers()
			await waitTimeAsync(1) // to allow the sendSlackMessageToWebhookMock rejected promise to be handled
			// Does not try to send again yet ... too close to lastTry
			expect(sendSlackMessageToWebhookMock).toHaveBeenCalledTimes(0)
		})

		test('after a minute, tries to resend', async () => {
			// setLoggerLevel('debug')
			// Reset the last try clock
			ExternalMessageQueue.update(message._id, { $set: {
				lastTry: message.lastTry ? message.lastTry - (1.2 * 60 * 1000) : 0
			} })
			jest.runOnlyPendingTimers()
			await waitTimeAsync(1) // to allow the sendSlackMessageToWebhookMock rejected promise to be handled
			expect(sendSlackMessageToWebhookMock).toHaveBeenCalledTimes(1)

			message = ExternalMessageQueue.findOne() as ExternalMessageQueueObj
			expect(message).toBeTruthy()
			expect(message.errorMessage).toBe('Failed to send slack message')
			expect(message.errorMessageTime).toBeGreaterThan(getCurrentTime() - 100)
			expect(message.lastTry).toBeGreaterThan(getCurrentTime() - 100)
			expect(message.tryCount).toBe(2)
			expect(message.sent).toBeUndefined()
		})

		test('does not retry to send if on hold', async () => {
			// setLoggerLevel('debug')

			Meteor.call(ExternalMessageQueueAPI.methods.toggleHold, message._id)
			message = ExternalMessageQueue.findOne() as ExternalMessageQueueObj
			expect(message).toBeTruthy()
			expect(message.hold).toBe(true)

			ExternalMessageQueue.update(message._id, { $set: {
				lastTry: message.lastTry ? message.lastTry - (1.2 * 60 * 1000) : 0
			} })
			jest.runOnlyPendingTimers()
			await waitTimeAsync(1) // to allow the sendSlackMessageToWebhookMock rejected promise to be handled
			expect(sendSlackMessageToWebhookMock).toHaveBeenCalledTimes(0)

			Meteor.call(ExternalMessageQueueAPI.methods.toggleHold, message._id)
			message = ExternalMessageQueue.findOne() as ExternalMessageQueueObj
			expect(message).toBeTruthy()
			expect(message.hold).toBe(false)
		})

		test('does not retry after retryUntil time', async () => {
			// setLoggerLevel('debug')

			ExternalMessageQueue.update(message._id, { $set: {
				lastTry: message.lastTry ? message.lastTry - (1.2 * 60 * 1000) : 0,
				retryUntil: getCurrentTime() - 10
			} })
			jest.runOnlyPendingTimers()
			await waitTimeAsync(1) // to allow the sendSlackMessageToWebhookMock rejected promise to be handled
			expect(sendSlackMessageToWebhookMock).toHaveBeenCalledTimes(0)
		})

		test('can be forced to retry manually once', async () => {
			// setLoggerLevel('debug')

			Meteor.call(ExternalMessageQueueAPI.methods.toggleHold, message._id)
			message = ExternalMessageQueue.findOne() as ExternalMessageQueueObj
			expect(message).toBeTruthy()
			expect(message.hold).toBe(true)
			expect(message.retryUntil).toBeLessThan(getCurrentTime())
			expect(message.manualRetry).toBe(false)

			Meteor.call(ExternalMessageQueueAPI.methods.retry, message._id)

			message = ExternalMessageQueue.findOne() as ExternalMessageQueueObj
			jest.runOnlyPendingTimers()
			await waitTimeAsync(1) // to allow the sendSlackMessageToWebhookMock rejected promise to be handled
			expect(sendSlackMessageToWebhookMock).toHaveBeenCalledTimes(1)

			message = ExternalMessageQueue.findOne() as ExternalMessageQueueObj
			expect(message).toBeTruthy()
			expect(message.hold).toBe(false) // expected to take message off hold
			expect(message.manualRetry).toBe(false)
			expect(message.tryCount).toBe(3)
			expect(message.sent).toBeUndefined()
		})

	})

	testInFiber('send a soap-type message', async () => {
		// setLoggerLevel('debug')
		expect(ExternalMessageQueue.findOne()).toBeFalsy()

		const soapMessage: ExternalMessageQueueObjSOAP = {
			type: IBlueprintExternalMessageQueueType.SOAP,
			receiver: { url: 'http://clean.me/with/soap' },
			message: {
				fcn: 'CallMeMaybe',
				clip_key: {},
				clip: {}
			}
		}
		expect(rundown).toBeTruthy()
		queueExternalMessages(rundown, [ soapMessage ])

		expect(ExternalMessageQueue.findOne()).toBeTruthy()
		jest.runOnlyPendingTimers()
		await waitTimeAsync(1) // to allow the sendSlackMessageToWebhookMock rejected promise to be handled

		expect(sendSOAPMessage).toHaveBeenCalledTimes(1)
		await (sendSOAPMessage as jest.Mock).mock.results[0].value
		let message = ExternalMessageQueue.findOne() as ExternalMessageQueueObj
		expect(message).toBeTruthy()
		expect(message.sent).toBeGreaterThanOrEqual(getCurrentTime() - 100)
		expect(message.sent).toBeGreaterThanOrEqual(getCurrentTime() - 100)
		expect(message.sentReply).toBeUndefined()
		expect(message.tryCount).toBe(1)
		Meteor.call(ExternalMessageQueueAPI.methods.remove, message._id)

		expect(ExternalMessageQueue.findOne()).toBeFalsy()
	})

	testInFiber('fail to send a soap message', async () => {
		// setLoggerLevel('debug')
		expect(ExternalMessageQueue.findOne()).toBeFalsy()

		const soapMessage: ExternalMessageQueueObjSOAP = {
			type: IBlueprintExternalMessageQueueType.SOAP,
			receiver: { url: 'http://clean.me/with/soap' },
			message: {
				fcn: 'CallMeMaybe error',
				clip_key: {},
				clip: {}
			}
		}
		expect(rundown).toBeTruthy()
		queueExternalMessages(rundown, [ soapMessage ])

		expect(ExternalMessageQueue.find().count()).toBe(1)
		jest.runOnlyPendingTimers()
		await waitTimeAsync(1) // to allow the sendSlackMessageToWebhookMock rejected promise to be handled

		expect(sendSOAPMessage).toHaveBeenCalledTimes(2)
		try {
			await (sendSOAPMessage as jest.Mock).mock.results[1].value
			fail('promise should reject')
		} catch (e) {
			expect(e.message).toBe('[500] Failed to send SOAP message')
		}

		let message = ExternalMessageQueue.findOne() as ExternalMessageQueueObj
		expect(message).toBeTruthy()
		expect(message.errorMessage).toBe('Failed to send SOAP message')
		expect(message.errorMessageTime).toBeGreaterThan(getCurrentTime() - 100)
		expect(message.lastTry).toBeGreaterThan(getCurrentTime() - 100)
		expect(message.tryCount).toBe(1)
		expect(message.sent).toBeUndefined()

		// Retry behavior tested for slack messages

		Meteor.call(ExternalMessageQueueAPI.methods.remove, message._id)
		expect(ExternalMessageQueue.findOne()).toBeFalsy()
	})

	testInFiber('fatal error when sending a soap-type message', async () => {
		// setLoggerLevel('debug')
		expect(ExternalMessageQueue.findOne()).toBeFalsy()

		const soapMessage: ExternalMessageQueueObjSOAP = {
			type: IBlueprintExternalMessageQueueType.SOAP,
			receiver: { url: 'http://clean.me/with/soap' },
			message: {
				fcn: 'CallMeMaybe fatal',
				clip_key: {},
				clip: {}
			}
		}
		expect(rundown).toBeTruthy()
		queueExternalMessages(rundown, [ soapMessage ])

		expect(ExternalMessageQueue.findOne()).toBeTruthy()
		jest.runOnlyPendingTimers()
		await waitTimeAsync(1) // to allow the sendSlackMessageToWebhookMock rejected promise to be handled

		expect(sendSOAPMessage).toHaveBeenCalledTimes(3)
		try {
			await (sendSOAPMessage as jest.Mock).mock.results[2].value
			fail('promise should reject')
		} catch (e) {
			expect(e.message).toBe('[401] Fatal error sending SOAP message.')
		}

		let message = ExternalMessageQueue.findOne() as ExternalMessageQueueObj
		expect(message).toBeTruthy()
		expect(message.errorMessage).toBe('Fatal error sending SOAP message.')
		expect(message.errorMessageTime).toBeGreaterThan(getCurrentTime() - 100)
		expect(message.errorFatal).toBe(true)
		expect(message.lastTry).toBeGreaterThan(getCurrentTime() - 100)
		expect(message.tryCount).toBe(1)
		expect(message.sent).toBeUndefined()

		// Reset the last try clock
		ExternalMessageQueue.update(message._id, { $set: {
			lastTry: message.lastTry ? message.lastTry - (1.2 * 60 * 1000) : 0
		} })
		jest.runOnlyPendingTimers()
		await waitTimeAsync(1) // to allow the sendSlackMessageToWebhookMock rejected promise to be handled
		// Does not send again - error is fatal
		expect(sendSOAPMessage).toHaveBeenCalledTimes(3)

		Meteor.call(ExternalMessageQueueAPI.methods.remove, message._id)
		expect(ExternalMessageQueue.findOne()).toBeFalsy()
	})

	testInFiber('send a rabbit MQ-type message', async () => {
		// setLoggerLevel('debug')
		expect(ExternalMessageQueue.findOne()).toBeFalsy()

		const rabbitMessage: ExternalMessageQueueObjRabbitMQ = {
			type: IBlueprintExternalMessageQueueType.RABBIT_MQ,
			receiver: {
				host: 'roger',
				topic: 'the rabbit'
			},
			message: {
				routingKey: 'toMyDoor',
				message: 'what\'s up doc?',
				headers: {}
			}
		}
		expect(rundown).toBeTruthy()
		queueExternalMessages(rundown, [ rabbitMessage ])

		expect(ExternalMessageQueue.findOne()).toBeTruthy()
		jest.runOnlyPendingTimers()
		await waitTimeAsync(1) // to allow the sendSlackMessageToWebhookMock rejected promise to be handled

		expect(sendRabbitMQMessage).toHaveBeenCalledTimes(1)
		await (sendRabbitMQMessage as jest.Mock).mock.results[0].value
		let message = ExternalMessageQueue.findOne() as ExternalMessageQueueObj
		expect(message).toBeTruthy()
		expect(message.sent).toBeGreaterThanOrEqual(getCurrentTime() - 100)
		expect(message.sent).toBeGreaterThanOrEqual(getCurrentTime() - 100)
		expect(message.sentReply).toBeUndefined()
		expect(message.tryCount).toBe(1)

		Meteor.call(ExternalMessageQueueAPI.methods.remove, message._id)

		expect(ExternalMessageQueue.findOne()).toBeFalsy()
	})

	testInFiber('fail to send a rabbitMQ-type message', async () => {
		// setLoggerLevel('debug')
		expect(ExternalMessageQueue.findOne()).toBeFalsy()

		const rabbitMessage: ExternalMessageQueueObjRabbitMQ = {
			type: IBlueprintExternalMessageQueueType.RABBIT_MQ,
			receiver: {
				host: 'roger',
				topic: 'the rabbit'
			},
			message: {
				routingKey: 'toMyDoor',
				message: 'what\'s error doc?',
				headers: {}
			}
		}
		expect(rundown).toBeTruthy()
		queueExternalMessages(rundown, [ rabbitMessage ])

		expect(ExternalMessageQueue.findOne()).toBeTruthy()
		jest.runOnlyPendingTimers()
		await waitTimeAsync(1) // to allow the sendSlackMessageToWebhookMock rejected promise to be handled

		expect(sendRabbitMQMessage).toHaveBeenCalledTimes(2)
		try {
			await (sendRabbitMQMessage as jest.Mock).mock.results[1].value
			fail('promise should reject')
		} catch (e) {
			expect(e.message).toBe('[500] Failed to send slack rabbitMQ message')
		}

		let message = ExternalMessageQueue.findOne() as ExternalMessageQueueObj
		expect(message).toBeTruthy()
		expect(message.errorMessage).toBe('Failed to send slack rabbitMQ message')
		expect(message.errorMessageTime).toBeGreaterThan(getCurrentTime() - 100)
		expect(message.lastTry).toBeGreaterThan(getCurrentTime() - 100)
		expect(message.tryCount).toBe(1)
		expect(message.sent).toBeUndefined()

		// Retry behavior tested for slack messages

		Meteor.call(ExternalMessageQueueAPI.methods.remove, message._id)
		expect(ExternalMessageQueue.findOne()).toBeFalsy()
	})

	testInFiber('does not send expired messages', async () => {
		// setLoggerLevel('debug')
		expect(ExternalMessageQueue.findOne()).toBeFalsy()

		const slackMessage: ExternalMessageQueueObjSlack = {
			type: IBlueprintExternalMessageQueueType.SLACK,
			receiver: 'fred',
			message: 'what\'s up doc?',
		}
		expect(rundown).toBeTruthy()
		queueExternalMessages(rundown, [ slackMessage ])

		expect(sendSlackMessageToWebhook).toHaveBeenCalledTimes(1)

		let message = ExternalMessageQueue.findOne() as ExternalMessageQueueObj
		expect(message).toBeTruthy()
		expect(message.expires).toBeGreaterThan(getCurrentTime())

		ExternalMessageQueue.update(message._id, { $set : {
			expires: getCurrentTime() - 365 * 24 * 3600 * 1000 }}) // so last year!
		message = ExternalMessageQueue.findOne() as ExternalMessageQueueObj
		expect(message).toBeTruthy()
		expect(message.expires).toBeLessThan(getCurrentTime())

		jest.runOnlyPendingTimers()
		await waitTimeAsync(1) // to allow the sendSlackMessageToWebhookMock rejected promise to be handled

		expect(sendSlackMessageToWebhook).toHaveBeenCalledTimes(1) // i.e. not called again

		Meteor.call(ExternalMessageQueueAPI.methods.remove, message._id)
		expect(ExternalMessageQueue.findOne()).toBeFalsy()
	})
})
