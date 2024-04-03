import { PartId, PartInstanceId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { groupByToMap, normalizeArrayToMap } from '@sofie-automation/corelib/dist/lib'
import { AnyBulkWriteOperation } from 'mongodb'
import { ReadonlyDeep } from 'type-fest'
import { CacheForIngest } from './ingest/cache'
import { BeforePartMap, BeforePartMapItem } from './ingest/commit'
import { JobContext } from './jobs'
import { logger } from './logging'
import { CacheForPlayout } from './playout/cache'
import _ = require('underscore')
import { ReadOnlyCache } from './cache/CacheBase'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DbCacheReadCollection } from './cache/CacheCollection'

type MinimalPartInstance = Pick<DBPartInstance, '_id' | 'segmentId' | 'orphaned'> & {
	part: Pick<DBPart, '_id' | '_rank'>
}

/**
 * Update the ranks of all PartInstances in the given segments.
 * Syncs the ranks from matching Parts to PartInstances.
 */

export function updatePartInstanceRanksAfterAdlib(
	cache: CacheForPlayout,
	_currentPartInstance: ReadonlyDeep<DBPartInstance>,
	partInstance: DBPartInstance
): void {
	const segmentId = partInstance.segmentId
	const orphanedPartInstances = cache.PartInstances.findAll(
		(p) => !p.reset && !!p.orphaned && p.segmentId === segmentId
	)

	const beforePartMap = new Map<SegmentId, BeforePartMapItem[]>()
	beforePartMap.set(
		segmentId,
		cache.Parts.findAll((p) => p.segmentId === segmentId).map((p) => ({ id: p._id, rank: p._rank }))
	)

	const newPartInstanceRanks = compileNewPartInstanceRanks(
		cache.Parts,
		[segmentId],
		beforePartMap,
		orphanedPartInstances
	)

	for (const [partInstanceId, rank] of newPartInstanceRanks.entries()) {
		cache.PartInstances.updateOne(
			partInstanceId,
			(partInstance) => {
				if (partInstance.part._rank !== rank) {
					partInstance.part._rank = rank
					return partInstance
				} else {
					return false
				}
			},
			true
		)
	}

	logger.debug(`updatePartRanks: ${newPartInstanceRanks.size} PartInstances updated`)
}

/**
 * Update the ranks of all PartInstances in the given segments.
 * Syncs the ranks from matching Parts to PartInstances.
 * Orphaned PartInstances get ranks interpolated based on what they were ranked between before the ingest update
 * Note: This can't use `CacheForPlayout` as not enough PartInstances will be loaded on it
 */

export async function updatePartInstanceRanksAndOrphanedState(
	context: JobContext,
	cache: ReadOnlyCache<CacheForIngest>,
	changedSegmentIds: ReadonlyDeep<SegmentId[]>,
	beforePartMap: BeforePartMap
): Promise<void> {
	const { writeOps, orphanedPartInstances } = await updateNormalPartInstanceRanksAndFindOrphans(
		context,
		cache,
		changedSegmentIds
	)

	const newPartInstanceRanks = compileNewPartInstanceRanks(
		cache.Parts,
		changedSegmentIds,
		beforePartMap,
		orphanedPartInstances
	)

	for (const [partInstanceId, rank] of newPartInstanceRanks.entries()) {
		writeOps.push({
			updateOne: {
				filter: { _id: partInstanceId },
				update: {
					$set: {
						'part._rank': rank,
					},
				},
			},
		})
	}

	if (writeOps.length > 0) {
		await context.directCollections.PartInstances.bulkWrite(writeOps)
	}
	logger.debug(`updatePartRanks: ${writeOps.length} updates to PartInstances`)
}

