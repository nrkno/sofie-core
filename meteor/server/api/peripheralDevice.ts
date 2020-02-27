import { Meteor } from 'meteor/meteor'
import { check, Match } from 'meteor/check'
import * as _ from 'underscore'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import { PeripheralDevices, PeripheralDeviceId } from '../../lib/collections/PeripheralDevices'
import { Rundowns } from '../../lib/collections/Rundowns'
import { getCurrentTime, protectString } from '../../lib/lib'
import { PeripheralDeviceSecurity } from '../security/peripheralDevices'
import { PeripheralDeviceCommands, PeripheralDeviceCommandId } from '../../lib/collections/PeripheralDeviceCommands'
import { logger } from '../logging'
import { Timeline, getTimelineId } from '../../lib/collections/Timeline'
import { Studios } from '../../lib/collections/Studios'
import { ServerPlayoutAPI } from './playout/playout'
import { setMeteorMethods, Methods } from '../methods'
import { Picker } from 'meteor/meteorhacks:picker'
import { IncomingMessage, ServerResponse } from 'http'
import * as bodyParser from 'body-parser'
import { parse as parseUrl } from 'url'
import { syncFunction } from '../codeControl'
import { afterUpdateTimeline } from './playout/timeline'
import { areThereActiveRundownPlaylistsInStudio } from './playout/studio'

