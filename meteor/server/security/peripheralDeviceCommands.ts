import { PeripheralDeviceCommands, PeripheralDeviceCommand } from '../../lib/collections/PeripheralDeviceCommands'

PeripheralDeviceCommands.allow({
	insert (userId: string, doc: PeripheralDeviceCommand): boolean {
		return true // Temporary: allow all updates client-side
	},
	update (userId, doc, fields, modifier) {
		return true // Temporary: allow all updates client-side
	},

	remove (userId, doc) {
		return true // Temporary: allow all updates client-side
	}
})
