import { Meteor } from 'meteor/meteor'
import '../../__mocks__/_extendJest'
import { testInFiber, runAllTimers, testInFiberOnly, beforeAllInFiber } from '../../__mocks__/helpers/jest'
import { MeteorMock, useControllableDefer } from '../../__mocks__/meteor'
import { logger } from '../logging'
import { IngestDataCache, IngestCacheType, IngestDataCacheObjId } from '../../lib/collections/IngestDataCache'
import { Random } from 'meteor/random'
import { protectString } from '../../lib/lib'
import { Rundowns, RundownId } from '../../lib/collections/Rundowns'
import { AsRunLog, AsRunLogEventId } from '../../lib/collections/AsRunLog'
import { UserActionsLog, UserActionsLogItemId } from '../../lib/collections/UserActionsLog'
import { Snapshots, SnapshotId, SnapshotType } from '../../lib/collections/Snapshots'
import { IBlueprintAsRunLogEventContent, TSR } from 'tv-automation-sofie-blueprints-integration'
import { PeripheralDeviceCommands } from '../../lib/collections/PeripheralDeviceCommands'
import { PeripheralDevices, PeripheralDeviceId } from '../../lib/collections/PeripheralDevices'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import * as lib from '../../lib/lib'

// Set up mocks for tests in this suite
let mockCurrentTime = 0
let origGetCurrentTime
jest.mock('../logging')

import '../cronjobs'