// import {ServerPeripheralDeviceAPIMOS as MOS} from './peripheralDeviceMos'
export namespace ServerPeripheralDeviceAPI {
	export function initialize (deviceId: PeripheralDeviceId, token: string, options: PeripheralDeviceAPI.InitOptions): PeripheralDeviceId {
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

					configManifest: options.configManifest
				}
			})
		} catch (e) {
			if ((e as Meteor.Error).error === 404) {
				PeripheralDevices.insert({
					_id: deviceId,
					created: getCurrentTime(),
					status: {
						statusCode: PeripheralDeviceAPI.StatusCode.UNKNOWN
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

					configManifest: options.configManifest
				})
			} else {
				throw e
			}
		}
		return deviceId
	}
	export function unInitialize (deviceId: PeripheralDeviceId, token: string): PeripheralDeviceId {

		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, token, this)
		if (!peripheralDevice) throw new Meteor.Error(404,"peripheralDevice '" + deviceId + "' not found!")

		// TODO: Add an authorization for this?

		PeripheralDevices.remove(deviceId)
		return deviceId
	}
	export function setStatus (deviceId: PeripheralDeviceId, token: string, status: PeripheralDeviceAPI.StatusObject): PeripheralDeviceAPI.StatusObject {
		check(deviceId, String)
		check(token, String)
		check(status, Object)
		check(status.statusCode, Number)
		if (status.statusCode < PeripheralDeviceAPI.StatusCode.UNKNOWN ||
			status.statusCode > PeripheralDeviceAPI.StatusCode.FATAL) {
			throw new Meteor.Error(400, 'device status code is not known')
		}

		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, token, this)
		if (!peripheralDevice) throw new Meteor.Error(404,"peripheralDevice '" + deviceId + "' not found!")

		// check if we have to update something:
		if (!_.isEqual(status, peripheralDevice.status)) {

			logger.info(`Changed status of device ${peripheralDevice._id} "${peripheralDevice.name}" to ${status.statusCode}`)
			// perform the update:
			PeripheralDevices.update(deviceId, {$set: {
				status: status
			}})
		}
		return status
	}
	export function ping (deviceId: PeripheralDeviceId, token: string): void {
		check(deviceId, String)
		check(token, String)

		// logger.debug('device ping', id)

		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, token, this)
		if (!peripheralDevice) throw new Meteor.Error(404,"peripheralDevice '" + deviceId + "' not found!")

		// Update lastSeen
		PeripheralDevices.update(deviceId, {$set: {
			lastSeen: getCurrentTime()
		}})
	}
	export function getPeripheralDevice (deviceId: PeripheralDeviceId, token: string) {
		return PeripheralDeviceSecurity.getPeripheralDevice(deviceId, token, this)
	}
	export const timelineTriggerTime = syncFunction(function timelineTriggerTime (deviceId: PeripheralDeviceId, token: string, results: PeripheralDeviceAPI.TimelineTriggerTimeResult) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, token, this)
		if (!peripheralDevice) throw new Meteor.Error(404, `peripheralDevice "${deviceId}" not found!`)
		if (!peripheralDevice.studioId) throw new Meteor.Error(401, `peripheralDevice "${deviceId}" not attached to a studio`)

		const studioId = peripheralDevice.studioId

		// check(r.time, Number)
		check(results, Array)
		_.each(results, (o) => {
			check(o.id, String)
			check(o.time, Number)
		})

		if (results.length > 0) {
			const playlistIds = _.map(areThereActiveRundownPlaylistsInStudio(studioId), r => r._id)
			const allowedRundowns = Rundowns.find({ playlistId: { $in: playlistIds } }).fetch()
			const allowedRundownsIds = _.map(allowedRundowns, r => r._id)

			_.each(results, (o) => {
				check(o.id, String)

				// check(o.time, Number)
				logger.info('Timeline: Setting time: "' + o.id + '": ' + o.time)

				const id = getTimelineId(studioId, o.id)
				const obj = Timeline.findOne({
					_id: id,
					studioId: studioId
				})
				if (obj) {
					Timeline.update({
						_id: id,
						studioId: studioId
					}, {$set: {
						'enable.start': o.time,
						'enable.setFromNow': true
					}})

					obj.enable.start = o.time
					obj.enable.setFromNow = true

					ServerPlayoutAPI.timelineTriggerTimeUpdateCallback(allowedRundownsIds, obj, o.time)
				}
			})
		}

		// After we've updated the timeline, we must call afterUpdateTimeline!
		const studio = Studios.findOne(studioId)
		if (studio) {
			afterUpdateTimeline(studio)
		}
	}, 'timelineTriggerTime$0,$1')
	export function partPlaybackStarted (deviceId: PeripheralDeviceId, token: string, r: PeripheralDeviceAPI.PartPlaybackStartedResult) {
		// This is called from the playout-gateway when a part starts playing.
		// Note that this function can / might be called several times from playout-gateway for the same part
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, token, this)
		if (!peripheralDevice) throw new Meteor.Error(404, "peripheralDevice '" + deviceId + "' not found!")

		check(r.time, Number)
		check(r.rundownId, String)
		check(r.partInstanceId, String)

		// Meteor.call('playout_partPlaybackStart', r.rundownId, r.partId, r.time)
		ServerPlayoutAPI.onPartPlaybackStarted(r.rundownId, r.partInstanceId, r.time)
	}
	export function partPlaybackStopped (deviceId: PeripheralDeviceId, token: string, r: PeripheralDeviceAPI.PartPlaybackStoppedResult) {
		// This is called from the playout-gateway when an
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, token, this)
		if (!peripheralDevice) throw new Meteor.Error(404, "peripheralDevice '" + deviceId + "' not found!")

		check(r.time, Number)
		check(r.rundownId, String)
		check(r.partInstanceId, String)

		ServerPlayoutAPI.onPartPlaybackStopped(r.rundownId, r.partInstanceId, r.time)
	}
	export function piecePlaybackStarted (deviceId: PeripheralDeviceId, token: string, r: PeripheralDeviceAPI.PiecePlaybackStartedResult) {
		// This is called from the playout-gateway when an auto-next event occurs
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, token, this)
		if (!peripheralDevice) throw new Meteor.Error(404, "peripheralDevice '" + deviceId + "' not found!")

		check(r.time, Number)
		check(r.rundownId, String)
		check(r.pieceInstanceId, String)

		// Meteor.call('playout_piecePlaybackStart', r.rundownId, r.pieceId, r.time)
		ServerPlayoutAPI.onPiecePlaybackStarted(r.rundownId, r.pieceInstanceId, r.time)
	}
	export function piecePlaybackStopped (deviceId: PeripheralDeviceId, token: string, r: PeripheralDeviceAPI.PiecePlaybackStartedResult) {
		// This is called from the playout-gateway when an auto-next event occurs
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, token, this)
		if (!peripheralDevice) throw new Meteor.Error(404, "peripheralDevice '" + deviceId + "' not found!")

		check(r.time, Number)
		check(r.rundownId, String)
		check(r.pieceInstanceId, String)

		// Meteor.call('playout_piecePlaybackStart', r.rundownId, r.pieceId, r.time)
		ServerPlayoutAPI.onPiecePlaybackStopped(r.rundownId, r.pieceInstanceId, r.time)
	}
	export function pingWithCommand (deviceId: PeripheralDeviceId, token: string, message: string, cb?: Function) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, token, this)
		if (!peripheralDevice) throw new Meteor.Error(404, "peripheralDevice '" + deviceId + "' not found!")

		PeripheralDeviceAPI.executeFunction(peripheralDevice._id, (err, res) => {
			if (err) {
				logger.warn(err)
			}

			if (cb) cb(err, res)
		}, 'pingResponse', message)

		ping(deviceId, token)
	}
	export function killProcess (deviceId: PeripheralDeviceId, token: string, really: boolean) {
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
	export function testMethod (deviceId: PeripheralDeviceId, token: string, returnValue: string, throwError?: boolean): string {
		// used for integration tests with core-connection
		check(deviceId, String)
		check(token, String)
		check(returnValue, String)

		// logger.debug('device ping', id)

		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, token, this)
		if (!peripheralDevice) throw new Meteor.Error(404,"peripheralDevice '" + deviceId + "' not found!")

		if (throwError) {
			throw new Meteor.Error(418, 'Error thrown, as requested')
		} else {
			return returnValue
		}
	}
	export const executeFunction: (deviceId: PeripheralDeviceId, functionName: string, ...args: any[]) => any = Meteor.wrapAsync((deviceId: PeripheralDeviceId, functionName: string, ...args: any[]) => {
		let args0 = args.slice(0, -1)
		let cb = args.slice(-1)[0] // the last argument in ...args
		PeripheralDeviceAPI.executeFunction(deviceId, cb, functionName, ...args0)
	})

	export function requestUserAuthToken (deviceId: PeripheralDeviceId, token: string, authUrl: string) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, token, this)
		if (!peripheralDevice) throw new Meteor.Error(404,"peripheralDevice '" + deviceId + "' not found!")
		if (peripheralDevice.type !== PeripheralDeviceAPI.DeviceType.SPREADSHEET) {
			throw new Meteor.Error(400, 'can only request user auth token for peripheral device of spreadsheet type')
		}
		check(authUrl, String)

		PeripheralDevices.update(peripheralDevice._id, {$set: {
			accessTokenUrl: authUrl
		}})
	}
	export function storeAccessToken (deviceId: PeripheralDeviceId, token: string, accessToken: any) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, token, this)
		if (!peripheralDevice) throw new Meteor.Error(404,"peripheralDevice '" + deviceId + "' not found!")
		if (peripheralDevice.type !== PeripheralDeviceAPI.DeviceType.SPREADSHEET) {
			throw new Meteor.Error(400, 'can only store access token for peripheral device of spreadsheet type')
		}

		PeripheralDevices.update(peripheralDevice._id, {$set: {
			accessTokenUrl: '',
			'secretSettings.accessToken': accessToken,
			'settings.secretAccessToken' : true
		}})
	}
}

