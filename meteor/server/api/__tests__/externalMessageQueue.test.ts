import '../../../__mocks__/_extendJest'
import { ExternalMessageQueue, ExternalMessageQueueObj } from '../../../lib/collections/ExternalMessageQueue'
import { Rundowns } from '../../../lib/collections/Rundowns'
import { IBlueprintExternalMessageQueueType, PlaylistTimingType } from '@sofie-automation/blueprints-integration'
import { testInFiber } from '../../../__mocks__/helpers/jest'
import { DefaultEnvironment, setupDefaultStudioEnvironment } from '../../../__mocks__/helpers/database'
import { getCurrentTime, getRandomId, protectString } from '../../../lib/lib'
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
			rundownIdsInOrder: [protectString('rundown_1')],
		})
		Rundowns.insert({
			_id: protectString('rundown_1'),
			name: 'Mockito 1',
			externalId: 'mockito',
			playlistId: protectString('playlist_1'),

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

	testInFiber('remove', async () => {
		const message = ExternalMessageQueue.findOne() as ExternalMessageQueueObj
		expect(message).toBeTruthy()

		await MeteorCall.externalMessages.remove(message._id)

		expect(ExternalMessageQueue.findOne()).toBeFalsy()
	})
})
