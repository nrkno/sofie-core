import { getShowStyleCompound2, ShowStyleCompound } from '../../../lib/collections/ShowStyleVariants'
import {
	loadShowStyleBlueprint,
	loadStudioBlueprint,
	WrappedShowStyleBlueprint,
	WrappedStudioBlueprint,
} from '../blueprints/cache'
import { updateExpectedMediaItemsOnRundown } from './expectedMediaItems'
import { CacheForPlayout, getSelectedPartInstancesFromCache } from '../playout/cache'
import { triggerUpdateTimelineAfterIngestData } from '../playout/playout'
import {
	allowedToMoveRundownOutOfPlaylist,
	ChangedSegmentsRankInfo,
	RundownPlaylistAndOrder,
	ServerRundownAPI,
	sortDefaultRundownInPlaylistOrder,
	updatePartInstanceRanks,
} from '../rundown'
import { CacheForIngest } from './cache'
import { updateExpectedPlayoutItemsOnRundown } from './expectedPlayoutItems'
import { getRundown } from './lib'
import { syncChangesToPartInstances } from './syncChangesToPartInstance'
import { CommitIngestData } from './syncFunction'
import { UpdateNext } from './updateNext'
import { DBSegment, SegmentId } from '../../../lib/collections/Segments'
import { logger } from '../../logging'
import { isTooCloseToAutonext } from '../playout/lib'
import { DBRundown, Rundown, RundownId, Rundowns } from '../../../lib/collections/Rundowns'
import { ReadonlyDeep } from 'type-fest'
import { playoutNoCacheLockFunction, playoutWithCacheFromStudioLockFunction } from '../playout/syncFunction'
import { RundownSyncFunctionPriority } from './rundownInput'
import {
	DBRundownPlaylist,
	RundownPlaylist,
	RundownPlaylistId,
	RundownPlaylists,
} from '../../../lib/collections/RundownPlaylists'
import { getPlaylistIdFromExternalId, removeRundownsFromDb } from '../rundownPlaylist'
import {
	asyncCollectionFindFetch,
	asyncCollectionFindOne,
	asyncCollectionRemove,
	clone,
	getCurrentTime,
	makePromise,
	protectString,
	unprotectObjectArray,
} from '../../../lib/lib'
import { Studio } from '../../../lib/collections/Studios'
import _ from 'underscore'
import { ReadOnlyCache } from '../../cache/DatabaseCaches'

/**
 * Post-process some ingest changes.
 * This is designed to be the same block of code after any ingest change. The aim is to be able to run it once after a batch of ingest changes
 * @param ingestCache The cache for the rundown that has been changed
 * @param playoutInfo NOPE..
 * @param data Information about the ingest changes performed
 */
