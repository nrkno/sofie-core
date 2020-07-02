import { Meteor } from 'meteor/meteor'
import { Match } from 'meteor/check'
import * as _ from 'underscore'
import { PeripheralDeviceAPI, NewPeripheralDeviceAPI, PeripheralDeviceAPIMethods } from '../../lib/api/peripheralDevice'
import { PeripheralDevices, PeripheralDeviceId } from '../../lib/collections/PeripheralDevices'
import { Rundowns } from '../../lib/collections/Rundowns'
import { getCurrentTime, protectString, makePromise, waitForPromise, check } from '../../lib/lib'
import { PeripheralDeviceSecurity } from '../security/peripheralDevices'
import { PeripheralDeviceCommands, PeripheralDeviceCommandId } from '../../lib/collections/PeripheralDeviceCommands'
import { logger } from '../logging'
import { Timeline, getTimelineId } from '../../lib/collections/Timeline'
import { Studios } from '../../lib/collections/Studios'
import { ServerPlayoutAPI } from './playout/playout'
import { registerClassToMeteorMethods } from '../methods'
import { IncomingMessage, ServerResponse } from 'http'
import { parse as parseUrl } from 'url'
import { syncFunction } from '../codeControl'
import { afterUpdateTimeline } from './playout/timeline'
import { RundownInput } from './ingest/rundownInput'
import { IngestRundown, IngestSegment, IngestPart } from 'tv-automation-sofie-blueprints-integration'
import { MosIntegration } from './ingest/mosDevice/mosIntegration'
import { MediaScannerIntegration } from './integration/media-scanner'
import { MediaObject } from '../../lib/collections/MediaObjects'
import { MediaManagerIntegration } from './integration/mediaWorkFlows'
import { MediaWorkFlowId, MediaWorkFlow } from '../../lib/collections/MediaWorkFlows'
import { MediaWorkFlowStepId, MediaWorkFlowStep } from '../../lib/collections/MediaWorkFlowSteps'
import * as MOS from 'mos-connection'
import { determineDiffTime, getTimeDiff } from './systemTime/systemTime'
import { PickerPOST } from './http'
import { initCacheForNoRundownPlaylist, initCacheForStudio, initCacheForRundownPlaylist } from '../DatabaseCaches'
import { RundownPlaylists } from '../../lib/collections/RundownPlaylists'

