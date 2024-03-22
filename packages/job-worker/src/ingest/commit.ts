import {
	SegmentId,
	PartId,
	RundownPlaylistId,
	RundownId,
	PartInstanceId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBRundown, RundownOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { unprotectString, protectString } from '@sofie-automation/corelib/dist/protectedString'
import { logger } from '../logging'
import { PlayoutModel } from '../playout/model/PlayoutModel'
import { PlayoutRundownModel } from '../playout/model/PlayoutRundownModel'
import { isTooCloseToAutonext } from '../playout/lib'
import { allowedToMoveRundownOutOfPlaylist, updatePartInstanceRanks } from '../rundown'
import {
	getPlaylistIdFromExternalId,
	produceRundownPlaylistInfoFromRundown,
	removeRundownFromDb,
} from '../rundownPlaylists'
import { ReadonlyDeep } from 'type-fest'
import { IngestModel, IngestModelReadonly } from './model/IngestModel'
import { JobContext } from '../jobs'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { runJobWithPlaylistLock, runWithPlayoutModel } from '../playout/lock'
import { CommitIngestData } from './lock'
import { clone, groupByToMapFunc } from '@sofie-automation/corelib/dist/lib'
import { PlaylistLock } from '../jobs/lock'
import { syncChangesToPartInstances } from './syncChangesToPartInstance'
import { ensureNextPartIsValid } from './updateNext'
import { StudioJobs } from '@sofie-automation/corelib/dist/worker/studio'
import { getTranslatedMessage, ServerTranslatedMesssages } from '../notes'
import _ = require('underscore')
import { EventsJobs } from '@sofie-automation/corelib/dist/worker/events'
import { NoteSeverity } from '@sofie-automation/blueprints-integration'
import { DBSegment, SegmentOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { UserError, UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import { PlayoutRundownModelImpl } from '../playout/model/implementation/PlayoutRundownModelImpl'
import { PlayoutSegmentModelImpl } from '../playout/model/implementation/PlayoutSegmentModelImpl'
import { createPlayoutModelFromIngestModel } from '../playout/model/implementation/LoadPlayoutModel'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DatabasePersistedModel } from '../modelBase'

export type BeforePartMapItem = { id: PartId; rank: number }
export type BeforeIngestOperationPartMap = ReadonlyMap<SegmentId, Array<BeforePartMapItem>>

interface PlaylistIdPair {
	id: RundownPlaylistId
	/** The externalId of the playlist. This may only be null when there is a playlist being regenerated */
	externalId: string | null
}

/**
 * Post-process some ingest changes.
 * This is designed to be the same block of code after any ingest change. The aim is to be able to run it once after a batch of ingest changes
 * @param ingestModel The model for the rundown that has been changed
 * @param beforeRundown The rundown before the batch of ingest operations
 * @param beforePartMap The segments and partIds before the batch of ingest operations
 * @param data Information about the ingest changes performed
 */
export async function CommitIngestOperation(
	context: JobContext,
	ingestModel: IngestModel & DatabasePersistedModel,
	beforeRundown: ReadonlyDeep<DBRundown> | undefined,
	beforePartMap: BeforeIngestOperationPartMap,
	data: ReadonlyDeep<CommitIngestData>
): Promise<UserError | void> {
	const rundown = ingestModel.getRundown()

	if (data.removeRundown && !beforeRundown) {
		// Fresh rundown that was instantly deleted. Discard everything and pretend it never happened
		ingestModel.dispose()
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
					setRundownAsTrappedInPlaylist(ingestModel, oldPlaylist._id, data.removeRundown)
				} else {
					// The rundown is safe to simply move or remove
					trappedInPlaylistId = undefined

					await removeRundownFromPlaylistAndUpdatePlaylist(
						context,
						ingestModel.rundownId,
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
		ingestModel.dispose()
		await removeRundownFromDb(context, ingestModel.rundownLock)
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
			ingestModel.setRundownPlaylistId(newPlaylistId.id)

			const finalRundown = ingestModel.getRundown()

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
				ingestModel,
				data.changedSegmentIds,
				data.removedSegmentIds
			)

			// Save the rundowns and regenerated playlist
			// This will reorder the rundowns a little before the playlist and the contents, but that is ok
			await context.directCollections.RundownPlaylists.replace(newPlaylist)
			// ensure instances are updated for rundown changes
			await updatePartInstancesSegmentIds(context, ingestModel, data.renamedSegments, beforePartMap)
			await updatePartInstancesBasicProperties(
				context,
				convertIngestModelToPlayoutRundownWithSegments(ingestModel),
				newPlaylist
			)

			// Update the playout to use the updated rundown
			await updatePartInstanceRanks(context, ingestModel, data.changedSegmentIds, beforePartMap)

			// Create the full playout model, now we have the rundowns and playlist updated
			const playoutModel = await createPlayoutModelFromIngestModel(
				context,
				playlistLock,
				newPlaylist,
				rundownsInPlaylist,
				ingestModel
			)

			// Start the save
			const pSaveIngest = ingestModel.saveAllToDatabase()
			pSaveIngest.catch(() => null) // Ensure promise isn't reported as unhandled

			await validateScratchpad(context, playoutModel)

			try {
				// sync changes to the 'selected' partInstances
				await syncChangesToPartInstances(context, playoutModel, ingestModel)

				playoutModel.deferAfterSave(() => {
					// Run in the background, we don't want to hold onto the lock to do this
					context
						.queueEventJob(EventsJobs.RundownDataChanged, {
							playlistId: playoutModel.playlistId,
							rundownId: ingestModel.rundownId,
						})
						.catch((e) => {
							logger.error(`Queue RundownDataChanged failed: ${e}`)
						})

					triggerUpdateTimelineAfterIngestData(context, playoutModel.playlistId)
				})

				// wait for the ingest changes to save
				await pSaveIngest

				// do some final playout checks, which may load back some Parts data
				await ensureNextPartIsValid(context, playoutModel)

				// save the final playout changes
				await playoutModel.saveAllToDatabase()
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
 * @param ingestModel Ingest model
 * @param renamedSegments Map of <fromSegmentId, toSegmentId>, this will ensure any orphaned PartInstances get moved correctly
 * @param beforePartMap The segments and partIds before the batch of ingest operations
 */
async function updatePartInstancesSegmentIds(
	context: JobContext,
	ingestModel: IngestModel,
	renamedSegments: ReadonlyMap<SegmentId, SegmentId>,
	beforePartMap: BeforeIngestOperationPartMap
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

	// Reverse the structure
	const beforePartSegmentIdMap = new Map<PartId, SegmentId>()
	for (const [segmentId, partItems] of beforePartMap.entries()) {
		for (const partItem of partItems) {
			beforePartSegmentIdMap.set(partItem.id, segmentId)
		}
	}

	// Some parts may have gotten a different segmentId to the base rule, so track those seperately in the rules
	for (const partModel of ingestModel.getAllOrderedParts()) {
		const oldSegmentId = beforePartSegmentIdMap.get(partModel.part._id)
		if (oldSegmentId && oldSegmentId !== partModel.part.segmentId) {
			const rule = renameRules.get(partModel.part.segmentId) ?? { partIds: [], fromSegmentId: null }
			renameRules.set(partModel.part.segmentId, rule)

			rule.partIds.push(partModel.part._id)
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
			}))
		)
	}
}

export function convertIngestModelToPlayoutRundownWithSegments(ingestModel: IngestModelReadonly): PlayoutRundownModel {
	const rundown = ingestModel.getRundown()

	const segmentsWithParts = ingestModel
		.getAllSegments()
		.map(
			(segment) =>
				new PlayoutSegmentModelImpl(
					clone<DBSegment>(segment.segment),
					clone<DBPart[]>(segment.parts.map((p) => p.part))
				)
		)
	const groupedSegmentsWithParts = groupByToMapFunc(segmentsWithParts, (s) => s.segment.rundownId)

	return new PlayoutRundownModelImpl(rundown, groupedSegmentsWithParts.get(rundown._id) ?? [], [])
}

/**
 * Ensure some 'basic' PartInstances properties are in sync with their parts
 */
async function updatePartInstancesBasicProperties(
	context: JobContext,
	rundownModel: PlayoutRundownModel,
	playlist: ReadonlyDeep<DBRundownPlaylist>
) {
	// Get a list of all the Parts that are known to exist
	const knownPartIds = rundownModel.getAllPartIds()

	// Find all the partInstances which are not reset, and are not orphaned, but their Part no longer exist (ie they should be orphaned)
	const partInstancesToOrphan: Array<Pick<DBPartInstance, '_id'>> =
		await context.directCollections.PartInstances.findFetch(
			{
				reset: { $ne: true },
				rundownId: rundownModel.rundown._id,
				orphaned: { $exists: false },
				'part._id': { $nin: knownPartIds },
			},
			{ projection: { _id: 1 } }
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
				}
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
				}
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
				}
			)
		)
	}

	await Promise.all([ps])
}

