import { Random } from 'meteor/random'
import * as _ from 'underscore'
import { ServerResponse, IncomingMessage } from 'http'
// @ts-ignore Meteor package not recognized by Typescript
import { Picker } from 'meteor/meteorhacks:picker'
import { PeripheralDevices, PeripheralDevice } from '../lib/collections/PeripheralDevices'
import { syncFunctionIgnore } from './codeControl'
import { StudioInstallations } from '../lib/collections/StudioInstallations'
import { getCurrentTime, Time } from '../lib/lib'
import { PeripheralDeviceAPI } from '../lib/api/peripheralDevice'
import { Meteor } from 'meteor/meteor'
import { setMeteorMethods, Methods } from './methods'
import { parseVersion, compareVersions } from '../lib/collections/CoreSystem'
import { StatusResponse, CheckObj, SystemStatusAPI, ExternalStatus, CheckError } from '../lib/api/systemStatus'

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
	studioId?: string
	statusCode: StatusCode
	messages?: Array<string>
}
export interface StatusObjectInternal {
	studioId?: string
	statusCode: StatusCode
	timestamp: Time // when statusCode was last changed
	messages: Array<{
		message: string
		timestamp: Time // when message appeared first
	}>,
}
let systemStatuses: {[key: string]: StatusObjectInternal} = {}

