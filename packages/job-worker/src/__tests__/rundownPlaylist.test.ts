import { RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { ShowStyleCompound } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { protectString, protectStringArray } from '@sofie-automation/corelib/dist/protectedString'
import { ReadonlyDeep } from 'type-fest'
import { DbCacheWriteCollection } from '../cache/CacheCollection'
import {
	moveRundownIntoPlaylist,
	produceRundownPlaylistInfoFromRundown,
	restoreRundownsInPlaylistToDefaultOrder,
	updateRundownsInPlaylist,
} from '../rundownPlaylists'
import { MockJobContext, setupDefaultJobEnvironment } from '../__mocks__/context'
import {
	setupDefaultRundownPlaylist,
	setupDefaultRundown,
	setupMockShowStyleCompound,
} from '../__mocks__/presetCollections'

describe('Rundown', () => {
	let context: MockJobContext
	let showStyle: ReadonlyDeep<ShowStyleCompound>
	beforeAll(async () => {
		context = setupDefaultJobEnvironment()

		showStyle = await setupMockShowStyleCompound(context)
	})
	test('moveRundownIntoPlaylist', async () => {
		// Set up a playlist:
		const { rundownId: rundownId00, playlistId: playlistId0 } = await setupDefaultRundownPlaylist(
			context,
			showStyle,
			protectString('rundown00')
		)
		let playlist0 = (await context.directCollections.RundownPlaylists.findOne(playlistId0)) as DBRundownPlaylist
		expect(playlist0).toBeTruthy()

		// Add 2 more rundowns in it:
		const rundownId02 = protectString('rundown02')
		await setupDefaultRundown(context, showStyle, playlistId0, protectString('rundown02')) // intentionally not created in the right order
		const rundownId01 = protectString('rundown01')
		await setupDefaultRundown(context, showStyle, playlistId0, protectString('rundown01'))
		expect(rundownId00).toEqual('rundown00')
		expect(rundownId01).toEqual('rundown01')
		expect(rundownId02).toEqual('rundown02')
		// The setupDefaultRundown doesn't set _rank, set expectedStart so that they will get a default order from that:
		await context.directCollections.Rundowns.update(rundownId00, {
			$set: {
				playlistId: playlistId0,
				playlistIdIsSetInSofie: true,
				expectedStart: 1000,
				externalId: `${rundownId00}_ext`,
			},
		})
		await context.directCollections.Rundowns.update(rundownId01, {
			$set: {
				playlistId: playlistId0,
				playlistIdIsSetInSofie: true,
				expectedStart: 2000,
				externalId: `${rundownId01}_ext`,
			},
		})
		await context.directCollections.Rundowns.update(rundownId02, {
			$set: {
				playlistId: playlistId0,
				playlistIdIsSetInSofie: true,
				expectedStart: 3000,
				externalId: `${rundownId02}_ext`,
			},
		})

		const rundown00 = (await context.directCollections.Rundowns.findOne(rundownId00)) as Rundown
		expect(rundown00).toBeTruthy()
		expect(rundown00.playlistId).toEqual(playlistId0)

		// This should set the default sorting of the rundowns in the plylist:
		const rundownsCollection = await DbCacheWriteCollection.createFromDatabase(
			context,
			context.directCollections.Rundowns,
			{
				playlistId: playlist0._id,
			}
		)
		const rundownPlaylistInfo = produceRundownPlaylistInfoFromRundown(
			context,
			undefined,
			playlist0,
			playlist0._id,
			playlist0.externalId,
			rundownsCollection.findFetch({})
		)
		updateRundownsInPlaylist(rundownPlaylistInfo.rundownPlaylist, rundownPlaylistInfo.order, rundownsCollection)
		await rundownsCollection.updateDatabaseWithData()

		// Expect the rundowns to be in the right order:
		const rundownsInPLaylist0 = await context.directCollections.Rundowns.findFetch(
			{ playlistId: playlist0._id },
			{ sort: { _rank: 1 } }
		)
		expect(rundownsInPLaylist0[0]).toMatchObject({ _id: 'rundown00', _rank: 1 })
		expect(rundownsInPLaylist0[1]).toMatchObject({ _id: 'rundown01', _rank: 2 })
		expect(rundownsInPLaylist0[2]).toMatchObject({ _id: 'rundown02', _rank: 3 })

		const getRundownIDs = async (id: RundownPlaylistId) => {
			const rundowns = await context.directCollections.Rundowns.findFetch(
				{ playlistId: id },
				{ sort: { _rank: 1 } }
			)
			return rundowns.map((r) => r._id)
		}

		// Move the rundown:
		await moveRundownIntoPlaylist(context, {
			rundownId: rundownId00,
			intoPlaylistId: playlist0._id,
			rundownsIdsInPlaylistInOrder: protectStringArray(['rundown01', 'rundown02', 'rundown00']),
		})
		await expect(getRundownIDs(playlist0._id)).resolves.toEqual(['rundown01', 'rundown02', 'rundown00'])

		playlist0 = (await context.directCollections.RundownPlaylists.findOne(playlistId0)) as DBRundownPlaylist
		expect(playlist0).toBeTruthy()

		await moveRundownIntoPlaylist(context, {
			rundownId: rundownId02,
			intoPlaylistId: playlist0._id,
			rundownsIdsInPlaylistInOrder: protectStringArray(['rundown02', 'rundown01', 'rundown00']),
		})
		await expect(getRundownIDs(playlist0._id)).resolves.toEqual(['rundown02', 'rundown01', 'rundown00'])

		// Introduce another playlist
		const { rundownId: rundownId10, playlistId: playlistId1 } = await setupDefaultRundownPlaylist(
			context,
			showStyle,
			protectString('rundown10')
		)
		expect(rundownId10).toEqual('rundown10')
		const playlist1 = (await context.directCollections.RundownPlaylists.findOne(playlistId1)) as DBRundownPlaylist
		expect(playlist1).toBeTruthy()

		await expect(context.directCollections.RundownPlaylists.findFetch()).resolves.toHaveLength(2)

		// Move over a rundown to the other playlist:
		await moveRundownIntoPlaylist(context, {
			rundownId: rundownId02,
			intoPlaylistId: playlist1._id,
			rundownsIdsInPlaylistInOrder: protectStringArray(['rundown10', 'rundown02']),
		})
		await expect(getRundownIDs(playlist0._id)).resolves.toEqual(['rundown01', 'rundown00'])
		await expect(getRundownIDs(playlist1._id)).resolves.toEqual(['rundown10', 'rundown02'])

		// Move a rundown out of a playlist:
		await moveRundownIntoPlaylist(context, {
			rundownId: rundownId02,
			intoPlaylistId: null,
			rundownsIdsInPlaylistInOrder: [],
		})
		await expect(getRundownIDs(playlist0._id)).resolves.toEqual(['rundown01', 'rundown00'])
		await expect(getRundownIDs(playlist1._id)).resolves.toEqual(['rundown10'])
		await expect(context.directCollections.RundownPlaylists.findFetch()).resolves.toHaveLength(3) // A new playlist has been created
		// The newly created playlist:
		const newPlaylist = (await context.directCollections.RundownPlaylists.findOne({
			_id: { $nin: [playlistId0, playlistId1] },
		})) as DBRundownPlaylist
		expect(newPlaylist).toBeTruthy()
		await expect(getRundownIDs(newPlaylist._id)).resolves.toEqual(['rundown02'])

		// Move the last rundown into another playlist:
		await moveRundownIntoPlaylist(context, {
			rundownId: rundownId02,
			intoPlaylistId: null,
			rundownsIdsInPlaylistInOrder: [],
		})
		await expect(context.directCollections.RundownPlaylists.findFetch()).resolves.toHaveLength(3) // A new playlist has been created, and an old one was removed
		const newPlaylist2 = (await context.directCollections.RundownPlaylists.findOne({
			_id: { $nin: [playlistId0, playlistId1, newPlaylist._id] },
		})) as DBRundownPlaylist
		expect(newPlaylist2).toBeTruthy()
		await expect(getRundownIDs(newPlaylist2._id)).resolves.toEqual(['rundown02'])

		// Move the rundown back into a playlist:
		await expect(getRundownIDs(playlist0._id)).resolves.toEqual(['rundown01', 'rundown00'])
		// Note: the order here will be ignored, new rundowns are placed last:
		await moveRundownIntoPlaylist(context, {
			rundownId: rundownId02,
			intoPlaylistId: playlist0._id,
			rundownsIdsInPlaylistInOrder: protectStringArray(['rundown01', 'rundown02', 'rundown00']),
		})
		await expect(getRundownIDs(playlist0._id)).resolves.toEqual(['rundown01', 'rundown00', 'rundown02'])
		await expect(getRundownIDs(playlist1._id)).resolves.toEqual(['rundown10'])
		await expect(context.directCollections.RundownPlaylists.findFetch()).resolves.toHaveLength(2) // A playlist was removed

		// Restore the order:
		await restoreRundownsInPlaylistToDefaultOrder(context, {
			playlistId: playlist0._id,
		})
		await expect(getRundownIDs(playlist0._id)).resolves.toEqual(['rundown00', 'rundown01', 'rundown02'])
	})
})
