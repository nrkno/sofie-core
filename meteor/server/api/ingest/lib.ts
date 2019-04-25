import { Meteor } from 'meteor/meteor'
import { getHash, getCurrentTime } from '../../../lib/lib'
import { Studio, Studios } from '../../../lib/collections/Studios'
import { PeripheralDevice, PeripheralDevices } from '../../../lib/collections/PeripheralDevices'
import { Rundowns, Rundown } from '../../../lib/collections/Rundowns'
import { logger } from '../../logging'

export function getRundownId (studio: Studio, rundownExternalId: string) {
	if (!studio) throw new Meteor.Error(500, 'getRundownId: studio not set!')
	if (!rundownExternalId) throw new Meteor.Error(401, 'getRundownId: rundownExternalId must be set!')
	return getHash(`${studio._id}_${rundownExternalId}`)
}
export function getSegmentId (rundownId: string, segmentExternalId: string) {
	if (!rundownId) throw new Meteor.Error(401, 'getSegmentId: rundownId must be set!')
	if (!segmentExternalId) throw new Meteor.Error(401, 'getSegmentId: segmentExternalId must be set!')
	return getHash(`${rundownId}_segment_${segmentExternalId}`)
}
export function getPartId (rundownId: string, partExternalId: string) {
	if (!rundownId) throw new Meteor.Error(401, 'getPartId: rundownId must be set!')
	if (!partExternalId) throw new Meteor.Error(401, 'getPartId: partExternalId must be set!')
	return getHash(`${rundownId}_part_${partExternalId}`)
}

function getStudioIdFromDevice (peripheralDevice: PeripheralDevice): string | undefined {
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
export function getStudioFromDevice (peripheralDevice: PeripheralDevice): Studio {
	const studioId = getStudioIdFromDevice(peripheralDevice)
	if (!studioId) throw new Meteor.Error(500, 'PeripheralDevice "' + peripheralDevice._id + '" has no Studio')

	updateDeviceLastDataReceived(peripheralDevice._id)

	const studio = Studios.findOne(studioId)
	if (!studio) throw new Meteor.Error(404, 'Studio "' + studioId + '" not found')
	return studio
}
export function getStudioFromRundown (rundown: Rundown): Studio {
	const studioId = rundown.studioId
	if (!studioId) throw new Meteor.Error(500, 'Rundown "' + rundown._id + '" has no Studio')

	const studio = Studios.findOne(studioId)
	if (!studio) throw new Meteor.Error(404, 'Studio "' + studioId + '" not found')
	return studio
}
export function getRundown (rundownId: string): Rundown {
	const rundown = Rundowns.findOne(rundownId)
	if (!rundown) throw new Meteor.Error(404, 'Rundown ' + rundownId + ' not found')
	rundown.touch()
	return rundown
}
export function getPeripheralDeviceFromRundown (rundown: Rundown): PeripheralDevice {
	if (!rundown.peripheralDeviceId) throw new Meteor.Error(500, `Rundown "${rundown._id}" does not have a peripheralDeviceId`)

	const device = PeripheralDevices.findOne(rundown.peripheralDeviceId)
	if (!device) throw new Meteor.Error(404, `PeripheralDevice "${rundown.peripheralDeviceId}" of rundown "${rundown._id}" not found`)
	return device
}

function updateDeviceLastDataReceived (deviceId: string) {
	PeripheralDevices.update(deviceId, {
		$set: {
			lastDataReceived: getCurrentTime()
		}
	})
}

export function canBeUpdated (rundown: Rundown | undefined, segmentId?: string, partId?: string) {
	if (!rundown) return true
	if (rundown.unsynced) {
		logger.info(`Rundown "${rundown._id}" has been unsynced and needs to be synced before it can be updated.`)
		return false
	}

	// TODO
	return true
}