function compileNewPartInstanceRanks(
	partCache: DbCacheReadCollection<DBPart>,
	changedSegmentIds: ReadonlyDeep<SegmentId[]>,
	beforePartMap: BeforePartMap,
	orphanedPartInstances: MinimalPartInstance[]
) {
	const partInstancesMap = compileOriginalPartInstanceOrderMap(beforePartMap, orphanedPartInstances)

	const orphanedPartInstancesInUpdatedSegmentsMap = normalizeArrayToMap(orphanedPartInstances, '_id')

	const { targetPartInstancesParentMap, partInstancesAtStartOfSegment } = groupPartInstancesByThePartTheyFollow(
		partCache,
		changedSegmentIds,
		partInstancesMap
	)

	const newPartInstanceRanks = new Map<PartInstanceId, number>()

	// Ensure rank of orphaned PartInstances at the start of the segment is updated
	for (const [segmentId, partInstanceIds] of partInstancesAtStartOfSegment.entries()) {
		const validPartInstanceIds = partInstanceIds.filter(
			(id) => orphanedPartInstancesInUpdatedSegmentsMap.get(id)?.segmentId === segmentId
		)
		if (validPartInstanceIds.length === 0) continue

		// We are at the start of the segment, interpolate negative ranks, to avoid collisions and hard maths
		for (let i = 0; i < validPartInstanceIds.length; i++) {
			newPartInstanceRanks.set(validPartInstanceIds[i], i - validPartInstanceIds.length)
		}
	}

	// Ensure rank of orphaned PartInstances between parts is updated
	for (const partInstanceGroup of targetPartInstancesParentMap.values()) {
		const partInstanceIds = partInstanceGroup.partInstanceIds.filter(
			(id) => orphanedPartInstancesInUpdatedSegmentsMap.get(id)?.segmentId === partInstanceGroup.segmentId // TODO - if the SegmentId doesn't match, then what?
		)
		if (partInstanceIds.length === 0) continue

		// We are probably between two parts, so interpolate ranks
		const partRank = partInstanceGroup.partRank
		const increment = 1 / (partInstanceIds.length + 1)
		const partInstanceCount = partInstanceIds.length
		for (let i = 0; i < partInstanceCount; i++) {
			newPartInstanceRanks.set(partInstanceIds[i], partRank + increment * (i + 1))
		}
	}

	return newPartInstanceRanks
}

/**
 * Update the ranks of any non-orphaned PartInstances, and ensure that any orphaned PartInstances are supposed to be marked as such.
 * Returns an array of mongo writeOps which need to be written back to mongo, and an array of the PartInstances which are orphaned
 */
async function updateNormalPartInstanceRanksAndFindOrphans(
	context: JobContext,
	cache: ReadOnlyCache<CacheForIngest>,
	changedSegmentIds: ReadonlyDeep<SegmentId[]>
) {
	const orphanedPartInstances: MinimalPartInstance[] = []
	const writeOps: AnyBulkWriteOperation<DBPartInstance>[] = []

	const partInstancesInChangedSegments = (await context.directCollections.PartInstances.findFetch(
		{
			reset: { $ne: true },
			segmentId: { $in: changedSegmentIds as SegmentId[] },
		},
		{
			projection: {
				_id: 1,
				segmentId: 1,
				orphaned: 1,
				'part._id': 1,
				'part._rank': 1,
				part: 1, // nocommit - this is a workaround for the mock not supporting projection on nested fields
			},
			sort: {
				takeCount: 1,
			},
		}
	)) as Array<MinimalPartInstance>

	for (const partInstance of partInstancesInChangedSegments) {
		const part = cache.Parts.findOne(partInstance.part._id)
		if (!part) {
			if (!partInstance.orphaned) {
				writeOps.push({
					updateOne: {
						filter: { _id: partInstance._id },
						update: {
							$set: {
								orphaned: 'deleted',
								// Rank is filled in later on
							},
						},
					},
				})
			}

			orphanedPartInstances.push(partInstance)
		} else if (partInstance.orphaned === 'deleted') {
			writeOps.push({
				updateOne: {
					filter: { _id: partInstance._id },
					update: {
						$set: {
							'part._rank': part._rank,
						},
						$unset: {
							orphaned: 1,
						},
					},
				},
			})
		} else {
			writeOps.push({
				updateOne: {
					filter: { _id: partInstance._id },
					update: {
						$set: {
							'part._rank': part._rank,
						},
					},
				},
			})
		}
	}

	return {
		writeOps,
		orphanedPartInstances,
	}
}

interface OriginalPartInstanceOrderMapItem {
	afterPartId: PartId | null
	partInstanceIds: PartInstanceId[]
}
/**
 * Group the PartInstances by the Part they are supposed to be after, based on the description of Parts from before the ingest update
 */
