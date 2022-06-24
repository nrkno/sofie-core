import { createMongoCollection } from './lib'
import { registerIndex } from '../database'
import { PeripheralDeviceId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
export { PeripheralDeviceId }
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'

import { PeripheralDevice } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
export * from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'

export const PeripheralDevices = createMongoCollection<PeripheralDevice>(CollectionName.PeripheralDevices)

registerIndex(PeripheralDevices, {
	organizationId: 1,
	studioId: 1,
})
registerIndex(PeripheralDevices, {
	studioId: 1,
})
registerIndex(PeripheralDevices, {
	token: 1,
})

export function getStudioIdFromDevice(peripheralDevice: PeripheralDevice): StudioId | undefined {
	if (peripheralDevice.studioId) {
		return peripheralDevice.studioId
	}
	if (peripheralDevice.parentDeviceId) {
		// Also check the parent device:
		const parentDevice = PeripheralDevices.findOne(peripheralDevice.parentDeviceId)
		if (parentDevice) {
			return parentDevice.studioId
		}
	}
	return undefined
}
