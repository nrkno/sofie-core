import { Meteor } from 'meteor/meteor'
import { check, Match } from 'meteor/check'
import * as _ from 'underscore'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import { PeripheralDevices } from '../../lib/collections/PeripheralDevices'
import { Rundowns } from '../../lib/collections/Rundowns'
import { getCurrentTime } from '../../lib/lib'
import { PeripheralDeviceSecurity } from '../security/peripheralDevices'
import { PeripheralDeviceCommands } from '../../lib/collections/PeripheralDeviceCommands'
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

// import {ServerPeripheralDeviceAPIMOS as MOS} from './peripheralDeviceMos'
export namespace ServerPeripheralDeviceAPI {
	export function initialize (id: string, token: string, options: PeripheralDeviceAPI.InitOptions): string {
		check(id, String)
		check(token, String)
		check(options, Object)
		check(options.name, String)
		check(options.category, String)
		check(options.type, String)
		check(options.subType, Match.OneOf(Number, String))
		check(options.parentDeviceId, Match.Optional(String))
		check(options.versions, Match.Optional(Object))

		logger.debug('Initialize device ' + id, options)

		let peripheralDevice
		try {
			peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)

			PeripheralDevices.update(id, {
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
					_id: id,
					created: getCurrentTime(),
					status: {
						statusCode: PeripheralDeviceAPI.StatusCode.UNKNOWN
					},
					studioId: '',
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
		return id
	}
	export function unInitialize (id: string, token: string): string {

		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		if (!peripheralDevice) throw new Meteor.Error(404,"peripheralDevice '" + id + "' not found!")

		// TODO: Add an authorization for this?

		PeripheralDevices.remove(id)
		return id
	}
	export function setStatus (id: string, token: string, status: PeripheralDeviceAPI.StatusObject): PeripheralDeviceAPI.StatusObject {
		check(id, String)
		check(token, String)
		check(status, Object)
		check(status.statusCode, Number)
		if (status.statusCode < PeripheralDeviceAPI.StatusCode.UNKNOWN ||
			status.statusCode > PeripheralDeviceAPI.StatusCode.FATAL) {
			throw new Meteor.Error(400, 'device status code is not known')
		}

		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		if (!peripheralDevice) throw new Meteor.Error(404,"peripheralDevice '" + id + "' not found!")

		// check if we have to update something:
		if (!_.isEqual(status, peripheralDevice.status)) {

			logger.info(`Changed status of device ${peripheralDevice._id} "${peripheralDevice.name}" to ${status.statusCode}`)
			// perform the update:
			PeripheralDevices.update(id, {$set: {
				status: status
			}})
		}
		return status
	}
	export function ping (id: string, token: string): void {
		check(id, String)
		check(token, String)

		// logger.debug('device ping', id)

		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		if (!peripheralDevice) throw new Meteor.Error(404,"peripheralDevice '" + id + "' not found!")

		// Update lastSeen
		PeripheralDevices.update(id, {$set: {
			lastSeen: getCurrentTime()
		}})
	}
	export function getPeripheralDevice (id: string, token: string) {
		return PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
	}
	export const timelineTriggerTime = syncFunction(function timelineTriggerTime (id: string, token: string, results: PeripheralDeviceAPI.TimelineTriggerTimeResult) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		if (!peripheralDevice) throw new Meteor.Error(404, `peripheralDevice "${id}" not found!`)
		if (!peripheralDevice.studioId) throw new Meteor.Error(401, `peripheralDevice "${id}" not attached to a studio`)

		const studioId = peripheralDevice.studioId

		// check(r.time, Number)
		check(results, Array)
		_.each(results, (o) => {
			check(o.id, String)
			check(o.time, Number)
		})

		_.each(results, (o) => {
			check(o.id, String)

			// check(o.time, Number)
			logger.info('Timeline: Setting time: "' + o.id + '": ' + o.time)

			const id = getTimelineId(studioId, o.id)
			const obj = Timeline.findOne(id)
			if (obj) {
				Timeline.update({
					_id: id
				}, {$set: {
					'enable.start': o.time,
					'enable.setFromNow': true
				}})

				obj.enable.start = o.time
				obj.enable.setFromNow = true

				ServerPlayoutAPI.timelineTriggerTimeUpdateCallback(obj.studioId, obj, o.time)
			}
		})

		// After we've updated the timeline, we must call afterUpdateTimeline!
		const studio = Studios.findOne(studioId)
		if (studio) {
			afterUpdateTimeline(studio)
		}
	}, 'timelineTriggerTime$0,$1')
	export function partPlaybackStarted (id: string, token: string, r: PeripheralDeviceAPI.PartPlaybackStartedResult) {
		// This is called from the playout-gateway when a part starts playing.
		// Note that this function can / might be called several times from playout-gateway for the same part
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		if (!peripheralDevice) throw new Meteor.Error(404, "peripheralDevice '" + id + "' not found!")

		check(r.time, Number)
		check(r.rundownId, String)
		check(r.partId, String)

		// Meteor.call('playout_partPlaybackStart', r.rundownId, r.partId, r.time)
		ServerPlayoutAPI.onPartPlaybackStarted(r.rundownId, r.partId, r.time)
	}
	export function partPlaybackStopped (id: string, token: string, r: PeripheralDeviceAPI.PartPlaybackStoppedResult) {
		// This is called from the playout-gateway when an
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		if (!peripheralDevice) throw new Meteor.Error(404, "peripheralDevice '" + id + "' not found!")

		check(r.time, Number)
		check(r.rundownId, String)
		check(r.partId, String)

		ServerPlayoutAPI.onPartPlaybackStopped(r.rundownId, r.partId, r.time)
	}
	export function piecePlaybackStarted (id: string, token: string, r: PeripheralDeviceAPI.PiecePlaybackStartedResult) {
		// This is called from the playout-gateway when an auto-next event occurs
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		if (!peripheralDevice) throw new Meteor.Error(404, "peripheralDevice '" + id + "' not found!")

		check(r.time, Number)
		check(r.rundownId, String)
		check(r.pieceId, String)

		// Meteor.call('playout_piecePlaybackStart', r.rundownId, r.pieceId, r.time)
		ServerPlayoutAPI.onPiecePlaybackStarted(r.rundownId, r.pieceId, r.time)
	}
	export function piecePlaybackStopped (id: string, token: string, r: PeripheralDeviceAPI.PiecePlaybackStartedResult) {
		// This is called from the playout-gateway when an auto-next event occurs
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		if (!peripheralDevice) throw new Meteor.Error(404, "peripheralDevice '" + id + "' not found!")

		check(r.time, Number)
		check(r.rundownId, String)
		check(r.pieceId, String)

		// Meteor.call('playout_piecePlaybackStart', r.rundownId, r.pieceId, r.time)
		ServerPlayoutAPI.onPiecePlaybackStopped(r.rundownId, r.pieceId, r.time)
	}
	export function pingWithCommand (id: string, token: string, message: string, cb?: Function) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		if (!peripheralDevice) throw new Meteor.Error(404, "peripheralDevice '" + id + "' not found!")

		PeripheralDeviceAPI.executeFunction(peripheralDevice._id, (err, res) => {
			if (err) {
				logger.warn(err)
			}

			if (cb) cb(err, res)
		}, 'pingResponse', message)

		ping(id, token)
	}
	export function killProcess (id: string, token: string, really: boolean) {
		// This is used in integration tests only
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		if (!peripheralDevice) throw new Meteor.Error(404, "peripheralDevice '" + id + "' not found!")

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
	export function testMethod (id: string, token: string, returnValue: string, throwError?: boolean): string {
		// used for integration tests with core-connection
		check(id, String)
		check(token, String)
		check(returnValue, String)

		// logger.debug('device ping', id)

		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		if (!peripheralDevice) throw new Meteor.Error(404,"peripheralDevice '" + id + "' not found!")

		if (throwError) {
			throw new Meteor.Error(418, 'Error thrown, as requested')
		} else {
			return returnValue
		}
	}
	export const executeFunction: (deviceId: string, functionName: string, ...args: any[]) => any = Meteor.wrapAsync((deviceId: string, functionName: string, ...args: any[]) => {
		let args0 = args.slice(0, -1)
		let cb = args.slice(-1)[0] // the last argument in ...args
		PeripheralDeviceAPI.executeFunction(deviceId, cb, functionName, ...args0)
	})

	export function requestUserAuthToken (id: string, token: string, authUrl: string) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		if (!peripheralDevice) throw new Meteor.Error(404,"peripheralDevice '" + id + "' not found!")
		if (peripheralDevice.type !== PeripheralDeviceAPI.DeviceType.SPREADSHEET) {
			throw new Meteor.Error(400, 'can only request user auth token for peripheral device of spreadsheet type')
		}
		check(authUrl, String)

		PeripheralDevices.update(peripheralDevice._id, {$set: {
			accessTokenUrl: authUrl
		}})
	}
	export function storeAccessToken (id: string, token: string, accessToken: any) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		if (!peripheralDevice) throw new Meteor.Error(404,"peripheralDevice '" + id + "' not found!")
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

