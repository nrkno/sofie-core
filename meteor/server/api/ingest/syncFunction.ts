import { IngestRundown } from '@sofie-automation/blueprints-integration'
import { Meteor } from 'meteor/meteor'
import { ReadonlyDeep } from 'type-fest'
import { IngestDataCache, IngestDataCacheObj } from '../../../lib/collections/IngestDataCache'
import { PartInstance } from '../../../lib/collections/PartInstances'
import { RundownPlaylist, RundownPlaylists } from '../../../lib/collections/RundownPlaylists'
import { Rundown, Rundowns } from '../../../lib/collections/Rundowns'
import { SegmentId } from '../../../lib/collections/Segments'
import { ShowStyleCompound } from '../../../lib/collections/ShowStyleVariants'
import { StudioId } from '../../../lib/collections/Studios'
import {
	waitForPromise,
	asyncCollectionFindFetch,
	asyncCollectionFindOne,
	getCurrentTime,
	clone,
} from '../../../lib/lib'
import { DbCacheWriteCollection } from '../../cache/CacheCollection'
import { syncFunction } from '../../codeControl'
import { WrappedShowStyleBlueprint } from '../blueprints/cache'
import { PlaylistLock, playoutNoCacheLockFunction } from '../playout/syncFunction'
import { profiler } from '../profiler'
import { CacheForIngest } from './cache'
import { CommitIngestOperation } from './commit'
import { LocalIngestRundown } from './ingestCache'
import { loadCachedRundownData, saveRundownCache } from './ingestCache2'
import { getRundown2, getRundownId } from './lib'
import { RundownSyncFunctionPriority } from './rundownInput'

export interface IngestPlayoutInfo {
	readonly playlist: ReadonlyDeep<RundownPlaylist>
	readonly rundowns: ReadonlyDeep<Array<Rundown>>
	readonly currentPartInstance: ReadonlyDeep<PartInstance> | undefined
	readonly nextPartInstance: ReadonlyDeep<PartInstance> | undefined
}

export async function getIngestPlaylistInfoFromDb(
	rundown: ReadonlyDeep<Rundown>
): Promise<IngestPlayoutInfo | undefined> {
	const [playlist, rundowns] = await Promise.all([
		asyncCollectionFindOne(RundownPlaylists, { _id: rundown.playlistId }),
		asyncCollectionFindFetch(
			Rundowns,
			{
				playlistId: rundown.playlistId,
			},
			{
				sort: {
					_rank: 1,
					_id: 1,
				},
			}
		),
	])

	if (!playlist) return undefined

	const { currentPartInstance, nextPartInstance } = playlist.getSelectedPartInstances(rundowns.map((r) => r._id))

	const playoutInfo: IngestPlayoutInfo = {
		playlist,
		rundowns,
		currentPartInstance,
		nextPartInstance,
	}
	return playoutInfo
}

export interface CommitIngestData {
	/** Segment Ids which had any changes */
	changedSegmentIds: SegmentId[]
	/** Segments to be removed or orphaned */
	removedSegmentIds: SegmentId[]

	/** Whether the rundown should be removed or orphaned */
	removeRundown: boolean

	/** ShowStyle, if loaded to reuse */
	showStyle: ShowStyleCompound | undefined
	/** Blueprint, if loaded to reuse */
	blueprint: WrappedShowStyleBlueprint | undefined
}

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
	return syncFunction(
		() => {
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
			waitForPromise(ingestObjCache.prepareInit({ rundownId }, true))

			// Recalculate the ingest data
			const oldIngestRundown = loadCachedRundownData(ingestObjCache)
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

			const ingestCache = waitForPromise(pIngestCache)

			try {
				const commitData = waitForPromise(calcFcn(ingestCache, newIngestRundown, oldIngestRundown))
				if (commitData) {
					const commitData0 = commitData
					// TODO - is this valid? can we not trust the ingest data and either update or not? Having both calcFcn and updateCacheFcn be able to reject is excessive
					// The change is accepted

					// Get the rundown. This assumes one is defined by now which it should be
					const rundown = getRundown2(ingestCache)

					function doPlaylistInner() {
						const playoutInfo = waitForPromise(getIngestPlaylistInfoFromDb(rundown))

						waitForPromise(CommitIngestOperation(ingestCache, playoutInfo, commitData0))

						// Update modified time
						if (getCurrentTime() - rundown.modified > 3600 * 1000) {
							const m = getCurrentTime()
							ingestCache.Rundown.update({ $set: { modified: m } })
						}

						// This needs to be inside the playlist lock to ensure that
						waitForPromise(ingestCache.saveAllToDatabase())
					}

					if (playlistLock?._playlistId === rundown.playlistId) {
						// We already hold the playlist lock, so reuse it
						doPlaylistInner()
					} else {
						playoutNoCacheLockFunction(
							null,
							context,
							rundown.playlistId,
							RundownSyncFunctionPriority.INGEST,
							doPlaylistInner
						)
					}
				}
			} finally {
				// Ensure we save the ingest data
				waitForPromise(pSaveIngestChanges)

				span?.end()
			}
		},
		context,
		`rundown_ingest_${rundownExternalId}`
	)()
}
