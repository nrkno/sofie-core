import { MeteorCall } from '../../lib/api/methods'
import { RundownPlaylistId, RundownPlaylists } from '../../lib/collections/RundownPlaylists'
import {
	DefaultEnvironment,
	setupDefaultRundownPlaylist,
	setupDefaultStudioEnvironment,
} from '../../__mocks__/helpers/database'
import { beforeAllInFiber, testInFiber } from '../../__mocks__/helpers/jest'
import { MongoMock } from '../../__mocks__/mongo'
import '../api/userActions'
import { expectToExecuteQuickerThan } from './lib'

describe('A placeholder', () => {
	beforeAllInFiber(() => {
		MongoMock.mockSetRealisticResponseTimes()
	})
	testInFiber('Do a take', async () => {
		// Preparing the environment:
		let env: DefaultEnvironment = setupDefaultStudioEnvironment()
		let playlistId: RundownPlaylistId = setupDefaultRundownPlaylist(env).playlistId
		const playlist = RundownPlaylists.findOne(playlistId)
		if (!playlist) throw new Error('Playlist not found')

		// Run actions
		await expectToExecuteQuickerThan(async () => {
			await MeteorCall.userAction.activate('', playlist._id, true)
		}, 600)

		await expectToExecuteQuickerThan(async () => {
			await MeteorCall.userAction.take('', playlist._id)
		}, 500)
	})
})
