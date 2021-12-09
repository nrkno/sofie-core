import { ReadonlyDeep } from 'type-fest'
import { wrapPartToTemporaryInstance } from '../../../../lib/collections/PartInstances'
import { DBRundownPlaylist, RundownPlaylist, RundownPlaylists } from '../../../../lib/collections/RundownPlaylists'
import { Rundown, Rundowns } from '../../../../lib/collections/Rundowns'
import { getRandomId, protectString } from '../../../../lib/lib'
import {
	DefaultEnvironment,
	setupDefaultStudioEnvironment,
	setupDefaultRundownPlaylist,
} from '../../../../__mocks__/helpers/database'
import { beforeEachInFiber, testInFiber } from '../../../../__mocks__/helpers/jest'
import { CacheForPlayout, getOrderedSegmentsAndPartsFromPlayoutCache } from '../cache'
import { canContinueAdlibOnEndInfinites } from '../infinites'
import { runPlayoutOperationWithCache, PlayoutLockFunctionPriority } from '../lockFunction'

describe('canContinueAdlibOnEndInfinites', () => {
	let env: DefaultEnvironment

	beforeEachInFiber(async () => {
		env = await setupDefaultStudioEnvironment()
	})

	async function wrapWithCache<T>(
		fcn: (cache: CacheForPlayout, playlist: ReadonlyDeep<DBRundownPlaylist>) => Promise<T>
	): Promise<T> {
		const defaultSetup = setupDefaultRundownPlaylist(env)

		// Mark playlist as active
		RundownPlaylists.update(defaultSetup.playlistId, {
			$set: {
				activationId: getRandomId(),
			},
		})

		const tmpPlaylist = RundownPlaylists.findOne(defaultSetup.playlistId) as RundownPlaylist
		expect(tmpPlaylist).toBeTruthy()

		const rundown = Rundowns.findOne(defaultSetup.rundownId) as Rundown
		expect(rundown).toBeTruthy()

		return runPlayoutOperationWithCache(
			null,
			'test',
			tmpPlaylist._id,
			PlayoutLockFunctionPriority.USER_PLAYOUT,
			null,
			async (cache) => fcn(cache, cache.Playlist.doc)
		)
	}

	testInFiber('Basic case', async () => {
		await wrapWithCache(async (cache, playlist) => {
			const orderedPartsAndSegments = getOrderedSegmentsAndPartsFromPlayoutCache(cache)
			expect(orderedPartsAndSegments.parts.length).toBeGreaterThan(2)

			// At beginning
			expect(
				canContinueAdlibOnEndInfinites(
					playlist,
					orderedPartsAndSegments.segments,
					wrapPartToTemporaryInstance(playlist.activationId!, orderedPartsAndSegments.parts[0]),
					wrapPartToTemporaryInstance(playlist.activationId!, orderedPartsAndSegments.parts[1])
				)
			).toBeTruthy()

			// Small gap
			expect(
				canContinueAdlibOnEndInfinites(
					playlist,
					orderedPartsAndSegments.segments,
					wrapPartToTemporaryInstance(playlist.activationId!, orderedPartsAndSegments.parts[0]),
					wrapPartToTemporaryInstance(playlist.activationId!, orderedPartsAndSegments.parts[2])
				)
			).toBeTruthy()

			// At end
			expect(
				canContinueAdlibOnEndInfinites(
					playlist,
					orderedPartsAndSegments.segments,
					wrapPartToTemporaryInstance(
						playlist.activationId!,
						orderedPartsAndSegments.parts[orderedPartsAndSegments.parts.length - 2]
					),
					wrapPartToTemporaryInstance(
						playlist.activationId!,
						orderedPartsAndSegments.parts[orderedPartsAndSegments.parts.length - 1]
					)
				)
			).toBeTruthy()

			// Start to end
			expect(
				canContinueAdlibOnEndInfinites(
					playlist,
					orderedPartsAndSegments.segments,
					wrapPartToTemporaryInstance(playlist.activationId!, orderedPartsAndSegments.parts[0]),
					wrapPartToTemporaryInstance(
						playlist.activationId!,
						orderedPartsAndSegments.parts[orderedPartsAndSegments.parts.length - 1]
					)
				)
			).toBeTruthy()
		})
	})

	testInFiber('No previousPartInstance', async () => {
		await wrapWithCache(async (cache, playlist) => {
			const orderedPartsAndSegments = getOrderedSegmentsAndPartsFromPlayoutCache(cache)

			expect(
				canContinueAdlibOnEndInfinites(
					playlist,
					orderedPartsAndSegments.segments,
					undefined,
					wrapPartToTemporaryInstance(playlist.activationId!, orderedPartsAndSegments.parts[1])
				)
			).toBeFalsy()
		})
	})

	testInFiber('Is before', async () => {
		await wrapWithCache(async (cache, playlist) => {
			const orderedPartsAndSegments = getOrderedSegmentsAndPartsFromPlayoutCache(cache)
			expect(orderedPartsAndSegments.parts.length).toBeGreaterThan(2)

			// At beginning
			expect(
				canContinueAdlibOnEndInfinites(
					playlist,
					orderedPartsAndSegments.segments,
					wrapPartToTemporaryInstance(playlist.activationId!, orderedPartsAndSegments.parts[1]),
					wrapPartToTemporaryInstance(playlist.activationId!, orderedPartsAndSegments.parts[0])
				)
			).toBeFalsy()

			// At end
			expect(
				canContinueAdlibOnEndInfinites(
					playlist,
					orderedPartsAndSegments.segments,
					wrapPartToTemporaryInstance(
						playlist.activationId!,
						orderedPartsAndSegments.parts[orderedPartsAndSegments.parts.length - 1]
					),
					wrapPartToTemporaryInstance(
						playlist.activationId!,
						orderedPartsAndSegments.parts[orderedPartsAndSegments.parts.length - 2]
					)
				)
			).toBeFalsy()

			// Start to end
			expect(
				canContinueAdlibOnEndInfinites(
					playlist,
					orderedPartsAndSegments.segments,
					wrapPartToTemporaryInstance(
						playlist.activationId!,
						orderedPartsAndSegments.parts[orderedPartsAndSegments.parts.length - 1]
					),
					wrapPartToTemporaryInstance(playlist.activationId!, orderedPartsAndSegments.parts[0])
				)
			).toBeFalsy()
		})
	})

	testInFiber('Orphaned PartInstance', async () => {
		await wrapWithCache(async (cache, playlist) => {
			const orderedPartsAndSegments = getOrderedSegmentsAndPartsFromPlayoutCache(cache)
			expect(orderedPartsAndSegments.parts.length).toBeGreaterThan(2)

			const candidatePart = wrapPartToTemporaryInstance(playlist.activationId!, {
				...orderedPartsAndSegments.parts[0],
			})
			candidatePart.part._rank = candidatePart.part._rank + 0.1
			candidatePart.part._id = protectString(candidatePart.part._id + '2')
			candidatePart.orphaned = 'adlib-part'

			// After first
			expect(
				canContinueAdlibOnEndInfinites(
					playlist,
					orderedPartsAndSegments.segments,
					wrapPartToTemporaryInstance(playlist.activationId!, orderedPartsAndSegments.parts[0]),
					candidatePart
				)
			).toBeTruthy()

			// Before second
			expect(
				canContinueAdlibOnEndInfinites(
					playlist,
					orderedPartsAndSegments.segments,
					wrapPartToTemporaryInstance(playlist.activationId!, orderedPartsAndSegments.parts[1]),
					candidatePart
				)
			).toBeFalsy()
		})
	})
})