// import {ServerPeripheralDeviceAPIMOS as MOS} from './peripheralDeviceMos'
export namespace ServerPeripheralDeviceAPI {
	export function initialize(
		deviceId: PeripheralDeviceId,
		token: string,
		options: PeripheralDeviceAPI.InitOptions
	): PeripheralDeviceId {
		check(deviceId, String)
		check(token, String)
		check(options, Object)
		check(options.name, String)
		check(options.category, String)
		check(options.type, String)
		check(options.subType, Match.OneOf(Number, String))
		check(options.parentDeviceId, Match.Optional(String))
		check(options.versions, Match.Optional(Object))

		logger.debug('Initialize device ' + deviceId, options)

		let peripheralDevice
		try {
			peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, token, this)

			PeripheralDevices.update(deviceId, {
				$set: {
					lastSeen: getCurrentTime(),
					lastConnected: getCurrentTime(),
					connected: true,
					connectionId: options.connectionId,

					category: options.category,
					type: options.type,
					subType: options.subType,

					name: peripheralDevice.name || options.name,
					parentDeviceId: options.parentDeviceId,
					versions: options.versions,

					configManifest: options.configManifest,
				},
			})
		} catch (e) {
			if ((e as Meteor.Error).error === 404) {
				PeripheralDevices.insert({
					_id: deviceId,
					created: getCurrentTime(),
					status: {
						statusCode: PeripheralDeviceAPI.StatusCode.UNKNOWN,
					},
					studioId: protectString(''),
					connected: true,
					connectionId: options.connectionId,
					lastSeen: getCurrentTime(),
					lastConnected: getCurrentTime(),
					token: token,

					category: options.category,
					type: options.type,
					subType: options.subType,

					name: options.name,
					parentDeviceId: options.parentDeviceId,
					versions: options.versions,
					// settings: {},

					configManifest: options.configManifest,
				})
			} else {
				throw e
			}
		}
		return deviceId
	}
	export function unInitialize(deviceId: PeripheralDeviceId, token: string): PeripheralDeviceId {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, token, this)
		if (!peripheralDevice) throw new Meteor.Error(404, "peripheralDevice '" + deviceId + "' not found!")

		// TODO: Add an authorization for this?

		PeripheralDevices.remove(deviceId)
		return deviceId
	}
	export function setStatus(
		deviceId: PeripheralDeviceId,
		token: string,
		status: PeripheralDeviceAPI.StatusObject
	): PeripheralDeviceAPI.StatusObject {
		check(deviceId, String)
		check(token, String)
		check(status, Object)
		check(status.statusCode, Number)
		if (
			status.statusCode < PeripheralDeviceAPI.StatusCode.UNKNOWN ||
			status.statusCode > PeripheralDeviceAPI.StatusCode.FATAL
		) {
			throw new Meteor.Error(400, 'device status code is not known')
		}

		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, token, this)
		if (!peripheralDevice) throw new Meteor.Error(404, "peripheralDevice '" + deviceId + "' not found!")

		// check if we have to update something:
		if (!_.isEqual(status, peripheralDevice.status)) {
			logger.info(
				`Changed status of device ${peripheralDevice._id} "${peripheralDevice.name}" to ${status.statusCode}`
			)
			// perform the update:
			PeripheralDevices.update(deviceId, {
				$set: {
					status: status,
				},
			})
		}
		return status
	}
	export function ping(deviceId: PeripheralDeviceId, token: string): void {
		check(deviceId, String)
		check(token, String)

		// logger.debug('device ping', id)

		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, token, this)
		if (!peripheralDevice) throw new Meteor.Error(404, "peripheralDevice '" + deviceId + "' not found!")

		// Update lastSeen
		PeripheralDevices.update(deviceId, {
			$set: {
				lastSeen: getCurrentTime(),
			},
		})
	}
	export function getPeripheralDevice(deviceId: PeripheralDeviceId, token: string) {
		return PeripheralDeviceSecurity.getPeripheralDevice(deviceId, token, this)
	}
	export const timelineTriggerTime = syncFunction(function timelineTriggerTime(
		deviceId: PeripheralDeviceId,
		token: string,
		results: PeripheralDeviceAPI.TimelineTriggerTimeResult
	) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, token, this)
		if (!peripheralDevice) throw new Meteor.Error(404, `peripheralDevice "${deviceId}" not found!`)
		if (!peripheralDevice.studioId)
			throw new Meteor.Error(401, `peripheralDevice "${deviceId}" not attached to a studio`)

		const studioId = peripheralDevice.studioId

		// check(r.time, Number)
		check(results, Array)
		_.each(results, (o) => {
			check(o.id, String)
			check(o.time, Number)
		})

		if (results.length > 0) {
			const activePlaylist = RundownPlaylists.findOne({
				studioId: studioId,
				active: true,
			})
			// TODO-INFINITE - This cache usage NEEDS to be inside a rundownPlaylistSyncFunction. otherwise the cache.saveAllToDatabase() could fight with another
			const cache = activePlaylist
				? waitForPromise(initCacheForRundownPlaylist(activePlaylist))
				: waitForPromise(initCacheForNoRundownPlaylist(studioId))
			const allowedRundownsIds = activePlaylist
				? _.map(cache.Rundowns.findFetch({ playlistId: activePlaylist._id }), (r) => r._id)
				: []

			_.each(results, (o) => {
				check(o.id, String)

				// check(o.time, Number)
				logger.info('Timeline: Setting time: "' + o.id + '": ' + o.time)

				const id = getTimelineId(studioId, o.id)
				const obj = cache.Timeline.findOne({
					_id: id,
					studioId: studioId,
				})
				if (obj) {
					cache.Timeline.update(
						{
							_id: id,
							studioId: studioId,
						},
						{
							$set: {
								'enable.start': o.time,
								'enable.setFromNow': true,
							},
						}
					)

					obj.enable.start = o.time
					obj.enable.setFromNow = true

					ServerPlayoutAPI.timelineTriggerTimeUpdateCallback(cache, allowedRundownsIds, obj, o.time)
				}
			})
			// After we've updated the timeline, we must call afterUpdateTimeline!
			afterUpdateTimeline(cache, studioId)
			waitForPromise(cache.saveAllToDatabase())
		}
	},
	'timelineTriggerTime$0,$1')
	export function partPlaybackStarted(
		deviceId: PeripheralDeviceId,
		token: string,
		r: PeripheralDeviceAPI.PartPlaybackStartedResult
	) {
		// This is called from the playout-gateway when a part starts playing.
		// Note that this function can / might be called several times from playout-gateway for the same part
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, token, this)
		if (!peripheralDevice) throw new Meteor.Error(404, "peripheralDevice '" + deviceId + "' not found!")

		check(r.time, Number)
		check(r.rundownPlaylistId, String)
		check(r.partInstanceId, String)

		ServerPlayoutAPI.onPartPlaybackStarted(r.rundownPlaylistId, r.partInstanceId, r.time)
	}
	export function partPlaybackStopped(
		deviceId: PeripheralDeviceId,
		token: string,
		r: PeripheralDeviceAPI.PartPlaybackStoppedResult
	) {
		// This is called from the playout-gateway when an
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, token, this)
		if (!peripheralDevice) throw new Meteor.Error(404, "peripheralDevice '" + deviceId + "' not found!")

		check(r.time, Number)
		check(r.rundownPlaylistId, String)
		check(r.partInstanceId, String)

		ServerPlayoutAPI.onPartPlaybackStopped(r.rundownPlaylistId, r.partInstanceId, r.time)
	}
	export function piecePlaybackStarted(
		deviceId: PeripheralDeviceId,
		token: string,
		r: PeripheralDeviceAPI.PiecePlaybackStartedResult
	) {
		// This is called from the playout-gateway when an auto-next event occurs
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, token, this)
		if (!peripheralDevice) throw new Meteor.Error(404, "peripheralDevice '" + deviceId + "' not found!")

		check(r.time, Number)
		check(r.rundownPlaylistId, String)
		check(r.pieceInstanceId, String)
		check(r.dynamicallyInserted, Match.Optional(Boolean))

		ServerPlayoutAPI.onPiecePlaybackStarted(r.rundownPlaylistId, r.pieceInstanceId, !!r.dynamicallyInserted, r.time)
	}
	export function piecePlaybackStopped(
		deviceId: PeripheralDeviceId,
		token: string,
		r: PeripheralDeviceAPI.PiecePlaybackStartedResult
	) {
		// This is called from the playout-gateway when an auto-next event occurs
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, token, this)
		if (!peripheralDevice) throw new Meteor.Error(404, "peripheralDevice '" + deviceId + "' not found!")

		check(r.time, Number)
		check(r.rundownPlaylistId, String)
		check(r.pieceInstanceId, String)
		check(r.dynamicallyInserted, Match.Optional(Boolean))

		ServerPlayoutAPI.onPiecePlaybackStopped(r.rundownPlaylistId, r.pieceInstanceId, !!r.dynamicallyInserted, r.time)
	}
	export function pingWithCommand(deviceId: PeripheralDeviceId, token: string, message: string, cb?: Function) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, token, this)
		if (!peripheralDevice) throw new Meteor.Error(404, "peripheralDevice '" + deviceId + "' not found!")

		PeripheralDeviceAPI.executeFunction(
			peripheralDevice._id,
			(err, res) => {
				if (err) {
					logger.warn(err)
				}

				if (cb) cb(err, res)
			},
			'pingResponse',
			message
		)

		ping(deviceId, token)
	}
	export function killProcess(deviceId: PeripheralDeviceId, token: string, really: boolean) {
		// This is used in integration tests only
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, token, this)
		if (!peripheralDevice) throw new Meteor.Error(404, "peripheralDevice '" + deviceId + "' not found!")

		// Make sure this never runs if this server isn't empty:
		if (Rundowns.find().count()) throw new Meteor.Error(400, 'Unable to run killProcess: Rundowns not empty!')

		if (really) {
			this.logger.info('KillProcess command received from ' + peripheralDevice._id + ', shutting down in 1000ms!')
			setTimeout(() => {
				process.exit(0)
			}, 1000)
			return true
		}
		return false
	}
	export function testMethod(
		deviceId: PeripheralDeviceId,
		token: string,
		returnValue: string,
		throwError?: boolean
	): string {
		// used for integration tests with core-connection
		check(deviceId, String)
		check(token, String)
		check(returnValue, String)

		// logger.debug('device ping', id)

		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, token, this)
		if (!peripheralDevice) throw new Meteor.Error(404, "peripheralDevice '" + deviceId + "' not found!")

		if (throwError) {
			throw new Meteor.Error(418, 'Error thrown, as requested')
		} else {
			return returnValue
		}
	}
	export const executeFunction: (
		deviceId: PeripheralDeviceId,
		functionName: string,
		...args: any[]
	) => any = Meteor.wrapAsync((deviceId: PeripheralDeviceId, functionName: string, ...args: any[]) => {
		let args0 = args.slice(0, -1)
		let cb = args.slice(-1)[0] // the last argument in ...args
		PeripheralDeviceAPI.executeFunction(deviceId, cb, functionName, ...args0)
	})

	export function requestUserAuthToken(deviceId: PeripheralDeviceId, token: string, authUrl: string) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, token, this)
		if (!peripheralDevice) throw new Meteor.Error(404, "peripheralDevice '" + deviceId + "' not found!")
		if (peripheralDevice.type !== PeripheralDeviceAPI.DeviceType.SPREADSHEET) {
			throw new Meteor.Error(400, 'can only request user auth token for peripheral device of spreadsheet type')
		}
		check(authUrl, String)

		PeripheralDevices.update(peripheralDevice._id, {
			$set: {
				accessTokenUrl: authUrl,
			},
		})
	}
	export function storeAccessToken(deviceId: PeripheralDeviceId, token: string, accessToken: any) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, token, this)
		if (!peripheralDevice) throw new Meteor.Error(404, "peripheralDevice '" + deviceId + "' not found!")
		if (peripheralDevice.type !== PeripheralDeviceAPI.DeviceType.SPREADSHEET) {
			throw new Meteor.Error(400, 'can only store access token for peripheral device of spreadsheet type')
		}

		PeripheralDevices.update(peripheralDevice._id, {
			$set: {
				accessTokenUrl: '',
				'secretSettings.accessToken': accessToken,
				'settings.secretAccessToken': true,
			},
		})
	}
	export function removePeripheralDevice(deviceId: PeripheralDeviceId) {
		// TODO: Replace this function with an authorized one
		logger.info(`Removing PeripheralDevice ${deviceId}`)

		PeripheralDevices.remove(deviceId)
		PeripheralDevices.remove({
			parentDeviceId: deviceId,
		})
		PeripheralDeviceCommands.remove({
			deviceId: deviceId,
		})
	}
}

