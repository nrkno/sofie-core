import '../../../../__mocks__/_extendJest'
import { testInFiber } from '../../../../__mocks__/helpers/jest'
import { fixSnapshot } from '../../../../__mocks__/helpers/snapshot'
import {
	setupDefaultStudioEnvironment,
	DefaultEnvironment,
	setupDefaultRundownPlaylist,
	setupMockPeripheralDevice,
} from '../../../../__mocks__/helpers/database'
import { Rundowns, Rundown } from '../../../../lib/collections/Rundowns'
import '../api'
import { Timeline } from '../../../../lib/collections/Timeline'
import { ServerPlayoutAPI, rundownPlaylistPlayoutSyncFunction } from '../playout'
import { updateTimeline } from '../timeline'
import { RundownPlaylists, RundownPlaylist } from '../../../../lib/collections/RundownPlaylists'
import { protectString, waitForPromise } from '../../../../lib/lib'
import { MethodContext } from '../../../../lib/api/methods'
import { PeripheralDeviceAPI } from '../../../../lib/api/peripheralDevice'

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

describe('Timeline', () => {
	let env: DefaultEnvironment
	beforeEach(() => {
		env = setupDefaultStudioEnvironment()
		setupMockPeripheralDevice(
			PeripheralDeviceAPI.DeviceCategory.PLAYOUT,
			PeripheralDeviceAPI.DeviceType.PLAYOUT,
			PeripheralDeviceAPI.SUBTYPE_PROCESS,
			env.studio
		)
	})
	testInFiber('Basic rundown', () => {
		const { rundownId: rundownId0, playlistId: playlistId0 } = setupDefaultRundownPlaylist(env)
		expect(rundownId0).toBeTruthy()
		expect(playlistId0).toBeTruthy()

		const getRundown0 = () => {
			return Rundowns.findOne(rundownId0) as Rundown
		}
		const getPlaylist0 = () => {
			return RundownPlaylists.findOne(playlistId0) as RundownPlaylist
		}
		expect(getRundown0()).toBeTruthy()
		expect(getPlaylist0()).toBeTruthy()

		const parts = getRundown0().getParts()

		expect(getPlaylist0()).toMatchObject({
			active: false,
			rehearsal: false,
		})

		{
			// Prepare and activate in rehersal:
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

		{
			// Take the first Part:
			ServerPlayoutAPI.takeNextPart(DEFAULT_CONTEXT, playlistId0)
			const { currentPartInstance, nextPartInstance } = getPlaylist0().getSelectedPartInstances()
			expect(currentPartInstance).toBeTruthy()
			expect(nextPartInstance).toBeTruthy()
			expect(currentPartInstance!.part._id).toEqual(parts[0]._id)
			expect(nextPartInstance!.part._id).toEqual(parts[1]._id)
			// expect(getPlaylist0()).toMatchObject({
			// 	currentPartInstanceId: parts[0]._id,
			// 	nextPartInstanceId: parts[1]._id,
			// })
		}

		rundownPlaylistPlayoutSyncFunction(null, 'updateTimeline', getRundown0().playlistId, null, (cache) => {
			updateTimeline(cache)
		})

		expect(fixSnapshot(Timeline.find().fetch())).toMatchSnapshot()

		rundownPlaylistPlayoutSyncFunction(null, 'updateTimeline', getRundown0().playlistId, null, (cache) => {
			const currentTime = 100 * 1000
			updateTimeline(cache, currentTime)
		})

		expect(fixSnapshot(Timeline.find().fetch())).toMatchSnapshot()

		{
			// Deactivate rundown:
			ServerPlayoutAPI.deactivateRundownPlaylist(DEFAULT_CONTEXT, playlistId0)
			expect(getPlaylist0()).toMatchObject({
				active: false,
				currentPartInstanceId: null,
				nextPartInstanceId: null,
			})
		}

		expect(fixSnapshot(Timeline.find().fetch())).toMatchSnapshot()
	})
})
