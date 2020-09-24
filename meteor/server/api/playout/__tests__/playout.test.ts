import _ from 'underscore'
import { Meteor } from 'meteor/meteor'
import '../../../../__mocks__/_extendJest'
import { testInFiber, testInFiberOnly, runAllTimers } from '../../../../__mocks__/helpers/jest'
import { fixSnapshot } from '../../../../__mocks__/helpers/snapshot'
import { mockupCollection, resetMockupCollection } from '../../../../__mocks__/helpers/lib'
import {
	setupDefaultStudioEnvironment,
	DefaultEnvironment,
	setupDefaultRundownPlaylist,
	setupMockPeripheralDevice,
	setupRundownWithAutoplayPart0,
} from '../../../../__mocks__/helpers/database'
import { Rundowns, Rundown } from '../../../../lib/collections/Rundowns'
import '../api'
import { Timeline as OrgTimeline } from '../../../../lib/collections/Timeline'
import { ServerPlayoutAPI } from '../playout'
import { deactivate } from '../../userActions'
import { RundownPlaylists, RundownPlaylist } from '../../../../lib/collections/RundownPlaylists'
import { PeripheralDevice } from '../../../../lib/collections/PeripheralDevices'
import { PeripheralDeviceCommands } from '../../../../lib/collections/PeripheralDeviceCommands'
import { Pieces } from '../../../../lib/collections/Pieces'
import { AdLibPieces } from '../../../../lib/collections/AdLibPieces'
import { PeripheralDeviceAPI } from '../../../../lib/api/peripheralDevice'
import { MethodContext } from '../../../../lib/api/methods'
import { PartInstances, PartInstanceId } from '../../../../lib/collections/PartInstances'
import { IngestActions } from '../../ingest/actions'
import { TriggerReloadDataResponse } from '../../../../lib/api/userActions'
import { protectString } from '../../../../lib/lib'
import { AsRunLog } from '../../../../lib/collections/AsRunLog'
import { IBlueprintAsRunLogEventContent } from 'tv-automation-sofie-blueprints-integration'
import { Random } from 'meteor/random'
import { PieceInstances } from '../../../../lib/collections/PieceInstances'
import * as lib from '../../../../lib/lib'
import { ClientAPI } from '../../../../lib/api/client'

const DEFAULT_CONTEXT: MethodContext = {
	userId: null,
	isSimulation: false,
	connection: {
		id: 'mockConnectionId',
		close: () => {},
		onClose: () => {},
		clientAddress: '127.0.0.1',
		httpHeaders: {},
	},
	setUserId: () => {},
	unblock: () => {},
}

