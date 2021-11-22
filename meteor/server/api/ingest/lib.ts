import { Meteor } from 'meteor/meteor'
import { getHash, getCurrentTime, protectString, unprotectObject, clone } from '../../../lib/lib'
import { StudioId } from '../../../lib/collections/Studios'
import {
	PeripheralDevice,
	PeripheralDevices,
	getStudioIdFromDevice,
	PeripheralDeviceId,
} from '../../../lib/collections/PeripheralDevices'
import { Rundown, RundownId } from '../../../lib/collections/Rundowns'
import { logger } from '../../logging'
import { PeripheralDeviceAPI } from '../../../lib/api/peripheralDevice'
import { SegmentId, Segment } from '../../../lib/collections/Segments'
import { PartId } from '../../../lib/collections/Parts'
import { PeripheralDeviceContentWriteAccess } from '../../security/peripheralDevice'
import { MethodContext } from '../../../lib/api/methods'
import { Credentials } from '../../security/lib/credentials'
import { IngestRundown, ExtendedIngestRundown } from '@sofie-automation/blueprints-integration'
import { ShowStyleBase } from '../../../lib/collections/ShowStyleBases'
import { profiler } from '../profiler'
import { ReadonlyDeep } from 'type-fest'
import { ReadOnlyCache } from '../../cache/CacheBase'
import { CacheForIngest } from './cache'
import { checkStudioExists } from '../../../lib/collections/optimizations'

/** Check Access and return PeripheralDevice, throws otherwise */
export function checkAccessAndGetPeripheralDevice(
	deviceId: PeripheralDeviceId,
	token: string | undefined,
	context: Credentials | MethodContext
): PeripheralDevice {
	const span = profiler.startSpan('lib.checkAccessAndGetPeripheralDevice')

	const { device: peripheralDevice } = PeripheralDeviceContentWriteAccess.peripheralDevice(
		{ userId: context.userId, token },
		deviceId
	)
	if (!peripheralDevice) {
		throw new Meteor.Error(404, `PeripheralDevice "${deviceId}" not found`)
	}

	span?.end()
	return peripheralDevice
}

export function getRundownId(studioId: StudioId, rundownExternalId: string): RundownId {
	if (!studioId) throw new Meteor.Error(500, 'getRundownId: studio not set!')
	if (!rundownExternalId) throw new Meteor.Error(401, 'getRundownId: rundownExternalId must be set!')
	return protectString<RundownId>(getHash(`${studioId}_${rundownExternalId}`))
}
export function getSegmentId(rundownId: RundownId, segmentExternalId: string): SegmentId {
	if (!rundownId) throw new Meteor.Error(401, 'getSegmentId: rundownId must be set!')
	if (!segmentExternalId) throw new Meteor.Error(401, 'getSegmentId: segmentExternalId must be set!')
	return protectString<SegmentId>(getHash(`${rundownId}_segment_${segmentExternalId}`))
}
export function getPartId(rundownId: RundownId, partExternalId: string): PartId {
	if (!rundownId) throw new Meteor.Error(401, 'getPartId: rundownId must be set!')
	if (!partExternalId) throw new Meteor.Error(401, 'getPartId: partExternalId must be set!')
	return protectString<PartId>(getHash(`${rundownId}_part_${partExternalId}`))
}

export function fetchStudioIdFromDevice(peripheralDevice: PeripheralDevice): StudioId {
	const span = profiler.startSpan('mosDevice.lib.getStudioIdFromDevice')

	const studioId = getStudioIdFromDevice(peripheralDevice)
	if (!studioId) throw new Meteor.Error(500, 'PeripheralDevice "' + peripheralDevice._id + '" has no Studio')

	updateDeviceLastDataReceived(peripheralDevice._id)

	const studioExists = checkStudioExists(studioId)
	if (!studioExists) throw new Meteor.Error(404, `Studio "${studioId}" of device "${peripheralDevice._id}" not found`)

	span?.end()
	return studioId
}
export function getRundown(cache: ReadOnlyCache<CacheForIngest> | CacheForIngest): ReadonlyDeep<Rundown> {
	const rundown = cache.Rundown.doc
	if (!rundown) {
		const rundownId = getRundownId(cache.Studio.doc._id, cache.RundownExternalId)
		throw new Meteor.Error(404, `Rundown "${rundownId}" ("${cache.RundownExternalId}") not found`)
	}
	return rundown
}
export function getPeripheralDeviceFromRundown(rundown: Rundown): PeripheralDevice {
	if (!rundown.peripheralDeviceId)
		throw new Meteor.Error(500, `Rundown "${rundown._id}" does not have a peripheralDeviceId`)

	const device = PeripheralDevices.findOne(rundown.peripheralDeviceId)
	if (!device)
		throw new Meteor.Error(
			404,
			`PeripheralDevice "${rundown.peripheralDeviceId}" of rundown "${rundown._id}" not found`
		)
	if (device.category !== PeripheralDeviceAPI.DeviceCategory.INGEST)
		throw new Meteor.Error(
			404,
			`PeripheralDevice "${rundown.peripheralDeviceId}" of rundown "${rundown._id}" is not an INGEST device!`
		)
	return device
}

function updateDeviceLastDataReceived(deviceId: PeripheralDeviceId) {
	PeripheralDevices.updateAsync(deviceId, {
		$set: {
			lastDataReceived: getCurrentTime(),
		},
	}).catch((err) => {
		logger.error(`Error in updateDeviceLastDataReceived "${deviceId}": ${err}`)
	})
}

export function canRundownBeUpdated(rundown: ReadonlyDeep<Rundown> | undefined, isCreateAction: boolean): boolean {
	if (!rundown) return true
	if (rundown.orphaned && !isCreateAction) {
		logger.info(`Rundown "${rundown._id}" has been unsynced and needs to be synced before it can be updated.`)
		return false
	}
	return true
}
export function canSegmentBeUpdated(
	rundown: ReadonlyDeep<Rundown> | undefined,
	segment: ReadonlyDeep<Segment> | undefined,
	isCreateAction: boolean
): boolean {
	if (!canRundownBeUpdated(rundown, false)) {
		return false
	}

	if (!segment) return true
	if (segment.orphaned && !isCreateAction) {
		logger.info(`Segment "${segment._id}" has been unsynced and needs to be synced before it can be updated.`)
		return false
	}

	return true
}

export function extendIngestRundownCore(
	ingestRundown: IngestRundown,
	existingDbRundown: ReadonlyDeep<Rundown> | undefined
): ExtendedIngestRundown {
	const extendedIngestRundown: ExtendedIngestRundown = {
		...ingestRundown,
		coreData: unprotectObject(clone(existingDbRundown)),
	}
	return extendedIngestRundown
}
export function modifyPlaylistExternalId(playlistExternalId: string | undefined, showStyleBase: ShowStyleBase) {
	if (playlistExternalId) return `${showStyleBase._id}_${playlistExternalId}`
	else return undefined
}
