import { getCurrentTime, Time, registerCollection, ProtectedString } from '../lib'
import { TransformedCollection } from '../typings/meteor'
import { Meteor } from 'meteor/meteor'
import { createMongoCollection } from './lib'
import { PeripheralDeviceId } from './PeripheralDevices'

/** A string, identifying a PeripheralDeviceCommand */
export type PeripheralDeviceCommandId = ProtectedString<'PeripheralDeviceCommandId'>

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
export const PeripheralDeviceCommands: TransformedCollection<
	PeripheralDeviceCommand,
	PeripheralDeviceCommand
> = createMongoCollection<PeripheralDeviceCommand>('peripheralDeviceCommands')
registerCollection('PeripheralDeviceCommands', PeripheralDeviceCommands)

// Monitor and remove old, lingering commands:
let removeOldCommands = () => {
	PeripheralDeviceCommands.find().forEach((cmd) => {
		if (getCurrentTime() - (cmd.time || 0) > 20 * 1000) {
			// timeout a long time ago
			PeripheralDeviceCommands.remove(cmd._id)
		}
	})
}
Meteor.startup(() => {
	Meteor.setInterval(() => {
		removeOldCommands()
	}, 5 * 60 * 1000)
	if (Meteor.isServer) {
		PeripheralDeviceCommands._ensureIndex({
			deviceId: 1,
		})
	}
})
