import * as _ from 'underscore'
import { ServerResponse, IncomingMessage } from 'http'
// @ts-ignore Meteor package not recognized by Typescript
import { Picker } from 'meteor/meteorhacks:picker'
import { PeripheralDevices, PeripheralDevice } from '../lib/collections/PeripheralDevices'
import { syncFunctionIgnore } from './codeControl'
import { StudioInstallations } from '../lib/collections/StudioInstallations'

// This data structure is to be used to determine the system-wide status of the Core instance

export enum StatusCode {

	UNKNOWN = 0, 		// Status unknown
	GOOD = 1, 			// All good and green
	WARNING_MINOR = 2,	// Everything is not OK, operation is not affected
	WARNING_MAJOR = 3, 	// Everything is not OK, operation might be affected
	BAD = 4, 			// Operation affected, possible to recover
	FATAL = 5			// Operation affected, not possible to recover without manual interference
}
export interface StatusObject {
	studioId?: string,
	statusCode: StatusCode,
	messages?: Array<string>
}
let systemStatuses: {[key: string]: StatusObject} = {}

export function getSystemStatus (studioId?: string): StatusObject {
	let systemStatus = StatusCode.UNKNOWN
	let systemStatusMessages: Array<string> = []

	let statusFound = false

	_.each(systemStatuses, (status: StatusObject, key: string) => {

		if (studioId && status.studioId && status.studioId !== studioId) return

		statusFound = true

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

	let statusObj: StatusObject = {
		statusCode: systemStatus,
		messages: systemStatusMessages
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
function health (status: StatusObject, res: ServerResponse) {
	res.setHeader('Content-Type', 'application/json')
	let content = ''
	if (
		status.statusCode === StatusCode.GOOD ||
		status.statusCode === StatusCode.WARNING_MINOR
	) {
		res.statusCode = 200
		content = JSON.stringify({status: 'OK'})
	} else {
		res.statusCode = 500
		content = JSON.stringify({
			status: StatusCode[status.statusCode],
			statusCode: status.statusCode,
			messages: status.messages || []
		})
	}

	res.end(content)
}