describe('Playout API', () => {
	let env: DefaultEnvironment
	let playoutDevice: PeripheralDevice
	const origGetCurrentTime = lib.getCurrentTime

	function getPeripheralDeviceCommands(playoutDevice: PeripheralDevice) {
		return PeripheralDeviceCommands.find({ deviceId: playoutDevice._id }, { sort: { time: 1 } }).fetch()
	}
	function clearPeripheralDeviceCommands(playoutDevice: PeripheralDevice) {
		return PeripheralDeviceCommands.remove({ deviceId: playoutDevice._id })
	}
	function getAllRundownData(rundown: Rundown) {
		return {
			parts: rundown.getParts(),
			segments: rundown.getSegments(),
			rundown: Rundowns.findOne(rundown._id) as Rundown,
			pieces: Pieces.find({ rundown: rundown._id }, { sort: { _id: 1 } }).fetch(),
			adLibPieces: AdLibPieces.find({ rundown: rundown._id }, { sort: { _id: 1 } }).fetch(),
		}
	}
	function getAllPartInstances() {
		return PartInstances.find({}).fetch()
	}
	function getAllPieceInstancesForPartInstance(partInstanceId: PartInstanceId) {
		return PieceInstances.find({
			partInstanceId: partInstanceId,
		}).fetch()
	}
	let Timeline = mockupCollection(OrgTimeline)
	beforeAll(() => {
		Timeline = mockupCollection(OrgTimeline)
	})
	beforeEach(() => {
		env = setupDefaultStudioEnvironment()
		playoutDevice = setupMockPeripheralDevice(
			PeripheralDeviceAPI.DeviceCategory.PLAYOUT,
			PeripheralDeviceAPI.DeviceType.PLAYOUT,
			PeripheralDeviceAPI.SUBTYPE_PROCESS,
			env.studio
		)
		// @ts-ignore
		Timeline.insert.mockClear()
		// @ts-ignore
		Timeline.upsert.mockClear()
		// @ts-ignore
		Timeline.update.mockClear()

		jest.clearAllMocks()
	})
	afterEach(() => {
		//@ts-ignore restore getCurrentTime to original
		lib.getCurrentTime = origGetCurrentTime
	})
	afterAll(() => {
		// Clean up after ourselves:
		resetMockupCollection(OrgTimeline)
	})
	testInFiber('Basic rundown control', () => {
		const { rundownId: rundownId0, playlistId: playlistId0 } = setupDefaultRundownPlaylist(env)
		expect(rundownId0).toBeTruthy()
		expect(playlistId0).toBeTruthy()

		const getRundown0 = () => {
			return Rundowns.findOne(rundownId0) as Rundown
		}
		const getPlaylist0 = () => {
			return RundownPlaylists.findOne(playlistId0) as RundownPlaylist
		}
		const parts = getRundown0().getParts()

		expect(getPlaylist0()).toMatchObject({
			active: false,
			rehearsal: false,
		})

		expect(Timeline.insert).not.toHaveBeenCalled()
		expect(Timeline.upsert).not.toHaveBeenCalled()
		expect(Timeline.update).not.toHaveBeenCalled()

		ServerPlayoutAPI.resetRundownPlaylist(DEFAULT_CONTEXT, playlistId0)
		const orgRundownData = getAllRundownData(getRundown0())

		{
			expect(() => {
				ServerPlayoutAPI.activateRundownPlaylist(DEFAULT_CONTEXT, protectString('fake_id'), true)
			}).toThrowError(/not found/gi)
		}

		{
			// Prepare and activate:
			ServerPlayoutAPI.activateRundownPlaylist(DEFAULT_CONTEXT, playlistId0, false)

			const { currentPartInstance, nextPartInstance } = getPlaylist0().getSelectedPartInstances()
			expect(currentPartInstance).toBeFalsy()
			expect(nextPartInstance).toBeTruthy()
			expect(nextPartInstance!.part._id).toEqual(parts[0]._id)

			expect(getPlaylist0()).toMatchObject({
				active: true,
				rehearsal: false,
				currentPartInstanceId: null,
				// nextPartInstanceId: parts[0]._id,
			})
		}

		expect(Timeline.insert).toHaveBeenCalled()
		expect(Timeline.upsert).toHaveBeenCalled()
		expect(Timeline.update).toHaveBeenCalled()
		Timeline.mockClear()

		{
			expect(() => {
				ServerPlayoutAPI.takeNextPart(DEFAULT_CONTEXT, protectString('fake_id'))
			}).toThrowError(/not found/gi)
		}

		{
			// Take the first Part:
			ServerPlayoutAPI.takeNextPart(DEFAULT_CONTEXT, playlistId0)

			const { currentPartInstance, nextPartInstance } = getPlaylist0().getSelectedPartInstances()
			expect(currentPartInstance).toBeTruthy()
			expect(nextPartInstance).toBeTruthy()
			expect(currentPartInstance!.part._id).toEqual(parts[0]._id)
			expect(nextPartInstance!.part._id).toEqual(parts[1]._id)
		}

		// expect(Timeline.insert).toHaveBeenCalled() - complete replacement of timeline with single object
		expect(Timeline.upsert).toHaveBeenCalled()
		expect(Timeline.update).toHaveBeenCalled()
		Timeline.mockClear()

		expect(fixSnapshot(Timeline.find().fetch())).toMatchSnapshot()
		expect(fixSnapshot(getRundown0())).toMatchSnapshot()

		expect(() => {
			ServerPlayoutAPI.resetRundownPlaylist(DEFAULT_CONTEXT, playlistId0)
		}).toThrowError(/resetRundown can only be run in rehearsal/gi)

		// Deactivate rundown:
		ServerPlayoutAPI.deactivateRundownPlaylist(DEFAULT_CONTEXT, playlistId0)
		expect(getPlaylist0()).toMatchObject({
			active: false,
			currentPartInstanceId: null,
			nextPartInstanceId: null,
		})

		expect(fixSnapshot(Timeline.find().fetch())).toMatchSnapshot()
		expect(fixSnapshot(getPlaylist0())).toMatchSnapshot()
		expect(fixSnapshot(getRundown0())).toMatchSnapshot()

		// expect(Timeline.insert).toHaveBeenCalled() - complete replacement of timeline with single object
		expect(Timeline.upsert).toHaveBeenCalled()
		expect(Timeline.update).toHaveBeenCalled()

		// lastly: reset rundown
		ServerPlayoutAPI.resetRundownPlaylist(DEFAULT_CONTEXT, playlistId0)

		expect(() => {
			ServerPlayoutAPI.resetRundownPlaylist(DEFAULT_CONTEXT, protectString('fake_id'))
		}).toThrowError(/not found/gi)

		// Verify that the data is back to as it was before any of the operations:
		const rundownData = getAllRundownData(getRundown0())
		expect(rundownData).toEqual(orgRundownData)
	})
	testInFiber('prepareRundownPlaylistForBroadcast', () => {
		const { rundownId: rundownId0, playlistId: playlistId0 } = setupDefaultRundownPlaylist(env)
		expect(rundownId0).toBeTruthy()
		expect(playlistId0).toBeTruthy()

		const getRundown0 = () => {
			return Rundowns.findOne(rundownId0) as Rundown
		}
		const getPlaylist0 = () => {
			return RundownPlaylists.findOne(playlistId0) as RundownPlaylist
		}

		expect(getPlaylist0()).toMatchObject({
			active: false,
			rehearsal: false,
		})

		expect(getPeripheralDeviceCommands(playoutDevice)).toHaveLength(0)

		expect(() => {
			ServerPlayoutAPI.prepareRundownPlaylistForBroadcast(DEFAULT_CONTEXT, protectString('fake_id'))
		}).toThrowError(/not found/gi)

		// Prepare and activate in rehersal:
		ServerPlayoutAPI.prepareRundownPlaylistForBroadcast(DEFAULT_CONTEXT, playlistId0)

		expect(getPlaylist0()).toMatchObject({
			active: true,
			rehearsal: true,
		})

		expect(getPeripheralDeviceCommands(playoutDevice)).toHaveLength(1)
		expect(getPeripheralDeviceCommands(playoutDevice)[0]).toMatchObject({
			functionName: 'devicesMakeReady',
		})

		expect(() => {
			ServerPlayoutAPI.prepareRundownPlaylistForBroadcast(DEFAULT_CONTEXT, playlistId0)
		}).toThrowError(/cannot be run on an active/i)

		const { playlistId: playlistId1 } = setupDefaultRundownPlaylist(env)
		expect(() => {
			ServerPlayoutAPI.prepareRundownPlaylistForBroadcast(DEFAULT_CONTEXT, playlistId1)
		}).toThrowError(/only one [\w\s]+ can be active at the same time/i)
	})
	testInFiber(
		'resetAndActivateRundownPlaylist, forceResetAndActivateRundownPlaylist & deactivateRundownPlaylist',
		() => {
			const { rundownId: rundownId0, playlistId: playlistId0 } = setupDefaultRundownPlaylist(env)
			const { rundownId: rundownId1, playlistId: playlistId1 } = setupDefaultRundownPlaylist(env)
			expect(rundownId0).toBeTruthy()
			expect(playlistId0).toBeTruthy()
			expect(rundownId1).toBeTruthy()
			expect(playlistId1).toBeTruthy()

			const getRundown0 = () => {
				return Rundowns.findOne(rundownId0) as Rundown
			}
			const getPlaylist0 = () => {
				return RundownPlaylists.findOne(playlistId0) as RundownPlaylist
			}
			const getRundown1 = () => {
				return Rundowns.findOne(rundownId1) as Rundown
			}
			const getPlaylist1 = () => {
				return RundownPlaylists.findOne(playlistId1) as RundownPlaylist
			}

			expect(getPlaylist0()).toMatchObject({
				active: false,
				rehearsal: false,
			})
			expect(getPlaylist1()).toMatchObject({
				active: false,
				rehearsal: false,
			})

			expect(getPeripheralDeviceCommands(playoutDevice)).toHaveLength(0)

			expect(() => {
				ServerPlayoutAPI.resetAndActivateRundownPlaylist(DEFAULT_CONTEXT, protectString('fake_id'), true)
			}).toThrowError(/not found/gi)

			// Prepare and activate in rehersal:
			ServerPlayoutAPI.resetAndActivateRundownPlaylist(DEFAULT_CONTEXT, playlistId0, true)

			expect(getPlaylist0()).toMatchObject({
				active: true,
				rehearsal: true,
			})
			expect(getPlaylist1()).toMatchObject({
				active: false,
			})

			expect(getPeripheralDeviceCommands(playoutDevice)).toHaveLength(1)
			expect(getPeripheralDeviceCommands(playoutDevice)[0]).toMatchObject({
				functionName: 'devicesMakeReady',
			})

			{
				// Take the first Part:
				ServerPlayoutAPI.takeNextPart(DEFAULT_CONTEXT, playlistId0)

				const { currentPartInstance, nextPartInstance } = getPlaylist0().getSelectedPartInstances()
				expect(currentPartInstance).toBeTruthy()
				expect(nextPartInstance).toBeTruthy()
			}

			expect(() => {
				ServerPlayoutAPI.forceResetAndActivateRundownPlaylist(DEFAULT_CONTEXT, protectString('fake_id'), true)
			}).toThrowError(/not found/gi)

			ServerPlayoutAPI.forceResetAndActivateRundownPlaylist(DEFAULT_CONTEXT, playlistId1, true)
			expect(getPlaylist0()).toMatchObject({
				active: false,
			})
			expect(getPlaylist1()).toMatchObject({
				active: true,
				rehearsal: true,
			})

			expect(getPeripheralDeviceCommands(playoutDevice)).toHaveLength(2)
			expect(getPeripheralDeviceCommands(playoutDevice)[1]).toMatchObject({
				functionName: 'devicesMakeReady',
			})

			// Attempt to take the first Part of inactive playlist0, should throw
			expect(() => {
				ServerPlayoutAPI.takeNextPart(DEFAULT_CONTEXT, playlistId0)
			}).toThrowError(/is not active/gi)

			// Take the first Part of active playlist1:
			ServerPlayoutAPI.takeNextPart(DEFAULT_CONTEXT, playlistId1)

			expect(
				getAllPartInstances().filter(
					(partInstance) =>
						partInstance.rundownId === rundownId1 && !!partInstance.isTaken && !partInstance.reset
				)
			).toHaveLength(1)
			expect(
				getAllPartInstances().filter(
					(partInstance) =>
						partInstance.rundownId === rundownId1 && !partInstance.isTaken && !partInstance.reset
				)
			).toHaveLength(1)

			ServerPlayoutAPI.resetAndActivateRundownPlaylist(DEFAULT_CONTEXT, playlistId1, true)

			// Take the first Part of active playlist1 again:
			ServerPlayoutAPI.takeNextPart(DEFAULT_CONTEXT, playlistId1)

			// still should only contain a single taken instance, as rehearsal partInstances should be removed
			expect(
				getAllPartInstances().filter(
					(partInstance) =>
						partInstance.rundownId === rundownId1 && !!partInstance.isTaken && !partInstance.reset
				)
			).toHaveLength(1)
			expect(
				getAllPartInstances().filter(
					(partInstance) =>
						partInstance.rundownId === rundownId1 && !partInstance.isTaken && !partInstance.reset
				)
			).toHaveLength(1)

			ServerPlayoutAPI.resetAndActivateRundownPlaylist(DEFAULT_CONTEXT, playlistId1, false)

			// Take the first Part of active playlist1 once more:
			ServerPlayoutAPI.takeNextPart(DEFAULT_CONTEXT, playlistId1)

			// should throw with 402 code, as resetting the rundown when active is forbidden, with default configuration
			expect(() => {
				ServerPlayoutAPI.resetAndActivateRundownPlaylist(DEFAULT_CONTEXT, playlistId1, false)
			}).toThrowError(/cannot be run when active/gi)

			ServerPlayoutAPI.deactivateRundownPlaylist(DEFAULT_CONTEXT, playlistId1)

			expect(() => {
				ServerPlayoutAPI.deactivateRundownPlaylist(DEFAULT_CONTEXT, protectString('fake_id'))
			}).toThrowError(/not found/gi)

			ServerPlayoutAPI.resetAndActivateRundownPlaylist(DEFAULT_CONTEXT, playlistId1, false)

			ServerPlayoutAPI.takeNextPart(DEFAULT_CONTEXT, playlistId1)

			// should contain one not-reset taken instance
			expect(
				getAllPartInstances().filter(
					(partInstance) =>
						partInstance.rundownId === rundownId1 && !partInstance.reset && partInstance.isTaken
				)
			).toHaveLength(1)
		}
	)
	testInFiber('reloadRundownPlaylistData', async () => {
		// mock reloadRundown for test
		const origReloadRundown = IngestActions.reloadRundown
		IngestActions.reloadRundown = jest.fn(() => TriggerReloadDataResponse.COMPLETED)

		expect(() => {
			ServerPlayoutAPI.reloadRundownPlaylistData(DEFAULT_CONTEXT, protectString('fake_id'))
		}).toThrowError(/not found/gi)

		const { rundownId: rundownId0, playlistId: playlistId0 } = setupDefaultRundownPlaylist(env)
		ServerPlayoutAPI.reloadRundownPlaylistData(DEFAULT_CONTEXT, playlistId0)

		expect(IngestActions.reloadRundown).toHaveBeenCalled()
		expect((IngestActions.reloadRundown as jest.Mock).mock.calls[0][0]).toMatchObject({
			_id: rundownId0,
		})

		IngestActions.reloadRundown = origReloadRundown
	})
	testInFiber(
		'onPartPlaybackStarted, onPiecePlaybackStarted, onPartPlaybackStopped, onPiecePlaybackStopped',
		async () => {
			const TIME_RANDOM = 5
			const { rundownId: rundownId0, playlistId: playlistId0 } = setupDefaultRundownPlaylist(
				env,
				undefined,
				setupRundownWithAutoplayPart0
			)
			expect(rundownId0).toBeTruthy()
			expect(playlistId0).toBeTruthy()

			const getRundown0 = () => {
				return Rundowns.findOne(rundownId0) as Rundown
			}
			const getPlaylist0 = () => {
				return RundownPlaylists.findOne(playlistId0) as RundownPlaylist
			}

			// Prepare and activate in rehersal:
			ServerPlayoutAPI.resetAndActivateRundownPlaylist(DEFAULT_CONTEXT, playlistId0, true)

			expect(getPlaylist0()).toMatchObject({
				active: true,
				rehearsal: true,
			})

			const parts = getPlaylist0().getAllOrderedParts()

			// just any time, such as 2020-01-01 12:00:00
			let now = new Date(2020, 0, 1, 12, 0, 0).getTime()

			//@ts-ignore set up a mock for this test
			lib.getCurrentTime = jest.fn(() => {
				return now
			})

			{
				// Take the first Part:
				ServerPlayoutAPI.takeNextPart(DEFAULT_CONTEXT, playlistId0)

				const { currentPartInstance, nextPartInstance } = getPlaylist0().getSelectedPartInstances()
				expect(currentPartInstance).toBeTruthy()
				expect(nextPartInstance).toBeTruthy()
				expect(currentPartInstance?.part._id).toBe(parts[0]._id)
				expect(currentPartInstance?.part.autoNext).toBe(true) // the current part should autonext
				expect(currentPartInstance?.part.expectedDuration).toBeGreaterThan(0)
				expect(nextPartInstance?.part._id).toBe(parts[1]._id)

				// simulate TSR starting part playback
				const currentPartInstanceId = currentPartInstance?._id || protectString('')
				ServerPlayoutAPI.onPartPlaybackStarted(DEFAULT_CONTEXT, playlistId0, currentPartInstanceId, now)

				// simulate TSR starting each piece
				const pieceInstances = getAllPieceInstancesForPartInstance(currentPartInstanceId)
				expect(pieceInstances).toHaveLength(2)
				pieceInstances.forEach((pieceInstance) =>
					ServerPlayoutAPI.onPiecePlaybackStarted(
						DEFAULT_CONTEXT,
						playlistId0,
						pieceInstance._id,
						false,
						(_.isNumber(pieceInstance.piece.enable.start) ? now + pieceInstance.piece.enable.start : now) +
							Math.random() * TIME_RANDOM
					)
				)
			}

			{
				// the rundown timings are set
				const playlist = getPlaylist0()
				expect(playlist.startedPlayback).toBe(now)

				// the currentPartInstance timings are set
				const { currentPartInstance } = playlist.getSelectedPartInstances()
				expect(currentPartInstance?.timings?.startedPlayback).toBe(now)

				// AsRunLog is updated
				const entry0 = AsRunLog.find({
					studioId: env.studio._id,
					rundownId: rundownId0,
					segmentId: currentPartInstance?.part.segmentId,
					partInstanceId: currentPartInstance?._id,
					content: IBlueprintAsRunLogEventContent.STARTEDPLAYBACK,
					content2: 'part',
				}).fetch()
				expect(entry0[0]).toMatchObject({
					timestamp: now,
				})

				const entry1 = AsRunLog.find({
					studioId: env.studio._id,
					rundownId: rundownId0,
					content: IBlueprintAsRunLogEventContent.STARTEDPLAYBACK,
					content2: 'rundown',
				}).fetch()
				expect(entry1[0]).toMatchObject({
					timestamp: now,
				})

				// Check that AsRunLog contains piece started playback entries
				const pieceInstances = getAllPieceInstancesForPartInstance(currentPartInstance!._id)
				expect(pieceInstances).toHaveLength(2)
				pieceInstances.forEach((pieceInstance) => {
					const entry = AsRunLog.find({
						studioId: env.studio._id,
						rundownId: rundownId0,
						segmentId: currentPartInstance?.part.segmentId,
						partInstanceId: currentPartInstance?._id,
						pieceInstanceId: pieceInstance._id,
						content: IBlueprintAsRunLogEventContent.STARTEDPLAYBACK,
						content2: 'piece',
					}).fetch()
					expect(entry).toHaveLength(1)
					expect(entry[0].timestamp).toBeWithinRange(now, now + TIME_RANDOM)
				})
			}

			{
				// the piece instances timings are set
				const { currentPartInstance } = getPlaylist0().getSelectedPartInstances()
				const pieceInstances = getAllPieceInstancesForPartInstance(currentPartInstance?._id!)
				expect(pieceInstances).toHaveLength(2)
				pieceInstances.forEach((pieceInstance) => {
					expect(pieceInstance.startedPlayback).toBeTruthy()
					expect(pieceInstance.startedPlayback).toBeWithinRange(now, now + TIME_RANDOM)
				})
			}

			{
				const nowBuf = now
				const { currentPartInstance } = getPlaylist0().getSelectedPartInstances()
				now += currentPartInstance?.part.expectedDuration! - 500
				// try to take just before an autonext
				const response = ServerPlayoutAPI.takeNextPart(DEFAULT_CONTEXT, playlistId0)
				expect(response).toBeTruthy()
				expect((response as ClientAPI.ClientResponseError).message).toMatch(/cannot take shortly before/gi)
				now = nowBuf
			}

			{
				// simulate an autonext
				const {
					currentPartInstance: currentPartInstanceBeforeTake,
					nextPartInstance: nextPartInstanceBeforeTake,
				} = getPlaylist0().getSelectedPartInstances()
				const currentPartInstanceBeforeTakeId = currentPartInstanceBeforeTake?._id
				const nextPartInstanceBeforeTakeId = nextPartInstanceBeforeTake?._id

				now += currentPartInstanceBeforeTake?.part.expectedDuration!
				ServerPlayoutAPI.onPartPlaybackStarted(DEFAULT_CONTEXT, playlistId0, nextPartInstanceBeforeTakeId!, now)
				ServerPlayoutAPI.onPartPlaybackStopped(
					DEFAULT_CONTEXT,
					playlistId0,
					currentPartInstanceBeforeTakeId!,
					now
				)
				const pieceInstances = getAllPieceInstancesForPartInstance(currentPartInstanceBeforeTakeId!)
				expect(pieceInstances).toHaveLength(2)
				pieceInstances.forEach((pieceInstance) =>
					ServerPlayoutAPI.onPiecePlaybackStopped(
						DEFAULT_CONTEXT,
						playlistId0,
						pieceInstance._id,
						false,
						(_.isNumber(pieceInstance.piece.enable.start) ? now + pieceInstance.piece.enable.start : now) +
							Math.random() * TIME_RANDOM
					)
				)

				const {
					currentPartInstance: currentPartInstanceAfterTake,
					nextPartInstance: nextPartInstanceAfterTake,
				} = getPlaylist0().getSelectedPartInstances()
				expect(currentPartInstanceAfterTake).toBeTruthy()
				expect(currentPartInstanceAfterTake?.part._id).toBe(parts[1]._id)
				expect(nextPartInstanceAfterTake).toBeTruthy()
				expect(nextPartInstanceAfterTake?.part._id).toBe(parts[2]._id)

				const previousPartInstanceAfterTake = PartInstances.findOne(currentPartInstanceBeforeTakeId)
				expect(previousPartInstanceAfterTake).toBeTruthy()
				expect(previousPartInstanceAfterTake?.timings?.stoppedPlayback).toBe(now)

				// verify AsRunLog is updated
				const entry = AsRunLog.find({
					studioId: env.studio._id,
					rundownId: rundownId0,
					segmentId: previousPartInstanceAfterTake?.part.segmentId,
					partInstanceId: previousPartInstanceAfterTake?._id,
					content: IBlueprintAsRunLogEventContent.STOPPEDPLAYBACK,
					content2: 'part',
				}).fetch()
				expect(entry[0]).toMatchObject({
					timestamp: now,
				})

				// Check that AsRunLog contains piece started playback entries
				pieceInstances.forEach((pieceInstance) => {
					const entry = AsRunLog.find({
						studioId: env.studio._id,
						rundownId: rundownId0,
						segmentId: previousPartInstanceAfterTake?.part.segmentId,
						partInstanceId: previousPartInstanceAfterTake?._id,
						pieceInstanceId: pieceInstance._id,
						content: IBlueprintAsRunLogEventContent.STOPPEDPLAYBACK,
						content2: 'piece',
					}).fetch()
					expect(entry).toHaveLength(1)
					expect(entry[0].timestamp).toBeWithinRange(now, now + TIME_RANDOM)
				})
			}
		}
	)
	testInFiber('moveNextPart', async () => {
		const { rundownId: rundownId0, playlistId: playlistId0 } = setupDefaultRundownPlaylist(
			env,
			undefined,
			setupRundownWithAutoplayPart0
		)
		expect(rundownId0).toBeTruthy()
		expect(playlistId0).toBeTruthy()

		const getRundown0 = () => {
			return Rundowns.findOne(rundownId0) as Rundown
		}
		const getPlaylist0 = () => {
			return RundownPlaylists.findOne(playlistId0) as RundownPlaylist
		}
		const parts = getPlaylist0().getAllOrderedParts()

		// Prepare and activate in rehersal:
		ServerPlayoutAPI.resetAndActivateRundownPlaylist(DEFAULT_CONTEXT, playlistId0, true)

		{
			// expect first part to be selected as next
			const { currentPartInstance, nextPartInstance } = getPlaylist0().getSelectedPartInstances()
			expect(currentPartInstance).toBeFalsy()
			expect(getPlaylist0()).toMatchObject({
				active: true,
				rehearsal: true,
			})
			expect(nextPartInstance?.part._id).toBe(parts[0]._id)
		}

		{
			// move horizontally +1
			ServerPlayoutAPI.moveNextPart(DEFAULT_CONTEXT, playlistId0, 1, 0, true)
			const { nextPartInstance } = getPlaylist0().getSelectedPartInstances()
			// expect second part to be selected as next
			expect(nextPartInstance?.part._id).toBe(parts[1]._id)
		}

		{
			// move horizontally -1
			ServerPlayoutAPI.moveNextPart(DEFAULT_CONTEXT, playlistId0, -1, 0, true)
			const { nextPartInstance } = getPlaylist0().getSelectedPartInstances()
			// expect first part to be selected as next
			expect(nextPartInstance?.part._id).toBe(parts[0]._id)
		}

		{
			// move vertically +1
			ServerPlayoutAPI.moveNextPart(DEFAULT_CONTEXT, playlistId0, 0, 1, true)
			const { nextPartInstance } = getPlaylist0().getSelectedPartInstances()
			// expect 3rd part to be selected as next
			expect(nextPartInstance?.part._id).toBe(parts[2]._id)
		}

		{
			// move vertically -1
			ServerPlayoutAPI.moveNextPart(DEFAULT_CONTEXT, playlistId0, 0, -1, true)
			const { nextPartInstance } = getPlaylist0().getSelectedPartInstances()
			// expect 1st part to be selected as next
			expect(nextPartInstance?.part._id).toBe(parts[0]._id)
		}
	})
})
