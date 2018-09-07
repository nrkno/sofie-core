import { Random } from 'meteor/random'
import * as _ from 'underscore'
import { ServerResponse, IncomingMessage } from 'http'
// @ts-ignore Meteor package not recognized by Typescript
import { Picker } from 'meteor/meteorhacks:picker'
import { PeripheralDevices, PeripheralDevice } from '../lib/collections/PeripheralDevices'
import { syncFunctionIgnore } from './codeControl'
import { StudioInstallations } from '../lib/collections/StudioInstallations'
import { getCurrentTime } from '../lib/lib'

// This data structure is to be used to determine the system-wide status of the Core instance

const instanceId = Random.id()

export enum StatusCode {

	UNKNOWN = 0, 		// Status unknown
	GOOD = 1, 			// All good and green
	WARNING_MINOR = 2,	// Everything is not OK, operation is not affected
	WARNING_MAJOR = 3, 	// Everything is not OK, operation might be affected
	BAD = 4, 			// Operation affected, possible to recover
	FATAL = 5			// Operation affected, not possible to recover without manual interference
}
export interface CheckObj {
	description: string,
	status: ExternalStatus,
	errors: Array<string>
}
export type ExternalStatus = 'OK' | 'FAIL' | 'WARNING' | 'UNDEFINED'
export interface StatusObject {
	studioId?: string,
	statusCode: StatusCode,
	messages?: Array<string>,
}
export interface StatusObjectFull extends StatusObject {
	checks: Array<CheckObj>
}
let systemStatuses: {[key: string]: StatusObject} = {}

export function getSystemStatus (studioId?: string): StatusObjectFull {
	let systemStatus = StatusCode.UNKNOWN
	let systemStatusMessages: Array<string> = []

	let statusFound = false

	let checks: Array<CheckObj> = []

	_.each(systemStatuses, (status: StatusObject, key: string) => {

		if (studioId && status.studioId && status.studioId !== studioId) return
		statusFound = true

		checks.push({
			description: key,
			status: status2ExternalStatus(status.statusCode),
			errors: status.messages || []
		})

		if (status.statusCode > systemStatus) {
			systemStatus = status.statusCode
			systemStatusMessages = []
			// systemStatusMessages = systemStatusMessages.concat(status.messages || [])
		}
		if (status.statusCode === systemStatus) {
			if (status.statusCode !== StatusCode.GOOD) {
				systemStatusMessages.push(key + ': Status: ' + StatusCode[status.statusCode])
			}

			_.each(status.messages || [], (message: string) => {
				if (message) {
					systemStatusMessages.push(key + ': ' + message)
				}
			})
		}
	})

	if (!statusFound) {
		systemStatus = StatusCode.UNKNOWN
		systemStatusMessages.push('No system statuses found')
	}

	let statusObj: StatusObjectFull = {
		statusCode: systemStatus,
		messages: systemStatusMessages,
		checks: checks
	}
	if (studioId) statusObj.studioId = studioId
	return statusObj
}

export function setSystemStatus (type: string, status: StatusObject) {
	systemStatuses[type] = status
}
export function removeSystemStatus (type: string) {
	delete systemStatuses[type]
}

function updatePeripheralDevicesStatus () {
	StudioInstallations.find().forEach(studio => {
		PeripheralDevices.find({studioInstallationId: studio._id}).forEach(device => {
			updatePeripheralDeviceStatus(device)
		})
	})
}
function updatePeripheralDeviceStatus (deviceIdOrDevice: string | PeripheralDevice) {
	let device: PeripheralDevice | undefined
	let deviceId: string
	if (_.isString(deviceIdOrDevice)) {
		device = PeripheralDevices.findOne(deviceIdOrDevice)
		deviceId = deviceIdOrDevice
	} else {
		device = deviceIdOrDevice
		deviceId = device._id
	}
	let id = 'device_' + deviceId

	if (device && device.studioInstallationId) {

		if (!device.connected) {
			setSystemStatus(id, {
				studioId: device.studioInstallationId,
				statusCode: StatusCode.BAD,
				messages: ['Disconnected'].concat(device.status.messages || [])
			})
		} else {
			setSystemStatus(id, {
				studioId: device.studioInstallationId,
				statusCode: device.status.statusCode,
				messages: device.status.messages
			})
		}
	} else {
		removeSystemStatus(id)
	}
}
Meteor.startup(() => {
	Meteor.setTimeout(() => {

		PeripheralDevices.find().observe({
			added (doc: any) {
				updatePeripheralDeviceStatus(doc._id)
			},
			changed (doc: any) {
				updatePeripheralDeviceStatus(doc._id)
			},
			removed (oldDoc: any) {
				updatePeripheralDeviceStatus(oldDoc._id)
			}
		})

		updatePeripheralDevicesStatus()
	},2000)
})
function status2ExternalStatus (statusCode: StatusCode): ExternalStatus {
	if (statusCode === StatusCode.GOOD) {
		return 'OK'
	} else if (
		statusCode === StatusCode.WARNING_MINOR ||
		statusCode === StatusCode.WARNING_MAJOR
	) {
		return 'WARNING'
	} else if (
		statusCode === StatusCode.BAD ||
		statusCode === StatusCode.FATAL
	) {
		return 'FAIL'
	}
	return 'UNDEFINED'
}

Meteor.methods({
	'systemStatus.getSystemStatus': () => {
		return getSystemStatus()
	}
})
// Server route
// according to spec at https://github.com/nrkno/blaabok-mu/blob/master/Standarder/RFC-MU-2-Helsesjekk.md
Picker.route('/health', (params, req: IncomingMessage, res: ServerResponse, next) => {
	let status = getSystemStatus()
	health(status, res)
})
Picker.route('/health/:studioId', (params, req: IncomingMessage, res: ServerResponse, next) => {
	let status = getSystemStatus(params.studioId)
	health(status, res)
})
function health (status: StatusObjectFull, res: ServerResponse) {
	res.setHeader('Content-Type', 'application/json')
	let content = ''

	let outputStatus: ExternalStatus = status2ExternalStatus(status.statusCode)
	res.statusCode = (
			(
			outputStatus === 'OK' ||
			outputStatus === 'WARNING'
		) ?
		200 :
		500
	)

	content = JSON.stringify({
		name: 'Sofie Automation system',
		instanceId: instanceId,
		updated: new Date(getCurrentTime()).toISOString(),
		status: outputStatus,
		documentation: 'https://github.com/nrkno/tv-automation-server-core',
		utilises: [
			'https://github.com/nrkno/tv-automation-playout-gateway',
			'https://github.com/nrkno/tv-automation-mos-gateway',
		],
		checks: status.checks,
		_internal: {
			statusCode: status.statusCode,
			statusCodeString: StatusCode[status.statusCode],
			messages: status.messages || []
		}
	})
	res.end(content)
}
