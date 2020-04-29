import { Meteor } from 'meteor/meteor'
import { getHash, getCurrentTime, protectString } from '../../../lib/lib'
import { Studio, Studios } from '../../../lib/collections/Studios'
import { PeripheralDevice, PeripheralDevices, getStudioIdFromDevice, PeripheralDeviceId } from '../../../lib/collections/PeripheralDevices'
import { Rundowns, Rundown, RundownId } from '../../../lib/collections/Rundowns'
import { logger } from '../../logging'
import { PeripheralDeviceAPI } from '../../../lib/api/peripheralDevice'
import { RundownPlaylist, RundownPlaylists } from '../../../lib/collections/RundownPlaylists'
import { SegmentId } from '../../../lib/collections/Segments'
import { PartId } from '../../../lib/collections/Parts'
import { CacheForRundownPlaylist } from '../../DatabaseCaches'
import { touchRundownPlaylistsInCache } from '../playout/lib'

export function getRundownId (studio: Studio, rundownExternalId: string): RundownId {
	if (!studio) throw new Meteor.Error(500, 'getRundownId: studio not set!')
	if (!rundownExternalId) throw new Meteor.Error(401, 'getRundownId: rundownExternalId must be set!')
	return protectString<RundownId>(getHash(`${studio._id}_${rundownExternalId}`))
}
export function getSegmentId (rundownId: RundownId, segmentExternalId: string): SegmentId {
	if (!rundownId) throw new Meteor.Error(401, 'getSegmentId: rundownId must be set!')
	if (!segmentExternalId) throw new Meteor.Error(401, 'getSegmentId: segmentExternalId must be set!')
	return protectString<SegmentId>(getHash(`${rundownId}_segment_${segmentExternalId}`))
}
export function getPartId (rundownId: RundownId, partExternalId: string): PartId {
	if (!rundownId) throw new Meteor.Error(401, 'getPartId: rundownId must be set!')
	if (!partExternalId) throw new Meteor.Error(401, 'getPartId: partExternalId must be set!')
	return protectString<PartId>(getHash(`${rundownId}_part_${partExternalId}`))
}

export function getStudioFromDevice (peripheralDevice: PeripheralDevice): Studio {
	const studioId = getStudioIdFromDevice(peripheralDevice)
	if (!studioId) throw new Meteor.Error(500, 'PeripheralDevice "' + peripheralDevice._id + '" has no Studio')

	updateDeviceLastDataReceived(peripheralDevice._id)

	const studio = Studios.findOne(studioId)
	if (!studio) throw new Meteor.Error(404, `Studio "${studioId}" of device "${peripheralDevice._id}" not found`)
	return studio
}
export function getRundownPlaylist (rundown: Rundown): RundownPlaylist {
	const playlist = RundownPlaylists.findOne(rundown.playlistId)
	if (!playlist) throw new Meteor.Error(500, `Rundown playlist "${rundown.playlistId}" of rundown "${rundown._id}" not found!`)
	playlist.touch()
	return playlist
}
export function getRundown (rundownId: RundownId, externalRundownId: string): Rundown {
	const rundown = Rundowns.findOne(rundownId)
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" ("${externalRundownId}") not found`)
	rundown.touch()
	return rundown
}
export function getPeripheralDeviceFromRundown (rundown: Rundown): PeripheralDevice {
	if (!rundown.peripheralDeviceId) throw new Meteor.Error(500, `Rundown "${rundown._id}" does not have a peripheralDeviceId`)

	const device = PeripheralDevices.findOne(rundown.peripheralDeviceId)
	if (!device) throw new Meteor.Error(404, `PeripheralDevice "${rundown.peripheralDeviceId}" of rundown "${rundown._id}" not found`)
	if (device.category !== PeripheralDeviceAPI.DeviceCategory.INGEST) throw new Meteor.Error(404, `PeripheralDevice "${rundown.peripheralDeviceId}" of rundown "${rundown._id}" is not an INGEST device!`)
	return device
}

function updateDeviceLastDataReceived (deviceId: PeripheralDeviceId) {
	PeripheralDevices.update(deviceId, {
		$set: {
			lastDataReceived: getCurrentTime()
		}
	})
}

export function canBeUpdated (rundown: Rundown | undefined, _segmentId?: SegmentId, _partId?: PartId) {
	if (!rundown) return true
	if (rundown.unsynced) {
		logger.info(`Rundown "${rundown._id}" has been unsynced and needs to be synced before it can be updated.`)
		return false
	}

	// TODO
	return true
}
