import * as _ from 'underscore'
import {
	IBlueprintPart,
	IBlueprintPiece,
	IBlueprintPieceType,
	PieceLifespan,
} from '@sofie-automation/blueprints-integration'
import { ActionExecutionContext, ActionPartChange } from '../context/adlibActions'
import { isTooCloseToAutonext } from '../../playout/lib'
import { CacheForPlayout } from '../../playout/cache'
import { WatchedPackagesHelper } from '../context/watchedPackages'
import { ReadonlyDeep } from 'type-fest'
import { setupDefaultJobEnvironment } from '../../__mocks__/context'
import { runJobWithPlayoutCache } from '../../playout/lock'
import { defaultRundownPlaylist } from '../../__mocks__/defaultCollectionObjects'
import { protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { clone, getRandomId, literal, omit } from '@sofie-automation/corelib/dist/lib'
import {
	PartInstanceId,
	PieceInstanceId,
	RundownId,
	RundownPlaylistActivationId,
	RundownPlaylistId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { setupDefaultRundown, setupMockShowStyleCompound } from '../../__mocks__/presetCollections'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { JobContext } from '../../jobs'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { PieceInstance, ResolvedPieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { getCurrentTime } from '../../lib'
import {
	EmptyPieceTimelineObjectsBlob,
	serializePieceTimelineObjectsBlob,
} from '@sofie-automation/corelib/dist/dataModel/Piece'

import * as PlayoutAdlib from '../../playout/adlib'
type TinnerStopPieces = jest.MockedFunction<typeof PlayoutAdlib.innerStopPieces>
const innerStopPiecesMock = jest.spyOn(PlayoutAdlib, 'innerStopPieces') as TinnerStopPieces

const innerStartAdLibPieceOrig = PlayoutAdlib.innerStartAdLibPiece
type TinnerStartAdLibPiece = jest.MockedFunction<typeof PlayoutAdlib.innerStartAdLibPiece>
const innerStartAdLibPieceMock = jest.spyOn(PlayoutAdlib, 'innerStartAdLibPiece') as TinnerStartAdLibPiece

const innerStartQueuedAdLibOrig = PlayoutAdlib.innerStartQueuedAdLib
type TinnerStartQueuedAdLib = jest.MockedFunction<typeof PlayoutAdlib.innerStartQueuedAdLib>
const innerStartQueuedAdLibMock = jest.spyOn(PlayoutAdlib, 'innerStartQueuedAdLib') as TinnerStartQueuedAdLib

jest.mock('../../playout/pieces')
import { getResolvedPieces } from '../../playout/pieces'
type TgetResolvedPieces = jest.MockedFunction<typeof getResolvedPieces>
const getResolvedPiecesMock = getResolvedPieces as TgetResolvedPieces

jest.mock('../postProcess')
import { postProcessPieces, postProcessTimelineObjects } from '../postProcess'
import { convertPartInstanceToBlueprints, convertPieceInstanceToBlueprints } from '../context/lib'
import { TimelineObjRundown, TimelineObjType } from '@sofie-automation/corelib/dist/dataModel/Timeline'
const { postProcessPieces: postProcessPiecesOrig, postProcessTimelineObjects: postProcessTimelineObjectsOrig } =
	jest.requireActual('../postProcess')

type TpostProcessPieces = jest.MockedFunction<typeof postProcessPieces>
const postProcessPiecesMock = postProcessPieces as TpostProcessPieces
postProcessPiecesMock.mockImplementation(() => [])

type TpostProcessTimelineObjects = jest.MockedFunction<typeof postProcessTimelineObjects>
const postProcessTimelineObjectsMock = postProcessTimelineObjects as TpostProcessTimelineObjects
postProcessTimelineObjectsMock.mockImplementation(postProcessTimelineObjectsOrig)

describe('Test blueprint api context', () => {
	async function generateSparsePieceInstances(
		context: JobContext,
		activationId: RundownPlaylistActivationId,
		rundownId: RundownId
	): Promise<DBPartInstance[]> {
		const parts = await context.directCollections.Parts.findFetch({ rundownId })
		for (let i = 0; i < parts.length; i++) {
			const part = parts[i]

			// make into a partInstance
			await context.directCollections.PartInstances.insertOne({
				_id: protectString(`${part._id}_instance`),
				rundownId: part.rundownId,
				segmentId: part.segmentId,
				playlistActivationId: activationId,
				segmentPlayoutId: protectString(''),
				takeCount: i,
				rehearsal: false,
				part,
			})

			const pieces = await context.directCollections.Pieces.findFetch({
				startPartId: part._id,
				startRundownId: rundownId,
			})
			for (const p of pieces) {
				await context.directCollections.PieceInstances.insertOne({
					_id: protectString(`${part._id}_piece_${p._id}`),
					rundownId: rundownId,
					partInstanceId: protectString(`${part._id}_instance`),
					playlistActivationId: activationId,
					piece: p,
				})
			}

			const count = ((i + 2) % 4) + 1 // Some consistent randomness
			for (let o = 0; o < count; o++) {
				await context.directCollections.PieceInstances.insertOne({
					_id: protectString(`${part._id}_piece${o}`),
					rundownId: rundownId,
					partInstanceId: protectString(`${part._id}_instance`),
					playlistActivationId: activationId,
					piece: {
						_id: protectString(`${part._id}_piece_inner${o}`),
						externalId: '-',
						enable: { start: 0 },
						name: 'mock',
						status: -1,
						sourceLayerId: '',
						outputLayerId: '',
						startPartId: part._id,
						content: {
							index: o,
						} as any,
						timelineObjectsString: EmptyPieceTimelineObjectsBlob,
						lifespan: PieceLifespan.WithinPart,
						pieceType: IBlueprintPieceType.Normal,
						invalid: false,
					},
				})
			}
		}

		return context.directCollections.PartInstances.findFetch({ rundownId })
	}

	// let context: MockJobContext
	// beforeAll(async () => {
	// 	context = await setupDefaultJobEnvironment()
	// })

	async function getActionExecutionContext(jobContext: JobContext, cache: CacheForPlayout) {
		const playlist = cache.Playlist.doc
		expect(playlist).toBeTruthy()
		const rundown = cache.Rundowns.findOne({}) as DBRundown
		expect(rundown).toBeTruthy()

		const activationId = playlist.activationId as RundownPlaylistActivationId
		expect(activationId).toBeTruthy()

		const showStyle = await jobContext.getShowStyleCompound(rundown.showStyleVariantId, rundown.showStyleBaseId)
		const showStyleConfig = jobContext.getShowStyleBlueprintConfig(showStyle)

		const watchedPackages = WatchedPackagesHelper.empty(jobContext) // Not needed by the tests for now

		const context = new ActionExecutionContext(
			{
				name: 'fakeContext',
				identifier: 'action',
			},
			jobContext,
			cache,
			showStyle,
			showStyleConfig,
			rundown,
			watchedPackages
		)
		expect(context.studio).toBe(jobContext.studio)

		return {
			playlist,
			rundown,
			context,
			activationId,
		}
	}

	async function wrapWithCache<T>(
		context: JobContext,
		playlistId: RundownPlaylistId,
		fcn: (cache: CacheForPlayout) => Promise<T>
	): Promise<T> {
		return runJobWithPlayoutCache(context, { playlistId }, null, fcn)
	}

	async function setupMyDefaultRundown(): Promise<{
		jobContext: JobContext
		playlistId: RundownPlaylistId
		rundownId: RundownId
		allPartInstances: DBPartInstance[]
	}> {
		const context = setupDefaultJobEnvironment()

		const playlistId: RundownPlaylistId = protectString('playlist0')
		const activationId: RundownPlaylistActivationId = getRandomId()

		await context.directCollections.RundownPlaylists.insertOne({
			...defaultRundownPlaylist(playlistId, context.studioId),
			// Mark playlist as active
			activationId: activationId,
		})

		const showStyleCompound = await setupMockShowStyleCompound(context)
		expect(showStyleCompound).toBeTruthy()

		const rundownId: RundownId = getRandomId()

		await setupDefaultRundown(context, showStyleCompound, playlistId, rundownId)

		const allPartInstances = await generateSparsePieceInstances(context, activationId, rundownId)
		expect(allPartInstances).toHaveLength(5)

		return {
			jobContext: context,
			playlistId: playlistId,
			rundownId: rundownId,
			allPartInstances,
		}
	}

	describe('ActionExecutionContext', () => {
		describe('getPartInstance', () => {
			test('invalid parameters', async () => {
				const { jobContext, playlistId } = await setupMyDefaultRundown()

				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					// @ts-ignore
					await expect(context.getPartInstance()).rejects.toThrowError('Unknown part "undefined"')
					// @ts-ignore
					await expect(context.getPartInstance('abc')).rejects.toThrowError('Unknown part "abc"')
					// @ts-ignore
					await expect(context.getPartInstance(6)).rejects.toThrowError('Unknown part "6"')
					// @ts-ignore
					await expect(context.getPartInstance('previous')).rejects.toThrowError('Unknown part "previous"')
				})
			})

			test('valid parameters', async () => {
				const { jobContext, playlistId, allPartInstances } = await setupMyDefaultRundown()

				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					expect(cache.PartInstances.documents.size).toBe(0)

					await expect(context.getPartInstance('next')).resolves.toBeUndefined()
					await expect(context.getPartInstance('current')).resolves.toBeUndefined()
				})

				await jobContext.directCollections.RundownPlaylists.update(playlistId, {
					$set: { currentPartInstanceId: allPartInstances[1]._id },
				})
				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					expect(cache.PartInstances.documents.size).toBe(2)

					// Check the current part
					await expect(context.getPartInstance('next')).resolves.toBeUndefined()
					await expect(context.getPartInstance('current')).resolves.toMatchObject({
						_id: allPartInstances[1]._id,
					})
				})

				await jobContext.directCollections.RundownPlaylists.update(playlistId, {
					$set: { currentPartInstanceId: null, nextPartInstanceId: allPartInstances[2]._id },
				})
				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					expect(cache.PartInstances.documents.size).toBe(3)

					// Now the next part
					await expect(context.getPartInstance('next')).resolves.toMatchObject({
						_id: allPartInstances[2]._id,
					})
					await expect(context.getPartInstance('current')).resolves.toBeUndefined()
				})
			})
		})
		describe('getPieceInstances', () => {
			test('invalid parameters', async () => {
				const { jobContext, playlistId } = await setupMyDefaultRundown()

				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					// @ts-ignore
					await expect(context.getPieceInstances()).rejects.toThrowError('Unknown part "undefined"')
					// @ts-ignore
					await expect(context.getPieceInstances('abc')).rejects.toThrowError('Unknown part "abc"')
					// @ts-ignore
					await expect(context.getPieceInstances(6)).rejects.toThrowError('Unknown part "6"')
					// @ts-ignore
					await expect(context.getPieceInstances('previous')).rejects.toThrowError('Unknown part "previous"')
				})
			})

			test('valid parameters', async () => {
				const { jobContext, playlistId, allPartInstances } = await setupMyDefaultRundown()

				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					expect(cache.PartInstances.documents.size).toBe(0)

					await expect(context.getPieceInstances('next')).resolves.toHaveLength(0)
					await expect(context.getPieceInstances('current')).resolves.toHaveLength(0)
				})

				await jobContext.directCollections.RundownPlaylists.update(playlistId, {
					$set: { currentPartInstanceId: allPartInstances[1]._id },
				})
				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					expect(cache.PartInstances.documents.size).toBe(2)

					// Check the current part
					await expect(context.getPieceInstances('next')).resolves.toHaveLength(0)
					await expect(context.getPieceInstances('current')).resolves.toHaveLength(5)
				})

				await jobContext.directCollections.RundownPlaylists.update(playlistId, {
					$set: { currentPartInstanceId: null, nextPartInstanceId: allPartInstances[2]._id },
				})
				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					expect(cache.PartInstances.documents.size).toBe(3)

					// Now the next part
					await expect(context.getPieceInstances('next')).resolves.toHaveLength(1)
					await expect(context.getPieceInstances('current')).resolves.toHaveLength(0)
				})
			})
		})
		describe('getResolvedPieceInstances', () => {
			test('invalid parameters', async () => {
				const { jobContext, playlistId } = await setupMyDefaultRundown()

				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					// @ts-ignore
					await expect(context.getResolvedPieceInstances()).rejects.toThrowError('Unknown part "undefined"')
					// @ts-ignore
					await expect(context.getResolvedPieceInstances('abc')).rejects.toThrowError('Unknown part "abc"')
					// @ts-ignore
					await expect(context.getResolvedPieceInstances(6)).rejects.toThrowError('Unknown part "6"')
					// @ts-ignore
					await expect(context.getResolvedPieceInstances('previous')).rejects.toThrowError(
						'Unknown part "previous"'
					)
				})
			})

			test('valid parameters', async () => {
				const { jobContext, playlistId, allPartInstances } = await setupMyDefaultRundown()

				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					expect(cache.PartInstances.documents.size).toBe(0)

					expect(getResolvedPiecesMock).toHaveBeenCalledTimes(0)

					await expect(context.getResolvedPieceInstances('next')).resolves.toHaveLength(0)
					await expect(context.getResolvedPieceInstances('current')).resolves.toHaveLength(0)
					expect(getResolvedPiecesMock).toHaveBeenCalledTimes(0)
				})

				let mockCalledIds: PartInstanceId[] = []
				getResolvedPiecesMock.mockImplementation(
					(
						context2: JobContext,
						cache2: CacheForPlayout,
						showStyleBase: ReadonlyDeep<DBShowStyleBase>,
						partInstance: DBPartInstance
					) => {
						expect(context2).toBe(jobContext)
						expect(cache2).toBeInstanceOf(CacheForPlayout)
						expect(showStyleBase).toBeTruthy()
						mockCalledIds.push(partInstance._id)
						return [
							{
								_id: 'abc',
								piece: {
									timelineObjectsString: EmptyPieceTimelineObjectsBlob,
								},
							},
						] as any as ResolvedPieceInstance[]
					}
				)

				await jobContext.directCollections.RundownPlaylists.update(playlistId, {
					$set: { currentPartInstanceId: allPartInstances[1]._id },
				})
				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					expect(cache.PartInstances.documents.size).toBe(2)
					// Check the current part
					await expect(context.getResolvedPieceInstances('next')).resolves.toHaveLength(0)
					await expect(
						context.getResolvedPieceInstances('current').then((res) => res.map((p) => p._id))
					).resolves.toEqual(['abc'])
					expect(getResolvedPiecesMock).toHaveBeenCalledTimes(1)
					expect(mockCalledIds).toEqual([allPartInstances[1]._id])
				})

				mockCalledIds = []
				getResolvedPiecesMock.mockClear()

				await jobContext.directCollections.RundownPlaylists.update(playlistId, {
					$set: { currentPartInstanceId: null, nextPartInstanceId: allPartInstances[2]._id },
				})
				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					expect(cache.PartInstances.documents.size).toBe(3)

					// Now the next part
					await expect(
						context.getResolvedPieceInstances('next').then((res) => res.map((p) => p._id))
					).resolves.toEqual(['abc'])
					await expect(context.getResolvedPieceInstances('current')).resolves.toHaveLength(0)
					expect(getResolvedPiecesMock).toHaveBeenCalledTimes(1)
					expect(mockCalledIds).toEqual([allPartInstances[2]._id])
				})
			})
		})
		describe('findLastPieceOnLayer', () => {
			test('invalid parameters', async () => {
				const { jobContext, playlistId } = await setupMyDefaultRundown()

				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					// We need to push changes back to 'mongo' for these tests
					await cache.saveAllToDatabase()

					// @ts-ignore
					await expect(context.findLastPieceOnLayer()).resolves.toBeUndefined()
					// @ts-ignore
					await expect(context.findLastPieceOnLayer(9867, 'hi')).resolves.toBeUndefined()
				})
			})

			test('basic and original only', async () => {
				const { jobContext, playlistId, allPartInstances } = await setupMyDefaultRundown()

				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context, rundown, activationId } = await getActionExecutionContext(jobContext, cache)

					// We need to push changes back to 'mongo' for these tests
					await cache.saveAllToDatabase()

					expect(allPartInstances).toHaveLength(5)

					const sourceLayerIds = context.showStyleCompound.sourceLayers.map((l) => l._id)
					expect(sourceLayerIds).toHaveLength(4)

					// No playback has begun, so nothing should happen
					await expect(context.findLastPieceOnLayer(sourceLayerIds[0])).resolves.toBeUndefined()
					await expect(context.findLastPieceOnLayer(sourceLayerIds[1])).resolves.toBeUndefined()

					// Insert a piece that is played
					const pieceId0: PieceInstanceId = getRandomId()
					cache.PieceInstances.insert({
						_id: pieceId0,
						rundownId: rundown._id,
						partInstanceId: allPartInstances[0]._id,
						playlistActivationId: activationId,
						dynamicallyInserted: getCurrentTime(),
						piece: {
							_id: getRandomId(),
							startPartId: allPartInstances[0].part._id,
							externalId: '',
							name: 'abc',
							sourceLayerId: sourceLayerIds[0],
							outputLayerId: '',
							status: -1,
							enable: { start: 0 },
							lifespan: PieceLifespan.OutOnSegmentChange,
							pieceType: IBlueprintPieceType.Normal,
							invalid: false,
							content: {},
							timelineObjectsString: EmptyPieceTimelineObjectsBlob,
						},
						startedPlayback: 1000,
					})
					// We need to push changes back to 'mongo' for these tests
					await cache.saveAllToDatabase()

					await expect(context.findLastPieceOnLayer(sourceLayerIds[0])).resolves.toMatchObject({
						_id: pieceId0,
					})
					await expect(
						context.findLastPieceOnLayer(sourceLayerIds[0], { originalOnly: true })
					).resolves.toBeUndefined()

					// Insert another more recent piece that is played
					const pieceId1: PieceInstanceId = getRandomId()
					cache.PieceInstances.insert({
						_id: pieceId1,
						rundownId: rundown._id,
						partInstanceId: allPartInstances[0]._id,
						playlistActivationId: activationId,
						dynamicallyInserted: getCurrentTime(),
						piece: {
							_id: getRandomId(),
							startPartId: allPartInstances[0].part._id,
							externalId: '',
							name: 'abc',
							sourceLayerId: sourceLayerIds[0],
							outputLayerId: '',
							status: -1,
							enable: { start: 0 },
							lifespan: PieceLifespan.OutOnSegmentChange,
							pieceType: IBlueprintPieceType.Normal,
							invalid: false,
							content: {},
							timelineObjectsString: EmptyPieceTimelineObjectsBlob,
						},
						startedPlayback: 2000,
					})
					// We need to push changes back to 'mongo' for these tests
					await cache.saveAllToDatabase()

					await expect(context.findLastPieceOnLayer(sourceLayerIds[0])).resolves.toMatchObject({
						_id: pieceId1,
					})
					await expect(
						context.findLastPieceOnLayer(sourceLayerIds[0], { originalOnly: true })
					).resolves.toBeUndefined()
				})
			})

			test('excludeCurrentPart', async () => {
				const { jobContext, playlistId, allPartInstances } = await setupMyDefaultRundown()

				await jobContext.directCollections.RundownPlaylists.update(playlistId, {
					$set: { currentPartInstanceId: allPartInstances[2]._id },
				})

				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context, rundown, activationId } = await getActionExecutionContext(jobContext, cache)

					// We need to push changes back to 'mongo' for these tests
					await cache.saveAllToDatabase()

					expect(allPartInstances).toHaveLength(5)

					const sourceLayerIds = context.showStyleCompound.sourceLayers.map((l) => l._id)
					expect(sourceLayerIds).toHaveLength(4)

					// No playback has begun, so nothing should happen
					await expect(context.findLastPieceOnLayer(sourceLayerIds[0])).resolves.toBeUndefined()
					await expect(context.findLastPieceOnLayer(sourceLayerIds[1])).resolves.toBeUndefined()

					// Insert a couple of pieces that are played
					const pieceId0: PieceInstanceId = getRandomId()
					cache.PieceInstances.insert({
						_id: pieceId0,
						rundownId: rundown._id,
						partInstanceId: allPartInstances[0]._id,
						playlistActivationId: activationId,
						dynamicallyInserted: getCurrentTime(),
						piece: {
							_id: getRandomId(),
							startPartId: allPartInstances[0].part._id,
							externalId: '',
							name: 'abc',
							sourceLayerId: sourceLayerIds[0],
							outputLayerId: '',
							status: -1,
							enable: { start: 0 },
							lifespan: PieceLifespan.OutOnSegmentChange,
							pieceType: IBlueprintPieceType.Normal,
							invalid: false,
							content: {},
							timelineObjectsString: EmptyPieceTimelineObjectsBlob,
						},
						startedPlayback: 1000,
					})
					const pieceId1: PieceInstanceId = getRandomId()
					cache.PieceInstances.insert({
						_id: pieceId1,
						rundownId: rundown._id,
						partInstanceId: allPartInstances[2]._id,
						playlistActivationId: activationId,
						dynamicallyInserted: getCurrentTime(),
						piece: {
							_id: getRandomId(),
							startPartId: allPartInstances[2].part._id,
							externalId: '',
							name: 'abc',
							sourceLayerId: sourceLayerIds[0],
							outputLayerId: '',
							status: -1,
							enable: { start: 0 },
							lifespan: PieceLifespan.OutOnSegmentChange,
							pieceType: IBlueprintPieceType.Normal,
							invalid: false,
							content: {},
							timelineObjectsString: EmptyPieceTimelineObjectsBlob,
						},
						startedPlayback: 2000,
					})
					// We need to push changes back to 'mongo' for these tests
					await cache.saveAllToDatabase()

					// Check it
					await expect(context.findLastPieceOnLayer(sourceLayerIds[0])).resolves.toMatchObject({
						_id: pieceId1,
					})
					await expect(
						context.findLastPieceOnLayer(sourceLayerIds[0], { excludeCurrentPart: true })
					).resolves.toMatchObject({
						_id: pieceId0,
					})
				})
			})

			test('pieceMetaDataFilter', async () => {
				const { jobContext, playlistId, allPartInstances } = await setupMyDefaultRundown()

				await jobContext.directCollections.RundownPlaylists.update(playlistId, {
					$set: { currentPartInstanceId: allPartInstances[2]._id },
				})

				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context, rundown, activationId } = await getActionExecutionContext(jobContext, cache)

					// We need to push changes back to 'mongo' for these tests
					await cache.saveAllToDatabase()

					expect(allPartInstances).toHaveLength(5)

					const sourceLayerIds = context.showStyleCompound.sourceLayers.map((l) => l._id)
					expect(sourceLayerIds).toHaveLength(4)

					// No playback has begun, so nothing should happen
					await expect(context.findLastPieceOnLayer(sourceLayerIds[0])).resolves.toBeUndefined()
					await expect(context.findLastPieceOnLayer(sourceLayerIds[1])).resolves.toBeUndefined()

					// Insert a couple of pieces that are played
					const pieceId0: PieceInstanceId = getRandomId()
					cache.PieceInstances.insert({
						_id: pieceId0,
						rundownId: rundown._id,
						partInstanceId: allPartInstances[0]._id,
						playlistActivationId: activationId,
						piece: {
							_id: getRandomId(),
							startPartId: allPartInstances[0].part._id,
							externalId: '',
							name: 'abc',
							sourceLayerId: sourceLayerIds[0],
							outputLayerId: '',
							status: -1,
							enable: { start: 0 },
							lifespan: PieceLifespan.OutOnSegmentChange,
							pieceType: IBlueprintPieceType.Normal,
							invalid: false,
							content: {},
							timelineObjectsString: EmptyPieceTimelineObjectsBlob,
						},
						startedPlayback: 1000,
					})
					const pieceId1: PieceInstanceId = getRandomId()
					cache.PieceInstances.insert({
						_id: pieceId1,
						rundownId: rundown._id,
						partInstanceId: allPartInstances[2]._id,
						playlistActivationId: activationId,
						piece: {
							_id: getRandomId(),
							startPartId: allPartInstances[2].part._id,
							externalId: '',
							name: 'abc',
							sourceLayerId: sourceLayerIds[0],
							outputLayerId: '',
							status: -1,
							enable: { start: 0 },
							metaData: {
								prop1: 'hello',
								prop2: '5',
							},
							lifespan: PieceLifespan.OutOnSegmentChange,
							pieceType: IBlueprintPieceType.Normal,
							invalid: false,
							content: {},
							timelineObjectsString: EmptyPieceTimelineObjectsBlob,
						},
						startedPlayback: 2000,
					})
					// We need to push changes back to 'mongo' for these tests
					await cache.saveAllToDatabase()

					// Check it
					await expect(context.findLastPieceOnLayer(sourceLayerIds[0])).resolves.toMatchObject({
						_id: pieceId1,
					})
					await expect(
						context.findLastPieceOnLayer(sourceLayerIds[0], { pieceMetaDataFilter: {} })
					).resolves.toMatchObject({
						_id: pieceId1,
					})
					await expect(
						context.findLastPieceOnLayer(sourceLayerIds[0], { pieceMetaDataFilter: { prop1: 'hello' } })
					).resolves.toMatchObject({ _id: pieceId1 })
					await expect(
						context.findLastPieceOnLayer(sourceLayerIds[0], {
							pieceMetaDataFilter: { prop1: { $ne: 'hello' } },
						})
					).resolves.toMatchObject({ _id: pieceId0 })
				})
			})
		})

		describe('findLastScriptedPieceOnLayer', () => {
			test('No Current Part', async () => {
				const { jobContext, playlistId } = await setupMyDefaultRundown()

				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					// We need to push changes back to 'mongo' for these tests
					await cache.saveAllToDatabase()

					const sourceLayerIds = context.showStyleCompound.sourceLayers.map((l) => l._id)
					expect(sourceLayerIds).toHaveLength(4)

					// No playback has begun, so nothing should happen
					await expect(context.findLastScriptedPieceOnLayer(sourceLayerIds[0])).resolves.toBeUndefined()
					await expect(context.findLastScriptedPieceOnLayer(sourceLayerIds[1])).resolves.toBeUndefined()
				})
			})

			test('First Part', async () => {
				const { jobContext, playlistId, rundownId } = await setupMyDefaultRundown()

				const segmentIds = (await jobContext.directCollections.Segments.findFetch({ rundownId }))
					.sort((a, b) => a._rank - b._rank)
					.map((s) => s._id)

				const partInstances = (
					await jobContext.directCollections.PartInstances.findFetch({ segmentId: segmentIds[0] })
				).sort((a, b) => a.part._rank - b.part._rank)
				expect(partInstances).toHaveLength(2)

				const pieceInstances = await jobContext.directCollections.PieceInstances.findFetch({
					partInstanceId: { $in: partInstances.map((p) => p._id) },
				})
				expect(pieceInstances).toHaveLength(10)

				// Set Part 1 as current part
				await jobContext.directCollections.RundownPlaylists.update(playlistId, {
					$set: { currentPartInstanceId: partInstances[0]._id },
				})

				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					const sourceLayerIds = context.showStyleCompound.sourceLayers.map((l) => l._id)
					expect(sourceLayerIds).toHaveLength(4)

					const expectedPieceInstanceSourceLayer0 = pieceInstances.find(
						(p) =>
							p.partInstanceId === cache.Playlist.doc.currentPartInstanceId &&
							p.piece.sourceLayerId === sourceLayerIds[0]
					)
					expect(expectedPieceInstanceSourceLayer0).not.toBeUndefined()

					const expectedPieceSourceLayer0 = await jobContext.directCollections.Pieces.findOne({
						_id: expectedPieceInstanceSourceLayer0?.piece._id,
					})
					await expect(context.findLastScriptedPieceOnLayer(sourceLayerIds[0])).resolves.toMatchObject({
						_id: expectedPieceSourceLayer0?._id,
					})

					const expectedPieceInstanceSourceLayer1 = pieceInstances.find(
						(p) =>
							p.partInstanceId === cache.Playlist.doc.currentPartInstanceId &&
							p.piece.sourceLayerId === sourceLayerIds[1]
					)
					expect(expectedPieceInstanceSourceLayer1).not.toBeUndefined()

					const expectedPieceSourceLayer1 = await jobContext.directCollections.Pieces.findOne({
						_id: expectedPieceInstanceSourceLayer1?.piece._id,
					})
					await expect(context.findLastScriptedPieceOnLayer(sourceLayerIds[1])).resolves.toMatchObject({
						_id: expectedPieceSourceLayer1?._id,
					})
				})
			})

			test('First Part, Ignore Current Part', async () => {
				const { jobContext, playlistId, rundownId } = await setupMyDefaultRundown()

				const segmentIds = (await jobContext.directCollections.Segments.findFetch({ rundownId }))
					.sort((a, b) => a._rank - b._rank)
					.map((s) => s._id)

				const partInstances = (
					await jobContext.directCollections.PartInstances.findFetch({ segmentId: segmentIds[0] })
				).sort((a, b) => a.part._rank - b.part._rank)
				expect(partInstances).toHaveLength(2)

				// Set Part 1 as current part
				await jobContext.directCollections.RundownPlaylists.update(playlistId, {
					$set: { currentPartInstanceId: partInstances[0]._id },
				})

				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					const sourceLayerIds = context.showStyleCompound.sourceLayers.map((l) => l._id)
					expect(sourceLayerIds).toHaveLength(4)

					await expect(
						context.findLastScriptedPieceOnLayer(sourceLayerIds[0], { excludeCurrentPart: true })
					).resolves.toBeUndefined()
				})
			})

			test('Second Part', async () => {
				const { jobContext, playlistId, rundownId } = await setupMyDefaultRundown()

				const segmentIds = (await jobContext.directCollections.Segments.findFetch({ rundownId }))
					.sort((a, b) => a._rank - b._rank)
					.map((s) => s._id)

				const partInstances = (
					await jobContext.directCollections.PartInstances.findFetch({ segmentId: segmentIds[0] })
				).sort((a, b) => a.part._rank - b.part._rank)
				expect(partInstances).toHaveLength(2)

				const pieceInstances = await jobContext.directCollections.PieceInstances.findFetch({
					partInstanceId: { $in: partInstances.map((p) => p._id) },
				})
				expect(pieceInstances).toHaveLength(10)

				// Set Part 2 as current part
				await jobContext.directCollections.RundownPlaylists.update(playlistId, {
					$set: { currentPartInstanceId: partInstances[1]._id },
				})

				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					const sourceLayerIds = context.showStyleCompound.sourceLayers.map((l) => l._id)
					expect(sourceLayerIds).toHaveLength(4)

					const expectedPieceInstanceSourceLayer0 = pieceInstances.find(
						(p) =>
							p.partInstanceId === cache.Playlist.doc.currentPartInstanceId &&
							p.piece.sourceLayerId === sourceLayerIds[0]
					)
					expect(expectedPieceInstanceSourceLayer0).not.toBeUndefined()

					const expectedPieceSourceLayer0 = await jobContext.directCollections.Pieces.findOne({
						_id: expectedPieceInstanceSourceLayer0?.piece._id,
					})
					await expect(context.findLastScriptedPieceOnLayer(sourceLayerIds[0])).resolves.toMatchObject({
						_id: expectedPieceSourceLayer0?._id,
					})

					// Part 2 does not have any pieces on this sourcelayer, so we should find the piece from part 1
					const expectedPieceInstanceSourceLayer1 = pieceInstances.find(
						(p) => p.partInstanceId === partInstances[0]._id && p.piece.sourceLayerId === sourceLayerIds[1]
					)
					expect(expectedPieceInstanceSourceLayer0).not.toBeUndefined()

					const expectedPieceSourceLayer1 = await jobContext.directCollections.Pieces.findOne({
						_id: expectedPieceInstanceSourceLayer1?.piece._id,
					})
					await expect(context.findLastScriptedPieceOnLayer(sourceLayerIds[1])).resolves.toMatchObject({
						_id: expectedPieceSourceLayer1?._id,
					})
				})
			})
		})

		describe('getPartInstanceForPreviousPiece', () => {
			test('invalid parameters', async () => {
				const { jobContext, playlistId } = await setupMyDefaultRundown()

				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					// @ts-ignore
					await expect(context.getPartInstanceForPreviousPiece()).rejects.toThrowError(
						'Cannot find PartInstance from invalid PieceInstance'
					)
					// @ts-ignore
					await expect(context.getPartInstanceForPreviousPiece({})).rejects.toThrowError(
						'Cannot find PartInstance from invalid PieceInstance'
					)
					// @ts-ignore
					await expect(context.getPartInstanceForPreviousPiece('abc')).rejects.toThrowError(
						'Cannot find PartInstance from invalid PieceInstance'
					)
					await expect(
						context.getPartInstanceForPreviousPiece({
							// @ts-ignore
							partInstanceId: 6,
						})
					).rejects.toThrowError('Cannot find PartInstance for PieceInstance')
					await expect(
						// @ts-ignore
						context.getPartInstanceForPreviousPiece({
							partInstanceId: 'abc',
						})
					).rejects.toThrowError('Cannot find PartInstance for PieceInstance')
				})
			})

			test('valid parameters', async () => {
				const { jobContext, playlistId, allPartInstances } = await setupMyDefaultRundown()

				// Try with nothing in the cache
				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					expect(cache.PartInstances.documents.size).toBe(0)

					await expect(
						context.getPartInstanceForPreviousPiece({ partInstanceId: allPartInstances[1]._id } as any)
					).resolves.toMatchObject({
						_id: allPartInstances[1]._id,
					})

					await expect(
						context.getPartInstanceForPreviousPiece({ partInstanceId: allPartInstances[4]._id } as any)
					).resolves.toMatchObject({
						_id: allPartInstances[4]._id,
					})
				})

				// Again with stuff in the cache
				await jobContext.directCollections.RundownPlaylists.update(playlistId, {
					$set: { currentPartInstanceId: allPartInstances[1]._id },
				})

				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					expect(cache.PartInstances.documents.size).toBe(2)

					await expect(
						context.getPartInstanceForPreviousPiece({ partInstanceId: allPartInstances[1]._id } as any)
					).resolves.toMatchObject({
						_id: allPartInstances[1]._id,
					})

					await expect(
						context.getPartInstanceForPreviousPiece({ partInstanceId: allPartInstances[4]._id } as any)
					).resolves.toMatchObject({
						_id: allPartInstances[4]._id,
					})
				})
			})
		})

		describe('getPartForPreviousPiece', () => {
			test('invalid parameters', async () => {
				const { jobContext, playlistId } = await setupMyDefaultRundown()

				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					// @ts-ignore
					await expect(context.getPartForPreviousPiece()).rejects.toThrowError(
						'Cannot find Part from invalid Piece'
					)
					// @ts-ignore
					await expect(context.getPartForPreviousPiece({})).rejects.toThrowError(
						'Cannot find Part from invalid Piece'
					)
					// @ts-ignore
					await expect(context.getPartForPreviousPiece('abc')).rejects.toThrowError(
						'Cannot find Part from invalid Piece'
					)
					await expect(
						context.getPartForPreviousPiece({
							// @ts-ignore
							partInstanceId: 6,
						})
					).rejects.toThrowError('Cannot find Part from invalid Piece')
					await expect(
						// @ts-ignore
						context.getPartForPreviousPiece({
							_id: 'abc',
						})
					).rejects.toThrowError('Cannot find Piece abc')
				})
			})

			test('valid parameters', async () => {
				const { jobContext, playlistId, allPartInstances } = await setupMyDefaultRundown()

				// Try with nothing in the cache
				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					expect(cache.PartInstances.documents.size).toBe(0)
					expect(cache.PieceInstances.documents.size).toBe(0)

					const pieceInstance0 = (await jobContext.directCollections.PieceInstances.findOne({
						partInstanceId: allPartInstances[0]._id,
					})) as PieceInstance
					expect(pieceInstance0).not.toBeUndefined()

					await expect(
						context.getPartForPreviousPiece({ _id: unprotectString(pieceInstance0.piece._id) })
					).resolves.toMatchObject({
						_id: allPartInstances[0].part._id,
					})

					const pieceInstance1 = (await jobContext.directCollections.PieceInstances.findOne({
						partInstanceId: allPartInstances[1]._id,
					})) as PieceInstance
					expect(pieceInstance1).not.toBeUndefined()

					await expect(
						context.getPartForPreviousPiece({ _id: unprotectString(pieceInstance1.piece._id) })
					).resolves.toMatchObject({
						_id: allPartInstances[1].part._id,
					})
				})
			})
		})

		describe('insertPiece', () => {
			beforeEach(() => {
				postProcessPiecesMock.mockClear()
				innerStartAdLibPieceMock.mockClear()
			})

			test('bad parameters', async () => {
				const { jobContext, playlistId, allPartInstances } = await setupMyDefaultRundown()

				await jobContext.directCollections.RundownPlaylists.update(playlistId, {
					$set: { currentPartInstanceId: allPartInstances[0]._id },
				})

				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					// @ts-ignore
					await expect(context.insertPiece()).rejects.toThrowError('Unknown part "undefined"')
					// @ts-ignore
					await expect(context.insertPiece('previous')).rejects.toThrowError('Unknown part "previous"')
					// @ts-ignore
					await expect(context.insertPiece('next')).rejects.toThrowError(
						'Cannot insert piece when no active part'
					)

					expect(postProcessPiecesMock).toHaveBeenCalledTimes(0)
					expect(innerStartAdLibPieceMock).toHaveBeenCalledTimes(0)

					postProcessPiecesMock.mockImplementationOnce(() => {
						throw new Error('Mock process error')
					})
					await expect(context.insertPiece('current', {} as any)).rejects.toThrowError('Mock process error')
					expect(postProcessPiecesMock).toHaveBeenCalledTimes(1)
					expect(innerStartAdLibPieceMock).toHaveBeenCalledTimes(0)
				})
			})

			test('good', async () => {
				const { jobContext, playlistId, allPartInstances } = await setupMyDefaultRundown()

				const partInstance = allPartInstances[0]

				await jobContext.directCollections.RundownPlaylists.update(playlistId, {
					$set: { currentPartInstanceId: partInstance._id },
				})

				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					postProcessPiecesMock.mockImplementationOnce(() => [
						{
							_id: 'fake4', // Should be ignored
							timelineObjectsString: EmptyPieceTimelineObjectsBlob,
						} as any,
					])
					innerStartAdLibPieceMock.mockImplementationOnce(innerStartAdLibPieceOrig)

					const newPieceInstanceId = (await context.insertPiece('current', { externalId: 'input1' } as any))
						._id
					expect(newPieceInstanceId).toMatch(/randomId([0-9]+)_part0_0_instance_randomId([0-9]+)/)
					expect(postProcessPiecesMock).toHaveBeenCalledTimes(1)
					expect(postProcessPiecesMock).toHaveBeenCalledWith(
						expect.anything(),
						[{ externalId: 'input1' }],
						'blueprint0',
						partInstance.rundownId,
						partInstance.segmentId,
						partInstance.part._id,
						true
					)
					expect(innerStartAdLibPieceMock).toHaveBeenCalledTimes(1)

					// check some properties not exposed to the blueprints
					const newPieceInstance = cache.PieceInstances.findOne(
						protectString(newPieceInstanceId)
					) as PieceInstance
					expect(newPieceInstance.dynamicallyInserted).toBeTruthy()
					expect(newPieceInstance.partInstanceId).toEqual(partInstance._id)
				})
			})
		})

		describe('updatePieceInstance', () => {
			test('bad parameters', async () => {
				const { jobContext, playlistId, allPartInstances } = await setupMyDefaultRundown()

				const pieceInstance = (await jobContext.directCollections.PieceInstances.findOne({
					partInstanceId: allPartInstances[0]._id,
				})) as PieceInstance
				expect(pieceInstance).toBeTruthy()
				const pieceInstanceOther = (await jobContext.directCollections.PieceInstances.findOne({
					partInstanceId: allPartInstances[1]._id,
				})) as PieceInstance
				expect(pieceInstanceOther).toBeTruthy()

				await jobContext.directCollections.RundownPlaylists.update(playlistId, {
					$set: {
						previousPartInstanceId: allPartInstances[0]._id,
					},
				})

				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					await expect(context.updatePieceInstance('abc', {})).rejects.toThrowError(
						'Some valid properties must be defined'
					)
					await expect(
						context.updatePieceInstance('abc', { _id: 'bad', nope: 'ok' } as any)
					).rejects.toThrowError('Some valid properties must be defined')
					await expect(context.updatePieceInstance('abc', { sourceLayerId: 'new' })).rejects.toThrowError(
						'PieceInstance could not be found'
					)
					await expect(
						context.updatePieceInstance(unprotectString(pieceInstance._id), { sourceLayerId: 'new' })
					).rejects.toThrowError('Can only update piece instances in current or next part instance')
					await expect(
						context.updatePieceInstance(unprotectString(pieceInstanceOther._id), { sourceLayerId: 'new' })
					).rejects.toThrowError('PieceInstance could not be found')
				})

				// Set a current part instance
				await jobContext.directCollections.RundownPlaylists.update(playlistId, {
					$set: {
						previousPartInstanceId: pieceInstanceOther.partInstanceId,
						currentPartInstanceId: pieceInstance.partInstanceId,
					},
				})
				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)
					await expect(context.updatePieceInstance('abc', { sourceLayerId: 'new' })).rejects.toThrowError(
						'PieceInstance could not be found'
					)
					await expect(
						context.updatePieceInstance(unprotectString(pieceInstance._id), { sourceLayerId: 'new' })
					).resolves.toBeTruthy()
					await expect(
						context.updatePieceInstance(unprotectString(pieceInstanceOther._id), { sourceLayerId: 'new' })
					).rejects.toThrowError('Can only update piece instances in current or next part instance')
				})

				// Set as next part instance
				await jobContext.directCollections.RundownPlaylists.update(playlistId, {
					$set: {
						previousPartInstanceId: pieceInstanceOther.partInstanceId,
						currentPartInstanceId: null,
						nextPartInstanceId: pieceInstance.partInstanceId,
					},
				})
				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)
					await expect(context.updatePieceInstance('abc', { sourceLayerId: 'new' })).rejects.toThrowError(
						'PieceInstance could not be found'
					)
					await expect(
						context.updatePieceInstance(unprotectString(pieceInstance._id), { sourceLayerId: 'new' })
					).resolves.toBeTruthy()
					await expect(
						context.updatePieceInstance(unprotectString(pieceInstanceOther._id), { sourceLayerId: 'new' })
					).rejects.toThrowError('Can only update piece instances in current or next part instance')
				})
			})

			test('good', async () => {
				const { jobContext, playlistId, rundownId } = await setupMyDefaultRundown()

				// Find a piece to modify
				const pieceInstance0 = (await jobContext.directCollections.PieceInstances.findOne({
					rundownId,
				})) as PieceInstance
				expect(pieceInstance0).toBeTruthy()
				await jobContext.directCollections.RundownPlaylists.update(playlistId, {
					$set: { currentPartInstanceId: pieceInstance0.partInstanceId },
				})

				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					// Ensure there are no pending updates already
					expect(cache.PieceInstances.isModified()).toBeFalsy()

					// Update it and expect it to match
					const pieceInstance0Before = clone(pieceInstance0)
					const pieceInstance0Delta: any = {
						_id: 'sdf', // This will be dropped
						sourceLayerId: 'new',
						enable: { start: 99, end: 123 },
						badProperty: 9, // This will be dropped
						content: {
							timelineObjects: [
								literal<TimelineObjRundown>({
									id: 'a',
									enable: { start: 0 },
									content: {} as any,
									layer: 1,
									objectType: TimelineObjType.RUNDOWN,
								}),
							],
						},
					}
					const resultPiece = await context.updatePieceInstance(
						unprotectString(pieceInstance0._id),
						pieceInstance0Delta
					)
					const pieceInstance1 = cache.PieceInstances.findOne(pieceInstance0._id) as PieceInstance
					expect(pieceInstance1).toBeTruthy()

					expect(resultPiece).toEqual(convertPieceInstanceToBlueprints(pieceInstance1))
					const pieceInstance0After = {
						...pieceInstance0Before,
						piece: {
							...pieceInstance0Before.piece,
							...omit(pieceInstance0Delta, 'badProperty', '_id'),
							content: {
								...omit(pieceInstance0Delta.content, 'timelineObjects'),
							},
							timelineObjectsString: serializePieceTimelineObjectsBlob(
								pieceInstance0Delta.content.timelineObjects
							),
						},
					}
					expect(pieceInstance1).toEqual(pieceInstance0After)
					expect(
						Array.from(cache.PieceInstances.documents.values()).filter((doc) => !doc || !!doc.updated)
					).toMatchObject([
						{
							updated: true,
							document: { _id: pieceInstance1._id },
						},
					])

					expect(context.nextPartState).toEqual(ActionPartChange.NONE)
					expect(context.currentPartState).toEqual(ActionPartChange.SAFE_CHANGE)
				})
			})
		})

		describe('queuePart', () => {
			beforeEach(() => {
				postProcessPiecesMock.mockClear()
				innerStartAdLibPieceMock.mockClear()
				innerStartQueuedAdLibMock.mockClear()
			})

			test('bad parameters', async () => {
				const { jobContext, playlistId, rundownId } = await setupMyDefaultRundown()

				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					// No next-part
					// @ts-ignore
					await expect(context.queuePart()).rejects.toThrowError(
						'Cannot queue part when no current partInstance'
					)
				})

				const partInstance = (await jobContext.directCollections.PartInstances.findOne({
					rundownId,
				})) as DBPartInstance
				expect(partInstance).toBeTruthy()
				await jobContext.directCollections.RundownPlaylists.update(playlistId, {
					$set: { currentPartInstanceId: partInstance._id },
				})

				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					// Next part has already been modified
					context.nextPartState = ActionPartChange.SAFE_CHANGE
					// @ts-ignore
					await expect(context.queuePart('previous')).rejects.toThrowError(
						'Cannot queue part when next part has already been modified'
					)
					context.nextPartState = ActionPartChange.NONE

					await expect(context.queuePart({} as any, [])).rejects.toThrowError(
						'New part must contain at least one piece'
					)

					// expect(
					// 	context.queuePart(
					// 		// @ts-ignore
					// 		{
					// 			floated: true,
					// 		},
					// 		[{}]
					// 	).part.floated
					// ).toBeFalsy()
					// expect(
					// 	context.queuePart(
					// 		// @ts-ignore
					// 		{
					// 			invalid: true,
					// 		},
					// 		[{}]
					// 	).part.invalid
					// ).toBeFalsy()

					expect(postProcessPiecesMock).toHaveBeenCalledTimes(0)
					expect(innerStartAdLibPieceMock).toHaveBeenCalledTimes(0)
					expect(innerStartQueuedAdLibMock).toHaveBeenCalledTimes(0)

					postProcessPiecesMock.mockImplementationOnce(() => {
						throw new Error('Mock process error')
					})
					await expect(context.queuePart({} as any, [{}] as any)).rejects.toThrowError('Mock process error')
					expect(postProcessPiecesMock).toHaveBeenCalledTimes(1)
					expect(innerStartAdLibPieceMock).toHaveBeenCalledTimes(0)
					expect(innerStartQueuedAdLibMock).toHaveBeenCalledTimes(0)

					partInstance.part.autoNext = true
					partInstance.part.expectedDuration = 700
					partInstance.timings = {
						startedPlayback: getCurrentTime(),
						stoppedPlayback: undefined,
						playOffset: 0,
						take: undefined,
						takeDone: undefined,
						takeOut: undefined,
						next: undefined,
					}
					cache.PartInstances.replace(partInstance)

					expect(isTooCloseToAutonext(partInstance, true)).toBeTruthy()
					await expect(context.queuePart({} as any, [{}] as any)).rejects.toThrowError(
						'Too close to an autonext to queue a part'
					)

					expect(context.nextPartState).toEqual(ActionPartChange.NONE)
					expect(context.currentPartState).toEqual(ActionPartChange.NONE)
				})
			})

			test('good', async () => {
				const { jobContext, playlistId, rundownId } = await setupMyDefaultRundown()

				const partInstance = (await jobContext.directCollections.PartInstances.findOne({
					rundownId,
				})) as DBPartInstance
				expect(partInstance).toBeTruthy()
				await jobContext.directCollections.RundownPlaylists.update(playlistId, {
					$set: { currentPartInstanceId: partInstance._id },
				})

				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					const newPiece: IBlueprintPiece = {
						name: 'test piece',
						sourceLayerId: 'sl1',
						outputLayerId: 'o1',
						externalId: '-',
						enable: { start: 0 },
						lifespan: PieceLifespan.OutOnRundownEnd,
						content: {
							timelineObjects: [],
						},
					}
					const newPart: IBlueprintPart = {
						externalId: 'nope',
						title: 'something',
					}

					expect(postProcessPiecesMock).toHaveBeenCalledTimes(0)
					expect(innerStartAdLibPieceMock).toHaveBeenCalledTimes(0)
					expect(innerStartQueuedAdLibMock).toHaveBeenCalledTimes(0)

					// Create it with most of the real flow
					postProcessPiecesMock.mockImplementationOnce(postProcessPiecesOrig)
					innerStartQueuedAdLibMock.mockImplementationOnce(innerStartQueuedAdLibOrig)
					expect((await context.queuePart(newPart, [newPiece]))._id).toEqual(
						cache.Playlist.doc.nextPartInstanceId
					)

					expect(postProcessPiecesMock).toHaveBeenCalledTimes(1)
					expect(innerStartAdLibPieceMock).toHaveBeenCalledTimes(0)
					expect(innerStartQueuedAdLibMock).toHaveBeenCalledTimes(1)

					// Verify some properties not exposed to the blueprints
					const newPartInstance = cache.PartInstances.findOne(
						// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
						cache.Playlist.doc.nextPartInstanceId!
					) as DBPartInstance
					expect(newPartInstance).toBeTruthy()
					expect(newPartInstance.part._rank).toBeLessThan(9000)
					expect(newPartInstance.part._rank).toBeGreaterThan(partInstance.part._rank)
					expect(newPartInstance.orphaned).toEqual('adlib-part')

					const newNextPartInstances = await context.getPieceInstances('next')
					expect(newNextPartInstances).toHaveLength(1)
					// @ts-ignore
					expect(newNextPartInstances[0].partInstanceId).toEqual(newPartInstance._id)

					expect(context.nextPartState).toEqual(ActionPartChange.SAFE_CHANGE)
					expect(context.currentPartState).toEqual(ActionPartChange.NONE)
				})
			})
		})

		describe('stopPiecesOnLayers', () => {
			test('invalid parameters', async () => {
				const { jobContext, playlistId } = await setupMyDefaultRundown()

				// Bad instance id
				await jobContext.directCollections.RundownPlaylists.update(playlistId, {
					$set: { currentPartInstanceId: protectString('abc') },
				})
				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					// Bad instance id
					await expect(context.stopPiecesOnLayers(['lay1'], 34)).rejects.toThrowError(
						'Cannot stop pieceInstances when no current partInstance'
					)
				})

				await jobContext.directCollections.RundownPlaylists.update(playlistId, {
					$set: { currentPartInstanceId: null },
				})
				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					innerStopPiecesMock.mockClear()
					await expect(context.stopPiecesOnLayers(['lay1'], 34)).resolves.toEqual([])
					expect(innerStopPiecesMock).toHaveBeenCalledTimes(0)

					expect(context.nextPartState).toEqual(ActionPartChange.NONE)
					expect(context.currentPartState).toEqual(ActionPartChange.NONE)
				})
			})
			test('valid parameters', async () => {
				const { jobContext, playlistId, rundownId } = await setupMyDefaultRundown()

				const currentPartInstance = (await jobContext.directCollections.PartInstances.findOne({
					rundownId,
				})) as DBPartInstance
				expect(currentPartInstance).toBeTruthy()
				await jobContext.directCollections.RundownPlaylists.update(playlistId, {
					$set: { currentPartInstanceId: currentPartInstance._id },
				})

				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					innerStopPiecesMock.mockClear()
					let filter: (piece: PieceInstance) => boolean = null as any
					innerStopPiecesMock.mockImplementationOnce(
						(context2, cache2, showStyleBase, partInstance, filter2, offset) => {
							expect(context2).toBe(jobContext)
							expect(cache2).toBe(cache)
							expect(showStyleBase).toBeTruthy()
							expect(partInstance).toStrictEqual(currentPartInstance)
							expect(offset).toEqual(34)
							filter = filter2

							return [protectString('result1')]
						}
					)

					// Ensure it behaves as expected
					await expect(context.stopPiecesOnLayers(['lay1'], 34)).resolves.toEqual(['result1'])
					expect(innerStopPiecesMock).toHaveBeenCalledTimes(1)
					expect(filter).toBeTruthy()

					// Now verify the filter works as intended
					expect(filter({ piece: { sourceLayerId: 'lay1' } } as any)).toBeTruthy()
					expect(filter({ piece: {} } as any)).toBeFalsy()
					expect(filter({ piece: { sourceLayerId: 'lay2' } } as any)).toBeFalsy()

					expect(context.nextPartState).toEqual(ActionPartChange.NONE)
					expect(context.currentPartState).toEqual(ActionPartChange.SAFE_CHANGE)
				})
			})
		})

		describe('stopPieceInstances', () => {
			test('invalid parameters', async () => {
				const { jobContext, playlistId } = await setupMyDefaultRundown()

				// Bad instance id
				await jobContext.directCollections.RundownPlaylists.update(playlistId, {
					$set: { currentPartInstanceId: protectString('abc') },
				})
				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					// Bad instance id
					await expect(context.stopPieceInstances(['lay1'], 34)).rejects.toThrowError(
						'Cannot stop pieceInstances when no current partInstance'
					)
				})

				await jobContext.directCollections.RundownPlaylists.update(playlistId, {
					$set: { currentPartInstanceId: null },
				})
				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					innerStopPiecesMock.mockClear()
					await expect(context.stopPieceInstances(['lay1'], 34)).resolves.toEqual([])
					expect(innerStopPiecesMock).toHaveBeenCalledTimes(0)

					expect(context.nextPartState).toEqual(ActionPartChange.NONE)
					expect(context.currentPartState).toEqual(ActionPartChange.NONE)
				})
			})
			test('valid parameters', async () => {
				const { jobContext, playlistId, rundownId } = await setupMyDefaultRundown()

				const currentPartInstance = (await jobContext.directCollections.PartInstances.findOne({
					rundownId,
				})) as DBPartInstance
				expect(currentPartInstance).toBeTruthy()
				await jobContext.directCollections.RundownPlaylists.update(playlistId, {
					$set: { currentPartInstanceId: currentPartInstance._id },
				})

				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					innerStopPiecesMock.mockClear()
					let filter: (piece: PieceInstance) => boolean = null as any
					innerStopPiecesMock.mockImplementationOnce(
						(context2, cache2, showStyleBase, partInstance, filter2, offset) => {
							expect(context2).toBe(jobContext)
							expect(cache2).toBe(cache)
							expect(showStyleBase).toBeTruthy()
							expect(partInstance).toStrictEqual(currentPartInstance)
							expect(offset).toEqual(34)
							filter = filter2

							return [protectString('result1')]
						}
					)

					// Ensure it behaves as expected
					await expect(context.stopPieceInstances(['lay1'], 34)).resolves.toEqual(['result1'])
					expect(innerStopPiecesMock).toHaveBeenCalledTimes(1)
					expect(filter).toBeTruthy()

					// Now verify the filter works as intended
					expect(filter({ _id: 'lay1' } as any)).toBeTruthy()
					expect(filter({} as any)).toBeFalsy()
					expect(filter({ id: 'lay2' } as any)).toBeFalsy()

					expect(context.nextPartState).toEqual(ActionPartChange.NONE)
					expect(context.currentPartState).toEqual(ActionPartChange.SAFE_CHANGE)
				})
			})
		})
		describe('removePieceInstances', () => {
			test('invalid parameters', async () => {
				const { jobContext, playlistId, rundownId, allPartInstances } = await setupMyDefaultRundown()

				// No instance id
				await jobContext.directCollections.RundownPlaylists.update(playlistId, {
					$set: { nextPartInstanceId: null },
				})
				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					// No instance id
					await expect(context.removePieceInstances('next', ['lay1'])).rejects.toThrowError(
						'Cannot remove pieceInstances when no selected partInstance'
					)
				})

				// Ensure missing/bad ids dont delete anything
				const partInstance = allPartInstances[0]
				await jobContext.directCollections.RundownPlaylists.update(playlistId, {
					$set: { nextPartInstanceId: partInstance._id },
				})

				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)
					const beforePieceInstancesCount = cache.PieceInstances.findFetch({}).length // Because only those frm current, next, prev are included..
					expect(beforePieceInstancesCount).not.toEqual(0)

					const pieceInstanceFromOther = (await jobContext.directCollections.PieceInstances.findOne({
						rundownId,
						partInstanceId: { $ne: partInstance._id },
					})) as PieceInstance
					expect(pieceInstanceFromOther).toBeTruthy()

					await expect(context.removePieceInstances('next', [])).resolves.toEqual([])
					await expect(
						// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
						context.removePieceInstances('next', [unprotectString(pieceInstanceFromOther._id)])
					).resolves.toEqual([]) // Try and remove something belonging to a different part
					expect(cache.PieceInstances.findFetch({}).length).toEqual(beforePieceInstancesCount)
				})
			})

			test('good', async () => {
				const { jobContext, playlistId, allPartInstances } = await setupMyDefaultRundown()

				const partInstance = allPartInstances[0]
				await jobContext.directCollections.RundownPlaylists.update(playlistId, {
					$set: { nextPartInstanceId: partInstance._id },
				})

				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					expect(cache.PieceInstances.findFetch({}).length).not.toEqual(0)

					// Find the instance, and create its backing piece
					const targetPieceInstance = cache.PieceInstances.findOne({}) as PieceInstance
					expect(targetPieceInstance).toBeTruthy()

					await expect(
						context.removePieceInstances('next', [unprotectString(targetPieceInstance._id)])
					).resolves.toEqual([unprotectString(targetPieceInstance._id)])

					// Ensure it was all removed
					expect(cache.PieceInstances.findOne(targetPieceInstance._id)).toBeFalsy()
					expect(context.nextPartState).toEqual(ActionPartChange.SAFE_CHANGE)
				})
			})
		})

		describe('updatePartInstance', () => {
			test('bad parameters', async () => {
				const { jobContext, playlistId, rundownId } = await setupMyDefaultRundown()

				const partInstance = (await jobContext.directCollections.PartInstances.findOne({
					rundownId,
				})) as DBPartInstance
				expect(partInstance).toBeTruthy()
				const partInstanceOther = (await jobContext.directCollections.PartInstances.findOne({
					_id: { $ne: partInstance._id },
					rundownId,
				})) as DBPartInstance
				expect(partInstanceOther).toBeTruthy()

				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					await expect(context.updatePartInstance('current', {})).rejects.toThrowError(
						'Some valid properties must be defined'
					)
					await expect(
						context.updatePartInstance('current', { _id: 'bad', nope: 'ok' } as any)
					).rejects.toThrowError('Some valid properties must be defined')
					await expect(context.updatePartInstance('current', { title: 'new' })).rejects.toThrowError(
						'PartInstance could not be found'
					)
				})

				// Set a current part instance
				await jobContext.directCollections.RundownPlaylists.update(playlistId, {
					$set: { currentPartInstanceId: partInstance._id },
				})
				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)
					await expect(context.updatePartInstance('next', { title: 'new' })).rejects.toThrowError(
						'PartInstance could not be found'
					)
					await context.updatePartInstance('current', { title: 'new' })
				})
			})
			test('good', async () => {
				const { jobContext, playlistId, rundownId } = await setupMyDefaultRundown()

				// Setup the rundown and find an instance to modify
				const partInstance0 = (await jobContext.directCollections.PartInstances.findOne({
					rundownId,
				})) as DBPartInstance
				expect(partInstance0).toBeTruthy()
				await jobContext.directCollections.RundownPlaylists.update(playlistId, {
					$set: { nextPartInstanceId: partInstance0._id },
				})

				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					// Ensure there are no pending updates already
					expect(cache.PartInstances.isModified()).toBeFalsy()

					// Update it and expect it to match
					const partInstance0Before = clone(partInstance0)
					const partInstance0Delta = {
						_id: 'sdf', // This will be dropped
						title: 'abc',
						expectedDuration: 1234,
						classes: ['123'],
						badProperty: 9, // This will be dropped
					}
					const resultPiece = await context.updatePartInstance('next', partInstance0Delta)
					const partInstance1 = cache.PartInstances.findOne({}) as DBPartInstance
					expect(partInstance1).toBeTruthy()

					expect(resultPiece).toEqual(convertPartInstanceToBlueprints(partInstance1))

					const pieceInstance0After = {
						...partInstance0Before,
						part: {
							...partInstance0Before.part,
							..._.omit(partInstance0Delta, 'badProperty', '_id'),
						},
					}
					expect(partInstance1).toEqual(pieceInstance0After)
					expect(
						Array.from(cache.PartInstances.documents.values()).filter((doc) => !doc || !!doc.updated)
					).toMatchObject([
						{
							updated: true,
							document: { _id: partInstance1._id },
						},
					])

					expect(context.nextPartState).toEqual(ActionPartChange.SAFE_CHANGE)
					expect(context.currentPartState).toEqual(ActionPartChange.NONE)
				})
			})
		})
	})
})
