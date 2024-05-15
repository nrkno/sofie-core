import { MockJobContext, setupDefaultJobEnvironment } from '../../../__mocks__/context'
import { updateSegmentIdsForAdlibbedPartInstances } from '../updateSegmentIdsForAdlibbedPartInstances'
import { BeforePartMapItem } from '../../commit'
import { RundownId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { getRundownId } from '../../lib'
import { CacheForIngest } from '../../cache'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'

describe('updateSegmentsForAdlibbedPartInstances', () => {
	async function createDefaultCache(context: MockJobContext, rundownExternalId: string) {
		const rundownId = getRundownId(context.studioId, rundownExternalId)

		const rundownLock = await context.lockRundown(rundownId)
		const cache = await CacheForIngest.create(context, rundownLock, rundownExternalId)

		// Should start empty
		expect(cache.Segments.findAll(null)).toHaveLength(0)
		expect(cache.Parts.findAll(null)).toHaveLength(0)

		// Give some default contents
		cache.Segments.insert({
			_id: protectString('segment0'),
			_rank: 0,
			rundownId,
		} as any)
		cache.Segments.insert({
			_id: protectString('segment1'),
			_rank: 1,
			rundownId,
		} as any)

		cache.Parts.insert({
			_id: protectString('part0'),
			_rank: 0,
			segmentId: protectString('segment0'),
		} as any)
		cache.Parts.insert({
			_id: protectString('part1'),
			_rank: 1,
			segmentId: protectString('segment0'),
		} as any)
		cache.Parts.insert({
			_id: protectString('part2'),
			_rank: 0,
			segmentId: protectString('segment1'),
		} as any)
		cache.Parts.insert({
			_id: protectString('part3'),
			_rank: 1,
			segmentId: protectString('segment1'),
		} as any)

		return cache
	}

	function createBasicPartMapFromCache(cache: CacheForIngest) {
		const beforePartMap = new Map<SegmentId, Array<BeforePartMapItem>>()

		for (const segment of cache.Segments.findAll(null)) {
			const parts = cache.Parts.findAll((p) => p.segmentId === segment._id, { sort: { _rank: 1 } })

			beforePartMap.set(
				segment._id,
				parts.map((part) => ({
					id: part._id,
					rank: part._rank,
				}))
			)
		}

		return beforePartMap
	}

	async function insertPartInstance(
		context: MockJobContext,
		rundownId: RundownId,
		segmentId: SegmentId,
		partId: string,
		rank: number,
		orphaned: DBPartInstance['orphaned']
	) {
		await context.mockCollections.PartInstances.insertOne({
			_id: protectString(`instance_${partId}`),
			rundownId,
			segmentId,
			orphaned,
			part: {
				_id: partId,
				_rank: rank,
			},
		} as any)
	}
	test('no changes', async () => {
		const context = setupDefaultJobEnvironment()
		const partInstancesCollection = context.mockCollections.PartInstances

		const cache = await createDefaultCache(context, 'rd0')
		const beforePartMap = createBasicPartMapFromCache(cache)

		// Setup the partInstances
		// await insertPartInstance(context, cache.RundownId, protectString('segment0'), 'part0', undefined)
		await insertPartInstance(context, cache.RundownId, protectString('segment0'), 'part0b', 0.5, 'adlib-part')
		partInstancesCollection.clearOpLog()

		await updateSegmentIdsForAdlibbedPartInstances(context, cache, beforePartMap)

		expect(partInstancesCollection.operations).toHaveLength(1)
		expect(partInstancesCollection.operations[0].type).toEqual('findFetch')
	})

	test('segment rename', async () => {
		const context = setupDefaultJobEnvironment()
		const partInstancesCollection = context.mockCollections.PartInstances

		const cache = await createDefaultCache(context, 'rd0')
		const beforePartMap = createBasicPartMapFromCache(cache)

		// Rename the segment
		const newSegmentId = protectString('new-id')
		const segmentToRename = cache.Segments.findOne(protectString('segment0')) as DBSegment
		expect(segmentToRename).toBeTruthy()
		cache.Segments.remove(segmentToRename._id)
		cache.Segments.insert({
			...segmentToRename,
			_id: newSegmentId,
		})
		cache.Parts.updateAll((p) => {
			if (p.segmentId === segmentToRename._id) {
				p.segmentId = newSegmentId
				return p
			} else {
				return false
			}
		})

		// Setup the partInstances
		await insertPartInstance(context, cache.RundownId, newSegmentId, 'part0', 0, undefined)
		await insertPartInstance(context, cache.RundownId, protectString('segment0'), 'part0b', 0.5, 'adlib-part')
		partInstancesCollection.clearOpLog()

		await updateSegmentIdsForAdlibbedPartInstances(context, cache, beforePartMap)

		expect(partInstancesCollection.operations).toHaveLength(2)
		expect(partInstancesCollection.operations[0].type).toEqual('findFetch')
		expect(partInstancesCollection.operations[1].type).toEqual('bulkWrite')
		// TODO - more specific checks
	})
})