/**
 * Regenerate the supplied rundown playlist and update the order of its rundowns (if not manual)
 * This saves directly to the db
 */
export async function regeneratePlaylistAndRundownOrder(
	context: JobContext,
	lock: PlaylistLock,
	oldPlaylist: ReadonlyDeep<DBRundownPlaylist>,
	existingRundowns?: DBRundown[]
): Promise<DBRundownPlaylist | null> {
	// ensure the lock is held for the correct playlist
	if (lock.playlistId !== oldPlaylist._id)
		throw new Error(`Lock is for wrong playlist. Holding "${lock.playlistId}", need "${oldPlaylist._id}"`)

	const allRundowns =
		existingRundowns ?? (await context.directCollections.Rundowns.findFetch({ playlistId: oldPlaylist._id }))

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
		await context.directCollections.RundownPlaylists.replace(newPlaylist)

		return newPlaylist
	} else {
		// Playlist is empty and should be removed
		await context.directCollections.RundownPlaylists.remove(oldPlaylist._id)

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
	insertedRundown: ReadonlyDeep<DBRundown> | null
): Promise<void> {
	// ensure the 'old' playout is updated to remove any references to the rundown
	await runWithPlayoutModel(context, playlist, playlistLock, null, async (playoutModel) => {
		if (playoutModel.rundowns.length === 0) {
			if (playoutModel.playlist.activationId)
				throw new Error(`RundownPlaylist "${playoutModel.playlistId}" has no contents but is active...`)

			// Remove an empty playlist
			await context.directCollections.RundownPlaylists.remove({ _id: playoutModel.playlistId })

			playoutModel.assertNoChanges()
			return
		}

		// Ensure playout is in sync

		if (insertedRundown) {
			const rundownModel = playoutModel.getRundown(insertedRundown._id)
			if (rundownModel) {
				// If a rundown has changes, ensure instances are updated
				await updatePartInstancesBasicProperties(context, rundownModel, playoutModel.playlist)
			}
		}

		await ensureNextPartIsValid(context, playoutModel)

		if (playoutModel.playlist.activationId) {
			triggerUpdateTimelineAfterIngestData(context, playoutModel.playlistId)
		}
	})
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
	// Quickly move the rundown out of the playlist, so we an free the old playlist lock sooner

	await context.directCollections.Rundowns.update(rundownId, {
		$set: {
			playlistId: protectString('__TMP__'),
			...(updatePlaylistIdIsSetInSofieTo !== undefined
				? {
						playlistIdIsSetInSofie: updatePlaylistIdIsSetInSofieTo,
				  }
				: {}),
		},
	})

	// If no playlist, then there is nothing to regenerate
	if (!playlist) return

	// Ensure playlist is regenerated
	const updatedPlaylist = await regeneratePlaylistAndRundownOrder(context, playlistLock, playlist)

	if (updatedPlaylist) {
		// ensure the 'old' playout is updated to remove any references to the rundown
		await updatePlayoutAfterChangingRundownInPlaylist(context, updatedPlaylist, playlistLock, null)
	}
}

