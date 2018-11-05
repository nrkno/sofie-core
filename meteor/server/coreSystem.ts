import { getCoreSystem, CoreSystem, SYSTEM_ID } from '../lib/collections/CoreSystem'
import { getCurrentTime } from '../lib/lib'
import { Meteor } from 'meteor/meteor'
import { CURRENT_DATABASE_VERSION } from './databaseMigration'

function initializeCoreSystem () {
	let system = getCoreSystem()
	if (!system) {
		CoreSystem.insert({
			_id: SYSTEM_ID,
			created: getCurrentTime(),
			modified: getCurrentTime(),
			version: CURRENT_DATABASE_VERSION
		})
	}

}

Meteor.startup(() => {
	if (Meteor.isServer) {
		initializeCoreSystem()
	}
})
