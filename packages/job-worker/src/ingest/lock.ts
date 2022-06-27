import { SegmentId, PartId, RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ShowStyleCompound } from '@sofie-automation/corelib/dist/dataModel/ShowStyleCompound'
import { protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { WrappedShowStyleBlueprint } from '../blueprints/cache'
import { ReadOnlyCache } from '../cache/CacheBase'
import { getRundownsSegmentsAndPartsFromCache } from '../playout/lib'
import { clone } from 'underscore'
import _ = require('underscore')
import { CacheForIngest } from './cache'
import { BeforePartMap, CommitIngestOperation } from './commit'
import { LocalIngestRundown, RundownIngestDataCache } from './ingestCache'
import { getRundownId } from './lib'
import { JobContext } from '../jobs'
import { IngestPropsBase } from '@sofie-automation/corelib/dist/worker/ingest'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { ReadonlyDeep } from 'type-fest'
import { RundownLock } from '../jobs/lock'

export interface CommitIngestData {
	/** Segment Ids which had any changes */
	changedSegmentIds: SegmentId[]
	/** Segments to be removed or orphaned */
	removedSegmentIds: SegmentId[]
	/**
	 * Segments that had their ids changed. This helps then be orphaned in the correct place
	 * eg, whole segment is renamed and middle part deleted
	 * Note: Only supported for MOS, not 'normal' ingest operations
	 */
	renamedSegments: Map<SegmentId, SegmentId>

	/** Whether the rundown should be removed or orphaned */
	removeRundown: boolean

	/** ShowStyle, if loaded to reuse */
	showStyle: ReadonlyDeep<ShowStyleCompound> | undefined
	/** Blueprint, if loaded to reuse */
	blueprint: ReadonlyDeep<WrappedShowStyleBlueprint> | undefined
}

export enum UpdateIngestRundownAction {
	DELETE = 'delete',
}

/**
 * Perform an ingest update operation on a rundown
 * This will automatically do some post-update data changes, to ensure the playout side (partinstances etc) is updated with the changes
 * @param context Contextual information for the call to this function. to aid debugging
 * @param studioId Id of the studio the rundown belongs to
 * @param rundownExternalId ExternalId of the rundown to lock
 * @param updateCacheFcn Function to mutate the ingestData. Throw if the requested change is not valid. Return undefined to indicate the ingestData should be deleted
 * @param calcFcn Function to run to update the Rundown. Return the blob of data about the change to help the post-update perform its duties. Return null to indicate that nothing changed
 */
// runPlayoutOperationWithCacheFromStudioOperation
export async function runIngestJob(
	context: JobContext,
	data: IngestPropsBase,
	updateCacheFcn: (
		oldIngestRundown: LocalIngestRundown | undefined
	) => LocalIngestRundown | UpdateIngestRundownAction,
	calcFcn: (
		context: JobContext,
		cache: CacheForIngest,
		newIngestRundown: LocalIngestRundown | undefined,
		oldIngestRundown: LocalIngestRundown | undefined
	) => Promise<CommitIngestData | null>
): Promise<void> {
	if (!data.rundownExternalId) {
		throw new Error(`Job is missing rundownExternalId`)
	}

	const rundownId = getRundownId(context.studioId, data.rundownExternalId)
	return runWithRundownLockInner(context, rundownId, async (rundownLock) => {
		const span = context.startSpan(`ingestLockFunction.${context}`)

		// Load the old ingest data
		const pIngestCache = CacheForIngest.create(context, rundownLock, data.rundownExternalId)
		const ingestObjCache = await RundownIngestDataCache.create(context, rundownId)

		// Recalculate the ingest data
		const oldIngestRundown = ingestObjCache.fetchRundown()
		const updatedIngestRundown = updateCacheFcn(clone(oldIngestRundown))
		let newIngestRundown: LocalIngestRundown | undefined
		switch (updatedIngestRundown) {
			// case UpdateIngestRundownAction.REJECT:
			// 	// Reject change
			// 	return
			case UpdateIngestRundownAction.DELETE:
				ingestObjCache.delete()
				newIngestRundown = undefined
				break
			default:
				ingestObjCache.update(updatedIngestRundown)
				newIngestRundown = updatedIngestRundown
				break
		}
		// Start saving the ingest data
		const pSaveIngestChanges = ingestObjCache.saveToDatabase()

		try {
			const ingestCache = await pIngestCache

			// Load any 'before' data for the commit
			const beforeRundown = ingestCache.Rundown.doc
			const beforePartMap = generatePartMap(ingestCache)

			const span = context.startSpan('ingest.calcFcn')
			const commitData = await calcFcn(context, ingestCache, newIngestRundown, oldIngestRundown)
			span?.end()

			if (commitData) {
				const span = context.startSpan('ingest.commit')
				// The change is accepted. Perform some playout calculations and save it all
				await CommitIngestOperation(context, ingestCache, beforeRundown, beforePartMap, commitData)
				span?.end()
			} else {
				// Should be no changes
				ingestCache.assertNoChanges()
			}
		} finally {
			// Ensure we save the ingest data
			await pSaveIngestChanges

			span?.end()
		}
	})
}

/**
 * Run a minimal rundown job
 * This avoids loading the cache
 */
export async function runWithRundownLock<TRes>(
	context: JobContext,
	rundownId: RundownId,
	fcn: (rundown: DBRundown | undefined, lock: RundownLock) => Promise<TRes>
): Promise<TRes> {
	if (!rundownId) {
		throw new Error(`Job is missing rundownId`)
	}

	return runWithRundownLockInner(context, rundownId, async (lock) => {
		const rundown = await context.directCollections.Rundowns.findOne(rundownId)
		if (rundown && rundown.studioId !== context.studioId) {
			throw new Error(`Job rundown "${rundownId}" not found or for another studio`)
		}

		return fcn(rundown, lock)
	})
}

/**
 * Lock the rundown for a quick task without the cache
 */
async function runWithRundownLockInner<TRes>(
	context: JobContext,
	rundownId: RundownId,
	fcn: (lock: RundownLock) => Promise<TRes>
): Promise<TRes> {
	const rundownLock = await context.lockRundown(rundownId)
	try {
		const res = await fcn(rundownLock)
		// Explicitly await fcn, before releasing the lock
		return res
	} finally {
		await rundownLock.release()
	}
}

function generatePartMap(cache: ReadOnlyCache<CacheForIngest>): BeforePartMap {
	const rundown = cache.Rundown.doc
	if (!rundown) return new Map()

	const segmentsAndParts = getRundownsSegmentsAndPartsFromCache(cache.Parts, cache.Segments, {
		// Feed fake data because we only care about the single rundown
		rundownIdsInOrder: [cache.RundownId],
	})
	const existingRundownParts = _.groupBy(segmentsAndParts.parts, (part) => unprotectString(part.segmentId))

	const res = new Map<SegmentId, Array<{ id: PartId; rank: number }>>()
	for (const [segmentId, parts] of Object.entries(existingRundownParts)) {
		res.set(
			protectString(segmentId),
			parts.map((p) => ({ id: p._id, rank: p._rank }))
		)
	}
	return res
}
