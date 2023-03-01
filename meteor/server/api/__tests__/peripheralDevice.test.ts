import '../../../__mocks__/_extendJest'
import { Meteor } from 'meteor/meteor'
import {
	PeripheralDevice,
	PeripheralDeviceCategory,
	PeripheralDevices,
	PeripheralDeviceType,
} from '../../../lib/collections/PeripheralDevices'
import { PeripheralDeviceCommands } from '../../../lib/collections/PeripheralDeviceCommands'
import { Rundowns } from '../../../lib/collections/Rundowns'
import { Segments } from '../../../lib/collections/Segments'
import { Parts } from '../../../lib/collections/Parts'
import { EmptyPieceTimelineObjectsBlob, Pieces, PieceStatusCode } from '../../../lib/collections/Pieces'
import {
	getCurrentTime,
	literal,
	protectString,
	ProtectedString,
	getRandomId,
	LogLevel,
	getRandomString,
	sleep,
} from '../../../lib/lib'

import { testInFiber } from '../../../__mocks__/helpers/jest'
import { setupDefaultStudioEnvironment, DefaultEnvironment } from '../../../__mocks__/helpers/database'
import { setLogLevel } from '../../logging'
import { RundownPlaylists } from '../../../lib/collections/RundownPlaylists'
import {
	IngestDeviceSettings,
	IngestDeviceSecretSettings,
} from '@sofie-automation/corelib/dist/dataModel/PeripheralDeviceSettings/ingestDevice'
import { MediaWorkFlow, MediaWorkFlows } from '../../../lib/collections/MediaWorkFlows'
import { MediaWorkFlowStep, MediaWorkFlowSteps } from '../../../lib/collections/MediaWorkFlowSteps'
import { MediaManagerAPI } from '../../../lib/api/mediaManager'
import { MediaObject, MediaObjects } from '../../../lib/collections/MediaObjects'
import {
	IBlueprintPieceType,
	PieceLifespan,
	PlaylistTimingType,
	StatusCode,
} from '@sofie-automation/blueprints-integration'
import { CreateFakeResult, QueueStudioJobSpy } from '../../../__mocks__/worker'

import '../peripheralDevice'
import { OnTimelineTriggerTimeProps, StudioJobFunc, StudioJobs } from '@sofie-automation/corelib/dist/worker/studio'
import { MeteorCall } from '../../../lib/api/methods'
import { PeripheralDevicePublic } from '@sofie-automation/shared-lib/dist/core/model/peripheralDevice'
import {
	PeripheralDeviceInitOptions,
	PlayoutChangedType,
	TimelineTriggerTimeResult,
} from '@sofie-automation/shared-lib/dist/peripheralDevice/peripheralDeviceAPI'
import { RundownId, RundownPlaylistId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PeripheralDeviceAPIMethods } from '@sofie-automation/shared-lib/dist/peripheralDevice/methodsAPI'

const DEBUG = false

