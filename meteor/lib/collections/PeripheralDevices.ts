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
/**
 * Calculate what the expected latency is going to be for a device.
 * The returned latency represents the amount of time we expect the device will need to receive, process and execute a timeline
 */
export function getExpectedLatency(peripheralDevice: PeripheralDevice): {
	average: number
	safe: number
	fastest: number
} {
	if (peripheralDevice.latencies && peripheralDevice.latencies.length) {
		peripheralDevice.latencies.sort((a, b) => {
			if (a > b) return 1
			if (a < b) return -1
			return 0
		})
		const latencies = peripheralDevice.latencies
		let total = 0
		for (const latency of latencies) {
			total += latency
		}
		const average = total / latencies.length

		// The 95th slowest percentil
		const i95 = Math.floor(latencies.length * 0.95)

		return {
			average: average,
			safe: latencies[i95],
			fastest: latencies[0],
		}
	}
	return {
		average: 0,
		safe: 0,
		fastest: 0,
	}
}