PickerPOST.route('/devices/:deviceId/uploadCredentials', (params, req: IncomingMessage, res: ServerResponse, next) => {
	res.setHeader('Content-Type', 'text/plain')

	let deviceId: PeripheralDeviceId = protectString(decodeURIComponent(params.deviceId))

	let url = parseUrl(req.url || '', true)

	let fileNames = url.query['name'] || undefined
	let fileName: string = (_.isArray(fileNames) ? fileNames[0] : fileNames) || ''

	check(deviceId, String)
	check(fileName, String)

	// console.log('Upload of file', fileName, deviceId)

	let content = ''
	try {
		const peripheralDevice = PeripheralDevices.findOne(deviceId) // TODO: a better security model is needed here. Token is a no-go, but something else to verify the user?
		if (!peripheralDevice) throw new Meteor.Error(404, `PeripheralDevice ${deviceId} not found`)

		const body = req.body
		if (!body) throw new Meteor.Error(400, 'Upload credentials: Missing request body')

		if (typeof body !== 'string' || body.length < 10)
			throw new Meteor.Error(400, 'Upload credentials: Invalid request body')

		logger.info('Upload credentails, ' + body.length + ' bytes')

		const credentials = JSON.parse(body)

		PeripheralDevices.update(peripheralDevice._id, {
			$set: {
				'secretSettings.credentials': credentials,
				'settings.secretCredentials': true,
			},
		})

		res.statusCode = 200
	} catch (e) {
		res.statusCode = 500
		content = e + ''
		logger.error('Upload credentials failed: ' + e)
	}

	res.end(content)
})

