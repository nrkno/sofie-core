import '../../../../../__mocks__/_extendJest'
import { Meteor } from 'meteor/meteor'

import { MOS } from '@sofie-automation/corelib'
import { setupDefaultStudioEnvironment } from '../../../../../__mocks__/helpers/database'
import { testInFiber } from '../../../../../__mocks__/helpers/jest'
import { PeripheralDevice } from '../../../../../lib/collections/PeripheralDevices'
import { MOSDeviceActions } from '../actions'
import {
	PeripheralDeviceCommands,
	PeripheralDeviceCommand,
} from '../../../../../lib/collections/PeripheralDeviceCommands'
import { TriggerReloadDataResponse } from '../../../../../lib/api/userActions'
import { getRandomId, getRandomString, literal } from '@sofie-automation/corelib/dist/lib'
import { PeripheralDeviceCommandId, RundownId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { CreateFakeResult, QueueIngestJobSpy } from '../../../../../__mocks__/worker'
import { IngestJobs, MosRundownProps } from '@sofie-automation/corelib/dist/worker/ingest'

function fakeMinimalRo() {
	return literal<MOS.IMOSRunningOrder>({
		ID: new MOS.MosString128('SLENPS01;P_NDSL\\W;68E40DE6-2D08-487D-aaaaa'),
		Slug: new MOS.MosString128('All effect1 into clip combinations'),
		EditorialStart: new MOS.MosTime('2018-11-07T07:00:00,000Z'),
		EditorialDuration: new MOS.MosDuration('0:9:0'),
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
		observer = PeripheralDeviceCommands.find({ deviceId: device._id }).observeChanges({
			added: (id: PeripheralDeviceCommandId) => {
				const cmd = PeripheralDeviceCommands.findOne(id) as PeripheralDeviceCommand
				expect(cmd).toBeTruthy()
				expect(cmd.functionName).toEqual('triggerGetRunningOrder')
				expect(cmd.args).toEqual([fakeRundown.externalId])

				PeripheralDeviceCommands.update(cmd._id, {
					$set: {
						replyError: 'unknown annoying error',
						hasReply: true,
					},
				})
			},
		})

		await expect(MOSDeviceActions.reloadRundown(device, fakeRundown)).rejects.toMatch(`unknown annoying error`)
	})

	testInFiber('reloadRundown: valid payload', async () => {
		// setLogLevel(LogLevel.DEBUG)

		const roData = fakeMinimalRo()
		roData.Slug = new MOS.MosString128('new name')

		const rundownId: RundownId = getRandomId()
		const fakeRundown = { _id: rundownId, externalId: roData.ID.toString(), studioId: studioId }

		// Listen for changes
		observer = PeripheralDeviceCommands.find({ deviceId: device._id }).observeChanges({
			added: (id: PeripheralDeviceCommandId) => {
				const cmd = PeripheralDeviceCommands.findOne(id) as PeripheralDeviceCommand
				expect(cmd).toBeTruthy()
				expect(cmd.functionName).toEqual('triggerGetRunningOrder')
				expect(cmd.args).toEqual([fakeRundown.externalId])

				PeripheralDeviceCommands.update(cmd._id, {
					$set: {
						reply: roData,
						hasReply: true,
					},
				})
			},
		})

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
				isCreateAction: false,
				mosRunningOrder: roData,
			})
		)
	})

	testInFiber('reloadRundown: receive incorrect response rundown id', async () => {
		// setLogLevel(LogLevel.DEBUG)

		const roData = fakeMinimalRo()

		const rundownId: RundownId = getRandomId()
		const fakeRundown = { _id: rundownId, externalId: roData.ID.toString(), studioId: studioId }

		// Listen for changes
		observer = PeripheralDeviceCommands.find({ deviceId: device._id }).observeChanges({
			added: (id: PeripheralDeviceCommandId) => {
				const cmd = PeripheralDeviceCommands.findOne(id) as PeripheralDeviceCommand
				expect(cmd).toBeTruthy()
				expect(cmd.functionName).toEqual('triggerGetRunningOrder')
				expect(cmd.args).toEqual([fakeRundown.externalId])

				roData.ID = new MOS.MosString128('newId')

				PeripheralDeviceCommands.update(cmd._id, {
					$set: {
						reply: roData,
						hasReply: true,
					},
				})
			},
		})

		await expect(MOSDeviceActions.reloadRundown(device, fakeRundown)).rejects.toThrowMeteor(
			401,
			`Expected triggerGetRunningOrder reply for SLENPS01;P_NDSL\\W;68E40DE6-2D08-487D-aaaaa but got newId`
		)
	})
})