export function getSystemStatus (studioId?: string): StatusResponse {

	let checks: Array<CheckObj> = []

	_.each(systemStatuses, (status: StatusObjectInternal, key: string) => {
		checks.push({
			description: key,
			status: status2ExternalStatus(status.statusCode),
			updated: new Date(status.timestamp).toISOString(),
			_status: status.statusCode,
			errors: _.map(status.messages || [], (m): CheckError => {
				return {
					type: 'message',
					time: new Date(m.timestamp).toISOString(),
					message: m.message
				}
			})
		})

	})

	let statusObj: StatusResponse = {
		name: 'Sofie Automation system',
		instanceId: instanceId,
		updated: new Date(getCurrentTime()).toISOString(),
		status: 'UNDEFINED',
		_status: StatusCode.UNKNOWN,
		documentation: 'https://github.com/nrkno/tv-automation-server-core',
		_internal: {
			// statusCode: StatusCode.UNKNOWN,
			statusCodeString: StatusCode[StatusCode.UNKNOWN],
			messages: []
		},
		checks: checks,
	}

	let devices = (
		studioId ?
		PeripheralDevices.find({ studioInstallationId: studioId }).fetch() :
		PeripheralDevices.find({}).fetch()
	)

	_.each(devices, (device: PeripheralDevice) => {

		let deviceStatus: StatusCode = device.status.statusCode
		let deviceStatusMessages: Array<string> = device.status.messages || []

		let checks: Array<CheckObj> = []

		if (deviceStatus === StatusCode.GOOD) {

			if (device.expectedVersions) {
				if (!device.versions) device.versions = {}
				let deviceVersions = device.versions
				_.each(device.expectedVersions, (expectedVersionStr, libraryName: string) => {
					let versionStr = deviceVersions[libraryName]

					let version = parseVersion(versionStr)
					let expectedVersion = parseVersion(expectedVersionStr)

					let statusCode = StatusCode.GOOD
					let messages: Array<string> = []

					if (!versionStr) {
						statusCode = StatusCode.BAD
						messages.push(`${libraryName}: Expected version ${expectedVersionStr}, got undefined`)
					} else if (version.major !== expectedVersion.major ) {
						statusCode = StatusCode.BAD
						messages.push(`${libraryName}: Expected version ${expectedVersionStr}, got ${versionStr} (major version differ)`)
					} else if (version.minor < expectedVersion.minor ) {
						statusCode = StatusCode.WARNING_MAJOR
						messages.push(`${libraryName}: Expected version ${expectedVersionStr}, got ${versionStr} (minor version differ)`)
					} else if (version.patch < expectedVersion.patch ) {
						statusCode = StatusCode.WARNING_MINOR
						messages.push(`${libraryName}: Expected version ${expectedVersionStr}, got ${versionStr} (patch version differ)`)
					}

					checks.push({
						description: `expectedVersion.${libraryName}`,
						status: status2ExternalStatus(statusCode),
						updated: new Date(device.lastSeen).toISOString(),
						_status: statusCode,
						errors: _.map(messages, (message): CheckError => {
							return {
								type: 'version-differ',
								time: new Date(device.lastSeen).toISOString(),
								message: ''
							}
						})
					})

				})
			}
		}
		let so: StatusResponse = {
			name: device.name,
			instanceId: device._id,
			status: 'UNDEFINED',
			updated: new Date(device.lastSeen).toISOString(),
			_status: deviceStatus,
			documentation: '',
			statusMessage: deviceStatusMessages.length ? deviceStatusMessages.join(', ') : undefined,
			_internal: {
				// statusCode: deviceStatus,
				statusCodeString: StatusCode[deviceStatus],
				messages: deviceStatusMessages
			},
			checks: checks
		}
		if (device.type === PeripheralDeviceAPI.DeviceType.MOSDEVICE) {
			so.documentation = 'https://github.com/nrkno/tv-automation-mos-gateway'
		} else if (device.type === PeripheralDeviceAPI.DeviceType.PLAYOUT) {
			so.documentation = 'https://github.com/nrkno/tv-automation-playout-gateway'
		}

		if (!statusObj.components) statusObj.components = []
		statusObj.components.push(so)

	})

	let systemStatus: StatusCode = setStatus(statusObj)
	statusObj._internal = {
		// statusCode: systemStatus,
		statusCodeString: StatusCode[systemStatus],
		messages: collectMesages(statusObj)
	}
	statusObj.statusMessage = statusObj._internal.messages.join(', ')

	return statusObj
}
function setStatus ( statusObj: StatusResponse): StatusCode {

	let s: StatusCode = statusObj._status

	if (statusObj.checks) {
		_.each(statusObj.checks, (check: CheckObj) => {
			if (check._status > s) s = check._status
		})
	}
	if (statusObj.components) {
		_.each(statusObj.components, (component: StatusResponse) => {
			let s2: StatusCode = setStatus(component)
			if (s2 > s) s = s2
		})
	}
	statusObj.status = status2ExternalStatus(s)
	statusObj._status = s
	return s
}
function collectMesages ( statusObj: StatusResponse): Array<string> {
	let allMessages: Array<string> = []

	if (statusObj._internal) {
		_.each(statusObj._internal.messages, (msg) => {
			allMessages.push(msg)
		})
	}
	if (statusObj.checks) {
		_.each(statusObj.checks, (check: CheckObj) => {

			if (check._status !== StatusCode.GOOD && check.errors) {
				_.each(check.errors, (errMsg) => {
					allMessages.push(`check ${check.description}: ${errMsg.message}`)
				})
			}

		})
	}
	if (statusObj.components) {
		_.each(statusObj.components, (component: StatusResponse) => {

			let messages = collectMesages(component)

			_.each(messages, (msg) => {
				allMessages.push(`${component.name}: ${msg}`)
			})
		})
	}
	return allMessages
}

export function setSystemStatus (type: string, status: StatusObject) {
	let systemStatus: StatusObjectInternal = systemStatuses[type]
	if (!systemStatus) {
		systemStatus = {
			statusCode: StatusCode.UNKNOWN,
			timestamp: 0,
			messages: []
		}
		systemStatuses[type] = systemStatus
	}

	if (systemStatus.statusCode !== status.statusCode) {
		systemStatus.statusCode = status.statusCode
		systemStatus.timestamp = getCurrentTime()
	}

	let messages: Array<{
		message: string
		timestamp: Time
	}> = []
	if (status.messages) {
		_.each(status.messages, (message) => {
			let m = _.find(systemStatus.messages, m => m.message === message)
			if (m) {
				messages.push(m)
			} else {
				messages.push({
					message: message,
					timestamp: getCurrentTime()
				})
			}
		})
	}
	systemStatus.messages = messages
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

let methods: Methods = {}

methods[SystemStatusAPI.getSystemStatus] = () => {
	return getSystemStatus()
}
setMeteorMethods(methods)
// Server route
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
