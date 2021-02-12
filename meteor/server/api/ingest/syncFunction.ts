import { Meteor } from 'meteor/meteor'
import _ from 'underscore'
import { IngestDataCache, IngestDataCacheObj } from '../../../lib/collections/IngestDataCache'
import { PartId } from '../../../lib/collections/Parts'
import { SegmentId } from '../../../lib/collections/Segments'
import { ShowStyleCompound } from '../../../lib/collections/ShowStyleVariants'
import { StudioId } from '../../../lib/collections/Studios'
import { waitForPromise, clone, protectString } from '../../../lib/lib'
import { DbCacheWriteCollection } from '../../cache/CacheCollection'
import { ReadOnlyCache } from '../../cache/CacheBase'
import { syncFunction } from '../../codeControl'
import { WrappedShowStyleBlueprint } from '../blueprints/cache'
import { getRundownsSegmentsAndPartsFromCache } from '../playout/lib'
import { PlaylistLock, playoutNoCacheLockFunction } from '../playout/syncFunction'
import { profiler } from '../profiler'
import { CacheForIngest } from './cache'
import { BeforePartMap, CommitIngestOperation } from './commit'
import { LocalIngestRundown } from './ingestCache'
import { loadCachedRundownData, saveRundownCache } from './ingestCache2'
import { getRundown, getRundownId } from './lib'
import { RundownSyncFunctionPriority } from './rundownInput'

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

/**
 * Perform an ingest update operation on a rundown
 * This will automatically do some post-update data changes, to ensure the playout side (partinstances etc) is updated with the changes
 * @param context Contextual information for the call to this function. to aid debugging
 * @param studioId Id of the studio the rundown belongs to
 * @param rundownExternalId ExternalId of the rundown to lock
 * @param updateCacheFcn Function to mutate the ingestData. Return null to indicate no change was made. Return undefined to indicate the ingestData should be deleted
 * @param calcFcn Function to run to update the Rundown. Return the blob of data about the change to help the post-update perform its duties. Return null to indicate that nothing changed
 * @param playlistLock If the playlist lock is already held, supply it here to avoid trying to reaquire the lock
 */
