import '../../../__mocks__/_vm2'
import { testInFiber } from '../../../__mocks__/helpers/jest'
import {
	setupDefaultStudioEnvironment,
	DefaultEnvironment,
	setupDefaultRundownPlaylist,
	convertToUIShowStyleBase,
} from '../../../__mocks__/helpers/database'
import { RundownUtils } from '../rundown'
import { Piece } from '../../../lib/collections/Pieces'
import { defaultPartInstance, defaultPiece, defaultPieceInstance } from '../../../__mocks__/defaultCollectionObjects'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { PieceLifespan } from '@sofie-automation/blueprints-integration'
import { PartInstance } from '../../../lib/collections/PartInstances'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PartInstances, PieceInstances, Pieces, RundownPlaylists } from '../../collections'
import { MongoMock } from '../../../__mocks__/mongo'
import { RundownPlaylistCollectionUtil } from '../../../lib/collections/rundownPlaylistUtil'

const mockRundownPlaylistsCollection = MongoMock.getInnerMockCollection(RundownPlaylists)
const mockPartInstancesCollection = MongoMock.getInnerMockCollection(PartInstances)
const mockPieceInstancesCollection = MongoMock.getInnerMockCollection(PieceInstances)
const mockPiecesCollection = MongoMock.getInnerMockCollection(Pieces)

