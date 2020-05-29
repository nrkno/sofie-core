import { PeripheralDeviceCommands, PeripheralDeviceCommand } from '../../lib/collections/PeripheralDeviceCommands'

PeripheralDeviceCommands.allow({
	insert(userId: string, doc: PeripheralDeviceCommand): boolean {
		return true
	},
	update(userId, doc, fields, modifier) {
		return false
	},
	remove(userId, doc) {
		return true
	},
})