/** WHen a device has executed a PeripheralDeviceCommand, it will reply to this endpoint with the result */
function functionReply(
	deviceId: PeripheralDeviceId,
	deviceToken: string,
	commandId: PeripheralDeviceCommandId,
	err: any,
	result: any
): void {
	// logger.debug('functionReply', err, result)
	PeripheralDeviceCommands.update(commandId, {
		$set: {
			hasReply: true,
			reply: result,
			replyError: err,
			replyTime: getCurrentTime(),
		},
	})
}

// Set up ALL PeripheralDevice methods:
class ServerPeripheralDeviceAPIClass implements NewPeripheralDeviceAPI {
	// -------- System time --------
	determineDiffTime() {
		return determineDiffTime()
	}
	getTimeDiff() {
		return makePromise(() => getTimeDiff())
	}
	getTime() {
		return makePromise(() => getCurrentTime())
	}

	// ----- PeripheralDevice --------------
	initialize(deviceId: PeripheralDeviceId, deviceToken: string, options: PeripheralDeviceAPI.InitOptions) {
		return makePromise(() => ServerPeripheralDeviceAPI.initialize(deviceId, deviceToken, options))
	}
	unInitialize(deviceId: PeripheralDeviceId, deviceToken: string) {
		return makePromise(() => ServerPeripheralDeviceAPI.unInitialize(deviceId, deviceToken))
	}
	setStatus(deviceId: PeripheralDeviceId, deviceToken: string, status: PeripheralDeviceAPI.StatusObject) {
		return makePromise(() => ServerPeripheralDeviceAPI.setStatus(deviceId, deviceToken, status))
	}
	ping(deviceId: PeripheralDeviceId, deviceToken: string) {
		return makePromise(() => ServerPeripheralDeviceAPI.ping(deviceId, deviceToken))
	}
	getPeripheralDevice(deviceId: PeripheralDeviceId, deviceToken: string) {
		return makePromise(() => ServerPeripheralDeviceAPI.getPeripheralDevice(deviceId, deviceToken))
	}
	partPlaybackStarted(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		r: PeripheralDeviceAPI.PartPlaybackStartedResult
	) {
		return makePromise(() => ServerPeripheralDeviceAPI.partPlaybackStarted(deviceId, deviceToken, r))
	}
	partPlaybackStopped(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		r: PeripheralDeviceAPI.PartPlaybackStartedResult
	) {
		return makePromise(() => ServerPeripheralDeviceAPI.partPlaybackStopped(deviceId, deviceToken, r))
	}
	piecePlaybackStopped(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		r: PeripheralDeviceAPI.PiecePlaybackStartedResult
	) {
		return makePromise(() => ServerPeripheralDeviceAPI.piecePlaybackStopped(deviceId, deviceToken, r))
	}
	piecePlaybackStarted(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		r: PeripheralDeviceAPI.PiecePlaybackStartedResult
	) {
		return makePromise(() => ServerPeripheralDeviceAPI.piecePlaybackStarted(deviceId, deviceToken, r))
	}
	pingWithCommand(deviceId: PeripheralDeviceId, deviceToken: string, message: string, cb?: Function) {
		return makePromise(() => ServerPeripheralDeviceAPI.pingWithCommand(deviceId, deviceToken, message, cb))
	}
	killProcess(deviceId: PeripheralDeviceId, deviceToken: string, really: boolean) {
		return makePromise(() => ServerPeripheralDeviceAPI.killProcess(deviceId, deviceToken, really))
	}
	testMethod(deviceId: PeripheralDeviceId, deviceToken: string, returnValue: string, throwError?: boolean) {
		return makePromise(() => ServerPeripheralDeviceAPI.testMethod(deviceId, deviceToken, returnValue, throwError))
	}
	timelineTriggerTime(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		r: PeripheralDeviceAPI.TimelineTriggerTimeResult
	) {
		return makePromise(() => ServerPeripheralDeviceAPI.timelineTriggerTime(deviceId, deviceToken, r))
	}
	removePeripheralDevice(deviceId: PeripheralDeviceId) {
		return makePromise(() => ServerPeripheralDeviceAPI.removePeripheralDevice(deviceId))
	}
	functionReply(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		commandId: PeripheralDeviceCommandId,
		err: any,
		result: any
	) {
		return makePromise(() => functionReply(deviceId, deviceToken, commandId, err, result))
	}

