import { Meteor } from 'meteor/meteor'
import { getHash, getCurrentTime, protectString, unprotectObject, clone, isProtectedString } from '../../../lib/lib'
import { Studio, StudioId, Studios } from '../../../lib/collections/Studios'
import {
	PeripheralDevice,
	PeripheralDevices,
	getStudioIdFromDevice,
	PeripheralDeviceId,
	PeripheralDeviceCategory,
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
import { IngestJobFunc } from '@sofie-automation/corelib/dist/worker/ingest'
import { QueueIngestJob } from '../../worker/worker'

/**
 * Run an ingest operation via the worker.
 * @param studioId Id of the studio
 * @param name The name/id of the operation
 * @param data Data for the operation
 * @returns Wrapped 'client safe' response. Includes translatable friendly error messages
 */
export async function runIngestOperation<T extends keyof IngestJobFunc>(
	studioId: StudioId,
	name: T,
	data: Parameters<IngestJobFunc[T]>[0]
): Promise<ReturnType<IngestJobFunc[T]>> {
	try {
		const job = await QueueIngestJob(name, studioId, data)

		const span = profiler.startSpan('queued-job')
		const res = await job.complete
		span?.end()

		// TODO - track timings
		// console.log(await job.getTimings)

		return res
	} catch (e) {
		logger.error(`Ingest operation "${name}" failed: ${e.toString()}`)

		throw e
	}
}

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

export function getRundownId(studio: ReadonlyDeep<Studio> | StudioId, rundownExternalId: string): RundownId {
	if (!studio) throw new Meteor.Error(500, 'getRundownId: studio not set!')
	if (!rundownExternalId) throw new Meteor.Error(401, 'getRundownId: rundownExternalId must be set!')
	return protectString<RundownId>(getHash(`${isProtectedString(studio) ? studio : studio._id}_${rundownExternalId}`))
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

export function getStudioFromDevice(peripheralDevice: PeripheralDevice): Studio {
	const span = profiler.startSpan('mosDevice.lib.getStudioFromDevice')

	const studioId = getStudioIdFromDevice(peripheralDevice)
	if (!studioId) throw new Meteor.Error(500, 'PeripheralDevice "' + peripheralDevice._id + '" has no Studio')

	updateDeviceLastDataReceived(peripheralDevice._id)

	const studio = Studios.findOne(studioId)
	if (!studio) throw new Meteor.Error(404, `Studio "${studioId}" of device "${peripheralDevice._id}" not found`)

	span?.end()
	return studio
}
export function getRundown(cache: ReadOnlyCache<CacheForIngest> | CacheForIngest): ReadonlyDeep<Rundown> {
	const rundown = cache.Rundown.doc
	if (!rundown) {
		const rundownId = getRundownId(cache.Studio.doc, cache.RundownExternalId)
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
	if (device.category !== PeripheralDeviceCategory.INGEST)
		throw new Meteor.Error(
			404,
			`PeripheralDevice "${rundown.peripheralDeviceId}" of rundown "${rundown._id}" is not an INGEST device!`
		)
	return device
}

function updateDeviceLastDataReceived(deviceId: PeripheralDeviceId) {
	PeripheralDevices.update(deviceId, {
		$set: {
			lastDataReceived: getCurrentTime(),
		},
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
