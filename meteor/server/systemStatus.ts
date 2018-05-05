import * as _ from 'underscore'

// This data structure is to be used to determine the system-wide status of the Core instance

// Ref: https://github.com/nrkno/blaabok-mu/blob/master/Standarder/RFC-MU-2-Helsesjekk.md

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