describe('test peripheralDevice general API methods', () => {
	let device: PeripheralDevice
	let rundownID: RundownId
	let rundownPlaylistID: RundownPlaylistId
	let env: DefaultEnvironment
	beforeAll(async () => {
		env = await setupDefaultStudioEnvironment()
		device = env.ingestDevice
		rundownID = protectString('rundown0')
		rundownPlaylistID = protectString('rundownPlaylist0')
		const rundownExternalID: string = 'rundown0'
		RundownPlaylists.insert({
			_id: rundownPlaylistID,
			externalId: 'mock_rpl',
			name: 'Mock',
			studioId: env.studio._id,
			created: 0,
			modified: 0,
			currentPartInstanceId: null,
			nextPartInstanceId: null,
			previousPartInstanceId: null,
			activationId: protectString('active'),
			timing: {
				type: PlaylistTimingType.None,
			},
			rundownIdsInOrder: [rundownID],
		})
		Rundowns.insert({
			_id: rundownID,
			externalId: rundownExternalID,
			studioId: env.studio._id,
			showStyleBaseId: env.showStyleBaseId,
			showStyleVariantId: env.showStyleVariantId,
			name: 'test rundown',
			created: 1000,
			playlistId: rundownPlaylistID,
			peripheralDeviceId: env.ingestDevice._id,
			modified: getCurrentTime(),
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
		const segmentID: SegmentId = protectString('segment0')
		const segmentExternalID = 'segment0'
		Segments.insert({
			_id: segmentID,
			externalId: segmentExternalID,
			_rank: 0,
			rundownId: rundownID,
			name: 'Fire',
			externalModified: 1,
		})
		Parts.insert({
			_id: protectString('part000'),
			_rank: 0,
			externalId: 'part000',
			segmentId: segmentID,
			rundownId: rundownID,
			title: 'Part 000',
			expectedDurationWithPreroll: undefined,
		})
		Pieces.insert({
			_id: protectString('piece0001'),
			enable: {
				start: 0,
			},
			externalId: '',
			name: 'Mock',
			sourceLayerId: Object.keys(env.showStyleBase.sourceLayersWithOverrides.defaults)[0],
			outputLayerId: Object.keys(env.showStyleBase.outputLayersWithOverrides.defaults)[0],
			startPartId: protectString('part000'),
			startSegmentId: segmentID,
			startRundownId: rundownID,
			status: PieceStatusCode.UNKNOWN,
			lifespan: PieceLifespan.WithinPart,
			pieceType: IBlueprintPieceType.Normal,
			invalid: false,
			content: {},
			timelineObjectsString: EmptyPieceTimelineObjectsBlob,
		})
		Parts.insert({
			_id: protectString('part001'),
			_rank: 1,
			externalId: 'part001',
			segmentId: segmentID,
			rundownId: rundownID,
			title: 'Part 001',
			expectedDurationWithPreroll: undefined,
		})
		Segments.insert({
			_id: protectString('segment1'),
			_rank: 1,
			externalId: 'segment01',
			rundownId: rundownID,
			name: 'Water',
			externalModified: 1,
		})
		Segments.insert({
			_id: protectString('segment2'),
			_rank: 2,
			externalId: 'segment02',
			rundownId: rundownID,
			name: 'Earth',
			externalModified: 1,
		})
	})
	beforeEach(async () => {
		QueueStudioJobSpy.mockReset()
		QueueStudioJobSpy.mockClear()
	})

	testInFiber('initialize', async () => {
		if (DEBUG) setLogLevel(LogLevel.DEBUG)

		expect(PeripheralDevices.findOne(device._id)).toBeTruthy()

		const options: PeripheralDeviceInitOptions = {
			category: PeripheralDeviceCategory.INGEST,
			type: PeripheralDeviceType.MOS,
			subType: 'mos_connection',
			name: 'test',
			connectionId: 'test',
			configManifest: {
				deviceConfig: [],
			},
		}
		await MeteorCall.peripheralDevice.initialize(device._id, device.token, options)
		const initDevice = PeripheralDevices.findOne(device._id) as PeripheralDevice
		expect(initDevice).toBeTruthy()
		expect(initDevice.lastSeen).toBeGreaterThan(getCurrentTime() - 100)
		expect(initDevice.lastConnected).toBeGreaterThan(getCurrentTime() - 100)
		expect(initDevice.subType).toBe(options.subType)
	})

	testInFiber('setStatus', async () => {
		expect(PeripheralDevices.findOne(device._id)).toBeTruthy()
		expect((PeripheralDevices.findOne(device._id) as PeripheralDevice).status).toMatchObject({
			statusCode: StatusCode.GOOD,
		})
		await MeteorCall.peripheralDevice.setStatus(device._id, device.token, {
			statusCode: StatusCode.WARNING_MINOR,
			messages: ["Something's not right"],
		})
		expect((PeripheralDevices.findOne(device._id) as PeripheralDevice).status).toMatchObject({
			statusCode: StatusCode.WARNING_MINOR,
			messages: ["Something's not right"],
		})
	})

	testInFiber('getPeripheralDevice', async () => {
		const gotDevice: PeripheralDevicePublic = await MeteorCall.peripheralDevice.getPeripheralDevice(
			device._id,
			device.token
		)
		expect(gotDevice).toBeTruthy()
		expect(gotDevice._id).toBe(device._id)
	})

	testInFiber('ping', async () => {
		expect(PeripheralDevices.findOne(device._id)).toBeTruthy()
		const lastSeen = (PeripheralDevices.findOne(device._id) as PeripheralDevice).lastSeen
		await MeteorCall.peripheralDevice.ping(device._id, device.token)
		expect((PeripheralDevices.findOne(device._id) as PeripheralDevice).lastSeen).toBeGreaterThan(lastSeen)
	})

	testInFiber('determineDiffTime', async () => {
		const response = await MeteorCall.peripheralDevice.determineDiffTime()
		expect(response).toBeTruthy()
		expect(Math.abs(response.mean - 400)).toBeLessThan(10) // be about 400
		expect(response.stdDev).toBeLessThan(10)
		expect(response.stdDev).toBeGreaterThan(0.1)
	})

	testInFiber('getTimeDiff', async () => {
		const response = await MeteorCall.peripheralDevice.getTimeDiff()
		const now = getCurrentTime()
		expect(response).toBeTruthy()
		expect(response.currentTime).toBeGreaterThan(now - 30)
		expect(response.currentTime).toBeLessThan(now + 30)
		expect(response.systemRawTime).toBeGreaterThan(0)
		expect(response.diff).toBeDefined()
		expect(response.stdDev).toBeDefined()
		expect(response.good).toBeDefined()
	})

	testInFiber('getTime', async () => {
		const response = await MeteorCall.peripheralDevice.getTime()
		const now = getCurrentTime()
		expect(response).toBeGreaterThan(now - 30)
		expect(response).toBeLessThan(now + 30)
	})

	testInFiber('pingWithCommand and functionReply', async () => {
		if (DEBUG) setLogLevel(LogLevel.DEBUG)

		let resultErr = undefined
		let resultMessage = undefined
		const pingCompleted = (err, msg) => {
			resultErr = err
			resultMessage = msg
		}

		// This is very odd. Ping command is sent and lastSeen updated before response
		const device2 = PeripheralDevices.findOne(device._id) as PeripheralDevice
		expect(device2).toBeTruthy()
		// Decrease lastSeen to ensure that the call below updates it
		const lastSeen = device2.lastSeen - 100
		PeripheralDevices.update(device._id, { $set: { lastSeen: lastSeen } })

		const message = 'Waving!'
		// Note: the null is so that Metor doesnt try to use pingCompleted  as a callback instead of blocking
		await MeteorCall.peripheralDevice.pingWithCommand(device._id, device.token, message, pingCompleted)
		expect((PeripheralDevices.findOne(device._id) as PeripheralDevice).lastSeen).toBeGreaterThan(lastSeen)
		const command = PeripheralDeviceCommands.find({ deviceId: device._id }).fetch()[0]
		expect(command).toBeTruthy()
		expect(command.hasReply).toBeFalsy()
		expect(command.functionName).toBe('pingResponse')
		expect(command.args).toEqual([message])

		expect(resultErr).toBeUndefined()
		expect(resultMessage).toBeUndefined()

		const replyMessage = 'Waving back!'
		Meteor.call(
			PeripheralDeviceAPIMethods.functionReply,
			device._id,
			device.token,
			command._id,
			undefined,
			replyMessage
		)
		await sleep(10)
		expect(PeripheralDeviceCommands.findOne()).toBeFalsy()

		expect(resultErr).toBeNull()
		expect(resultMessage).toEqual(replyMessage)
	})

	testInFiber('playoutPlaybackChanged', async () => {
		if (DEBUG) setLogLevel(LogLevel.DEBUG)

		QueueStudioJobSpy.mockImplementation(async () => CreateFakeResult(Promise.resolve(null)))

		const partInstanceId = getRandomId()
		const pieceInstanceId = getRandomId()
		const time0 = getCurrentTime()
		const time1 = getCurrentTime()
		const time2 = getCurrentTime()
		const time3 = getCurrentTime()
		await MeteorCall.peripheralDevice.playoutPlaybackChanged(device._id, device.token, {
			rundownPlaylistId: rundownPlaylistID,
			changes: [
				{
					type: PlayoutChangedType.PART_PLAYBACK_STARTED,
					objId: 'object-id',
					data: {
						partInstanceId,
						time: time0,
					},
				},
				{
					type: PlayoutChangedType.PART_PLAYBACK_STOPPED,
					objId: 'object-id',
					data: {
						partInstanceId,
						time: time1,
					},
				},
				{
					type: PlayoutChangedType.PIECE_PLAYBACK_STARTED,
					objId: 'object-id',
					data: {
						partInstanceId,
						pieceInstanceId,
						time: time2,
					},
				},
				{
					type: PlayoutChangedType.PIECE_PLAYBACK_STOPPED,
					objId: 'object-id',
					data: {
						partInstanceId,
						pieceInstanceId,
						time: time3,
					},
				},
			],
		})

		expect(QueueStudioJobSpy).toHaveBeenCalledTimes(1)
		expect(QueueStudioJobSpy).toHaveBeenNthCalledWith(
			1,
			StudioJobs.OnPlayoutPlaybackChanged,
			device.studioId,
			literal<Parameters<StudioJobFunc[StudioJobs.OnPlayoutPlaybackChanged]>[0]>({
				playlistId: rundownPlaylistID,
				changes: [
					{
						type: PlayoutChangedType.PART_PLAYBACK_STARTED,
						objId: 'object-id',
						data: {
							partInstanceId,
							time: time0,
						},
					},
					{
						type: PlayoutChangedType.PART_PLAYBACK_STOPPED,
						objId: 'object-id',
						data: {
							partInstanceId,
							time: time1,
						},
					},
					{
						type: PlayoutChangedType.PIECE_PLAYBACK_STARTED,
						objId: 'object-id',
						data: {
							partInstanceId,
							pieceInstanceId,
							time: time2,
						},
					},
					{
						type: PlayoutChangedType.PIECE_PLAYBACK_STOPPED,
						objId: 'object-id',
						data: {
							partInstanceId,
							pieceInstanceId,
							time: time3,
						},
					},
				],
			})
		)
	})

	testInFiber('timelineTriggerTime', async () => {
		if (DEBUG) setLogLevel(LogLevel.DEBUG)

		QueueStudioJobSpy.mockImplementation(async () => CreateFakeResult(Promise.resolve(null)))

		const timelineTriggerTimeResult: TimelineTriggerTimeResult = []
		for (let i = 0; i < 10; i++) {
			timelineTriggerTimeResult.push({
				id: getRandomString(),
				time: getCurrentTime(),
			})
		}

		await MeteorCall.peripheralDevice.timelineTriggerTime(device._id, device.token, timelineTriggerTimeResult)

		expect(QueueStudioJobSpy).toHaveBeenCalledTimes(1)
		expect(QueueStudioJobSpy).toHaveBeenNthCalledWith(
			1,
			StudioJobs.OnTimelineTriggerTime,
			device.studioId,
			literal<OnTimelineTriggerTimeProps>({
				results: timelineTriggerTimeResult,
			})
		)
	})

	testInFiber('killProcess with a rundown present', async () => {
		// test this does not shutdown because Rundown stored
		if (DEBUG) setLogLevel(LogLevel.DEBUG)
		await expect(MeteorCall.peripheralDevice.killProcess(device._id, device.token, true)).rejects.toThrowMeteor(
			400,
			`Unable to run killProcess: Rundowns not empty!`
		)
	})

	testInFiber('testMethod', async () => {
		if (DEBUG) setLogLevel(LogLevel.DEBUG)
		const result = await MeteorCall.peripheralDevice.testMethod(device._id, device.token, 'european')
		expect(result).toBe('european')
		await expect(
			MeteorCall.peripheralDevice.testMethod(device._id, device.token, 'european', true)
		).rejects.toThrowMeteor(418, `Error thrown, as requested`)
	})

	/*
	testInFiber('timelineTriggerTime', () => {
		if (DEBUG) setLogLevel(LogLevel.DEBUG)
		let timelineTriggerTimeResult: PeripheralDeviceAPI.TimelineTriggerTimeResult = [
			{ id: 'wibble', time: getCurrentTime() }, { id: 'wobble', time: getCurrentTime() - 100 }]
		Meteor.call(PeripheralDeviceAPIMethods.timelineTriggerTime, device._id, device.token, timelineTriggerTimeResult)
	})
	*/

	testInFiber('requestUserAuthToken', async () => {
		if (DEBUG) setLogLevel(LogLevel.DEBUG)

		await expect(
			MeteorCall.peripheralDevice.requestUserAuthToken(device._id, device.token, 'https://auth.url/')
		).rejects.toThrowMeteor(400, 'can only request user auth token for peripheral device of spreadsheet type')

		PeripheralDevices.update(device._id, {
			$set: {
				type: PeripheralDeviceType.SPREADSHEET,
			},
		})
		await MeteorCall.peripheralDevice.requestUserAuthToken(device._id, device.token, 'https://auth.url/')
		const deviceWithAccessToken = PeripheralDevices.findOne(device._id) as PeripheralDevice
		expect(deviceWithAccessToken).toBeTruthy()
		expect(deviceWithAccessToken.accessTokenUrl).toBe('https://auth.url/')

		PeripheralDevices.update(device._id, {
			$set: {
				type: PeripheralDeviceType.MOS,
			},
		})
	})

	// Should only really work for SpreadsheetDevice
	testInFiber('storeAccessToken', async () => {
		if (DEBUG) setLogLevel(LogLevel.DEBUG)
		await expect(
			MeteorCall.peripheralDevice.storeAccessToken(device._id, device.token, 'https://auth.url/')
		).rejects.toThrowMeteor(400, 'can only store access token for peripheral device of spreadsheet type')

		PeripheralDevices.update(device._id, {
			$set: {
				type: PeripheralDeviceType.SPREADSHEET,
			},
		})

		await MeteorCall.peripheralDevice.storeAccessToken(device._id, device.token, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ')
		const deviceWithSecretToken = PeripheralDevices.findOne(device._id) as PeripheralDevice
		expect(deviceWithSecretToken).toBeTruthy()
		expect(deviceWithSecretToken.accessTokenUrl).toBe('')
		expect((deviceWithSecretToken.secretSettings as IngestDeviceSecretSettings).accessToken).toBe(
			'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
		)
		expect((deviceWithSecretToken.settings as IngestDeviceSettings).secretAccessToken).toBe(true)
	})

	testInFiber('uninitialize', async () => {
		if (DEBUG) setLogLevel(LogLevel.DEBUG)
		await MeteorCall.peripheralDevice.unInitialize(device._id, device.token)
		expect(PeripheralDevices.findOne()).toBeFalsy()

		device = (await setupDefaultStudioEnvironment()).ingestDevice
		expect(PeripheralDevices.findOne()).toBeTruthy()
	})

	// Note: this test fails, due to a backwards-compatibility hack in #c579c8f0
	// testInFiber('initialize with bad arguments', () => {
	// 	let options: PeripheralDeviceInitOptions = {
	// 		category: PeripheralDeviceCategory.INGEST,
	// 		type: PeripheralDeviceType.MOS,
	// 		subType: 'mos_connection',
	// 		name: 'test',
	// 		connectionId: 'test',
	// 		configManifest: {
	// 			deviceConfig: [],
	// 		},
	// 	}

	// 	try {
	// 		Meteor.call(PeripheralDeviceAPIMethods.initialize, device._id, device.token.slice(0, -1), options)
	// 		fail('expected to throw')
	// 	} catch (e) {
	// 		expect(e.message).toBe(`[401] Not allowed access to peripheralDevice`)
	// 	}
	// })

	// testInFiber('setStatus with bad arguments', () => {
	// 	try {
	// 		Meteor.call(PeripheralDeviceAPIMethods.setStatus, 'wibbly', device.token, { statusCode: 0 })
	// 		fail('expected to throw')
	// 	} catch (e) {
	// 		expect(e.message).toBe(`[404] PeripheralDevice "wibbly" not found`)
	// 	}

	// 	try {
	// 		Meteor.call(PeripheralDeviceAPIMethods.setStatus, device._id, device.token.slice(0, -1), { statusCode: 0 })
	// 		fail('expected to throw')
	// 	} catch (e) {
	// 		expect(e.message).toBe(`[401] Not allowed access to peripheralDevice`)
	// 	}

	// 	try {
	// 		Meteor.call(PeripheralDeviceAPIMethods.setStatus, device._id, device.token, { statusCode: 42 })
	// 		fail('expected to throw')
	// 	} catch (e) {
	// 		expect(e.message).toBe(`[400] device status code is not known`)
	// 	}
	// })

	testInFiber('removePeripheralDevice', async () => {
		{
			const deviceObj = PeripheralDevices.findOne(device?._id)
			expect(deviceObj).toBeDefined()

			await MeteorCall.peripheralDevice.removePeripheralDevice(device?._id)
		}

		{
			const deviceObj = PeripheralDevices.findOne(device?._id)
			expect(deviceObj).toBeUndefined()
		}
	})

	// test MediaManagerIntegration API
	describe('Media Manager API', () => {
		let workFlowId: ProtectedString<any>
		let workStepIds: ProtectedString<any>[]
		let deviceId: ProtectedString<any>
		let device: PeripheralDevice
		beforeEach(async () => {
			workFlowId = getRandomId()
			workStepIds = [getRandomId(), getRandomId()]
			deviceId = getRandomId()
			env = await setupDefaultStudioEnvironment()
			PeripheralDevices.insert({
				_id: deviceId,
				organizationId: null,
				name: 'Mock Media Manager',
				studioId: env.studio._id,
				settings: {},
				category: PeripheralDeviceCategory.MEDIA_MANAGER,
				configManifest: {
					deviceConfig: [],
				},
				connected: true,
				connectionId: '0',
				created: 0,
				lastConnected: 0,
				lastSeen: 0,
				status: {
					statusCode: StatusCode.GOOD,
				},
				subType: '_process',
				token: 'MockToken',
				type: PeripheralDeviceType.MEDIA_MANAGER,
			})
			device = PeripheralDevices.findOne(deviceId)!
			MediaWorkFlows.insert({
				_id: workFlowId,
				_rev: '1',
				created: 0,
				deviceId: device._id,
				priority: 1,
				source: 'MockSource',
				studioId: device.studioId!,
				finished: false,
				success: false,
			})
			MediaWorkFlowSteps.insert({
				_id: workStepIds[0],
				_rev: '1',
				criticalStep: false,
				action: MediaManagerAPI.WorkStepAction.COPY,
				deviceId: device._id,
				priority: 2,
				status: MediaManagerAPI.WorkStepStatus.IDLE,
				studioId: device.studioId!,
				workFlowId: workFlowId,
			})
			MediaWorkFlowSteps.insert({
				_id: workStepIds[1],
				_rev: '1',
				criticalStep: false,
				action: MediaManagerAPI.WorkStepAction.GENERATE_METADATA,
				deviceId: device._id,
				priority: 1,
				status: MediaManagerAPI.WorkStepStatus.IDLE,
				studioId: device.studioId!,
				workFlowId: workFlowId,
			})
		})
		testInFiber('getMediaWorkFlowRevisions', async () => {
			const workFlows = MediaWorkFlows.find({
				studioId: device.studioId,
			})
				.fetch()
				.map((wf) => ({
					_id: wf._id,
					_rev: wf._rev,
				}))
			expect(workFlows.length).toBeGreaterThan(0)
			const res = await MeteorCall.peripheralDevice.getMediaWorkFlowRevisions(device._id, device.token)
			expect(res).toHaveLength(workFlows.length)
			expect(res).toMatchObject(workFlows)
		})
		testInFiber('getMediaWorkFlowStepRevisions', async () => {
			const workFlowSteps = MediaWorkFlowSteps.find({
				studioId: device.studioId,
			})
				.fetch()
				.map((wf) => ({
					_id: wf._id,
					_rev: wf._rev,
				}))
			expect(workFlowSteps.length).toBeGreaterThan(0)
			const res = await MeteorCall.peripheralDevice.getMediaWorkFlowStepRevisions(device._id, device.token)
			expect(res).toHaveLength(workFlowSteps.length)
			expect(res).toMatchObject(workFlowSteps)
		})
		describe('updateMediaWorkFlow', () => {
			testInFiber('update', async () => {
				const workFlow = MediaWorkFlows.findOne(workFlowId)

				expect(workFlow).toBeTruthy()
				const newWorkFlow = Object.assign({}, workFlow)
				newWorkFlow._rev = '2'
				newWorkFlow.comment = 'New comment'

				await MeteorCall.peripheralDevice.updateMediaWorkFlow(
					device._id,
					device.token,
					newWorkFlow._id,
					newWorkFlow
				)

				const updatedWorkFlow = MediaWorkFlows.findOne(workFlowId)
				expect(updatedWorkFlow).toMatchObject(newWorkFlow)
			})
			testInFiber('remove', async () => {
				const workFlow = MediaWorkFlows.findOne(workFlowId) as MediaWorkFlow
				expect(workFlow).toBeTruthy()

				await MeteorCall.peripheralDevice.updateMediaWorkFlow(device._id, device.token, workFlow._id, null)

				const updatedWorkFlow = MediaWorkFlows.findOne(workFlowId)
				expect(updatedWorkFlow).toBeFalsy()
			})
		})
		describe('updateMediaWorkFlowStep', () => {
			testInFiber('update', async () => {
				const workStep = MediaWorkFlowSteps.findOne(workStepIds[0])

				expect(workStep).toBeTruthy()
				const newWorkStep = Object.assign({}, workStep)
				newWorkStep._rev = '2'
				newWorkStep.status = MediaManagerAPI.WorkStepStatus.WORKING

				await MeteorCall.peripheralDevice.updateMediaWorkFlowStep(
					device._id,
					device.token,
					newWorkStep._id,
					newWorkStep
				)

				const updatedWorkFlow = MediaWorkFlowSteps.findOne(workStepIds[0])
				expect(updatedWorkFlow).toMatchObject(newWorkStep)
			})
			testInFiber('remove', async () => {
				const workStep = MediaWorkFlowSteps.findOne(workStepIds[0]) as MediaWorkFlowStep
				expect(workStep).toBeTruthy()

				await MeteorCall.peripheralDevice.updateMediaWorkFlowStep(device._id, device.token, workStep._id, null)

				const updatedWorkFlow = MediaWorkFlowSteps.findOne(workStepIds[0])
				expect(updatedWorkFlow).toBeFalsy()
			})
		})
	})

	// test Media Scanner API
	describe('Media Scanner API', () => {
		let deviceId: ProtectedString<any>
		const MOCK_COLLECTION = 'MockCollection'
		const MOCK_MEDIA_ID = 'SOME_FILE'.toUpperCase()
		const MOCK_OBJID = getRandomString()
		beforeEach(async () => {
			deviceId = getRandomId()
			env = await setupDefaultStudioEnvironment()
			PeripheralDevices.insert({
				_id: deviceId,
				organizationId: null,
				name: 'Mock Media Manager',
				studioId: env.studio._id,
				settings: {},
				category: PeripheralDeviceCategory.MEDIA_MANAGER,
				configManifest: {
					deviceConfig: [],
				},
				connected: true,
				connectionId: '0',
				created: 0,
				lastConnected: 0,
				lastSeen: 0,
				status: {
					statusCode: StatusCode.GOOD,
				},
				subType: '_process',
				token: 'MockToken',
				type: PeripheralDeviceType.MEDIA_MANAGER,
			})
			device = PeripheralDevices.findOne(deviceId)!

			MediaObjects.remove({
				collectionId: MOCK_COLLECTION,
			})
			MediaObjects.insert({
				_id: protectString(MOCK_COLLECTION + '_' + MOCK_OBJID),
				_rev: '1',
				_attachments: {},
				cinf: '',
				collectionId: MOCK_COLLECTION,
				mediaId: MOCK_MEDIA_ID,
				mediaPath: '',
				mediaSize: 10,
				mediaTime: 0,
				objId: MOCK_OBJID,
				studioId: device.studioId!,
				thumbSize: 0,
				thumbTime: 0,
				tinf: '',
			})
		})
		testInFiber('getMediaObjectRevisions', async () => {
			const mobjects = MediaObjects.find({
				studioId: device.studioId,
			})
				.fetch()
				.map((mo) => ({
					_id: mo._id,
					_rev: mo._rev,
				}))
			expect(mobjects.length).toBeGreaterThan(0)

			const revs = await MeteorCall.peripheralDevice.getMediaObjectRevisions(
				device._id,
				device.token,
				MOCK_COLLECTION
			)

			expect(revs.length).toBe(mobjects.length)
			expect(mobjects).toMatchObject(mobjects)
		})
		describe('updateMediaObject', () => {
			testInFiber('update', async () => {
				const mo = MediaObjects.findOne({
					collectionId: MOCK_COLLECTION,
					studioId: device.studioId!,
				}) as MediaObject
				expect(mo).toBeTruthy()

				const newMo = Object.assign({}, mo)
				newMo._rev = '2'
				newMo.cinf = 'MOCK CINF'

				await MeteorCall.peripheralDevice.updateMediaObject(
					device._id,
					device.token,
					MOCK_COLLECTION,
					mo.objId,
					newMo
				)

				const updateMo = MediaObjects.findOne({
					collectionId: MOCK_COLLECTION,
					studioId: device.studioId!,
				})
				expect(updateMo).toMatchObject(newMo)
			})
			testInFiber('remove', async () => {
				const mo = MediaObjects.findOne({
					collectionId: MOCK_COLLECTION,
					studioId: device.studioId!,
				}) as MediaObject
				expect(mo).toBeTruthy()

				await MeteorCall.peripheralDevice.updateMediaObject(
					device._id,
					device.token,
					MOCK_COLLECTION,
					mo.objId,
					null
				)

				const updateMo = MediaObjects.findOne({
					collectionId: MOCK_COLLECTION,
					studioId: device.studioId!,
				})
				expect(updateMo).toBeFalsy()
			})
		})
	})
})
