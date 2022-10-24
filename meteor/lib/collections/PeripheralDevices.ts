import { createMongoCollection } from './lib'
import { registerIndex } from '../database'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
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

export async function getStudioIdFromDevice(peripheralDevice: PeripheralDevice): Promise<StudioId | undefined> {
	if (peripheralDevice.studioId) {
		return peripheralDevice.studioId
	}
	if (peripheralDevice.parentDeviceId) {
		// Also check the parent device:
		const parentDevice = (await PeripheralDevices.findOneAsync(peripheralDevice.parentDeviceId, {
			fields: {
				_id: 1,
				studioId: 1,
			},
		})) as Pick<PeripheralDevice, '_id' | 'studioId'> | undefined
		if (parentDevice) {
			return parentDevice.studioId
		}
	}
	return undefined
}
