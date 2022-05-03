import '../../../__mocks__/_extendJest'
import { MeteorMock } from '../../../__mocks__/meteor'
import { ExternalMessageQueue, ExternalMessageQueueObj } from '../../../lib/collections/ExternalMessageQueue'
import { Rundown, Rundowns } from '../../../lib/collections/Rundowns'
import {
	IBlueprintExternalMessageQueueType,
	ExternalMessageQueueObjSlack,
	PlaylistTimingType,
} from '@sofie-automation/blueprints-integration'
import { testInFiber, runAllTimers, beforeAllInFiber } from '../../../__mocks__/helpers/jest'
import { DefaultEnvironment, setupDefaultStudioEnvironment } from '../../../__mocks__/helpers/database'
import { getCurrentTime, getRandomId, omit, protectString } from '../../../lib/lib'
import { sendSlackMessageToWebhook } from '../integration/slack'
import { RundownPlaylists } from '../../../lib/collections/RundownPlaylists'
import { MeteorCall } from '../../../lib/api/methods'

import '../ExternalMessageQueue'

describe('Test external message queue static methods', () => {
	let studioEnv: DefaultEnvironment
	beforeAll(async () => {
		studioEnv = await setupDefaultStudioEnvironment()
		const now = getCurrentTime()
		RundownPlaylists.insert({
			_id: protectString('playlist_1'),
			externalId: 'mock_rpl',
			name: 'Mock',
			studioId: protectString(''),
			created: 0,
			modified: 0,
			currentPartInstanceId: protectString('part_now'),
			nextPartInstanceId: protectString('partNext'),
			previousPartInstanceId: null,
			activationId: protectString('active'),
			timing: {
				type: PlaylistTimingType.None,
			},
		})
		Rundowns.insert({
			_id: protectString('rundown_1'),
			name: 'Mockito 1',
			externalId: 'mockito',
			playlistId: protectString('playlist_1'),
			_rank: 0,

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
				core: 'plate',
			},
			externalNRCSName: 'mockNRCS',
			organizationId: protectString(''),
			timing: {
				type: PlaylistTimingType.None,
			},
		})
		// rundown = Rundowns.findOne() as Rundown

		ExternalMessageQueue.insert({
			_id: getRandomId(),
			studioId: studioEnv.studio._id,
			expires: now + 3600,
			created: now,
			tryCount: 0,
			type: IBlueprintExternalMessageQueueType.SLACK,
			receiver: 'some receiver',
			message: 'some message',
		})
	})

	testInFiber('toggleHold', async () => {
		let message = ExternalMessageQueue.findOne() as ExternalMessageQueueObj
		expect(message).toBeTruthy()
		expect(message.hold).toBeUndefined()

		await MeteorCall.externalMessages.toggleHold(message._id)
		message = ExternalMessageQueue.findOne() as ExternalMessageQueueObj
		expect(message).toBeTruthy()
		expect(message.hold).toBe(true)

		await MeteorCall.externalMessages.toggleHold(message._id)
		message = ExternalMessageQueue.findOne() as ExternalMessageQueueObj
		expect(message).toBeTruthy()
		expect(message.hold).toBe(false)
	})

	testInFiber('toggleHold unknown id', async () => {
		await expect(MeteorCall.externalMessages.toggleHold(protectString('cake'))).rejects.toThrowMeteor(
			404,
			'ExternalMessage "cake" not found!'
		)
	})

	testInFiber('retry', async () => {
		let message = ExternalMessageQueue.findOne() as ExternalMessageQueueObj
		expect(message).toBeTruthy()

		await MeteorCall.externalMessages.retry(message._id)

		message = ExternalMessageQueue.findOne() as ExternalMessageQueueObj
		expect(message).toBeTruthy()
		expect(message).toMatchObject({
			hold: false,
			manualRetry: true,
			errorFatal: false,
		})
	})

	testInFiber('retry unknown id', async () => {
		await expect(MeteorCall.externalMessages.retry(protectString('is_a_lie'))).rejects.toThrowMeteor(
			404,
			'ExternalMessage "is_a_lie" not found!'
		)
	})

	testInFiber('setRunMessageQueue', async () => {
		await MeteorCall.externalMessages.setRunMessageQueue(false)

		await MeteorCall.externalMessages.setRunMessageQueue(true)
	})

	testInFiber('remove', async () => {
		const message = ExternalMessageQueue.findOne() as ExternalMessageQueueObj
		expect(message).toBeTruthy()

		await MeteorCall.externalMessages.remove(message._id)

		expect(ExternalMessageQueue.findOne()).toBeFalsy()
	})
})