export function ingestLockFunction(
	context: string,
	studioId: StudioId,
	rundownExternalId: string,
	updateCacheFcn: (oldIngestRundown: LocalIngestRundown | undefined) => LocalIngestRundown | null | undefined,
	calcFcn: (
		cache: CacheForIngest,
		newIngestRundown: LocalIngestRundown | undefined,
		oldIngestRundown: LocalIngestRundown | undefined
	) => Promise<CommitIngestData | null>,
	playlistLock?: PlaylistLock
): void {
	return ingestLockFunctionInner(context, rundownExternalId, async () => {
		const span = profiler.startSpan(`ingestLockFunction.${context}`)

		if (playlistLock && playlistLock._studioId !== studioId)
			throw new Meteor.Error(
				500,
				`ingestLockFunction called for Studio "${studioId}", with playlist lock from "${playlistLock._studioId}"`
			)

		// Load the old ingest data
		const rundownId = getRundownId(studioId, rundownExternalId)
		const ingestObjCache = new DbCacheWriteCollection<IngestDataCacheObj, IngestDataCacheObj>(IngestDataCache)
		const pIngestCache = CacheForIngest.create(studioId, rundownExternalId)
		await ingestObjCache.prepareInit({ rundownId }, true)

		// Recalculate the ingest data
		const oldIngestRundown = await loadCachedRundownData(ingestObjCache, rundownId)
		const newIngestRundown = updateCacheFcn(clone(oldIngestRundown))
		if (newIngestRundown === null) {
			// Reject change
			return
		} else if (newIngestRundown === undefined) {
			ingestObjCache.remove({})
		} else {
			saveRundownCache(ingestObjCache, rundownId, newIngestRundown)
		}
		// Start saving the ingest data
		const pSaveIngestChanges = ingestObjCache.updateDatabaseWithData()

		const ingestCache = await pIngestCache

		// Load any 'before' data for the commit
		const beforeRundown = ingestCache.Rundown.doc
		const beforePartMap = generatePartMap(ingestCache)

		try {
			const commitData = await calcFcn(ingestCache, newIngestRundown, oldIngestRundown)
			if (commitData) {
				const commitData0 = commitData
				// TODO - is this valid? can we not trust the ingest data and either update or not? Having both calcFcn and updateCacheFcn be able to reject is excessive
				// The change is accepted

				// Get the rundown. This assumes one is defined by now which it should be
				// const rundown = getRundown(ingestCache)

				await CommitIngestOperation(ingestCache, beforeRundown, beforePartMap, commitData0)

				// async function doPlaylistInner() {
				// 	// const playoutInfo = await getIngestPlaylistInfoFromDb(rundown)

				// 	await CommitIngestOperation(ingestCache, playoutInfo, commitData0)

				// 	// Update modified time
				// 	if (getCurrentTime() - rundown.modified > 3600 * 1000) {
				// 		const m = getCurrentTime()
				// 		ingestCache.Rundown.update({ $set: { modified: m } })
				// 	}

				// 	// This needs to be inside the playout lock to ensure that a take doesnt happen mid update
				// 	await ingestCache.saveAllToDatabase()
				// }

				// if (playlistLock?._playlistId === rundown.playlistId) {
				// 	// We already hold the playlist lock, so reuse it
				// 	await doPlaylistInner()
				// } else {
				// 	playoutNoCacheLockFunction(
				// 		null,
				// 		context,
				// 		rundown.playlistId,
				// 		RundownSyncFunctionPriority.INGEST,
				// 		doPlaylistInner
				// 	)
				// }
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
 * Perform an operation on a rundown that has no effect on playout
 * Warning: this will not attempt to update playout or perform the usual ingest post-changes. Be very careful what is changed as it could cause weird behaviour
 * @param context Contextual information for the call to this function. to aid debugging
 * @param studioId Id of the studio the rundown belongs to
 * @param rundownExternalId ExternalId of the rundown to lock
 * @param fcn Function to run while holding the lock
 * @param playlistLock If the playlist lock is already held, supply it here to avoid trying to reaquire the lock
 */
export function ingestRundownOnlyLockFunction(
	context: string,
	studioId: StudioId,
	rundownExternalId: string,
	fcn: (ingestCache: CacheForIngest) => Promise<void>,
	playlistLock?: PlaylistLock
): void {
	return ingestLockFunctionInner(context, rundownExternalId, async () => {
		const ingestCache = await CacheForIngest.create(studioId, rundownExternalId)
		const beforeRundown = getRundown(ingestCache)

		// Do the function
		fcn(ingestCache)

		// Check the change isn't making a mess
		const afterRundown = getRundown(ingestCache)
		if (beforeRundown.playlistId !== afterRundown.playlistId)
			throw new Meteor.Error(
				500,
				`RundownPlaylist id for Rundown "${ingestCache.RundownId}" cannot be changed during a ingestRundownOnlyLockFunction`
			)

		async function doPlaylistInner() {
			// This needs to be inside the playout lock to ensure that a take doesnt happen mid update
			await ingestCache.saveAllToDatabase()
		}

		if (playlistLock?._playlistId === afterRundown.playlistId) {
			// We already hold the playlist lock, so reuse it
			await doPlaylistInner()
		} else {
			playoutNoCacheLockFunction(
				null,
				context,
				beforeRundown.playlistId,
				RundownSyncFunctionPriority.INGEST,
				doPlaylistInner
			)
		}
	})
}

function ingestLockFunctionInner(context: string, rundownExternalId: string, fcn: () => Promise<void>): void {
	return syncFunction(
		() => {
			waitForPromise(fcn())
		},
		context,
		`rundown_ingest_${rundownExternalId}`
	)()
}

function generatePartMap(cache: ReadOnlyCache<CacheForIngest>): BeforePartMap {
	const rundown = cache.Rundown.doc
	if (!rundown) return new Map()

	const segmentsAndParts = getRundownsSegmentsAndPartsFromCache(cache.Parts, cache.Segments, [rundown])
	const existingRundownParts = _.groupBy(segmentsAndParts.parts, (part) => part.segmentId)

	const res = new Map<SegmentId, Array<{ id: PartId; rank: number }>>()
	for (const [segmentId, parts] of Object.entries(existingRundownParts)) {
		res.set(
			protectString(segmentId),
			parts.map((p) => ({ id: p._id, rank: p._rank }))
		)
	}
	return res
}
