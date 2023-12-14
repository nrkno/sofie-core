import { SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { getCurrentTime } from '../lib'
import { JobContext } from '../jobs'
import { logger } from '../logging'
import { regenerateSegmentsFromIngestData, updateSegmentFromIngestData } from './generationSegment'
import { makeNewIngestSegment } from './ingestCache'
import { canSegmentBeUpdated, getSegmentId } from './lib'
import { CommitIngestData, runIngestJob, UpdateIngestRundownAction } from './lock'
import { SegmentOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { literal } from '@sofie-automation/corelib/dist/lib'
import {
	IngestRegenerateSegmentProps,
	IngestRemoveSegmentProps,
	IngestUpdateSegmentProps,
	IngestUpdateSegmentRanksProps,
	RemoveOrphanedSegmentsProps,
} from '@sofie-automation/corelib/dist/worker/ingest'

/**
 * Regnerate a Segment from the cached IngestSegment
 */
export async function handleRegenerateSegment(context: JobContext, data: IngestRegenerateSegmentProps): Promise<void> {
	return runIngestJob(
		context,
		data,
		(ingestRundown) => {
			if (ingestRundown) {
				// Ensure the target segment exists in the cache
				const ingestSegment = ingestRundown.segments.find((s) => s.externalId === data.segmentExternalId)
				if (!ingestSegment) {
					throw new Error(
						`Rundown "${data.rundownExternalId}" does not have a Segment "${data.segmentExternalId}" to update`
					)
				}

				// We modify in-place
				return ingestRundown
			} else {
				throw new Error(`Rundown "${data.rundownExternalId}" not found`)
			}
		},
		async (context, ingestModel, ingestRundown) => {
			const ingestSegment = ingestRundown?.segments?.find((s) => s.externalId === data.segmentExternalId)
			if (!ingestSegment) throw new Error(`IngestSegment "${data.segmentExternalId}" is missing!`)
			return updateSegmentFromIngestData(context, ingestModel, ingestSegment, false)
		}
	)
}

/**
 * Attempt to remove a segment, or orphan it
 */
export async function handleRemovedSegment(context: JobContext, data: IngestRemoveSegmentProps): Promise<void> {
	return runIngestJob(
		context,
		data,
		(ingestRundown) => {
			if (ingestRundown) {
				const oldSegmentsLength = ingestRundown.segments.length
				ingestRundown.segments = ingestRundown.segments.filter((s) => s.externalId !== data.segmentExternalId)
				ingestRundown.modified = getCurrentTime()

				if (ingestRundown.segments.length === oldSegmentsLength) {
					throw new Error(
						`Rundown "${data.rundownExternalId}" does not have a Segment "${data.segmentExternalId}" to remove`
					)
				}

				// We modify in-place
				return ingestRundown
			} else {
				throw new Error(`Rundown "${data.rundownExternalId}" not found`)
			}
		},
		async (_context, ingestModel) => {
			const rundown = ingestModel.getRundown()
			const segmentId = getSegmentId(rundown._id, data.segmentExternalId)
			const segment = ingestModel.getSegment(segmentId)

			if (!canSegmentBeUpdated(rundown, segment, false)) {
				// segment has already been deleted
				return null
			} else {
				return literal<CommitIngestData>({
					changedSegmentIds: [],
					removedSegmentIds: [segmentId],
					renamedSegments: new Map(),

					removeRundown: false,
				})
			}
		}
	)
}

/**
 * Insert or update a segment from a new IngestSegment
 */
export async function handleUpdatedSegment(context: JobContext, data: IngestUpdateSegmentProps): Promise<void> {
	const segmentExternalId = data.ingestSegment.externalId
	return runIngestJob(
		context,
		data,
		(ingestRundown) => {
			if (ingestRundown) {
				ingestRundown.segments = ingestRundown.segments.filter((s) => s.externalId !== segmentExternalId)
				ingestRundown.segments.push(makeNewIngestSegment(data.ingestSegment))
				ingestRundown.modified = getCurrentTime()

				// We modify in-place
				return ingestRundown
			} else {
				throw new Error(`Rundown "${data.rundownExternalId}" not found`)
			}
		},
		async (context, ingestModel, ingestRundown) => {
			const ingestSegment = ingestRundown?.segments?.find((s) => s.externalId === segmentExternalId)
			if (!ingestSegment) throw new Error(`IngestSegment "${segmentExternalId}" is missing!`)
			return updateSegmentFromIngestData(context, ingestModel, ingestSegment, data.isCreateAction)
		}
	)
}

/**
 * Update the ranks of the Segments in a Rundown
 */
export async function handleUpdatedSegmentRanks(
	context: JobContext,
	data: IngestUpdateSegmentRanksProps
): Promise<void> {
	return runIngestJob(
		context,
		data,
		(ingestRundown) => {
			if (ingestRundown) {
				// Update ranks on ingest data
				for (const segment of ingestRundown.segments) {
					segment.rank = data.newRanks[segment.externalId] ?? segment.rank
				}
				// We modify in-place
				return ingestRundown
			} else {
				throw new Error(`Rundown "${data.rundownExternalId}" not found`)
			}
		},
		async (_context, ingestModel) => {
			const changedSegmentIds: SegmentId[] = []
			for (const [externalId, rank] of Object.entries<number>(data.newRanks)) {
				const segment = ingestModel.getSegmentByExternalId(externalId)
				if (segment) {
					const changed = segment.setRank(rank)

					if (!changed) {
						logger.warn(`Failed to update rank of segment "${externalId}" (${data.rundownExternalId})`)
					} else {
						changedSegmentIds.push(segment?.segment._id)
					}
				}
			}

			return literal<CommitIngestData>({
				changedSegmentIds,
				removedSegmentIds: [],
				renamedSegments: new Map(),
				removeRundown: false,
			})
		}
	)
}

/**
 * Check for and remove any orphaned segments if their contents are no longer on air
 */
export async function handleRemoveOrphanedSegemnts(
	context: JobContext,
	data: RemoveOrphanedSegmentsProps
): Promise<void> {
	return runIngestJob(
		context,
		data,
		(ingestRundown) => ingestRundown ?? UpdateIngestRundownAction.DELETE,
		async (_context, ingestModel, ingestRundown) => {
			if (!ingestRundown) throw new Error(`handleRemoveOrphanedSegemnts lost the IngestRundown...`)

			// Find the segments that are still orphaned (in case they have resynced before this executes)
			// We flag them for deletion again, and they will either be kept if they are somehow playing, or purged if they are not
			const stillOrphanedSegments = ingestModel.getOrderedSegments().filter((s) => !!s.segment.orphaned)

			// Note: scratchpad segments are ignored here, as they will never be in the ingestModel

			const stillHiddenSegments = stillOrphanedSegments.filter(
				(s) =>
					s.segment.orphaned === SegmentOrphanedReason.HIDDEN &&
					data.orphanedHiddenSegmentIds.includes(s.segment._id)
			)

			const stillDeletedSegmentIds = stillOrphanedSegments
				.filter(
					(s) =>
						s.segment.orphaned === SegmentOrphanedReason.DELETED &&
						data.orphanedDeletedSegmentIds.includes(s.segment._id)
				)
				.map((s) => s.segment._id)

			const hiddenSegmentIds = ingestModel
				.getOrderedSegments()
				.filter((s) => !!stillHiddenSegments.find((a) => a.segment._id === s.segment._id))
				.map((s) => s.segment._id)

			const { result } = await regenerateSegmentsFromIngestData(
				context,
				ingestModel,
				ingestRundown,
				hiddenSegmentIds
			)

			const changedHiddenSegments = result?.changedSegmentIds ?? []

			// Make sure any orphaned hidden segments arent marked as hidden
			for (const segment of stillHiddenSegments) {
				if (!changedHiddenSegments.includes(segment.segment._id)) {
					if (segment.segment.isHidden && segment.segment.orphaned === SegmentOrphanedReason.HIDDEN) {
						segment.setOrphaned(undefined)
						changedHiddenSegments.push(segment.segment._id)
					}
				}
			}

			if (changedHiddenSegments.length === 0 && stillDeletedSegmentIds.length === 0) {
				// Nothing could have changed, so take a shortcut and skip any saving
				return null
			}

			return literal<CommitIngestData>({
				changedSegmentIds: changedHiddenSegments,
				removedSegmentIds: stillDeletedSegmentIds,
				renamedSegments: new Map(),
				removeRundown: false,
			})
		}
	)
}