const postRoute = Picker.filter((req, res) => req.method === 'POST')
postRoute.middleware(bodyParser.text({
	type: 'text/javascript',
	limit: '1mb'
}))
postRoute.route('/devices/:deviceId/uploadCredentials', (params, req: IncomingMessage, res: ServerResponse, next) => {
	res.setHeader('Content-Type', 'text/plain')

	let deviceId: PeripheralDeviceId = protectString(decodeURIComponent(params.deviceId))

	let url = parseUrl(req.url || '', true)

	let fileNames = url.query['name'] || undefined
	let fileName: string = (
		_.isArray(fileNames) ?
		fileNames[0] :
		fileNames
	) || ''

	check(deviceId, String)
	check(fileName, String)

	// console.log('Upload of file', fileName, deviceId)

	let content = ''
	try {
		const peripheralDevice = PeripheralDevices.findOne(deviceId) // TODO: a better security model is needed here. Token is a no-go, but something else to verify the user?
		if (!peripheralDevice) throw new Meteor.Error(404, `PeripheralDevice ${deviceId} not found`)

		const body = (req as any).body
		if (!body) throw new Meteor.Error(400, 'Upload credentials: Missing request body')

		if (typeof body !== 'string' || body.length < 10) throw new Meteor.Error(400, 'Upload credentials: Invalid request body')

		logger.info('Upload credentails, ' + body.length + ' bytes')

		const credentials = JSON.parse(body)

		PeripheralDevices.update(peripheralDevice._id, {$set: {
			'secretSettings.credentials' : credentials,
			'settings.secretCredentials' : true
		}})

		res.statusCode = 200
	} catch (e) {
		res.statusCode = 500
		content = e + ''
		logger.error('Upload credentials failed: ' + e)
	}

	res.end(content)
})

