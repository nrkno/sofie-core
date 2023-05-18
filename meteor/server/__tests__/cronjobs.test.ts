import '../../__mocks__/_extendJest'
import { testInFiber, runAllTimers, beforeAllInFiber } from '../../__mocks__/helpers/jest'
import { MeteorMock } from '../../__mocks__/meteor'
import { logger } from '../logging'
import { getRandomId, getRandomString, protectString } from '../../lib/lib'
import { SnapshotType } from '../../lib/collections/Snapshots'
import { IBlueprintPieceType, PieceLifespan, StatusCode, TSR } from '@sofie-automation/blueprints-integration'
import { PeripheralDeviceType, PeripheralDeviceCategory } from '../../lib/collections/PeripheralDevices'
import { SYSTEM_ID } from '../../lib/collections/CoreSystem'
import * as lib from '../../lib/lib'
import { DBPart } from '../../lib/collections/Parts'
import { PartInstance } from '../../lib/collections/PartInstances'
import { PieceInstance } from '../../lib/collections/PieceInstances'
import { Meteor } from 'meteor/meteor'
import { EmptyPieceTimelineObjectsBlob } from '@sofie-automation/corelib/dist/dataModel/Piece'
import {
	IngestDataCacheObjId,
	PartId,
	PeripheralDeviceId,
	RundownId,
	SegmentId,
	SnapshotId,
	UserActionsLogItemId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'

// Set up mocks for tests in this suite
let mockCurrentTime = 0
let origGetCurrentTime
jest.mock('../logging')
// we don't want the deviceTriggers observer to start up at this time
jest.mock('../api/deviceTriggers/observer')

import '../cronjobs'

import '../api/peripheralDevice'
import {
	CoreSystem,
	IngestDataCache,
	PartInstances,
	Parts,
	PeripheralDeviceCommands,
	PeripheralDevices,
	PieceInstances,
	Snapshots,
	UserActionsLog,
	Segments,
} from '../collections'
import { IngestCacheType } from '@sofie-automation/corelib/dist/dataModel/IngestDataCache'
import { JSONBlobStringify } from '@sofie-automation/shared-lib/dist/lib/JSONBlob'
import {
	DefaultEnvironment,
	setupDefaultRundownPlaylist,
	setupDefaultStudioEnvironment,
} from '../../__mocks__/helpers/database'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { Settings } from '../../lib/Settings'

async function waitForCronjobDone() {
	// Run timers, so that all promises in the cronjob has a chance to resolve:

	// Note: call these multiple times, since the cronjob handles a LOT of promises in series.
	await runAllTimers()
	await runAllTimers()
	await runAllTimers()
	await runAllTimers()
}
describe('cronjobs', () => {
	let env: DefaultEnvironment
	let rundownId: RundownId

	beforeAllInFiber(async () => {
		env = await setupDefaultStudioEnvironment()

		const o = await setupDefaultRundownPlaylist(env)
		rundownId = o.rundownId

		await CoreSystem.updateAsync(
			{},
			{
				$set: {
					'cron.casparCGRestart.enabled': true,
				},
			}
		)

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
	afterAll(async () => {
		//@ts-ignore Return getCurrentTime to orig
		lib.getCurrentTime = origGetCurrentTime
		await CoreSystem.removeAsync(SYSTEM_ID)
	})
	describe('Runs at the appropriate time', () => {
		testInFiber("Doesn't run during the day", async () => {
			// set time to 2020/07/19 12:00 Local Time
			mockCurrentTime = new Date(2020, 6, 19, 12, 0, 0).getTime()
			// cronjob is checked every 5 minutes, so advance 6 minutes
			jest.advanceTimersByTime(6 * 60 * 1000)
			expect(lib.getCurrentTime).toHaveBeenCalled()
			await waitForCronjobDone()

			expect(logger.info).toHaveBeenCalledTimes(0)
		})
		testInFiber("Runs at 4 o'clock", async () => {
			// set time to 2020/07/20 04:05 Local Time, should be more than 24 hours after 2020/07/19 00:00 UTC
			mockCurrentTime = new Date(2020, 6, 20, 4, 5, 0).getTime()
			// cronjob is checked every 5 minutes, so advance 6 minutes
			jest.advanceTimersByTime(6 * 60 * 1000)
			expect(lib.getCurrentTime).toHaveBeenCalled()
			await waitForCronjobDone()

			expect(logger.info).toHaveBeenLastCalledWith('Nightly cronjob: done')
		})
		testInFiber("Doesn't run if less than 20 hours have passed since last run", async () => {
			// set time to 2020/07/21 04:05 Local Time, should be more than 24 hours after 2020/07/19 00:00 UTC
			mockCurrentTime = new Date(2020, 6, 21, 4, 5, 0).getTime()
			// cronjob is checked every 5 minutes, so advance 6 minutes
			jest.advanceTimersByTime(6 * 60 * 1000)
			expect(lib.getCurrentTime).toHaveBeenCalled()
			await waitForCronjobDone()
			expect(logger.info).toHaveBeenLastCalledWith('Nightly cronjob: done')

			// clear the mock
			;(logger.info as jest.Mock).mockClear()

			mockCurrentTime = new Date(2020, 6, 20, 4, 50, 0).getTime()
			jest.advanceTimersByTime(6 * 60 * 1000)
			await waitForCronjobDone()
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
			await waitForCronjobDone()
			expect(logger.info).toHaveBeenLastCalledWith('Nightly cronjob: done')
		}

		testInFiber('Remove IngestDataCache objects that are not connected to any Rundown', async () => {
			// Set up a mock rundown, a detached IngestDataCache object and an object attached to the mock rundown
			// Detached IngestDataCache object 0
			const dataCache0Id = protectString<IngestDataCacheObjId>(getRandomString())
			await IngestDataCache.mutableCollection.insertAsync({
				_id: dataCache0Id,
				data: {
					externalId: '',
					name: '',
					segments: [],
					type: '',
				},
				modified: new Date(2000, 0, 1, 0, 0, 0).getTime(),
				// this one is attached to rundown0
				rundownId: getRandomId(),
				type: IngestCacheType.RUNDOWN,
			})
			// Attached IngestDataCache object 1
			const dataCache1Id = protectString<IngestDataCacheObjId>(getRandomString())
			await IngestDataCache.mutableCollection.insertAsync({
				_id: dataCache1Id,
				data: {
					externalId: '',
					name: '',
					segments: [],
					type: '',
				},
				modified: new Date(2000, 0, 1, 0, 0, 0).getTime(),
				// just some random ID
				rundownId: rundownId,
				type: IngestCacheType.RUNDOWN,
			})

			await runCronjobs()

			expect(await IngestDataCache.findOneAsync(dataCache1Id)).toMatchObject({
				_id: dataCache1Id,
			})
			expect(await IngestDataCache.findOneAsync(dataCache0Id)).toBeUndefined()
		})
		testInFiber('Removes old PartInstances and PieceInstances', async () => {
			// nightlyCronjobInner()

			const segment0: DBSegment = {
				_id: getRandomId<SegmentId>(),
				_rank: 0,
				externalId: '',
				externalModified: 0,
				rundownId,
				name: 'mock segment',
			}
			await Segments.mutableCollection.insertAsync(segment0)

			const part0: DBPart = {
				_id: getRandomId<PartId>(),
				_rank: 0,
				rundownId: rundownId,
				segmentId: segment0._id,
				externalId: '',
				title: '',
				expectedDurationWithPreroll: undefined,
			}
			await Parts.mutableCollection.insertAsync(part0)
			const part1: DBPart = {
				_id: getRandomId<PartId>(),
				_rank: 1,
				rundownId: getRandomId<RundownId>(), // non-existent
				segmentId: getRandomId<SegmentId>(), // non-existent
				externalId: '',
				title: '',
				expectedDurationWithPreroll: undefined,
			}
			await Parts.mutableCollection.insertAsync(part1)

			const partInstance0: PartInstance = {
				_id: protectString(`${part0._id}_${getRandomId()}`),
				rundownId: part0.rundownId,
				segmentId: part0.segmentId,
				takeCount: 1,
				rehearsal: false,
				isTemporary: false,
				part: part0,
				reset: true,
				timings: {
					plannedStoppedPlayback: lib.getCurrentTime() - 1000 * 3600 * 24 * 51,
				},
				playlistActivationId: protectString(''),
				segmentPlayoutId: protectString(''),
			}
			await PartInstances.mutableCollection.insertAsync(partInstance0)

			const partInstance1: PartInstance = {
				_id: protectString(`${part0._id}_${getRandomId()}`),
				rundownId: part0.rundownId,
				segmentId: part0.segmentId,
				takeCount: 1,
				rehearsal: false,
				isTemporary: false,
				part: part0,
				playlistActivationId: protectString(''),
				segmentPlayoutId: protectString(''),
			}
			await PartInstances.mutableCollection.insertAsync(partInstance1)

			const partInstance2: PartInstance = {
				_id: protectString(`${part0._id}_${getRandomId()}`),
				rundownId: part1.rundownId,
				segmentId: part1.segmentId,
				takeCount: 1,
				rehearsal: false,
				isTemporary: false,
				part: part1,
				reset: true,
				timings: {
					plannedStoppedPlayback: lib.getCurrentTime() - 1000 * 3600 * 24 * 51,
				},
				playlistActivationId: protectString(''),
				segmentPlayoutId: protectString(''),
			}
			await PartInstances.mutableCollection.insertAsync(partInstance2)

			const pieceInstance0: PieceInstance = {
				_id: protectString(`${partInstance0._id}_piece0`),
				rundownId: partInstance0.part.rundownId,
				partInstanceId: partInstance0._id,
				piece: {
					_id: protectString(`${partInstance0._id}_piece_inner1`),
					startPartId: partInstance2.part._id,
					content: {},
					timelineObjectsString: EmptyPieceTimelineObjectsBlob,
					externalId: '',
					name: 'abc',
					sourceLayerId: '',
					outputLayerId: '',
					status: -1,
					enable: { start: 0 },
					lifespan: PieceLifespan.OutOnSegmentChange,
					invalid: false,
					pieceType: IBlueprintPieceType.Normal,
				},
				playlistActivationId: protectString(''),
			}
			const pieceInstance1: PieceInstance = {
				_id: protectString(`${partInstance2._id}_piece0`),
				rundownId: partInstance2.part.rundownId,
				partInstanceId: partInstance2._id,
				piece: {
					_id: protectString(`${partInstance2._id}_piece_inner1`),
					startPartId: partInstance2.part._id,
					content: {},
					timelineObjectsString: EmptyPieceTimelineObjectsBlob,
					externalId: '',
					name: 'abc',
					sourceLayerId: '',
					outputLayerId: '',
					status: -1,
					enable: { start: 0 },
					lifespan: PieceLifespan.OutOnSegmentChange,
					invalid: false,
					pieceType: IBlueprintPieceType.Normal,
				},
				playlistActivationId: protectString(''),
			}
			await PieceInstances.mutableCollection.insertAsync(pieceInstance0)
			await PieceInstances.mutableCollection.insertAsync(pieceInstance1)
			await runCronjobs()

			expect(await Parts.findOneAsync(part0._id)).toBeDefined()
			expect(await Parts.findOneAsync(part1._id)).toBeUndefined() // Removed, since owned by non-existent rundown

			expect(await PartInstances.findOneAsync(partInstance0._id)).toBeDefined()
			expect(await PartInstances.findOneAsync(partInstance1._id)).toBeDefined()
			expect(await PartInstances.findOneAsync(partInstance2._id)).toBeUndefined() // Removed, since owned by non-existent part1
			expect(await PieceInstances.findOneAsync(pieceInstance0._id)).toBeDefined()
			expect(await PieceInstances.findOneAsync(pieceInstance1._id)).toBeUndefined() // Removed, since owned by non-existent partInstance2
		})
		testInFiber('Removes old entries in UserActionsLog', async () => {
			// reasonably fresh entry
			const userAction0 = protectString<UserActionsLogItemId>(getRandomString())
			await UserActionsLog.insertAsync({
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
			const userAction1 = protectString<UserActionsLogItemId>(getRandomString())
			await UserActionsLog.insertAsync({
				_id: userAction1,
				organizationId: null,
				userId: null,
				args: '',
				clientAddress: '',
				context: '',
				method: '',
				timestamp: lib.getCurrentTime() - Settings.maximumDataAge - 1000,
			})

			await runCronjobs()

			expect(await UserActionsLog.findOneAsync(userAction0)).toMatchObject({
				_id: userAction0,
			})
			expect(await UserActionsLog.findOneAsync(userAction1)).toBeUndefined()
		})
		testInFiber('Removes old entries in Snapshots', async () => {
			// reasonably fresh entry
			const snapshot0 = protectString<SnapshotId>(getRandomString())
			await Snapshots.insertAsync({
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
			const snapshot1 = protectString<SnapshotId>(getRandomString())
			await Snapshots.insertAsync({
				_id: snapshot1,
				organizationId: null,
				comment: '',
				fileName: '',
				name: '',
				type: SnapshotType.DEBUG,
				version: '',
				// Very old:
				created: lib.getCurrentTime() - Settings.maximumDataAge - 1000,
			})

			await runCronjobs()

			expect(await Snapshots.findOneAsync(snapshot0)).toMatchObject({
				_id: snapshot0,
			})
			expect(await Snapshots.findOneAsync(snapshot1)).toBeUndefined()
		})
		testInFiber('Attempts to restart CasparCG when job is enabled', async () => {
			const mockPlayoutGw = protectString<PeripheralDeviceId>(getRandomString())
			await PeripheralDevices.insertAsync({
				_id: mockPlayoutGw,
				organizationId: null,
				type: PeripheralDeviceType.PLAYOUT,
				category: PeripheralDeviceCategory.PLAYOUT,
				deviceName: 'Playout Gateway',
				configManifest: {
					deviceConfigSchema: JSONBlobStringify({}),
					subdeviceManifest: {},
				},
				connected: true,
				connectionId: '',
				created: 0,
				lastConnected: 0,
				lastSeen: 0,
				name: 'Playout gateway',
				status: {
					statusCode: StatusCode.GOOD,
				},
				subType: TSR.DeviceType.ABSTRACT,
				token: '',
				settings: {},
			})
			const mockCasparCg = protectString<PeripheralDeviceId>(getRandomString())
			await PeripheralDevices.insertAsync({
				_id: mockCasparCg,
				organizationId: null,
				parentDeviceId: mockPlayoutGw,
				type: PeripheralDeviceType.PLAYOUT,
				category: PeripheralDeviceCategory.PLAYOUT,
				subType: TSR.DeviceType.CASPARCG,
				deviceName: 'CasparCG',
				configManifest: {
					deviceConfigSchema: JSONBlobStringify({}),
					subdeviceManifest: {},
				},
				connected: true,
				connectionId: '',
				created: 0,
				lastConnected: 0,
				lastSeen: 0,
				name: 'CasparCG',
				status: {
					statusCode: StatusCode.GOOD,
				},
				token: '',
				settings: {},
			})
			const mockATEM = protectString<PeripheralDeviceId>(getRandomString())
			await PeripheralDevices.insertAsync({
				_id: mockATEM,
				organizationId: null,
				parentDeviceId: mockPlayoutGw,
				type: PeripheralDeviceType.PLAYOUT,
				category: PeripheralDeviceCategory.PLAYOUT,
				subType: TSR.DeviceType.ATEM,
				deviceName: 'ATEM',
				configManifest: {
					deviceConfigSchema: JSONBlobStringify({}),
					subdeviceManifest: {},
				},
				connected: true,
				connectionId: '',
				created: 0,
				lastConnected: 0,
				lastSeen: 0,
				name: 'ATEM',
				status: {
					statusCode: StatusCode.GOOD,
				},
				token: '',
				settings: {},
			})
			;(logger.info as jest.Mock).mockClear()
			// set time to 2020/07/{date} 04:05 Local Time, should be more than 24 hours after 2020/07/19 00:00 UTC
			mockCurrentTime = new Date(2020, 6, date++, 4, 5, 0).getTime()
			// cronjob is checked every 5 minutes, so advance 6 minutes
			jest.advanceTimersByTime(6 * 60 * 1000)
			await waitForCronjobDone()

			// check if the correct PeripheralDevice command has been issued, and only for CasparCG devices
			const pendingCommands = await PeripheralDeviceCommands.findFetchAsync({})
			expect(pendingCommands).toHaveLength(1)
			expect(pendingCommands[0]).toMatchObject({
				deviceId: mockCasparCg,
				actionId: 'restartServer',
			})

			// Emulate that the restart was successful:
			pendingCommands.forEach((cmd) => {
				Meteor.call(
					'peripheralDevice.functionReply',
					cmd.deviceId, // deviceId
					'', // deviceToken
					cmd._id, // commandId
					null, // err
					null // result
				)
			})

			await waitForCronjobDone()
			// make sure that the cronjob ends
			expect(logger.info).toHaveBeenLastCalledWith('Nightly cronjob: done')
		})
		testInFiber('Does not attempt to restart CasparCG when job is disabled', async () => {
			const mockPlayoutGw = protectString<PeripheralDeviceId>(getRandomString())
			await PeripheralDevices.insertAsync({
				_id: mockPlayoutGw,
				organizationId: null,
				type: PeripheralDeviceType.PLAYOUT,
				category: PeripheralDeviceCategory.PLAYOUT,
				deviceName: 'Playout Gateway',
				configManifest: {
					deviceConfigSchema: JSONBlobStringify({}),
					subdeviceManifest: {},
				},
				connected: true,
				connectionId: '',
				created: 0,
				lastConnected: 0,
				lastSeen: 0,
				name: 'Playout gateway',
				status: {
					statusCode: StatusCode.GOOD,
				},
				subType: TSR.DeviceType.ABSTRACT,
				token: '',
				settings: {},
			})
			const mockCasparCg = protectString<PeripheralDeviceId>(getRandomString())
			await PeripheralDevices.insertAsync({
				_id: mockCasparCg,
				organizationId: null,
				parentDeviceId: mockPlayoutGw,
				type: PeripheralDeviceType.PLAYOUT,
				category: PeripheralDeviceCategory.PLAYOUT,
				subType: TSR.DeviceType.CASPARCG,
				deviceName: 'CasparCG',
				configManifest: {
					deviceConfigSchema: JSONBlobStringify({}),
					subdeviceManifest: {},
				},
				connected: true,
				connectionId: '',
				created: 0,
				lastConnected: 0,
				lastSeen: 0,
				name: 'CasparCG',
				status: {
					statusCode: StatusCode.GOOD,
				},
				token: '',
				settings: {},
			})
			const mockATEM = protectString<PeripheralDeviceId>(getRandomString())
			await PeripheralDevices.insertAsync({
				_id: mockATEM,
				organizationId: null,
				parentDeviceId: mockPlayoutGw,
				type: PeripheralDeviceType.PLAYOUT,
				category: PeripheralDeviceCategory.PLAYOUT,
				subType: TSR.DeviceType.ATEM,
				deviceName: 'ATEM',
				configManifest: {
					deviceConfigSchema: JSONBlobStringify({}),
					subdeviceManifest: {},
				},
				connected: true,
				connectionId: '',
				created: 0,
				lastConnected: 0,
				lastSeen: 0,
				name: 'ATEM',
				status: {
					statusCode: StatusCode.GOOD,
				},
				token: '',
				settings: {},
			})
			await CoreSystem.updateAsync(
				{},
				{
					$set: {
						'cron.casparCGRestart.enabled': false,
					},
				}
			)
			;(logger.info as jest.Mock).mockClear()
			// set time to 2020/07/{date} 04:05 Local Time, should be more than 24 hours after 2020/07/19 00:00 UTC
			mockCurrentTime = new Date(2020, 6, date++, 4, 5, 0).getTime()
			// cronjob is checked every 5 minutes, so advance 6 minutes
			jest.advanceTimersByTime(6 * 60 * 1000)
			jest.runOnlyPendingTimers()

			// check if the no PeripheralDevice command have been issued
			const pendingCommands = await PeripheralDeviceCommands.findFetchAsync({})
			expect(pendingCommands).toHaveLength(0)

			await waitForCronjobDone()
			// make sure that the cronjob ends
			expect(logger.info).toHaveBeenLastCalledWith('Nightly cronjob: done')
		})
	})
})
