import { PartInstanceId, RundownId, RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { setupMockShowStyleCompound, setupDefaultRundownPlaylist } from '../../__mocks__/presetCollections'
import { MockJobContext, setupDefaultJobEnvironment } from '../../__mocks__/context'
// import { getResolvedPiecesInner } from '../resolvedPieces'
import { SourceLayers } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { ReadonlyDeep, SetNonNullable } from 'type-fest'
import { protectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { getRandomId } from '@sofie-automation/corelib/dist/lib'
import { IBlueprintPieceType, PieceLifespan } from '@sofie-automation/blueprints-integration'
import {
	PieceInstance,
	PieceInstancePiece,
	ResolvedPieceInstance,
	rewrapPieceToInstance,
} from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { EmptyPieceTimelineObjectsBlob } from '@sofie-automation/corelib/dist/dataModel/Piece'
import _ = require('underscore')
import { JobContext } from '../../jobs'
import { processAndPrunePieceInstanceTimings } from '@sofie-automation/corelib/dist/playout/processAndPrune'
import {
	getResolvedPiecesForPartInstancesOnTimeline,
	getResolvedPiecesFromFullTimeline,
	resolvePrunedPieceInstances,
} from '../resolvedPieces'
import { getPartInstanceTimelineInfo, SelectedPartInstancesTimelineInfo, updateTimeline } from '../timeline/generate'
import { runJobWithPlayoutCache } from '../lock'
import { activateRundownPlaylist } from '../activePlaylistActions'
import { deserializeTimelineBlob, TimelineComplete } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { performTakeToNextedPart } from '../take'
import { CacheForPlayout, getSelectedPartInstancesFromCache } from '../cache'
import { reportPartInstanceHasStarted } from '../timings/partPlayback'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { getCurrentTime } from '../../lib'
import { setupPieceInstanceInfiniteProperties } from '../pieces'

describe('Resolved Pieces', () => {
	let context: MockJobContext
	let playlistId: RundownPlaylistId
	let rundownId: RundownId
	let sourceLayers: ReadonlyDeep<SourceLayers>

	beforeEach(async () => {
		context = setupDefaultJobEnvironment()

		const showStyle = await setupMockShowStyleCompound(context)
		sourceLayers = showStyle.sourceLayers

		const { playlistId: playlistId0, rundownId: rundownId0 } = await setupDefaultRundownPlaylist(context)
		playlistId = playlistId0
		rundownId = rundownId0
	})

	type StrippedResult = Pick<ResolvedPieceInstance, '_id' | 'resolvedStart' | 'resolvedDuration'>[]
	function stripResult(result: ResolvedPieceInstance[]): StrippedResult {
		return result.map((piece) => _.pick(piece, '_id', 'resolvedStart', 'resolvedDuration'))
	}

	function createPieceInstance(
		sourceLayerId: string,
		enable: PieceInstancePiece['enable'],
		piecePartial?: Partial<
			Pick<PieceInstancePiece, 'lifespan' | 'virtual' | 'prerollDuration' | 'postrollDuration'>
		>,
		instancePartial?: Partial<Pick<PieceInstance, 'userDuration'>>
	): PieceInstance {
		return {
			_id: getRandomId(),
			playlistActivationId: protectString(''),
			rundownId,
			partInstanceId: protectString(''),
			disabled: false,
			piece: {
				_id: getRandomId(),
				externalId: '',
				startPartId: protectString(''),
				invalid: false,
				name: '',
				content: {},
				pieceType: IBlueprintPieceType.Normal,
				sourceLayerId,
				outputLayerId: '',
				lifespan: piecePartial?.lifespan ?? PieceLifespan.WithinPart,
				enable,
				virtual: piecePartial?.virtual ?? false,
				timelineObjectsString: EmptyPieceTimelineObjectsBlob,
			},
			userDuration: instancePartial?.userDuration,
		}
	}

	function getResolvedPiecesInner(
		_context: JobContext,
		sourceLayers: SourceLayers,
		_playlistId: RundownPlaylistId,
		_partInstanceId: PartInstanceId,
		nowInPart: number | null,
		pieceInstances: PieceInstance[]
	): ResolvedPieceInstance[] {
		const preprocessedPieces = processAndPrunePieceInstanceTimings(sourceLayers, pieceInstances, nowInPart ?? 0)
		return resolvePrunedPieceInstances(nowInPart ?? 0, preprocessedPieces)
	}

	test('simple single piece', async () => {
		const sourceLayerId = Object.keys(sourceLayers)[0]
		expect(sourceLayerId).toBeTruthy()

		const piece0 = createPieceInstance(sourceLayerId, { start: 0 })

		const resolvedPieces = getResolvedPiecesInner(
			context,
			sourceLayers,
			playlistId,
			protectString('partInstance0'),
			null,
			[piece0]
		)

		expect(stripResult(resolvedPieces)).toEqual([
			{
				_id: piece0._id,
				resolvedStart: 0,
				resolvedDuration: undefined,
			},
		] satisfies StrippedResult)
	})

	test('non-overlapping simple pieces', async () => {
		const sourceLayerId = Object.keys(sourceLayers)[0]
		expect(sourceLayerId).toBeTruthy()

		const piece0 = createPieceInstance(sourceLayerId, { start: 1000, duration: 2000 })
		const piece1 = createPieceInstance(sourceLayerId, { start: 4000 })

		const resolvedPieces = getResolvedPiecesInner(
			context,
			sourceLayers,
			playlistId,
			protectString('partInstance0'),
			null,
			[piece0, piece1]
		)

		expect(stripResult(resolvedPieces)).toEqual([
			{
				_id: piece0._id,
				resolvedStart: 1000,
				resolvedDuration: 2000,
			},
			{
				_id: piece1._id,
				resolvedStart: 4000,
				resolvedDuration: undefined,
			},
		] satisfies StrippedResult)
	})

	test('overlapping simple pieces', async () => {
		const sourceLayerId = Object.keys(sourceLayers)[0]
		expect(sourceLayerId).toBeTruthy()

		const piece0 = createPieceInstance(sourceLayerId, { start: 1000, duration: 8000 })
		const piece1 = createPieceInstance(sourceLayerId, { start: 4000 })

		const resolvedPieces = getResolvedPiecesInner(
			context,
			sourceLayers,
			playlistId,
			protectString('partInstance0'),
			null,
			[piece0, piece1]
		)

		expect(stripResult(resolvedPieces)).toEqual([
			{
				_id: piece0._id,
				resolvedStart: 1000,
				resolvedDuration: 3000,
			},
			{
				_id: piece1._id,
				resolvedStart: 4000,
				resolvedDuration: undefined,
			},
		] satisfies StrippedResult)
	})

	test('colliding infinites', async () => {
		const sourceLayerId = Object.keys(sourceLayers)[0]
		expect(sourceLayerId).toBeTruthy()

		const piece0 = createPieceInstance(sourceLayerId, { start: 1000 }, { lifespan: PieceLifespan.OutOnRundownEnd })
		const piece1 = createPieceInstance(sourceLayerId, { start: 4000 }, { lifespan: PieceLifespan.OutOnSegmentEnd })
		const piece2 = createPieceInstance(sourceLayerId, { start: 8000, duration: 2000 })

		const resolvedPieces = getResolvedPiecesInner(
			context,
			sourceLayers,
			playlistId,
			protectString('partInstance0'),
			null,
			[piece0, piece1, piece2]
		)

		expect(stripResult(resolvedPieces)).toEqual([
			{
				_id: piece0._id,
				resolvedStart: 1000,
				resolvedDuration: undefined,
			},
			{
				_id: piece1._id,
				resolvedStart: 4000,
				resolvedDuration: undefined,
			},
			{
				_id: piece2._id,
				resolvedStart: 8000,
				resolvedDuration: 2000,
			},
		] satisfies StrippedResult)
	})

	test('stopped by virtual', async () => {
		const sourceLayerId = Object.keys(sourceLayers)[0]
		expect(sourceLayerId).toBeTruthy()

		const piece0 = createPieceInstance(sourceLayerId, { start: 1000 }, { lifespan: PieceLifespan.OutOnRundownEnd })
		const piece1 = createPieceInstance(
			sourceLayerId,
			{ start: 4000 },
			{ lifespan: PieceLifespan.OutOnRundownEnd, virtual: true }
		)

		const resolvedPieces = getResolvedPiecesInner(
			context,
			sourceLayers,
			playlistId,
			protectString('partInstance0'),
			null,
			[piece0, piece1]
		)

		expect(stripResult(resolvedPieces)).toEqual([
			{
				_id: piece0._id,
				resolvedStart: 1000,
				resolvedDuration: 3000,
			},
		] satisfies StrippedResult)
	})

	test('part not playing, timed interacts with "now"', async () => {
		const sourceLayerId = Object.keys(sourceLayers)[0]
		expect(sourceLayerId).toBeTruthy()

		const piece0 = createPieceInstance(sourceLayerId, { start: 1000 })
		const piece1 = createPieceInstance(
			sourceLayerId,
			{ start: 'now' },
			{ lifespan: PieceLifespan.WithinPart, virtual: true }
		)

		const resolvedPieces = getResolvedPiecesInner(
			context,
			sourceLayers,
			playlistId,
			protectString('partInstance0'),
			null,
			[piece0, piece1]
		)

		expect(stripResult(resolvedPieces)).toEqual([
			{
				_id: piece1._id,
				resolvedStart: 0,
				resolvedDuration: 1000,
			},
			{
				_id: piece0._id,
				resolvedStart: 1000,
				resolvedDuration: undefined,
			},
		] satisfies StrippedResult)
	})

	test('part is playing, timed interacts with "now"', async () => {
		const sourceLayerId = Object.keys(sourceLayers)[0]
		expect(sourceLayerId).toBeTruthy()

		const piece0 = createPieceInstance(sourceLayerId, { start: 1000 })
		const piece1 = createPieceInstance(
			sourceLayerId,
			{ start: 'now' },
			{ lifespan: PieceLifespan.WithinPart, virtual: true }
		)

		const resolvedPieces = getResolvedPiecesInner(
			context,
			sourceLayers,
			playlistId,
			protectString('partInstance0'),
			2500,
			[piece0, piece1]
		)

		expect(stripResult(resolvedPieces)).toEqual([
			{
				_id: piece0._id,
				resolvedStart: 1000,
				resolvedDuration: 1500,
			},
			{
				_id: piece1._id,
				resolvedStart: 2500,
				resolvedDuration: undefined,
			},
		] satisfies StrippedResult)
	})

	test('userDuration.endRelativeToPart', async () => {
		const sourceLayerId = Object.keys(sourceLayers)[0]
		expect(sourceLayerId).toBeTruthy()

		const piece0 = createPieceInstance(
			sourceLayerId,
			{ start: 1000 },
			{},
			{
				userDuration: {
					endRelativeToPart: 2000,
				},
			}
		)

		const resolvedPieces = getResolvedPiecesInner(
			context,
			sourceLayers,
			playlistId,
			protectString('partInstance0'),
			2500,
			[piece0]
		)

		expect(stripResult(resolvedPieces)).toEqual([
			{
				_id: piece0._id,
				resolvedStart: 1000,
				resolvedDuration: 1000,
			},
		] satisfies StrippedResult)
	})

	test('userDuration.endRelativeToNow', async () => {
		const sourceLayerId = Object.keys(sourceLayers)[0]
		expect(sourceLayerId).toBeTruthy()

		const piece0 = createPieceInstance(
			sourceLayerId,
			{ start: 1000 },
			{},
			{
				userDuration: {
					endRelativeToNow: 2000,
				},
			}
		)

		const resolvedPieces = getResolvedPiecesInner(
			context,
			sourceLayers,
			playlistId,
			protectString('partInstance0'),
			2500,
			[piece0]
		)

		expect(stripResult(resolvedPieces)).toEqual([
			{
				_id: piece0._id,
				resolvedStart: 1000,
				resolvedDuration: 3500,
			},
		] satisfies StrippedResult)
	})

	test('preroll has no effect', async () => {
		const sourceLayerId = Object.keys(sourceLayers)[0]
		expect(sourceLayerId).toBeTruthy()

		const piece0 = createPieceInstance(
			sourceLayerId,
			{ start: 1000 },
			{
				prerollDuration: 500,
			}
		)

		const resolvedPieces = getResolvedPiecesInner(
			context,
			sourceLayers,
			playlistId,
			protectString('partInstance0'),
			null,
			[piece0]
		)

		expect(stripResult(resolvedPieces)).toEqual([
			{
				_id: piece0._id,
				resolvedStart: 1000,
				resolvedDuration: undefined,
			},
		] satisfies StrippedResult)
	})

	test('postroll has no effect', async () => {
		const sourceLayerId = Object.keys(sourceLayers)[0]
		expect(sourceLayerId).toBeTruthy()

		const piece0 = createPieceInstance(
			sourceLayerId,
			{ start: 1000, duration: 1000 },
			{
				postrollDuration: 500,
			}
		)

		const resolvedPieces = getResolvedPiecesInner(
			context,
			sourceLayers,
			playlistId,
			protectString('partInstance0'),
			null,
			[piece0]
		)

		expect(stripResult(resolvedPieces)).toEqual([
			{
				_id: piece0._id,
				resolvedStart: 1000,
				resolvedDuration: 1000,
			},
		] satisfies StrippedResult)
	})

	describe('From Timeline', () => {
		async function loadCacheAndPerformTakes(
			takeCount: number,
			fn: (
				cache: CacheForPlayout,
				partInstances: SetNonNullable<
					ReturnType<typeof getSelectedPartInstancesFromCache>,
					'currentPartInstance' | 'nextPartInstance'
				>,
				now: number
			) => Promise<void>
		) {
			await runJobWithPlayoutCache(context, { playlistId }, null, async (cache) => {
				let now = Date.now()

				await activateRundownPlaylist(context, cache, false)

				for (let i = 0; i < takeCount; i++) {
					// Do the take
					await performTakeToNextedPart(context, cache, now)

					const currentPartInstance = getSelectedPartInstancesFromCache(cache)
						.currentPartInstance as DBPartInstance
					expect(currentPartInstance).toBeTruthy()

					// Confirm playback as starting
					reportPartInstanceHasStarted(context, cache, currentPartInstance, now)

					now += 5000
				}

				const partInstances = getSelectedPartInstancesFromCache(cache)
				expect(partInstances.previousPartInstance).toBeFalsy()
				expect(partInstances.currentPartInstance).toBeTruthy()
				expect(partInstances.nextPartInstance).toBeTruthy()

				await fn(cache, partInstances as any, now)
			})
		}

		function fetchTimelineObjs(cache: CacheForPlayout) {
			const timelineDoc = cache.Timeline.doc as TimelineComplete
			expect(timelineDoc).toBeTruthy()
			return deserializeTimelineBlob(timelineDoc.timelineBlob)
		}

		function doResolvePieces(cache: CacheForPlayout, now: number) {
			const timelineObjs = fetchTimelineObjs(cache)

			return getResolvedPiecesFromFullTimeline(context, cache, timelineObjs, now)
		}

		function loadSelectedPartInstancesTimelineInfo(
			cache: CacheForPlayout,
			currentTime: number
		): SelectedPartInstancesTimelineInfo {
			const { currentPartInstance, nextPartInstance, previousPartInstance } =
				getSelectedPartInstancesFromCache(cache)
			const partInstancesInfo: SelectedPartInstancesTimelineInfo = {
				current: getPartInstanceTimelineInfo(cache, currentTime, sourceLayers, currentPartInstance),
				next: getPartInstanceTimelineInfo(cache, currentTime, sourceLayers, nextPartInstance),
				previous: getPartInstanceTimelineInfo(cache, currentTime, sourceLayers, previousPartInstance),
			}
			return partInstancesInfo
		}

		test('simple part scenario', async () => {
			await loadCacheAndPerformTakes(1, async (cache, parts, now) => {
				const resolvedPieces = doResolvePieces(cache, now)

				expect(stripResult(resolvedPieces)).toEqual([
					{
						_id: protectString(`${parts.currentPartInstance?._id}_${rundownId}_piece001`),
						resolvedStart: now - 1,
						resolvedDuration: undefined,
					},
				] satisfies StrippedResult)
			})
		})

		test('single piece stopped by virtual now', async () => {
			await loadCacheAndPerformTakes(1, async (cache, parts, now) => {
				// Add some extra pieceInstances

				// const getPieceInstances = () =>
				// 	cache.PieceInstances.findAll((p) => p.partInstanceId === parts.currentPartInstance._id)

				// console.log(getPieceInstances())
				// // cache.PieceInstances.insert()
				// const pieceInstanceCount = getPieceInstances().length
				// // expect(
				// // 	innerStopPieces(context, cache, sourceLayers, parts.currentPartInstance, () => true, undefined)
				// // ).toHaveLength(1)
				// expect(getPieceInstances().length).toBe(pieceInstanceCount + 1)
				// // innerStartAdLibPiece()

				const piece001Id = protectString(`${parts.currentPartInstance?._id}_${rundownId}_piece001`)
				const piece001 = cache.PieceInstances.findOne(piece001Id) as PieceInstance
				expect(piece001).toBeTruthy()
				expect(piece001.piece.lifespan).toBe(PieceLifespan.WithinPart)

				// Manually insert a virtual piece on the same layer
				const virtualId = cache.PieceInstances.insert({
					...rewrapPieceToInstance(
						{
							_id: getRandomId(),
							externalId: '-',
							enable: { start: 'now' },
							lifespan: piece001.piece.lifespan,
							sourceLayerId: piece001.piece.sourceLayerId,
							outputLayerId: piece001.piece.outputLayerId,
							invalid: false,
							name: '',
							startPartId: parts.currentPartInstance.part._id,
							pieceType: IBlueprintPieceType.Normal,
							virtual: true,
							content: {},
							timelineObjectsString: EmptyPieceTimelineObjectsBlob,
						},
						parts.currentPartInstance.playlistActivationId,
						parts.currentPartInstance.rundownId,
						parts.currentPartInstance._id
					),
					dynamicallyInserted: getCurrentTime(),
				})

				// rebuild the timeline
				await updateTimeline(context, cache)

				// Check the result
				const laterNow = now + 2000
				const resolvedPieces = doResolvePieces(cache, laterNow)

				expect(stripResult(resolvedPieces)).toEqual([
					{
						_id: piece001Id,
						resolvedStart: now - 5000 - 1,
						resolvedDuration: undefined, // TODO - this should havea  value?
					},
					{
						// TODO - this object should not be present?
						_id: virtualId,
						resolvedStart: laterNow - 1,
						resolvedDuration: undefined,
					},
				] satisfies StrippedResult)

				// Check the 'simple' route result
				const partInstancesInfo = loadSelectedPartInstancesTimelineInfo(cache, laterNow)
				const simpleResolvedPieces = getResolvedPiecesForPartInstancesOnTimeline(
					context,
					partInstancesInfo,
					laterNow
				)
				expect(stripResult(simpleResolvedPieces)).toEqual([
					{
						_id: piece001Id,
						resolvedStart: now - 5000,
						resolvedDuration: laterNow - (now - 5000),
					},
					{
						// TODO - this object should not be present?
						_id: virtualId,
						resolvedStart: laterNow,
						resolvedDuration: undefined,
					},
				] satisfies StrippedResult)
			})
		})

		test('single piece stopped by timed now', async () => {
			await loadCacheAndPerformTakes(1, async (cache, parts, now) => {
				// Add an extra pieceInstances
				const piece001Id = protectString(`${parts.currentPartInstance?._id}_${rundownId}_piece001`)
				const piece001 = cache.PieceInstances.findOne(piece001Id) as PieceInstance
				expect(piece001).toBeTruthy()
				expect(piece001.partInstanceId).toBe(parts.currentPartInstance._id)
				expect(piece001.piece.lifespan).toBe(PieceLifespan.WithinPart)

				// Manually insert a virtual piece on the same layer
				const virtualId = cache.PieceInstances.insert({
					...rewrapPieceToInstance(
						{
							_id: getRandomId(),
							externalId: '-',
							enable: { start: 7000 },
							lifespan: piece001.piece.lifespan,
							sourceLayerId: piece001.piece.sourceLayerId,
							outputLayerId: piece001.piece.outputLayerId,
							invalid: false,
							name: '',
							startPartId: parts.currentPartInstance.part._id,
							pieceType: IBlueprintPieceType.Normal,
							virtual: true,
							content: {},
							timelineObjectsString: EmptyPieceTimelineObjectsBlob,
						},
						parts.currentPartInstance.playlistActivationId,
						parts.currentPartInstance.rundownId,
						parts.currentPartInstance._id
					),
					dynamicallyInserted: getCurrentTime(),
				})

				// rebuild the timeline
				await updateTimeline(context, cache)

				// Check the result
				const laterNow = now + 2000
				const resolvedPieces = doResolvePieces(cache, laterNow)

				expect(stripResult(resolvedPieces)).toEqual([
					{
						_id: piece001Id,
						resolvedStart: now - 5000 - 1,
						resolvedDuration: undefined, // TODO - this should have a value?
					},
					{
						// TODO - this object should not be present?
						_id: virtualId,
						resolvedStart: laterNow - 1,
						resolvedDuration: undefined,
					},
				] satisfies StrippedResult)

				// Check the 'simple' route result
				const partInstancesInfo = loadSelectedPartInstancesTimelineInfo(cache, laterNow)
				const simpleResolvedPieces = getResolvedPiecesForPartInstancesOnTimeline(
					context,
					partInstancesInfo,
					laterNow
				)
				expect(stripResult(simpleResolvedPieces)).toEqual([
					{
						_id: piece001Id,
						resolvedStart: now - 5000,
						resolvedDuration: laterNow - (now - 5000),
					},
					{
						// TODO - this object should not be present?
						_id: virtualId,
						resolvedStart: laterNow,
						resolvedDuration: undefined,
					},
				] satisfies StrippedResult)
			})
		})

		test('within part overriding infinite for period', async () => {
			await loadCacheAndPerformTakes(1, async (cache, parts, now) => {
				const piece001Id = protectString(`${parts.currentPartInstance?._id}_${rundownId}_piece001`)

				// Remove any unwanted pieceInstances
				cache.PieceInstances.remove(
					(p) => p.partInstanceId === parts.currentPartInstance._id && p._id !== piece001Id
				)

				// Change the start of piece001
				const piece001 = cache.PieceInstances.findOne(piece001Id) as PieceInstance
				expect(piece001).toBeTruthy()
				expect(piece001.partInstanceId).toBe(parts.currentPartInstance._id)
				expect(piece001.piece.lifespan).toBe(PieceLifespan.WithinPart)

				cache.PieceInstances.updateOne(piece001Id, (p) => {
					p.piece.enable = { start: 3000, duration: 2500 }
					return p
				})

				// Manually insert an infinite piece on the same layer
				const infinitePiece = rewrapPieceToInstance(
					{
						_id: getRandomId(),
						externalId: '-',
						enable: { start: 1000 },
						lifespan: PieceLifespan.OutOnSegmentEnd,
						sourceLayerId: piece001.piece.sourceLayerId,
						outputLayerId: piece001.piece.outputLayerId,
						invalid: false,
						name: '',
						startPartId: parts.currentPartInstance.part._id,
						pieceType: IBlueprintPieceType.Normal,
						content: {},
						timelineObjectsString: EmptyPieceTimelineObjectsBlob,
					},
					parts.currentPartInstance.playlistActivationId,
					parts.currentPartInstance.rundownId,
					parts.currentPartInstance._id
				)
				infinitePiece.dynamicallyInserted = getCurrentTime()
				setupPieceInstanceInfiniteProperties(infinitePiece)
				const infiniteId = cache.PieceInstances.insert(infinitePiece)

				// rebuild the timeline
				await updateTimeline(context, cache)

				// Check the result
				const laterNow = now + 2000
				const resolvedPieces = doResolvePieces(cache, laterNow)

				expect(stripResult(resolvedPieces)).toEqual([
					{
						_id: infiniteId,
						resolvedStart: now - 5000 + 1000 - 1,
						resolvedDuration: undefined,
					},
					{
						_id: piece001Id,
						resolvedStart: now - 5000 + 3000 - 1,
						resolvedDuration: 2500,
					},
				] satisfies StrippedResult)

				// Check the 'simple' route result
				const partInstancesInfo = loadSelectedPartInstancesTimelineInfo(cache, laterNow)
				const simpleResolvedPieces = getResolvedPiecesForPartInstancesOnTimeline(
					context,
					partInstancesInfo,
					laterNow
				)
				expect(stripResult(simpleResolvedPieces)).toEqual([
					{
						_id: infiniteId,
						resolvedStart: now - 5000 + 1000,
						resolvedDuration: undefined,
					},
					{
						_id: piece001Id,
						resolvedStart: now - 5000 + 3000,
						resolvedDuration: 2500,
					},
				] satisfies StrippedResult)
			})
		})

		/**
		 * TODO: stress doResolvePieces in some more 'complex' scenarios of mixing infinites, exclusive groups, and non infinites
		 * also throw in the concept of having a previous or next part on the timeline
		 * and make sure to 'stress' the logic for whether to include the next/previous matches in playout.
		 * finally, switch it across to the new implementation and debug
		 */

		// TODO - more scenarios
	})
})
