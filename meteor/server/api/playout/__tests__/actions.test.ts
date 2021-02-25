import '../../../../__mocks__/_extendJest'
import { testInFiber, beforeEachInFiber } from '../../../../__mocks__/helpers/jest'
import {
	setupDefaultStudioEnvironment,
	DefaultEnvironment,
	setupMockPeripheralDevice,
	setupDefaultRundownPlaylist,
} from '../../../../__mocks__/helpers/database'
import { Rundowns } from '../../../../lib/collections/Rundowns'
import '../api'
import { activateRundownPlaylist, prepareStudioForBroadcast } from '../actions'
import { PeripheralDeviceAPI } from '../../../../lib/api/peripheralDevice'
import { PeripheralDeviceCommands } from '../../../../lib/collections/PeripheralDeviceCommands'
import { PeripheralDevice } from '../../../../lib/collections/PeripheralDevices'
import * as _ from 'underscore'
import { RundownPlaylist, RundownPlaylists, RundownPlaylistId } from '../../../../lib/collections/RundownPlaylists'
import { protectString, waitForPromise } from '../../../../lib/lib'
import { PlayoutLockFunctionPriority, runPlayoutOperationWithCache } from '../lockFunction'
import { removeRundownsFromDb } from '../../rundownPlaylist'

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

		waitForPromise(
			removeRundownsFromDb(
				Rundowns.find()
					.fetch()
					.map((r) => r._id)
			)
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
		runPlayoutOperationWithCache(
			null,
			'activateRundownPlaylist',
			playlist._id,
			PlayoutLockFunctionPriority.USER_PLAYOUT,
			null,
			async (cache) => await activateRundownPlaylist(cache, true)
		)
		expect(getPlaylist0()).toMatchObject({ activationId: expect.stringMatching(/^randomId/), rehearsal: true })

		// Activating a rundown
		playlist = getPlaylist0()
		runPlayoutOperationWithCache(
			null,
			'activateRundownPlaylist',
			playlist._id,
			PlayoutLockFunctionPriority.USER_PLAYOUT,
			null,
			async (cache) => await activateRundownPlaylist(cache, false)
		)
		expect(getPlaylist0()).toMatchObject({ activationId: expect.stringMatching(/^randomId/), rehearsal: false })

		// Activating a rundown, back to rehearsal
		playlist = getPlaylist0()
		runPlayoutOperationWithCache(
			null,
			'activateRundownPlaylist',
			playlist._id,
			PlayoutLockFunctionPriority.USER_PLAYOUT,
			null,
			async (cache) => await activateRundownPlaylist(cache, true)
		)
		expect(getPlaylist0()).toMatchObject({ activationId: expect.stringMatching(/^randomId/), rehearsal: true })

		// Activating another rundown
		expect(() => {
			const playlist = getPlaylist1()
			runPlayoutOperationWithCache(
				null,
				'activateRundownPlaylist',
				playlist._id,
				PlayoutLockFunctionPriority.USER_PLAYOUT,
				null,
				async (cache) => await activateRundownPlaylist(cache, false)
			)
		}).toThrowError(/only one rundown can be active/i)
	})
	testInFiber('prepareStudioForBroadcast', () => {
		expect(getPeripheralDeviceCommands(playoutDevice)).toHaveLength(0)

		const { playlistId } = setupDefaultRundownPlaylist(env, protectString('ro0'))
		expect(playlistId).toBeTruthy()

		const playlist = RundownPlaylists.findOne(playlistId) as RundownPlaylist
		expect(playlist).toBeTruthy()

		// prepareStudioForBroadcast
		const okToDestroyStuff = true
		runPlayoutOperationWithCache(
			null,
			'activateRundownPlaylist',
			playlist._id,
			PlayoutLockFunctionPriority.USER_PLAYOUT,
			null,
			(cache) => prepareStudioForBroadcast(cache, okToDestroyStuff)
		)

		expect(getPeripheralDeviceCommands(playoutDevice)).toHaveLength(1)
		expect(getPeripheralDeviceCommands(playoutDevice)[0]).toMatchObject({
			functionName: 'devicesMakeReady',
			args: [okToDestroyStuff, playlist._id],
		})
	})
})
