import { Meteor } from 'meteor/meteor'
import { MeteorMock } from '../../../__mocks__/meteor'
import { queueExternalMessages } from '../ExternalMessageQueue'
import { ExternalMessageQueueAPI } from '../../../lib/api/ExternalMessageQueue'
import {
	ExternalMessageQueue,
	ExternalMessageQueueObj
} from '../../../lib/collections/ExternalMessageQueue'
import { PeripheralDevice } from '../../../lib/collections/PeripheralDevices'
import { Rundown, Rundowns } from '../../../lib/collections/Rundowns'
import {
	ExternalMessageQueueObjSOAP,
	IBlueprintExternalMessageQueueObj,
	IBlueprintExternalMessageQueueType,
	ExternalMessageQueueObjRabbitMQ,
	ExternalMessageQueueObjSlack
} from 'tv-automation-sofie-blueprints-integration'
import { testInFiber } from '../../../__mocks__/helpers/jest'
import {
	setupDefaultStudioEnvironment
} from '../../../__mocks__/helpers/database'
import {
	getCurrentTime
} from '../../../lib/lib'
import { runInFiber } from '../../../__mocks__/Fibers'
import { setLoggerLevel } from '../../../server/api/logger'

describe('Test external message queue', () => {

	jest.useFakeTimers()

	let studioEnv = setupDefaultStudioEnvironment()
	let rundown: Rundown
	beforeAll(() => {
		runInFiber(() => {
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
				peripheralDeviceId: studioEnv.device._id,
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
		setLoggerLevel('debug')

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
		setLoggerLevel('debug')
		MeteorMock.mockRunMeteorStartup()

		jest.runOnlyPendingTimers()

		Meteor.call(ExternalMessageQueueAPI.methods.setRunMessageQueue, true, (err: Error) => {
			expect(err).toBeFalsy()
		})
		Meteor.call(ExternalMessageQueueAPI.methods.setRunMessageQueue, false, (err: Error) => {
			expect(err).toBeFalsy()
		})
	})

	testInFiber('remove', () => {
		let message = ExternalMessageQueue.findOne() as ExternalMessageQueueObj
		expect(message).toBeTruthy()

		Meteor.call(ExternalMessageQueueAPI.methods.remove, message._id)

		expect(ExternalMessageQueue.findOne()).toBeFalsy()
	})

	testInFiber('add a soap-type message', () => {

		expect(ExternalMessageQueue.findOne()).toBeFalsy()

		// TODO
		// const slackMessage: ExternalMessageQueueObjSlack = {
		// 	type: IBlueprintExternalMessageQueueType.SLACK,
		// 	receiver: 'fred',
		// 	message: 'whats up doc?',
		// }
		// expect(rundown).toBeTruthy()
		// queueExternalMessages(rundown, [ slackMessage ])
		//
		// expect(ExternalMessageQueue.findOne()).toBeTruthy()
		// let message = ExternalMessageQueue.findOne() as ExternalMessageQueueObj
		// expect(message).toBeTruthy()
		// expect(message).toMatchObject({
		// 	type: 'slack',
		// 	receiver: slackMessage.receiver,
		// 	tryCount: 0,
		// 	studioId: rundown.studioId,
		// 	rundownId: rundown._id,
		// })
		// expect(message.expires).toBeGreaterThan(getCurrentTime())
	})

	testInFiber('add a rabbit MQ-type message', () => {

		expect(ExternalMessageQueue.findOne()).toBeFalsy()

		// TODO
		// const slackMessage: ExternalMessageQueueObjSlack = {
		// 	type: IBlueprintExternalMessageQueueType.SLACK,
		// 	receiver: 'fred',
		// 	message: 'whats up doc?',
		// }
		// expect(rundown).toBeTruthy()
		// queueExternalMessages(rundown, [ slackMessage ])
		//
		// expect(ExternalMessageQueue.findOne()).toBeTruthy()
		// let message = ExternalMessageQueue.findOne() as ExternalMessageQueueObj
		// expect(message).toBeTruthy()
		// expect(message).toMatchObject({
		// 	type: 'slack',
		// 	receiver: slackMessage.receiver,
		// 	tryCount: 0,
		// 	studioId: rundown.studioId,
		// 	rundownId: rundown._id,
		// })
		// expect(message.expires).toBeGreaterThan(getCurrentTime())
	})

})