export async function CommitIngestOperation(
	ingestCache: CacheForIngest,
	beforeRundown: ReadonlyDeep<Rundown> | undefined,
	// playoutInfo: IngestPlayoutInfo | undefined,
	data: ReadonlyDeep<CommitIngestData>
): Promise<void> {
	const rundown = getRundown(ingestCache)

	if (data.removeRundown && !beforeRundown) {
		// Fresh rundown that was instantly deleted. Discard everything and pretend it never happened
		ingestCache.discardChanges()
		return
	}

	const showStyle = data.showStyle ?? (await getShowStyleCompound2(rundown))
	const blueprint = (data.showStyle ? data.blueprint : undefined) ?? loadShowStyleBlueprint(showStyle)

	// TODO - Process updates
	// const rundownPlaylistInfo = produceRundownPlaylistInfoFromRundown(studio, dbRundownData, peripheralDevice)
	// dbRundownData.playlistId = rundownPlaylistInfo.rundownPlaylist._id
	// const playlistChanges = saveIntoDb(
	// 	RundownPlaylists,
	// 	{
	// 		_id: rundownPlaylistInfo.rundownPlaylist._id,
	// 	},
	// 	[rundownPlaylistInfo.rundownPlaylist],
	// 	{
	// 		beforeInsert: (o) => {
	// 			o.created = getCurrentTime()
	// 			o.modified = getCurrentTime()
	// 			o.previousPartInstanceId = null
	// 			o.currentPartInstanceId = null
	// 			o.nextPartInstanceId = null
	// 			return o
	// 		},
	// 		beforeUpdate: (o) => {
	// 			o.modified = getCurrentTime()
	// 			return o
	// 		},
	// 	}
	// )
	// updateRundownsInPlaylist(rundownPlaylistInfo.rundownPlaylist, rundownPlaylistInfo.order, dbRundown)
	// cache.deferAfterSave(() => {
	// 	const studioId = cache.Studio.doc._id
	// 	Meteor.defer(() => {
	// 		// It needs to lock every playlist, and we are already inside one of the locks it needs
	// 		removeEmptyPlaylists(studioId)
	// 	})
	// })

	// Rundown changed
	// cache.defer((cache) => {
	// 	reportRundownDataHasChanged(cache, dbPlaylist, dbRundown)
	// })

	// Removing rundown
	// if (!allowedToMoveRundownOutOfPlaylist(playlist, rundown)) {
	// 	// Don't allow removing currently playing rundown playlists:
	// 	logger.warn(
	// 		`Not allowing removal of currently playing rundown "${rundown._id}", making it unsynced instead`
	// 	)
	// 	ServerRundownAPI.unsyncRundownInner(cache, rundown._id)
	// } else {
	// 	logger.info(`Removing rundown "${rundown._id}"`)
	// 	removeRundownFromCache(cache, rundown)
	// }

	// Removing segment
	// if (!canRemoveSegment(cache, playlist, segment)) {
	//     unsyncAndEmptySegment(cache, rundownId, segmentId)
	// } else {

	//     cache.Segments.remove(segmentId)
	//     removeSegmentContents(cache, rundownId, [segmentId])

	//     UpdateNext.ensureNextPartIsValid(cache, playlist)
	// }

	// Cleanup removed segments
	// // Remove it too, if it can be removed
	// const segment = cache.Segments.findOne(segmentId)
	// if (canRemoveSegment(cache, playlist, segment)) {
	// 	cache.Segments.remove(segmentId)
	// }

	// TODO - existingRundownParts needs to be generated before the calcFcn
	// const changedSegments = newSegments.map((s) => ({
	// 			segmentId: s._id,
	// 			oldPartIdsAndRanks: (existingRundownParts[unprotectString(s._id)] || []).map((p) => ({
	// 				id: p._id,
	// 				rank: p._rank,
	// 			})),
	// 		}))

	// If anything changed?
	// triggerUpdateTimelineAfterIngestData(cache.containsDataFromPlaylist)

	// To be called after rundown has been changed
	updateExpectedMediaItemsOnRundown(ingestCache)
	updateExpectedPlayoutItemsOnRundown(ingestCache)

	const targetPlaylistId =
		(beforeRundown?.playlistIdIsSetInSofie ? beforeRundown.playlistId : undefined) ??
		getPlaylistIdFromExternalId(ingestCache.Studio.doc._id, rundown.playlistExternalId ?? rundown.externalId)

	// Free the rundown from its old playlist, if it is moving
	let trappedInPlaylistId: RundownPlaylistId | undefined
	if (beforeRundown?.playlistId && beforeRundown.playlistId !== targetPlaylistId) {
		const beforePlaylistId = beforeRundown.playlistId
		playoutNoCacheLockFunction(
			null,
			'ingest.commit.removeRundownFromOldPlaylist',
			beforePlaylistId,
			RundownSyncFunctionPriority.INGEST,
			async (oldPlaylistLock) => {
				// Aquire the playout lock so we can safely modify the playlist contents

				// TODO - use the CacheForPlayoutPreInit here instead??

				const playlist = RundownPlaylists.findOne(beforePlaylistId)
				if (playlist && !allowedToMoveRundownOutOfPlaylist(playlist, rundown)) {
					// Don't allow removing currently playing rundown playlists:
					logger.warn(
						`Not allowing removal of currently playing rundown "${rundown._id}", making it unsynced instead`
					)

					// Discard proposed playlistId changes
					trappedInPlaylistId = playlist._id
					ingestCache.Rundown.update({
						$set: {
							playlistId: playlist._id,
							playlistExternalId: playlist.externalId, // TODO - is this correct?
						},
					})

					// TODO - finish this
					if (data.removeRundown) {
						ServerRundownAPI.unsyncRundownInner(cache, rundown._id)
					} else {
						// TODO?
						// if (!dbRundownData.notes) dbRundownData.notes = []
						// dbRundownData.notes.push({
						// 	type: NoteType.WARNING,
						// 	message: {
						// 		key:
						// 			'The Rundown was attempted to be moved out of the Playlist when it was on Air. Move it back and try again later.',
						// 	},
						// 	origin: {
						// 		name: 'Data update',
						// 	},
						// })
					}
				} else {
					// The rundown is safe to simply move or remove
					trappedInPlaylistId = undefined

					// Quickly move the rundown out of the playlist, so we an free the lock sooner
					Rundowns.update(ingestCache.RundownId, {
						$set: {
							playlistId: protectString('__TMP__'),
							playlistExternalId: '__TMP__',
						},
					})

					if (playlist) {
						// ensure the 'old' playout is updated to remove any references to the rundown
						playoutWithCacheFromStudioLockFunction(
							'',
							oldPlaylistLock,
							playlist,
							null,
							async (playoutCache) => {
								if (playoutCache.Rundowns.documents.size === 0) {
									// Remove an empty playlist
									await asyncCollectionRemove(RundownPlaylists, { _id: playoutCache.PlaylistId })
								} else {
									applyChangesToPlayout(
										playoutCache,
										null,
										ingestCache.RundownId,
										showStyle,
										blueprint,
										new Map()
									)
								}
							}
						)
					}
				}
			}
		)
	}

	// Rundown needs to be removed, and has been removed its old playlist, so we can now do the discard
	if (data.removeRundown && !trappedInPlaylistId) {
		ingestCache.discardChanges()
		removeRundownsFromDb([ingestCache.RundownId])
		return
	}

	// Adopt the rundown into its new/retained playlist
	const newPlaylistId = trappedInPlaylistId ?? targetPlaylistId
	playoutNoCacheLockFunction(
		null,
		'ingest.commit.saveRundownToPlaylist',
		newPlaylistId,
		RundownSyncFunctionPriority.INGEST,
		async (lock) => {
			// Ensure the rundown has the correct playlistId
			ingestCache.Rundown.update({ $set: { playlistId: newPlaylistId } })

			// Start the save
			const pSave = ingestCache.saveAllToDatabase()

			try {
				regenerateAndUpdatePlaylist(
					ingestCache,
					newPlaylistId,
					'TODO', // TODO
					beforeRundown,
					showStyle,
					blueprint,
					data
				)
			} finally {
				// Wait for the save to complete. We need it to be completed, otherwise the rundown will be in a broken state
				await pSave
			}
		}
	)
}

