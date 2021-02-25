import { getShowStyleCompoundForRundown, ShowStyleCompound } from '../../../lib/collections/ShowStyleVariants'
import { loadShowStyleBlueprint, loadStudioBlueprint, WrappedShowStyleBlueprint } from '../blueprints/cache'
import { updateExpectedMediaItemsOnRundown } from './expectedMediaItems'
import { CacheForPlayout, getSelectedPartInstancesFromCache } from '../playout/cache'
import { triggerUpdateTimelineAfterIngestData } from '../playout/playout'
import { allowedToMoveRundownOutOfPlaylist, ChangedSegmentsRankInfo, updatePartInstanceRanks } from '../rundown'
import { CacheForIngest } from './cache'
import { updateExpectedPlayoutItemsOnRundown } from './expectedPlayoutItems'
import { getRundown } from './lib'
import { syncChangesToPartInstances } from './syncChangesToPartInstance'
import { CommitIngestData } from './lockFunction'
import { ensureNextPartIsValid } from './updateNext'
import { SegmentId } from '../../../lib/collections/Segments'
import { logger } from '../../logging'
import { isTooCloseToAutonext } from '../playout/lib'
import { DBRundown, Rundown, RundownId, Rundowns } from '../../../lib/collections/Rundowns'
import { ReadonlyDeep } from 'type-fest'
import { RundownSyncFunctionPriority } from './rundownInput'
import { RundownPlaylist, RundownPlaylistId, RundownPlaylists } from '../../../lib/collections/RundownPlaylists'
import {
	getPlaylistIdFromExternalId,
	produceRundownPlaylistInfoFromRundown,
	removeRundownsFromDb,
} from '../rundownPlaylist'
import {
	asyncCollectionFindOne,
	asyncCollectionRemove,
	asyncCollectionUpsert,
	clone,
	makePromise,
	max,
	protectString,
	unprotectString,
} from '../../../lib/lib'
import _ from 'underscore'
import { ReadOnlyCache } from '../../cache/CacheBase'
import { reportRundownDataHasChanged } from '../asRunLog'
import { removeSegmentContents } from './cleanup'
import { Settings } from '../../../lib/Settings'
import { DbCacheWriteCollection } from '../../cache/CacheCollection'
import { PartInstance } from '../../../lib/collections/PartInstances'
import { PartId } from '../../../lib/collections/Parts'
import { NoteType, RundownNote } from '../../../lib/api/notes'
import {
	PlaylistLock,
	runPlayoutOperationWithCacheFromStudioOperation,
	runPlayoutOperationWithLock,
	runPlayoutOperationWithLockFromStudioOperation,
} from '../playout/lockFunction'
import { Meteor } from 'meteor/meteor'
import { runStudioOperationWithLock } from '../studio/lockFunction'

export type BeforePartMap = ReadonlyMap<SegmentId, Array<{ id: PartId; rank: number }>>

/**
 * Post-process some ingest changes.
 * This is designed to be the same block of code after any ingest change. The aim is to be able to run it once after a batch of ingest changes
 * @param ingestCache The cache for the rundown that has been changed
 * @param beforeRundown The rundown before the batch of ingest operations
 * @param beforePartMap The segments and partIds before the batch of ingest operations
 * @param data Information about the ingest changes performed
 */
