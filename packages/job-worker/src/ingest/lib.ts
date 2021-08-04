// import { Meteor } from 'meteor/meteor'
// import { getHash, getCurrentTime, protectString, unprotectObject, clone, isProtectedString } from '../../../lib/lib'
// import { Studio, StudioId, Studios } from '../../../lib/collections/Studios'
// import {
// 	PeripheralDevice,
// 	PeripheralDevices,
// 	getStudioIdFromDevice,
// 	PeripheralDeviceId,
// 	PeripheralDeviceCategory,
// } from '../../../lib/collections/PeripheralDevices'
// import { Rundown, RundownId } from '../../../lib/collections/Rundowns'
// import { logger } from '../../logging'
// import { PeripheralDeviceAPI } from '../../../lib/api/peripheralDevice'
// import { SegmentId, Segment } from '../../../lib/collections/Segments'
// import { PartId } from '../../../lib/collections/Parts'
// import { PeripheralDeviceContentWriteAccess } from '../../security/peripheralDevice'
// import { MethodContext } from '../../../lib/api/methods'
// import { Credentials } from '../../security/lib/credentials'
// import { IngestRundown, ExtendedIngestRundown } from '@sofie-automation/blueprints-integration'
// import { ShowStyleBase } from '../../../lib/collections/ShowStyleBases'
// import { profiler } from '../profiler'
// import { ReadonlyDeep } from 'type-fest'
// import { ReadOnlyCache } from '../../cache/CacheBase'
// import { CacheForIngest } from './cache'

import { PartId, RundownId, SegmentId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { clone, getHash } from '@sofie-automation/corelib/dist/lib'
import { isProtectedString, protectString, unprotectObject } from '@sofie-automation/corelib/dist/protectedString'
import { ReadOnlyCache } from '../cache/CacheBase'
import { ReadonlyDeep } from 'type-fest'
import { CacheForIngest } from './cache'
import { logger } from '../logging'
import { ExtendedIngestRundown, IngestRundown } from '@sofie-automation/blueprints-integration'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'

// /** Check Access and return PeripheralDevice, throws otherwise */
// export function checkAccessAndGetPeripheralDevice(
// 	deviceId: PeripheralDeviceId,
// 	token: string | undefined,
// 	context: Credentials | MethodContext
// ): PeripheralDevice {
// 	const span = profiler.startSpan('lib.checkAccessAndGetPeripheralDevice')

// 	const { device: peripheralDevice } = PeripheralDeviceContentWriteAccess.peripheralDevice(
// 		{ userId: context.userId, token },
// 		deviceId
// 	)
// 	if (!peripheralDevice) {
// 		throw new Meteor.Error(404, `PeripheralDevice "${deviceId}" not found`)
// 	}

// 	span?.end()
// 	return peripheralDevice
// }

export function getRundownId(studio: ReadonlyDeep<DBStudio> | StudioId, rundownExternalId: string): RundownId {
	if (!studio) throw new Error('getRundownId: studio not set!')
	if (!rundownExternalId) throw new Error('getRundownId: rundownExternalId must be set!')
	return protectString<RundownId>(getHash(`${isProtectedString(studio) ? studio : studio._id}_${rundownExternalId}`))
}
export function getSegmentId(rundownId: RundownId, segmentExternalId: string): SegmentId {
	if (!rundownId) throw new Error('getSegmentId: rundownId must be set!')
	if (!segmentExternalId) throw new Error('getSegmentId: segmentExternalId must be set!')
	return protectString<SegmentId>(getHash(`${rundownId}_segment_${segmentExternalId}`))
}
export function getPartId(rundownId: RundownId, partExternalId: string): PartId {
	if (!rundownId) throw new Error('getPartId: rundownId must be set!')
	if (!partExternalId) throw new Error('getPartId: partExternalId must be set!')
	return protectString<PartId>(getHash(`${rundownId}_part_${partExternalId}`))
}

// export function getStudioFromDevice(peripheralDevice: PeripheralDevice): Studio {
// 	const span = profiler.startSpan('mosDevice.lib.getStudioFromDevice')

// 	const studioId = getStudioIdFromDevice(peripheralDevice)
// 	if (!studioId) throw new Meteor.Error(500, 'PeripheralDevice "' + peripheralDevice._id + '" has no Studio')

// 	updateDeviceLastDataReceived(peripheralDevice._id)

// 	const studio = Studios.findOne(studioId)
// 	if (!studio) throw new Meteor.Error(404, `Studio "${studioId}" of device "${peripheralDevice._id}" not found`)

// 	span?.end()
// 	return studio
// }
export function getRundown(cache: ReadOnlyCache<CacheForIngest> | CacheForIngest): ReadonlyDeep<DBRundown> {
	const rundown = cache.Rundown.doc
	if (!rundown) {
		throw new Error(`Rundown "${cache.RundownId}" ("${cache.RundownExternalId}") not found`)
	}
	return rundown
}
// export function getPeripheralDeviceFromRundown(rundown: Rundown): PeripheralDevice {
// 	if (!rundown.peripheralDeviceId)
// 		throw new Meteor.Error(500, `Rundown "${rundown._id}" does not have a peripheralDeviceId`)

// 	const device = PeripheralDevices.findOne(rundown.peripheralDeviceId)
// 	if (!device)
// 		throw new Meteor.Error(
// 			404,
// 			`PeripheralDevice "${rundown.peripheralDeviceId}" of rundown "${rundown._id}" not found`
// 		)
// 	if (device.category !== PeripheralDeviceCategory.INGEST)
// 		throw new Meteor.Error(
// 			404,
// 			`PeripheralDevice "${rundown.peripheralDeviceId}" of rundown "${rundown._id}" is not an INGEST device!`
// 		)
// 	return device
// }

// function updateDeviceLastDataReceived(deviceId: PeripheralDeviceId) {
// 	PeripheralDevices.update(deviceId, {
// 		$set: {
// 			lastDataReceived: getCurrentTime(),
// 		},
// 	})
// }

export function canRundownBeUpdated(rundown: ReadonlyDeep<DBRundown> | undefined, isCreateAction: boolean): boolean {
	if (!rundown) return true
	if (rundown.orphaned && !isCreateAction) {
		logger.info(`Rundown "${rundown._id}" has been unsynced and needs to be synced before it can be updated.`)
		return false
	}
	return true
}
export function canSegmentBeUpdated(
	rundown: ReadonlyDeep<DBRundown> | undefined,
	segment: ReadonlyDeep<DBSegment> | undefined,
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
	existingDbRundown: ReadonlyDeep<DBRundown> | undefined
): ExtendedIngestRundown {
	const extendedIngestRundown: ExtendedIngestRundown = {
		...ingestRundown,
		coreData: unprotectObject(clone(existingDbRundown)),
	}
	return extendedIngestRundown
}
export function modifyPlaylistExternalId(
	playlistExternalId: string | undefined,
	showStyleBase: DBShowStyleBase
): string | undefined {
	if (playlistExternalId) return `${showStyleBase._id}_${playlistExternalId}`
	else return undefined
}