function setRundownAsTrappedInPlaylist(
	ingestModel: IngestModel,
	playlistId: RundownPlaylistId,
	rundownIsToBeRemoved: boolean
) {
	ingestModel.setRundownPlaylistId(playlistId)

	if (rundownIsToBeRemoved) {
		// Orphan the deleted rundown
		ingestModel.setRundownOrphaned(RundownOrphanedReason.DELETED)
	} else {
		// The rundown is still synced, but is in the wrong playlist. Notify the user
		ingestModel.appendRundownNotes({
			type: NoteSeverity.WARNING,
			message: getTranslatedMessage(ServerTranslatedMesssages.PLAYLIST_ON_AIR_CANT_MOVE_RUNDOWN),
			origin: {
				name: 'Data update',
			},
		})
	}
}

async function removeSegments(
	context: JobContext,
	newPlaylist: DBRundownPlaylist,
	rundownsInPlaylist: Array<ReadonlyDeep<DBRundown>>,
	ingestModel: IngestModel,
	_changedSegmentIds: ReadonlyDeep<SegmentId[]>,
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

	for (const segment of ingestModel.getAllSegments()) {
		const segmentId = segment.segment._id
		if (segment.segment.isHidden) {
			if (!canRemoveSegment(currentPartInstance, nextPartInstance, segmentId)) {
				// Protect live segment from being hidden
				logger.warn(`Cannot hide live segment ${segmentId}, it will be orphaned`)
				switch (segment.segment.orphaned) {
					case SegmentOrphanedReason.DELETED:
						orphanDeletedSegmentIds.add(segmentId)
						break
					default:
						orphanHiddenSegmentIds.add(segmentId)
						break
				}
			} else {
				// This ensures that it doesn't accidently get played while hidden
				// TODO: should this be handled inside of the IngestSegmentModel?
				for (const part of segment.parts) {
					part.setInvalid(true)
				}
			}
		} else if (!orphanDeletedSegmentIds.has(segmentId) && segment.parts.length === 0) {
			// No parts in segment

			if (!canRemoveSegment(currentPartInstance, nextPartInstance, segmentId)) {
				// Protect live segment from being hidden
				logger.warn(`Cannot hide live segment ${segmentId}, it will be orphaned`)
				orphanHiddenSegmentIds.add(segmentId)
			} else {
				// We can hide it
				segment.setOrphaned(undefined)
				segment.setHidden(true)
			}
		}
	}

	const emptySegmentIds = new Set([...purgeSegmentIds.values(), ...orphanDeletedSegmentIds.values()])
	for (const segmentId of emptySegmentIds) {
		const segment = ingestModel.getSegment(segmentId)
		if (segment) {
			segment.removeAllParts()
		}
	}

	if (orphanDeletedSegmentIds.size) {
		// TODO - is this already done by the place which declares them deleted?
		orphanDeletedSegmentIds.forEach((segmentId) => {
			ingestModel.getSegment(segmentId)?.setOrphaned(SegmentOrphanedReason.DELETED)
		})
	}
	if (orphanHiddenSegmentIds.size) {
		orphanHiddenSegmentIds.forEach((segmentId) => {
			const segment = ingestModel.getSegment(segmentId)
			if (segment) {
				segment.setHidden(false)
				segment.setOrphaned(SegmentOrphanedReason.HIDDEN)
			}
		})
	}
	for (const segmentId of purgeSegmentIds) {
		ingestModel.removeSegment(segmentId)
	}
}

async function validateScratchpad(_context: JobContext, playoutModel: PlayoutModel) {
	for (const rundown of playoutModel.rundowns) {
		rundown.updateScratchpadSegmentRank()
	}
}
