import { getCurrentTime, Time, registerCollection } from '../lib'
import { Meteor } from 'meteor/meteor'
import { createMongoCollection } from './lib'
import { registerIndex } from '../database'
import { PeripheralDeviceCommandId, PeripheralDeviceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
export { PeripheralDeviceCommandId }

export interface PeripheralDeviceCommand {
	_id: PeripheralDeviceCommandId

	deviceId: PeripheralDeviceId
	functionName: string
	args: Array<any>

	hasReply: boolean
	reply?: any
	replyError?: any
	replyTime?: number

	time: Time // time
}
export const PeripheralDeviceCommands = createMongoCollection<PeripheralDeviceCommand, PeripheralDeviceCommand>(
	'peripheralDeviceCommands'
)
registerCollection('PeripheralDeviceCommands', PeripheralDeviceCommands)

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
