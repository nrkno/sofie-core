import { Meteor } from 'meteor/meteor'
import { Random } from 'meteor/random'

import { PeripheralDevice, SpreadsheetDevice, PeripheralDevices } from '../../../lib/collections/PeripheralDevices'
import { PeripheralDeviceCommand, PeripheralDeviceCommands } from '../../../lib/collections/PeripheralDeviceCommands'
import { Rundown, Rundowns } from '../../../lib/collections/Rundowns'
import { Segment, Segments } from '../../../lib/collections/Segments'
import { Part, Parts } from '../../../lib/collections/Parts'
import { Piece, Pieces } from '../../../lib/collections/Pieces'

import { PeripheralDeviceAPI } from '../../../lib/api/peripheralDevice'

import { getCurrentTime, literal } from '../../../lib/lib'
import * as MOS from 'mos-connection'
import { testInFiber } from '../../../__mocks__/helpers/jest'
import { setupDefaultStudioEnvironment } from '../../../__mocks__/helpers/database'
import { setLoggerLevel } from '../../../server/api/logger'

describe('test peripheralDevice general API methods', () => {

	let device: PeripheralDevice
	beforeAll(() => {
		device = setupDefaultStudioEnvironment().ingestDevice
		let rundownID = 'rundown0'
		Rundowns.insert({
			_id: rundownID,
			externalId: rundownID,
			studioId: 'studio0',
			showStyleBaseId: 'showStyle0',
			showStyleVariantId: 'variant0',
			name: 'test rundown',
			created: 1000,
			currentPartId: null,
			nextPartId: null,
			previousPartId: null,
			dataSource: 'mock',
			peripheralDeviceId: 'testMosDevice',
			modified: getCurrentTime(),
			importVersions: {
				studio: 'wibble',
				showStyleBase: 'wobble',
				showStyleVariant: 'jelly',
				blueprint: 'on',
				core: 'plate'
			},
			active: true,
		})
		let segmentID = 'segment0'
		Segments.insert({
			_id: segmentID,
			externalId: segmentID,
			_rank: 0,
			rundownId: rundownID,
			name: 'Fire',
		})
		Parts.insert({
			_id: 'part000',
			_rank: 0,
			externalId: 'part000',
			segmentId: segmentID,
			rundownId: rundownID,
			title: 'Part 000',
			typeVariant: 'mos'
		})
		Parts.insert({
			_id: 'part001',
			_rank: 1,
			externalId: 'part001',
			segmentId: segmentID,
			rundownId: rundownID,
			title: 'Part 001',
			typeVariant: 'mos'
		})
		Segments.insert({
			_id: 'segment1',
			_rank: 1,
			externalId: 'segment01',
			rundownId: rundownID,
			name: 'Water'
		})
		Segments.insert({
			_id: 'segment2',
			_rank: 2,
			externalId: 'segment02',
			rundownId: rundownID,
			name: 'Earth'
		})
	})

	testInFiber('initialize', () => {
		setLoggerLevel('debug')

		expect(PeripheralDevices.findOne(device._id)).toBeTruthy()

		let options: PeripheralDeviceAPI.InitOptions = {
			category: PeripheralDeviceAPI.DeviceCategory.INGEST,
		  type: PeripheralDeviceAPI.DeviceType.MOS,
			subType: 'mos_connection',
		  name: 'test',
		  connectionId: 'test'
		}
		Meteor.call(PeripheralDeviceAPI.methods.initialize, device._id, device.token, options)
		let initDevice = PeripheralDevices.findOne(device._id) as PeripheralDevice
		expect(initDevice).toBeTruthy()
		expect(initDevice.lastSeen).toBeGreaterThan(getCurrentTime() - 100)
		expect(initDevice.lastConnected).toBeGreaterThan(getCurrentTime() - 100)
		expect(initDevice.subType).toBe(options.subType)
	})

	testInFiber('setStatus', () => {
		expect(PeripheralDevices.findOne(device._id)).toBeTruthy()
		expect((PeripheralDevices.findOne(device._id) as PeripheralDevice).status).toMatchObject({
			statusCode: PeripheralDeviceAPI.StatusCode.GOOD
		})
		Meteor.call(PeripheralDeviceAPI.methods.setStatus, device._id, device.token, {
			statusCode: PeripheralDeviceAPI.StatusCode.WARNING_MINOR,
			messages: ["Something's not right"]
		})
		expect((PeripheralDevices.findOne(device._id) as PeripheralDevice).status).toMatchObject({
			statusCode: PeripheralDeviceAPI.StatusCode.WARNING_MINOR,
			messages: ["Something's not right"]
		})
	})

	testInFiber('getPeripheralDevice', () => {
		let gotDevice: PeripheralDevice = Meteor.call(PeripheralDeviceAPI.methods.getPeripheralDevice, device._id, device.token)
		expect(gotDevice).toBeTruthy()
		expect(gotDevice._id).toBe(device._id)
	})

	testInFiber('ping', () => {
		expect(PeripheralDevices.findOne(device._id)).toBeTruthy()
		let lastSeen = (PeripheralDevices.findOne(device._id) as PeripheralDevice).lastSeen
		Meteor.call(PeripheralDeviceAPI.methods.ping, device._id, device.token)
		expect((PeripheralDevices.findOne(device._id) as PeripheralDevice).lastSeen).toBeGreaterThan(lastSeen)
	})

	testInFiber('pingWithCommand and functionReply', () => {
		setLoggerLevel('debug')

		let resultErr = undefined
		let resultMessage = undefined
		let pingCompleted = (err, msg) => {
			resultErr = err
			resultMessage = msg
		}

		// This is very odd. Ping command is sent and lastSeen updated before response
		let device2 = PeripheralDevices.findOne(device._id) as PeripheralDevice
		expect(device2).toBeTruthy()
		// Decrease lastSeen to ensure that the call below updates it
		let lastSeen = device2.lastSeen - 100
		PeripheralDevices.update(device._id, { $set: { lastSeen: lastSeen } })

		let message = 'Waving!'
		// Note: the null is so that Metor doesnt try to use pingCompleted  as a callback instead of blocking
		Meteor.call(PeripheralDeviceAPI.methods.pingWithCommand, device._id, device.token, message, pingCompleted, null)
		expect((PeripheralDevices.findOne(device._id) as PeripheralDevice).lastSeen).toBeGreaterThan(lastSeen)
		let command = PeripheralDeviceCommands.find({ deviceId: device._id }).fetch()[0]
		expect(command).toBeTruthy()
		expect(command.hasReply).toBeFalsy()
		expect(command.functionName).toBe('pingResponse')
		expect(command.args).toEqual([ message ])

		expect(resultErr).toBeUndefined()
		expect(resultMessage).toBeUndefined()

		let replyMessage = 'Waving back!'
		Meteor.call(PeripheralDeviceAPI.methods.functionReply, device._id, device.token, command._id, undefined, replyMessage)
		expect(PeripheralDeviceCommands.findOne()).toBeFalsy()

		expect(resultErr).toBeNull()
		expect(resultMessage).toEqual(replyMessage)

	})

	/*
	testInFiber('partPlaybackStarted', () => {
		setLoggerLevel('debug')
		let partPlaybackStartedResult: PeripheralDeviceAPI.PartPlaybackStartedResult = {
			rundownId: 'rundown0',
			partId: 'part000',
			time: getCurrentTime()
		}
		Meteor.call(PeripheralDeviceAPI.methods.partPlaybackStarted, device._id, device.token, partPlaybackStartedResult)
	}) */

	/* testInFiber('partPlaybackStopped', () => {
		setLoggerLevel('debug')
		let partPlaybackStoppedResult: PeripheralDeviceAPI.PartPlaybackStoppedResult = {
			rundownId: 'rundown0',
			partId: 'part000',
			time: getCurrentTime()
		}
		console.log(Parts.findOne(partPlaybackStoppedResult.partId))
		Meteor.call(PeripheralDeviceAPI.methods.partPlaybackStopped, device._id, device.token, partPlaybackStoppedResult)
		console.log(Parts.findOne(partPlaybackStoppedResult.partId))
	}) */

/* testInFiber('piecePlaybackStarted', () => {
		setLoggerLevel('debug')
		let piecePlaybackStartedResult: PeripheralDeviceAPI.PiecePlaybackStartedResult = {
			rundownId: 'rundown0',
			pieceId: 'piece000',
			time: getCurrentTime()
		}
		Meteor.call(PeripheralDeviceAPI.methods.piecePlaybackStarted, device._id, device.token, piecePlaybackStartedResult)
	}) */

	/* testInFiber('piecePlaybackStopped', () => {
		setLoggerLevel('debug')
		let piecePlaybackStoppedResult: PeripheralDeviceAPI.PiecePlaybackStoppedResult = {
			rundownId: 'rundown0',
			pieceId: 'piece000',
			time: getCurrentTime()
		}
		console.log(Pieces.findOne(piecePlaybackStoppedResult.pieceId))
		Meteor.call(PeripheralDeviceAPI.methods.piecePlaybackStopped, device._id, device.token, piecePlaybackStoppedResult)
		console.log(Pieces.findOne(piecePlaybackStoppedResult.pieceId))
	})
	*/

	testInFiber('killProcess with a rundown present', () => { // test this does not shutdown because Rundown stored
		setLoggerLevel('debug')
		try {
			Meteor.call(PeripheralDeviceAPI.methods.killProcess, device._id, device.token, true)
			fail('expected to throw')
		} catch (e) {
			expect(e.message).toBe(`[400] Unable to run killProcess: Rundowns not empty!`)
		}
	})

	testInFiber('testMethod', () => {
		setLoggerLevel('debug')
		let throwPlease = false
		try {
			let result = 	Meteor.call(PeripheralDeviceAPI.methods.testMethod, device._id, device.token, 'european')
			expect(result).toBe('european')
			throwPlease = true
			Meteor.call(PeripheralDeviceAPI.methods.testMethod, device._id, device.token, 'european', throwPlease)
			fail('expected to throw')
		} catch (e) {
			if (throwPlease) {
				expect(e.message).toBe('[418] Error thrown, as requested')
			} else {
				expect(false).toBe(true)
			}
		}
	})

	/*
	testInFiber('timelineTriggerTime', () => {
		setLoggerLevel('debug')
		let timelineTriggerTimeResult: PeripheralDeviceAPI.TimelineTriggerTimeResult = [
			{ id: 'wibble', time: getCurrentTime() }, { id: 'wobble', time: getCurrentTime() - 100 }]
		Meteor.call(PeripheralDeviceAPI.methods.timelineTriggerTime, device._id, device.token, timelineTriggerTimeResult)
	})
	*/

	testInFiber('requestUserAuthToken', () => {
		setLoggerLevel('debug')

		try {
			Meteor.call(PeripheralDeviceAPI.methods.requestUserAuthToken, device._id, device.token, 'http://auth.url/')
			fail('expected to throw')
		} catch (e) {
			expect(e.message).toBe('[400] can only request user auth token for peripheral device of spreadsheet type')
		}

		PeripheralDevices.update(device._id, { $set: {
			type: PeripheralDeviceAPI.DeviceType.SPREADSHEET
		}})
		Meteor.call(PeripheralDeviceAPI.methods.requestUserAuthToken, device._id, device.token, 'http://auth.url/')
		let deviceWithAccessToken = PeripheralDevices.findOne(device._id)
		expect(deviceWithAccessToken).toBeTruthy()
		expect((deviceWithAccessToken as SpreadsheetDevice).accessTokenUrl).toBe('http://auth.url/')

		PeripheralDevices.update(device._id, { $set: {
			type: PeripheralDeviceAPI.DeviceType.MOS
		}})
	})

	// Should only really work for SpreadsheetDevice
	testInFiber('storeAccessToken', () => {
		setLoggerLevel('debug')
		try {
			Meteor.call(PeripheralDeviceAPI.methods.storeAccessToken, device._id, device.token, 'http://auth.url/')
			fail('expected to throw')
		} catch (e) {
			expect(e.message).toBe('[400] can only store access token for peripheral device of spreadsheet type')
		}

		PeripheralDevices.update(device._id, { $set: {
			type: PeripheralDeviceAPI.DeviceType.SPREADSHEET
		}})

		Meteor.call(PeripheralDeviceAPI.methods.storeAccessToken, device._id, device.token, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ')
		let deviceWithSecretToken = PeripheralDevices.findOne(device._id)
		// console.log(deviceWithSecretToken)
		expect(deviceWithSecretToken).toBeTruthy()
		expect((deviceWithSecretToken as SpreadsheetDevice).accessTokenUrl).toBe('')
		expect((deviceWithSecretToken as SpreadsheetDevice).secretSettings!.accessToken).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ')
		expect((deviceWithSecretToken as SpreadsheetDevice).settings!.secretAccessToken).toBe(true)
	})

	testInFiber('uninitialize', () => {
		setLoggerLevel('debug')
		Meteor.call(PeripheralDeviceAPI.methods.unInitialize, device._id, device.token)
		expect(PeripheralDevices.findOne()).toBeFalsy()

		device = setupDefaultStudioEnvironment().ingestDevice
		expect(PeripheralDevices.findOne()).toBeTruthy()
	})

	testInFiber('initialize with bad arguments', () => {
		let options: PeripheralDeviceAPI.InitOptions = {
			category: PeripheralDeviceAPI.DeviceCategory.INGEST,
			type: PeripheralDeviceAPI.DeviceType.MOS,
			subType: 'mos_connection',
			name: 'test',
			connectionId: 'test'
		}
		try {
			Meteor.call(PeripheralDeviceAPI.methods.initialize, 'wibbly', device.token, options)
			fail('expected to throw')
		} catch (e) {
			expect(e.message).toBe(`[404] PeripheralDevice "wibbly" not found`)
		}

		try {
			Meteor.call(PeripheralDeviceAPI.methods.initialize, device._id, device.token.slice(0, -1), options)
			fail('expected to throw')
		} catch (e) {
			expect(e.message).toBe(`[401] Not allowed access to peripheralDevice`)
		}

	})

	testInFiber('setStatus with bad arguments', () => {
		try {
			Meteor.call(PeripheralDeviceAPI.methods.setStatus, 'wibbly', device.token, { statusCode: 0 })
			fail('expected to throw')
		} catch (e) {
			expect(e.message).toBe(`[404] PeripheralDevice "wibbly" not found`)
		}

		try {
			Meteor.call(PeripheralDeviceAPI.methods.setStatus, device._id, device.token.slice(0, -1), { statusCode: 0 })
			fail('expected to throw')
		} catch (e) {
			expect(e.message).toBe(`[401] Not allowed access to peripheralDevice`)
		}

		try {
			Meteor.call(PeripheralDeviceAPI.methods.setStatus, device._id, device.token, { statusCode: 42 })
			fail('expected to throw')
		} catch (e) {
			expect(e.message).toBe(`[400] device status code is not known`)
		}

	})
	// it('peripheralDevice.initialize() with bad arguments', async function () {
	// 	let deviceId = Random.id()
	// 	let token = Random.id()
	//
	// 	let options: PeripheralDeviceAPI.InitOptions = {
	// 		type: 0,
	// 		name: 'test',
	// 		connectionId: 'test'
	// 	}
	//
	// 	expect(() => {
	// 		return ServerPeripheralDeviceAPI.initialize('', token, options) // missing id
	// 	}).to.throw()
	//
	// 	expect(() => {
	// 		return ServerPeripheralDeviceAPI.initialize(deviceId, '', options) // missing token
	// 	}).to.throw()
	//
	// 	expect(() => {
	//
	// 		return ServerPeripheralDeviceAPI.initialize(deviceId, token, null as any) // missing options
	// 	}).to.throw()
	//
	// 	expect(() => {
	//
	// 		return ServerPeripheralDeviceAPI.initialize(deviceId, token, {} as any) // bad options
	// 	}).to.throw()
	// })
	//
	// it('peripheralDevice.setStatus() with bad arguments', async function () {
	// 	let deviceId = Random.id()
	// 	let token = Random.id()
	// 	let options: PeripheralDeviceAPI.InitOptions = {
	// 		type: 0,
	// 		name: 'test',
	// 		connectionId: 'test'
	// 	}
	//
	// 	expect(() => {
	// 		return ServerPeripheralDeviceAPI.setStatus(deviceId, token, {
	// 			statusCode: PeripheralDeviceAPI.StatusCode.GOOD
	// 		})
	// 	}).to.throw() // because device is not initialized yet
	//
	// 	let returnedId = ServerPeripheralDeviceAPI.initialize(deviceId, token, options)
	//
	// 	expect(() => {
	// 		return ServerPeripheralDeviceAPI.setStatus(deviceId, token, {
	// 			statusCode: PeripheralDeviceAPI.StatusCode.GOOD
	// 		})
	// 	}).to.not.throw()
	//
	// 	// try with bad arguments:
	// 	expect(() => {
	// 		return ServerPeripheralDeviceAPI.setStatus(deviceId, token, {} as any ) // missing statusCode
	// 	}).to.throw()
	//
	// 	expect(() => {
	// 		return ServerPeripheralDeviceAPI.setStatus(deviceId, token, null as any) // missing status
	// 	}).to.throw()
	//
	// 	expect(() => {
	// 		return ServerPeripheralDeviceAPI.setStatus(deviceId, '', { // missing token
	// 			statusCode: PeripheralDeviceAPI.StatusCode.GOOD
	// 		})
	// 	}).to.throw()
	//
	// 	expect(() => {
	// 		return ServerPeripheralDeviceAPI.setStatus('', token, { // missing id
	// 			statusCode: PeripheralDeviceAPI.StatusCode.GOOD
	// 		})
	// 	}).to.throw()
	//
	// })
})

// Note: The data below is copied straight from the test data in mos-connection
let xmlApiData = {
	'rundownCreate': literal<MOS.IMOSRunningOrder>({
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
							literal<MOS.IMOSObjectPath>({ Type: MOS.IMOSObjectPathType.PATH, Description: 'MPEG2 Video', Target: '\\server\\media\\clip392028cd2320s0d.mxf' }),
							literal<MOS.IMOSObjectPath>({ Type: MOS.IMOSObjectPathType.PROXY_PATH, Description: 'WM9 750Kbps', Target: 'http://server/proxy/clipe.wmv' }),
							literal<MOS.IMOSObjectPath>({ Type: MOS.IMOSObjectPathType.METADATA_PATH, Description: 'MOS Object', Target: 'http://server/proxy/clipe.xml' })
						],
						// Channel?: new MOS.MosString128(),
						// EditorialStart?: MOS.MosTime
						EditorialDuration: 645,
						UserTimingDuration: 310,
						Trigger: 'CHAINED' // TODO: Johan frågar
						// MacrundownIn?: new MOS.MosString128(),
						// MacrundownOut?: new MOS.MosString128(),
						// MosExternalMetaData?: Array<IMOSExternalMetaData>
					})
				]
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
						UserTimingDuration: 200
						// Trigger: 'CHAINED' // TODO: Johan frågar
						// MacrundownIn?: new MOS.MosString128(),
						// MacrundownOut?: new MOS.MosString128(),
						// MosExternalMetaData?: Array<IMOSExternalMetaData>
					})
				]
			})
		]
	}),
	'rundownReplace': literal<MOS.IMOSRunningOrder>({
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
							literal<MOS.IMOSObjectPath>({ Type: MOS.IMOSObjectPathType.PATH, Description: 'MPEG2 Video', Target: '\\server\media\clip392028cd2320s0d.mxf' }),
							literal<MOS.IMOSObjectPath>({ Type: MOS.IMOSObjectPathType.PROXY_PATH, Description: 'WM9 750Kbps', Target: 'http://server/proxy/clipe.wmv' }),
							literal<MOS.IMOSObjectPath>({ Type: MOS.IMOSObjectPathType.METADATA_PATH, Description: 'MOS Object', Target: 'http://server/proxy/clipe.xml' })
						],
						// Channel?: new MOS.MosString128(),
						// EditorialStart?: MOS.MosTime
						EditorialDuration: 645,
						UserTimingDuration: 310,
						Trigger: 'CHAINED' // TODO: Johan frågar
						// MacrundownIn?: new MOS.MosString128(),
						// MacrundownOut?: new MOS.MosString128(),
						// MosExternalMetaData?: Array<IMOSExternalMetaData>
					})
				]
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
						UserTimingDuration: 310
						// Trigger: 'CHAINED' // TODO: Johan frågar
						// MacrundownIn?: new MOS.MosString128(),
						// MacrundownOut?: new MOS.MosString128(),
						// MosExternalMetaData?: Array<IMOSExternalMetaData>
					})
				]
			})
		]
	}),
	'rundownDelete': 49478285,
	'rundownList': literal<MOS.IMOSObject>({
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
			{ Type: MOS.IMOSObjectPathType.PATH, Description: 'MPEG2 Video', Target: '\\server\media\clip392028cd2320s0d.mxf' },
			{ Type: MOS.IMOSObjectPathType.PROXY_PATH, Description: 'WM9 750Kbps', Target: 'http://server/proxy/clipe.wmv' },
			{ Type: MOS.IMOSObjectPathType.METADATA_PATH, Description: 'MOS Object', Target: 'http://server/proxy/clipe.xml' }
		],
		CreatedBy: new MOS.MosString128('Chris'),
		Created: new MOS.MosTime('2009-10-31T23:39:12'),
		ChangedBy: new MOS.MosString128('Chris'),
		Changed: new MOS.MosTime('2009-10-31T23:39:12')
		// Description: string
		// mosExternalMetaData?: Array<IMOSExternalMetaData>
	}),
	'rundownMetadataReplace': literal<MOS.IMOSRunningOrderBase>({
		ID: new MOS.MosString128('96857485'),
		Slug: new MOS.MosString128('5PM RUNDOWN'),
		// DefaultChannel?: new MOS.MosString128(''),
		EditorialStart: new MOS.MosTime('2009-04-17T17:02:00'),
		EditorialDuration: new MOS.MosDuration('00:58:25')
		// Trigger?: any // TODO: Johan frågar vad denna gör
		// MacrundownIn?: new MOS.MosString128(''),
		// MacrundownOut?: new MOS.MosString128(''),
		// MosExternalMetaData?: Array<IMOSExternalMetaData>
	}),
	'rundownElementStat_rundown': literal<MOS.IMOSRunningOrderStatus>({
		ID: new MOS.MosString128('5PM'),
		Status: MOS.IMOSObjectStatus.MANUAL_CTRL,
		Time: new MOS.MosTime('2009-04-11T14:13:53')
	}),
	'rundownElementStat_story': literal<MOS.IMOSStoryStatus>({
		RunningOrderId: new MOS.MosString128('5PM'),
		ID: new MOS.MosString128('HOTEL FIRE'),
		Status: MOS.IMOSObjectStatus.PLAY,
		Time: new MOS.MosTime('1999-04-11T14:13:53')
	}),
	'rundownElementStat_item': literal<MOS.IMOSItemStatus>({
		RunningOrderId: new MOS.MosString128('5PM'),
		StoryId: new MOS.MosString128('HOTEL FIRE '),
		ID: new MOS.MosString128('0'),
		ObjectId: new MOS.MosString128('A0295'),
		Channel: new MOS.MosString128('B'),
		Status: MOS.IMOSObjectStatus.PLAY,
		Time: new MOS.MosTime('2009-04-11T14:13:53')
	}),
	'rundownReadyToAir': literal<MOS.IMOSROReadyToAir>({
		ID: new MOS.MosString128('5PM'),
		Status: MOS.IMOSObjectAirStatus.READY
	}),
	'rundownElementAction_insert_story_Action': literal<MOS.IMOSStoryAction>({
		RunningOrderID: new MOS.MosString128('5PM'),
		StoryID: new MOS.MosString128('2')
	}),
	'rundownElementAction_insert_story_Stories': [
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
						{ Type: MOS.IMOSObjectPathType.PATH, Description: 'MPEG2 Video', Target: '\\server\media\clip392028cd2320s0d.mxf' },
						{ Type: MOS.IMOSObjectPathType.PROXY_PATH, Description: 'WM9 750Kbps', Target: 'http://server/proxy/clipe.wmv' },
						{ Type: MOS.IMOSObjectPathType.METADATA_PATH, Description: 'MOS Object', Target: 'http://server/proxy/clipe.xml' }
					],
					EditorialStart: 0,
					EditorialDuration: 715,
					UserTimingDuration: 415
				}),
				literal<MOS.IMOSItem>({
					ID: new MOS.MosString128('28'),
					ObjectID: new MOS.MosString128('M73628'),
					MOSID: 'testmos',
					// mosAbstract?: '',
					EditorialStart: 0,
					EditorialDuration: 315
				})
			]
		})
	],
	'rundownElementAction_insert_item_Action': literal<MOS.IMOSItemAction>({
		RunningOrderID: new MOS.MosString128('5PM'),
		StoryID: new MOS.MosString128('2'),
		ItemID: new MOS.MosString128('23')
	}),
	'rundownElementAction_insert_item_Items': [
		literal<MOS.IMOSItem>({
			ID: new MOS.MosString128('27'),
			Slug: new MOS.MosString128('NHL PKG'),
			ObjectID: new MOS.MosString128('M19873'),
			MOSID: 'testmos',
			Paths: [
				{ Type: MOS.IMOSObjectPathType.PATH, Description: 'MPEG2 Video', Target: '\\server\media\clip392028cd2320s0d.mxf' },
				{ Type: MOS.IMOSObjectPathType.PROXY_PATH, Description: 'WM9 750Kbps', Target: 'http://server/proxy/clipe.wmv' },
				{ Type: MOS.IMOSObjectPathType.METADATA_PATH, Description: 'MOS Object', Target: 'http://server/proxy/clipe.xml' }
			],
			EditorialStart: 0,
			EditorialDuration: 700,
			UserTimingDuration: 690
		})
	],
	'rundownElementAction_replace_story_Action': literal<MOS.IMOSStoryAction>({
		RunningOrderID: new MOS.MosString128('5PM'),
		StoryID: new MOS.MosString128('2')
	}),
	'rundownElementAction_replace_story_Stories': [
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
						{ Type: MOS.IMOSObjectPathType.PATH, Description: 'MPEG2 Video', Target: '\\server\media\clip392028cd2320s0d.mxf' },
						{ Type: MOS.IMOSObjectPathType.PROXY_PATH, Description: 'WM9 750Kbps', Target: 'http://server/proxy/clipe.wmv' },
						{ Type: MOS.IMOSObjectPathType.METADATA_PATH, Description: 'MOS Object', Target: 'http://server/proxy/clipe.xml' }
					],
					EditorialStart: 0,
					EditorialDuration: 715,
					UserTimingDuration: 415
				}),
				literal<MOS.IMOSItem>({
					ID: new MOS.MosString128('28'),
					ObjectID: new MOS.MosString128('M73628'),
					MOSID: 'testmos',
					// mosAbstract?: '',
					EditorialStart: 0,
					EditorialDuration: 315
				})
			]
		})
	],
	'rundownElementAction_replace_item_Action': literal<MOS.IMOSItemAction>({
		RunningOrderID: new MOS.MosString128('5PM'),
		StoryID: new MOS.MosString128('2'),
		ItemID: new MOS.MosString128('23')
	}),
	'rundownElementAction_replace_item_Items': [
		literal<MOS.IMOSItem>({
			ID: new MOS.MosString128('27'),
			Slug: new MOS.MosString128('NHL PKG'),
			ObjectID: new MOS.MosString128('M19873'),
			MOSID: 'testmos',
			Paths: [
				{ Type: MOS.IMOSObjectPathType.PATH, Description: 'MPEG2 Video', Target: '\\server\media\clip392028cd2320s0d.mxf' },
				{ Type: MOS.IMOSObjectPathType.PROXY_PATH, Description: 'WM9 750Kbps', Target: 'http://server/proxy/clipe.wmv' },
				{ Type: MOS.IMOSObjectPathType.METADATA_PATH, Description: 'MOS Object', Target: 'http://server/proxy/clipe.xml' }
			],
			EditorialStart: 0,
			EditorialDuration: 700,
			UserTimingDuration: 690
		})
	],
	'rundownElementAction_move_story_Action': literal<MOS.IMOSStoryAction>({
		RunningOrderID: new MOS.MosString128('5PM'),
		StoryID: new MOS.MosString128('2')
	}),
	'rundownElementAction_move_story_Stories': [
		new MOS.MosString128('7')
	],
	'rundownElementAction_move_stories_Action': literal<MOS.IMOSStoryAction>({
		RunningOrderID: new MOS.MosString128('5PM'),
		StoryID: new MOS.MosString128('2')
	}),
	'rundownElementAction_move_stories_Stories': [
		new MOS.MosString128('7'),
		new MOS.MosString128('12')
	],
	'rundownElementAction_move_items_Action': literal<MOS.IMOSItemAction>({
		RunningOrderID: new MOS.MosString128('5PM'),
		StoryID: new MOS.MosString128('2'),
		ItemID: new MOS.MosString128('12')
	}),
	'rundownElementAction_move_items_Items': [
		new MOS.MosString128('23'),
		new MOS.MosString128('24')
	],
	'rundownElementAction_delete_story_Action': literal<MOS.IMOSROAction>({
		RunningOrderID: new MOS.MosString128('5PM')
	}),
	'rundownElementAction_delete_story_Stories': [
		new MOS.MosString128('3')
	],
	'rundownElementAction_delete_items_Action': literal<MOS.IMOSStoryAction>({
		RunningOrderID: new MOS.MosString128('5PM'),
		StoryID: new MOS.MosString128('2')
	}),
	'rundownElementAction_delete_items_Items': [
		new MOS.MosString128('23'),
		new MOS.MosString128('24')
	],
	'rundownElementAction_swap_stories_Action': literal<MOS.IMOSROAction>({
		RunningOrderID: new MOS.MosString128('5PM')
	}),
	'rundownElementAction_swap_stories_StoryId0': new MOS.MosString128('3'),
	'rundownElementAction_swap_stories_StoryId1': new MOS.MosString128('5'),
	'rundownElementAction_swap_items_Action': literal<MOS.IMOSStoryAction>({
		RunningOrderID: new MOS.MosString128('5PM'),
		StoryID: new MOS.MosString128('2')
	}),
	'rundownElementAction_swap_items_ItemId0': new MOS.MosString128('23'),
	'rundownElementAction_swap_items_ItemId1': new MOS.MosString128('24')
}

