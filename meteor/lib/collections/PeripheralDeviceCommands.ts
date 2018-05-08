import { Mongo } from 'meteor/mongo'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import { Time, getCurrentTime } from '../../lib/lib'

export interface PeripheralDeviceCommand {
	_id: string

	deviceId: string
	functionName: string
	args: Array<any>

	hasReply: boolean
	reply?: any
	replyError?: any

	time: number // time
}
export const PeripheralDeviceCommands = new Mongo.Collection<PeripheralDeviceCommand>('peripheralDeviceCommands')

// Monitor and remove old, lingering commands:
setInterval(() => {
	PeripheralDeviceCommands.find().forEach((cmd) => {
		if (getCurrentTime() - (cmd.time || 0) > (20 * 1000)) { // timeout a long time ago
			PeripheralDeviceCommands.remove(cmd._id)
		}
	})
}, 3600 * 1000)
