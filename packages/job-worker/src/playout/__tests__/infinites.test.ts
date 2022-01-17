import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { MockJobContext, setupDefaultJobEnvironment } from '../../__mocks__/context'
import { ReadonlyDeep, SetRequired } from 'type-fest'
import { CacheForPlayout, getOrderedSegmentsAndPartsFromPlayoutCache } from '../cache'
import { canContinueAdlibOnEndInfinites } from '../infinites'
import { setupDefaultRundownPlaylist, setupMockShowStyleCompound } from '../../__mocks__/presetCollections'
import { getRandomId } from '@sofie-automation/corelib/dist/lib'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { runJobWithPlayoutCache } from '../lock'
import { wrapPartToTemporaryInstance } from '../../__mocks__/partinstance'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'

describe('canContinueAdlibOnEndInfinites', () => {
	let context: MockJobContext

	beforeEach(async () => {
		context = setupDefaultJobEnvironment()

		await setupMockShowStyleCompound(context)
	})

	async function wrapWithCache<T>(
		fcn: (
			cache: CacheForPlayout,
			playlist: SetRequired<ReadonlyDeep<DBRundownPlaylist>, 'activationId'>
		) => Promise<T>
	): Promise<T> {
		const defaultSetup = await setupDefaultRundownPlaylist(context)

		// Mark playlist as active
		await context.directCollections.RundownPlaylists.update(defaultSetup.playlistId, {
			$set: {
				activationId: getRandomId(),
			},
		})

		const tmpPlaylist = (await context.directCollections.RundownPlaylists.findOne(
			defaultSetup.playlistId
		)) as DBRundownPlaylist
		expect(tmpPlaylist).toBeTruthy()

		const rundown = (await context.directCollections.Rundowns.findOne(defaultSetup.rundownId)) as DBRundown
		expect(rundown).toBeTruthy()

		return runJobWithPlayoutCache(context, { playlistId: tmpPlaylist._id }, null, async (cache) => {
			const playlist = cache.Playlist.doc as SetRequired<ReadonlyDeep<DBRundownPlaylist>, 'activationId'>
			if (!playlist.activationId) throw new Error('Missing activationId')
			return fcn(cache, playlist)
		})
	}

	test('Basic case', async () => {
		await wrapWithCache(async (cache, playlist) => {
			const orderedPartsAndSegments = getOrderedSegmentsAndPartsFromPlayoutCache(cache)
			expect(orderedPartsAndSegments.parts.length).toBeGreaterThan(2)

			// At beginning
			expect(
				canContinueAdlibOnEndInfinites(
					context,
					playlist,
					orderedPartsAndSegments.segments,
					wrapPartToTemporaryInstance(playlist.activationId, orderedPartsAndSegments.parts[0]),
					orderedPartsAndSegments.parts[1]
				)
			).toBeTruthy()

			// Small gap
			expect(
				canContinueAdlibOnEndInfinites(
					context,
					playlist,
					orderedPartsAndSegments.segments,
					wrapPartToTemporaryInstance(playlist.activationId, orderedPartsAndSegments.parts[0]),
					orderedPartsAndSegments.parts[2]
				)
			).toBeTruthy()

			// At end
			expect(
				canContinueAdlibOnEndInfinites(
					context,
					playlist,
					orderedPartsAndSegments.segments,
					wrapPartToTemporaryInstance(
						playlist.activationId,
						orderedPartsAndSegments.parts[orderedPartsAndSegments.parts.length - 2]
					),
					orderedPartsAndSegments.parts[orderedPartsAndSegments.parts.length - 1]
				)
			).toBeTruthy()

			// Start to end
			expect(
				canContinueAdlibOnEndInfinites(
					context,
					playlist,
					orderedPartsAndSegments.segments,
					wrapPartToTemporaryInstance(playlist.activationId, orderedPartsAndSegments.parts[0]),

					orderedPartsAndSegments.parts[orderedPartsAndSegments.parts.length - 1]
				)
			).toBeTruthy()
		})
	})

	test('No previousPartInstance', async () => {
		await wrapWithCache(async (cache, playlist) => {
			const orderedPartsAndSegments = getOrderedSegmentsAndPartsFromPlayoutCache(cache)

			expect(
				canContinueAdlibOnEndInfinites(
					context,
					playlist,
					orderedPartsAndSegments.segments,
					undefined,
					orderedPartsAndSegments.parts[1]
				)
			).toBeFalsy()
		})
	})

	test('Is before', async () => {
		await wrapWithCache(async (cache, playlist) => {
			const orderedPartsAndSegments = getOrderedSegmentsAndPartsFromPlayoutCache(cache)
			expect(orderedPartsAndSegments.parts.length).toBeGreaterThan(2)

			// At beginning
			expect(
				canContinueAdlibOnEndInfinites(
					context,
					playlist,
					orderedPartsAndSegments.segments,
					wrapPartToTemporaryInstance(playlist.activationId, orderedPartsAndSegments.parts[1]),
					orderedPartsAndSegments.parts[0]
				)
			).toBeFalsy()

			// At end
			expect(
				canContinueAdlibOnEndInfinites(
					context,
					playlist,
					orderedPartsAndSegments.segments,
					wrapPartToTemporaryInstance(
						playlist.activationId,
						orderedPartsAndSegments.parts[orderedPartsAndSegments.parts.length - 1]
					),
					orderedPartsAndSegments.parts[orderedPartsAndSegments.parts.length - 2]
				)
			).toBeFalsy()

			// Start to end
			expect(
				canContinueAdlibOnEndInfinites(
					context,
					playlist,
					orderedPartsAndSegments.segments,
					wrapPartToTemporaryInstance(
						playlist.activationId,
						orderedPartsAndSegments.parts[orderedPartsAndSegments.parts.length - 1]
					),
					orderedPartsAndSegments.parts[0]
				)
			).toBeFalsy()
		})
	})

	test('Orphaned PartInstance', async () => {
		await wrapWithCache(async (cache, playlist) => {
			const orderedPartsAndSegments = getOrderedSegmentsAndPartsFromPlayoutCache(cache)
			expect(orderedPartsAndSegments.parts.length).toBeGreaterThan(2)

			const candidatePart = {
				...orderedPartsAndSegments.parts[0],
			}
			// Orphaned because it has no presence in the ordered list
			candidatePart._rank = candidatePart._rank + 0.1
			candidatePart._id = protectString(candidatePart._id + '2')

			// After first
			expect(
				canContinueAdlibOnEndInfinites(
					context,
					playlist,
					orderedPartsAndSegments.segments,
					wrapPartToTemporaryInstance(playlist.activationId, orderedPartsAndSegments.parts[0]),
					candidatePart
				)
			).toBeTruthy()

			// Before second
			expect(
				canContinueAdlibOnEndInfinites(
					context,
					playlist,
					orderedPartsAndSegments.segments,
					wrapPartToTemporaryInstance(playlist.activationId, orderedPartsAndSegments.parts[1]),
					candidatePart
				)
			).toBeFalsy()
		})
	})
})
