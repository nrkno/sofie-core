import '../../../../__mocks__/_extendJest'
import { testInFiber } from '../../../../__mocks__/helpers/jest'
import {
	setupDefaultStudioEnvironment,
	DefaultEnvironment,
	setupDefaultRundownPlaylist,
} from '../../../../__mocks__/helpers/database'
import { Rundowns, Rundown, RundownCollectionUtil } from '../../../../lib/collections/Rundowns'
import {
	RundownPlaylists,
	RundownPlaylist,
	RundownPlaylistCollectionUtil,
} from '../../../../lib/collections/RundownPlaylists'
import { RESTART_SALT, UserActionAPIMethods } from '../../../../lib/api/userActions'
import { getHash } from '../../../../lib/lib'
import { UserActionsLog } from '../../../../lib/collections/UserActionsLog'
import { MeteorCall } from '../../../../lib/api/methods'
import { ClientAPI } from '../../../../lib/api/client'

require('../../client') // include in order to create the Meteor methods needed
require('../../userActions') // include in order to create the Meteor methods needed

describe('User Actions - General', () => {
	let env: DefaultEnvironment
	beforeEach(async () => {
		env = await setupDefaultStudioEnvironment()
		setMinimumTakeSpan(0)
	})
	testInFiber('Basic rundown control', async () => {
		const { rundownId: rundownId0, playlistId: playlistId0 } = setupDefaultRundownPlaylist(env)
		const { rundownId: rundownId1, playlistId: playlistId1 } = setupDefaultRundownPlaylist(env)
		expect(rundownId0).toBeTruthy()
		expect(rundownId1).toBeTruthy()
		expect(playlistId0).toBeTruthy()
		expect(playlistId1).toBeTruthy()

		const getRundown0 = () => {
			return Rundowns.findOne(rundownId0) as Rundown
		}
		const getPlaylist0 = () => {
			const playlist = RundownPlaylists.findOne(playlistId0) as RundownPlaylist
			playlist.activationId = playlist.activationId ?? undefined
			return playlist
		}
		const getRundown1 = () => {
			return Rundowns.findOne(rundownId1) as Rundown
		}

		expect(getRundown0()).toBeTruthy()
		expect(getPlaylist0()).toBeTruthy()
		expect(getRundown1()).toBeTruthy()
		expect(getRundown0()._id).not.toEqual(getRundown1()._id)

		const parts = RundownCollectionUtil.getParts(getRundown0())

		expect(getPlaylist0()).toMatchObject({
			activationId: undefined,
			rehearsal: false,
		})

		{
			// Prepare and activate in rehersal:
			await expect(MeteorCall.userAction.prepareForBroadcast('e', playlistId0)).resolves.toMatchObject({
				success: 200,
			})

			const { currentPartInstance, nextPartInstance } = RundownPlaylistCollectionUtil.getSelectedPartInstances(
				getPlaylist0()
			)
			expect(currentPartInstance).toBeFalsy()
			expect(nextPartInstance).toBeTruthy()
			expect(nextPartInstance!.part._id).toEqual(parts[0]._id)

			expect(getPlaylist0()).toMatchObject({
				activationId: expect.stringMatching(/^randomId/),
				rehearsal: true,
				currentPartInstanceId: null,
				// nextPartInstanceId: parts[0]._id,
			})
		}
		// Activate a second rundown (this should throw an error)
		await expect(MeteorCall.userAction.activate('e', playlistId1, false)).resolves.toMatchObject({
			error: 409,
			message: expect.stringMatching(/only one rundown/i),
		})

		{
			// Take the first Part:
			await expect(
				MeteorCall.userAction.take('e', playlistId0, getPlaylist0().currentPartInstanceId)
			).resolves.toMatchObject({ success: 200 })

			const { currentPartInstance, nextPartInstance } = RundownPlaylistCollectionUtil.getSelectedPartInstances(
				getPlaylist0()
			)
			expect(currentPartInstance).toBeTruthy()
			expect(nextPartInstance).toBeTruthy()
			expect(currentPartInstance!.part._id).toEqual(parts[0]._id)
			expect(nextPartInstance!.part._id).toEqual(parts[1]._id)
		}

		{
			// Take the second Part:
			await expect(
				MeteorCall.userAction.take('e', playlistId0, getPlaylist0().currentPartInstanceId)
			).resolves.toMatchObject({ success: 200 })

			const { currentPartInstance, nextPartInstance } = RundownPlaylistCollectionUtil.getSelectedPartInstances(
				getPlaylist0()
			)
			expect(currentPartInstance).toBeTruthy()
			expect(nextPartInstance).toBeTruthy()
			expect(currentPartInstance!.part._id).toEqual(parts[1]._id)
			expect(nextPartInstance!.part._id).toEqual(parts[2]._id)
		}

		{
			// Reset rundown:
			await expect(MeteorCall.userAction.resetRundownPlaylist('e', playlistId0)).resolves.toMatchObject({
				success: 200,
			})

			const { currentPartInstance, nextPartInstance } = RundownPlaylistCollectionUtil.getSelectedPartInstances(
				getPlaylist0()
			)
			expect(currentPartInstance).toBeFalsy()
			expect(nextPartInstance).toBeTruthy()
			expect(nextPartInstance!.part._id).toEqual(parts[0]._id)

			expect(getPlaylist0()).toMatchObject({
				currentPartInstanceId: null,
				// nextPartInstanceId: parts[0]._id,
			})
		}

		{
			// Set Part as next:
			await expect(
				MeteorCall.userAction.setNext('e', playlistId0, parts[parts.length - 2]._id)
			).resolves.toMatchObject({ success: 200 })

			const { currentPartInstance, nextPartInstance } = RundownPlaylistCollectionUtil.getSelectedPartInstances(
				getPlaylist0()
			)
			expect(currentPartInstance).toBeFalsy()
			expect(nextPartInstance).toBeTruthy()
			expect(nextPartInstance!.part._id).toEqual(parts[parts.length - 2]._id)

			expect(getPlaylist0()).toMatchObject({
				currentPartInstanceId: null,
				// nextPartInstanceId: parts[parts.length - 2]._id,
			})
		}

		{
			// Take the Nexted Part:
			await expect(
				MeteorCall.userAction.take('e', playlistId0, getPlaylist0().currentPartInstanceId)
			).resolves.toMatchObject({ success: 200 })

			const { currentPartInstance, nextPartInstance } = RundownPlaylistCollectionUtil.getSelectedPartInstances(
				getPlaylist0()
			)
			expect(currentPartInstance).toBeTruthy()
			expect(nextPartInstance).toBeTruthy()
			expect(currentPartInstance!.part._id).toEqual(parts[parts.length - 2]._id)
			expect(nextPartInstance!.part._id).toEqual(parts[parts.length - 1]._id)
		}

		{
			// Take the last Part:
			await expect(
				MeteorCall.userAction.take('e', playlistId0, getPlaylist0().currentPartInstanceId)
			).resolves.toMatchObject({ success: 200 })
			const { currentPartInstance, nextPartInstance } = RundownPlaylistCollectionUtil.getSelectedPartInstances(
				getPlaylist0()
			)
			expect(currentPartInstance).toBeTruthy()
			expect(nextPartInstance).toBeFalsy()
			expect(currentPartInstance!.part._id).toEqual(parts[parts.length - 1]._id)

			expect(getPlaylist0()).toMatchObject({
				// currentPartInstanceId: parts[parts.length - 1]._id,
				nextPartInstanceId: null,
			})
		}

		{
			// Move the next-point backwards:
			await expect(MeteorCall.userAction.moveNext('e', playlistId0, -1, 0)).resolves.toMatchObject({
				success: 200,
			})

			const { currentPartInstance, nextPartInstance } = RundownPlaylistCollectionUtil.getSelectedPartInstances(
				getPlaylist0()
			)
			expect(currentPartInstance).toBeTruthy()
			expect(nextPartInstance).toBeTruthy()
			expect(currentPartInstance!.part._id).toEqual(parts[parts.length - 1]._id)
			expect(nextPartInstance!.part._id).toEqual(parts[parts.length - 2]._id)
		}

		{
			// Move the next-point backwards:
			await expect(MeteorCall.userAction.moveNext('e', playlistId0, -1, 0)).resolves.toMatchObject({
				success: 200,
			})

			const { currentPartInstance, nextPartInstance } = RundownPlaylistCollectionUtil.getSelectedPartInstances(
				getPlaylist0()
			)
			expect(currentPartInstance).toBeTruthy()
			expect(nextPartInstance).toBeTruthy()
			expect(currentPartInstance!.part._id).toEqual(parts[parts.length - 1]._id)
			expect(nextPartInstance!.part._id).toEqual(parts[parts.length - 3]._id)
		}

		{
			// Take the nexted Part:
			await expect(
				MeteorCall.userAction.take('e', playlistId0, getPlaylist0().currentPartInstanceId)
			).resolves.toMatchObject({ success: 200 })

			const { currentPartInstance, nextPartInstance } = RundownPlaylistCollectionUtil.getSelectedPartInstances(
				getPlaylist0()
			)
			expect(currentPartInstance).toBeTruthy()
			expect(nextPartInstance).toBeTruthy()
			expect(currentPartInstance!.part._id).toEqual(parts[parts.length - 3]._id)
			expect(nextPartInstance!.part._id).toEqual(parts[parts.length - 2]._id)
		}

		// Deactivate rundown:
		await expect(MeteorCall.userAction.deactivate('e', playlistId0)).resolves.toMatchObject({ success: 200 })
		expect(getPlaylist0()).toMatchObject({
			activationId: undefined,
			currentPartInstanceId: null,
			nextPartInstanceId: null,
		})
	})

	testInFiber('Restart Core', async () => {
		jest.useFakeTimers()

		// Generate restart token
		const res = (await MeteorCall.userAction.generateRestartToken('e')) as ClientAPI.ClientResponseSuccess<string>
		expect(res).toMatchObject({ success: 200 })
		expect(typeof res.result).toBe('string')

		const mockExit = jest.spyOn(process, 'exit').mockImplementation()

		// Use an invalid token to try and restart it
		await expect(MeteorCall.userAction.restartCore('e', 'invalidToken')).rejects.toThrowMeteor(
			401,
			'Restart token is invalid'
		)

		await expect(MeteorCall.userAction.restartCore('e', getHash(RESTART_SALT + res.result))).resolves.toMatchObject(
			{
				success: 200,
			}
		)

		jest.runAllTimers()

		expect(mockExit).toHaveBeenCalledTimes(1)
		jest.useRealTimers()
	})

	testInFiber('GUI Status', async () => {
		await expect(MeteorCall.userAction.guiFocused('click')).resolves.toMatchObject({ success: 200 })
		const logs0 = UserActionsLog.find({
			method: UserActionAPIMethods.guiFocused,
		}).fetch()
		expect(logs0).toHaveLength(1)
		// expect(logs0[0]).toMatchObject({
		// 	context: 'mousedown',
		// 	args: JSON.stringify([ [ 'dummyClientData' ] ])
		// })
		await expect(MeteorCall.userAction.guiBlurred('click')).resolves.toMatchObject({ success: 200 })
		const logs1 = UserActionsLog.find({
			method: UserActionAPIMethods.guiBlurred,
		}).fetch()
		expect(logs1).toHaveLength(1)
		// expect(logs1[0]).toMatchObject({
		// 	context: 'interval',
		// 	args: JSON.stringify([ [ 'dummyClientData' ] ])
		// })
	})
})
