import { getShowStyleCompound2, ShowStyleCompound } from '../../../lib/collections/ShowStyleVariants'
import {
	loadShowStyleBlueprint,
	loadStudioBlueprint,
	WrappedShowStyleBlueprint,
	WrappedStudioBlueprint,
} from '../blueprints/cache'
import { updateExpectedMediaItemsOnRundown } from './expectedMediaItems'
import { CacheForPlayout } from '../playout/cache'
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
import { SegmentId } from '../../../lib/collections/Segments'
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
	asyncCollectionFindOne,
	asyncCollectionRemove,
	clone,
	getCurrentTime,
	makePromise,
	max,
	protectString,
	unprotectObjectArray,
} from '../../../lib/lib'
import { Studio } from '../../../lib/collections/Studios'
import _ from 'underscore'
import { ReadOnlyCache } from '../../cache/DatabaseCaches'
import { reportRundownDataHasChanged } from '../asRunLog'
import { removeSegmentContents } from './cleanup'
import { Settings } from '../../../lib/Settings'
import { DbCacheWriteCollection } from '../../cache/CacheCollection'
import { PartInstance } from '../../../lib/collections/PartInstances'
import { PartId } from '../../../lib/collections/Parts'

export type BeforePartMap = ReadonlyMap<SegmentId, Array<{ id: PartId; rank: number }>>

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
	beforePartMap: BeforePartMap,
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

	// Regenerate the full list of expected*
	updateExpectedMediaItemsOnRundown(ingestCache)
	updateExpectedPlayoutItemsOnRundown(ingestCache)

	const targetPlaylistId =
		(beforeRundown?.playlistIdIsSetInSofie ? beforeRundown.playlistId : undefined) ??
		getPlaylistIdFromExternalId(ingestCache.Studio.doc._id, rundown.playlistExternalId ?? rundown.externalId)

	// Free the rundown from its old playlist, if it is moving
	let trappedInPlaylistId: [RundownPlaylistId, string] | undefined
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
					trappedInPlaylistId = [playlist._id, playlist.externalId]
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
										rundown,
										showStyle,
										blueprint,
										new Map(),
										[]
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
		newPlaylistId[0],
		RundownSyncFunctionPriority.INGEST,
		async (lock) => {
			// Ensure the rundown has the correct playlistId
			ingestCache.Rundown.update({ $set: { playlistId: newPlaylistId[0] } })

			const [newPlaylist, rundownsCollection] = await generatePlaylistAndRundownsCollection(
				ingestCache,
				newPlaylistId[0],
				newPlaylistId[1]
			)

			// Do the segment removals
			if (data.removedSegmentIds.length > 0) {
				const { currentPartInstance, nextPartInstance } = newPlaylist.getSelectedPartInstances()

				const purgeSegmentIds = new Set<SegmentId>()
				const orphanSegmentIds = new Set<SegmentId>()
				for (const segmentId of data.removedSegmentIds) {
					if (canRemoveSegment(currentPartInstance, nextPartInstance, segmentId)) {
						purgeSegmentIds.add(segmentId)
					} else {
						orphanSegmentIds.add(segmentId)
					}
				}

				const emptySegmentIds = Settings.allowUnsyncedSegments
					? purgeSegmentIds
					: new Set([...purgeSegmentIds.values(), ...orphanSegmentIds.values()])
				removeSegmentContents(ingestCache, emptySegmentIds)
				if (orphanSegmentIds.size) {
					ingestCache.Segments.update((s) => orphanSegmentIds.has(s._id), {
						$set: {
							orphaned: 'deleted',
						},
					})
				}
				if (purgeSegmentIds.size) {
					ingestCache.Segments.remove((s) => purgeSegmentIds.has(s._id))
				}
			}

			// Save the rundowns
			// This will reorder the rundowns a little before the playlist and the contents, but that is ok
			await rundownsCollection.updateDatabaseWithData()

			// Create the full playout cache, now we have the rundowns and playlist updated
			const playoutCache = await CacheForPlayout.from(newPlaylist, rundownsCollection.findFetch({}))
			// TODO - this will be ignoring the updated rundown!!!!

			// Start the save
			const pSave = ingestCache.saveAllToDatabase()

			try {
				// Get the final copy of the rundown
				const newRundown = getRundown(ingestCache)

				// Update the playout to use the updated rundown
				const changedSegmentsInfo = data.changedSegmentIds.map((id) => ({
					segmentId: id,
					oldPartIdsAndRanks: beforePartMap.get(id) ?? [],
				}))
				applyChangesToPlayout(
					playoutCache,
					ingestCache,
					newRundown,
					showStyle,
					blueprint,
					data.renamedSegments,
					changedSegmentsInfo
				)

				playoutCache.deferAfterSave(() => {
					reportRundownDataHasChanged(playoutCache.Playlist.doc, newRundown)
				})

				// wait for it all to save in parallel
				await Promise.all([pSave, playoutCache.saveAllToDatabase()])
			} finally {
				// Wait for the save to complete. We need it to be completed, otherwise the rundown will be in a broken state
				await pSave
			}
		}
	)
}