describe('cronjobs', () => {
	beforeAllInFiber(() => {
		jest.useFakeTimers()
		// set time to 2020/07/19 00:00 Local Time
		mockCurrentTime = new Date(2020, 6, 19, 0, 0, 0).getTime()
		MeteorMock.mockRunMeteorStartup()
		origGetCurrentTime = lib.getCurrentTime
		//@ts-ignore Mock getCurrentTime for tests
		lib.getCurrentTime = jest.fn(() => {
			return mockCurrentTime
		})
	})
	afterAll(() => {
		//@ts-ignore Return getCurrentTime to orig
		lib.getCurrentTime = origGetCurrentTime
	})
	describe('Runs at the appropriate time', () => {
		testInFiber("Doesn't run during the day", () => {
			// set time to 2020/07/19 12:00 Local Time
			mockCurrentTime = new Date(2020, 6, 19, 12, 0, 0).getTime()
			// cronjob is checked every 5 minutes, so advance 6 minutes
			jest.advanceTimersByTime(6 * 60 * 1000)
			expect(lib.getCurrentTime).toHaveBeenCalled()
			expect(logger.info).toHaveBeenCalledTimes(0)
		})
		testInFiber("Runs at 4 o'clock", async () => {
			// set time to 2020/07/20 04:05 Local Time, should be more than 24 hours after 2020/07/19 00:00 UTC
			mockCurrentTime = new Date(2020, 6, 20, 4, 5, 0).getTime()
			// cronjob is checked every 5 minutes, so advance 6 minutes
			jest.advanceTimersByTime(6 * 60 * 1000)
			expect(lib.getCurrentTime).toHaveBeenCalled()
			await runAllTimers()
			expect(logger.info).toHaveBeenLastCalledWith('Nightly cronjob: done')
		})
		testInFiber("Doesn't run if less than 20 hours have passed since last run", async () => {
			// set time to 2020/07/21 04:05 Local Time, should be more than 24 hours after 2020/07/19 00:00 UTC
			mockCurrentTime = new Date(2020, 6, 21, 4, 5, 0).getTime()
			// cronjob is checked every 5 minutes, so advance 6 minutes
			jest.advanceTimersByTime(6 * 60 * 1000)
			expect(lib.getCurrentTime).toHaveBeenCalled()
			await runAllTimers()
			expect(logger.info).toHaveBeenLastCalledWith('Nightly cronjob: done')

			// clear the mock
			;(logger.info as jest.Mock).mockClear()

			mockCurrentTime = new Date(2020, 6, 20, 4, 50, 0).getTime()
			jest.advanceTimersByTime(6 * 60 * 1000)
			await runAllTimers()
			// less than 24 hours have passed so we do not expect the cronjob to run
			expect(logger.info).toHaveBeenCalledTimes(0)
		})
	})
	describe('Does appropriate cron actions', () => {
		let date = 23
		async function runCronjobs() {
			;(logger.info as jest.Mock).mockClear()
			// set time to 2020/07/{date} 04:05 Local Time, should be more than 24 hours after 2020/07/19 00:00 UTC
			mockCurrentTime = new Date(2020, 6, date++, 4, 5, 0).getTime()
			// cronjob is checked every 5 minutes, so advance 6 minutes
			jest.advanceTimersByTime(6 * 60 * 1000)
			await runAllTimers()
			expect(logger.info).toHaveBeenLastCalledWith('Nightly cronjob: done')
		}

		testInFiber('Remove IngestDataCache objects that are not connected to any Rundown', async () => {
			// Set up a mock rundown, a detached IngestDataCache object and an object attached to the mock rundown
			const rundown0Id = protectString<RundownId>(Random.id())
			// Mock Rundown 0
			Rundowns.insert({
				_id: rundown0Id,
				_rank: 0,
				created: lib.getCurrentTime() - 1000 * 3600 * 24 * 3,
				organizationId: null,
				dataSource: '',
				externalId: '',
				importVersions: {
					blueprint: '',
					core: '',
					showStyleBase: '',
					showStyleVariant: '',
					studio: '',
				},
				modified: lib.getCurrentTime() - 1000 * 3600 * 24 * 3,
				name: 'Mock Rundown 0',
				peripheralDeviceId: protectString(''),
				playlistId: protectString(''),
				showStyleBaseId: protectString(''),
				showStyleVariantId: protectString(''),
				studioId: protectString(''),
				externalNRCSName: 'mock',
			})
			// Detached IngestDataCache object 0
			const dataCache0Id = protectString<IngestDataCacheObjId>(Random.id())
			IngestDataCache.insert({
				_id: dataCache0Id,
				data: {
					externalId: '',
					name: '',
					segments: [],
					type: '',
				},
				modified: new Date(2000, 0, 1, 0, 0, 0).getTime(),
				// this one is attached to rundown0
				rundownId: protectString(Random.id()),
				type: IngestCacheType.RUNDOWN,
			})
			// Attached IngestDataCache object 1
			const dataCache1Id = protectString<IngestDataCacheObjId>(Random.id())
			IngestDataCache.insert({
				_id: dataCache1Id,
				data: {
					externalId: '',
					name: '',
					segments: [],
					type: '',
				},
				modified: new Date(2000, 0, 1, 0, 0, 0).getTime(),
				// just some random ID
				rundownId: rundown0Id,
				type: IngestCacheType.RUNDOWN,
			})

			await runCronjobs()

			expect(IngestDataCache.findOne(dataCache1Id)).toMatchObject({
				_id: dataCache1Id,
			})
			expect(IngestDataCache.findOne(dataCache0Id)).toBeUndefined()
		})
		testInFiber('Removes old entries in AsRunLong', async () => {
			// reasonably fresh entry
			const asRunLog0 = protectString<AsRunLogEventId>(Random.id())
			AsRunLog.insert({
				_id: asRunLog0,
				content: IBlueprintAsRunLogEventContent.STARTEDPLAYBACK,
				rehersal: false,
				rundownId: protectString(''),
				studioId: protectString(''),
				// 3 days old
				timestamp: lib.getCurrentTime() - 1000 * 3600 * 24 * 3,
			})
			// stale entry
			const asRunLog1 = protectString<AsRunLogEventId>(Random.id())
			AsRunLog.insert({
				_id: asRunLog1,
				content: IBlueprintAsRunLogEventContent.STARTEDPLAYBACK,
				rehersal: false,
				rundownId: protectString(''),
				studioId: protectString(''),
				// 50 + 1 minute days old
				timestamp: lib.getCurrentTime() - (1000 * 3600 * 24 * 50 + 1000 * 60),
			})

			await runCronjobs()

			expect(AsRunLog.findOne(asRunLog0)).toMatchObject({
				_id: asRunLog0,
			})
			expect(AsRunLog.findOne(asRunLog1)).toBeUndefined()
		})
		testInFiber('Removes old entries in UserActionsLog', async () => {
			// reasonably fresh entry
			const userAction0 = protectString<UserActionsLogItemId>(Random.id())
			UserActionsLog.insert({
				_id: userAction0,
				organizationId: null,
				userId: null,
				args: '',
				clientAddress: '',
				context: '',
				method: '',
				// 3 days old
				timestamp: lib.getCurrentTime() - 1000 * 3600 * 24 * 3,
			})
			// stale entry
			const userAction1 = protectString<UserActionsLogItemId>(Random.id())
			UserActionsLog.insert({
				_id: userAction1,
				organizationId: null,
				userId: null,
				args: '',
				clientAddress: '',
				context: '',
				method: '',
				// 50 + 1 minute days old
				timestamp: lib.getCurrentTime() - (1000 * 3600 * 24 * 50 + 1000 * 60),
			})

			await runCronjobs()

			expect(UserActionsLog.findOne(userAction0)).toMatchObject({
				_id: userAction0,
			})
			expect(UserActionsLog.findOne(userAction1)).toBeUndefined()
		})
		testInFiber('Removes old entries in Snapshots', async () => {
			// reasonably fresh entry
			const snapshot0 = protectString<SnapshotId>(Random.id())
			Snapshots.insert({
				_id: snapshot0,
				organizationId: null,
				comment: '',
				fileName: '',
				name: '',
				type: SnapshotType.DEBUG,
				version: '',
				// 3 days old
				created: lib.getCurrentTime() - 1000 * 3600 * 24 * 3,
			})
			// stale entry
			const snapshot1 = protectString<SnapshotId>(Random.id())
			Snapshots.insert({
				_id: snapshot1,
				organizationId: null,
				comment: '',
				fileName: '',
				name: '',
				type: SnapshotType.DEBUG,
				version: '',
				// 50 + 1 minute days old
				created: lib.getCurrentTime() - (1000 * 3600 * 24 * 50 + 1000 * 60),
			})

			await runCronjobs()

			expect(Snapshots.findOne(snapshot0)).toMatchObject({
				_id: snapshot0,
			})
			expect(Snapshots.findOne(snapshot1)).toBeUndefined()
		})
		testInFiber('Attempts to restart CasparCG', async () => {
			const mockPlayoutGw = protectString<PeripheralDeviceId>(Random.id())
			PeripheralDevices.insert({
				_id: mockPlayoutGw,
				organizationId: null,
				type: PeripheralDeviceAPI.DeviceType.PLAYOUT,
				category: PeripheralDeviceAPI.DeviceCategory.PLAYOUT,
				configManifest: {
					deviceConfig: [],
				},
				connected: true,
				connectionId: '',
				created: 0,
				lastConnected: 0,
				lastSeen: 0,
				name: 'Playout gateway',
				status: {
					statusCode: PeripheralDeviceAPI.StatusCode.GOOD,
				},
				subType: TSR.DeviceType.ABSTRACT,
				token: '',
			})
			const mockCasparCg = protectString<PeripheralDeviceId>(Random.id())
			PeripheralDevices.insert({
				_id: mockCasparCg,
				organizationId: null,
				parentDeviceId: mockPlayoutGw,
				type: PeripheralDeviceAPI.DeviceType.PLAYOUT,
				category: PeripheralDeviceAPI.DeviceCategory.PLAYOUT,
				subType: TSR.DeviceType.CASPARCG,
				configManifest: {
					deviceConfig: [],
				},
				connected: true,
				connectionId: '',
				created: 0,
				lastConnected: 0,
				lastSeen: 0,
				name: 'CasparCG',
				status: {
					statusCode: PeripheralDeviceAPI.StatusCode.GOOD,
				},
				token: '',
			})
			const mockATEM = protectString<PeripheralDeviceId>(Random.id())
			PeripheralDevices.insert({
				_id: mockATEM,
				organizationId: null,
				parentDeviceId: mockPlayoutGw,
				type: PeripheralDeviceAPI.DeviceType.PLAYOUT,
				category: PeripheralDeviceAPI.DeviceCategory.PLAYOUT,
				subType: TSR.DeviceType.ATEM,
				configManifest: {
					deviceConfig: [],
				},
				connected: true,
				connectionId: '',
				created: 0,
				lastConnected: 0,
				lastSeen: 0,
				name: 'ATEM',
				status: {
					statusCode: PeripheralDeviceAPI.StatusCode.GOOD,
				},
				token: '',
			})
			;(logger.info as jest.Mock).mockClear()
			// set time to 2020/07/{date} 04:05 Local Time, should be more than 24 hours after 2020/07/19 00:00 UTC
			mockCurrentTime = new Date(2020, 6, date++, 4, 5, 0).getTime()
			// cronjob is checked every 5 minutes, so advance 6 minutes
			jest.advanceTimersByTime(6 * 60 * 1000)
			jest.runOnlyPendingTimers()

			// check if the correct PeripheralDevice command has been issued, and only for CasparCG devices
			const pendingCommands = PeripheralDeviceCommands.find({}).fetch()
			expect(pendingCommands).toHaveLength(1)
			expect(pendingCommands[0]).toMatchObject({
				deviceId: mockCasparCg,
				functionName: 'restartCasparCG',
			})

			await runAllTimers()
			// make sure that the cronjob ends
			expect(logger.info).toHaveBeenLastCalledWith('Nightly cronjob: done')
		})
	})
})
