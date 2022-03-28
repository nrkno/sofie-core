import { PeripheralDeviceId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import {
	IngestRegenerateRundownProps,
	IngestRegenerateSegmentProps,
	IngestRemovePartProps,
	IngestRemoveRundownProps,
	IngestRemoveSegmentProps,
	IngestUpdatePartProps,
	IngestUpdateRundownMetaDataProps,
	IngestUpdateRundownProps,
	IngestUpdateSegmentProps,
	IngestUpdateSegmentRanksProps,
	RemoveOrphanedSegmentsProps,
	UserRemoveRundownProps,
	UserUnsyncRundownProps,
} from '@sofie-automation/corelib/dist/worker/ingest'
import { getCurrentTime } from '../lib'
import { JobContext } from '../jobs'
import { logger } from '../logging'
import { CacheForIngest } from './cache'
import {
	getRundownFromIngestData,
	regenerateSegmentsFromIngestData,
	resolveSegmentChangesForUpdatedRundown,
	saveChangesForRundown,
	saveSegmentChangesToCache,
	updateRundownFromIngestData,
	updateSegmentFromIngestData,
	UpdateSegmentsResult,
} from './generation'
import { LocalIngestRundown, makeNewIngestPart, makeNewIngestRundown, makeNewIngestSegment } from './ingestCache'
import { canRundownBeUpdated, canSegmentBeUpdated, extendIngestRundownCore, getRundown, getSegmentId } from './lib'
import { CommitIngestData, runIngestJob, runWithRundownLock, UpdateIngestRundownAction } from './lock'
import { removeRundownFromDb } from '../rundownPlaylists'
import { rundownToSegmentRundown, StudioUserContext } from '../blueprints/context'
import { selectShowStyleVariant } from './rundown'
import { WatchedPackagesHelper } from '../blueprints/context/watchedPackages'
import { DBSegment, SegmentOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { updateBaselineExpectedPackagesOnRundown } from './expectedPackages'
import { literal } from '@sofie-automation/corelib/dist/lib'
import _ = require('underscore')
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'

export async function handleRemovedRundown(context: JobContext, data: IngestRemoveRundownProps): Promise<void> {
	return runIngestJob(
		context,
		data,
		() => {
			// Remove it
			return UpdateIngestRundownAction.DELETE
		},
		async (_context, cache) => {
			const rundown = getRundown(cache)

			return {
				changedSegmentIds: [],
				removedSegmentIds: [],
				renamedSegments: new Map(),
				removeRundown: data.forceDelete || canRundownBeUpdated(rundown, false),

				showStyle: undefined,
				blueprint: undefined,
			}
		}
	)
}
export async function handleUserRemoveRundown(context: JobContext, data: UserRemoveRundownProps): Promise<void> {
	const tmpRundown = await context.directCollections.Rundowns.findOne(data.rundownId)
	if (!tmpRundown || tmpRundown.studioId !== context.studioId) {
		// Either not found, or belongs to someone else
		return
	}

	if (tmpRundown.restoredFromSnapshotId) {
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
		return handleRemovedRundown(context, {
			rundownExternalId: tmpRundown.externalId,
			peripheralDeviceId: null,
			forceDelete: data.force,
		})
	}
}

/** Handle an updated (or inserted) Rundown */
export async function handleUpdatedRundown(context: JobContext, data: IngestUpdateRundownProps): Promise<void> {
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
		async (context, cache, ingestRundown) => {
			if (!ingestRundown) throw new Error(`regenerateRundown lost the IngestRundown...`)

			return handleUpdatedRundownInner(
				context,
				cache,
				ingestRundown,
				data.isCreateAction,
				data.peripheralDeviceId ?? cache.Rundown.doc?.peripheralDeviceId ?? null
			)
		}
	)
}
export async function handleUpdatedRundownMetaData(
	context: JobContext,
	data: IngestUpdateRundownMetaDataProps
): Promise<void> {
	return runIngestJob(
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
		async (context, cache, ingestRundown) => {
			if (!ingestRundown) throw new Error(`handleUpdatedRundownMetaData lost the IngestRundown...`)

			return handleUpdatedRundownMetaDataInner(
				context,
				cache,
				ingestRundown,
				data.peripheralDeviceId ?? cache.Rundown.doc?.peripheralDeviceId ?? null
			)
		}
	)
}
export async function handleUpdatedRundownInner(
	context: JobContext,
	cache: CacheForIngest,
	ingestRundown: LocalIngestRundown,
	isCreateAction: boolean,
	peripheralDeviceId: PeripheralDeviceId | null
): Promise<CommitIngestData | null> {
	if (!canRundownBeUpdated(cache.Rundown.doc, isCreateAction)) return null

	logger.info(`${cache.Rundown.doc ? 'Updating' : 'Adding'} rundown ${cache.RundownId}`)

	return updateRundownFromIngestData(context, cache, ingestRundown, peripheralDeviceId)
}
export async function handleUpdatedRundownMetaDataInner(
	context: JobContext,
	cache: CacheForIngest,
	ingestRundown: LocalIngestRundown,
	peripheralDeviceId: PeripheralDeviceId | null
): Promise<CommitIngestData | null> {
	if (!canRundownBeUpdated(cache.Rundown.doc, false)) return null
	const existingRundown = cache.Rundown.doc
	if (!existingRundown) {
		throw new Error(`Rundown "${ingestRundown.externalId}" does not exist`)
	}

	const pPeripheralDevice = peripheralDeviceId
		? context.directCollections.PeripheralDevices.findOne(peripheralDeviceId)
		: undefined

	const span = context.startSpan('ingest.rundownInput.handleUpdatedRundownMetaDataInner')

	logger.info(`Updating rundown ${cache.RundownId}`)

	const extendedIngestRundown = extendIngestRundownCore(ingestRundown, cache.Rundown.doc)

	const selectShowStyleContext = new StudioUserContext(
		{
			name: 'selectShowStyleVariant',
			identifier: `studioId=${context.studio._id},rundownId=${cache.RundownId},ingestRundownId=${cache.RundownExternalId}`,
			tempSendUserNotesIntoBlackHole: true,
		},
		context.studio,
		context.getStudioBlueprintConfig()
	)

	// TODO-CONTEXT save any user notes from selectShowStyleContext
	const showStyle = await selectShowStyleVariant(context, selectShowStyleContext, extendedIngestRundown)
	if (!showStyle) {
		logger.debug('Blueprint rejected the rundown')
		throw new Error('Blueprint rejected the rundown')
	}

	const pAllRundownWatchedPackages = WatchedPackagesHelper.createForIngest(context, cache, undefined)

	const showStyleBlueprint = await context.getShowStyleBlueprint(showStyle.base._id)
	const allRundownWatchedPackages = await pAllRundownWatchedPackages

	// Call blueprints, get rundown
	const rundownData = await getRundownFromIngestData(
		context,
		cache,
		ingestRundown,
		pPeripheralDevice,
		showStyle,
		showStyleBlueprint,
		allRundownWatchedPackages
	)
	if (!rundownData) {
		// We got no rundown, abort:
		return null
	}

	const { dbRundownData, rundownRes } = rundownData

	// Save rundown and baseline
	const dbRundown = await saveChangesForRundown(context, cache, dbRundownData, rundownRes, showStyle)

	let segmentChanges: UpdateSegmentsResult | undefined
	let removedSegments: DBSegment[] | undefined
	if (!_.isEqual(rundownToSegmentRundown(existingRundown), rundownToSegmentRundown(dbRundown))) {
		logger.info(`MetaData of rundown ${dbRundown.externalId} has been modified, regenerating segments`)
		const changes = await resolveSegmentChangesForUpdatedRundown(
			context,
			cache,
			ingestRundown,
			allRundownWatchedPackages
		)
		segmentChanges = changes.segmentChanges
		removedSegments = changes.removedSegments
	}

	updateBaselineExpectedPackagesOnRundown(context, cache, rundownRes.baseline)

	if (segmentChanges) {
		saveSegmentChangesToCache(context, cache, segmentChanges, true)
	}

	logger.info(`Rundown ${dbRundown._id} update complete`)

	span?.end()
	return literal<CommitIngestData>({
		changedSegmentIds: segmentChanges?.segments.map((s) => s._id) ?? [],
		removedSegmentIds: removedSegments?.map((s) => s._id) ?? [],
		renamedSegments: new Map(),

		removeRundown: false,

		showStyle: showStyle.compound,
		blueprint: showStyleBlueprint,
	})
}
export async function handleRegenerateRundown(context: JobContext, data: IngestRegenerateRundownProps): Promise<void> {
	return runIngestJob(
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
		async (context, cache, ingestRundown) => {
			// If the rundown is orphaned, then we can't regenerate as there wont be any data to use!
			if (!ingestRundown || !canRundownBeUpdated(cache.Rundown.doc, false)) return null

			return updateRundownFromIngestData(context, cache, ingestRundown, data.peripheralDeviceId)
		}
	)
}

export async function handleRegenerateSegment(context: JobContext, data: IngestRegenerateSegmentProps): Promise<void> {
	return runIngestJob(
		context,
		data,
		(ingestRundown) => {
			if (ingestRundown) {
				// Ensure the target segment exists in the cache
				const ingestSegment = ingestRundown.segments.find((s) => s.externalId === data.segmentExternalId)
				if (!ingestSegment) {
					throw new Error(
						`Rundown "${data.rundownExternalId}" does not have a Segment "${data.segmentExternalId}" to update`
					)
				}

				// We modify in-place
				return ingestRundown
			} else {
				throw new Error(`Rundown "${data.rundownExternalId}" not found`)
			}
		},
		async (context, cache, ingestRundown) => {
			const ingestSegment = ingestRundown?.segments?.find((s) => s.externalId === data.segmentExternalId)
			if (!ingestSegment) throw new Error(`IngestSegment "${data.segmentExternalId}" is missing!`)
			return updateSegmentFromIngestData(context, cache, ingestSegment, false)
		}
	)
}

export async function handleRemovedSegment(context: JobContext, data: IngestRemoveSegmentProps): Promise<void> {
	return runIngestJob(
		context,
		data,
		(ingestRundown) => {
			if (ingestRundown) {
				const oldSegmentsLength = ingestRundown.segments.length
				ingestRundown.segments = ingestRundown.segments.filter((s) => s.externalId !== data.segmentExternalId)
				ingestRundown.modified = getCurrentTime()

				if (ingestRundown.segments.length === oldSegmentsLength) {
					throw new Error(
						`Rundown "${data.rundownExternalId}" does not have a Segment "${data.segmentExternalId}" to remove`
					)
				}

				// We modify in-place
				return ingestRundown
			} else {
				throw new Error(`Rundown "${data.rundownExternalId}" not found`)
			}
		},
		async (_context, cache) => {
			const rundown = getRundown(cache)
			const segmentId = getSegmentId(rundown._id, data.segmentExternalId)
			const segment = cache.Segments.findOne(segmentId)

			if (!canSegmentBeUpdated(rundown, segment, false)) {
				// segment has already been deleted
				return null
			} else {
				return {
					changedSegmentIds: [],
					removedSegmentIds: [segmentId],
					renamedSegments: new Map(),

					removeRundown: false,

					showStyle: undefined,
					blueprint: undefined,
				}
			}
		}
	)
}
export async function handleUpdatedSegment(context: JobContext, data: IngestUpdateSegmentProps): Promise<void> {
	const segmentExternalId = data.ingestSegment.externalId
	return runIngestJob(
		context,
		data,
		(ingestRundown) => {
			if (ingestRundown) {
				ingestRundown.segments = ingestRundown.segments.filter((s) => s.externalId !== segmentExternalId)
				ingestRundown.segments.push(makeNewIngestSegment(data.ingestSegment))
				ingestRundown.modified = getCurrentTime()

				// We modify in-place
				return ingestRundown
			} else {
				throw new Error(`Rundown "${data.rundownExternalId}" not found`)
			}
		},
		async (context, cache, ingestRundown) => {
			const ingestSegment = ingestRundown?.segments?.find((s) => s.externalId === segmentExternalId)
			if (!ingestSegment) throw new Error(`IngestSegment "${segmentExternalId}" is missing!`)
			return updateSegmentFromIngestData(context, cache, ingestSegment, data.isCreateAction)
		}
	)
}

export async function handleUpdatedSegmentRanks(
	context: JobContext,
	data: IngestUpdateSegmentRanksProps
): Promise<void> {
	return runIngestJob(
		context,
		data,
		(ingestRundown) => {
			if (ingestRundown) {
				// Update ranks on ingest data
				for (const segment of ingestRundown.segments) {
					segment.rank = data.newRanks[segment.externalId] ?? segment.rank
				}
				// We modify in-place
				return ingestRundown
			} else {
				throw new Error(`Rundown "${data.rundownExternalId}" not found`)
			}
		},
		async (_context, cache) => {
			const changedSegmentIds: SegmentId[] = []
			for (const [externalId, rank] of Object.entries(data.newRanks)) {
				const segmentId = getSegmentId(cache.RundownId, externalId)
				const changed = cache.Segments.update(segmentId, {
					$set: {
						_rank: rank,
					},
				})

				if (changed.length === 0) {
					logger.warn(`Failed to update rank of segment "${externalId}" (${data.rundownExternalId})`)
				} else {
					changedSegmentIds.push(segmentId)
				}
			}

			return {
				changedSegmentIds,
				removedSegmentIds: [],
				renamedSegments: new Map(),
				removeRundown: false,

				showStyle: undefined,
				blueprint: undefined,
			}
		}
	)
}

export async function handleRemoveOrphanedSegemnts(
	context: JobContext,
	data: RemoveOrphanedSegmentsProps
): Promise<void> {
	return runIngestJob(
		context,
		data,
		(ingestRundown) => ingestRundown ?? UpdateIngestRundownAction.DELETE,
		async (_context, ingestCache, ingestRundown) => {
			if (!ingestRundown) throw new Error(`handleRemoveOrphanedSegemnts lost the IngestRundown...`)

			// Find the segments that are still orphaned (in case they have resynced before this executes)
			// We flag them for deletion again, and they will either be kept if they are somehow playing, or purged if they are not
			const stillOrphanedSegments = ingestCache.Segments.findFetch((s) => !!s.orphaned)

			const stillHiddenSegments = stillOrphanedSegments
				.filter(
					(s) => s.orphaned === SegmentOrphanedReason.HIDDEN && data.orphanedHiddenSegmentIds.includes(s._id)
				)
				.map((s) => s._id)

			const stillDeletedSegments = stillOrphanedSegments
				.filter(
					(s) =>
						s.orphaned === SegmentOrphanedReason.DELETED && data.orphanedDeletedSegmentIds.includes(s._id)
				)
				.map((s) => s._id)

			const hiddenSegmentIds = ingestCache.Segments.findFetch({
				_id: { $in: stillHiddenSegments },
			}).map((s) => s._id)

			const { result } = await regenerateSegmentsFromIngestData(
				context,
				ingestCache,
				ingestRundown,
				hiddenSegmentIds
			)

			const changedHiddenSegments = result?.changedSegmentIds ?? []

			// Make sure any orphaned hidden segments arent marked as hidden
			for (const segmentId of stillHiddenSegments) {
				if (!changedHiddenSegments.includes(segmentId)) {
					const segment = ingestCache.Segments.findOne(segmentId)
					if (segment?.isHidden && segment.orphaned === SegmentOrphanedReason.HIDDEN) {
						ingestCache.Segments.update(segmentId, { $unset: { orphaned: 1 } })
						changedHiddenSegments.push(segmentId)
					}
				}
			}

			if (changedHiddenSegments.length === 0 && stillDeletedSegments.length === 0) {
				// Nothing could have changed, so take a shortcut and skip any saving
				return null
			}

			return {
				changedSegmentIds: changedHiddenSegments,
				removedSegmentIds: stillDeletedSegments,
				renamedSegments: new Map(),
				removeRundown: false,
				showStyle: undefined,
				blueprint: undefined,
			}
		}
	)
}

export async function handleRemovedPart(context: JobContext, data: IngestRemovePartProps): Promise<void> {
	return runIngestJob(
		context,
		data,
		(ingestRundown) => {
			if (ingestRundown) {
				const ingestSegment = ingestRundown.segments.find((s) => s.externalId === data.segmentExternalId)
				if (!ingestSegment) {
					throw new Error(
						`Rundown "${data.rundownExternalId}" does not have a Segment "${data.segmentExternalId}" to update`
					)
				}
				ingestSegment.parts = ingestSegment.parts.filter((p) => p.externalId !== data.partExternalId)
				ingestSegment.modified = getCurrentTime()

				// We modify in-place
				return ingestRundown
			} else {
				throw new Error(`Rundown "${data.rundownExternalId}" not found`)
			}
		},
		async (context, cache, ingestRundown) => {
			const ingestSegment = ingestRundown?.segments?.find((s) => s.externalId === data.segmentExternalId)
			if (!ingestSegment) throw new Error(`IngestSegment "${data.segmentExternalId}" is missing!`)
			return updateSegmentFromIngestData(context, cache, ingestSegment, false)
		}
	)
}

export async function handleUpdatedPart(context: JobContext, data: IngestUpdatePartProps): Promise<void> {
	return runIngestJob(
		context,
		data,
		(ingestRundown) => {
			if (ingestRundown) {
				const ingestSegment = ingestRundown.segments.find((s) => s.externalId === data.segmentExternalId)
				if (!ingestSegment) {
					throw new Error(
						`Rundown "${data.rundownExternalId}" does not have a Segment "${data.segmentExternalId}" to update`
					)
				}
				ingestSegment.parts = ingestSegment.parts.filter((p) => p.externalId !== data.ingestPart.externalId)
				ingestSegment.parts.push(makeNewIngestPart(data.ingestPart))
				ingestSegment.modified = getCurrentTime()

				// We modify in-place
				return ingestRundown
			} else {
				throw new Error(`Rundown "${data.rundownExternalId}" not found`)
			}
		},
		async (context, cache, ingestRundown) => {
			const ingestSegment = ingestRundown?.segments?.find((s) => s.externalId === data.segmentExternalId)
			if (!ingestSegment) throw new Error(`IngestSegment "${data.segmentExternalId}" is missing!`)
			return updateSegmentFromIngestData(context, cache, ingestSegment, false)
		}
	)
}

export async function handleUserUnsyncRundown(context: JobContext, data: UserUnsyncRundownProps): Promise<void> {
	return runWithRundownLock(context, data.rundownId, async (rundown) => {
		if (rundown) {
			if (!rundown.orphaned) {
				await context.directCollections.Rundowns.update(rundown._id, {
					$set: {
						orphaned: 'manual',
					},
				})
			} else {
				logger.info(`Rundown "${rundown._id}" was already unsynced`)
			}
		}
	})
}
