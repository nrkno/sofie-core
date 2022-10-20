import { getCurrentTime } from '../lib'
import { Meteor } from 'meteor/meteor'
import { createMongoCollection } from './lib'
import { registerIndex } from '../database'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'

import { PeripheralDeviceCommand } from '@sofie-automation/corelib/dist/dataModel/PeripheralDeviceCommand'
export * from '@sofie-automation/corelib/dist/dataModel/PeripheralDeviceCommand'

export const PeripheralDeviceCommands = createMongoCollection<PeripheralDeviceCommand>(
	CollectionName.PeripheralDeviceCommands
)

// Monitor and remove old, lingering commands:
const removeOldCommands = () => {
	PeripheralDeviceCommands.find().forEach((cmd) => {
		if (getCurrentTime() - (cmd.time || 0) > 20 * 1000) {
			// timeout a long time ago
			PeripheralDeviceCommands.remove(cmd._id)
		}
	})
}
Meteor.startup(() => {
	if (Meteor.isServer) {
		Meteor.setInterval(() => {
			removeOldCommands()
		}, 5 * 60 * 1000)
	}
})

registerIndex(PeripheralDeviceCommands, {
	deviceId: 1,
})