describe('Test sending messages to mocked endpoints', () => {
	jest.useFakeTimers()

	let studioEnv: DefaultEnvironment
	let rundown: Rundown
	beforeAllInFiber(async () => {
		studioEnv = await setupDefaultStudioEnvironment()
		MeteorMock.mockRunMeteorStartup()

		RundownPlaylists.remove(protectString('playlist_1'))
		Rundowns.remove(protectString('rundown_1'))

		const now = getCurrentTime()
		RundownPlaylists.insert({
			_id: protectString('playlist_1'),
			externalId: 'mock_rpl',
			name: 'Mock',
			studioId: protectString(''),
			created: 0,
			modified: 0,
			currentPartInstanceId: protectString('part_now'),
			nextPartInstanceId: protectString('partNext'),
			previousPartInstanceId: null,
			activationId: protectString('active'),
			timing: {
				type: PlaylistTimingType.None,
			},
		})
		Rundowns.insert({
			_id: protectString('rundown_1'),
			name: 'Mockito 1',
			externalId: 'mockito',
			playlistId: protectString('playlist_1'),
			_rank: 0,

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
				core: 'plate',
			},
			externalNRCSName: 'mockNRCS',
			organizationId: protectString(''),
			timing: {
				type: PlaylistTimingType.None,
			},
		})
		rundown = Rundowns.findOne() as Rundown

		expect(rundown).toBeTruthy()
	})

	testInFiber('send a slack-type message', async () => {
		// setLogLevel(LogLevel.DEBUG)
		expect(ExternalMessageQueue.findOne()).toBeFalsy()

		const slackMessage: ExternalMessageQueueObjSlack = {
			type: IBlueprintExternalMessageQueueType.SLACK,
			receiver: 'fred',
			message: 'whats up doc?',
		}
		expect(rundown).toBeTruthy()
		const sendTime = getCurrentTime()

		ExternalMessageQueue.insert({
			_id: getRandomId(),
			studioId: studioEnv.studio._id,
			expires: getCurrentTime() + 3600,
			created: getCurrentTime(),
			tryCount: 0,
			...omit(slackMessage, '_id'),
		})

		expect(ExternalMessageQueue.findOne()).toBeTruthy()
		await runAllTimers()
		expect(sendSlackMessageToWebhook).toHaveBeenCalledTimes(1)
		await (sendSlackMessageToWebhook as jest.Mock).mock.results[0].value
		const message = ExternalMessageQueue.findOne() as ExternalMessageQueueObj
		expect(message).toBeTruthy()
		expect(message.sent).toBeGreaterThanOrEqual(sendTime)
		expect(message.lastTry).toBeGreaterThanOrEqual(sendTime)
		expect(message.sentReply).toBeTruthy()
		expect(message.tryCount).toBe(1)
		await MeteorCall.externalMessages.remove(message._id)

		expect(ExternalMessageQueue.findOne()).toBeFalsy()
	})
	/* eslint-disable jest/no-commented-out-tests */
	/*
	describe('failing to send a message and retrying', () => {
		let message: ExternalMessageQueueObj

		afterAll(() => {
			if (!message) return
			Meteor.call(ExternalMessageQueueAPIMethods.remove, message._id)
			expect(ExternalMessageQueue.findOne()).toBeFalsy()
		})

		testInFiber('fail to send a slack-type message', async () => {
			// setLogLevel(LogLevel.DEBUG)
			expect(ExternalMessageQueue.findOne()).toBeFalsy()

			const slackMessage: ExternalMessageQueueObjSlack = {
				type: IBlueprintExternalMessageQueueType.SLACK,
				receiver: 'fred',
				message: 'whats error doc?',
				retryUntil: getCurrentTime() + 1000000,
			}
			expect(rundown).toBeTruthy()
			const sendTime = getCurrentTime()
			queueExternalMessages(rundown, [slackMessage])

			expect(ExternalMessageQueue.findOne()).toBeTruthy()
			await runAllTimers()

			expect(sendSlackMessageToWebhook).toHaveBeenCalledTimes(2)
			try {
				await (sendSlackMessageToWebhook as jest.Mock).mock.results[1].value
				fail('promise should reject')
			} catch (e) {
				expect(e.message).toBe('[500] Failed to send slack message')
			}

			message = ExternalMessageQueue.findOne() as ExternalMessageQueueObj
			expect(message).toBeTruthy()
			expect(message.errorMessage).toBe('Failed to send slack message')
			expect(message.errorMessageTime).toBeGreaterThanOrEqual(sendTime)
			expect(message.lastTry).toBeGreaterThanOrEqual(sendTime)
			expect(message.tryCount).toBe(1)
			expect(message.sent).toBeUndefined()
		})

		testInFiber('does not try to send again immediately', async () => {
			// setLogLevel(LogLevel.DEBUG)
			await runAllTimers()
			// Does not try to send again yet ... too close to lastTry
			expect(sendSlackMessageToWebhook).toHaveBeenCalledTimes(2)
		})

		testInFiber('after a minute, tries to resend', async () => {
			// setLogLevel(LogLevel.DEBUG)
			// Reset the last try clock
			const sendTime = getCurrentTime()
			ExternalMessageQueue.update(message._id, {
				$set: {
					lastTry: message.lastTry ? message.lastTry - 1.2 * 60 * 1000 : 0,
				},
			})
			await runAllTimers()
			expect(sendSlackMessageToWebhook).toHaveBeenCalledTimes(3)

			message = ExternalMessageQueue.findOne() as ExternalMessageQueueObj
			expect(message).toBeTruthy()
			expect(message.errorMessage).toBe('Failed to send slack message')
			expect(message.errorMessageTime).toBeGreaterThanOrEqual(sendTime)
			expect(message.lastTry).toBeGreaterThanOrEqual(sendTime)
			expect(message.tryCount).toBe(2)
			expect(message.sent).toBeUndefined()
		})

		testInFiber('does not retry to send if on hold', async () => {
			// setLogLevel(LogLevel.DEBUG)

			Meteor.call(ExternalMessageQueueAPIMethods.toggleHold, message._id)
			message = ExternalMessageQueue.findOne() as ExternalMessageQueueObj
			expect(message).toBeTruthy()
			expect(message.hold).toBe(true)

			ExternalMessageQueue.update(message._id, {
				$set: {
					lastTry: message.lastTry ? message.lastTry - 1.2 * 60 * 1000 : 0,
				},
			})
			await runAllTimers()
			expect(sendSlackMessageToWebhook).toHaveBeenCalledTimes(3)

			Meteor.call(ExternalMessageQueueAPIMethods.toggleHold, message._id)
			message = ExternalMessageQueue.findOne() as ExternalMessageQueueObj
			expect(message).toBeTruthy()
			expect(message.hold).toBe(false)
		})

		testInFiber('does not retry after retryUntil time', async () => {
			// setLogLevel(LogLevel.DEBUG)

			ExternalMessageQueue.update(message._id, {
				$set: {
					lastTry: message.lastTry ? message.lastTry - 1.2 * 60 * 1000 : 0,
					retryUntil: getCurrentTime() - 10,
				},
			})
			await runAllTimers()
			expect(sendSlackMessageToWebhook).toHaveBeenCalledTimes(3)
		})

		testInFiber('can be forced to retry manually once', async () => {
			// setLogLevel(LogLevel.DEBUG)

			Meteor.call(ExternalMessageQueueAPIMethods.toggleHold, message._id)
			message = ExternalMessageQueue.findOne() as ExternalMessageQueueObj
			expect(message).toBeTruthy()
			expect(message.hold).toBe(true)
			expect(message.retryUntil).toBeLessThan(getCurrentTime())
			expect(message.manualRetry).toBe(false)

			Meteor.call(ExternalMessageQueueAPIMethods.retry, message._id)

			message = ExternalMessageQueue.findOne() as ExternalMessageQueueObj
			await runAllTimers()
			expect(sendSlackMessageToWebhook).toHaveBeenCalledTimes(4)

			message = ExternalMessageQueue.findOne() as ExternalMessageQueueObj
			expect(message).toBeTruthy()
			expect(message.hold).toBe(false) // expected to take message off hold
			expect(message.manualRetry).toBe(false)
			expect(message.tryCount).toBe(3)
			expect(message.sent).toBeUndefined()
		})
	})

	testInFiber('send a soap-type message', async () => {
		// setLogLevel(LogLevel.DEBUG)
		expect(
			ExternalMessageQueue.findOne({
				type: IBlueprintExternalMessageQueueType.SOAP,
			})
		).toBeFalsy()
		expect(sendSOAPMessage).toHaveBeenCalledTimes(0)

		const soapMessage: ExternalMessageQueueObjSOAP = {
			type: IBlueprintExternalMessageQueueType.SOAP,
			receiver: { url: 'http://clean.me/with/soap' },
			message: {
				fcn: 'CallMeMaybe',
				clip_key: {},
				clip: {},
			},
		}
		expect(rundown).toBeTruthy()
		const sendTime = getCurrentTime()
		queueExternalMessages(rundown, [soapMessage])

		expect(
			ExternalMessageQueue.findOne({
				type: IBlueprintExternalMessageQueueType.SOAP,
			})
		).toBeTruthy()
		await runAllTimers()
		expect(sendSOAPMessage).toHaveBeenCalledTimes(1)
		await (sendSOAPMessage as jest.Mock).mock.results[0].value
		let message = ExternalMessageQueue.findOne() as ExternalMessageQueueObj
		expect(message).toBeTruthy()
		expect(message.sent).toBeGreaterThanOrEqual(sendTime)
		expect(message.sentReply).toBeUndefined()
		expect(message.tryCount).toBe(1)
		Meteor.call(ExternalMessageQueueAPIMethods.remove, message._id)

		expect(
			ExternalMessageQueue.findOne({
				type: IBlueprintExternalMessageQueueType.SOAP,
			})
		).toBeFalsy()
	})

	testInFiber('fail to send a soap message', async () => {
		// setLogLevel(LogLevel.DEBUG)
		expect(ExternalMessageQueue.findOne()).toBeFalsy()

		const soapMessage: ExternalMessageQueueObjSOAP = {
			type: IBlueprintExternalMessageQueueType.SOAP,
			receiver: { url: 'http://clean.me/with/soap' },
			message: {
				fcn: 'CallMeMaybe error',
				clip_key: {},
				clip: {},
			},
		}
		expect(rundown).toBeTruthy()
		const sendTime = getCurrentTime()
		queueExternalMessages(rundown, [soapMessage])

		expect(ExternalMessageQueue.findOne()).toBeTruthy()
		await runAllTimers()

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
		expect(message.errorMessageTime).toBeGreaterThanOrEqual(sendTime)
		expect(message.lastTry).toBeGreaterThanOrEqual(sendTime)
		expect(message.tryCount).toBe(1)
		expect(message.sent).toBeUndefined()

		// Retry behavior tested for slack messages

		Meteor.call(ExternalMessageQueueAPIMethods.remove, message._id)
		expect(ExternalMessageQueue.findOne()).toBeFalsy()
	})

	testInFiber('fatal error when sending a soap-type message', async () => {
		// setLogLevel(LogLevel.DEBUG)
		expect(ExternalMessageQueue.findOne()).toBeFalsy()

		const soapMessage: ExternalMessageQueueObjSOAP = {
			type: IBlueprintExternalMessageQueueType.SOAP,
			receiver: { url: 'http://clean.me/with/soap' },
			message: {
				fcn: 'CallMeMaybe fatal',
				clip_key: {},
				clip: {},
			},
		}
		expect(rundown).toBeTruthy()
		const sendTime = getCurrentTime()
		queueExternalMessages(rundown, [soapMessage])

		expect(ExternalMessageQueue.findOne()).toBeTruthy()
		await runAllTimers()

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
		expect(message.errorMessageTime).toBeGreaterThanOrEqual(sendTime)
		expect(message.errorFatal).toBe(true)
		expect(message.lastTry).toBeGreaterThanOrEqual(sendTime)
		expect(message.tryCount).toBe(1)
		expect(message.sent).toBeUndefined()

		// Reset the last try clock
		ExternalMessageQueue.update(message._id, {
			$set: {
				lastTry: message.lastTry ? message.lastTry - 1.2 * 60 * 1000 : 0,
			},
		})
		await runAllTimers()
		// Does not send again - error is fatal
		expect(sendSOAPMessage).toHaveBeenCalledTimes(3)

		Meteor.call(ExternalMessageQueueAPIMethods.remove, message._id)
		expect(ExternalMessageQueue.findOne()).toBeFalsy()
	})

	testInFiber('send a rabbit MQ-type message', async () => {
		// setLogLevel(LogLevel.DEBUG)
		expect(ExternalMessageQueue.findOne()).toBeFalsy()

		const rabbitMessage: ExternalMessageQueueObjRabbitMQ = {
			type: IBlueprintExternalMessageQueueType.RABBIT_MQ,
			receiver: {
				host: 'roger',
				topic: 'the rabbit',
			},
			message: {
				routingKey: 'toMyDoor',
				message: "what's up doc?",
				headers: {},
			},
		}
		expect(rundown).toBeTruthy()
		const sendTime = getCurrentTime()
		queueExternalMessages(rundown, [rabbitMessage])

		expect(ExternalMessageQueue.findOne()).toBeTruthy()
		await runAllTimers()

		expect(sendRabbitMQMessage).toHaveBeenCalledTimes(1)
		await (sendRabbitMQMessage as jest.Mock).mock.results[0].value
		let message = ExternalMessageQueue.findOne() as ExternalMessageQueueObj
		expect(message).toBeTruthy()
		expect(message.sent).toBeGreaterThanOrEqual(sendTime)
		expect(message.sent).toBeGreaterThanOrEqual(sendTime)
		expect(message.sentReply).toBeUndefined()
		expect(message.tryCount).toBe(1)

		Meteor.call(ExternalMessageQueueAPIMethods.remove, message._id)

		expect(ExternalMessageQueue.findOne()).toBeFalsy()
	})

	testInFiber('fail to send a rabbitMQ-type message', async () => {
		// setLogLevel(LogLevel.DEBUG)
		expect(ExternalMessageQueue.findOne()).toBeFalsy()

		const rabbitMessage: ExternalMessageQueueObjRabbitMQ = {
			type: IBlueprintExternalMessageQueueType.RABBIT_MQ,
			receiver: {
				host: 'roger',
				topic: 'the rabbit',
			},
			message: {
				routingKey: 'toMyDoor',
				message: "what's error doc?",
				headers: {},
			},
		}
		expect(rundown).toBeTruthy()
		const sendTime = getCurrentTime()
		queueExternalMessages(rundown, [rabbitMessage])

		expect(ExternalMessageQueue.findOne()).toBeTruthy()
		await runAllTimers()

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
		expect(message.errorMessageTime).toBeGreaterThanOrEqual(sendTime)
		expect(message.lastTry).toBeGreaterThanOrEqual(sendTime)
		expect(message.tryCount).toBe(1)
		expect(message.sent).toBeUndefined()

		// Retry behavior tested for slack messages

		Meteor.call(ExternalMessageQueueAPIMethods.remove, message._id)
		expect(ExternalMessageQueue.findOne()).toBeFalsy()
	})

	testInFiber('does not send expired messages', async () => {
		// setLogLevel(LogLevel.DEBUG)
		expect(ExternalMessageQueue.findOne()).toBeFalsy()

		const slackMessage: ExternalMessageQueueObjSlack = {
			type: IBlueprintExternalMessageQueueType.SLACK,
			receiver: 'fred',
			message: "what's up doc?",
		}
		expect(rundown).toBeTruthy()
		const sendTime = getCurrentTime()
		queueExternalMessages(rundown, [slackMessage])

		let message = ExternalMessageQueue.findOne() as ExternalMessageQueueObj
		expect(message).toBeTruthy()
		expect(message.expires).toBeGreaterThan(getCurrentTime())

		ExternalMessageQueue.update(message._id, {
			$set: {
				expires: getCurrentTime() - 365 * 24 * 3600 * 1000,
			},
		}) // so last year!
		message = ExternalMessageQueue.findOne() as ExternalMessageQueueObj
		expect(message).toBeTruthy()
		expect(message.expires).toBeLessThan(getCurrentTime())

		await runAllTimers()

		expect(sendSlackMessageToWebhook).toHaveBeenCalledTimes(4) // i.e. not called again

		Meteor.call(ExternalMessageQueueAPIMethods.remove, message._id)
		expect(ExternalMessageQueue.findOne()).toBeFalsy()
	})
	*/
	/* eslint-enable jest/no-commented-out-tests */
})
