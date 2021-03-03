import '../../../../../__mocks__/_extendJest'
import {
	setupDefaultStudioEnvironment,
	DefaultEnvironment,
	setupDefaultRundownPlaylist,
} from '../../../../../__mocks__/helpers/database'
import { DBRundown, RundownId, Rundowns } from '../../../../../lib/collections/Rundowns'
import { RundownPlaylist, RundownPlaylistId, RundownPlaylists } from '../../../../../lib/collections/RundownPlaylists'
import {
	getCurrentTime,
	getRandomId,
	literal,
	protectString,
	protectStringArray,
	waitForPromise,
} from '../../../../../lib/lib'
import { DBSegment, SegmentId, Segments } from '../../../../../lib/collections/Segments'
import { DBPart, Part, PartId, Parts } from '../../../../../lib/collections/Parts'
import { Piece, PieceId, Pieces } from '../../../../../lib/collections/Pieces'
import { LookaheadMode, OnGenerateTimelineObj, PieceLifespan, TSR } from '@sofie-automation/blueprints-integration'
import { MappingsExt, Studios } from '../../../../../lib/collections/Studios'
import { PartInstanceId } from '../../../../../lib/collections/PartInstances'
import { PieceInstance } from '../../../../../lib/collections/PieceInstances'
import { OnGenerateTimelineObjExt, TimelineObjRundown } from '../../../../../lib/collections/Timeline'
import { isUndefined, omit } from 'underscore'
import _ from 'underscore'
import { findLookaheadObjectsForPart } from '../findObjects'
import { PartAndPieces, PartInstanceAndPieceInstances } from '../util'
import { Random } from 'meteor/random'
import { getPartId } from '../../../ingest/lib'
import { wrapWithCacheForRundownPlaylist } from '../../../../DatabaseCaches'
import { getLookeaheadObjects } from '..'
import { SelectedPartInstancesTimelineInfo, SelectedPartInstanceTimelineInfo } from '../../timeline'
import { testInFiber } from '../../../../../__mocks__/helpers/jest'

jest.mock('../findForLayer')
type TfindLookaheadForLayer = jest.MockedFunction<typeof findLookaheadForLayer>
const findLookaheadForLayerMock = findLookaheadForLayer as TfindLookaheadForLayer
import { findLookaheadForLayer } from '../findForLayer'

jest.mock('../util')
type TgetOrderedPartsAfterPlayhead = jest.MockedFunction<typeof getOrderedPartsAfterPlayhead>
const getOrderedPartsAfterPlayheadMock = getOrderedPartsAfterPlayhead as TgetOrderedPartsAfterPlayhead
import { getOrderedPartsAfterPlayhead } from '../util'

