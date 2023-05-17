import '../../../../../__mocks__/_extendJest'
import { Meteor } from 'meteor/meteor'

import * as MOS from '@mos-connection/helper'
import { setupDefaultStudioEnvironment } from '../../../../../__mocks__/helpers/database'
import { testInFiber } from '../../../../../__mocks__/helpers/jest'
import { PeripheralDevice } from '../../../../../lib/collections/PeripheralDevices'
import { MOSDeviceActions } from '../actions'
import { PeripheralDeviceCommand } from '../../../../../lib/collections/PeripheralDeviceCommands'
import { TriggerReloadDataResponse } from '../../../../../lib/api/userActions'
import { deferAsync, getRandomId, getRandomString, literal, stringifyError } from '@sofie-automation/corelib/dist/lib'
import { PeripheralDeviceCommandId, RundownId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { CreateFakeResult, QueueIngestJobSpy } from '../../../../../__mocks__/worker'
import { IngestJobs, MosRundownProps } from '@sofie-automation/corelib/dist/worker/ingest'
import { PeripheralDeviceCommands } from '../../../../collections'
import { SupressLogMessages } from '../../../../../__mocks__/suppressLogging'
import { logger } from '../../../../logging'

const mosTypes = MOS.getMosTypes(true)

function fakeMinimalRo() {
	return literal<MOS.IMOSRunningOrder>({
		ID: mosTypes.mosString128.create('SLENPS01;P_NDSL\\W;68E40DE6-2D08-487D-aaaaa'),
		Slug: mosTypes.mosString128.create('All effect1 into clip combinations'),
		EditorialStart: mosTypes.mosTime.create('2018-11-07T07:00:00,000Z'),
		EditorialDuration: mosTypes.mosDuration.create('0:9:0'),
		MosExternalMetaData: [],
		Stories: [],
	})
}

describe('Test sending mos actions', () => {
	let device: PeripheralDevice
	let studioId: StudioId
	let observer: Meteor.LiveQueryHandle | null = null
	beforeAll(async () => {
		const env = await setupDefaultStudioEnvironment()
		device = env.ingestDevice
		studioId = env.studio._id
	})
	afterEach(() => {
		if (observer != null) {
			observer.stop()
			observer = null
		}
	})

	testInFiber('reloadRundown: expect error', async () => {
		// setLogLevel(LogLevel.DEBUG)

		const rundownId: RundownId = getRandomId()
		const fakeRundown = { _id: rundownId, externalId: getRandomString(), studioId: studioId }

		// Listen for changes
		observer = PeripheralDeviceCommands.observeChanges(
			{ deviceId: device._id },
			{
				added: (id: PeripheralDeviceCommandId) => {
					deferAsync(
						async () => {
							const cmd = (await PeripheralDeviceCommands.findOneAsync(id)) as PeripheralDeviceCommand
							expect(cmd).toBeTruthy()
							expect(cmd.functionName).toEqual('triggerGetRunningOrder')
							expect(cmd.args).toEqual([fakeRundown.externalId])

							SupressLogMessages.suppressLogMessage(/unknown annoying error/i)
							await PeripheralDeviceCommands.updateAsync(cmd._id, {
								$set: {
									replyError: 'unknown annoying error',
									hasReply: true,
								},
							})
						},
						(e) => logger.error(stringifyError(e))
					)
				},
			}
		)

		await expect(MOSDeviceActions.reloadRundown(device, fakeRundown)).rejects.toMatch(`unknown annoying error`)
	})

	testInFiber('reloadRundown: valid payload', async () => {
		// setLogLevel(LogLevel.DEBUG)

		const roData = fakeMinimalRo()
		roData.Slug = mosTypes.mosString128.create('new name')

		const rundownId: RundownId = getRandomId()
		const fakeRundown = {
			_id: rundownId,
			externalId: mosTypes.mosString128.stringify(roData.ID),
			studioId: studioId,
		}

		// Listen for changes
		observer = PeripheralDeviceCommands.observeChanges(
			{ deviceId: device._id },
			{
				added: (id: PeripheralDeviceCommandId) => {
					deferAsync(
						async () => {
							const cmd = (await PeripheralDeviceCommands.findOneAsync(id)) as PeripheralDeviceCommand
							expect(cmd).toBeTruthy()
							expect(cmd.functionName).toEqual('triggerGetRunningOrder')
							expect(cmd.args).toEqual([fakeRundown.externalId])

							await PeripheralDeviceCommands.updateAsync(cmd._id, {
								$set: {
									reply: roData,
									hasReply: true,
								},
							})
						},
						(e) => logger.error(stringifyError(e))
					)
				},
			}
		)

		QueueIngestJobSpy.mockImplementation(async () => CreateFakeResult(Promise.resolve()))
		expect(QueueIngestJobSpy).toHaveBeenCalledTimes(0)

		await expect(MOSDeviceActions.reloadRundown(device, fakeRundown)).resolves.toEqual(
			TriggerReloadDataResponse.WORKING
		)

		expect(QueueIngestJobSpy).toHaveBeenCalledTimes(1)
		expect(QueueIngestJobSpy).toHaveBeenLastCalledWith(
			IngestJobs.MosRundown,
			fakeRundown.studioId,
			literal<MosRundownProps>({
				rundownExternalId: fakeRundown.externalId,
				peripheralDeviceId: device._id,
				isUpdateOperation: true,
				mosRunningOrder: roData,
			})
		)
	})

	testInFiber('reloadRundown: receive incorrect response rundown id', async () => {
		// setLogLevel(LogLevel.DEBUG)

		const roData = fakeMinimalRo()

		const rundownId: RundownId = getRandomId()
		const fakeRundown = {
			_id: rundownId,
			externalId: mosTypes.mosString128.stringify(roData.ID),
			studioId: studioId,
		}

		// Listen for changes
		observer = PeripheralDeviceCommands.observeChanges(
			{ deviceId: device._id },
			{
				added: (id: PeripheralDeviceCommandId) => {
					deferAsync(
						async () => {
							const cmd = (await PeripheralDeviceCommands.findOneAsync(id)) as PeripheralDeviceCommand
							expect(cmd).toBeTruthy()
							expect(cmd.functionName).toEqual('triggerGetRunningOrder')
							expect(cmd.args).toEqual([fakeRundown.externalId])

							roData.ID = mosTypes.mosString128.create('newId')

							await PeripheralDeviceCommands.updateAsync(cmd._id, {
								$set: {
									reply: roData,
									hasReply: true,
								},
							})
						},
						(e) => logger.error(stringifyError(e))
					)
				},
			}
		)

		SupressLogMessages.suppressLogMessage(/Error in MOSDeviceActions\.reloadRundown/i)
		await expect(MOSDeviceActions.reloadRundown(device, fakeRundown)).rejects.toThrowMeteor(
			401,
			`Expected triggerGetRunningOrder reply for SLENPS01;P_NDSL\\W;68E40DE6-2D08-487D-aaaaa but got newId`
		)
	})
})