export async function CommitIngestOperation(
	ingestCache: CacheForIngest,
	beforeRundown: ReadonlyDeep<Rundown> | undefined,
	beforePartMap: BeforePartMap,
	data: ReadonlyDeep<CommitIngestData>
): Promise<void> {
	const rundown = getRundown(ingestCache)

	if (data.removeRundown && !beforeRundown) {
		// Fresh rundown that was instantly deleted. Discard everything and pretend it never happened
		ingestCache.discardChanges()
		return
	}

	const showStyle = data.showStyle ?? (await getShowStyleCompoundForRundown(rundown))
	const blueprint = (data.showStyle ? data.blueprint : undefined) ?? loadShowStyleBlueprint(showStyle)

	const targetPlaylistId: [RundownPlaylistId, string] = (beforeRundown?.playlistIdIsSetInSofie
		? [beforeRundown.playlistId, beforeRundown.externalId]
		: undefined) ?? [
		getPlaylistIdFromExternalId(
			ingestCache.Studio.doc._id,
			rundown.playlistExternalId ?? unprotectString(rundown._id)
		),
		rundown.playlistExternalId ?? unprotectString(rundown._id),
	]

	// Free the rundown from its old playlist, if it is moving
	let trappedInPlaylistId: [RundownPlaylistId, string] | undefined
	if (beforeRundown?.playlistId && (beforeRundown.playlistId !== targetPlaylistId[0] || data.removeRundown)) {
		const beforePlaylistId = beforeRundown.playlistId
		runPlayoutOperationWithLock(
			null,
			'ingest.commit.removeRundownFromOldPlaylist',
			beforePlaylistId,
			RundownSyncFunctionPriority.INGEST,
			async (oldPlaylistLock) => {
				// Aquire the playout lock so we can safely modify the playlist contents

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
						},
					})

					if (data.removeRundown) {
						// Orphan the deleted rundown
						ingestCache.Rundown.update({
							$set: {
								orphaned: 'deleted',
							},
						})
					} else {
						// The rundown is still synced, but is in the wrong playlist. Notify the user
						ingestCache.Rundown.update({
							$set: {
								notes: [
									...clone<RundownNote[]>(rundown.notes ?? []),
									{
										type: NoteType.WARNING,
										message: {
											// TODO-CACHE - translate
											key:
												'The Rundown was attempted to be moved out of the Playlist when it was on Air. Move it back and try again later.',
										},
										origin: {
											name: 'Data update',
										},
									},
								],
							},
						})
					}
				} else {
					// The rundown is safe to simply move or remove
					trappedInPlaylistId = undefined

					// Quickly move the rundown out of the playlist, so we an free the old playlist lock sooner
					Rundowns.update(ingestCache.RundownId, {
						$set: {
							playlistId: protectString('__TMP__'),
						},
					})

					if (playlist) {
						// ensure the 'old' playout is updated to remove any references to the rundown
						updatePlayoutAfterChangingRundownInPlaylist(
							playlist,
							oldPlaylistLock,
							null,
							showStyle,
							blueprint
						)
					}
				}
			}
		)
	}

	// Rundown needs to be removed, and has been removed its old playlist, so we can now do the discard
	if (data.removeRundown && !trappedInPlaylistId) {
		// It was removed from the playlist just above us, so this can simply discard the contents
		ingestCache.discardChanges()
		await removeRundownsFromDb([ingestCache.RundownId])
		return
	}

	// Adopt the rundown into its new/retained playlist.
	// We have to do the locking 'manually' because the playlist may not exist yet, but that is ok
	const newPlaylistId: [RundownPlaylistId, string] = trappedInPlaylistId ?? targetPlaylistId
	let tmpNewPlaylist: RundownPlaylist | undefined = RundownPlaylists.findOne(newPlaylistId[0])
	if (tmpNewPlaylist) {
		if (tmpNewPlaylist.studioId !== ingestCache.Studio.doc._id)
			throw new Meteor.Error(404, `Rundown Playlist "${newPlaylistId[0]}" exists but belongs to another studio!`)
	}
	runStudioOperationWithLock('ingest.commit.saveRundownToPlaylist', ingestCache.Studio.doc._id, (studioLock) =>
		runPlayoutOperationWithLockFromStudioOperation(
			'ingest.commit.saveRundownToPlaylist',
			studioLock,
			{ _id: newPlaylistId[0], studioId: studioLock._studioId },
			RundownSyncFunctionPriority.INGEST,
			async (lock) => {
				//
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

				// Regenerate the full list of expected*Items
				updateExpectedMediaItemsOnRundown(ingestCache)
				updateExpectedPlayoutItemsOnRundown(ingestCache)

				// Save the rundowns
				// This will reorder the rundowns a little before the playlist and the contents, but that is ok
				await Promise.all([
					rundownsCollection.updateDatabaseWithData(),
					asyncCollectionUpsert(RundownPlaylists, newPlaylist._id, newPlaylist),
				])

				// Create the full playout cache, now we have the rundowns and playlist updated
				const playoutCache = await CacheForPlayout.from(
					newPlaylist,
					rundownsCollection.findFetch({}),
					ingestCache
				)

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
	newRundown: ReadonlyDeep<Rundown> | null,
	showStyle: ReadonlyDeep<ShowStyleCompound>,
	blueprint: ReadonlyDeep<WrappedShowStyleBlueprint>,
	renamedSegments: ReadonlyMap<SegmentId, SegmentId>,
	changedSegmentsInfo: ChangedSegmentsRankInfo
) {
	if (newRundown) {
		// If a rundown has changes, ensure instances are updated
		updatePartInstancesBasicProperties(playoutCache, newRundown._id, renamedSegments)
	}

	updatePartInstanceRanks(playoutCache, changedSegmentsInfo)

	ensureNextPartIsValid(playoutCache)

	if (ingestCache && newRundown) {
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

export function updatePlayoutAfterChangingRundownInPlaylist(
	playlist: RundownPlaylist,
	playlistLock: PlaylistLock,
	newRundown: ReadonlyDeep<Rundown> | null,
	showStyle: ReadonlyDeep<ShowStyleCompound> | undefined,
	blueprint: ReadonlyDeep<WrappedShowStyleBlueprint> | undefined
) {
	// ensure the 'old' playout is updated to remove any references to the rundown
	runPlayoutOperationWithCacheFromStudioOperation(
		'updatePlayoutAfterChangingRundownInPlaylist',
		playlistLock,
		playlist,
		null,
		async (playoutCache) => {
			if (playoutCache.Rundowns.documents.size === 0) {
				if (playoutCache.Playlist.doc.activationId)
					throw new Meteor.Error(
						500,
						`RundownPlaylist "${playoutCache.PlaylistId}" has no contents but is active...`
					)
				// Remove an empty playlist
				await asyncCollectionRemove(RundownPlaylists, { _id: playoutCache.PlaylistId })
				playoutCache.assertNoChanges()
			} else if (playoutCache.Playlist.doc.activationId) {
				const { currentPartInstance, nextPartInstance } = getSelectedPartInstancesFromCache(playoutCache)
				const targetRundownId = currentPartInstance?.rundownId ?? nextPartInstance?.rundownId

				// Find the active rundown, or just the first
				const rundown2 = playoutCache.Rundowns.findOne(targetRundownId)
				if (rundown2) {
					const showStyle2 = showStyle ?? (await playoutCache.activationCache.getShowStyleCompound(rundown2))
					const blueprint2 = (showStyle && blueprint ? blueprint : null) ?? loadShowStyleBlueprint(showStyle2)

					applyChangesToPlayout(playoutCache, null, newRundown, showStyle2, blueprint2, new Map(), [])
				}
			}
		}
	)
}
