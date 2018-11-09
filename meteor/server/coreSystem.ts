import { getCoreSystem, CoreSystem, SYSTEM_ID, getCoreSystemCursor, parseVersion, compareVersions } from '../lib/collections/CoreSystem'
import { getCurrentTime } from '../lib/lib'
import { Meteor } from 'meteor/meteor'
import { CURRENT_SYSTEM_VERSION, GENESIS_SYSTEM_VERSION } from './databaseMigration'
import { setSystemStatus, StatusCode, StatusObject } from './systemStatus'

function initializeCoreSystem () {
	let system = getCoreSystem()
	if (!system) {
		let version = parseVersion(GENESIS_SYSTEM_VERSION)
		CoreSystem.insert({
			_id: SYSTEM_ID,
			created: getCurrentTime(),
			modified: getCurrentTime(),
			version: version.toString()
		})
	}

	// Monitor database changes

	let cursor = getCoreSystemCursor()
	cursor.observeChanges({
		added: checkDatabaseVersion,
		changed: checkDatabaseVersion,
		removed: checkDatabaseVersion
	})

	checkDatabaseVersion()
}

function checkDatabaseVersion () {
	let databaseSystem = getCoreSystem()
	if (databaseSystem) {

		if (databaseSystem.version) {
			let dbVersion = parseVersion(databaseSystem.version)
			let currentVersion = parseVersion(CURRENT_SYSTEM_VERSION)

			if (dbVersion.major !== currentVersion.major) {

				setSystemStatus('databaseVersion', {
					statusCode: StatusCode.BAD,
					messages: [`Database version mismatch (major version differ): system version: ${currentVersion.toString()}, database version: ${dbVersion.toString()} (to fix, run migration)`]
				})
			} else if (dbVersion.minor !== currentVersion.minor) {

				setSystemStatus('databaseVersion', {
					statusCode: StatusCode.WARNING_MAJOR,
					messages: [`Database version mismatch (minor version differ): system version: ${currentVersion.toString()}, database version: ${dbVersion.toString()} (to fix, run migration)`]
				})
			} else if (dbVersion.patch !== currentVersion.patch) {

				setSystemStatus('databaseVersion', {
					statusCode: StatusCode.WARNING_MINOR,
					messages: [`Database version mismatch (patch differ): system version: ${currentVersion.toString()}, database version: ${dbVersion.toString()} (to fix, run migration)`]
				})
			} else if (dbVersion.label !== currentVersion.label) {

				setSystemStatus('databaseVersion', {
					statusCode: StatusCode.WARNING_MINOR,
					messages: [`Database version mismatch (label differ): system version: ${currentVersion.toString()}, database version: ${dbVersion.toString()} (to fix, run migration)`]
				})
			} else {
				setSystemStatus('databaseVersion', {
					statusCode: StatusCode.GOOD,
					messages: [`System version: ${currentVersion.toString()}`]
				})
			}
		} else {
			setSystemStatus('databaseVersion', {
				statusCode: StatusCode.FATAL,
				messages: ['Database version missing']
			})
		}
	} else {
		setSystemStatus('databaseVersion', {
			statusCode: StatusCode.BAD,
			messages: ['Database not set up']
		})
	}
}

Meteor.startup(() => {
	if (Meteor.isServer) {
		initializeCoreSystem()
	}
})