async function regenerateAndUpdatePlaylist(
	ingestCache: ReadOnlyCache<CacheForIngest>,
	newPlaylistId: RundownPlaylistId,
	newPlaylistExternalId: string,
	beforeRundown: ReadonlyDeep<Rundown> | undefined,
	showStyle: ReadonlyDeep<ShowStyleCompound>,
	blueprint: ReadonlyDeep<WrappedShowStyleBlueprint>,
	data: ReadonlyDeep<CommitIngestData>
): Promise<void> {
	const newRundown = getRundown(ingestCache)

	// Regenerate playlist
	const [existingPlaylist, existingRundowns, studioBlueprint] = await Promise.all([
		asyncCollectionFindOne(RundownPlaylists, newPlaylistId),
		asyncCollectionFindFetch(Rundowns, {
			playlistId: newPlaylistId,
			_id: { $ne: ingestCache.RundownId },
		}),
		makePromise(() => loadStudioBlueprint(ingestCache.Studio.doc)),
	])
	const newRundowns = [...existingRundowns, newRundown]
	const { rundownPlaylist: newPlaylist, order: newRundownOrder } = produceRundownPlaylistInfoFromRundown(
		ingestCache.Studio.doc,
		studioBlueprint,
		existingPlaylist,
		newPlaylistId,
		newPlaylistExternalId,
		newRundowns
	)

	// Load the playout cache for the 'new' playlist
	// TODO - use the in-memory data for the current rundown..
	const playoutCache = await CacheForPlayout.from(new RundownPlaylist(newPlaylist), newRundowns)

	if (!newPlaylist.rundownRanksAreSetInSofie) {
		// TODO - this needs to not be done on the cache, as that collection should be readonly
		// Update the rundown ranks
		for (const [id, rank] of Object.entries(newRundownOrder)) {
			playoutCache.Rundowns.update(protectString(id), { $set: { _rank: rank } })
		}
	} else if (beforeRundown) {
		// This rundown is new, so push to the end of the manually ordered playlist
		// const last = existingRundowns.length > 0? _.max(existingRundowns, r => r._rank) : 0
		// TODO - this is fiddly to store..
	}
	// TODO

	// Update the playout to use the updated rundown
	applyChangesToPlayout(playoutCache, ingestCache, ingestCache.RundownId, showStyle, blueprint, data.renamedSegments)
}

