import { SegmentId, PartId, RundownPlaylistId, RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { RundownNote, NoteType } from '@sofie-automation/corelib/dist/dataModel/Notes'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { unprotectString, protectString } from '@sofie-automation/corelib/dist/protectedString'
import { loadShowStyleBlueprint, loadStudioBlueprint } from '../blueprints/cache'
import { DbCacheWriteCollection } from '../cache/CacheCollection'
import { logger } from '../logging'
import { CacheForPlayout } from '../playout/cache'
import { isTooCloseToAutonext } from '../playout/lib'
import { allowedToMoveRundownOutOfPlaylist, updatePartInstanceRanks } from '../rundown'
import { getPlaylistIdFromExternalId, removeRundownsFromDb } from '../rundownPlaylists'
import { ReadonlyDeep } from 'type-fest'
import { CacheForIngest } from './cache'
import { getRundown } from './lib'
import { JobContext } from '../jobs'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { runAsPlayoutLock } from '../playout/lock'
import { removeSegmentContents } from './cleanup'
import { CommitIngestData } from './lock'
import { clone } from '@sofie-automation/corelib/dist/lib'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { PlaylistLock } from '../jobs/lock'
import { syncChangesToPartInstances } from './syncChangesToPartInstance'

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
	context: JobContext,
	ingestCache: CacheForIngest,
	beforeRundown: ReadonlyDeep<DBRundown> | undefined,
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
	const blueprint =
		(data.showStyle ? data.blueprint : undefined) ??
		(await loadShowStyleBlueprint(context.directCollections, showStyle))

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
		await runAsPlayoutLock(
			context,
			// 'ingest.commit.removeRundownFromOldPlaylist',
			{ playlistId: beforePlaylistId },
			async (oldPlaylist, oldPlaylistLock) => {
				// Aquire the playout lock so we can safely modify the playlist contents

				if (oldPlaylist && !(await allowedToMoveRundownOutOfPlaylist(context, oldPlaylist, rundown))) {
					// Don't allow removing currently playing rundown playlists:
					logger.warn(
						`Not allowing removal of currently playing rundown "${rundown._id}", making it unsynced instead`
					)

					// Discard proposed playlistId changes
					trappedInPlaylistId = [oldPlaylist._id, oldPlaylist.externalId]
					ingestCache.Rundown.update({
						$set: {
							playlistId: oldPlaylist._id,
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
										message: getTranslatedMessage(
											ServerTranslatedMesssages.PLAYLIST_ON_AIR_CANT_MOVE_RUNDOWN
										),
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
					await context.directCollections.Rundowns.update(ingestCache.RundownId, {
						$set: {
							playlistId: protectString('__TMP__'),
						},
					})

					if (oldPlaylist) {
						// Ensure playlist is regenerated
						const updatedOldPlaylist = await regeneratePlaylistAndRundownOrder(
							ingestCache.Studio.doc,
							oldPlaylist
						)

						if (updatedOldPlaylist) {
							// ensure the 'old' playout is updated to remove any references to the rundown
							await updatePlayoutAfterChangingRundownInPlaylist(updatedOldPlaylist, oldPlaylistLock, null)
						}
					}
				}
			}
		)
	}

	// Rundown needs to be removed, and has been removed its old playlist, so we can now do the discard
	if (data.removeRundown && !trappedInPlaylistId) {
		// It was removed from the playlist just above us, so this can simply discard the contents
		ingestCache.discardChanges()
		await removeRundownsFromDb(context, [ingestCache.RundownId])
		return
	}

	// Adopt the rundown into its new/retained playlist.
	// We have to do the locking 'manually' because the playlist may not exist yet, but that is ok
	const newPlaylistId: [RundownPlaylistId, string] = trappedInPlaylistId ?? targetPlaylistId
	{
		// Check the new playlist belongs to the same studio
		const tmpNewPlaylist: Pick<DBRundownPlaylist, 'studioId'> | undefined =
			await context.directCollections.RundownPlaylists.findOne(newPlaylistId[0], {
				projection: {
					studioId: 1,
				},
			})
		if (tmpNewPlaylist) {
			if (tmpNewPlaylist.studioId !== ingestCache.Studio.doc._id)
				throw new Error(`Rundown Playlist "${newPlaylistId[0]}" exists but belongs to another studio!`)
		}
	}

	await runAsPlayoutLock(
		context,
		// 'ingest.commit.saveRundownToPlaylist',
		{ playlistId: newPlaylistId[0] },
		async (_, playlistLock) => {
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

				const emptySegmentIds = context.settings.preserveUnsyncedPlayingSegmentContents
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

			// Regenerate the full list of expected*Items / packages
			updateExpectedPackagesOnRundown(ingestCache)

			// Save the rundowns and regenerated playlist
			// This will reorder the rundowns a little before the playlist and the contents, but that is ok
			await Promise.all([
				rundownsCollection.updateDatabaseWithData(),
				context.directCollections.RundownPlaylists.replace(newPlaylist),
			])

			// Create the full playout cache, now we have the rundowns and playlist updated
			const playoutCache = await CacheForPlayout.fromIngest(
				context,
				playlistLock,
				newPlaylist,
				rundownsCollection.findFetch({}),
				ingestCache
			)

			// Start the save
			const pSaveIngest = ingestCache.saveAllToDatabase()

			try {
				// Get the final copy of the rundown
				const newRundown = getRundown(ingestCache)

				// Update the playout to use the updated rundown
				const changedSegmentsInfo = data.changedSegmentIds.map((id) => ({
					segmentId: id,
					oldPartIdsAndRanks: beforePartMap.get(id) ?? [],
				}))

				// ensure instances are updated for rundown changes
				updatePartInstancesBasicProperties(playoutCache, newRundown._id, data.renamedSegments)

				updatePartInstanceRanks(playoutCache, changedSegmentsInfo)

				// sync changes to the 'selected' partInstances
				await syncChangesToPartInstances(
					context,
					playoutCache,
					ingestCache,
					showStyle,
					blueprint.blueprint,
					newRundown
				)

				playoutCache.deferAfterSave(() => {
					// Run in the background, we don't want to hold onto the lock to do this
					Meteor.setTimeout(() => {
						reportRundownDataHasChanged(playoutCache.Playlist.doc, newRundown)
					}, LOW_PRIO_DEFER_TIME)

					triggerUpdateTimelineAfterIngestData(playoutCache.PlaylistId)
				})

				// wait for the ingest changes to save
				await pSaveIngest

				// do some final playout checks, which may load back some Parts data
				await ensureNextPartIsValid(playoutCache)

				// save the final playout changes
				await playoutCache.saveAllToDatabase()
			} finally {
				// Wait for the save to complete. We need it to be completed, otherwise the rundown will be in a broken state
				await pSaveIngest
			}
		}
	)
}

async function generatePlaylistAndRundownsCollection(
	ingestCache: CacheForIngest,
	newPlaylistId: RundownPlaylistId,
	newPlaylistExternalId: string
): Promise<[DBRundownPlaylist, DbCacheWriteCollection<DBRundown>]> {
	// Load existing playout data
	const finalRundown = getRundown(ingestCache)

	const result = await generatePlaylistAndRundownsCollectionInner(
		ingestCache.Studio.doc,
		finalRundown,
		newPlaylistId,
		newPlaylistExternalId
	)

	if (!result) {
		throw new Error(`RundownPlaylist had no rundowns, even though ingest created one`)
	}

	const [newPlaylist, rundownsCollection] = result

	// Update the ingestCache to keep them in sync
	const updatedRundown = rundownsCollection.findOne(ingestCache.RundownId)
	if (updatedRundown) {
		ingestCache.Rundown.update((r) => {
			r._rank = updatedRundown._rank
			return r
		})
	}

	return [newPlaylist, rundownsCollection]
}

async function generatePlaylistAndRundownsCollectionInner(
	studio: ReadonlyDeep<DBStudio>,
	changedRundown: ReadonlyDeep<DBRundown> | undefined,
	newPlaylistId: RundownPlaylistId,
	newPlaylistExternalId: string,
	existingPlaylist0?: ReadonlyDeep<DBRundownPlaylist>,
	existingRundownsCollection?: DbCacheWriteCollection<DBRundown>
): Promise<[DBRundownPlaylist, DbCacheWriteCollection<DBRundown>] | null> {
	if (existingPlaylist0) {
		if (existingPlaylist0._id !== newPlaylistId) {
			throw new Error(
				`ingest.generatePlaylistAndRundownsCollection requires existingPlaylist0("${existingPlaylist0._id}") newPlaylistId("${newPlaylistId}") to be the same`
			)
		}
		if (existingPlaylist0.externalId !== newPlaylistExternalId) {
			throw new Error(
				`ingest.generatePlaylistAndRundownsCollection requires existingPlaylist0("${existingPlaylist0.externalId}") newPlaylistExternalId("${newPlaylistExternalId}") to be the same`
			)
		}
	}

	// Load existing playout data
	const [existingPlaylist, studioBlueprint, rundownsCollection] = await Promise.all([
		existingPlaylist0
			? existingPlaylist0
			: (RundownPlaylists.findOneAsync(newPlaylistId) as Promise<ReadonlyDeep<RundownPlaylist>>),
		loadStudioBlueprint(studio),
		existingRundownsCollection ??
			DbCacheWriteCollection.createFromDatabase(Rundowns, { playlistId: newPlaylistId }),
	])
	if (changedRundown) {
		rundownsCollection.replace(changedRundown)
	}
	const changedRundownId = changedRundown?._id

	const allRundowns = rundownsCollection.findFetch({})
	if (allRundowns.length > 0) {
		// Skip the update, if there are no rundowns left
		// Generate the new playlist, and ranks for the rundowns
		const { rundownPlaylist: newPlaylist, order: newRundownOrder } = produceRundownPlaylistInfoFromRundown(
			studio,
			studioBlueprint,
			existingPlaylist,
			newPlaylistId,
			newPlaylistExternalId,
			allRundowns
		)
		// Update the ranks of the rundowns
		if (!newPlaylist.rundownRanksAreSetInSofie) {
			// Update the rundown ranks
			for (const [id, rank] of Object.entries(newRundownOrder)) {
				const id2 = protectString(id)
				rundownsCollection.update(id2, { $set: { _rank: rank } })
			}
		} else if (changedRundownId) {
			// This rundown is new, so push to the end of the manually ordered playlist
			const otherRundowns = rundownsCollection.findFetch((r) => r._id !== changedRundownId)
			const last = max(otherRundowns, (r) => r._rank)?._rank ?? -1
			rundownsCollection.update(changedRundownId, { $set: { _rank: last + 1 } })
		}

		return [newPlaylist, rundownsCollection]
	} else {
		return null
	}
}

function canRemoveSegment(
	currentPartInstance: ReadonlyDeep<DBPartInstance> | undefined,
	nextPartInstance: ReadonlyDeep<DBPartInstance> | undefined,
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
				cache.PieceInstances.update((p) => p.partInstanceId === partInstance._id, { $set: { reset: true } })
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

/**
 * Regenerate the supplied rundown playlist and update the order of its rundowns (if not manual)
 * This saves directly to the db (or to the supplied cache collection)
 */
export async function regeneratePlaylistAndRundownOrder(
	studio: ReadonlyDeep<DBStudio>,
	oldPlaylist: ReadonlyDeep<DBRundownPlaylist>,
	existingRundownsCollection?: DbCacheWriteCollection<DBRundown>
): Promise<DBRundownPlaylist | null> {
	const result = await generatePlaylistAndRundownsCollectionInner(
		studio,
		undefined,
		oldPlaylist._id,
		oldPlaylist.externalId,
		oldPlaylist,
		existingRundownsCollection
	)

	if (result) {
		const [newPlaylist, rundownsCollection] = result

		// Save the changes
		await Promise.all([
			!existingRundownsCollection ? rundownsCollection.updateDatabaseWithData() : null,
			RundownPlaylists.upsertAsync(newPlaylist._id, newPlaylist),
		])

		return newPlaylist
	} else {
		// Playlist is empty and should be removed
		await RundownPlaylists.removeAsync(oldPlaylist._id)

		return null
	}
}

/**
 * Ensure that the playlist triggers a playout update if it is active
 */
export async function updatePlayoutAfterChangingRundownInPlaylist(
	playlist: DBRundownPlaylist,
	playlistLock: PlaylistLock,
	insertedRundown: ReadonlyDeep<DBRundown> | null
): Promise<void> {
	// ensure the 'old' playout is updated to remove any references to the rundown
	return runPlayoutOperationWithCacheFromStudioOperation(
		'updatePlayoutAfterChangingRundownInPlaylist',
		playlistLock,
		playlist,
		PlayoutLockFunctionPriority.USER_PLAYOUT,
		null,
		async (playoutCache) => {
			if (playoutCache.Rundowns.documents.size === 0) {
				if (playoutCache.Playlist.doc.activationId)
					throw new Meteor.Error(
						500,
						`RundownPlaylist "${playoutCache.PlaylistId}" has no contents but is active...`
					)
				// Remove an empty playlist
				await RundownPlaylists.removeAsync({ _id: playoutCache.PlaylistId })
				playoutCache.assertNoChanges()
				return
			}

			// Ensure playout is in sync

			if (insertedRundown) {
				// If a rundown has changes, ensure instances are updated
				updatePartInstancesBasicProperties(playoutCache, insertedRundown._id, new Map())
			}

			await ensureNextPartIsValid(playoutCache)

			if (playoutCache.Playlist.doc.activationId) {
				triggerUpdateTimelineAfterIngestData(playoutCache.PlaylistId)
			}
		}
	)
}
