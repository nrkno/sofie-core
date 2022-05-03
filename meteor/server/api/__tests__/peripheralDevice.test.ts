import '../../../__mocks__/_extendJest'
import { Meteor } from 'meteor/meteor'
import {
	PeripheralDevice,
	PeripheralDeviceCategory,
	PeripheralDevices,
	PeripheralDeviceType,
} from '../../../lib/collections/PeripheralDevices'
import { PeripheralDeviceCommands } from '../../../lib/collections/PeripheralDeviceCommands'
import { Rundowns, RundownId } from '../../../lib/collections/Rundowns'
import { Segments, SegmentId } from '../../../lib/collections/Segments'
import { Parts } from '../../../lib/collections/Parts'
import { EmptyPieceTimelineObjectsBlob, Pieces, PieceStatusCode } from '../../../lib/collections/Pieces'
import { PeripheralDeviceAPI, PeripheralDeviceAPIMethods } from '../../../lib/api/peripheralDevice'
import {
	getCurrentTime,
	literal,
	protectString,
	ProtectedString,
	waitTime,
	getRandomId,
	LogLevel,
	getRandomString,
} from '../../../lib/lib'

import { MOS } from '@sofie-automation/corelib'
import { testInFiber } from '../../../__mocks__/helpers/jest'
import { setupDefaultStudioEnvironment, DefaultEnvironment } from '../../../__mocks__/helpers/database'
import { setLogLevel } from '../../logging'
import { RundownPlaylists, RundownPlaylistId } from '../../../lib/collections/RundownPlaylists'
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
import {
	OnPartPlaybackStartedProps,
	OnPartPlaybackStoppedProps,
	OnPiecePlaybackStartedProps,
	OnPiecePlaybackStoppedProps,
	OnTimelineTriggerTimeProps,
	StudioJobs,
} from '@sofie-automation/corelib/dist/worker/studio'
import { MeteorCall } from '../../../lib/api/methods'

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
			_rank: 0,
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
			sourceLayerId: env.showStyleBase.sourceLayers[0]._id,
			outputLayerId: env.showStyleBase.outputLayers[0]._id,
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

		const options: PeripheralDeviceAPI.InitOptions = {
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
		const gotDevice: PeripheralDevice = await MeteorCall.peripheralDevice.getPeripheralDevice(
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
		waitTime(10)
		expect(PeripheralDeviceCommands.findOne()).toBeFalsy()

		expect(resultErr).toBeNull()
		expect(resultMessage).toEqual(replyMessage)
	})

	testInFiber('partPlaybackStarted', async () => {
		if (DEBUG) setLogLevel(LogLevel.DEBUG)

		QueueStudioJobSpy.mockImplementation(async () => CreateFakeResult(Promise.resolve(null)))

		const partPlaybackStartedResult: PeripheralDeviceAPI.PartPlaybackStartedResult = {
			rundownPlaylistId: rundownPlaylistID,
			partInstanceId: getRandomId(),
			time: getCurrentTime(),
		}
		await MeteorCall.peripheralDevice.partPlaybackStarted(device._id, device.token, partPlaybackStartedResult)

		expect(QueueStudioJobSpy).toHaveBeenCalledTimes(1)
		expect(QueueStudioJobSpy).toHaveBeenNthCalledWith(
			1,
			StudioJobs.OnPartPlaybackStarted,
			device.studioId,
			literal<OnPartPlaybackStartedProps>({
				playlistId: partPlaybackStartedResult.rundownPlaylistId,
				partInstanceId: partPlaybackStartedResult.partInstanceId,
				startedPlayback: partPlaybackStartedResult.time,
			})
		)
	})

	testInFiber('partPlaybackStopped', async () => {
		if (DEBUG) setLogLevel(LogLevel.DEBUG)

		QueueStudioJobSpy.mockImplementation(async () => CreateFakeResult(Promise.resolve(null)))

		const partPlaybackStoppedResult: PeripheralDeviceAPI.PartPlaybackStoppedResult = {
			rundownPlaylistId: rundownPlaylistID,
			partInstanceId: getRandomId(),
			time: getCurrentTime(),
		}

		await MeteorCall.peripheralDevice.partPlaybackStopped(device._id, device.token, partPlaybackStoppedResult)

		expect(QueueStudioJobSpy).toHaveBeenCalledTimes(1)
		expect(QueueStudioJobSpy).toHaveBeenNthCalledWith(
			1,
			StudioJobs.OnPartPlaybackStopped,
			device.studioId,
			literal<OnPartPlaybackStoppedProps>({
				playlistId: partPlaybackStoppedResult.rundownPlaylistId,
				partInstanceId: partPlaybackStoppedResult.partInstanceId,
				stoppedPlayback: partPlaybackStoppedResult.time,
			})
		)
	})

	testInFiber('piecePlaybackStarted', async () => {
		if (DEBUG) setLogLevel(LogLevel.DEBUG)

		QueueStudioJobSpy.mockImplementation(async () => CreateFakeResult(Promise.resolve(null)))

		const piecePlaybackStartedResult: PeripheralDeviceAPI.PiecePlaybackStartedResult = {
			rundownPlaylistId: rundownPlaylistID,
			pieceInstanceId: getRandomId(),
			time: getCurrentTime(),
		}

		await MeteorCall.peripheralDevice.piecePlaybackStarted(device._id, device.token, piecePlaybackStartedResult)

		expect(QueueStudioJobSpy).toHaveBeenCalledTimes(1)
		expect(QueueStudioJobSpy).toHaveBeenNthCalledWith(
			1,
			StudioJobs.OnPiecePlaybackStarted,
			device.studioId,
			literal<OnPiecePlaybackStartedProps>({
				playlistId: piecePlaybackStartedResult.rundownPlaylistId,
				pieceInstanceId: piecePlaybackStartedResult.pieceInstanceId,
				startedPlayback: piecePlaybackStartedResult.time,
			})
		)
	})

	testInFiber('piecePlaybackStopped', async () => {
		if (DEBUG) setLogLevel(LogLevel.DEBUG)

		QueueStudioJobSpy.mockImplementation(async () => CreateFakeResult(Promise.resolve(null)))

		const piecePlaybackStoppedResult: PeripheralDeviceAPI.PiecePlaybackStoppedResult = {
			rundownPlaylistId: rundownPlaylistID,
			pieceInstanceId: getRandomId(),
			time: getCurrentTime(),
		}

		await MeteorCall.peripheralDevice.piecePlaybackStopped(device._id, device.token, piecePlaybackStoppedResult)

		expect(QueueStudioJobSpy).toHaveBeenCalledTimes(1)
		expect(QueueStudioJobSpy).toHaveBeenNthCalledWith(
			1,
			StudioJobs.OnPiecePlaybackStopped,
			device.studioId,
			literal<OnPiecePlaybackStoppedProps>({
				playlistId: piecePlaybackStoppedResult.rundownPlaylistId,
				pieceInstanceId: piecePlaybackStoppedResult.pieceInstanceId,
				stoppedPlayback: piecePlaybackStoppedResult.time,
			})
		)
	})

	testInFiber('timelineTriggerTime', async () => {
		if (DEBUG) setLogLevel(LogLevel.DEBUG)

		QueueStudioJobSpy.mockImplementation(async () => CreateFakeResult(Promise.resolve(null)))

		const timelineTriggerTimeResult: PeripheralDeviceAPI.TimelineTriggerTimeResult = []
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
			MeteorCall.peripheralDevice.requestUserAuthToken(device._id, device.token, 'http://auth.url/')
		).rejects.toThrowMeteor(400, 'can only request user auth token for peripheral device of spreadsheet type')

		PeripheralDevices.update(device._id, {
			$set: {
				type: PeripheralDeviceType.SPREADSHEET,
			},
		})
		await MeteorCall.peripheralDevice.requestUserAuthToken(device._id, device.token, 'http://auth.url/')
		const deviceWithAccessToken = PeripheralDevices.findOne(device._id) as PeripheralDevice
		expect(deviceWithAccessToken).toBeTruthy()
		expect(deviceWithAccessToken.accessTokenUrl).toBe('http://auth.url/')

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
			MeteorCall.peripheralDevice.storeAccessToken(device._id, device.token, 'http://auth.url/')
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
	// 	let options: PeripheralDeviceAPI.InitOptions = {
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

// Note: The data below is copied straight from the test data in mos-connection
const _xmlApiData = {
	rundownCreate: literal<MOS.IMOSRunningOrder>({
		ID: new MOS.MosString128('96857485'),
		Slug: new MOS.MosString128('5PM RUNDOWN'),
		// DefaultChannel?: MOS.MosString128,
		EditorialStart: new MOS.MosTime('2009-04-17T17:02:00'),
		EditorialDuration: new MOS.MosDuration('00:58:25'), // @todo: change this into a real Duration
		// Trigger?: any // TODO: Johan frågar vad denna gör,
		// MacrundownIn?: MOS.MosString128,
		// MacrundownOut?: MOS.MosString128,
		// MosExternalMetaData?: Array<IMOSExternalMetaData>,
		Stories: [
			literal<MOS.IMOSROStory>({
				ID: new MOS.MosString128('5983A501:0049B924:8390EF2B'),
				Slug: new MOS.MosString128('COLSTAT MURDER'),
				Number: new MOS.MosString128('A5'),
				// MosExternalMetaData: Array<IMOSExternalMetaData>
				Items: [
					literal<MOS.IMOSItem>({
						ID: new MOS.MosString128('0'),
						Slug: new MOS.MosString128('OLSTAT MURDER:VO'),
						ObjectID: new MOS.MosString128('M000224'),
						MOSID: 'testmos.enps.com',
						// mosAbstract?: '',
						Paths: [
							literal<MOS.IMOSObjectPath>({
								Type: MOS.IMOSObjectPathType.PATH,
								Description: 'MPEG2 Video',
								Target: '\\server\\media\\clip392028cd2320s0d.mxf',
							}),
							literal<MOS.IMOSObjectPath>({
								Type: MOS.IMOSObjectPathType.PROXY_PATH,
								Description: 'WM9 750Kbps',
								Target: 'http://server/proxy/clipe.wmv',
							}),
							literal<MOS.IMOSObjectPath>({
								Type: MOS.IMOSObjectPathType.METADATA_PATH,
								Description: 'MOS Object',
								Target: 'http://server/proxy/clipe.xml',
							}),
						],
						// Channel?: new MOS.MosString128(),
						// EditorialStart?: MOS.MosTime
						EditorialDuration: 645,
						UserTimingDuration: 310,
						Trigger: 'CHAINED', // TODO: Johan frågar
						// MacrundownIn?: new MOS.MosString128(),
						// MacrundownOut?: new MOS.MosString128(),
						// MosExternalMetaData?: Array<IMOSExternalMetaData>
					}),
				],
			}),
			literal<MOS.IMOSROStory>({
				ID: new MOS.MosString128('3854737F:0003A34D:983A0B28'),
				Slug: new MOS.MosString128('AIRLINE INSPECTIONS'),
				Number: new MOS.MosString128('A6'),
				// MosExternalMetaData: Array<IMOSExternalMetaData>
				Items: [
					literal<MOS.IMOSItem>({
						ID: new MOS.MosString128('0'),
						// Slug: new MOS.MosString128(''),
						ObjectID: new MOS.MosString128('M000133'),
						MOSID: 'testmos.enps.com',
						// mosAbstract?: '',
						// Channel?: new MOS.MosString128(),
						EditorialStart: 55,
						EditorialDuration: 310,
						UserTimingDuration: 200,
						// Trigger: 'CHAINED' // TODO: Johan frågar
						// MacrundownIn?: new MOS.MosString128(),
						// MacrundownOut?: new MOS.MosString128(),
						// MosExternalMetaData?: Array<IMOSExternalMetaData>
					}),
				],
			}),
		],
	}),
	rundownReplace: literal<MOS.IMOSRunningOrder>({
		ID: new MOS.MosString128('96857485'),
		Slug: new MOS.MosString128('5PM RUNDOWN'),
		// DefaultChannel?: MOS.MosString128,
		// EditorialStart: new MOS.MosTime('2009-04-17T17:02:00'),
		// EditorialDuration: '00:58:25', // @todo: change this into a real Duration
		// Trigger?: any // TODO: Johan frågar vad denna gör,
		// MacrundownIn?: MOS.MosString128,
		// MacrundownOut?: MOS.MosString128,
		// MosExternalMetaData?: Array<IMOSExternalMetaData>,
		Stories: [
			literal<MOS.IMOSROStory>({
				ID: new MOS.MosString128('5983A501:0049B924:8390EF2B'),
				Slug: new MOS.MosString128('COLSTAT MURDER'),
				Number: new MOS.MosString128('A1'),
				// MosExternalMetaData: Array<IMOSExternalMetaData>
				Items: [
					literal<MOS.IMOSItem>({
						ID: new MOS.MosString128('0'),
						Slug: new MOS.MosString128('OLSTAT MURDER:VO'),
						ObjectID: new MOS.MosString128('M000224'),
						MOSID: 'testmos.enps.com',
						// mosAbstract?: '',
						Paths: [
							literal<MOS.IMOSObjectPath>({
								Type: MOS.IMOSObjectPathType.PATH,
								Description: 'MPEG2 Video',
								Target: '\\servermediaclip392028cd2320s0d.mxf',
							}),
							literal<MOS.IMOSObjectPath>({
								Type: MOS.IMOSObjectPathType.PROXY_PATH,
								Description: 'WM9 750Kbps',
								Target: 'http://server/proxy/clipe.wmv',
							}),
							literal<MOS.IMOSObjectPath>({
								Type: MOS.IMOSObjectPathType.METADATA_PATH,
								Description: 'MOS Object',
								Target: 'http://server/proxy/clipe.xml',
							}),
						],
						// Channel?: new MOS.MosString128(),
						// EditorialStart?: MOS.MosTime
						EditorialDuration: 645,
						UserTimingDuration: 310,
						Trigger: 'CHAINED', // TODO: Johan frågar
						// MacrundownIn?: new MOS.MosString128(),
						// MacrundownOut?: new MOS.MosString128(),
						// MosExternalMetaData?: Array<IMOSExternalMetaData>
					}),
				],
			}),
			literal<MOS.IMOSROStory>({
				ID: new MOS.MosString128('3852737F:0013A64D:923A0B28'),
				Slug: new MOS.MosString128('AIRLINE SAFETY'),
				Number: new MOS.MosString128('A2'),
				// MosExternalMetaData: Array<IMOSExternalMetaData>
				Items: [
					literal<MOS.IMOSItem>({
						ID: new MOS.MosString128('0'),
						// Slug: new MOS.MosString128(''),
						ObjectID: new MOS.MosString128('M000295'),
						MOSID: 'testmos.enps.com',
						// mosAbstract?: '',
						// Channel?: new MOS.MosString128(),
						EditorialStart: 500,
						EditorialDuration: 600,
						UserTimingDuration: 310,
						// Trigger: 'CHAINED' // TODO: Johan frågar
						// MacrundownIn?: new MOS.MosString128(),
						// MacrundownOut?: new MOS.MosString128(),
						// MosExternalMetaData?: Array<IMOSExternalMetaData>
					}),
				],
			}),
		],
	}),
	rundownDelete: 49478285,
	rundownList: literal<MOS.IMOSObject>({
		ID: new MOS.MosString128('M000123'),
		Slug: new MOS.MosString128('Hotel Fire'),
		// MosAbstract: string,
		Group: 'Show 7',
		Type: MOS.IMOSObjectType.VIDEO,
		TimeBase: 59.94,
		Revision: 1,
		Duration: 1800,
		Status: MOS.IMOSObjectStatus.NEW,
		AirStatus: MOS.IMOSObjectAirStatus.READY,
		Paths: [
			{
				Type: MOS.IMOSObjectPathType.PATH,
				Description: 'MPEG2 Video',
				Target: '\\servermediaclip392028cd2320s0d.mxf',
			},
			{
				Type: MOS.IMOSObjectPathType.PROXY_PATH,
				Description: 'WM9 750Kbps',
				Target: 'http://server/proxy/clipe.wmv',
			},
			{
				Type: MOS.IMOSObjectPathType.METADATA_PATH,
				Description: 'MOS Object',
				Target: 'http://server/proxy/clipe.xml',
			},
		],
		CreatedBy: new MOS.MosString128('Chris'),
		Created: new MOS.MosTime('2009-10-31T23:39:12'),
		ChangedBy: new MOS.MosString128('Chris'),
		Changed: new MOS.MosTime('2009-10-31T23:39:12'),
		// Description: string
		// mosExternalMetaData?: Array<IMOSExternalMetaData>
	}),
	rundownMetadataReplace: literal<MOS.IMOSRunningOrderBase>({
		ID: new MOS.MosString128('96857485'),
		Slug: new MOS.MosString128('5PM RUNDOWN'),
		// DefaultChannel?: new MOS.MosString128(''),
		EditorialStart: new MOS.MosTime('2009-04-17T17:02:00'),
		EditorialDuration: new MOS.MosDuration('00:58:25'),
		// Trigger?: any // TODO: Johan frågar vad denna gör
		// MacrundownIn?: new MOS.MosString128(''),
		// MacrundownOut?: new MOS.MosString128(''),
		// MosExternalMetaData?: Array<IMOSExternalMetaData>
	}),
	rundownElementStat_rundown: literal<MOS.IMOSRunningOrderStatus>({
		ID: new MOS.MosString128('5PM'),
		Status: MOS.IMOSObjectStatus.MANUAL_CTRL,
		Time: new MOS.MosTime('2009-04-11T14:13:53'),
	}),
	rundownElementStat_story: literal<MOS.IMOSStoryStatus>({
		RunningOrderId: new MOS.MosString128('5PM'),
		ID: new MOS.MosString128('HOTEL FIRE'),
		Status: MOS.IMOSObjectStatus.PLAY,
		Time: new MOS.MosTime('1999-04-11T14:13:53'),
	}),
	rundownElementStat_item: literal<MOS.IMOSItemStatus>({
		RunningOrderId: new MOS.MosString128('5PM'),
		StoryId: new MOS.MosString128('HOTEL FIRE '),
		ID: new MOS.MosString128('0'),
		ObjectId: new MOS.MosString128('A0295'),
		Channel: new MOS.MosString128('B'),
		Status: MOS.IMOSObjectStatus.PLAY,
		Time: new MOS.MosTime('2009-04-11T14:13:53'),
	}),
	rundownReadyToAir: literal<MOS.IMOSROReadyToAir>({
		ID: new MOS.MosString128('5PM'),
		Status: MOS.IMOSObjectAirStatus.READY,
	}),
	rundownElementAction_insert_story_Action: literal<MOS.IMOSStoryAction>({
		RunningOrderID: new MOS.MosString128('5PM'),
		StoryID: new MOS.MosString128('2'),
	}),
	rundownElementAction_insert_story_Stories: [
		literal<MOS.IMOSROStory>({
			ID: new MOS.MosString128('17'),
			Slug: new MOS.MosString128('Barcelona Football'),
			Number: new MOS.MosString128('A2'),
			// MosExternalMetaData?: Array<IMOSExternalMetaData>,
			Items: [
				literal<MOS.IMOSItem>({
					ID: new MOS.MosString128('27'),
					// Slug?: new MOS.MosString128(''),
					ObjectID: new MOS.MosString128('M73627'),
					MOSID: 'testmos',
					// mosAbstract?: '',
					Paths: [
						{
							Type: MOS.IMOSObjectPathType.PATH,
							Description: 'MPEG2 Video',
							Target: '\\servermediaclip392028cd2320s0d.mxf',
						},
						{
							Type: MOS.IMOSObjectPathType.PROXY_PATH,
							Description: 'WM9 750Kbps',
							Target: 'http://server/proxy/clipe.wmv',
						},
						{
							Type: MOS.IMOSObjectPathType.METADATA_PATH,
							Description: 'MOS Object',
							Target: 'http://server/proxy/clipe.xml',
						},
					],
					EditorialStart: 0,
					EditorialDuration: 715,
					UserTimingDuration: 415,
				}),
				literal<MOS.IMOSItem>({
					ID: new MOS.MosString128('28'),
					ObjectID: new MOS.MosString128('M73628'),
					MOSID: 'testmos',
					// mosAbstract?: '',
					EditorialStart: 0,
					EditorialDuration: 315,
				}),
			],
		}),
	],
	rundownElementAction_insert_item_Action: literal<MOS.IMOSItemAction>({
		RunningOrderID: new MOS.MosString128('5PM'),
		StoryID: new MOS.MosString128('2'),
		ItemID: new MOS.MosString128('23'),
	}),
	rundownElementAction_insert_item_Items: [
		literal<MOS.IMOSItem>({
			ID: new MOS.MosString128('27'),
			Slug: new MOS.MosString128('NHL PKG'),
			ObjectID: new MOS.MosString128('M19873'),
			MOSID: 'testmos',
			Paths: [
				{
					Type: MOS.IMOSObjectPathType.PATH,
					Description: 'MPEG2 Video',
					Target: '\\servermediaclip392028cd2320s0d.mxf',
				},
				{
					Type: MOS.IMOSObjectPathType.PROXY_PATH,
					Description: 'WM9 750Kbps',
					Target: 'http://server/proxy/clipe.wmv',
				},
				{
					Type: MOS.IMOSObjectPathType.METADATA_PATH,
					Description: 'MOS Object',
					Target: 'http://server/proxy/clipe.xml',
				},
			],
			EditorialStart: 0,
			EditorialDuration: 700,
			UserTimingDuration: 690,
		}),
	],
	rundownElementAction_replace_story_Action: literal<MOS.IMOSStoryAction>({
		RunningOrderID: new MOS.MosString128('5PM'),
		StoryID: new MOS.MosString128('2'),
	}),
	rundownElementAction_replace_story_Stories: [
		literal<MOS.IMOSROStory>({
			ID: new MOS.MosString128('17'),
			Slug: new MOS.MosString128('Porto Football'),
			Number: new MOS.MosString128('A2'),
			// MosExternalMetaData?: Array<IMOSExternalMetaData>,
			Items: [
				literal<MOS.IMOSItem>({
					ID: new MOS.MosString128('27'),
					// Slug?: new MOS.MosString128(''),
					ObjectID: new MOS.MosString128('M73627'),
					MOSID: 'testmos',
					// mosAbstract?: '',
					Paths: [
						{
							Type: MOS.IMOSObjectPathType.PATH,
							Description: 'MPEG2 Video',
							Target: '\\servermediaclip392028cd2320s0d.mxf',
						},
						{
							Type: MOS.IMOSObjectPathType.PROXY_PATH,
							Description: 'WM9 750Kbps',
							Target: 'http://server/proxy/clipe.wmv',
						},
						{
							Type: MOS.IMOSObjectPathType.METADATA_PATH,
							Description: 'MOS Object',
							Target: 'http://server/proxy/clipe.xml',
						},
					],
					EditorialStart: 0,
					EditorialDuration: 715,
					UserTimingDuration: 415,
				}),
				literal<MOS.IMOSItem>({
					ID: new MOS.MosString128('28'),
					ObjectID: new MOS.MosString128('M73628'),
					MOSID: 'testmos',
					// mosAbstract?: '',
					EditorialStart: 0,
					EditorialDuration: 315,
				}),
			],
		}),
	],
	rundownElementAction_replace_item_Action: literal<MOS.IMOSItemAction>({
		RunningOrderID: new MOS.MosString128('5PM'),
		StoryID: new MOS.MosString128('2'),
		ItemID: new MOS.MosString128('23'),
	}),
	rundownElementAction_replace_item_Items: [
		literal<MOS.IMOSItem>({
			ID: new MOS.MosString128('27'),
			Slug: new MOS.MosString128('NHL PKG'),
			ObjectID: new MOS.MosString128('M19873'),
			MOSID: 'testmos',
			Paths: [
				{
					Type: MOS.IMOSObjectPathType.PATH,
					Description: 'MPEG2 Video',
					Target: '\\servermediaclip392028cd2320s0d.mxf',
				},
				{
					Type: MOS.IMOSObjectPathType.PROXY_PATH,
					Description: 'WM9 750Kbps',
					Target: 'http://server/proxy/clipe.wmv',
				},
				{
					Type: MOS.IMOSObjectPathType.METADATA_PATH,
					Description: 'MOS Object',
					Target: 'http://server/proxy/clipe.xml',
				},
			],
			EditorialStart: 0,
			EditorialDuration: 700,
			UserTimingDuration: 690,
		}),
	],
	rundownElementAction_move_story_Action: literal<MOS.IMOSStoryAction>({
		RunningOrderID: new MOS.MosString128('5PM'),
		StoryID: new MOS.MosString128('2'),
	}),
	rundownElementAction_move_story_Stories: [new MOS.MosString128('7')],
	rundownElementAction_move_stories_Action: literal<MOS.IMOSStoryAction>({
		RunningOrderID: new MOS.MosString128('5PM'),
		StoryID: new MOS.MosString128('2'),
	}),
	rundownElementAction_move_stories_Stories: [new MOS.MosString128('7'), new MOS.MosString128('12')],
	rundownElementAction_move_items_Action: literal<MOS.IMOSItemAction>({
		RunningOrderID: new MOS.MosString128('5PM'),
		StoryID: new MOS.MosString128('2'),
		ItemID: new MOS.MosString128('12'),
	}),
	rundownElementAction_move_items_Items: [new MOS.MosString128('23'), new MOS.MosString128('24')],
	rundownElementAction_delete_story_Action: literal<MOS.IMOSROAction>({
		RunningOrderID: new MOS.MosString128('5PM'),
	}),
	rundownElementAction_delete_story_Stories: [new MOS.MosString128('3')],
	rundownElementAction_delete_items_Action: literal<MOS.IMOSStoryAction>({
		RunningOrderID: new MOS.MosString128('5PM'),
		StoryID: new MOS.MosString128('2'),
	}),
	rundownElementAction_delete_items_Items: [new MOS.MosString128('23'), new MOS.MosString128('24')],
	rundownElementAction_swap_stories_Action: literal<MOS.IMOSROAction>({
		RunningOrderID: new MOS.MosString128('5PM'),
	}),
	rundownElementAction_swap_stories_StoryId0: new MOS.MosString128('3'),
	rundownElementAction_swap_stories_StoryId1: new MOS.MosString128('5'),
	rundownElementAction_swap_items_Action: literal<MOS.IMOSStoryAction>({
		RunningOrderID: new MOS.MosString128('5PM'),
		StoryID: new MOS.MosString128('2'),
	}),
	rundownElementAction_swap_items_ItemId0: new MOS.MosString128('23'),
	rundownElementAction_swap_items_ItemId1: new MOS.MosString128('24'),
}