describe('peripheralDevice: MOS Basic functions', function () {

	// beforeEach(function () {
	// 	StubCollections.stub(Rundowns)
	// 	StubCollections.stub(Segments)
	// 	StubCollections.stub(Parts)
	// 	StubCollections.stub(Pieces)
	//
	// 	let rundownID = rundownId(new MOS.MosString128('rundown0'))
	// 	// Prepare database:
	// 	Rundowns.insert({
	// 		_id: rundownID,
	// 		mosId: 'rundown0',
	// 		studioId: 'studio0',
	// 		showStyleBaseId: 'showStyle0',
	// 		showStyleVariantId: 'variant0',
	// 		name: 'test rundown',
	// 		created: 1000,
	// 		currentPartId: null,
	// 		nextPartId: null,
	// 		previousPartId: null,
	// 		dataSource: 'mock',
	// 		peripheralDeviceId: 'testMosDevice',
	// 		modified: getCurrentTime(),
	// 	})
	// 	let segmentID = segmentId(rundownID, '', 0)
	// 	Segments.insert({
	// 		_id: segmentID,
	// 		_rank: 0,
	// 		mosId: 'segment00',
	// 		rundownId: rundownID,
	// 		name: 'Fire',
	// 		number: ''
	// 	})
	// 	Parts.insert({
	// 		_id: partId(segmentID, new MOS.MosString128('part000')),
	// 		_rank: 0,
	// 		mosId: 'part000',
	// 		segmentId: segmentID,
	// 		rundownId: rundownID,
	// 		slug: ''
	// 	})
	// 	Parts.insert({
	// 		_id: partId(segmentID, new MOS.MosString128('part001')),
	// 		_rank: 1,
	// 		mosId: 'part001',
	// 		segmentId: segmentID,
	// 		rundownId: rundownID,
	// 		slug: ''
	// 	})
	// 	Segments.insert({
	// 		number: '',
	// 		_id: segmentId(rundownID, '', 1),
	// 		_rank: 1,
	// 		mosId: 'segment01',
	// 		rundownId: rundownID,
	// 		name: 'Water'
	// 	})
	// 	Segments.insert({
	// 		number: '',
	// 		_id: segmentId(rundownID, '', 2),
	// 		_rank: 2,
	// 		mosId: 'segment02',
	// 		rundownId: rundownID,
	// 		name: 'Earth'
	// 	})
	// 	rundownID = rundownId(new MOS.MosString128('rundown1'))
	// 	Rundowns.insert({
	// 		_id: rundownID,
	// 		mosId: 'rundown1',
	// 		studioId: 'studio0',
	// 		showStyleBaseId: 'showStyle1',
	// 		showStyleVariantId: 'variant0',
	// 		name: 'test rundown 1',
	// 		created: 2000,
	// 		currentPartId: null,
	// 		nextPartId: null,
	// 		previousPartId: null,
	// 		dataSource: 'mock',
	// 		peripheralDeviceId: 'testMosDevice',
	// 		modified: getCurrentTime(),
	// 	})
	// 	Segments.insert({
	// 		number: '',
	// 		_id: segmentId(rundownID, '', 10),
	// 		_rank: 0,
	// 		mosId: 'segment10',
	// 		rundownId: rundownID,
	// 		name: 'Fire'
	// 	})
	// 	Rundowns.insert({
	// 		_id: rundownId(new MOS.MosString128('rundown2')),
	// 		mosId: 'rundown2',
	// 		studioId: 'studio0',
	// 		showStyleBaseId: 'showStyle1',
	// 		showStyleVariantId: 'variant0',
	// 		name: 'test rundown 2',
	// 		created: 2000,
	// 		currentPartId: null,
	// 		nextPartId: null,
	// 		previousPartId: null,
	// 		dataSource: 'mock',
	// 		peripheralDeviceId: 'testMosDevice',
	// 		modified: getCurrentTime(),
	// 	})
	// })
	//
	// afterEach(function () {
	// 	StubCollections.restore()
	// })
	// it('getRO', function () {
	// 	let rundown = getRO(new MOS.MosString128('rundown1'))
	//
	// 	expect(rundown).to.be.an('object')
	// 	expect(rundown._id).to.be.equal('rundown_rundown1')
	// 	expect(rundown.mosId).to.be.equal('rundown1')
	//
	// 	expect(() => {
	// 		let rundown = getRO(new MOS.MosString128('unknown'))
	// 	}).to.throw()
	// })
	// it('getSegment', function () {
	// 	let segment = getSegment(new MOS.MosString128('rundown1'), new MOS.MosString128('segment10'))
	//
	// 	expect(segment).to.be.an('object')
	// 	expect(segment._id).to.be.equal('rundown_rundown1_segment10')
	// 	expect(segment.mosId).to.be.equal('segment10')
	//
	// 	expect(() => {
	// 		let segment = getSegment(new MOS.MosString128('rundown0'), new MOS.MosString128('unknown'))
	// 	}).to.throw()
	//
	// 	expect(() => {
	// 		let segment = getSegment(new MOS.MosString128('unknown'), new MOS.MosString128('segment00'))
	// 	}).to.throw()
	// })
	// it('getPart', function () {
	// 	let part = getPart(
	// 		new MOS.MosString128('rundown0'),
	// 		new MOS.MosString128('segment00'),
	// 		new MOS.MosString128('part000')
	// 	)
	//
	// 	expect(part).to.be.an('object')
	// 	expect(part._id).to.be.equal('rundown_rundown0_segment00_part000')
	// 	expect(part.mosId).to.be.equal('part000')
	//
	// 	expect(() => {
	// 		let part = getPart(new MOS.MosString128('rundown0'), new MOS.MosString128('segment00'), new MOS.MosString128('unknown'))
	// 	}).to.throw()
	//
	// 	expect(() => {
	// 		let part = getPart(new MOS.MosString128('rundown0'), new MOS.MosString128('unknown'), new MOS.MosString128('part000'))
	// 	}).to.throw()
	//
	// 	expect(() => {
	// 		let part = getPart(new MOS.MosString128('unknown'), new MOS.MosString128('segment00'), new MOS.MosString128('part000'))
	// 	}).to.throw()
	// })
	// it('convertToSegment', function () {
	//
	// 	let story = xmlApiData.rundownElementAction_insert_story_Stories[0]
	// 	let segment = convertToSegment(story, 'rundown_rundown0', 123)
	//
	// 	expect(segment).to.be.an('object')
	// 	expect(segment.mosId).to.equal(story.ID.toString())
	// 	expect(segment.rundownId).to.equal('rundown_rundown0')
	// 	expect(segment._rank).to.equal(123)
	// })
	// it('convertToPart', function () {
	//
	// 	let item = xmlApiData.rundownElementAction_insert_item_Items[0]
	// 	let part = convertToPart(item, 'rundown_rundown0', 'segment00', 123)
	//
	// 	expect(part).to.be.an('object')
	// 	expect(part.mosId).to.equal(item.ID.toString())
	// 	expect(part.rundownId).to.equal('rundown_rundown0')
	// 	expect(part.segmentId).to.equal('segment00')
	// 	expect(part._rank).to.equal(123)
	// })
	// it('insertSegment', function () {
	// 	let story = xmlApiData.rundownElementAction_insert_story_Stories[0]
	// 	let rundownID = 'rundown_rundown0'
	// 	insertSegment(story, rundownID, 123)
	//
	// 	let dbSegment = Segments.findOne(segmentId(rundownID, '', story.ID))
	//
	// 	expect(dbSegment).to.be.an('object')
	// 	expect(dbSegment.mosId).to.equal(story.ID.toString())
	// 	expect(dbSegment._rank).to.equal(123)
	// 	expect(dbSegment.rundownId).to.equal('rundown_rundown0')
	//
	// 	let dbParts = Parts.find({
	// 		rundownId: dbSegment.rundownId,
	// 		segmentId: dbSegment._id
	// 	},mod).fetch()
	//
	// 	expect(dbParts).to.have.length(story.Items.length)
	//
	// 	expect(dbParts[0]._id).to.equal( partId(dbSegment._id, story.Items[0].ID))
	// })
	// it('removeSegment', function () {
	// 	let dbSegment = Segments.findOne(segmentId('rundown_rundown0','',  new MOS.MosString128('segment00')))
	// 	expect(dbSegment).to.be.an('object')
	// 	expect(dbSegment.mosId).to.equal('segment00')
	// 	expect(dbSegment.rundownId).to.equal('rundown_rundown0')
	// 	expect(
	// 		Parts.find({segmentId: dbSegment._id}).fetch().length
	// 	).to.be.greaterThan(0)
	//
	// 	removeSegment( dbSegment._id, dbSegment.rundownId)
	//
	// 	expect(Segments.find(dbSegment._id).fetch()).to.have.length(0)
	// 	expect(
	// 		Parts.find({segmentId: dbSegment._id}).fetch()
	// 	).to.have.length(0)
	// })
	// it('fetchBefore & fetchAfter', function () {
	// 	let segment00 = Segments.findOne(segmentId('rundown_rundown0','',  new MOS.MosString128('segment00')))
	// 	let segment00Before = fetchBefore(Segments, { rundownId: segment00.rundownId}, segment00._rank)
	// 	let segment00After = fetchAfter(Segments, { rundownId: segment00.rundownId}, segment00._rank)
	//
	// 	expect(segment00Before).to.equal(undefined)
	// 	expect(segment00After).to.be.an('object')
	// 	expect(segment00After.mosId).to.equal('segment01')
	//
	// 	let segment01 = Segments.findOne(segmentId('rundown_rundown0','',  new MOS.MosString128('segment01')))
	// 	let segment01Before = fetchBefore(Segments, { rundownId: segment01.rundownId}, segment01._rank)
	// 	let segment01After = fetchAfter(Segments, { rundownId: segment01.rundownId}, segment01._rank)
	//
	// 	expect(segment01Before).to.be.an('object')
	// 	expect(segment01Before.mosId).to.equal('segment00')
	// 	expect(segment01After).to.be.an('object')
	// 	expect(segment01After.mosId).to.equal('segment02')
	//
	// 	let segment02 = Segments.findOne(segmentId('rundown_rundown0','',  new MOS.MosString128('segment02')))
	// 	let segment02Before = fetchBefore(Segments, { rundownId: segment02.rundownId}, segment02._rank)
	// 	let segment02After = fetchAfter(Segments, { rundownId: segment02.rundownId}, segment02._rank)
	//
	// 	expect(segment02Before).to.be.an('object')
	// 	expect(segment02Before.mosId).to.equal('segment01')
	// 	expect(segment02After).to.equal(undefined)
	// })
	// it('getRank', function () {
	//
	// 	let before = {_rank: 10}
	// 	let after = {_rank: 22}
	//
	// 	// insert 1 in between
	// 	expect(getRank(before, after, 0, 1)).to.equal(16)
	// 	// insert 2 in between
	// 	expect(getRank(before, after, 0, 2)).to.equal(14)
	// 	expect(getRank(before, after, 1, 2)).to.equal(18)
	// 	// insert 3 in between
	// 	expect(getRank(before, after, 0, 3)).to.equal(13)
	// 	expect(getRank(before, after, 1, 3)).to.equal(16)
	// 	expect(getRank(before, after, 2, 3)).to.equal(19)
	// 	// insert 1 first
	// 	expect(getRank(null, before, 0, 1)).to.be.lessThan(10)
	// 	// insert 2 first
	// 	expect(getRank(null, before, 0, 2)).to.be.lessThan(10)
	// 	expect(getRank(null, before, 1, 2)).to.be.lessThan(10)
	// 	// insert 1 last
	// 	expect(getRank(after, null, 0, 1)).to.be.greaterThan(22)
	// 	// insert 2 last
	// 	expect(getRank(after, null, 0, 2)).to.be.greaterThan(22)
	// 	expect(getRank(after, null, 1, 2)).to.be.greaterThan(22)
	// })
})
describe('peripheralDevice: MOS API methods', function () {

	// it('mosRoCreate', function () {
	// 	// Test data:
	// 	let rundown = xmlApiData.rundownCreate
	// 	let story = rundown.Stories[0]
	// 	let item = story.Items[0]
	//
	// 	ServerPeripheralDeviceAPI.mosRoCreate(rundown)
	//
	// 	let dbRundown = Rundowns.findOne(rundownId(rundown.ID))
	// 	expect(dbRundown).to.be.an('object')
	// 	expect(dbRundown.mosId).to.equal(rundown.ID.toString())
	// 	expect(dbRundown.name).to.equal(rundown.Slug.toString())
	//
	// 	let dbSegments = Segments.find({
	// 		rundownId: dbRundown._id
	// 	}, mod).fetch()
	// 	expect(dbSegments).to.have.length(rundown.Stories.length)
	// 	let dbSegment = dbSegments[0]
	// 	expect(dbSegment.mosId).to.equal(story.ID.toString())
	//
	// 	let dbParts = Parts.find({
	// 		rundownId: dbRundown._id,
	// 		segmentId: dbSegment._id
	// 	}, mod).fetch()
	// 	expect(dbParts).to.have.length(story.Items.length)
	// 	let dbPart = dbParts[0]
	// 	expect(dbPart.mosId).to.equal(item.ID.toString())
	// })
	// it('mosRoDelete', function () {
	// 	// Test data:
	// 	let rundown = xmlApiData.rundownCreate
	// 	let story = rundown.Stories[0]
	// 	let item = story.Items[0]
	//
	// 	let rundownID = rundownId(rundown.ID)
	// 	// first create:
	// 	ServerPeripheralDeviceAPI.mosRoCreate(rundown)
	// 	expect(Rundowns.find(rundownID).fetch()).to.have.length(1)
	// 	// Then delete:
	// 	ServerPeripheralDeviceAPI.mosRoDelete(rundown.ID)
	//
	// 	expect(Rundowns.find(rundownID).fetch()).to.have.length(0)
	// 	expect(Segments.find({
	// 		rundownId: rundownID
	// 	}).fetch()).to.have.length(0)
	// 	expect(Parts.find({
	// 		rundownId: rundownID
	// 	}).fetch()).to.have.length(0)
	// 	expect(Pieces.find({
	// 		rundownId: rundownID
	// 	}).fetch()).to.have.length(0)
	// })
	// it('mosRoMetadata', function () {
	// 	// Test data:
	// 	let rundown = xmlApiData.rundownCreate
	// 	let md = xmlApiData.rundownMetadataReplace
	//
	// 	// first create the rundown:
	// 	ServerPeripheralDeviceAPI.mosRoCreate(rundown)
	// 	// Then delete:
	// 	ServerPeripheralDeviceAPI.mosRoMetadata(md)
	//
	// 	let dbRundown = Rundowns.findOne(rundownId(rundown.ID))
	// 	expect(dbRundown).to.be.an('object')
	// 	expect(dbRundown.mosId).to.equal(rundown.ID.toString())
	// 	// expect(dbRundown.metaData).to.be.an('object')
	// 	// TODO: Make a test (and testdata?) for this?
	//
	// })
	// it('mosRoStatus', function () {
	// 	// Test data:
	// 	let rundown = xmlApiData.rundownCreate
	// 	let status0: MOS.IMOSRunningOrderStatus = {
	// 		ID: rundown.ID,
	// 		Status: MOS.IMOSObjectStatus.MANUAL_CTRL,
	// 		Time: new MOS.MosTime('2009-04-11T14:13:53')
	// 	}
	// 	let status1: MOS.IMOSRunningOrderStatus = {
	// 		ID: rundown.ID,
	// 		Status: MOS.IMOSObjectStatus.READY,
	// 		Time: new MOS.MosTime('2009-04-11T14:13:53')
	// 	}
	// 	let statusUnknown: MOS.IMOSRunningOrderStatus = {
	// 		ID: new MOS.MosString128('unknown'),
	// 		Status: MOS.IMOSObjectStatus.MOVED,
	// 		Time: new MOS.MosTime('2009-04-11T14:13:53')
	// 	}
	// 	// first create the rundown:
	// 	ServerPeripheralDeviceAPI.mosRoCreate(rundown)
	// 	// Set status:
	// 	ServerPeripheralDeviceAPI.mosRoStatus(status0)
	// 	expect(Rundowns.findOne(rundownId(rundown.ID)).status).to.be.equal(status0.Status)
	// 	ServerPeripheralDeviceAPI.mosRoStatus(status1)
	// 	expect(Rundowns.findOne(rundownId(rundown.ID)).status).to.be.equal(status1.Status)
	// 	expect(() => {
	// 		ServerPeripheralDeviceAPI.mosRoStatus(statusUnknown)
	// 	}).to.throw(/404/)
	// 	expect(Rundowns.findOne(rundownId(rundown.ID)).status).to.be.equal(status1.Status) // keep the previous status
	// })
	// it('mosRoStoryStatus', function () {
	// 	// Test data:
	// 	let rundown = xmlApiData.rundownCreate
	// 	let story = rundown.Stories[0]
	// 	let status0: MOS.IMOSStoryStatus = {
	// 		ID: story.ID,
	// 		RundownId: rundown.ID,
	// 		Status: MOS.IMOSObjectStatus.MANUAL_CTRL,
	// 		Time: new MOS.MosTime('2009-04-11T14:13:53')
	// 	}
	// 	let status1: MOS.IMOSStoryStatus = {
	// 		ID: story.ID,
	// 		RundownId: rundown.ID,
	// 		Status: MOS.IMOSObjectStatus.READY,
	// 		Time: new MOS.MosTime('2009-04-11T14:13:53')
	// 	}
	// 	let statusUnknown0: MOS.IMOSStoryStatus = {
	// 		ID: new MOS.MosString128('unknown'),
	// 		RundownId: rundown.ID,
	// 		Status: MOS.IMOSObjectStatus.NOT_READY,
	// 		Time: new MOS.MosTime('2009-04-11T14:13:53')
	// 	}
	// 	let statusUnknown1: MOS.IMOSStoryStatus = {
	// 		ID: story.ID,
	// 		RundownId: new MOS.MosString128('unknown'),
	// 		Status: MOS.IMOSObjectStatus.UPDATED,
	// 		Time: new MOS.MosTime('2009-04-11T14:13:53')
	// 	}
	// 	let segmentID = segmentId(rundownId(rundown.ID), story.ID)
	// 	// first create the rundown:
	// 	ServerPeripheralDeviceAPI.mosRoCreate(rundown)
	// 	// Set status:
	// 	ServerPeripheralDeviceAPI.mosRoStoryStatus(status0)
	// 	expect(Segments.findOne(segmentID).status).to.be.equal(status0.Status)
	// 	ServerPeripheralDeviceAPI.mosRoStoryStatus(status1)
	// 	expect(Segments.findOne(segmentID).status).to.be.equal(status1.Status)
	// 	expect(() => {
	// 		ServerPeripheralDeviceAPI.mosRoStoryStatus(statusUnknown0)
	// 	}).to.throw(/404/)
	// 	expect(Segments.findOne(segmentID).status).to.be.equal(status1.Status) // keep the previous status
	// 	expect(() => {
	// 		ServerPeripheralDeviceAPI.mosRoStoryStatus(statusUnknown1)
	// 	}).to.throw(/404/)
	// 	expect(Segments.findOne(segmentID).status).to.be.equal(status1.Status) // keep the previous status
	// })
	// it('mosRoItemStatus', function () {
	// 	// Test data:
	// 	let rundown = xmlApiData.rundownCreate
	// 	let story = rundown.Stories[0]
	// 	let item = story.Items[0]
	//
	// 	let status0: MOS.IMOSItemStatus = {
	// 		ID: item.ID,
	// 		StoryId: story.ID,
	// 		RundownId: rundown.ID,
	// 		Status: MOS.IMOSObjectStatus.MANUAL_CTRL,
	// 		Time: new MOS.MosTime('2009-04-11T14:13:53')
	// 	}
	// 	let status1: MOS.IMOSItemStatus = {
	// 		ID: item.ID,
	// 		RundownId: rundown.ID,
	// 		StoryId: story.ID,
	// 		Status: MOS.IMOSObjectStatus.READY,
	// 		Time: new MOS.MosTime('2009-04-11T14:13:53')
	// 	}
	// 	let statusUnknown0: MOS.IMOSItemStatus = {
	// 		ID: new MOS.MosString128('unknown'),
	// 		RundownId: rundown.ID,
	// 		StoryId: story.ID,
	// 		Status: MOS.IMOSObjectStatus.NOT_READY,
	// 		Time: new MOS.MosTime('2009-04-11T14:13:53')
	// 	}
	// 	let statusUnknown1: MOS.IMOSItemStatus = {
	// 		ID: item.ID,
	// 		StoryId: new MOS.MosString128('unknown'),
	// 		RundownId: rundown.ID,
	// 		Status: MOS.IMOSObjectStatus.UPDATED,
	// 		Time: new MOS.MosTime('2009-04-11T14:13:53')
	// 	}
	// 	let statusUnknown2: MOS.IMOSItemStatus = {
	// 		ID: item.ID,
	// 		StoryId: story.ID,
	// 		RundownId: new MOS.MosString128('unknown'),
	// 		Status: MOS.IMOSObjectStatus.BUSY,
	// 		Time: new MOS.MosTime('2009-04-11T14:13:53')
	// 	}
	// 	let segmentID = segmentId(rundownId(rundown.ID), story.ID)
	// 	let partID = partId(segmentID, item.ID)
	// 	// first create the rundown:
	// 	ServerPeripheralDeviceAPI.mosRoCreate(rundown)
	// 	// Set status:
	// 	ServerPeripheralDeviceAPI.mosRoItemStatus(status0)
	// 	expect(Parts.findOne(partID).status).to.be.equal(status0.Status)
	// 	ServerPeripheralDeviceAPI.mosRoItemStatus(status1)
	// 	expect(Parts.findOne(partID).status).to.be.equal(status1.Status)
	// 	expect(() => {
	// 		ServerPeripheralDeviceAPI.mosRoItemStatus(statusUnknown0)
	// 	}).to.throw(/404/)
	// 	expect(Parts.findOne(partID).status).to.be.equal(status1.Status) // keep the previous status
	// 	expect(() => {
	// 		ServerPeripheralDeviceAPI.mosRoItemStatus(statusUnknown1)
	// 	}).to.throw(/404/)
	// 	expect(Parts.findOne(partID).status).to.be.equal(status1.Status) // keep the previous status
	// 	expect(() => {
	// 		ServerPeripheralDeviceAPI.mosRoItemStatus(statusUnknown2)
	// 	}).to.throw(/404/)
	// 	expect(Parts.findOne(partID).status).to.be.equal(status1.Status) // keep the previous status
	// })
	// it('mosRoStoryInsert', function () {
	// 	// Test data:
	// 	let rundown = xmlApiData.rundownCreate
	// 	let story0 = rundown.Stories[0]
	// 	let story1 = rundown.Stories[1]
	//
	// 	let action0: MOS.IMOSStoryAction = {
	// 		RundownID: rundown.ID,
	// 		StoryID: story1.ID // will insert a story before this
	// 	}
	// 	let stories0 = xmlApiData.rundownElementAction_insert_story_Stories
	//
	// 	// first create the rundown:
	// 	ServerPeripheralDeviceAPI.mosRoCreate(rundown)
	// 	let dbRundown = Rundowns.findOne(rundownId(rundown.ID))
	// 	let dbSegments0 = Segments.find({ rundownId: dbRundown._id }).fetch()
	//
	// 	// Insert story:
	// 	ServerPeripheralDeviceAPI.mosRoStoryInsert(action0, stories0)
	// 	let dbSegments1 = Segments.find({
	// 		rundownId: dbRundown._id
	// 	}, mod).fetch()
	// 	expect(dbSegments1.length).to.be.greaterThan(dbSegments0.length)
	// 	expect(dbSegments1.length).to.equal(dbSegments0.length + stories0.length)
	// 	expect(dbSegments1[1].mosId).to.equal(stories0[0].ID.toString())
	//
	// })
	// it('mosRoItemInsert', function () {
	// 	// Test data:
	// 	let rundown = xmlApiData.rundownCreate
	// 	let story = rundown.Stories[0]
	// 	let item0 = story.Items[0]
	//
	// 	let action0: MOS.IMOSItemAction = {
	// 		RundownID: rundown.ID,
	// 		StoryID: story.ID,
	// 		ItemID: item0.ID // will insert an item before this
	//
	// 	}
	// 	let items0 = xmlApiData.rundownElementAction_insert_item_Items
	//
	// 	// first create the rundown:
	// 	ServerPeripheralDeviceAPI.mosRoCreate(rundown)
	// 	let dbRundown = Rundowns.findOne(rundownId(rundown.ID))
	// 	let dbSegment0 = Segments.findOne( segmentId(rundownId(rundown.ID), story.ID))
	// 	let dbParts0 = Parts.find({ rundownId: dbRundown._id, segmentId: dbSegment0._id }).fetch()
	//
	// 	// Insert item:
	// 	ServerPeripheralDeviceAPI.mosRoItemInsert(action0, items0)
	// 	let dbParts1 = Parts.find({ rundownId: dbRundown._id, segmentId: dbSegment0._id }, mod).fetch()
	// 	expect(dbParts1.length).to.be.greaterThan(dbParts0.length)
	// 	expect(dbParts1.length).to.equal(dbParts0.length + items0.length)
	// 	expect(dbParts1[0].mosId).to.equal(items0[0].ID.toString())
	//
	// })
	// it('mosRoStoryReplace', function () {
	// 	// Test data:
	// 	let rundown = xmlApiData.rundownCreate
	// 	let story = rundown.Stories[0]
	//
	// 	let action0: MOS.IMOSStoryAction = {
	// 		RundownID: rundown.ID,
	// 		StoryID: story.ID // will replace this story
	//
	// 	}
	// 	let stories0 = xmlApiData.rundownElementAction_replace_story_Stories
	//
	// 	// first create the rundown:
	// 	ServerPeripheralDeviceAPI.mosRoCreate(rundown)
	// 	let dbRundown = Rundowns.findOne(rundownId(rundown.ID))
	// 	let dbSegments0 = Segments.find({ rundownId: dbRundown._id }).fetch()
	//
	// 	// Replace story:
	// 	ServerPeripheralDeviceAPI.mosRoStoryReplace(action0, stories0)
	// 	let dbSegments1 = Segments.find({
	// 		rundownId: dbRundown._id
	// 	}, mod).fetch()
	// 	expect(dbSegments1.length).to.equal(dbSegments0.length - 1 + stories0.length)
	// 	expect(dbSegments1[0].mosId).to.equal(stories0[0].ID.toString())
	//
	// })
	// it('mosRoItemReplace', function () {
	// 	// Test data:
	// 	let rundown = xmlApiData.rundownCreate
	// 	let story = rundown.Stories[0]
	// 	let item0 = story.Items[0]
	//
	// 	let action0: MOS.IMOSItemAction = {
	// 		RundownID: rundown.ID,
	// 		StoryID: story.ID,
	// 		ItemID: item0.ID // will replace this item
	//
	// 	}
	// 	let items0 = xmlApiData.rundownElementAction_replace_item_Items
	//
	// 	// first create the rundown:
	// 	ServerPeripheralDeviceAPI.mosRoCreate(rundown)
	// 	let dbRundown = Rundowns.findOne(rundownId(rundown.ID))
	// 	let dbSegment0 = Segments.findOne( segmentId(rundownId(rundown.ID), story.ID))
	// 	let dbParts0 = Parts.find({ rundownId: dbRundown._id, segmentId: dbSegment0._id }).fetch()
	//
	// 	// Replace item:
	// 	ServerPeripheralDeviceAPI.mosRoItemReplace(action0, items0)
	// 	let dbParts1 = Parts.find({ rundownId: dbRundown._id, segmentId: dbSegment0._id }, mod).fetch()
	// 	expect(dbParts1.length).to.equal(dbParts0.length - 1 + items0.length)
	// 	expect(dbParts1[0].mosId).to.equal(items0[0].ID.toString())
	//
	// })
	// it('mosRoStoryMove', function () {
	// 	// Test data:
	// 	let rundown = xmlApiData.rundownCreate
	// 	let story0 = rundown.Stories[0]
	// 	let story1 = rundown.Stories[1]
	//
	// 	let action0: MOS.IMOSStoryAction = {
	// 		RundownID: rundown.ID,
	// 		StoryID: story0.ID // will move a story to before this story
	// 	}
	//
	// 	// first create the rundown:
	// 	ServerPeripheralDeviceAPI.mosRoCreate(rundown)
	// 	let dbRundown = Rundowns.findOne(rundownId(rundown.ID))
	// 	let dbSegments0 = Segments.find({ rundownId: dbRundown._id }).fetch()
	//
	// 	// Move story:
	// 	ServerPeripheralDeviceAPI.mosRoStoryMove(action0, [story1.ID])
	// 	let dbSegments1 = Segments.find({
	// 		rundownId: dbRundown._id
	// 	}, mod).fetch()
	// 	expect(dbSegments1.length).to.equal(dbSegments0.length)
	// 	expect(dbSegments1[0].mosId).to.equal(story1.ID.toString())
	// 	expect(dbSegments1[1].mosId).to.equal(story0.ID.toString())
	//
	// })
	// it('mosRoItemMove', function () {
	// 	// Test data:
	// 	let rundown = xmlApiData.rundownCreate
	// 	let story = rundown.Stories[0]
	// 	let item0 = story.Items[0]
	//
	// 	let action0: MOS.IMOSItemAction = {
	// 		RundownID: rundown.ID,
	// 		StoryID: story.ID,
	// 		ItemID: item0.ID // will move before this item
	// 	}
	// 	let items0 = xmlApiData.rundownElementAction_insert_item_Items
	//
	// 	// first create the rundown:
	// 	ServerPeripheralDeviceAPI.mosRoCreate(rundown)
	// 	ServerPeripheralDeviceAPI.mosRoItemInsert(action0, items0)
	//
	// 	let dbRundown = Rundowns.findOne(rundownId(rundown.ID))
	// 	let dbSegment0 = Segments.findOne( segmentId(rundownId(rundown.ID), story.ID))
	// 	let dbParts0 = Parts.find({ rundownId: dbRundown._id, segmentId: dbSegment0._id }).fetch()
	//
	// 	// Move item:
	// 	ServerPeripheralDeviceAPI.mosRoItemMove(action0, [new MOS.MosString128(dbParts0[0].mosId)])
	// 	let dbParts1 = Parts.find({ rundownId: dbRundown._id, segmentId: dbSegment0._id }, mod).fetch()
	// 	expect(dbParts1.length).to.equal(dbParts0.length)
	// 	expect(dbParts1[0].mosId).to.equal(dbParts0[1].mosId)
	// 	expect(dbParts1[1].mosId).to.equal(dbParts0[0].mosId)
	//
	// })
	// it('mosRoStoryDelete', function () {
	// 	// Test data:
	// 	let rundown = xmlApiData.rundownCreate
	// 	let story0 = rundown.Stories[0]
	// 	let story1 = rundown.Stories[1]
	//
	// 	let action0: MOS.IMOSStoryAction = {
	// 		RundownID: rundown.ID,
	// 		StoryID: story0.ID // will delete this story
	// 	}
	//
	// 	// first create the rundown:
	// 	ServerPeripheralDeviceAPI.mosRoCreate(rundown)
	// 	let dbRundown = Rundowns.findOne(rundownId(rundown.ID))
	// 	let dbSegments0 = Segments.find({ rundownId: dbRundown._id }).fetch()
	//
	// 	// Delete story:
	// 	ServerPeripheralDeviceAPI.mosRoStoryDelete(action0, [story1.ID])
	// 	let dbSegments1 = Segments.find({
	// 		rundownId: dbRundown._id
	// 	}, mod).fetch()
	// 	expect(dbSegments1.length).to.equal(dbSegments0.length - 1)
	//
	// })
	// it('mosRoItemDelete', function () {
	// 	// Test data:
	// 	let rundown = xmlApiData.rundownCreate
	// 	let story = rundown.Stories[0]
	// 	let item0 = story.Items[0]
	//
	// 	let action0: MOS.IMOSItemAction = {
	// 		RundownID: rundown.ID,
	// 		StoryID: story.ID,
	// 		ItemID: item0.ID // will delete this item
	//
	// 	}
	// 	let items0 = xmlApiData.rundownElementAction_insert_item_Items
	//
	// 	// first create the rundown:
	// 	ServerPeripheralDeviceAPI.mosRoCreate(rundown)
	// 	ServerPeripheralDeviceAPI.mosRoItemInsert(action0, items0)
	//
	// 	let dbRundown = Rundowns.findOne(rundownId(rundown.ID))
	// 	let dbSegment0 = Segments.findOne( segmentId(rundownId(rundown.ID), story.ID))
	// 	let dbParts0 = Parts.find({ rundownId: dbRundown._id, segmentId: dbSegment0._id }).fetch()
	//
	// 	// Delete item:
	// 	ServerPeripheralDeviceAPI.mosRoItemDelete(action0, [new MOS.MosString128(dbParts0[0].mosId)])
	// 	let dbParts1 = Parts.find({ rundownId: dbRundown._id, segmentId: dbSegment0._id }, mod).fetch()
	// 	expect(dbParts1.length).to.equal(dbParts0.length - 1)
	//
	// })
	// it('mosRoStorySwap', function () {
	// 	// Test data:
	// 	let rundown = xmlApiData.rundownCreate
	// 	let story0 = rundown.Stories[0]
	// 	let story1 = rundown.Stories[1]
	//
	// 	let action0: MOS.IMOSROAction = {
	// 		RundownID: rundown.ID
	// 	}
	//
	// 	// first create the rundown:
	// 	ServerPeripheralDeviceAPI.mosRoCreate(rundown)
	// 	let dbRundown = Rundowns.findOne(rundownId(rundown.ID))
	// 	let dbSegments0 = Segments.find({ rundownId: dbRundown._id }).fetch()
	//
	// 	// Swap stories:
	// 	ServerPeripheralDeviceAPI.mosRoStorySwap(action0, story0.ID, story1.ID)
	// 	let dbSegments1 = Segments.find({
	// 		rundownId: dbRundown._id
	// 	}, mod).fetch()
	// 	expect(dbSegments1.length).to.equal(dbSegments0.length)
	// 	expect(dbSegments1[0].mosId).to.equal(story1.ID.toString())
	// 	expect(dbSegments1[1].mosId).to.equal(story0.ID.toString())
	//
	// })
	// it('mosRoItemSwap', function () {
	// 	// Test data:
	// 	let rundown = xmlApiData.rundownCreate
	// 	let story = rundown.Stories[0]
	// 	let item0 = story.Items[0]
	//
	// 	let action0: MOS.IMOSItemAction = {
	// 		RundownID: rundown.ID,
	// 		StoryID: story.ID,
	// 		ItemID: item0.ID // will move before this item
	// 	}
	// 	let action1: MOS.IMOSStoryAction = {
	// 		RundownID: rundown.ID,
	// 		StoryID: story.ID
	// 	}
	// 	let items0 = xmlApiData.rundownElementAction_insert_item_Items
	//
	// 	// first create the rundown:
	// 	ServerPeripheralDeviceAPI.mosRoCreate(rundown)
	// 	ServerPeripheralDeviceAPI.mosRoItemInsert(action0, items0)
	//
	// 	let dbRundown = Rundowns.findOne(rundownId(rundown.ID))
	// 	let dbSegment0 = Segments.findOne( segmentId(rundownId(rundown.ID), story.ID))
	// 	let dbParts0 = Parts.find({ rundownId: dbRundown._id, segmentId: dbSegment0._id }).fetch()
	//
	// 	// Swap items:
	// 	ServerPeripheralDeviceAPI.mosRoItemSwap(action1, item0.ID, items0[0].ID)
	// 	let dbParts1 = Parts.find({ rundownId: dbRundown._id, segmentId: dbSegment0._id }, mod).fetch()
	// 	expect(dbParts1.length).to.equal(dbParts0.length)
	// 	expect(dbParts1[0].mosId).to.equal(dbParts0[1].mosId)
	// 	expect(dbParts1[1].mosId).to.equal(dbParts0[0].mosId)
	//
	// })
	// it('mosRoReadyToAir', function () {
	// 	// Test data:
	// 	let rundown = xmlApiData.rundownCreate
	// 	let story = rundown.Stories[0]
	// 	let item0 = story.Items[0]
	//
	// 		ID: rundown.ID,
	// 		Status: MOS.IMOSObjectAirStatus.READY
	// 	}
	//
	// 		ID: rundown.ID,
	// 		Status: MOS.IMOSObjectAirStatus.NOT_READY
	// 	}
	//
	// 	// first create the rundown:
	// 	ServerPeripheralDeviceAPI.mosRoCreate(rundown)
	// 	let dbRundown = Rundowns.findOne(rundownId(rundown.ID))
	//
	// 	// Set ready to air status:
	// 	ServerPeripheralDeviceAPI.mosRoReadyToAir(status0)
	// 	expect(Rundowns.findOne(dbRundown._id).airStatus).to.equal(status0.Status)
	//
	// 	ServerPeripheralDeviceAPI.mosRoReadyToAir(status1)
	// 	expect(Rundowns.findOne(dbRundown._id).airStatus).to.equal(status1.Status)
	//
	// })
})
