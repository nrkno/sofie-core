import { SegmentId, PartId, RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { IngestModel, IngestModelReadonly } from './model/IngestModel'
import { BeforeIngestOperationPartMap, CommitIngestOperation } from './commit'
import { LocalIngestRundown, RundownIngestDataCache } from './ingestCache'
import { getRundownId } from './lib'
import { JobContext } from '../jobs'
import { IngestPropsBase } from '@sofie-automation/corelib/dist/worker/ingest'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { RundownLock } from '../jobs/lock'
import { UserError } from '@sofie-automation/corelib/dist/error'
import { loadIngestModelFromRundownExternalId } from './model/implementation/LoadIngestModel'
import { clone } from '@sofie-automation/corelib/dist/lib'

/**
 * The result of the initial stage of an Ingest operation
 * This gets provided to the Commit stage, and informs it what has changed
 */
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

	/** Set to true if the rundown should be removed or orphaned */
	removeRundown: boolean

	/** Whether to return an error if the rundown is unable to be removed */
	returnRemoveFailure?: boolean
}

export enum UpdateIngestRundownAction {
	DELETE = 'delete',
}

/**
 * Perform an ingest update operation on a rundown
 * This will automatically do some post-update data changes, to ensure the playout side (partinstances etc) is updated with the changes
 * @param context Context of the job being run
 * @param studioId Id of the studio the rundown belongs to
 * @param rundownExternalId ExternalId of the rundown to lock
 * @param updateCacheFcn Function to mutate the ingestData. Throw if the requested change is not valid. Return undefined to indicate the ingestData should be deleted
 * @param calcFcn Function to run to update the Rundown. Return the blob of data about the change to help the post-update perform its duties. Return null to indicate that nothing changed
 */
export async function runIngestJob(
	context: JobContext,
	data: IngestPropsBase,
	updateCacheFcn: (
		oldIngestRundown: LocalIngestRundown | undefined
	) => LocalIngestRundown | UpdateIngestRundownAction,
	calcFcn: (
		context: JobContext,
		ingestModel: IngestModel,
		newIngestRundown: LocalIngestRundown | undefined,
		oldIngestRundown: LocalIngestRundown | undefined
	) => Promise<CommitIngestData | null>
): Promise<void> {
	if (!data.rundownExternalId) {
		throw new Error(`Job is missing rundownExternalId`)
	}

	const rundownId = getRundownId(context.studioId, data.rundownExternalId)
	return runWithRundownLockInner(context, rundownId, async (rundownLock) => {
		const span = context.startSpan(`ingestLockFunction.${context.studioId}`)

		// Load the old ingest data
		const pIngestModel = loadIngestModelFromRundownExternalId(context, rundownLock, data.rundownExternalId)
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

		let resultingError: UserError | void | undefined

		try {
			const ingestModel = await pIngestModel

			// Load any 'before' data for the commit
			const beforeRundown = ingestModel.rundown
			const beforePartMap = generatePartMap(ingestModel)

			const span = context.startSpan('ingest.calcFcn')
			const commitData = await calcFcn(context, ingestModel, newIngestRundown, oldIngestRundown)
			span?.end()

			if (commitData) {
				const span = context.startSpan('ingest.commit')
				// The change is accepted. Perform some playout calculations and save it all
				resultingError = await CommitIngestOperation(
					context,
					ingestModel,
					beforeRundown,
					beforePartMap,
					commitData
				)
				span?.end()
			} else {
				// Should be no changes
				ingestModel.assertNoChanges()
			}
		} finally {
			// Ensure we save the ingest data
			await pSaveIngestChanges

			span?.end()
		}

		if (resultingError) throw resultingError
	})
}

/**
 * Run a minimal rundown job. This is an alternative to `runIngestJob`, for operations to operate on a Rundown without the full Ingest flow
 * This automatically aquires the RundownLock, loads the Rundown and does a basic access check
 * @param context Context of the job being run
 * @param rundownId Id of the rundown to run for
 * @param fcn Function to run inside the lock
 * @returns Result of the provided function
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

function generatePartMap(ingestModel: IngestModelReadonly): BeforeIngestOperationPartMap {
	const rundown = ingestModel.rundown
	if (!rundown) return new Map()

	const res = new Map<SegmentId, Array<{ id: PartId; rank: number }>>()
	for (const segment of ingestModel.getAllSegments()) {
		res.set(
			segment.segment._id,
			segment.parts.map((p) => ({ id: p.part._id, rank: p.part._rank }))
		)
	}
	return res
}
