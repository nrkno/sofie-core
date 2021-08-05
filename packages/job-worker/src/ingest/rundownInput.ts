import { PeripheralDeviceId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import {
	IngestRegenerateRundownProps,
	IngestRegenerateSegmentProps,
	IngestRemovePartProps,
	IngestRemoveRundownProps,
	IngestRemoveSegmentProps,
	IngestUpdatePartProps,
	IngestUpdateRundownProps,
	IngestUpdateSegmentProps,
	IngestUpdateSegmentRanksProps,
	UserRemoveRundownProps,
	UserUnsyncRundownProps,
} from '@sofie-automation/corelib/dist/worker/ingest'
import { getCurrentTime } from '../lib'
import { JobContext } from '../jobs'
import { logger } from '../logging'
import { CacheForIngest } from './cache'
import { updateRundownFromIngestData, updateSegmentFromIngestData } from './generation'
import { LocalIngestRundown, makeNewIngestPart, makeNewIngestRundown, makeNewIngestSegment } from './ingestCache'
import { canRundownBeUpdated, canSegmentBeUpdated, getRundown, getSegmentId } from './lib'
import { CommitIngestData, runIngestJob, runWithRundownLock, UpdateIngestRundownAction } from './lock'
import { removeRundownsFromDb } from '../rundownPlaylists'

// async function getIngestPlaylist(
// 	peripheralDevice: PeripheralDevice,
// 	playlistExternalId: string
// ): Promise<IngestPlaylist> {
// 	const rundowns = await Rundowns.findFetchAsync({
// 		peripheralDeviceId: peripheralDevice._id,
// 		playlistExternalId,
// 	})

// 	const ingestPlaylist: IngestPlaylist = literal<IngestPlaylist>({
// 		externalId: playlistExternalId,
// 		rundowns: [],
// 	})

// 	await Promise.all(
// 		rundowns.map(async (rundown) => {
// 			const ingestCache = await RundownIngestDataCache.create(rundown._id)
// 			const ingestData = ingestCache.fetchRundown()
// 			if (ingestData) {
// 				ingestPlaylist.rundowns.push(ingestData)
// 			}
// 		})
// 	)

// 	return ingestPlaylist
// }
// async function getIngestRundown(peripheralDevice: PeripheralDevice, rundownExternalId: string): Promise<IngestRundown> {
// 	const rundown = await Rundowns.findOneAsync({
// 		peripheralDeviceId: peripheralDevice._id,
// 		externalId: rundownExternalId,
// 	})
// 	if (!rundown) {
// 		throw new Meteor.Error(404, `Rundown "${rundownExternalId}" not found`)
// 	}

// 	const ingestCache = await RundownIngestDataCache.create(rundown._id)
// 	const ingestData = ingestCache.fetchRundown()
// 	if (!ingestData)
// 		throw new Meteor.Error(404, `Rundown "${rundown._id}", (${rundownExternalId}) has no cached ingest data`)
// 	return ingestData
// }
// async function getIngestSegment(
// 	peripheralDevice: PeripheralDevice,
// 	rundownExternalId: string,
// 	segmentExternalId: string
// ): Promise<IngestSegment> {
// 	const rundown = await Rundowns.findOneAsync({
// 		peripheralDeviceId: peripheralDevice._id,
// 		externalId: rundownExternalId,
// 	})
// 	if (!rundown) {
// 		throw new Meteor.Error(404, `Rundown "${rundownExternalId}" not found`)
// 	}

// 	const segment = await Segments.findOneAsync({
// 		externalId: segmentExternalId,
// 		rundownId: rundown._id,
// 	})

// 	if (!segment) {
// 		throw new Meteor.Error(404, `Segment ${segmentExternalId} not found in rundown ${rundownExternalId}`)
// 	}

// 	const ingestCache = await RundownIngestDataCache.create(rundown._id)
// 	const ingestData = ingestCache.fetchSegment(segment._id)
// 	if (!ingestData)
// 		throw new Meteor.Error(
// 			404,
// 			`Rundown "${rundown._id}", (${rundownExternalId}) has no cached segment "${segment._id}" ingest data`
// 		)
// 	return ingestData
// }
// async function listIngestRundowns(peripheralDevice: PeripheralDevice): Promise<string[]> {
// 	const rundowns = await Rundowns.findFetchAsync({
// 		peripheralDeviceId: peripheralDevice._id,
// 	})

// 	return rundowns.map((r) => r.externalId)
// }

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
		return runWithRundownLock(context, data.rundownId, async (rundown) => {
			if (rundown) {
				// It's from a snapshot, so should be removed directly, as that means it cannot run ingest operations
				// Note: this bypasses activation checks, but that probably doesnt matter
				await removeRundownsFromDb(context, [rundown._id])

				// check if the playlist is now empty
				const rundownCount = await context.directCollections.Rundowns.findFetch(
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
						orphaned: 'deleted',
					},
				})
			} else {
				logger.info(`Rundown "${rundown._id}" was already unsynced`)
			}
		}
	})
}
