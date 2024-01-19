/* eslint-disable @typescript-eslint/unbound-method */
import { RundownId, SegmentId, PartId, PartInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { updatePartInstanceRanks } from '../rundown'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { JobContext } from '../jobs'
import { BeforePartMapItem } from '../ingest/commit'
// eslint-disable-next-line node/no-extraneous-import
import { mock } from 'jest-mock-extended'
import { ICollection } from '../db'
import { IngestModel } from '../ingest/model/IngestModel'
import { IngestSegmentModel } from '../ingest/model/IngestSegmentModel'
import { clone } from '@sofie-automation/corelib/dist/lib'
import { IngestPartModel } from '../ingest/model/IngestPartModel'
import { AnyBulkWriteOperation } from 'mongodb'
import _ = require('underscore')

const mockOptions = {
	fallbackMockImplementation: () => {
		throw new Error('not mocked')
	},
}

describe('updatePartInstanceRanks', () => {
	const rundownId: RundownId = protectString('')
	const segmentId: SegmentId = protectString('')

	function getPartRanks(parts: DBPart[]): Array<{ id: PartId; rank: number }> {
		return parts.map((p) => ({ id: p._id, rank: p._rank }))
	}

	function addPartInstance(
		partInstances: DBPartInstance[],
		part: DBPart,
		orphaned?: DBPartInstance['orphaned']
	): PartInstanceId {
		const id: PartInstanceId = protectString(`${part._id}_instance`)
		partInstances.push({
			_id: id,
			rehearsal: false,
			takeCount: 0,
			rundownId,
			segmentId,
			playlistActivationId: protectString('active'),
			segmentPlayoutId: protectString(''),
			part,
			orphaned: orphaned,
		})
		return id
	}

	async function updateRanksForSegment(
		context: JobContext,
		expectedSegmentId: SegmentId,
		parts: DBPart[],
		initialRanks: BeforePartMapItem[]
	): Promise<void> {
		const ingestModel = mock<IngestModel>(
			{
				getSegment: (segmentId) => {
					if (segmentId !== expectedSegmentId) throw new Error('Wrong SegmentId')
					return mock<IngestSegmentModel>(
						{
							parts: parts.map((part) =>
								mock<IngestPartModel>(
									{
										part: part as any,
									},
									mockOptions
								)
							) as any,
						},
						mockOptions
					)
				},
			},
			mockOptions
		)

		const changeMap = new Map<SegmentId, Array<{ id: PartId; rank: number }>>()
		changeMap.set(expectedSegmentId, initialRanks)
		await updatePartInstanceRanks(context, ingestModel, [expectedSegmentId], changeMap)
	}

	function createFakeContext(partInstances: DBPartInstance[]) {
		const fakeCollection = mock<ICollection<DBPartInstance>>({}, mockOptions)
		const context = mock<JobContext>(
			{
				directCollections: mock(
					{
						PartInstances: fakeCollection,
					},
					mockOptions
				),
			},
			mockOptions
		)

		const expectedQuery = {
			reset: {
				$ne: true,
			},
			segmentId: { $in: [segmentId] },
		}

		fakeCollection.bulkWrite.mockImplementation(async () => null)
		fakeCollection.findFetch.mockImplementation(async (q) => {
			if (!_.isEqual(expectedQuery, q)) {
				throw new Error('Mismatch in query')
			} else {
				return clone(partInstances)
			}
		})

		return { context, fakeCollection }
	}

	function createMinimalPart(id: string, rank: number): DBPart {
		return {
			_id: protectString(id),
			_rank: rank,
			rundownId,
			segmentId,
			externalId: id,
			title: id,
			expectedDurationWithPreroll: undefined,
		}
	}

	function createFakeData() {
		const parts: DBPart[] = []
		const partInstances: DBPartInstance[] = []

		const addPart = (id: string, rank: number) => {
			parts.push(createMinimalPart(id, rank))

			partInstances.push({
				_id: protectString(`${id}_instance`),
				rehearsal: false,
				takeCount: 0,
				rundownId,
				segmentId,
				playlistActivationId: protectString('active'),
				segmentPlayoutId: protectString(''),
				part: createMinimalPart(id, rank),
				// orphaned: orphaned,
			})
		}

		addPart('part01', 1)
		addPart('part02', 2)
		addPart('part03', 3)
		addPart('part04', 4)
		addPart('part05', 5)

		return { parts, partInstances }
	}

	function updatePartRank(
		parts: DBPart[],
		expectedOps: AnyBulkWriteOperation<DBPartInstance>[],
		id: string,
		newRank: number
	): void {
		const partId = protectString(id)

		let updated = false
		for (const part of parts) {
			if (part._id === partId) {
				part._rank = newRank
				updated = true
			}
		}

		const partInstanceId = protectString(`${partId}_instance`)

		addExpectedOp(expectedOps, partInstanceId, newRank, !updated ? 'deleted' : undefined)
	}

	function removePart(parts: DBPart[], id: string) {
		const partIndex = parts.findIndex((p) => p._id === protectString(id))
		expect(partIndex).not.toBe(-1)
		parts.splice(partIndex, 1)
	}

	function addExpectedOp(
		expectedOps: AnyBulkWriteOperation<DBPartInstance>[],
		partInstanceId: PartInstanceId | string,
		newRank: number,
		orphaned: DBPartInstance['orphaned'] | null
	) {
		expectedOps.push({
			updateOne: {
				filter: {
					_id: partInstanceId as PartInstanceId,
				},
				update: {
					$set: {
						'part._rank': newRank,
						...(orphaned
							? {
									orphaned: orphaned,
							  }
							: ''),
					},
					...(orphaned === undefined
						? {
								$unset: {
									orphaned: 1,
								},
						  }
						: ''),
				},
			},
		})
	}

	function updatePartInstanceRank(partInstances: DBPartInstance[], partId: string, newRank: number): void {
		const partInstanceId = protectString(`${partId}_instance`)

		for (const partInstance of partInstances) {
			if (partInstance._id === partInstanceId) {
				partInstance.part._rank = newRank
			}
		}
	}

	test('sync from parts: no change', async () => {
		const { parts, partInstances } = createFakeData()
		const { context, fakeCollection } = createFakeContext(partInstances)

		const initialRanks = getPartRanks(parts)
		expect(initialRanks).toHaveLength(5)

		fakeCollection.findFetch.mockImplementationOnce(async () => clone(partInstances))
		fakeCollection.bulkWrite.mockImplementationOnce(async () => null)

		await updateRanksForSegment(context, segmentId, parts, initialRanks)

		expect(fakeCollection.findFetch).toHaveBeenCalledTimes(1)
		expect(fakeCollection.findFetch).toHaveBeenCalledWith({
			reset: {
				$ne: true,
			},
			segmentId: { $in: [segmentId] },
		})
		expect(fakeCollection.bulkWrite).toHaveBeenCalledTimes(0)
	})

	test('sync from parts: swap part order', async () => {
		const { parts, partInstances } = createFakeData()
		const { context, fakeCollection } = createFakeContext(partInstances)

		const initialRanks = getPartRanks(parts)
		expect(initialRanks).toHaveLength(5)

		// swap the middle ones
		const expectedResult: AnyBulkWriteOperation<DBPartInstance>[] = []
		updatePartRank(parts, expectedResult, 'part02', 3)
		updatePartRank(parts, expectedResult, 'part03', 4)
		updatePartRank(parts, expectedResult, 'part04', 2)

		await updateRanksForSegment(context, segmentId, parts, initialRanks)

		expect(fakeCollection.findFetch).toHaveBeenCalledTimes(1)
		expect(fakeCollection.bulkWrite).toHaveBeenCalledTimes(1)
		expect(fakeCollection.bulkWrite).toHaveBeenCalledWith(expectedResult)

		// Update our Instances to match
		updatePartInstanceRank(partInstances, 'part02', 3)
		updatePartInstanceRank(partInstances, 'part03', 4)
		updatePartInstanceRank(partInstances, 'part04', 2)
	})

	test('sync from parts: swap part order2', async () => {
		const { parts, partInstances } = createFakeData()
		const { context, fakeCollection } = createFakeContext(partInstances)

		const initialRanks = getPartRanks(parts)
		expect(initialRanks).toHaveLength(5)

		// try swapping the first and last
		const expectedResult: AnyBulkWriteOperation<DBPartInstance>[] = []
		updatePartRank(parts, expectedResult, 'part01', 5)
		updatePartRank(parts, expectedResult, 'part02', 0)
		updatePartRank(parts, expectedResult, 'part05', 1)

		await updateRanksForSegment(context, segmentId, parts, initialRanks)

		expect(fakeCollection.findFetch).toHaveBeenCalledTimes(1)
		expect(fakeCollection.bulkWrite).toHaveBeenCalledTimes(1)
		expect(fakeCollection.bulkWrite).toHaveBeenCalledWith(expectedResult)
	})

	test('sync from parts: missing part', async () => {
		const { parts, partInstances } = createFakeData()
		const { context, fakeCollection } = createFakeContext(partInstances)

		const initialRanks = getPartRanks(parts)
		expect(initialRanks).toHaveLength(5)

		// remove one and offset the others
		removePart(parts, 'part03')

		const expectedResult: AnyBulkWriteOperation<DBPartInstance>[] = []
		updatePartRank(parts, expectedResult, 'part03', 2.5)
		updatePartRank(parts, expectedResult, 'part04', 3)
		updatePartRank(parts, expectedResult, 'part05', 4)

		await updateRanksForSegment(context, segmentId, parts, initialRanks)

		expect(fakeCollection.findFetch).toHaveBeenCalledTimes(1)
		expect(fakeCollection.bulkWrite).toHaveBeenCalledTimes(1)
		expect(fakeCollection.bulkWrite).toHaveBeenCalledWith(expectedResult)
	})

	test('sync from parts: missing first part', async () => {
		const { parts, partInstances } = createFakeData()
		const { context, fakeCollection } = createFakeContext(partInstances)

		const initialRanks = getPartRanks(parts)
		expect(initialRanks).toHaveLength(5)

		// remove one and offset the others
		removePart(parts, 'part01')

		const expectedResult: AnyBulkWriteOperation<DBPartInstance>[] = []
		updatePartRank(parts, expectedResult, 'part01', 0)
		updatePartRank(parts, expectedResult, 'part02', 1)
		updatePartRank(parts, expectedResult, 'part03', 2)
		updatePartRank(parts, expectedResult, 'part04', 3)
		updatePartRank(parts, expectedResult, 'part05', 4)

		await updateRanksForSegment(context, segmentId, parts, initialRanks)

		expect(fakeCollection.findFetch).toHaveBeenCalledTimes(1)
		expect(fakeCollection.bulkWrite).toHaveBeenCalledTimes(1)
		expect(fakeCollection.bulkWrite).toHaveBeenCalledWith(expectedResult)
	})

	test('sync from parts: adlib part after missing part', async () => {
		const { parts, partInstances } = createFakeData()
		const { context, fakeCollection } = createFakeContext(partInstances)

		const initialRanks = getPartRanks(parts)
		expect(initialRanks).toHaveLength(5)

		// insert an adlib part
		const adlibId = 'adlib0'
		addPartInstance(
			partInstances,
			createMinimalPart(adlibId, 3.5), // after part03
			'adlib-part'
		)

		// remove one and offset the others
		removePart(parts, 'part03')

		const expectedResult: AnyBulkWriteOperation<DBPartInstance>[] = []
		updatePartRank(parts, expectedResult, 'part03', 2.3333333333333335)
		updatePartRank(parts, expectedResult, 'part04', 3)
		updatePartRank(parts, expectedResult, 'part05', 4)
		addExpectedOp(expectedResult, protectString(`${adlibId}_instance`), 2.666666666666667, null)

		await updateRanksForSegment(context, segmentId, parts, initialRanks)

		expect(fakeCollection.findFetch).toHaveBeenCalledTimes(1)
		expect(fakeCollection.bulkWrite).toHaveBeenCalledTimes(1)
		expect(fakeCollection.bulkWrite).toHaveBeenCalledWith(expectedResult)
	})

	test('sync from parts: delete and insert segment', async () => {
		const { parts, partInstances } = createFakeData()
		const { context, fakeCollection } = createFakeContext(partInstances)

		const initialRanks = getPartRanks(parts)
		expect(initialRanks).toHaveLength(5)

		// Delete the segment
		parts.splice(0, parts.length)
		expect(parts).toHaveLength(0)

		// Every PartInstance should be marked as deleted with a different rank
		const expectedResult: AnyBulkWriteOperation<DBPartInstance>[] = []
		for (const partInstance of partInstances) {
			addExpectedOp(expectedResult, partInstance._id, partInstance.part._rank - 1, 'deleted')
		}

		await updateRanksForSegment(context, segmentId, parts, initialRanks)

		expect(fakeCollection.findFetch).toHaveBeenCalledTimes(1)
		expect(fakeCollection.bulkWrite).toHaveBeenCalledTimes(1)
		expect(fakeCollection.bulkWrite).toHaveBeenCalledWith(expectedResult)

		// Insert new segment
		const newParts: DBPart[] = [
			createMinimalPart('part10', 0),
			createMinimalPart('part11', 1),
			createMinimalPart('part12', 2),
		]

		const expectedResult2: AnyBulkWriteOperation<DBPartInstance>[] = []
		addExpectedOp(expectedResult2, 'part01_instance', -5, 'deleted')
		addExpectedOp(expectedResult2, 'part02_instance', -4, 'deleted')
		addExpectedOp(expectedResult2, 'part03_instance', -3, 'deleted')
		addExpectedOp(expectedResult2, 'part04_instance', -2, 'deleted')
		addExpectedOp(expectedResult2, 'part05_instance', -1, 'deleted')

		fakeCollection.findFetch.mockClear()
		fakeCollection.bulkWrite.mockClear()

		await updateRanksForSegment(context, segmentId, newParts, [])

		expect(fakeCollection.findFetch).toHaveBeenCalledTimes(1)
		expect(fakeCollection.bulkWrite).toHaveBeenCalledTimes(1)
		expect(fakeCollection.bulkWrite).toHaveBeenCalledWith(expectedResult2)
	})

	test('sync from parts: replace segment', async () => {
		const { parts, partInstances } = createFakeData()
		const { context, fakeCollection } = createFakeContext(partInstances)

		const initialRanks = getPartRanks(parts)
		expect(initialRanks).toHaveLength(5)

		// Delete the segment
		parts.splice(0, parts.length)
		expect(parts).toHaveLength(0)

		// Every PartInstance should remain as orphaned
		const expectedResult: AnyBulkWriteOperation<DBPartInstance>[] = []
		for (const partInstance of partInstances) {
			addExpectedOp(expectedResult, partInstance._id, partInstance.part._rank - 5.5, 'deleted')
		}

		// Insert new segment
		parts.push(createMinimalPart('part10', 0.5))
		parts.push(createMinimalPart('part11', 1))
		parts.push(createMinimalPart('part12', 2))

		await updateRanksForSegment(context, segmentId, parts, initialRanks)

		expect(fakeCollection.findFetch).toHaveBeenCalledTimes(1)
		expect(fakeCollection.bulkWrite).toHaveBeenCalledTimes(1)
		expect(fakeCollection.bulkWrite).toHaveBeenCalledWith(expectedResult)
	})
})
