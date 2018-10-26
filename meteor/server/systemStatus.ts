import { Random } from 'meteor/random'
import * as _ from 'underscore'
import { ServerResponse, IncomingMessage } from 'http'
// @ts-ignore Meteor package not recognized by Typescript
import { Picker } from 'meteor/meteorhacks:picker'
import { PeripheralDevices, PeripheralDevice } from '../lib/collections/PeripheralDevices'
import { syncFunctionIgnore } from './codeControl'
import { StudioInstallations } from '../lib/collections/StudioInstallations'
import { getCurrentTime } from '../lib/lib'
import { PeripheralDeviceAPI } from '../lib/api/peripheralDevice'
import { Meteor } from 'meteor/meteor'

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

export interface StatusObject {
	studioId?: string,
	statusCode: StatusCode,
	messages?: Array<string>,
}
// export interface StatusObjectFull extends StatusObject {
// 	checks: Array<CheckObj>
// }
let systemStatuses: {[key: string]: StatusObject} = {}

export type ExternalStatus = 'OK' | 'FAIL' | 'WARNING' | 'UNDEFINED'
export interface CheckObj {
	description: string,
	status: ExternalStatus,
	errors: Array<string>
}
interface StatusResponse {
	name: string,
	status: ExternalStatus,
	documentation: string,
	instanceId?: string,
	updated?: string,
	appVersion?: string,
	version?: '2', // version of healthcheck
	utilises?: Array<string>,
	consumers?: Array<string>,
	checks?: Array<CheckObj>,
	_internal: {
		statusCode: StatusCode,
		statusCodeString: string,
		messages: Array<string>
	},
	components?: Array<StatusResponse>
}

export function getSystemStatus (studioId?: string): StatusResponse {

	let checks: Array<CheckObj> = []

	let systemStatus: StatusCode = StatusCode.UNKNOWN
	let systemStatusMessages: Array<string> = []

	_.each(systemStatuses, (status: StatusObject, key: string) => {
		checks.push({
			description: key,
			status: status2ExternalStatus(status.statusCode),
			errors: status.messages || []
		})

		if (status.statusCode !== StatusCode.GOOD) {
			systemStatusMessages.push(key + ': Status: ' + StatusCode[status.statusCode])
		}

		_.each(status.messages || [], (message: string) => {
			if (message) {
				systemStatusMessages.push(key + ': ' + message)
			}
		})
	})

	let statusObj: StatusResponse = {
		name: 'Sofie Automation system',
		instanceId: instanceId,
		updated: new Date(getCurrentTime()).toISOString(),
		status: 'UNDEFINED',
		documentation: 'https://github.com/nrkno/tv-automation-server-core',
		checks: checks,
		_internal: {
			statusCode: systemStatus,
			statusCodeString: StatusCode[systemStatus],
			messages: systemStatusMessages || []
		}
	}

	let devices = (
		studioId ?
		PeripheralDevices.find({ studioInstallationId: studioId }).fetch() :
		PeripheralDevices.find({}).fetch()
	)

	_.each(devices, (device: PeripheralDevice) => {

		let systemStatus: StatusCode = device.status.statusCode
		let systemStatusMessages: Array<string> = device.status.messages || []

		if (!device.connected) {
			systemStatus = StatusCode.BAD
			systemStatusMessages.push('Disconnected')
		}

		let so: StatusResponse = {
			name: device.name,
			instanceId: device._id,
			status: 'UNDEFINED',
			documentation: '',
			_internal: {
				statusCode: systemStatus,
				statusCodeString: StatusCode[systemStatus],
				messages: systemStatusMessages
			}
		}
		if (device.type === PeripheralDeviceAPI.DeviceType.MOSDEVICE) {
			so.documentation = 'https://github.com/nrkno/tv-automation-mos-gateway'
		} else if (device.type === PeripheralDeviceAPI.DeviceType.PLAYOUT) {
			so.documentation = 'https://github.com/nrkno/tv-automation-playout-gateway'
		}

		if (!statusObj.components) statusObj.components = []
		statusObj.components.push(so)

	})

	setStatus(statusObj)

	return statusObj
}
function setStatus ( statusObj: StatusResponse): StatusCode {

	let s: StatusCode = statusObj._internal.statusCode

	if (statusObj.components) {
		_.each(statusObj.components, (component: StatusResponse) => {

			let s2: StatusCode = setStatus(component)

			if (s2 > s) {
				s = s2
			}

		})
	}

	statusObj.status = status2ExternalStatus(s)
	return s
}

export function setSystemStatus (type: string, status: StatusObject) {
	systemStatuses[type] = status
}
export function removeSystemStatus (type: string) {
	delete systemStatuses[type]
}

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
function health (status: StatusResponse, res: ServerResponse) {
	res.setHeader('Content-Type', 'application/json')
	let content = ''

	res.statusCode = (
			(
			status.status === 'OK' ||
			status.status === 'WARNING'
		) ?
		200 :
		500
	)

	content = JSON.stringify(status)
	res.end(content)
}
