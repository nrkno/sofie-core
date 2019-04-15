import { Meteor } from 'meteor/meteor'
import { getHash, getCurrentTime } from '../../../lib/lib'
import { Studio, Studios } from '../../../lib/collections/Studios'
import { PeripheralDevice, PeripheralDevices } from '../../../lib/collections/PeripheralDevices'

export function getRundownId (studio: Studio, externalId: string) {
	return getHash(`${studio._id}_${externalId}`)
}
export function getSegmentId (rundownId: string, segmentExternalId: string) {
	return getHash(`${rundownId}_segment_${segmentExternalId}`)
}
export function getPartId (rundownId: string, partExternalId: string) {
	return getHash(`${rundownId}_part_${partExternalId}`)
}

function getStudioId (peripheralDevice: PeripheralDevice): string | undefined {
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
export function getStudio (peripheralDevice: PeripheralDevice): Studio {
	const studioId = getStudioId(peripheralDevice)
	if (!studioId) throw new Meteor.Error(500, 'PeripheralDevice "' + peripheralDevice._id + '" has no Studio')

	const studio = Studios.findOne(studioId)
	if (!studio) throw new Meteor.Error(404, 'Studio "' + studioId + '" not found')
	return studio
}

export function updateDeviceLastDataReceived (deviceId: string) {
	PeripheralDevices.update(deviceId, {
		$set: {
			lastDataReceived: getCurrentTime()
		}
	})
}