async function generatePlaylistAndRundownsCollection(
	ingestCache: CacheForIngest,
	newPlaylistId: RundownPlaylistId,
	newPlaylistExternalId: string
): Promise<[RundownPlaylist, DbCacheWriteCollection<Rundown, DBRundown>]> {
	// Load existing playout data
	const finalRundown = getRundown(ingestCache)
	const rundownsCollection = new DbCacheWriteCollection(Rundowns)
	const [existingPlaylist, studioBlueprint] = await Promise.all([
		asyncCollectionFindOne(RundownPlaylists, newPlaylistId),
		makePromise(() => loadStudioBlueprint(ingestCache.Studio.doc)),
		rundownsCollection.prepareInit({ playlistId: newPlaylistId }, true),
	])
	rundownsCollection.replace(finalRundown)

	// Generate the new playlist, and ranks for the rundowns
	const { rundownPlaylist: newPlaylist0, order: newRundownOrder } = produceRundownPlaylistInfoFromRundown(
		ingestCache.Studio.doc,
		studioBlueprint,
		existingPlaylist,
		newPlaylistId,
		newPlaylistExternalId,
		rundownsCollection.findFetch({})
	)
	const newPlaylist = new RundownPlaylist(newPlaylist0)

	// Update the ranks of the rundowns
	if (!newPlaylist.rundownRanksAreSetInSofie) {
		// Update the rundown ranks
		for (const [id, rank] of Object.entries(newRundownOrder)) {
			const id2 = protectString(id)
			rundownsCollection.update(id2, { $set: { _rank: rank } })
			if (id2 === ingestCache.RundownId) {
				// Update the ingestCache to keep them in sync
				ingestCache.Rundown.update({ $set: { _rank: rank } })
			}
		}
	} else {
		// This rundown is new, so push to the end of the manually ordered playlist
		const otherRundowns = rundownsCollection.findFetch((r) => r._id !== ingestCache.RundownId)
		const last = max(otherRundowns, (r) => r._rank)?._rank ?? -1
		rundownsCollection.update(ingestCache.RundownId, { $set: { _rank: last + 1 } })
		// Update the ingestCache to keep them in sync
		ingestCache.Rundown.update({ $set: { _rank: last + 1 } })
	}

	return [newPlaylist, rundownsCollection]
}

function applyChangesToPlayout(
	playoutCache: CacheForPlayout,
	ingestCache: Omit<ReadOnlyCache<CacheForIngest>, 'Rundown'> | null,
	newRundown: ReadonlyDeep<Rundown>,
	showStyle: ReadonlyDeep<ShowStyleCompound>,
	blueprint: ReadonlyDeep<WrappedShowStyleBlueprint>,
	renamedSegments: ReadonlyMap<SegmentId, SegmentId>,
	changedSegmentsInfo: ChangedSegmentsRankInfo
) {
	updatePartInstancesBasicProperties(playoutCache, newRundown._id, renamedSegments)

	updatePartInstanceRanks(playoutCache, changedSegmentsInfo)

	UpdateNext.ensureNextPartIsValid(playoutCache)

	if (ingestCache) {
		// If we have updated the rundown, then sync to the selected partInstances
		syncChangesToPartInstances(playoutCache, ingestCache, showStyle, blueprint.blueprint, newRundown)
	}

	triggerUpdateTimelineAfterIngestData(playoutCache.PlaylistId)
}

function canRemoveSegment(
	currentPartInstance: ReadonlyDeep<PartInstance> | undefined,
	nextPartInstance: ReadonlyDeep<PartInstance> | undefined,
	segmentId: SegmentId
): boolean {
	if (
		currentPartInstance?.segmentId === segmentId ||
		(nextPartInstance?.segmentId === segmentId && isTooCloseToAutonext(currentPartInstance, false))
	) {
		// Don't allow removing an active rundown
		logger.warn(`Not allowing removal of current playing segment "${segmentId}", making segment unsynced instead`)
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
