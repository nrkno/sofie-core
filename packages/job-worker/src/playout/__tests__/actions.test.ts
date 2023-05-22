import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { MockJobContext, setupDefaultJobEnvironment } from '../../__mocks__/context'
import { removeRundownFromDb } from '../../rundownPlaylists'
import { setupDefaultRundownPlaylist, setupMockShowStyleCompound } from '../../__mocks__/presetCollections'
import { activateRundownPlaylist } from '../activePlaylistActions'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { runJobWithPlayoutCache } from '../lock'
import { runWithRundownLock } from '../../ingest/lock'

jest.mock('../../peripheralDevice')
import { executePeripheralDeviceFunction } from '../../peripheralDevice'
type TexecutePeripheralDeviceFunction = jest.MockedFunction<typeof executePeripheralDeviceFunction>
const executePeripheralDeviceFunctionMock = executePeripheralDeviceFunction as TexecutePeripheralDeviceFunction

describe('Playout Actions', () => {
	let context: MockJobContext

	beforeEach(async () => {
		context = setupDefaultJobEnvironment()

		await setupMockShowStyleCompound(context)

		const rundowns = await context.directCollections.Rundowns.findFetch()
		for (const rundown of rundowns) {
			await runWithRundownLock(context, rundown._id, async (_rd, lock) => {
				await removeRundownFromDb(context, lock, null)
			})
		}

		executePeripheralDeviceFunctionMock.mockClear()
		executePeripheralDeviceFunctionMock.mockImplementation(async () => Promise.resolve())
	})
	test('activateRundown', async () => {
		const { playlistId: playlistId0 } = await setupDefaultRundownPlaylist(context, undefined, protectString('ro0'))
		expect(playlistId0).toBeTruthy()

		const getPlaylist0 = async () =>
			(await context.directCollections.RundownPlaylists.findOne(playlistId0)) as DBRundownPlaylist

		const { playlistId: playlistId1 } = await setupDefaultRundownPlaylist(context, undefined, protectString('ro1'))
		expect(playlistId1).toBeTruthy()

		// const getPlaylist1 = () => RundownPlaylists.findOne(playlistId1) as RundownPlaylist

		const { playlistId: playlistId2 } = await setupDefaultRundownPlaylist(context, undefined, protectString('ro2'))
		expect(playlistId2).toBeTruthy()

		expect(executePeripheralDeviceFunctionMock).toHaveBeenCalledTimes(0)

		// Activating a rundown, to rehearsal
		await runJobWithPlayoutCache(context, { playlistId: playlistId0 }, null, async (cache) =>
			activateRundownPlaylist(context, cache, true)
		)
		await expect(getPlaylist0()).resolves.toMatchObject({
			activationId: expect.stringMatching(/^randomId/),
			rehearsal: true,
		})

		// Activating a rundown
		await runJobWithPlayoutCache(context, { playlistId: playlistId0 }, null, async (cache) =>
			activateRundownPlaylist(context, cache, false)
		)
		await expect(getPlaylist0()).resolves.toMatchObject({
			activationId: expect.stringMatching(/^randomId/),
			rehearsal: false,
		})

		// Activating a rundown, back to rehearsal
		await runJobWithPlayoutCache(context, { playlistId: playlistId0 }, null, async (cache) =>
			activateRundownPlaylist(context, cache, true)
		)
		await expect(getPlaylist0()).resolves.toMatchObject({
			activationId: expect.stringMatching(/^randomId/),
			rehearsal: true,
		})

		expect(executePeripheralDeviceFunctionMock).toHaveBeenCalledTimes(0)

		// Activating another rundown
		await expect(
			runJobWithPlayoutCache(context, { playlistId: playlistId1 }, null, async (cache) =>
				activateRundownPlaylist(context, cache, false)
			)
		).rejects.toMatchToString(/only one rundown can be active/i)

		expect(executePeripheralDeviceFunctionMock).toHaveBeenCalledTimes(0)
	})
})