	// ------ Spreadsheet Gateway --------
	requestUserAuthToken(deviceId: PeripheralDeviceId, deviceToken: string, authUrl: string) {
		return makePromise(() => ServerPeripheralDeviceAPI.requestUserAuthToken(deviceId, deviceToken, authUrl))
	}
	storeAccessToken(deviceId: PeripheralDeviceId, deviceToken: string, authToken: any) {
		return makePromise(() => ServerPeripheralDeviceAPI.storeAccessToken(deviceId, deviceToken, authToken))
	}

	// ------ Ingest methods: ------------
	dataRundownList(deviceId: PeripheralDeviceId, deviceToken: string) {
		return makePromise(() => RundownInput.dataRundownList(this, deviceId, deviceToken))
	}
	dataRundownGet(deviceId: PeripheralDeviceId, deviceToken: string, rundownExternalId: string) {
		return makePromise(() => RundownInput.dataRundownGet(this, deviceId, deviceToken, rundownExternalId))
	}
	dataRundownDelete(deviceId: PeripheralDeviceId, deviceToken: string, rundownExternalId: string) {
		return makePromise(() => RundownInput.dataRundownDelete(this, deviceId, deviceToken, rundownExternalId))
	}
	dataRundownCreate(deviceId: PeripheralDeviceId, deviceToken: string, ingestRundown: IngestRundown) {
		return makePromise(() => RundownInput.dataRundownCreate(this, deviceId, deviceToken, ingestRundown))
	}
	dataRundownUpdate(deviceId: PeripheralDeviceId, deviceToken: string, ingestRundown: IngestRundown) {
		return makePromise(() => RundownInput.dataRundownUpdate(this, deviceId, deviceToken, ingestRundown))
	}
	dataSegmentDelete(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		rundownExternalId: string,
		segmentExternalId: string
	) {
		return makePromise(() =>
			RundownInput.dataSegmentDelete(this, deviceId, deviceToken, rundownExternalId, segmentExternalId)
		)
	}
	dataSegmentCreate(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		rundownExternalId: string,
		ingestSegment: IngestSegment
	) {
		return makePromise(() =>
			RundownInput.dataSegmentCreate(this, deviceId, deviceToken, rundownExternalId, ingestSegment)
		)
	}
	dataSegmentUpdate(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		rundownExternalId: string,
		ingestSegment: IngestSegment
	) {
		return makePromise(() =>
			RundownInput.dataSegmentUpdate(this, deviceId, deviceToken, rundownExternalId, ingestSegment)
		)
	}
	dataPartDelete(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		rundownExternalId: string,
		segmentExternalId: string,
		partExternalId: string
	) {
		return makePromise(() =>
			RundownInput.dataPartDelete(
				this,
				deviceId,
				deviceToken,
				rundownExternalId,
				segmentExternalId,
				partExternalId
			)
		)
	}
	dataPartCreate(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		rundownExternalId: string,
		segmentExternalId: string,
		ingestPart: IngestPart
	) {
		return makePromise(() =>
			RundownInput.dataPartCreate(this, deviceId, deviceToken, rundownExternalId, segmentExternalId, ingestPart)
		)
	}
	dataPartUpdate(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		rundownExternalId: string,
		segmentExternalId: string,
		ingestPart: IngestPart
	) {
		return makePromise(() =>
			RundownInput.dataPartUpdate(this, deviceId, deviceToken, rundownExternalId, segmentExternalId, ingestPart)
		)
	}

