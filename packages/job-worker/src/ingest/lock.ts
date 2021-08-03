import { SegmentId, PartId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ShowStyleCompound } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
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
	showStyle: ShowStyleCompound | undefined
	/** Blueprint, if loaded to reuse */
	blueprint: WrappedShowStyleBlueprint | undefined
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
export async function runAsIngestJob(
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

	return runInRundownLock(context, data.rundownExternalId, async () => {
		const span = context.startSpan(`ingestLockFunction.${context}`)

		// Load the old ingest data
		const rundownId = getRundownId(context.studioId, data.rundownExternalId)
		const pIngestCache = CacheForIngest.create(context, data.rundownExternalId)
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

			const commitData = await calcFcn(context, ingestCache, newIngestRundown, oldIngestRundown)
			if (commitData) {
				// The change is accepted. Perform some playout calculations and save it all
				await CommitIngestOperation(context, ingestCache, beforeRundown, beforePartMap, commitData)
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

// /**
//  * Perform an operation on a rundown that has no effect on playout
//  * Warning: this will not attempt to update playout or perform the usual ingest post-changes. Be very careful what is changed as it could cause weird behaviour
//  * @param context Contextual information for the call to this function. to aid debugging
//  * @param studioId Id of the studio the rundown belongs to
//  * @param rundownExternalId ExternalId of the rundown to lock
//  * @param fcn Function to run while holding the lock
//  * @param playlistLock If the playlist lock is already held, supply it here to avoid trying to reaquire the lock
//  */
// export async function runIngestOperationFromRundown(
// 	context: string,
// 	refRundown: DBRundown,
// 	fcn: (ingestCache: CacheForIngest) => Promise<void>
// ): Promise<void> {
// 	const refRundownId = refRundown._id
// 	const studioId = refRundown.studioId
// 	const rundownExternalId = refRundown.externalId

// 	const targetRundownId = getRundownId(studioId, rundownExternalId)
// 	if (targetRundownId !== refRundownId) {
// 		throw new Meteor.Error(
// 			500,
// 			`Rundown id cannot run ingest operations, as it's _id "${refRundownId}" does not match the expected "${targetRundownId}". Perhaps it was restored from a snapshot?`
// 		)
// 	}

// 	return ingestLockFunctionInner(context, rundownExternalId, async () => {
// 		const ingestCache = await CacheForIngest.create(studioId, rundownExternalId)
// 		const beforeRundown = getRundown(ingestCache)

// 		// Do the function
// 		await fcn(ingestCache)

// 		// Check the change isn't making a mess
// 		const afterRundown = getRundown(ingestCache)
// 		if (beforeRundown.playlistId !== afterRundown.playlistId)
// 			throw new Meteor.Error(
// 				500,
// 				`RundownPlaylist id for Rundown "${ingestCache.RundownId}" cannot be changed during a ingestRundownOnlyLockFunction`
// 			)

// 		await runPlayoutOperationWithLock(
// 			null,
// 			context,
// 			beforeRundown.playlistId,
// 			PlayoutLockFunctionPriority.MISC,
// 			async () => {
// 				// This needs to be inside the playout lock to ensure that a take doesnt happen mid update
// 				await ingestCache.saveAllToDatabase()
// 			}
// 		)
// 	})
// }

/**
 * Lock the rundown for a quick task without the cache
 */
export async function runInRundownLock(
	_context: JobContext,
	_rundownExternalId: string,
	fcn: () => Promise<void>
): Promise<void> {
	// TODO - lock Rundown?
	return fcn()
}

function generatePartMap(cache: ReadOnlyCache<CacheForIngest>): BeforePartMap {
	const rundown = cache.Rundown.doc
	if (!rundown) return new Map()

	const segmentsAndParts = getRundownsSegmentsAndPartsFromCache(cache.Parts, cache.Segments, [rundown])
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
