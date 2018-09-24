import { Mongo } from 'meteor/mongo'
import { getCurrentTime, Time, registerCollection } from '../lib'
import { TransformedCollection } from '../typings/meteor'
import { Meteor } from 'meteor/meteor'

export interface PeripheralDeviceCommand {
	_id: string

	deviceId: string
	functionName: string
	args: Array<any>

	hasReply: boolean
	reply?: any
	replyError?: any
	replyTime?: number

	time: Time // time
}
export const PeripheralDeviceCommands: TransformedCollection<PeripheralDeviceCommand, PeripheralDeviceCommand>
	= new Mongo.Collection<PeripheralDeviceCommand>('peripheralDeviceCommands')
// Monitor and remove old, lingering commands:
let removeOldCommands = () => {
	PeripheralDeviceCommands.find().forEach((cmd) => {
		if (
			(getCurrentTime() - (cmd.time || 0) > (20 * 1000))
		) { // timeout a long time ago
			PeripheralDeviceCommands.remove(cmd._id)
		}
	})
}
Meteor.startup(() => {
	registerCollection('PeripheralDeviceCommands', PeripheralDeviceCommands)
	Meteor.setInterval(() => {
		removeOldCommands()
	}, 5 * 60 * 1000)
	if (Meteor.isServer) {
		PeripheralDeviceCommands._ensureIndex({
			deviceId: 1,
		})
	}
})