function applyChangesToPlayout(
	playoutCache: CacheForPlayout,
	ingestCache: ReadOnlyCache<CacheForIngest> | null,
	rundownId: RundownId,
	showStyle: ReadonlyDeep<ShowStyleCompound>,
	blueprint: ReadonlyDeep<WrappedShowStyleBlueprint>,
	renamedSegments: ReadonlyMap<SegmentId, SegmentId>
) {
	updatePartInstancesBasicProperties(playoutCache, rundownId, renamedSegments)

	updatePartInstanceRanks(playoutCache, changedSegments)

	UpdateNext.ensureNextPartIsValid(playoutCache)

	if (ingestCache) {
		// If we have updated the rundown, then sync to the selected partInstances
		const rundown = getRundown(ingestCache)
		syncChangesToPartInstances(playoutCache, ingestCache, showStyle, blueprint.blueprint, rundown)
	}

	triggerUpdateTimelineAfterIngestData(playoutCache.PlaylistId)
}

function canRemoveSegment(cache: CacheForPlayout, segment: DBSegment | undefined): boolean {
	const { currentPartInstance, nextPartInstance } = getSelectedPartInstancesFromCache(cache)
	if (
		segment &&
		(currentPartInstance?.segmentId === segment._id ||
			(nextPartInstance?.segmentId === segment._id && isTooCloseToAutonext(currentPartInstance, false)))
	) {
		// Don't allow removing an active rundown
		logger.warn(`Not allowing removal of current playing segment "${segment._id}", making segment unsynced instead`)
		return false
	}

	return true
}

/**
 * Ensure some 'basic' PartInstances properties are in sync with their parts
 */
