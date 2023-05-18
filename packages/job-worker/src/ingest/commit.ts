import {
	SegmentId,
	PartId,
	RundownPlaylistId,
	RundownId,
	PartInstanceId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { unprotectString, protectString } from '@sofie-automation/corelib/dist/protectedString'
import { DbCacheReadCollection } from '../cache/CacheCollection'
import { logger } from '../logging'
import { CacheForPlayout } from '../playout/cache'
import { isTooCloseToAutonext } from '../playout/lib'
import { allowedToMoveRundownOutOfPlaylist, updatePartInstanceRanks } from '../rundown'
import {
	getPlaylistIdFromExternalId,
	produceRundownPlaylistInfoFromRundown,
	removeRundownFromDb,
} from '../rundownPlaylists'
import { ReadonlyDeep } from 'type-fest'
import { CacheForIngest } from './cache'
import { getRundown } from './lib'
import { JobContext } from '../jobs'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { runJobWithPlaylistLock, runWithPlaylistCache } from '../playout/lock'
import { removeSegmentContents } from './cleanup'
import { CommitIngestData } from './lock'
import { normalizeArrayToMap } from '@sofie-automation/corelib/dist/lib'
import { PlaylistLock } from '../jobs/lock'
import { syncChangesToPartInstances } from './syncChangesToPartInstance'
import { ensureNextPartIsValid } from './updateNext'
import { updateExpectedPackagesOnRundown } from './expectedPackages'
import { StudioJobs } from '@sofie-automation/corelib/dist/worker/studio'
import { getTranslatedMessage, ServerTranslatedMesssages } from '../notes'
import _ = require('underscore')
import { EventsJobs } from '@sofie-automation/corelib/dist/worker/events'
import { NoteSeverity } from '@sofie-automation/blueprints-integration'
import {
	DBSegment,
	orphanedHiddenSegmentPropertiesToPreserve,
	SegmentOrphanedReason,
} from '@sofie-automation/corelib/dist/dataModel/Segment'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { UserError, UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import { IMongoTransaction } from '../db'

export type BeforePartMapItem = { id: PartId; rank: number }
export type BeforePartMap = ReadonlyMap<SegmentId, Array<BeforePartMapItem>>

interface PlaylistIdPair {
	id: RundownPlaylistId
	/** The externalId of the playlist. This may only be null when there is a playlist being regenerated */
	externalId: string | null
}

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
): Promise<UserError | void> {
	const rundown = getRundown(ingestCache)

	if (data.removeRundown && !beforeRundown) {
		// Fresh rundown that was instantly deleted. Discard everything and pretend it never happened
		ingestCache.discardChanges()
		return
	}

	const targetPlaylistId: PlaylistIdPair = (beforeRundown?.playlistIdIsSetInSofie
		? {
				id: beforeRundown.playlistId,
				externalId: null, // The id on the Rundown is not correct
		  }
		: undefined) ?? {
		id: getPlaylistIdFromExternalId(context.studioId, rundown.playlistExternalId ?? unprotectString(rundown._id)),
		externalId: rundown.playlistExternalId ?? unprotectString(rundown._id),
	}

	// Free the rundown from its old playlist, if it is moving
	let trappedInPlaylistId: PlaylistIdPair | undefined
	if (beforeRundown?.playlistId && (beforeRundown.playlistId !== targetPlaylistId.id || data.removeRundown)) {
		const beforePlaylistId = beforeRundown.playlistId
		await runJobWithPlaylistLock(
			context,
			{ playlistId: beforePlaylistId },
			async (oldPlaylist, oldPlaylistLock) => {
				// Aquire the playout lock so we can safely modify the playlist contents

				if (oldPlaylist && !allowedToMoveRundownOutOfPlaylist(oldPlaylist, rundown)) {
					// Don't allow removing currently playing rundown playlists:
					logger.warn(
						`Not allowing removal of currently playing rundown "${rundown._id}" from playlist "${beforePlaylistId}"`
					)

					// Discard proposed playlistId changes
					trappedInPlaylistId = { id: oldPlaylist._id, externalId: oldPlaylist.externalId }
					setRundownAsTrapepdInPlaylist(ingestCache, oldPlaylist._id, data.removeRundown)
				} else {
					// The rundown is safe to simply move or remove
					trappedInPlaylistId = undefined

					await removeRundownFromPlaylistAndUpdatePlaylist(
						context,
						ingestCache.RundownId,
						oldPlaylist,
						oldPlaylistLock
					)
				}
			}
		)
	}

	// Rundown needs to be removed, and has been removed its old playlist, so we can now do the discard
	if (data.removeRundown && !trappedInPlaylistId) {
		// It was removed from the playlist just above us, so this can simply discard the contents
		ingestCache.discardChanges()
		await context.directCollections.runInTransaction(async (transaction) => {
			await removeRundownFromDb(context, ingestCache.RundownLock, transaction)
		})
		return
	}

	// Adopt the rundown into its new/retained playlist.
	// We have to do the locking 'manually' because the playlist may not exist yet, but that is ok
	const newPlaylistId: PlaylistIdPair = trappedInPlaylistId ?? targetPlaylistId
	{
		// Check the new playlist belongs to the same studio
		const tmpNewPlaylist: Pick<DBRundownPlaylist, 'studioId'> | undefined =
			await context.directCollections.RundownPlaylists.findOne(newPlaylistId.id, {
				projection: {
					studioId: 1,
				},
			})
		if (tmpNewPlaylist) {
			if (tmpNewPlaylist.studioId !== context.studioId)
				throw new Error(`Rundown Playlist "${newPlaylistId.id}" exists but belongs to another studio!`)
		}
	}

	await runJobWithPlaylistLock(
		context,
		// 'ingest.commit.saveRundownToPlaylist',
		{ playlistId: newPlaylistId.id },
		async (oldPlaylist, playlistLock) => {
			// Ensure the rundown has the correct playlistId
			ingestCache.Rundown.update((rd) => {
				rd.playlistId = newPlaylistId.id
				return rd
			})

			const finalRundown = getRundown(ingestCache)

			// Load existing playout data
			const rundownsInPlaylist: Array<ReadonlyDeep<DBRundown>> =
				await context.directCollections.Rundowns.findFetch({
					playlistId: newPlaylistId.id,
					_id: { $ne: finalRundown._id },
				})
			rundownsInPlaylist.push(finalRundown)

			// Skip the update, if there are no rundowns left
			// Generate the new playlist, and ranks for the rundowns
			const newPlaylist = produceRundownPlaylistInfoFromRundown(
				context,
				context.studioBlueprint,
				oldPlaylist,
				newPlaylistId.id,
				newPlaylistId.externalId ?? unprotectString(finalRundown._id),
				rundownsInPlaylist
			)

			// Do the segment removals
			await removeSegments(
				context,
				newPlaylist,
				rundownsInPlaylist,
				ingestCache,
				data.changedSegmentIds,
				data.removedSegmentIds
			)

			// Regenerate the full list of expected*Items / packages
			await updateExpectedPackagesOnRundown(context, ingestCache)

			await context.directCollections.runInTransaction(async (transaction) => {
				// Save the rundowns and regenerated playlist
				// This will reorder the rundowns a little before the playlist and the contents, but that is ok
				await context.directCollections.RundownPlaylists.replace(newPlaylist, transaction)
				// ensure instances are updated for rundown changes
				await updatePartInstancesSegmentIds(context, ingestCache, transaction, data.renamedSegments)
				await updatePartInstancesBasicProperties(
					context,
					transaction,
					ingestCache.Parts,
					ingestCache.RundownId,
					newPlaylist
				)

				// Update the playout to use the updated rundown
				await updatePartInstanceRanks(context, ingestCache, transaction, data.changedSegmentIds, beforePartMap)
			})

			// Create the full playout cache, now we have the rundowns and playlist updated
			const playoutCache = await CacheForPlayout.fromIngest(
				context,
				playlistLock,
				newPlaylist,
				rundownsInPlaylist,
				ingestCache
			)

			// Start the save
			const pSaveIngest = ingestCache.saveAllToDatabase()
			pSaveIngest.catch(() => null) // Ensure promise isn't reported as unhandled

			try {
				// sync changes to the 'selected' partInstances
				await syncChangesToPartInstances(context, playoutCache, ingestCache)

				playoutCache.deferAfterSave(() => {
					// Run in the background, we don't want to hold onto the lock to do this
					context
						.queueEventJob(EventsJobs.RundownDataChanged, {
							playlistId: playoutCache.PlaylistId,
							rundownId: ingestCache.RundownId,
						})
						.catch((e) => {
							logger.error(`Queue RundownDataChanged failed: ${e}`)
						})

					triggerUpdateTimelineAfterIngestData(context, playoutCache.PlaylistId)
				})

				// wait for the ingest changes to save
				await pSaveIngest

				// do some final playout checks, which may load back some Parts data
				await ensureNextPartIsValid(context, playoutCache)

				// save the final playout changes
				await playoutCache.saveAllToDatabase()
			} finally {
				// Wait for the save to complete. We need it to be completed, otherwise the rundown will be in a broken state
				await pSaveIngest
			}
		}
	)

	// Some failures should be reported to the caller
	if (data.removeRundown && data.returnRemoveFailure) {
		return UserError.create(UserErrorMessage.RundownRemoveWhileActive, { name: rundown.name })
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
 * Update the segmentId property for any PartInstances following any segments being 'renamed'
 * @param cache Ingest cache
 * @param renamedSegments Map of <fromSegmentId, toSegmentId>
 */
async function updatePartInstancesSegmentIds(
	context: JobContext,
	cache: CacheForIngest,
	transaction: IMongoTransaction,
	renamedSegments: ReadonlyMap<SegmentId, SegmentId>
) {
	// A set of rules which can be translated to mongo queries for PartInstances to update
	const renameRules = new Map<
		SegmentId,
		{
			partIds: PartId[]
			fromSegmentId: SegmentId | null
		}
	>()

	// Add whole segment renames to the set of rules
	for (const [fromSegmentId, toSegmentId] of renamedSegments) {
		const rule = renameRules.get(toSegmentId) ?? { partIds: [], fromSegmentId: null }
		renameRules.set(toSegmentId, rule)

		rule.fromSegmentId = fromSegmentId
	}

	// Some parts may have gotten a different segmentId to the base rule, so track those seperately in the rules
	for (const [id, doc] of cache.Parts.documents) {
		if (doc?.updated) {
			const rule = renameRules.get(doc.document.segmentId) ?? { partIds: [], fromSegmentId: null }
			renameRules.set(doc.document.segmentId, rule)

			rule.partIds.push(id)
		}
	}

	// Perform a mongo update to modify the PartInstances
	if (renameRules.size > 0) {
		await context.directCollections.PartInstances.bulkWrite(
			Array.from(renameRules.entries()).map(([newSegmentId, rule]) => ({
				updateMany: {
					filter: {
						$or: _.compact([
							rule.fromSegmentId
								? {
										segmentId: rule.fromSegmentId,
								  }
								: undefined,
							{
								'part._id': { $in: rule.partIds },
							},
						]),
					},
					update: {
						$set: {
							segmentId: newSegmentId,
							'part.segmentId': newSegmentId,
						},
					},
				},
			})),
			transaction
		)
	}
}

/**
 * Ensure some 'basic' PartInstances properties are in sync with their parts
 */
async function updatePartInstancesBasicProperties(
	context: JobContext,
	transaction: IMongoTransaction,
	partCache: DbCacheReadCollection<DBPart>,
	rundownId: RundownId,
	playlist: ReadonlyDeep<DBRundownPlaylist>
) {
	// Get a list of all the Parts that are known to exist
	const knownPartIds = partCache.findAll(null).map((p) => p._id)

	// Find all the partInstances which are not reset, and are not orphaned, but their Part no longer exist (ie they should be orphaned)
	const partInstancesToOrphan: Array<Pick<DBPartInstance, '_id'>> =
		await context.directCollections.PartInstances.findFetch(
			{
				reset: { $ne: true },
				rundownId: rundownId,
				orphaned: { $exists: false },
				'part._id': { $nin: knownPartIds },
			},
			{ projection: { _id: 1 } },
			transaction
		)

	// Figure out which of the PartInstances should be reset and which should be marked as orphaned: deleted
	const instancesToReset: PartInstanceId[] = []
	const instancesToOrphan: PartInstanceId[] = []
	for (const partInstance of partInstancesToOrphan) {
		if (
			playlist.currentPartInfo?.partInstanceId !== partInstance._id &&
			playlist.nextPartInfo?.partInstanceId !== partInstance._id
		) {
			instancesToReset.push(partInstance._id)
		} else {
			instancesToOrphan.push(partInstance._id)
		}
	}

	const ps: Array<Promise<any>> = []

	if (instancesToReset.length) {
		ps.push(
			context.directCollections.PartInstances.update(
				{
					_id: { $in: instancesToReset },
				},
				{
					$set: {
						reset: true,
					},
				},
				transaction
			)
		)
		ps.push(
			context.directCollections.PieceInstances.update(
				{
					partInstanceId: { $in: instancesToReset },
				},
				{
					$set: {
						reset: true,
					},
				},
				transaction
			)
		)
	}
	if (instancesToOrphan.length) {
		ps.push(
			context.directCollections.PartInstances.update(
				{
					_id: { $in: instancesToOrphan },
				},
				{
					$set: {
						orphaned: 'deleted',
					},
				},
				transaction
			)
		)
	}

	await Promise.all([ps])
}

/**
 * Regenerate the supplied rundown playlist and update the order of its rundowns (if not manual)
 * This saves directly to the db (or to the supplied cache collection)
 */
export async function regeneratePlaylistAndRundownOrder(
	context: JobContext,
	lock: PlaylistLock,
	transaction: IMongoTransaction,
	oldPlaylist: ReadonlyDeep<DBRundownPlaylist>,
	existingRundowns?: DBRundown[]
): Promise<DBRundownPlaylist | null> {
	// ensure the lock is held for the correct playlist
	if (lock.playlistId !== oldPlaylist._id)
		throw new Error(`Lock is for wrong playlist. Holding "${lock.playlistId}", need "${oldPlaylist._id}"`)

	const allRundowns =
		existingRundowns ??
		(await context.directCollections.Rundowns.findFetch({ playlistId: oldPlaylist._id }, undefined, transaction))

	if (allRundowns.length > 0) {
		// Skip the update, if there are no rundowns left
		// Generate the new playlist, and ranks for the rundowns
		const newPlaylist = produceRundownPlaylistInfoFromRundown(
			context,
			context.studioBlueprint,
			oldPlaylist,
			oldPlaylist._id,
			oldPlaylist.externalId,
			allRundowns
		)

		// Save the changes
		await context.directCollections.RundownPlaylists.replace(newPlaylist, transaction)

		return newPlaylist
	} else {
		// Playlist is empty and should be removed
		await context.directCollections.RundownPlaylists.remove(oldPlaylist._id, transaction)

		return null
	}
}

/**
 * Ensure that the playlist triggers a playout update if it is active
 */
export async function updatePlayoutAfterChangingRundownInPlaylist(
	context: JobContext,
	playlist: DBRundownPlaylist,
	playlistLock: PlaylistLock,
	transaction: IMongoTransaction,
	insertedRundown: ReadonlyDeep<DBRundown> | null
): Promise<void> {
	// ensure the 'old' playout is updated to remove any references to the rundown
	await runWithPlaylistCache(
		context,
		playlist,
		playlistLock,
		null,
		async (playoutCache) => {
			if (playoutCache.Rundowns.documents.size === 0) {
				if (playoutCache.Playlist.doc.activationId)
					throw new Error(`RundownPlaylist "${playoutCache.PlaylistId}" has no contents but is active...`)

				// Remove an empty playlist
				await context.directCollections.RundownPlaylists.remove({ _id: playoutCache.PlaylistId }, transaction)

				playoutCache.assertNoChanges()
				return
			}

			// Ensure playout is in sync

			if (insertedRundown) {
				// If a rundown has changes, ensure instances are updated
				await updatePartInstancesBasicProperties(
					context,
					transaction,
					playoutCache.Parts,
					insertedRundown._id,
					playoutCache.Playlist.doc
				)
			}

			await ensureNextPartIsValid(context, playoutCache)

			if (playoutCache.Playlist.doc.activationId) {
				triggerUpdateTimelineAfterIngestData(context, playoutCache.PlaylistId)
			}
		},
		transaction
	)
}

interface UpdateTimelineFromIngestDataTimeout {
	timeout?: NodeJS.Timeout
}
const updateTimelineFromIngestDataTimeouts = new Map<RundownPlaylistId, UpdateTimelineFromIngestDataTimeout>()
export function triggerUpdateTimelineAfterIngestData(context: JobContext, playlistId: RundownPlaylistId): void {
	if (process.env.JEST_WORKER_ID) {
		// Don't run this when in jest, as it is not useful and ends up producing errors
		return
	}

	// Future: this should be workqueue backed, not in-memory
	// Lock behind a timeout, so it doesnt get executed loads when importing a rundown or there are large changes
	const data = updateTimelineFromIngestDataTimeouts.get(playlistId) ?? {}
	if (data.timeout) clearTimeout(data.timeout)

	data.timeout = setTimeout(() => {
		if (updateTimelineFromIngestDataTimeouts.delete(playlistId)) {
			context
				.queueStudioJob(StudioJobs.UpdateTimelineAfterIngest, {
					playlistId,
				})
				.catch((e) => {
					logger.error(`triggerUpdateTimelineAfterIngestData: Execution failed: ${e}`)
				})
		}
	}, 1000)

	updateTimelineFromIngestDataTimeouts.set(playlistId, data)
}

async function getSelectedPartInstances(
	context: JobContext,
	playlist: DBRundownPlaylist,
	rundownIds: Array<RundownId>
) {
	const ids = _.compact([
		playlist.currentPartInfo?.partInstanceId,
		playlist.previousPartInfo?.partInstanceId,
		playlist.nextPartInfo?.partInstanceId,
	])

	const instances =
		ids.length > 0
			? await context.directCollections.PartInstances.findFetch({
					rundownId: { $in: rundownIds },
					_id: { $in: ids },
					reset: { $ne: true },
			  })
			: []

	return {
		currentPartInstance: instances.find((inst) => inst._id === playlist.currentPartInfo?.partInstanceId),
		nextPartInstance: instances.find((inst) => inst._id === playlist.nextPartInfo?.partInstanceId),
		previousPartInstance: instances.find((inst) => inst._id === playlist.previousPartInfo?.partInstanceId),
	}
}

export async function removeRundownFromPlaylistAndUpdatePlaylist(
	context: JobContext,
	rundownId: RundownId,
	playlist: DBRundownPlaylist | undefined,
	playlistLock: PlaylistLock,
	updatePlaylistIdIsSetInSofieTo?: boolean
): Promise<void> {
	await context.directCollections.runInTransaction(async (transaction) => {
		// Quickly move the rundown out of the playlist, so we an free the old playlist lock sooner

		await context.directCollections.Rundowns.update(
			rundownId,
			{
				$set: {
					playlistId: protectString('__TMP__'),
					...(updatePlaylistIdIsSetInSofieTo !== undefined
						? {
								playlistIdIsSetInSofie: updatePlaylistIdIsSetInSofieTo,
						  }
						: {}),
				},
			},
			transaction
		)

		// If no playlist, then there is nothing to regenerate
		if (!playlist) return

		// Ensure playlist is regenerated
		const updatedPlaylist = await regeneratePlaylistAndRundownOrder(context, playlistLock, transaction, playlist)

		if (updatedPlaylist) {
			// ensure the 'old' playout is updated to remove any references to the rundown
			await updatePlayoutAfterChangingRundownInPlaylist(context, updatedPlaylist, playlistLock, transaction, null)
		}
	})
}

function setRundownAsTrapepdInPlaylist(
	ingestCache: CacheForIngest,
	playlistId: RundownPlaylistId,
	rundownIsToBeRemoved: boolean
) {
	ingestCache.Rundown.update((rd) => {
		rd.playlistId = playlistId
		return rd
	})

	if (rundownIsToBeRemoved) {
		// Orphan the deleted rundown
		ingestCache.Rundown.update((rd) => {
			rd.orphaned = 'deleted'
			return rd
		})
	} else {
		// The rundown is still synced, but is in the wrong playlist. Notify the user
		ingestCache.Rundown.update((rd) => {
			rd.notes = [
				...(rd.notes ?? []),
				{
					type: NoteSeverity.WARNING,
					message: getTranslatedMessage(ServerTranslatedMesssages.PLAYLIST_ON_AIR_CANT_MOVE_RUNDOWN),
					origin: {
						name: 'Data update',
					},
				},
			]
			return rd
		})
	}
}

async function removeSegments(
	context: JobContext,
	newPlaylist: DBRundownPlaylist,
	rundownsInPlaylist: Array<ReadonlyDeep<DBRundown>>,
	ingestCache: CacheForIngest,
	changedSegmentIds: ReadonlyDeep<SegmentId[]>,
	removedSegmentIds: ReadonlyDeep<SegmentId[]>
) {
	const { currentPartInstance, nextPartInstance } = await getSelectedPartInstances(
		context,
		newPlaylist,
		rundownsInPlaylist.map((r) => r._id)
	)

	const purgeSegmentIds = new Set<SegmentId>()
	const orphanDeletedSegmentIds = new Set<SegmentId>()
	const orphanHiddenSegmentIds = new Set<SegmentId>()
	for (const segmentId of removedSegmentIds) {
		if (canRemoveSegment(currentPartInstance, nextPartInstance, segmentId)) {
			purgeSegmentIds.add(segmentId)
		} else {
			logger.warn(
				`Not allowing removal of current playing segment "${segmentId}", making segment unsynced instead`
			)
			orphanDeletedSegmentIds.add(segmentId)
		}
	}

	if (context.studio.settings.preserveUnsyncedPlayingSegmentContents) {
		await preserveUnsyncedPlayingSegmentContents(
			context,
			ingestCache,
			changedSegmentIds,
			removedSegmentIds,
			currentPartInstance,
			nextPartInstance
		)
	}

	for (const [segmentId, segment] of ingestCache.Segments.documents) {
		if (segment?.document.isHidden) {
			if (!canRemoveSegment(currentPartInstance, nextPartInstance, segmentId)) {
				// Protect live segment from being hidden
				logger.warn(`Cannot hide live segment ${segmentId}, it will be orphaned`)
				switch (segment.document.orphaned) {
					case SegmentOrphanedReason.DELETED:
						orphanDeletedSegmentIds.add(segmentId)
						break
					default:
						orphanHiddenSegmentIds.add(segmentId)
						break
				}
			} else {
				// This ensures that it doesn't accidently get played while hidden
				ingestCache.Parts.updateAll((p) => {
					if (p.segmentId === segmentId) {
						p.invalid = true
						return p
					} else {
						return false
					}
				})
			}
		} else if (
			!orphanDeletedSegmentIds.has(segmentId) &&
			!ingestCache.Parts.findOne((p) => p.segmentId === segmentId)
		) {
			// No parts in segment

			if (!canRemoveSegment(currentPartInstance, nextPartInstance, segmentId)) {
				// Protect live segment from being hidden
				logger.warn(`Cannot hide live segment ${segmentId}, it will be orphaned`)
				orphanHiddenSegmentIds.add(segmentId)
			} else {
				// We can hide it
				ingestCache.Segments.updateOne(segmentId, (s) => {
					s.isHidden = true
					delete s.orphaned
					return s
				})
			}
		}
	}

	const emptySegmentIds = context.studio.settings.preserveUnsyncedPlayingSegmentContents
		? purgeSegmentIds
		: new Set([...purgeSegmentIds.values(), ...orphanDeletedSegmentIds.values()])
	removeSegmentContents(ingestCache, emptySegmentIds)
	if (orphanDeletedSegmentIds.size) {
		orphanDeletedSegmentIds.forEach((segmentId) => {
			ingestCache.Segments.updateOne(segmentId, (s) => {
				s.orphaned = SegmentOrphanedReason.DELETED
				return s
			})
		})
	}
	if (orphanHiddenSegmentIds.size) {
		const preserveSomeProperties = Object.keys(orphanedHiddenSegmentPropertiesToPreserve).length > 0
		const oldSegments = preserveSomeProperties
			? normalizeArrayToMap<Partial<DBSegment>, '_id'>(
					await context.directCollections.Segments.findFetch(
						{ _id: { $in: [...orphanHiddenSegmentIds] }, rundownId: ingestCache.RundownId },
						{
							projection: { _id: 1, ...orphanedHiddenSegmentPropertiesToPreserve },
						}
					),
					'_id'
			  )
			: undefined
		orphanHiddenSegmentIds.forEach((segmentId) => {
			ingestCache.Segments.updateOne(segmentId, (s) => {
				return {
					...s,
					...oldSegments?.get(segmentId),
					isHidden: false,
					orphaned: SegmentOrphanedReason.HIDDEN,
				}
			})
		})
	}
	if (purgeSegmentIds.size) {
		ingestCache.Segments.remove((s) => purgeSegmentIds.has(s._id))
	}
}

async function preserveUnsyncedPlayingSegmentContents(
	context: JobContext,
	ingestCache: CacheForIngest,
	changedSegmentIds: ReadonlyDeep<SegmentId[]>,
	removedSegmentIds: ReadonlyDeep<SegmentId[]>,
	currentPartInstance: ReadonlyDeep<DBPartInstance> | undefined,
	nextPartInstance: ReadonlyDeep<DBPartInstance> | undefined
) {
	const changedSegmentIdsSet = new Set(changedSegmentIds)

	const segmentsChangedToHidden = ingestCache.Segments.findAll(
		(s) => !!s.isHidden && changedSegmentIdsSet.has(s._id)
	).map((segment) => segment._id)

	// Find segments that are hidden, not removed, and are not safe to remove (e.g. a live segment)
	const hiddenSegmentsToRestore = segmentsChangedToHidden
		.filter((segmentId) => !removedSegmentIds.includes(segmentId))
		.filter((segmentId) => !canRemoveSegment(currentPartInstance, nextPartInstance, segmentId))

	for (const segmentId of [...removedSegmentIds, ...hiddenSegmentsToRestore]) {
		const newParts = ingestCache.Parts.findAll((p) => p.segmentId === segmentId)

		// Blueprints have updated the hidden segment, so we won't try to preserve the contents
		if (newParts.length) {
			continue
		}

		// Restore old data
		const oldParts = await context.directCollections.Parts.findFetch({
			rundownId: ingestCache.RundownId,
			segmentId,
		})
		const oldPartIds = oldParts.map((part) => part._id)

		const [oldPieces, oldAdLibPieces, oldAdLibActions] = await Promise.all([
			await context.directCollections.Pieces.findFetch({
				startRundownId: ingestCache.RundownId,
				startPartId: { $in: oldPartIds },
			}),
			await context.directCollections.AdLibPieces.findFetch({
				rundownId: ingestCache.RundownId,
				partId: { $in: oldPartIds },
			}),
			await context.directCollections.AdLibActions.findFetch({
				rundownId: ingestCache.RundownId,
				partId: { $in: oldPartIds },
			}),
		])

		for (const part of oldParts) {
			ingestCache.Parts.insert(part)
		}
		for (const piece of oldPieces) {
			ingestCache.Pieces.insert(piece)
		}
		for (const adLib of oldAdLibPieces) {
			ingestCache.AdLibPieces.insert(adLib)
		}
		for (const action of oldAdLibActions) {
			ingestCache.AdLibActions.insert(action)
		}
	}
}