	// ------ MOS methods: --------
	mosRoCreate(deviceId: PeripheralDeviceId, deviceToken: string, mosRunningOrder: MOS.IMOSRunningOrder) {
		return makePromise(() => MosIntegration.mosRoCreate(deviceId, deviceToken, mosRunningOrder))
	}
	mosRoReplace(deviceId: PeripheralDeviceId, deviceToken: string, mosRunningOrder: MOS.IMOSRunningOrder) {
		return makePromise(() => MosIntegration.mosRoReplace(deviceId, deviceToken, mosRunningOrder))
	}
	mosRoDelete(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		mosRunningOrderId: MOS.MosString128,
		force?: boolean
	) {
		return makePromise(() => MosIntegration.mosRoDelete(deviceId, deviceToken, mosRunningOrderId, force))
	}
	mosRoMetadata(deviceId: PeripheralDeviceId, deviceToken: string, metadata: MOS.IMOSRunningOrderBase) {
		return makePromise(() => MosIntegration.mosRoMetadata(deviceId, deviceToken, metadata))
	}
	mosRoStatus(deviceId: PeripheralDeviceId, deviceToken: string, status: MOS.IMOSRunningOrderStatus) {
		return makePromise(() => MosIntegration.mosRoStatus(deviceId, deviceToken, status))
	}
	mosRoStoryStatus(deviceId: PeripheralDeviceId, deviceToken: string, status: MOS.IMOSStoryStatus) {
		return makePromise(() => MosIntegration.mosRoStoryStatus(deviceId, deviceToken, status))
	}
	mosRoItemStatus(deviceId: PeripheralDeviceId, deviceToken: string, status: MOS.IMOSItemStatus) {
		return makePromise(() => MosIntegration.mosRoItemStatus(deviceId, deviceToken, status))
	}
	mosRoStoryInsert(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		Action: MOS.IMOSStoryAction,
		Stories: Array<MOS.IMOSROStory>
	) {
		return makePromise(() => MosIntegration.mosRoStoryInsert(deviceId, deviceToken, Action, Stories))
	}
	mosRoItemInsert(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		Action: MOS.IMOSItemAction,
		Items: Array<MOS.IMOSItem>
	) {
		return makePromise(() => MosIntegration.mosRoItemInsert(deviceId, deviceToken, Action, Items))
	}
	mosRoStoryReplace(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		Action: MOS.IMOSStoryAction,
		Stories: Array<MOS.IMOSROStory>
	) {
		return makePromise(() => MosIntegration.mosRoStoryReplace(deviceId, deviceToken, Action, Stories))
	}
	mosRoItemReplace(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		Action: MOS.IMOSItemAction,
		Items: Array<MOS.IMOSItem>
	) {
		return makePromise(() => MosIntegration.mosRoItemReplace(deviceId, deviceToken, Action, Items))
	}
	mosRoStoryMove(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		Action: MOS.IMOSStoryAction,
		Stories: Array<MOS.MosString128>
	) {
		return makePromise(() => MosIntegration.mosRoStoryMove(deviceId, deviceToken, Action, Stories))
	}
	mosRoItemMove(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		Action: MOS.IMOSItemAction,
		Items: Array<MOS.MosString128>
	) {
		return makePromise(() => MosIntegration.mosRoItemMove(deviceId, deviceToken, Action, Items))
	}
	mosRoStoryDelete(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		Action: MOS.IMOSROAction,
		Stories: Array<MOS.MosString128>
	) {
		return makePromise(() => MosIntegration.mosRoStoryDelete(deviceId, deviceToken, Action, Stories))
	}
	mosRoItemDelete(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		Action: MOS.IMOSStoryAction,
		Items: Array<MOS.MosString128>
	) {
		return makePromise(() => MosIntegration.mosRoItemDelete(deviceId, deviceToken, Action, Items))
	}
	mosRoStorySwap(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		Action: MOS.IMOSROAction,
		StoryID0: MOS.MosString128,
		StoryID1: MOS.MosString128
	) {
		return makePromise(() => MosIntegration.mosRoStorySwap(deviceId, deviceToken, Action, StoryID0, StoryID1))
	}
	mosRoItemSwap(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		Action: MOS.IMOSStoryAction,
		ItemID0: MOS.MosString128,
		ItemID1: MOS.MosString128
	) {
		return makePromise(() => MosIntegration.mosRoItemSwap(deviceId, deviceToken, Action, ItemID0, ItemID1))
	}
	mosRoReadyToAir(deviceId: PeripheralDeviceId, deviceToken: string, Action: MOS.IMOSROReadyToAir) {
		return makePromise(() => MosIntegration.mosRoReadyToAir(deviceId, deviceToken, Action))
	}
	mosRoFullStory(deviceId: PeripheralDeviceId, deviceToken: string, story: MOS.IMOSROFullStory) {
		return makePromise(() => MosIntegration.mosRoFullStory(deviceId, deviceToken, story))
	}
	// ------- Media Manager (Media Scanner)
	getMediaObjectRevisions(deviceId: PeripheralDeviceId, deviceToken: string, collectionId: string) {
		return makePromise(() => MediaScannerIntegration.getMediaObjectRevisions(deviceId, deviceToken, collectionId))
	}
	updateMediaObject(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		collectionId: string,
		id: string,
		doc: MediaObject | null
	) {
		return makePromise(() =>
			MediaScannerIntegration.updateMediaObject(deviceId, deviceToken, collectionId, id, doc)
		)
	}
	// ------- Media Manager --------------
	getMediaWorkFlowRevisions(deviceId: PeripheralDeviceId, deviceToken: string) {
		return makePromise(() => MediaManagerIntegration.getMediaWorkFlowRevisions(deviceId, deviceToken))
	}
	getMediaWorkFlowStepRevisions(deviceId: PeripheralDeviceId, deviceToken: string) {
		return makePromise(() => MediaManagerIntegration.getMediaWorkFlowStepRevisions(deviceId, deviceToken))
	}
	updateMediaWorkFlow(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		workFlowId: MediaWorkFlowId,
		obj: MediaWorkFlow | null
	) {
		return makePromise(() => MediaManagerIntegration.updateMediaWorkFlow(deviceId, deviceToken, workFlowId, obj))
	}
	updateMediaWorkFlowStep(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		docId: MediaWorkFlowStepId,
		obj: MediaWorkFlowStep | null
	) {
		return makePromise(() => MediaManagerIntegration.updateMediaWorkFlowStep(deviceId, deviceToken, docId, obj))
	}
}
registerClassToMeteorMethods(PeripheralDeviceAPIMethods, ServerPeripheralDeviceAPIClass, false)
