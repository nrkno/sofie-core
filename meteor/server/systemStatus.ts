import * as _ from 'underscore'
import { ServerResponse, IncomingMessage } from 'http'
import { Picker } from 'meteor/meteorhacks:picker'

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
	statusCode: StatusCode,
	messages?: Array<string>
}
let systemStatuses: {[key: string]: StatusObject} = {}

export function getSystemStatus (): StatusObject {
	let systemStatus = StatusCode.UNKNOWN
	let systemStatusMessages: Array<string> = []

	_.each(systemStatuses, (status, key) => {
		if (status.statusCode > systemStatus) {
			systemStatus = status.statusCode
			systemStatusMessages = []
			systemStatusMessages = systemStatusMessages.concat(status.messages || [])
		}
		if (status.statusCode === systemStatus) {
			_.each(status.messages || [], (message: string) => {
				if (message) {
					systemStatusMessages.push(key + ': ' + message)
				}
			})
		}
	})
	return {
		statusCode: systemStatus,
		messages: systemStatusMessages
	}
}

export function setSystemStatus (type: string, status: StatusObject) {
	systemStatuses[type] = status
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
})