let methods: Methods = {}
methods[PeripheralDeviceAPI.methods.initialize] = (deviceId: PeripheralDeviceId, deviceToken: string, options: PeripheralDeviceAPI.InitOptions) => {
	return ServerPeripheralDeviceAPI.initialize(deviceId, deviceToken, options)
}
methods[PeripheralDeviceAPI.methods.unInitialize] = (deviceId: PeripheralDeviceId, deviceToken: string) => {
	return ServerPeripheralDeviceAPI.unInitialize(deviceId, deviceToken)
}
methods[PeripheralDeviceAPI.methods.setStatus] = (deviceId: PeripheralDeviceId, deviceToken: string, status: PeripheralDeviceAPI.StatusObject) => {
	return ServerPeripheralDeviceAPI.setStatus(deviceId, deviceToken, status)
}
methods[PeripheralDeviceAPI.methods.ping] = (deviceId: PeripheralDeviceId, deviceToken: string) => {
	return ServerPeripheralDeviceAPI.ping(deviceId, deviceToken)
}
methods[PeripheralDeviceAPI.methods.getPeripheralDevice ] = (deviceId: PeripheralDeviceId, deviceToken: string) => {
	return ServerPeripheralDeviceAPI.getPeripheralDevice(deviceId, deviceToken)
}
methods[PeripheralDeviceAPI.methods.partPlaybackStarted] = (deviceId: PeripheralDeviceId, deviceToken: string, r: PeripheralDeviceAPI.PartPlaybackStartedResult) => {
	return ServerPeripheralDeviceAPI.partPlaybackStarted(deviceId, deviceToken, r)
}
methods[PeripheralDeviceAPI.methods.partPlaybackStopped] = (deviceId: PeripheralDeviceId, deviceToken: string, r: PeripheralDeviceAPI.PartPlaybackStartedResult) => {
	return ServerPeripheralDeviceAPI.partPlaybackStopped(deviceId, deviceToken, r)
}
methods[PeripheralDeviceAPI.methods.piecePlaybackStopped] = (deviceId: PeripheralDeviceId, deviceToken: string, r: PeripheralDeviceAPI.PiecePlaybackStartedResult) => {
	return ServerPeripheralDeviceAPI.piecePlaybackStopped(deviceId, deviceToken, r)
}
methods[PeripheralDeviceAPI.methods.piecePlaybackStarted] = (deviceId: PeripheralDeviceId, deviceToken: string, r: PeripheralDeviceAPI.PiecePlaybackStartedResult) => {
	return ServerPeripheralDeviceAPI.piecePlaybackStarted(deviceId, deviceToken, r)
}
methods[PeripheralDeviceAPI.methods.pingWithCommand] = (deviceId: PeripheralDeviceId, deviceToken: string, message: string, cb?: Function) => {
	return ServerPeripheralDeviceAPI.pingWithCommand(deviceId, deviceToken, message, cb)
}
methods[PeripheralDeviceAPI.methods.killProcess] = (deviceId: PeripheralDeviceId, deviceToken: string, really: boolean) => {
	return ServerPeripheralDeviceAPI.killProcess(deviceId, deviceToken, really)
}
methods[PeripheralDeviceAPI.methods.testMethod] = (deviceId: PeripheralDeviceId, deviceToken: string, returnValue: string, throwError?: boolean) => {
	return ServerPeripheralDeviceAPI.testMethod(deviceId, deviceToken, returnValue, throwError)
}
methods[PeripheralDeviceAPI.methods.timelineTriggerTime] = (deviceId: PeripheralDeviceId, deviceToken: string, r: PeripheralDeviceAPI.TimelineTriggerTimeResult) => {
	return ServerPeripheralDeviceAPI.timelineTriggerTime(deviceId, deviceToken, r)
}

methods[PeripheralDeviceAPI.methods.requestUserAuthToken] = (deviceId: PeripheralDeviceId, deviceToken: string, authUrl: string) => {
	return ServerPeripheralDeviceAPI.requestUserAuthToken(deviceId, deviceToken, authUrl)
}
methods[PeripheralDeviceAPI.methods.storeAccessToken] = (deviceId: PeripheralDeviceId, deviceToken: string, authToken: any) => {
	return ServerPeripheralDeviceAPI.storeAccessToken(deviceId, deviceToken, authToken)
}

// --------------------
methods[PeripheralDeviceAPI.methods.functionReply] = (deviceId: PeripheralDeviceId, deviceToken: string, commandId: PeripheralDeviceCommandId, err: any, result: any) => {
	// logger.debug('functionReply', err, result)
	PeripheralDeviceCommands.update(commandId, {
		$set: {
			hasReply: true,
			reply: result,
			replyError: err,
			replyTime: getCurrentTime()
		}
	})
}

// Apply methods:
setMeteorMethods(methods)

// temporary functions:
setMeteorMethods({
	'temporaryRemovePeripheralDevice' (deviceId: PeripheralDeviceId) {
		// TODO: Replace this function with an authorized one
		PeripheralDevices.remove(deviceId)
		PeripheralDevices.remove({
			parentDeviceId: deviceId
		})
		return deviceId
	}
})
