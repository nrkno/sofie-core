import '../../../../../__mocks__/_extendJest'
import { Part, PartId } from '../../../../../lib/collections/Parts'
import { Piece } from '../../../../../lib/collections/Pieces'
import _ from 'underscore'
import { findLookaheadForLayer } from '../findForLayer'
import { PartAndPieces, PartInstanceAndPieceInstances } from '../util'
import { Random } from 'meteor/random'

jest.mock('../findObjects')
import { findLookaheadObjectsForPart } from '../findObjects'
import { wrapPieceToInstance } from '../../../../../lib/collections/PieceInstances'
import { protectString } from '../../../../../lib/lib'
type TfindLookaheadObjectsForPart = jest.MockedFunction<typeof findLookaheadObjectsForPart>
const findLookaheadObjectsForPartMock = findLookaheadObjectsForPart as TfindLookaheadObjectsForPart
findLookaheadObjectsForPartMock.mockImplementation(() => []) // Default mock

describe('findLookaheadForLayer', () => {
	test('no data', () => {
		const res = findLookaheadForLayer(null, [], undefined, [], new Map(), 'abc', 1, 1)
		expect(res.timed).toHaveLength(0)
		expect(res.future).toHaveLength(0)
	})

	function expectInstancesToMatch(
		index: number,
		layer: string,
		partInstanceInfo: PartInstanceAndPieceInstances,
		previousPart: PartInstanceAndPieceInstances | undefined
	): void {
		expect(findLookaheadObjectsForPartMock).toHaveBeenNthCalledWith(
			index,
			null,
			layer,
			previousPart?.part.part,
			{
				part: partInstanceInfo.part.part,
				pieces: partInstanceInfo.allPieces,
			},
			partInstanceInfo.part._id,
			partInstanceInfo.nowInPart
		)
	}

	test('partInstances', () => {
		const layer = Random.id()

		const partInstancesInfo: PartInstanceAndPieceInstances[] = [
			{
				part: { _id: '1', part: '1p' },
				pieces: [1, 2, 3],
				onTimeline: true,
				nowInPart: 2000,
			},
			{
				part: { _id: '2', part: '2p' },
				pieces: [4, 5, 6],
				onTimeline: true,
				nowInPart: 1000,
			},
			{
				part: { _id: '3', part: '3p' },
				pieces: [7, 8, 9],
				onTimeline: false,
				nowInPart: 0,
			},
		] as any

		findLookaheadObjectsForPartMock
			.mockReset()
			.mockReturnValue([])
			.mockReturnValueOnce(['t0', 't1'] as any)
			.mockReturnValueOnce(['t2', 't3'] as any)
			.mockReturnValueOnce(['t4', 't5'] as any)

		// Run it
		const res = findLookaheadForLayer(null, partInstancesInfo, undefined, [], new Map(), layer, 1, 1)
		expect(res.timed).toEqual(['t0', 't1', 't2', 't3'])
		expect(res.future).toEqual(['t4', 't5'])

		// Check the mock was called correctly
		expect(findLookaheadObjectsForPartMock).toHaveBeenCalledTimes(3)
		expectInstancesToMatch(1, layer, partInstancesInfo[0], undefined)
		expectInstancesToMatch(2, layer, partInstancesInfo[1], partInstancesInfo[0])
		expectInstancesToMatch(3, layer, partInstancesInfo[2], partInstancesInfo[1])

		// Check a previous part gets propogated
		const previousPartInfo: PartInstanceAndPieceInstances = {
			part: { _id: '5', part: '5p' },
			pieces: [10, 11, 12],
			onTimeline: true,
		} as any
		findLookaheadObjectsForPartMock.mockReset().mockReturnValue([])
		findLookaheadForLayer(null, partInstancesInfo, previousPartInfo, [], new Map(), layer, 1, 1)
		expect(findLookaheadObjectsForPartMock).toHaveBeenCalledTimes(3)
		expectInstancesToMatch(1, layer, partInstancesInfo[0], previousPartInfo)

		// Max search distance of 0 should ignore any not on the timeline
		findLookaheadObjectsForPartMock
			.mockReset()
			.mockReturnValue([])
			.mockReturnValueOnce(['t0', 't1'] as any)
			.mockReturnValueOnce(['t2', 't3'] as any)
			.mockReturnValueOnce(['t4', 't5'] as any)

		const res2 = findLookaheadForLayer(null, partInstancesInfo, undefined, [], new Map(), layer, 1, 0)
		expect(res2.timed).toEqual(['t0', 't1', 't2', 't3'])
		expect(res2.future).toHaveLength(0)
		expect(findLookaheadObjectsForPartMock).toHaveBeenCalledTimes(2)
		expectInstancesToMatch(1, layer, partInstancesInfo[0], undefined)
		expectInstancesToMatch(2, layer, partInstancesInfo[1], partInstancesInfo[0])
	})

	function expectPartToMatch(
		index: number,
		layer: string,
		partInfo: PartAndPieces,
		previousPart: Part | undefined
	): void {
		expect(findLookaheadObjectsForPartMock).toHaveBeenNthCalledWith(
			index,
			null,
			layer,
			previousPart,
			partInfo,
			null,
			0
		)
	}

	test('parts', () => {
		const layer = Random.id()

		const orderedParts: Part[] = [
			{ _id: 'p1' },
			{ _id: 'p2', invalid: true },
			{ _id: 'p3' },
			{ _id: 'p4' },
			{ _id: 'p5' },
		].map((p) => new Part(p as any))
		const piecesMap = new Map<PartId, Piece[]>()
		for (const part of orderedParts) {
			piecesMap.set(part._id, [{ _id: part._id + '_p1' }] as any)
		}

		function getPartInfo(i: number): PartAndPieces {
			const part = orderedParts[i]
			return {
				part,
				pieces: piecesMap
					.get(part._id)
					?.map((p) => wrapPieceToInstance(p, protectString(''), protectString(''), true)),
			} as any
		}

		findLookaheadObjectsForPartMock
			.mockReset()
			.mockReturnValue([])
			.mockReturnValueOnce(['t0', 't1'] as any)
			.mockReturnValueOnce(['t2', 't3'] as any)
			.mockReturnValueOnce(['t4', 't5'] as any)
			.mockReturnValueOnce(['t6', 't7'] as any)
			.mockReturnValueOnce(['t8', 't9'] as any)

		// Cant search far enough
		const res = findLookaheadForLayer(null, [], undefined, orderedParts, piecesMap, layer, 1, 1)
		expect(res.timed).toHaveLength(0)
		expect(res.future).toHaveLength(0)
		expect(findLookaheadObjectsForPartMock).toHaveBeenCalledTimes(0)

		// Find the target of 1
		const res2 = findLookaheadForLayer(null, [], undefined, orderedParts, piecesMap, layer, 1, 4)
		expect(res2.timed).toHaveLength(0)
		expect(res2.future).toEqual(['t0', 't1'])
		expect(findLookaheadObjectsForPartMock).toHaveBeenCalledTimes(1)
		expectPartToMatch(1, layer, getPartInfo(0), undefined)

		// Find the target of 0
		findLookaheadObjectsForPartMock.mockReset().mockReturnValue([])
		const res3 = findLookaheadForLayer(null, [], undefined, orderedParts, piecesMap, layer, 0, 4)
		expect(res3.timed).toHaveLength(0)
		expect(res3.future).toHaveLength(0)
		expect(findLookaheadObjectsForPartMock).toHaveBeenCalledTimes(0)

		// Search max distance
		findLookaheadObjectsForPartMock
			.mockReset()
			.mockReturnValue([])
			.mockReturnValueOnce(['t0', 't1'] as any)
			.mockReturnValueOnce(['t2', 't3'] as any)
			.mockReturnValueOnce(['t4', 't5'] as any)
			.mockReturnValueOnce(['t6', 't7'] as any)
			.mockReturnValueOnce(['t8', 't9'] as any)

		const res4 = findLookaheadForLayer(null, [], undefined, orderedParts, piecesMap, layer, 100, 5)
		expect(res4.timed).toHaveLength(0)
		expect(res4.future).toEqual(['t0', 't1', 't2', 't3', 't4', 't5'])
		expect(findLookaheadObjectsForPartMock).toHaveBeenCalledTimes(3)
		expectPartToMatch(1, layer, getPartInfo(0), undefined)
		expectPartToMatch(2, layer, getPartInfo(2), orderedParts[0])
		expectPartToMatch(3, layer, getPartInfo(3), orderedParts[2])
	})
})