function updatePartInstancesBasicProperties(
	cache: CacheForPlayout,
	rundownId: RundownId,
	renamedSegments: ReadonlyMap<SegmentId, SegmentId>
) {
	const playlist = cache.Playlist.doc
	const partInstances = cache.PartInstances.findFetch((p) => !p.reset && p.rundownId === rundownId)
	for (const partInstance of partInstances) {
		const part = cache.Parts.findOne(partInstance.part._id)
		if (!part) {
			// Part is deleted, so reset this instance if it isnt on-air
			if (
				playlist.currentPartInstanceId !== partInstance._id &&
				playlist.nextPartInstanceId !== partInstance._id
			) {
				cache.PartInstances.update(partInstance._id, { $set: { reset: true } })
			} else {
				cache.PartInstances.update(partInstance._id, { $set: { orphaned: 'deleted' } })
			}
		}

		// Follow any segment renames
		const newSegmentId = part?.segmentId ?? renamedSegments.get(partInstance.segmentId)
		if (newSegmentId) {
			cache.PartInstances.update(partInstance._id, {
				$set: {
					segmentId: newSegmentId,
					'part.segmentId': newSegmentId,
				},
			})
		}
	}
}

export function produceRundownPlaylistInfoFromRundown(
	studio: ReadonlyDeep<Studio>,
	studioBlueprint: WrappedStudioBlueprint | undefined,
	existingPlaylist: RundownPlaylist | undefined,
	playlistId: RundownPlaylistId,
	playlistExternalId: string,
	rundowns: ReadonlyDeep<Array<Rundown>>
): RundownPlaylistAndOrder {
	const playlistInfo = studioBlueprint?.blueprint?.getRundownPlaylistInfo
		? studioBlueprint.blueprint.getRundownPlaylistInfo(
				// new StudioUserContext(
				// 	{
				// 		name: 'produceRundownPlaylistInfoFromRundown',
				// 		identifier: `studioId=${studio._id},playlistId=${unprotectString(
				// 			playlistId
				// 		)},rundownId=${currentRundown._id}`,
				// 		tempSendUserNotesIntoBlackHole: true,
				// 	},
				// 	studio
				// ),
				unprotectObjectArray(clone<Array<Rundown>>(rundowns))
		  )
		: null

	const rundownsInDefaultOrder = sortDefaultRundownInPlaylistOrder(rundowns)

	let newPlaylist: DBRundownPlaylist
	if (playlistInfo) {
		newPlaylist = {
			created: getCurrentTime(),
			currentPartInstanceId: null,
			nextPartInstanceId: null,
			previousPartInstanceId: null,

			...existingPlaylist,

			_id: playlistId,
			externalId: playlistExternalId,
			organizationId: studio.organizationId,
			studioId: studio._id,
			name: playlistInfo.playlist.name,
			expectedStart: playlistInfo.playlist.expectedStart,
			expectedDuration: playlistInfo.playlist.expectedDuration,

			loop: playlistInfo.playlist.loop,

			outOfOrderTiming: playlistInfo.playlist.outOfOrderTiming,

			modified: getCurrentTime(),
		}
	} else {
		newPlaylist = {
			...defaultPlaylistForRundown(rundownsInDefaultOrder[0], studio, existingPlaylist),
			_id: playlistId,
			externalId: playlistExternalId,
		}
	}

	// If no order is provided, fall back to default sorting:
	const order = playlistInfo?.order ?? _.object(rundownsInDefaultOrder.map((i, index) => [i._id, index + 1]))

	return {
		rundownPlaylist: newPlaylist,
		order: order, // Note: if playlist.rundownRanksAreSetInSofie is set, this order should be ignored later
	}
}
function defaultPlaylistForRundown(
	rundown: ReadonlyDeep<DBRundown>,
	studio: ReadonlyDeep<Studio>,
	existingPlaylist?: RundownPlaylist
): Omit<DBRundownPlaylist, '_id' | 'externalId'> {
	return {
		created: getCurrentTime(),
		currentPartInstanceId: null,
		nextPartInstanceId: null,
		previousPartInstanceId: null,

		...existingPlaylist,

		organizationId: studio.organizationId,
		studioId: studio._id,
		name: rundown.name,
		expectedStart: rundown.expectedStart,
		expectedDuration: rundown.expectedDuration,

		modified: getCurrentTime(),
	}
}