	let deviceId = decodeURIComponent(params.deviceId)

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
methods[PeripheralDeviceAPI.methods.initialize] = (deviceId: string, deviceToken: string, options: PeripheralDeviceAPI.InitOptions) => {
	return ServerPeripheralDeviceAPI.initialize(deviceId, deviceToken, options)
}
methods[PeripheralDeviceAPI.methods.unInitialize] = (deviceId: string, deviceToken: string) => {
	return ServerPeripheralDeviceAPI.unInitialize(deviceId, deviceToken)
}
methods[PeripheralDeviceAPI.methods.setStatus] = (deviceId: string, deviceToken: string, status: PeripheralDeviceAPI.StatusObject) => {
	return ServerPeripheralDeviceAPI.setStatus(deviceId, deviceToken, status)
}
methods[PeripheralDeviceAPI.methods.ping] = (deviceId: string, deviceToken: string) => {
	return ServerPeripheralDeviceAPI.ping(deviceId, deviceToken)
}
methods[PeripheralDeviceAPI.methods.getPeripheralDevice ] = (deviceId: string, deviceToken: string) => {
	return ServerPeripheralDeviceAPI.getPeripheralDevice(deviceId, deviceToken)
}
methods[PeripheralDeviceAPI.methods.partPlaybackStarted] = (deviceId: string, deviceToken: string, r: PeripheralDeviceAPI.PartPlaybackStartedResult) => {
	return ServerPeripheralDeviceAPI.partPlaybackStarted(deviceId, deviceToken, r)
}
methods[PeripheralDeviceAPI.methods.partPlaybackStopped] = (deviceId: string, deviceToken: string, r: PeripheralDeviceAPI.PartPlaybackStartedResult) => {
	return ServerPeripheralDeviceAPI.partPlaybackStopped(deviceId, deviceToken, r)
}
methods[PeripheralDeviceAPI.methods.piecePlaybackStopped] = (deviceId: string, deviceToken: string, r: PeripheralDeviceAPI.PiecePlaybackStartedResult) => {
	return ServerPeripheralDeviceAPI.piecePlaybackStopped(deviceId, deviceToken, r)
}
methods[PeripheralDeviceAPI.methods.piecePlaybackStarted] = (deviceId: string, deviceToken: string, r: PeripheralDeviceAPI.PiecePlaybackStartedResult) => {
	return ServerPeripheralDeviceAPI.piecePlaybackStarted(deviceId, deviceToken, r)
}
methods[PeripheralDeviceAPI.methods.pingWithCommand] = (deviceId: string, deviceToken: string, message: string, cb?: Function) => {
	return ServerPeripheralDeviceAPI.pingWithCommand(deviceId, deviceToken, message, cb)
}
methods[PeripheralDeviceAPI.methods.killProcess] = (deviceId: string, deviceToken: string, really: boolean) => {
	return ServerPeripheralDeviceAPI.killProcess(deviceId, deviceToken, really)
}
methods[PeripheralDeviceAPI.methods.testMethod] = (deviceId: string, deviceToken: string, returnValue: string, throwError?: boolean) => {
	return ServerPeripheralDeviceAPI.testMethod(deviceId, deviceToken, returnValue, throwError)
}
methods[PeripheralDeviceAPI.methods.timelineTriggerTime] = (deviceId: string, deviceToken: string, r: PeripheralDeviceAPI.TimelineTriggerTimeResult) => {
	return ServerPeripheralDeviceAPI.timelineTriggerTime(deviceId, deviceToken, r)
}

methods[PeripheralDeviceAPI.methods.requestUserAuthToken] = (deviceId: string, deviceToken: string, authUrl: string) => {
	return ServerPeripheralDeviceAPI.requestUserAuthToken(deviceId, deviceToken, authUrl)
}
methods[PeripheralDeviceAPI.methods.storeAccessToken] = (deviceId: string, deviceToken: string, authToken: any) => {
	return ServerPeripheralDeviceAPI.storeAccessToken(deviceId, deviceToken, authToken)
}

// --------------------
methods[PeripheralDeviceAPI.methods.functionReply] = (deviceId: string, deviceToken: string, commandId: string, err: any, result: any) => {
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
	'temporaryRemovePeripheralDevice' (id: string) {
		// TODO: Replace this function with an authorized one
		PeripheralDevices.remove(id)
		PeripheralDevices.remove({
			parentDeviceId: id
		})
		return id
	}
})
