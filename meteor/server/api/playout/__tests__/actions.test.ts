import '../../../../__mocks__/_extendJest'
import { testInFiber, beforeEachInFiber } from '../../../../__mocks__/helpers/jest'
import {
	setupDefaultStudioEnvironment,
	DefaultEnvironment,
	setupMockPeripheralDevice,
	setupDefaultRundownPlaylist,
} from '../../../../__mocks__/helpers/database'
import { Rundowns, Rundown } from '../../../../lib/collections/Rundowns'
import '../api'
import { Timeline as OrgTimeline } from '../../../../lib/collections/Timeline'
import { activateRundownPlaylist, prepareStudioForBroadcast } from '../actions'
import { PeripheralDeviceAPI } from '../../../../lib/api/peripheralDevice'
import { PeripheralDeviceCommands } from '../../../../lib/collections/PeripheralDeviceCommands'
import { PeripheralDevice } from '../../../../lib/collections/PeripheralDevices'
import * as _ from 'underscore'
import { RundownPlaylist, RundownPlaylists, RundownPlaylistId } from '../../../../lib/collections/RundownPlaylists'
import { protectString } from '../../../../lib/lib'
import { removeRundownFromCache, removeRundownPlaylistFromCache } from '../lib'
import { wrapWithCacheForRundownPlaylistFromRundown } from '../../../DatabaseCaches'
import { rundownPlaylistPlayoutSyncFunction } from '../playout'

// const Timeline = mockupCollection(OrgTimeline)

describe('Playout Actions', () => {
	let env: DefaultEnvironment
	let playoutDevice: PeripheralDevice

	function getPeripheralDeviceCommands(playoutDevice: PeripheralDevice) {
		return PeripheralDeviceCommands.find({ deviceId: playoutDevice._id }, { sort: { time: 1 } }).fetch()
	}
	function clearPeripheralDeviceCommands(playoutDevice: PeripheralDevice) {
		return PeripheralDeviceCommands.remove({ deviceId: playoutDevice._id })
	}

	beforeEachInFiber(() => {
		env = setupDefaultStudioEnvironment()

		playoutDevice = setupMockPeripheralDevice(
			PeripheralDeviceAPI.DeviceCategory.PLAYOUT,
			PeripheralDeviceAPI.DeviceType.PLAYOUT,
			PeripheralDeviceAPI.SUBTYPE_PROCESS,
			env.studio
		)

		_.each(Rundowns.find().fetch(), (rundown) =>
			// TODO-CACHE is this ok?
			rundown.removeTOBEREMOVED()
		)
	})
	testInFiber('activateRundown', () => {
		const { playlistId: playlistId0 } = setupDefaultRundownPlaylist(env, protectString('ro0'))
		expect(playlistId0).toBeTruthy()

		const getPlaylist0 = () => RundownPlaylists.findOne(playlistId0) as RundownPlaylist

		const { playlistId: playlistId1 } = setupDefaultRundownPlaylist(env, protectString('ro1'))
		expect(playlistId1).toBeTruthy()

		const getPlaylist1 = () => RundownPlaylists.findOne(playlistId1) as RundownPlaylist

		const { playlistId: playlistId2 } = setupDefaultRundownPlaylist(env, protectString('ro2'))
		expect(playlistId2).toBeTruthy()

		expect(getPeripheralDeviceCommands(playoutDevice)).toHaveLength(0)
		// Activating a rundown, to rehearsal
		let playlist = getPlaylist0()
		rundownPlaylistPlayoutSyncFunction(null, playlist._id, null, (cache) => activateRundownPlaylist(cache, true))
		expect(getPlaylist0()).toMatchObject({ active: true, rehearsal: true })

		// Activating a rundown
		playlist = getPlaylist0()
		rundownPlaylistPlayoutSyncFunction(null, playlist._id, null, (cache) => activateRundownPlaylist(cache, false))
		expect(getPlaylist0()).toMatchObject({ active: true, rehearsal: false })

		// Activating a rundown, back to rehearsal
		playlist = getPlaylist0()
		rundownPlaylistPlayoutSyncFunction(null, playlist._id, null, (cache) => activateRundownPlaylist(cache, true))
		expect(getPlaylist0()).toMatchObject({ active: true, rehearsal: true })

		// Activating another rundown
		expect(() => {
			const playlist = getPlaylist1()
			rundownPlaylistPlayoutSyncFunction(null, playlist._id, null, (cache) =>
				activateRundownPlaylist(cache, false)
			)
		}).toThrowError(/only one rundown can be active/i)
	})
	testInFiber('prepareStudioForBroadcast', () => {
		expect(getPeripheralDeviceCommands(playoutDevice)).toHaveLength(0)

		// prepareStudioForBroadcast
		const playlist = {
			_id: protectString<RundownPlaylistId>('some-id'),
			studioId: env.studio._id,
		} as RundownPlaylist
		const okToDestroyStuff = true
		rundownPlaylistPlayoutSyncFunction(null, playlist._id, null, (cache) => {
			prepareStudioForBroadcast(cache, okToDestroyStuff)
		})

		expect(getPeripheralDeviceCommands(playoutDevice)).toHaveLength(1)
		expect(getPeripheralDeviceCommands(playoutDevice)[0]).toMatchObject({
			functionName: 'devicesMakeReady',
			args: [okToDestroyStuff, playlist._id],
		})
	})
})
