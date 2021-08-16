import {
	PeripheralDeviceCategory,
	PeripheralDeviceType,
	PERIPHERAL_SUBTYPE_PROCESS,
} from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import {
	setupDefaultRundownPlaylist,
	setupMockPeripheralDevice,
	setupMockShowStyleCompound,
} from '../../__mocks__/presetCollections'
import { MockJobContext, setupDefaultJobEnvironment } from '../../__mocks__/context'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { activateRundownPlaylist, deactivateRundownPlaylist, takeNextPart } from '../playout'
import { fixSnapshot } from '../../__mocks__/helpers/snapshot'
import { runJobWithPlayoutCache } from '../lock'
import { updateTimeline } from '../timeline'
import { getSelectedPartInstances } from './lib'

describe('Timeline', () => {
	let context: MockJobContext
	beforeEach(async () => {
		context = setupDefaultJobEnvironment()

		await setupMockShowStyleCompound(context)

		await setupMockPeripheralDevice(
			context,
			PeripheralDeviceCategory.PLAYOUT,
			PeripheralDeviceType.PLAYOUT,
			PERIPHERAL_SUBTYPE_PROCESS
		)
	})
	test('Basic rundown', async () => {
		const { rundownId: rundownId0, playlistId: playlistId0 } = await setupDefaultRundownPlaylist(context)
		expect(rundownId0).toBeTruthy()
		expect(playlistId0).toBeTruthy()

		const getRundown0 = async () => {
			return (await context.directCollections.Rundowns.findOne(rundownId0)) as DBRundown
		}
		const getPlaylist0 = async () => {
			const playlist = (await context.directCollections.RundownPlaylists.findOne(
				playlistId0
			)) as DBRundownPlaylist
			playlist.activationId = playlist.activationId ?? undefined
			return playlist
		}

		await expect(getRundown0()).resolves.toBeTruthy()
		await expect(getPlaylist0()).resolves.toBeTruthy()

		const parts = await context.directCollections.Parts.findFetch({ rundownId: rundownId0 })

		await expect(getPlaylist0()).resolves.toMatchObject({
			activationId: undefined,
			rehearsal: false,
		})

		{
			// Prepare and activate in rehersal:
			await activateRundownPlaylist(context, { playlistId: playlistId0, rehearsal: false })
			const { currentPartInstance, nextPartInstance } = await getSelectedPartInstances(
				context,
				await getPlaylist0()
			)
			expect(currentPartInstance).toBeFalsy()
			expect(nextPartInstance).toBeTruthy()
			expect(nextPartInstance!.part._id).toEqual(parts[0]._id)
			await expect(getPlaylist0()).resolves.toMatchObject({
				activationId: expect.stringMatching(/^randomId/),
				rehearsal: false,
				currentPartInstanceId: null,
				// nextPartInstanceId: parts[0]._id,
			})
		}

		{
			// Take the first Part:
			await takeNextPart(context, { playlistId: playlistId0 })
			const { currentPartInstance, nextPartInstance } = await getSelectedPartInstances(
				context,
				await getPlaylist0()
			)
			expect(currentPartInstance).toBeTruthy()
			expect(nextPartInstance).toBeTruthy()
			expect(currentPartInstance!.part._id).toEqual(parts[0]._id)
			expect(nextPartInstance!.part._id).toEqual(parts[1]._id)
			// expect(getPlaylist0()).toMatchObject({
			// 	currentPartInstanceId: parts[0]._id,
			// 	nextPartInstanceId: parts[1]._id,
			// })
		}

		await runJobWithPlayoutCache(context, { playlistId: playlistId0 }, null, async (cache) => {
			await updateTimeline(context, cache)
		})

		expect(fixSnapshot(await context.directCollections.Timelines.findFetch())).toMatchSnapshot()

		await runJobWithPlayoutCache(context, { playlistId: playlistId0 }, null, async (cache) => {
			const currentTime = 100 * 1000
			await updateTimeline(context, cache, currentTime)
		})

		expect(fixSnapshot(await context.directCollections.Timelines.findFetch())).toMatchSnapshot()

		{
			// Deactivate rundown:
			await deactivateRundownPlaylist(context, { playlistId: playlistId0 })
			await expect(getPlaylist0()).resolves.toMatchObject({
				activationId: undefined,
				currentPartInstanceId: null,
				nextPartInstanceId: null,
			})
		}

		expect(fixSnapshot(await context.directCollections.Timelines.findFetch())).toMatchSnapshot()
	})
})
