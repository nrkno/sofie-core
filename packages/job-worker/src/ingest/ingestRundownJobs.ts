import { JobContext } from '../jobs'
import { logger } from '../logging'
import { updateRundownFromIngestData, updateRundownMetadataFromIngestData } from './generationRundown'
import { makeNewIngestRundown } from './ingestCache'
import { canRundownBeUpdated, getRundownId } from './lib'
import { CommitIngestData, runIngestJob, runWithRundownLock, UpdateIngestRundownAction } from './lock'
import { removeRundownFromDb } from '../rundownPlaylists'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { DBRundown, RundownOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import {
	IngestRegenerateRundownProps,
	IngestRemoveRundownProps,
	IngestUpdateRundownMetaDataProps,
	IngestUpdateRundownProps,
	UserRemoveRundownProps,
	UserUnsyncRundownProps,
} from '@sofie-automation/corelib/dist/worker/ingest'
import { UserError, UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import { RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'

/**
 * Attempt to remove a rundown, or orphan it
 */
export async function handleRemovedRundown(context: JobContext, data: IngestRemoveRundownProps): Promise<void> {
	await runIngestJob(
		context,
		data,
		() => {
			// Remove it
			return UpdateIngestRundownAction.DELETE
		},
		async (_context, ingestModel) => {
			const rundown = ingestModel.getRundown()

			const canRemove = data.forceDelete || canRundownBeUpdated(rundown, false)
			if (!canRemove) throw UserError.create(UserErrorMessage.RundownRemoveWhileActive, { name: rundown.name })

			return literal<CommitIngestData>({
				changedSegmentIds: [],
				removedSegmentIds: [],
				renamedSegments: null,
				removeRundown: true,
				returnRemoveFailure: true,
			})
		}
	)
}

/**
 * User requested removing a rundown
 */
export async function handleUserRemoveRundown(context: JobContext, data: UserRemoveRundownProps): Promise<void> {
	const tmpRundown = await context.directCollections.Rundowns.findOne(data.rundownId)
	if (!tmpRundown || tmpRundown.studioId !== context.studioId) {
		// Either not found, or belongs to someone else
		return
	}

	if (tmpRundown._id !== getRundownId(context.studioId, tmpRundown.externalId)) {
		/**
		 * If the rundown is not created via an ingest method, there can be a bad relationship between _id and externalId, which causes the rundown to not be found.
		 * This typically happens when a rundown is restored from a snapshot.
		 * When this happens, we need to remove the rundown directly.
		 */

		return runWithRundownLock(context, data.rundownId, async (rundown, lock) => {
			if (rundown) {
				// It's from a snapshot, so should be removed directly, as that means it cannot run ingest operations
				// Note: this bypasses activation checks, but that probably doesnt matter
				await removeRundownFromDb(context, lock)

				// check if the playlist is now empty
				const rundownCount: Pick<DBRundown, '_id'>[] = await context.directCollections.Rundowns.findFetch(
					{ playlistId: rundown.playlistId },
					{ projection: { _id: 1 } }
				)
				if (rundownCount.length === 0) {
					// A lazy approach, but good enough for snapshots
					await context.directCollections.RundownPlaylists.remove(rundown.playlistId)
				}
			}
		})
	} else {
		// The ids match, meaning the typical ingest operation flow will work
		return handleRemovedRundown(context, {
			rundownExternalId: tmpRundown.externalId,
			forceDelete: data.force,
		})
	}
}

/**
 * Insert or update a rundown with a new IngestRundown
 */
export async function handleUpdatedRundown(context: JobContext, data: IngestUpdateRundownProps): Promise<RundownId> {
	return runIngestJob(
		context,
		data,
		(ingestRundown) => {
			if (ingestRundown || data.isCreateAction) {
				// We want to regenerate unmodified
				return makeNewIngestRundown(data.ingestRundown)
			} else {
				throw new Error(`Rundown "${data.rundownExternalId}" not found`)
			}
		},
		async (context, ingestModel, ingestRundown) => {
			if (!ingestRundown) throw new Error(`regenerateRundown lost the IngestRundown...`)

			return updateRundownFromIngestData(
				context,
				ingestModel,
				ingestRundown,
				data.isCreateAction,
				data.rundownSource
			)
		}
	)
}

/**
 * Update a rundown from a new IngestRundown (ingoring IngestSegments)
 */
export async function handleUpdatedRundownMetaData(
	context: JobContext,
	data: IngestUpdateRundownMetaDataProps
): Promise<void> {
	await runIngestJob(
		context,
		data,
		(ingestRundown) => {
			if (ingestRundown) {
				return {
					...makeNewIngestRundown(data.ingestRundown),
					segments: ingestRundown.segments,
				}
			} else {
				throw new Error(`Rundown "${data.rundownExternalId}" not found`)
			}
		},
		async (context, ingestModel, ingestRundown) => {
			if (!ingestRundown) throw new Error(`handleUpdatedRundownMetaData lost the IngestRundown...`)

			return updateRundownMetadataFromIngestData(context, ingestModel, ingestRundown, data.rundownSource)
		}
	)
}

/**
 * Regnerate a Rundown from the cached IngestRundown
 */
export async function handleRegenerateRundown(context: JobContext, data: IngestRegenerateRundownProps): Promise<void> {
	await runIngestJob(
		context,
		data,
		(ingestRundown) => {
			if (ingestRundown) {
				// We want to regenerate unmodified
				return ingestRundown
			} else {
				throw new Error(`Rundown "${data.rundownExternalId}" not found`)
			}
		},
		async (context, ingestModel, ingestRundown) => {
			// If the rundown is orphaned, then we can't regenerate as there wont be any data to use!
			if (!ingestRundown) return null

			if (!ingestModel.rundown) throw new Error(`Rundown "${data.rundownExternalId}" not found`)

			return updateRundownFromIngestData(context, ingestModel, ingestRundown, false, ingestModel.rundown.source)
		}
	)
}

/**
 * User requested unsyncing a rundown
 */
export async function handleUserUnsyncRundown(context: JobContext, data: UserUnsyncRundownProps): Promise<void> {
	return runWithRundownLock(context, data.rundownId, async (rundown) => {
		if (rundown) {
			if (!rundown.orphaned) {
				await context.directCollections.Rundowns.update(rundown._id, {
					$set: {
						orphaned: RundownOrphanedReason.MANUAL,
					},
				})
			} else {
				logger.info(`Rundown "${rundown._id}" was already unsynced`)
			}
		}
	})
}
