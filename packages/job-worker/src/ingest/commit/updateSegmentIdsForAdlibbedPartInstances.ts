import { SegmentId, PartInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { JobContext } from '../../jobs'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { BeforePartMap } from '../commit'
import { CacheForIngest } from '../cache'

type MinimalPartInstance = Pick<DBPartInstance, '_id' | 'segmentId' | 'orphaned'> & {
	part: Pick<DBPart, '_id' | '_rank'>
}

/**
 * Ensure any adlibbed PartInstances are moved across segments when the Part before them is moved.
 * If there is no Part before them, they get left alone, even if this means they get stranded.
 * @param context
 * @param cache Cache for the ingest operation
 * @param beforePartMap Map of Parts and Segments before the ingest operation was run
 */
export async function updateSegmentIdsForAdlibbedPartInstances(
	context: JobContext,
	cache: CacheForIngest,
	beforePartMap: BeforePartMap
): Promise<void> {
	const adlibbedPartInstances = (await context.directCollections.PartInstances.findFetch(
		{
			rundownId: cache.RundownId,
			orphaned: 'adlib-part',
			reset: { $ne: true },
		},
		{
			projection: {
				_id: 1,
				segmentId: 1,
				orphaned: 1,
				'part._id': 1,
				'part._rank': 1,
				// part: 1, // nocommit - this is a workaround for the mock not supporting projection on nested fields
			},
			sort: {
				takeCount: 1,
			},
		}
	)) as Array<MinimalPartInstance>

	console.log('try for', adlibbedPartInstances, beforePartMap)

	const segmentIdChanges = await findChangesToSegmentIds(cache, beforePartMap, adlibbedPartInstances)

	// Perform a mongo update to modify the PartInstances
	await writeChangesToMongo(context, segmentIdChanges)
}

async function findChangesToSegmentIds(
	cache: CacheForIngest,
	beforePartMap: BeforePartMap,
	adlibbedPartInstances: Array<MinimalPartInstance>
) {
	const renameRules = new Map<PartInstanceId, SegmentId>()

	for (const partInstance of adlibbedPartInstances) {
		const segmentItems = beforePartMap.get(partInstance.segmentId)
		if (!segmentItems) continue

		// Find the part before the adlibbed part
		const partsBefore = segmentItems
			.filter((item) => item.rank < partInstance.part._rank)
			.sort((a, b) => b.rank - a.rank)

		console.log('check', partInstance._id, partsBefore)

		for (const partEntry of partsBefore) {
			// Check if the Part still exists
			const part = cache.Parts.findOne(partEntry.id)
			if (part) {
				// Check if the part segmentId should be changed
				if (part.segmentId !== partInstance.segmentId) {
					renameRules.set(partInstance._id, part.segmentId)
				}

				break
			}
		}
	}

	return renameRules
}

async function writeChangesToMongo(context: JobContext, renameRules: Map<PartInstanceId, SegmentId>) {
	if (renameRules.size > 0) {
		await context.directCollections.PartInstances.bulkWrite(
			Array.from(renameRules.entries()).map(([partInstanceId, segmentId]) => ({
				updateOne: {
					filter: {
						_id: partInstanceId,
					},
					update: {
						$set: {
							segmentId: segmentId,
							'part.segmentId': segmentId,
						},
					},
				},
			}))
		)
	}
}