describe('Lookahead', () => {
	let env: DefaultEnvironment
	let playlistId: RundownPlaylistId
	let rundownId: RundownId
	// let segmentId: SegmentId
	let partIds: PartId[]

	beforeEach(() => {
		findLookaheadForLayerMock.mockReset().mockReturnValue({ timed: [], future: [] }) // Default mock
		getOrderedPartsAfterPlayheadMock.mockReset().mockReturnValue([])

		env = setupDefaultStudioEnvironment()
		const mappings: MappingsExt = {}
		for (const k of Object.keys(LookaheadMode)) {
			if (isNaN(parseInt(k))) {
				mappings[k] = {
					device: TSR.DeviceType.ABSTRACT,
					deviceId: protectString('fake0'),
					lookahead: LookaheadMode[k],
					// lookaheadDepth: 0,
					// lookaheadMaxSearchDistance: 0,
				}
			}
		}
		Studios.update(env.studio._id, { $set: { mappings } })
		env.studio.mappings = mappings
		;({ playlistId, rundownId } = setupDefaultRundownPlaylist(
			env,
			undefined,
			(env: DefaultEnvironment, playlistId: RundownPlaylistId, rundownId: RundownId) => {
				const rundown: DBRundown = {
					peripheralDeviceId: env.ingestDevice._id,
					organizationId: null,
					studioId: env.studio._id,
					showStyleBaseId: env.showStyleBase._id,
					showStyleVariantId: env.showStyleVariant._id,
					playlistId: playlistId,
					_rank: 0,
					_id: rundownId,
					externalId: 'MOCK_RUNDOWN',
					name: 'Default Rundown',
					created: getCurrentTime(),
					modified: getCurrentTime(),
					importVersions: {
						studio: '',
						showStyleBase: '',
						showStyleVariant: '',
						blueprint: '',
						core: '',
					},
					externalNRCSName: 'mock',
				}
				Rundowns.insert(rundown)

				function createMockPart(index: number, segId: SegmentId): DBPart {
					return {
						_id: protectString(rundownId + '_part' + index),
						segmentId: segId,
						rundownId: rundown._id,
						_rank: index,
						externalId: 'MOCK_PART_' + index,
						title: 'Part ' + index,
					}
				}

				const segmentId0: SegmentId = getRandomId()
				const segmentId1: SegmentId = getRandomId()
				const segmentId2: SegmentId = getRandomId()

				partIds = [
					Parts.insert(createMockPart(0, segmentId0)),
					Parts.insert(createMockPart(1, segmentId0)),
					Parts.insert(createMockPart(2, segmentId0)),
					Parts.insert(createMockPart(3, segmentId0)),
					Parts.insert(createMockPart(4, segmentId0)),

					Parts.insert(createMockPart(10, segmentId1)),
					Parts.insert(createMockPart(11, segmentId1)),
					Parts.insert(createMockPart(12, segmentId1)),

					Parts.insert(createMockPart(20, segmentId2)),
					Parts.insert(createMockPart(21, segmentId2)),
					Parts.insert(createMockPart(22, segmentId2)),
				]

				return rundownId
			}
		))
	})

	function expectLookaheadForLayerMock(
		playlist: RundownPlaylist,
		partInstances: PartInstanceAndPieceInstances[],
		previous: PartInstanceAndPieceInstances | undefined,
		orderedPartsFollowingPlayhead: Part[],
		piecesByPart: Map<PartId, Piece[]>,
		extraParts: number = 0
	) {
		const partCount = orderedPartsFollowingPlayhead.length + extraParts

		expect(findLookaheadForLayerMock).toHaveBeenCalledTimes(2)
		expect(findLookaheadForLayerMock).toHaveBeenNthCalledWith(
			1,
			playlist.currentPartInstanceId,
			partInstances,
			previous,
			orderedPartsFollowingPlayhead,
			piecesByPart,
			'PRELOAD',
			1,
			partCount
		)
		expect(findLookaheadForLayerMock).toHaveBeenNthCalledWith(
			2,
			playlist.currentPartInstanceId,
			partInstances,
			previous,
			orderedPartsFollowingPlayhead,
			piecesByPart,
			'WHEN_CLEAR',
			1,
			partCount
		)
		findLookaheadForLayerMock.mockClear()
	}

	testInFiber('No pieces', () => {
		const playlist = RundownPlaylists.findOne(playlistId) as RundownPlaylist
		expect(playlist).toBeTruthy()

		const partInstancesInfo: SelectedPartInstancesTimelineInfo = {}

		const fakeParts = partIds.map((p) => ({ _id: p })) as Part[]
		getOrderedPartsAfterPlayheadMock.mockReturnValueOnce(fakeParts)

		const res = waitForPromise(
			wrapWithCacheForRundownPlaylist(playlist, (cache) =>
				getLookeaheadObjects(cache, env.studio, playlist, partInstancesInfo)
			)
		)
		expect(res).toHaveLength(0)

		expect(getOrderedPartsAfterPlayheadMock).toHaveBeenCalledTimes(1)
		expect(getOrderedPartsAfterPlayheadMock).toHaveBeenCalledWith(expect.anything(), playlist, 10) // default distance
		expectLookaheadForLayerMock(playlist, [], undefined, fakeParts, new Map())
	})

	function fakeResultObj(id: string, pieceId: string, layer: string): TimelineObjRundown & OnGenerateTimelineObjExt {
		return {
			id: id,
			pieceInstanceId: pieceId,
			layer: layer,
			content: { id },
		} as any
	}

	testInFiber('got some objects', () => {
		const playlist = RundownPlaylists.findOne(playlistId) as RundownPlaylist
		expect(playlist).toBeTruthy()

		const partInstancesInfo: SelectedPartInstancesTimelineInfo = {}

		const fakeParts = partIds.map((p) => ({ _id: p })) as Part[]
		getOrderedPartsAfterPlayheadMock.mockReturnValueOnce(fakeParts)

		findLookaheadForLayerMock
			.mockImplementationOnce((_id, _parts, _prev, _parts2, _pieces, layer) => ({
				timed: [fakeResultObj('obj0', 'piece0', layer), fakeResultObj('obj1', 'piece1', layer)],
				future: [
					fakeResultObj('obj2', 'piece0', layer),
					fakeResultObj('obj3', 'piece0', layer),
					fakeResultObj('obj4', 'piece0', layer),
				],
			}))
			.mockImplementationOnce((_id, _parts, _prev, _parts2, _pieces, layer) => ({
				timed: [fakeResultObj('obj5', 'piece1', layer), fakeResultObj('obj6', 'piece0', layer)],
				future: [
					fakeResultObj('obj7', 'piece1', layer),
					fakeResultObj('obj8', 'piece1', layer),
					fakeResultObj('obj9', 'piece0', layer),
				],
			}))

		const res = waitForPromise(
			wrapWithCacheForRundownPlaylist(playlist, (cache) =>
				getLookeaheadObjects(cache, env.studio, playlist, partInstancesInfo)
			)
		)
		expect(res).toHaveLength(8)
		expect(res).toMatchSnapshot()

		// 2x timed + 1x future
		expect(res.filter((r) => r.layer === 'WHEN_CLEAR')).toHaveLength(3)

		expect(getOrderedPartsAfterPlayheadMock).toHaveBeenCalledTimes(1)
		expect(getOrderedPartsAfterPlayheadMock).toHaveBeenCalledWith(expect.anything(), playlist, 10) // default distance
		expectLookaheadForLayerMock(playlist, [], undefined, fakeParts, new Map())
	})

	testInFiber('Different max distances', () => {
		const playlist = RundownPlaylists.findOne(playlistId) as RundownPlaylist
		expect(playlist).toBeTruthy()

		const partInstancesInfo: SelectedPartInstancesTimelineInfo = {}

		// Set really low
		env.studio.mappings['WHEN_CLEAR'].lookaheadMaxSearchDistance = 0
		env.studio.mappings['PRELOAD'].lookaheadMaxSearchDistance = 0
		waitForPromise(
			wrapWithCacheForRundownPlaylist(playlist, (cache) =>
				getLookeaheadObjects(cache, env.studio, playlist, partInstancesInfo)
			)
		)
		expect(getOrderedPartsAfterPlayheadMock).toHaveBeenCalledTimes(1)
		expect(getOrderedPartsAfterPlayheadMock).toHaveBeenCalledWith(expect.anything(), playlist, 0)

		// really high
		getOrderedPartsAfterPlayheadMock.mockClear()
		env.studio.mappings['WHEN_CLEAR'].lookaheadMaxSearchDistance = -1
		env.studio.mappings['PRELOAD'].lookaheadMaxSearchDistance = 2000
		waitForPromise(
			wrapWithCacheForRundownPlaylist(playlist, (cache) =>
				getLookeaheadObjects(cache, env.studio, playlist, partInstancesInfo)
			)
		)
		expect(getOrderedPartsAfterPlayheadMock).toHaveBeenCalledTimes(1)
		expect(getOrderedPartsAfterPlayheadMock).toHaveBeenCalledWith(expect.anything(), playlist, 2000)

		// unset
		getOrderedPartsAfterPlayheadMock.mockClear()
		env.studio.mappings['WHEN_CLEAR'].lookaheadMaxSearchDistance = undefined
		env.studio.mappings['PRELOAD'].lookaheadMaxSearchDistance = -1
		waitForPromise(
			wrapWithCacheForRundownPlaylist(playlist, (cache) =>
				getLookeaheadObjects(cache, env.studio, playlist, partInstancesInfo)
			)
		)
		expect(getOrderedPartsAfterPlayheadMock).toHaveBeenCalledTimes(1)
		expect(getOrderedPartsAfterPlayheadMock).toHaveBeenCalledWith(expect.anything(), playlist, 10)
	})

	testInFiber('PartInstances translation', () => {
		const playlist = RundownPlaylists.findOne(playlistId) as RundownPlaylist
		expect(playlist).toBeTruthy()

		const fakeParts = partIds.map((p) => ({ _id: p })) as Part[]
		getOrderedPartsAfterPlayheadMock.mockReturnValue(fakeParts)

		const partInstancesInfo: SelectedPartInstancesTimelineInfo = {
			previous: {
				partInstance: 'abc' as any,
				nowInPart: 987,
				pieceInstances: ['1', '2'] as any,
			},
		}
		const expectedPrevious = {
			part: partInstancesInfo.previous!.partInstance,
			onTimeline: true,
			nowInPart: partInstancesInfo.previous!.nowInPart,
			allPieces: partInstancesInfo.previous!.pieceInstances,
		}

		// With a previous
		waitForPromise(
			wrapWithCacheForRundownPlaylist(playlist, (cache) =>
				getLookeaheadObjects(cache, env.studio, playlist, partInstancesInfo)
			)
		)
		expectLookaheadForLayerMock(playlist, [], expectedPrevious, fakeParts, new Map())

		// Add a current
		partInstancesInfo.current = {
			partInstance: { _id: 'curr', part: {} } as any,
			nowInPart: 56,
			pieceInstances: ['3', '4'] as any,
		}
		const expectedCurrent = {
			part: partInstancesInfo.current!.partInstance,
			onTimeline: true,
			nowInPart: partInstancesInfo.current!.nowInPart,
			allPieces: partInstancesInfo.current!.pieceInstances,
		}
		waitForPromise(
			wrapWithCacheForRundownPlaylist(playlist, (cache) =>
				getLookeaheadObjects(cache, env.studio, playlist, partInstancesInfo)
			)
		)
		expectLookaheadForLayerMock(playlist, [expectedCurrent], expectedPrevious, fakeParts, new Map())

		// Add a next
		partInstancesInfo.next = {
			partInstance: 'nxt' as any,
			nowInPart: -85,
			pieceInstances: ['5'] as any,
		}
		const expectedNext = {
			part: partInstancesInfo.next!.partInstance,
			onTimeline: false,
			nowInPart: partInstancesInfo.next!.nowInPart,
			allPieces: partInstancesInfo.next!.pieceInstances,
		}
		waitForPromise(
			wrapWithCacheForRundownPlaylist(playlist, (cache) =>
				getLookeaheadObjects(cache, env.studio, playlist, partInstancesInfo)
			)
		)
		expectLookaheadForLayerMock(
			playlist,
			[expectedCurrent, expectedNext],
			expectedPrevious,
			fakeParts,
			new Map(),
			1
		)

		// current has autonext
		partInstancesInfo.current.partInstance.part.autoNext = true
		expectedNext.onTimeline = true
		waitForPromise(
			wrapWithCacheForRundownPlaylist(playlist, (cache) =>
				getLookeaheadObjects(cache, env.studio, playlist, partInstancesInfo)
			)
		)
		expectLookaheadForLayerMock(
			playlist,
			[expectedCurrent, expectedNext],
			expectedPrevious,
			fakeParts,
			new Map(),
			1
		)
	})

	testInFiber('Pieces', () => {
		const playlist = RundownPlaylists.findOne(playlistId) as RundownPlaylist
		expect(playlist).toBeTruthy()

		const fakeParts = partIds.map((p) => ({ _id: p })) as Part[]
		getOrderedPartsAfterPlayheadMock.mockReturnValue(fakeParts)

		const partInstancesInfo: SelectedPartInstancesTimelineInfo = {}

		const pieceMap = new Map<PartId, Piece[]>()

		partIds.forEach((id, i) => {
			const pieces: Piece[] = []
			const target = (i + 2) % 3
			for (let o = 0; o <= target; o++) {
				const piece: Piece = {
					_id: `piece_${i}_${o}`,
					startPartId: id,
					startRundownId: rundownId,
					invalid: target === 2 && i % 2 === 1, // Some 'randomness'
				} as any
				Pieces.insert(piece)
				if (!piece.invalid) {
					pieces.push(piece)
				}
			}

			if (pieces.length > 0) {
				pieceMap.set(id, pieces)
			}
		})
		// Add a couple of pieces which are incorrectly owned
		Pieces.insert({
			_id: `piece_a`,
			startPartId: partIds[0],
			startRundownId: rundownId + '9',
		} as any)
		Pieces.insert({
			_id: `piece_b`,
			startPartId: 'not-real',
			startRundownId: rundownId,
		} as any)

		// pieceMap should have come through valid
		waitForPromise(
			wrapWithCacheForRundownPlaylist(playlist, async (cache) => {
				await getLookeaheadObjects(cache, env.studio, playlist, partInstancesInfo)
				expect(cache.Pieces.initialized).toBeFalsy()
			})
		)
		expectLookaheadForLayerMock(playlist, [], undefined, fakeParts, pieceMap)

		// Use the modified cache values
		const removedIds: PieceId[] = protectStringArray(['piece_1_0', 'piece_4_0'])
		waitForPromise(
			wrapWithCacheForRundownPlaylist(playlist, async (cache) => {
				expect(
					cache.Pieces.update(removedIds[0], {
						$set: {
							invalid: true,
						},
					})
				).toEqual(1)
				cache.Pieces.remove(removedIds[1])
				expect(cache.Pieces.initialized).toBeTruthy()

				await getLookeaheadObjects(cache, env.studio, playlist, partInstancesInfo)
			})
		)
		const pieceMap2 = new Map<PartId, Piece[]>()
		for (const [id, pieces] of pieceMap) {
			const pieces2 = pieces.filter((p) => !removedIds.includes(p._id))
			if (pieces2.length) pieceMap2.set(id, pieces2)
		}
		expectLookaheadForLayerMock(playlist, [], undefined, fakeParts, pieceMap2)
	})
})
