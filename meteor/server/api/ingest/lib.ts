import { Meteor } from 'meteor/meteor'
import { getHash, getCurrentTime, protectString, stringifyError } from '../../../lib/lib'
import {
	PeripheralDevice,
	PeripheralDevices,
	getStudioIdFromDevice,
	PeripheralDeviceCategory,
} from '../../../lib/collections/PeripheralDevices'
import { Rundown } from '../../../lib/collections/Rundowns'
import { logger } from '../../logging'
import { PeripheralDeviceContentWriteAccess } from '../../security/peripheralDevice'
import { MethodContext } from '../../../lib/api/methods'
import { Credentials } from '../../security/lib/credentials'
import { profiler } from '../profiler'
import { IngestJobFunc } from '@sofie-automation/corelib/dist/worker/ingest'
import { QueueIngestJob } from '../../worker/worker'
import { checkStudioExists } from '../../../lib/collections/optimizations'
import {
	PartId,
	PeripheralDeviceId,
	RundownId,
	SegmentId,
	StudioId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'

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

		if (span) {
			// These timings may want tracking better, for when APM is not enabled
			try {
				const timings = await job.getTimings
				span.addLabels({
					startedTime: timings.startedTime ? timings.startedTime - timings.queueTime : '-',
					finishedTime: timings.finishedTime ? timings.finishedTime - timings.queueTime : '-',
					completedTime: timings.completedTime - timings.queueTime,
				})
			} catch (_e) {
				// Not worth handling
			}

			span.end()
		}

		return res
	} catch (e) {
		logger.warn(`Ingest operation "${name}" failed: ${stringifyError(e)}`)

		throw e
	}
}

/** Check Access and return PeripheralDevice, throws otherwise */
export async function checkAccessAndGetPeripheralDevice(
	deviceId: PeripheralDeviceId,
	token: string | undefined,
	context: Credentials | MethodContext
): Promise<PeripheralDevice> {
	const span = profiler.startSpan('lib.checkAccessAndGetPeripheralDevice')

	const { device: peripheralDevice } = await PeripheralDeviceContentWriteAccess.peripheralDevice(
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

export async function fetchStudioIdFromDevice(peripheralDevice: PeripheralDevice): Promise<StudioId> {
	const span = profiler.startSpan('mosDevice.lib.getStudioIdFromDevice')

	const studioId = await getStudioIdFromDevice(peripheralDevice)
	if (!studioId) throw new Meteor.Error(500, 'PeripheralDevice "' + peripheralDevice._id + '" has no Studio')

	updateDeviceLastDataReceived(peripheralDevice._id)

	const studioExists = await checkStudioExists(studioId)
	if (!studioExists) throw new Meteor.Error(404, `Studio "${studioId}" of device "${peripheralDevice._id}" not found`)

	span?.end()
	return studioId
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
	PeripheralDevices.updateAsync(deviceId, {
		$set: {
			lastDataReceived: getCurrentTime(),
		},
	}).catch((err) => {
		logger.error(`Error in updateDeviceLastDataReceived "${deviceId}": ${err}`)
	})
}
