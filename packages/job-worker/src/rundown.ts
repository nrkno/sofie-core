import { PartId, PartInstanceId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { normalizeArrayToMap, min, groupByToMap } from '@sofie-automation/corelib/dist/lib'
import { AnyBulkWriteOperation } from 'mongodb'
import { ReadonlyDeep } from 'type-fest'
import _ = require('underscore')
import { CacheForIngest } from './ingest/cache'
import { BeforePartMap } from './ingest/commit'
import { JobContext } from './jobs'
import { logger } from './logging'
import { CacheForPlayout } from './playout/cache'
import { IMongoTransaction } from './db'

/** Return true if the rundown is allowed to be moved out of that playlist */
export function allowedToMoveRundownOutOfPlaylist(
	playlist: ReadonlyDeep<DBRundownPlaylist>,
	rundown: ReadonlyDeep<Pick<DBRundown, '_id' | 'playlistId'>>
): boolean {
	if (rundown.playlistId !== playlist._id)
		throw new Error(
			`Wrong playlist "${playlist._id}" provided for rundown "${rundown._id}" ("${rundown.playlistId}")`
		)

	if (!playlist.activationId) return true

	return (
		!playlist.activationId ||
		(playlist.currentPartInfo?.rundownId !== rundown._id && playlist.nextPartInfo?.rundownId !== rundown._id)
	)
}

/**
 * Update the ranks of all PartInstances in the given segments.
 * Syncs the ranks from matching Parts to PartInstances.
 * Orphaned PartInstances get ranks interpolated based on what they were ranked between before the ingest update
 */
export async function updatePartInstanceRanks(
	context: JobContext,
	cache: CacheForIngest,
	transaction: IMongoTransaction | null,
	changedSegmentIds: ReadonlyDeep<SegmentId[]>,
	beforePartMap: BeforePartMap
): Promise<void> {
	const groupedPartInstances = groupByToMap(
		await context.directCollections.PartInstances.findFetch(
			{
				reset: { $ne: true },
				segmentId: { $in: changedSegmentIds as SegmentId[] },
			},
			undefined,
			transaction
		),
		'segmentId'
	)
	const groupedNewParts = groupByToMap(
		cache.Parts.findAll((p) => changedSegmentIds.includes(p.segmentId)),
		'segmentId'
	)

	const writeOps: AnyBulkWriteOperation<DBPartInstance>[] = []

	for (const segmentId of changedSegmentIds) {
		const oldPartIdsAndRanks = beforePartMap.get(segmentId) ?? []

		const newParts = groupedNewParts.get(segmentId) ?? []
		const segmentPartInstances = _.sortBy(groupedPartInstances.get(segmentId) ?? [], (p) => p.part._rank)

		const newRanks = calculateNewRanksForParts(segmentId, oldPartIdsAndRanks, newParts, segmentPartInstances)
		for (const [instanceId, info] of newRanks.entries()) {
			if (info.deleted) {
				writeOps.push({
					updateOne: {
						filter: { _id: instanceId },
						update: {
							$set: {
								orphaned: 'deleted',
								'part._rank': info.rank,
							},
						},
					},
				})
			} else if (info.deleted === undefined) {
				writeOps.push({
					updateOne: {
						filter: { _id: instanceId },
						update: {
							$set: {
								'part._rank': info.rank,
							},
						},
					},
				})
			} else {
				writeOps.push({
					updateOne: {
						filter: { _id: instanceId },
						update: {
							$set: {
								'part._rank': info.rank,
							},
							$unset: {
								orphaned: 1,
							},
						},
					},
				})
			}
		}
	}

	if (writeOps.length > 0) {
		await context.directCollections.PartInstances.bulkWrite(writeOps, transaction)
	}
	logger.debug(`updatePartRanks: ${writeOps.length} PartInstances updated`)
}

/**
 * Update the ranks of all PartInstances in the given segments.
 * Syncs the ranks from matching Parts to PartInstances.
 */
export function updatePartInstanceRanksAfterAdlib(cache: CacheForPlayout, segmentId: SegmentId): void {
	const newParts = cache.Parts.findAll((p) => p.segmentId === segmentId)
	const segmentPartInstances = _.sortBy(
		cache.PartInstances.findAll((p) => p.segmentId === segmentId),
		(p) => p.part._rank
	)

	const newRanks = calculateNewRanksForParts(segmentId, null, newParts, segmentPartInstances)
	for (const [instanceId, info] of newRanks.entries()) {
		if (info.deleted) {
			cache.PartInstances.updateOne(instanceId, (p) => {
				p.part._rank = info.rank
				p.orphaned = 'deleted'
				return p
			})
		} else if (info.deleted === undefined) {
			cache.PartInstances.updateOne(instanceId, (p) => {
				p.part._rank = info.rank
				return p
			})
		} else {
			cache.PartInstances.updateOne(instanceId, (p) => {
				p.part._rank = info.rank
				delete p.orphaned
				return p
			})
		}
	}

	logger.debug(`updatePartRanks: ${newRanks.size} PartInstances updated`)
}

function calculateNewRanksForParts(
	segmentId: SegmentId,
	oldPartIdsAndRanks0: Array<{ id: PartId; rank: number }> | null, // Null if the Parts havent changed, and so can be loaded locally
	newParts: DBPart[],
	segmentPartInstances: DBPartInstance[]
): Map<PartInstanceId, { deleted: boolean | undefined; rank: number }> {
	const changedRanks = new Map<PartInstanceId, { deleted: boolean | undefined; rank: number }>()

	// Ensure the PartInstance ranks are synced with their Parts
	const newPartsMap = normalizeArrayToMap(newParts, '_id')
	for (const partInstance of segmentPartInstances) {
		const part = newPartsMap.get(partInstance.part._id)
		if (part) {
			// We have a part and instance, so make sure the part isn't orphaned and sync the rank
			changedRanks.set(partInstance._id, {
				rank: part._rank,
				deleted: false,
			})

			// Update local copy
			delete partInstance.orphaned
			partInstance.part._rank = part._rank
		} else if (!partInstance.orphaned) {
			partInstance.orphaned = 'deleted'
			changedRanks.set(partInstance._id, {
				rank: partInstance.part._rank,
				deleted: true,
			})
		}
	}

	const orphanedPartInstances = segmentPartInstances
		.map((p) => ({ rank: p.part._rank, orphaned: p.orphaned, instanceId: p._id, id: p.part._id }))
		.filter((p) => p.orphaned)

	if (orphanedPartInstances.length === 0) {
		// No orphans to position
		return changedRanks
	}

	logger.debug(
		`updatePartInstanceRanks: ${segmentPartInstances.length} partInstances with ${orphanedPartInstances.length} orphans in segment "${segmentId}"`
	)

	// If we have no instances, or no parts to base it on, then we can't do anything
	if (newParts.length === 0) {
		// position them all 0..n
		let i = 0
		for (const partInfo of orphanedPartInstances) {
			changedRanks.set(partInfo.instanceId, { rank: i++, deleted: true })
		}

		return changedRanks
	}

	const oldPartIdsAndRanks = oldPartIdsAndRanks0 ?? newParts.map((p) => ({ id: p._id, rank: p._rank }))

	const preservedPreviousParts = oldPartIdsAndRanks.filter((p) => newPartsMap.has(p.id))

	if (preservedPreviousParts.length === 0) {
		// position them all before the first

		const firstPartRank = min(newParts, (p) => p._rank)?._rank ?? 0
		let i = firstPartRank - orphanedPartInstances.length
		for (const partInfo of orphanedPartInstances) {
			changedRanks.set(partInfo.instanceId, {
				rank: i++,
				deleted: changedRanks.get(partInfo.instanceId)?.deleted,
			})
		}
	} else {
		// they need interleaving

		// compile the old order, and get a list of the ones that still remain in the new state
		const allParts = new Map<PartId, { rank: number; id: PartId; instanceId?: PartInstanceId }>()
		for (const oldPart of oldPartIdsAndRanks) allParts.set(oldPart.id, oldPart)
		for (const orphanedPart of orphanedPartInstances) allParts.set(orphanedPart.id, orphanedPart)

		// Now go through and update their ranks
		const remainingPreviousParts = _.sortBy(Array.from(allParts.values()), (p) => p.rank).filter(
			(p) => p.instanceId || newPartsMap.has(p.id)
		)

		for (let i = -1; i < remainingPreviousParts.length - 1; ) {
			// Find the range to process this iteration
			const beforePartIndex = i
			const afterPartIndex = remainingPreviousParts.findIndex((p, o) => o > i && !p.instanceId)

			if (afterPartIndex === beforePartIndex + 1) {
				// no dynamic parts in between
				i++
				continue
			} else if (afterPartIndex === -1) {
				// We will reach the end, so make sure we stop
				i = remainingPreviousParts.length
			} else {
				// next iteration should look from the next fixed point
				i = afterPartIndex
			}

			const firstDynamicIndex = beforePartIndex + 1
			const lastDynamicIndex = afterPartIndex === -1 ? remainingPreviousParts.length - 1 : afterPartIndex - 1

			// Calculate the rank change per part
			const dynamicPartCount = lastDynamicIndex - firstDynamicIndex + 1
			const basePartRank =
				beforePartIndex === -1 ? -1 : newPartsMap.get(remainingPreviousParts[beforePartIndex].id)!._rank // eslint-disable-line @typescript-eslint/no-non-null-assertion
			const afterPartRank =
				afterPartIndex === -1
					? basePartRank + 1
					: newPartsMap.get(remainingPreviousParts[afterPartIndex].id)!._rank // eslint-disable-line @typescript-eslint/no-non-null-assertion
			const delta = (afterPartRank - basePartRank) / (dynamicPartCount + 1)

			let prevRank = basePartRank
			for (let o = firstDynamicIndex; o <= lastDynamicIndex; o++) {
				const newRank = (prevRank = prevRank + delta)

				const orphanedPart = remainingPreviousParts[o]
				if (orphanedPart.instanceId && orphanedPart.rank !== newRank) {
					changedRanks.set(orphanedPart.instanceId, {
						rank: newRank,
						deleted: changedRanks.get(orphanedPart.instanceId)?.deleted,
					})
				}
			}
		}
	}

	return changedRanks
}
