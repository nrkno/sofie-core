import { Meteor } from 'meteor/meteor'
import '../../../../__mocks__/_extendJest'
import { testInFiber } from '../../../../__mocks__/helpers/jest'
import { fixSnapshot } from '../../../../__mocks__/helpers/snapshot'
import { mockupCollection } from '../../../../__mocks__/helpers/lib'
import {
	setupDefaultStudioEnvironment,
	DefaultEnvironment,
	setupDefaultRundownPlaylist,
	setupMockPeripheralDevice,
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

const Timeline = mockupCollection(OrgTimeline)

describe('Playout API', () => {
	let env: DefaultEnvironment
	let playoutDevice: PeripheralDevice

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

		ServerPlayoutAPI.resetRundownPlaylist(playlistId0)
		const orgRundownData = getAllRundownData(getRundown0())

		{
			// Prepare and activate in rehersal:
			ServerPlayoutAPI.activateRundownPlaylist(playlistId0, false)

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
			// Take the first Part:
			ServerPlayoutAPI.takeNextPart(playlistId0)

			const { currentPartInstance, nextPartInstance } = getPlaylist0().getSelectedPartInstances()
			expect(currentPartInstance).toBeTruthy()
			expect(nextPartInstance).toBeTruthy()
			expect(currentPartInstance!.part._id).toEqual(parts[0]._id)
			expect(nextPartInstance!.part._id).toEqual(parts[1]._id)
		}

		expect(Timeline.insert).toHaveBeenCalled()
		expect(Timeline.upsert).toHaveBeenCalled()
		expect(Timeline.update).toHaveBeenCalled()
		Timeline.mockClear()

		expect(fixSnapshot(Timeline.find().fetch())).toMatchSnapshot()
		expect(fixSnapshot(getRundown0())).toMatchSnapshot()

		// Deactivate rundown:
		ServerPlayoutAPI.deactivateRundownPlaylist(playlistId0)
		expect(getPlaylist0()).toMatchObject({
			active: false,
			currentPartInstanceId: null,
			nextPartInstanceId: null,
		})

		expect(fixSnapshot(Timeline.find().fetch())).toMatchSnapshot()
		expect(fixSnapshot(getPlaylist0())).toMatchSnapshot()
		expect(fixSnapshot(getRundown0())).toMatchSnapshot()

		expect(Timeline.insert).toHaveBeenCalled()
		expect(Timeline.upsert).toHaveBeenCalled()
		expect(Timeline.update).toHaveBeenCalled()

		// lastly: reset rundown
		ServerPlayoutAPI.resetRundownPlaylist(playlistId0)

		// Verify that the data is back to as it was before any of the operations:
		const rundownData = getAllRundownData(getRundown0())
		expect(rundownData).toEqual(orgRundownData)
	})
	testInFiber('prepareRundownForBroadcast', () => {
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

		// Prepare and activate in rehersal:
		ServerPlayoutAPI.prepareRundownPlaylistForBroadcast(playlistId0)

		expect(getPlaylist0()).toMatchObject({
			active: true,
			rehearsal: true,
		})

		expect(getPeripheralDeviceCommands(playoutDevice)).toHaveLength(1)
		expect(getPeripheralDeviceCommands(playoutDevice)[0]).toMatchObject({
			functionName: 'devicesMakeReady',
		})
	})
})