function compileOriginalPartInstanceOrderMap(
	beforePartMap: BeforePartMap,
	adlibbedPartInstances: MinimalPartInstance[]
) {
	const beforePartInstanceMap = new Map<SegmentId, Array<OriginalPartInstanceOrderMapItem>>()

	const grouped = groupByToMap(adlibbedPartInstances, 'segmentId')

	for (const [segmentId, partInfos] of beforePartMap.entries()) {
		const newVals: OriginalPartInstanceOrderMapItem[] = []

		const adlibInstances = grouped.get(segmentId)
		if (adlibInstances && adlibInstances.length > 0) {
			const sortedInstances = _.sortBy(adlibInstances, (i) => i.part._rank)

			// Any before the first part
			if (partInfos.length === 0) {
				newVals.push({
					afterPartId: null,
					partInstanceIds: sortedInstances.map((i) => i._id),
				})
			} else {
				let previousPartInfo = partInfos[0]
				// Find any before the first part
				newVals.push({
					afterPartId: null,
					partInstanceIds: sortedInstances
						.filter((i) => i.part._rank < previousPartInfo.rank)
						.map((i) => i._id),
				})

				for (const partInfo of partInfos) {
					// Find any between the previous part and this part
					newVals.push({
						afterPartId: previousPartInfo.id,
						partInstanceIds: sortedInstances
							.filter((i) => i.part._rank >= previousPartInfo.rank && i.part._rank < partInfo.rank)
							.map((i) => i._id),
					})

					previousPartInfo = partInfo
				}

				// Find any after the last part
				newVals.push({
					afterPartId: previousPartInfo.id,
					partInstanceIds: sortedInstances
						.filter((i) => i.part._rank >= previousPartInfo.rank)
						.map((i) => i._id),
				})
			}
		}

		beforePartInstanceMap.set(segmentId, newVals)
	}

	return beforePartInstanceMap
}

interface PartInstancesAfterPartInfo {
	afterPartId: PartId | null
	partRank: number
	segmentId: SegmentId | null
	partInstanceIds: PartInstanceId[]
}
function groupPartInstancesByThePartTheyFollow(
	partCache: DbCacheReadCollection<DBPart>,
	changedSegmentIds: ReadonlyDeep<SegmentId[]>,
	partInstancesMap: ReadonlyMap<SegmentId, OriginalPartInstanceOrderMapItem[]>
) {
	const targetPartInstancesParentMap = new Map<PartId, PartInstancesAfterPartInfo>()
	const partInstancesAtStartOfSegment = new Map<SegmentId, PartInstanceId[]>()

	for (const segmentId of changedSegmentIds) {
		const partInstancesGroupsBefore = partInstancesMap.get(segmentId)
		if (!partInstancesGroupsBefore) continue

		// TODO - does this correctly handle when moving across segments?
		/**
		 * The aim here is to figure out what partinstances are after each PartId, so we can position them correctly
		 *
		 */
		let previousPartInstancesGroup: PartInstancesAfterPartInfo | undefined = undefined

		for (const partInstanceGroup of partInstancesGroupsBefore) {
			// The PartInstances were before the first Part. We can't handle them fully
			if (!partInstanceGroup.afterPartId) {
				// TODO - ensure no collision?
				partInstancesAtStartOfSegment.set(segmentId, partInstanceGroup.partInstanceIds)
				continue
			}

			// Find the new part, it could have moved or been removed
			const newPart = partCache.findOne(partInstanceGroup.afterPartId)
			if (!newPart) {
				// The Part was removed, so add them to the previous part
				if (previousPartInstancesGroup) {
					previousPartInstancesGroup.partInstanceIds.push(...partInstanceGroup.partInstanceIds)
				} else {
					// TODO - ensure no collision?
					const temp = partInstancesAtStartOfSegment.get(segmentId)
					if (temp) {
						temp.push(...partInstanceGroup.partInstanceIds)
					} else {
						partInstancesAtStartOfSegment.set(segmentId, partInstanceGroup.partInstanceIds)
					}
				}
				continue
			}

			// The Part still exists, so remember the instances
			previousPartInstancesGroup = {
				afterPartId: newPart._id,
				partRank: newPart._rank,
				segmentId: newPart.segmentId,
				partInstanceIds: partInstanceGroup.partInstanceIds,
			}
			targetPartInstancesParentMap.set(newPart._id, previousPartInstancesGroup)
		}
	}

	return {
		targetPartInstancesParentMap,
		partInstancesAtStartOfSegment,
	}
}