describe('client/lib/rundown', () => {
	let env: DefaultEnvironment
	let playlistId: RundownPlaylistId
	beforeEach(async () => {
		env = await setupDefaultStudioEnvironment()
		playlistId = (await setupDefaultRundownPlaylist(env)).playlistId
	})
	describe('RundownUtils.getResolvedSegment', () => {
		testInFiber('Basic Segment resolution', () => {
			const showStyleBase = convertToUIShowStyleBase(env.showStyleBase)
			const playlist = RundownPlaylists.findOne(playlistId)
			if (!playlist) throw new Error('Rundown not found')

			const { currentPartInstance, nextPartInstance } =
				RundownPlaylistCollectionUtil.getSelectedPartInstances(playlist)

			const rundowns = RundownPlaylistCollectionUtil.getRundownsOrdered(playlist)
			const { parts, segments } = RundownPlaylistCollectionUtil.getSegmentsAndPartsSync(playlist)
			const rundown = rundowns[0]
			const segment = segments[0]

			const resolvedSegment = RundownUtils.getResolvedSegment(
				showStyleBase,
				playlist,
				rundown,
				segment,
				new Set(segments.slice(0, 0).map((s) => s._id)),
				[],
				new Map(),
				parts.map((part) => part._id),
				new Map(),
				currentPartInstance,
				nextPartInstance
			)
			expect(resolvedSegment).toBeTruthy()
			expect(resolvedSegment.parts).toHaveLength(2)
			expect(resolvedSegment).toMatchObject({
				isLiveSegment: false,
				isNextSegment: false,
				currentLivePart: undefined,
				currentNextPart: undefined,
				hasRemoteItems: false,
				hasGuestItems: false,
				hasAlreadyPlayed: false,
				autoNextPart: false,
			})
			expect(resolvedSegment).toMatchSnapshot()
		})

		testInFiber('Infinite Piece starting in first Part is populated across the Segment', () => {
			const showStyleBase = convertToUIShowStyleBase(env.showStyleBase)
			const sourceLayerIds = Object.keys(showStyleBase.sourceLayers)
			const outputLayerIds = Object.keys(showStyleBase.outputLayers)

			const playlist = RundownPlaylists.findOne(playlistId)
			if (!playlist) throw new Error('Playlist not found')

			const { currentPartInstance, nextPartInstance } =
				RundownPlaylistCollectionUtil.getSelectedPartInstances(playlist)

			const rundowns = RundownPlaylistCollectionUtil.getRundownsOrdered(playlist)
			const { parts, segments } = RundownPlaylistCollectionUtil.getSegmentsAndPartsSync(playlist)
			const rundown = rundowns[0]
			const rundownId = rundown._id
			const segment = segments[1]
			const firstPart = parts.find((part) => part.segmentId === segment._id)

			if (!firstPart) throw new Error('Mock Segment 1 not found')

			const infinitePiece: Piece = {
				...defaultPiece(protectString(rundownId + '_infinite_piece'), rundownId, segment._id, firstPart._id),
				externalId: 'MOCK_INFINITE_PIECE',
				name: 'Infinite',
				sourceLayerId: sourceLayerIds[0],
				outputLayerId: outputLayerIds[0],
				enable: {
					start: 1000,
				},
				lifespan: PieceLifespan.OutOnSegmentEnd,
			}

			mockPiecesCollection.insert(infinitePiece)

			const resolvedSegment = RundownUtils.getResolvedSegment(
				showStyleBase,
				playlist,
				rundown,
				segment,
				new Set(segments.slice(0, 1).map((s) => s._id)),
				[],
				new Map(),
				parts.map((part) => part._id),
				new Map(),
				currentPartInstance,
				nextPartInstance
			)
			expect(resolvedSegment).toBeTruthy()
			expect(resolvedSegment.parts).toHaveLength(3)
			expect(resolvedSegment).toMatchObject({
				isLiveSegment: false,
				isNextSegment: false,
				currentLivePart: undefined,
				currentNextPart: undefined,
				hasRemoteItems: false,
				hasGuestItems: false,
				hasAlreadyPlayed: false,
				autoNextPart: false,
			})
			const resolvedInfinitePiece00 = resolvedSegment.parts[0].pieces.find(
				(piece) => piece.instance.piece._id === infinitePiece._id
			)
			expect(resolvedInfinitePiece00).toBeDefined()
			expect(resolvedInfinitePiece00?.renderedInPoint).toBe(1000)
			expect(resolvedInfinitePiece00?.renderedDuration).toBe(null)
			const resolvedInfinitePiece01 = resolvedSegment.parts[1].pieces.find(
				(piece) => piece.instance.piece._id === infinitePiece._id
			)
			expect(resolvedInfinitePiece01).toBeDefined()
			expect(resolvedInfinitePiece01?.renderedInPoint).toBe(0)
			expect(resolvedInfinitePiece01?.renderedDuration).toBe(null)
		})

		testInFiber('Infinite Piece starting in first Part is cropped by another Piece', () => {
			const showStyleBase = convertToUIShowStyleBase(env.showStyleBase)
			const sourceLayerIds = Object.keys(showStyleBase.sourceLayers)
			const outputLayerIds = Object.keys(showStyleBase.outputLayers)

			const playlist = RundownPlaylists.findOne(playlistId)
			if (!playlist) throw new Error('Playlist not found')

			const { currentPartInstance, nextPartInstance } =
				RundownPlaylistCollectionUtil.getSelectedPartInstances(playlist)

			const rundowns = RundownPlaylistCollectionUtil.getRundownsOrdered(playlist)
			const { parts, segments } = RundownPlaylistCollectionUtil.getSegmentsAndPartsSync(playlist)
			const rundown = rundowns[0]
			const rundownId = rundown._id
			const segment = segments[1]
			const firstPart = parts.find((part) => part.segmentId === segment._id)

			if (!firstPart) throw new Error('Mock Segment 1 not found')

			const infinitePiece: Piece = {
				...defaultPiece(protectString(rundownId + '_infinite_piece'), rundownId, segment._id, firstPart._id),
				externalId: 'MOCK_INFINITE_PIECE',
				name: 'Infinite',
				sourceLayerId: sourceLayerIds[0],
				outputLayerId: outputLayerIds[0],
				enable: {
					start: 1000,
				},
				lifespan: PieceLifespan.OutOnSegmentChange,
			}
			mockPiecesCollection.insert(infinitePiece)

			const croppingPiece: Piece = {
				...defaultPiece(protectString(rundownId + '_cropping_piece'), rundownId, segment._id, firstPart._id),
				externalId: 'MOCK_CROPPING_PIECE',
				name: 'Cropping',
				sourceLayerId: sourceLayerIds[0],
				outputLayerId: outputLayerIds[0],
				enable: {
					start: 4000,
					duration: 1000,
				},
				lifespan: PieceLifespan.WithinPart,
			}
			mockPiecesCollection.insert(croppingPiece)

			const resolvedSegment = RundownUtils.getResolvedSegment(
				showStyleBase,
				playlist,
				rundown,
				segment,
				new Set(segments.slice(0, 1).map((s) => s._id)),
				[],
				new Map(),
				parts.map((part) => part._id),
				new Map(),
				currentPartInstance,
				nextPartInstance
			)
			expect(resolvedSegment).toBeTruthy()
			expect(resolvedSegment.parts).toHaveLength(3)
			expect(resolvedSegment).toMatchObject({
				isLiveSegment: false,
				isNextSegment: false,
				currentLivePart: undefined,
				currentNextPart: undefined,
				hasRemoteItems: false,
				hasGuestItems: false,
				hasAlreadyPlayed: false,
				autoNextPart: false,
			})

			expect(resolvedSegment.parts[0].pieces).toHaveLength(2)

			const resolvedInfinitePiece00 = resolvedSegment.parts[0].pieces.find(
				(piece) => piece.instance.piece._id === infinitePiece._id
			)
			expect(resolvedInfinitePiece00).toBeDefined()
			expect(resolvedInfinitePiece00?.renderedInPoint).toBe(1000)
			expect(resolvedInfinitePiece00?.renderedDuration).toBe(3000)

			const resolvedCroppingPiece00 = resolvedSegment.parts[0].pieces.find(
				(piece) => piece.instance.piece._id === croppingPiece._id
			)
			expect(resolvedCroppingPiece00).toBeDefined()
			expect(resolvedCroppingPiece00?.renderedInPoint).toBe(4000)
			expect(resolvedCroppingPiece00?.renderedDuration).toBe(1000)

			expect(resolvedSegment.parts[1].pieces).toHaveLength(0)
		})

		testInFiber(
			"User-Stopped Infinite Piece starting in first Part maintains it's length when followed by another Piece",
			() => {
				const showStyleBase = convertToUIShowStyleBase(env.showStyleBase)
				const sourceLayerIds = Object.keys(showStyleBase.sourceLayers)
				const outputLayerIds = Object.keys(showStyleBase.outputLayers)

				const playlistActivationId = protectString('mock_activation_0')
				mockRundownPlaylistsCollection.update(playlistId, {
					$set: {
						activationId: playlistActivationId,
					},
				})

				let playlist = RundownPlaylists.findOne(playlistId)
				if (!playlist) throw new Error('Playlist not found')

				const rundowns = RundownPlaylistCollectionUtil.getRundownsOrdered(playlist)
				const { parts, segments } = RundownPlaylistCollectionUtil.getSegmentsAndPartsSync(playlist)
				const rundown = rundowns[0]
				const rundownId = rundown._id
				const segment = segments[1]
				const firstPart = parts.find((part) => part.segmentId === segment._id)

				if (!firstPart) throw new Error('Mock Segment 1 not found')

				const infinitePiece: Piece = {
					...defaultPiece(
						protectString(rundownId + '_infinite_piece'),
						rundownId,
						segment._id,
						firstPart._id
					),
					externalId: 'MOCK_INFINITE_PIECE',
					name: 'Infinite',
					sourceLayerId: sourceLayerIds[0],
					outputLayerId: outputLayerIds[0],
					enable: {
						start: 1000,
					},
					lifespan: PieceLifespan.OutOnSegmentChange,
				}
				mockPiecesCollection.insert(infinitePiece)

				const followingPiece: Piece = {
					...defaultPiece(
						protectString(rundownId + '_cropping_piece'),
						rundownId,
						segment._id,
						firstPart._id
					),
					externalId: 'MOCK_CROPPING_PIECE',
					name: 'Cropping',
					sourceLayerId: sourceLayerIds[0],
					outputLayerId: outputLayerIds[0],
					enable: {
						start: 4000,
						duration: 1000,
					},
					lifespan: PieceLifespan.WithinPart,
				}
				mockPiecesCollection.insert(followingPiece)

				const segmentPlayoutId = protectString('mock_segment_playout_0')
				const mockCurrentPartInstance: PartInstance = {
					...defaultPartInstance(
						protectString(rundownId + '_partInstance_0'),
						playlistActivationId,
						segmentPlayoutId,
						firstPart
					),
				}

				mockPartInstancesCollection.insert(mockCurrentPartInstance)

				const infinitePieceInstance: PieceInstance = {
					...defaultPieceInstance(
						protectString('instance_' + infinitePiece._id),
						playlistActivationId,
						rundown._id,
						mockCurrentPartInstance._id,
						infinitePiece
					),
					userDuration: {
						endRelativeToPart: 2000,
					},
				}

				mockPieceInstancesCollection.insert(infinitePieceInstance)

				const followingPieceInstance: PieceInstance = {
					...defaultPieceInstance(
						protectString('instance_' + followingPiece._id),
						playlistActivationId,
						rundown._id,
						mockCurrentPartInstance._id,
						followingPiece
					),
				}

				mockPieceInstancesCollection.insert(followingPieceInstance)

				mockRundownPlaylistsCollection.update(playlistId, {
					$set: {
						currentPartInfo: {
							partInstanceId: mockCurrentPartInstance._id,
							rundownId: mockCurrentPartInstance.rundownId,
							manuallySelected: false,
							consumesNextSegmentId: false,
						},
					},
				})

				playlist = RundownPlaylists.findOne(playlistId)
				if (!playlist) throw new Error('Playlist not found')
				const { currentPartInstance, nextPartInstance } =
					RundownPlaylistCollectionUtil.getSelectedPartInstances(playlist)

				const resolvedSegment = RundownUtils.getResolvedSegment(
					showStyleBase,
					playlist,
					rundown,
					segment,
					new Set(segments.slice(0, 1).map((s) => s._id)),
					[],
					new Map(),
					parts.map((part) => part._id),
					new Map(),
					currentPartInstance,
					nextPartInstance
				)
				expect(resolvedSegment).toBeTruthy()
				expect(resolvedSegment.parts).toHaveLength(3)
				expect(resolvedSegment).toMatchObject({
					isLiveSegment: true,
					isNextSegment: false,
					currentNextPart: undefined,
					hasRemoteItems: false,
					hasGuestItems: false,
					autoNextPart: false,
				})

				expect(resolvedSegment.parts[0].pieces).toHaveLength(2)

				const resolvedInfinitePiece00 = resolvedSegment.parts[0].pieces.find(
					(piece) => piece.instance._id === infinitePieceInstance._id
				)
				expect(resolvedInfinitePiece00).toBeDefined()
				expect(resolvedInfinitePiece00?.renderedInPoint).toBe(1000)
				expect(resolvedInfinitePiece00?.renderedDuration).toBe(1000)

				const resolvedCroppingPiece00 = resolvedSegment.parts[0].pieces.find(
					(piece) => piece.instance._id === followingPieceInstance._id
				)
				expect(resolvedCroppingPiece00).toBeDefined()
				expect(resolvedCroppingPiece00?.renderedInPoint).toBe(4000)
				expect(resolvedCroppingPiece00?.renderedDuration).toBe(1000)

				expect(resolvedSegment.parts[1].pieces).toHaveLength(0)
			}
		)
	})
})
