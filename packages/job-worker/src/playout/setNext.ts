import { getRandomId, literal } from '@sofie-automation/corelib/dist/lib'
import { DBSegment, SegmentOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { DBPart, isPartPlayable } from '@sofie-automation/corelib/dist/dataModel/Part'
import { JobContext } from '../jobs'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import {
	PartInstanceId,
	RundownId,
	RundownPlaylistActivationId,
	SegmentId,
	SegmentPlayoutId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { CacheForPlayout, getRundownIDsFromCache, getSelectedPartInstancesFromCache } from './cache'
import {
	fetchPiecesThatMayBeActiveForPart,
	getPieceInstancesForPart,
	syncPlayheadInfinitesForNextPartInstance,
} from './infinites'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { PRESERVE_UNSYNCED_PLAYING_SEGMENT_CONTENTS } from '@sofie-automation/shared-lib/dist/core/constants'
import { getCurrentTime } from '../lib'
import { IngestJobs } from '@sofie-automation/corelib/dist/worker/ingest'
import _ = require('underscore')
import { resetPartInstancesWithPieceInstances } from './lib'
import { RundownHoldState, SelectedPartInstance } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { UserError, UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import { SelectNextPartResult } from './selectNextPart'
import { sortPartsInSortedSegments } from '@sofie-automation/corelib/dist/playout/playlist'

/**
 * Set or clear the nexted part, from a given PartInstance, or SelectNextPartResult
 * @param context Context for the running job
 * @param cache The playout cache of the playlist
 * @param rawNextPart The Part to set as next
 * @param setManually Whether this was manually chosen by the user
 * @param nextTimeOffset The offset into the Part to start playback
 */
export async function setNextPart(
	context: JobContext,
	cache: CacheForPlayout,
	rawNextPart: Omit<SelectNextPartResult, 'index'> | DBPartInstance | null,
	setManually: boolean,
	nextTimeOffset?: number | undefined
): Promise<void> {
	const span = context.startSpan('setNextPart')

	const rundownIds = getRundownIDsFromCache(cache)
	const { currentPartInstance, nextPartInstance } = getSelectedPartInstancesFromCache(cache)

	if (rawNextPart) {
		if (!cache.Playlist.doc.activationId)
			throw new Error(`RundownPlaylist "${cache.Playlist.doc._id}" is not active`)

		// create new instance
		let newPartInstance: DBPartInstance
		let consumesNextSegmentId: boolean
		if ('playlistActivationId' in rawNextPart) {
			const inputPartInstance: DBPartInstance = rawNextPart
			if (inputPartInstance.part.invalid) {
				throw new Error('Part is marked as invalid, cannot set as next.')
			}

			if (!rundownIds.includes(inputPartInstance.rundownId)) {
				throw new Error(
					`PartInstance "${inputPartInstance._id}" of rundown "${inputPartInstance.rundownId}" not part of RundownPlaylist "${cache.Playlist.doc._id}"`
				)
			}

			consumesNextSegmentId = false
			newPartInstance = await prepareExistingPartInstanceForBeingNexted(context, cache, inputPartInstance)
		} else {
			const selectedPart: Omit<SelectNextPartResult, 'index'> = rawNextPart
			if (selectedPart.part.invalid) {
				throw new Error('Part is marked as invalid, cannot set as next.')
			}

			if (!rundownIds.includes(selectedPart.part.rundownId)) {
				throw new Error(
					`Part "${selectedPart.part._id}" of rundown "${selectedPart.part.rundownId}" not part of RundownPlaylist "${cache.Playlist.doc._id}"`
				)
			}

			consumesNextSegmentId = selectedPart.consumesNextSegmentId ?? false

			if (nextPartInstance && nextPartInstance.part._id === selectedPart.part._id) {
				// Re-use existing

				newPartInstance = await prepareExistingPartInstanceForBeingNexted(context, cache, nextPartInstance)
			} else {
				// Create new instance
				newPartInstance = await preparePartInstanceForPartBeingNexted(
					context,
					cache,
					cache.Playlist.doc.activationId,
					currentPartInstance,
					selectedPart.part
				)
			}
		}

		const selectedPartInstanceIds = _.compact([
			newPartInstance._id,
			cache.Playlist.doc.currentPartInfo?.partInstanceId,
			cache.Playlist.doc.previousPartInfo?.partInstanceId,
		])

		// reset any previous instances of this part
		resetPartInstancesWithPieceInstances(context, cache, {
			_id: { $nin: selectedPartInstanceIds },
			rundownId: newPartInstance.rundownId,
			'part._id': newPartInstance.part._id,
		})

		cache.Playlist.update((p) => {
			p.nextPartInfo = literal<SelectedPartInstance>({
				partInstanceId: newPartInstance._id,
				rundownId: newPartInstance.rundownId,
				manuallySelected: !!(setManually || newPartInstance.orphaned),
				consumesNextSegmentId,
			})
			p.nextTimeOffset = nextTimeOffset || null
			return p
		})
	} else {
		// Set to null

		cache.Playlist.update((p) => {
			p.nextPartInfo = null
			p.nextTimeOffset = null
			return p
		})
	}

	discardUntakenPartInstances(cache)

	resetPartInstancesWhenChangingSegment(context, cache)

	await cleanupOrphanedItems(context, cache)

	if (span) span.end()
}

async function prepareExistingPartInstanceForBeingNexted(
	context: JobContext,
	cache: CacheForPlayout,
	instance: DBPartInstance
): Promise<DBPartInstance> {
	await syncPlayheadInfinitesForNextPartInstance(context, cache)

	return instance
}

async function preparePartInstanceForPartBeingNexted(
	context: JobContext,
	cache: CacheForPlayout,
	playlistActivationId: RundownPlaylistActivationId,
	currentPartInstance: DBPartInstance | undefined,
	nextPart: DBPart
): Promise<DBPartInstance> {
	const partInstanceId = protectString<PartInstanceId>(`${nextPart._id}_${getRandomId()}`)

	const newTakeCount = currentPartInstance ? currentPartInstance.takeCount + 1 : 0 // Increment
	const segmentPlayoutId: SegmentPlayoutId =
		currentPartInstance && nextPart.segmentId === currentPartInstance.segmentId
			? currentPartInstance.segmentPlayoutId
			: getRandomId()

	const instance: DBPartInstance = {
		_id: partInstanceId,
		takeCount: newTakeCount,
		playlistActivationId: playlistActivationId,
		rundownId: nextPart.rundownId,
		segmentId: nextPart.segmentId,
		segmentPlayoutId,
		part: nextPart,
		rehearsal: !!cache.Playlist.doc.rehearsal,
		timings: {
			setAsNext: getCurrentTime(),
		},
	}
	cache.PartInstances.insert(instance)

	const rundown = cache.Rundowns.findOne(nextPart.rundownId)
	if (!rundown) throw new Error(`Could not find rundown ${nextPart.rundownId}`)

	const possiblePieces = await fetchPiecesThatMayBeActiveForPart(context, cache, undefined, nextPart)
	const newPieceInstances = getPieceInstancesForPart(
		context,
		cache,
		currentPartInstance,
		rundown,
		nextPart,
		possiblePieces,
		partInstanceId
	)
	for (const pieceInstance of newPieceInstances) {
		cache.PieceInstances.insert(pieceInstance)
	}

	return instance
}

function discardUntakenPartInstances(cache: CacheForPlayout) {
	const instancesIdsToRemove = cache.PartInstances.remove(
		(p) =>
			!p.isTaken &&
			p._id !== cache.Playlist.doc.nextPartInfo?.partInstanceId &&
			p._id !== cache.Playlist.doc.currentPartInfo?.partInstanceId
	)
	cache.PieceInstances.remove((p) => instancesIdsToRemove.includes(p.partInstanceId))
}

/**
 * When entering a segment, or moving backwards in a segment, reset any partInstances in that window
 * In theory the new segment should already be reset, as we do that upon leaving, but it wont be if jumping to earlier in the same segment or maybe if the rundown wasnt reset
 */
function resetPartInstancesWhenChangingSegment(context: JobContext, cache: CacheForPlayout) {
	const { currentPartInstance, nextPartInstance } = getSelectedPartInstancesFromCache(cache)
	if (nextPartInstance) {
		const resetPartInstanceIds = new Set<PartInstanceId>()
		if (currentPartInstance) {
			// Always clean the current segment, anything after the current part (except the next part)
			const trailingInOldSegment = cache.PartInstances.findAll(
				(p) =>
					!p.reset &&
					p._id !== currentPartInstance._id &&
					p._id !== nextPartInstance._id &&
					p.segmentId === currentPartInstance.segmentId &&
					p.part._rank > currentPartInstance.part._rank
			)

			for (const part of trailingInOldSegment) {
				resetPartInstanceIds.add(part._id)
			}
		}

		if (
			!currentPartInstance ||
			nextPartInstance.segmentId !== currentPartInstance.segmentId ||
			(nextPartInstance.segmentId === currentPartInstance.segmentId &&
				nextPartInstance.part._rank < currentPartInstance.part._rank)
		) {
			// clean the whole segment if new, or jumping backwards
			const newSegmentParts = cache.PartInstances.findAll(
				(p) =>
					!p.reset &&
					p._id !== nextPartInstance._id &&
					p._id !== currentPartInstance?._id &&
					p.segmentId === nextPartInstance.segmentId
			)
			for (const part of newSegmentParts) {
				resetPartInstanceIds.add(part._id)
			}
		}

		if (resetPartInstanceIds.size > 0) {
			resetPartInstancesWithPieceInstances(context, cache, {
				_id: { $in: Array.from(resetPartInstanceIds) },
			})
		}
	}
}

/**
 * Cleanup any orphaned (deleted) segments and partinstances once they are no longer being played
 * @param cache
 */
async function cleanupOrphanedItems(context: JobContext, cache: CacheForPlayout) {
	const playlist = cache.Playlist.doc

	const selectedPartInstancesSegmentIds = new Set<SegmentId>()
	const selectedPartInstances = getSelectedPartInstancesFromCache(cache)
	if (selectedPartInstances.currentPartInstance)
		selectedPartInstancesSegmentIds.add(selectedPartInstances.currentPartInstance.segmentId)
	if (selectedPartInstances.nextPartInstance)
		selectedPartInstancesSegmentIds.add(selectedPartInstances.nextPartInstance.segmentId)

	// Cleanup any orphaned segments once they are no longer being played. This also cleans up any adlib-parts, that have been marked as deleted as a deferred cleanup operation
	const segments = cache.Segments.findAll((s) => !!s.orphaned)
	const orphanedSegmentIds = new Set(segments.map((s) => s._id))

	const alterSegmentsFromRundowns = new Map<RundownId, { deleted: SegmentId[]; hidden: SegmentId[] }>()
	for (const segment of segments) {
		// If the segment is orphaned and not the segment for the next or current partinstance
		if (!selectedPartInstancesSegmentIds.has(segment._id)) {
			let rundownSegments = alterSegmentsFromRundowns.get(segment.rundownId)
			if (!rundownSegments) {
				rundownSegments = { deleted: [], hidden: [] }
				alterSegmentsFromRundowns.set(segment.rundownId, rundownSegments)
			}
			// The segment is finished with. Queue it for attempted removal or reingest
			switch (segment.orphaned) {
				case SegmentOrphanedReason.DELETED: {
					rundownSegments.deleted.push(segment._id)
					break
				}
				case SegmentOrphanedReason.HIDDEN: {
					// The segment is finished with. Queue it for attempted resync
					rundownSegments.hidden.push(segment._id)
					break
				}
			}
		}
	}

	// We need to run this outside of the current lock, and within an ingest lock, so defer to the work queue
	for (const [rundownId, candidateSegmentIds] of alterSegmentsFromRundowns) {
		const rundown = cache.Rundowns.findOne(rundownId)
		if (rundown?.restoredFromSnapshotId) {
			// This is not valid as the rundownId won't match the externalId, so ingest will fail
			// For now do nothing
		} else if (rundown) {
			await context.queueIngestJob(IngestJobs.RemoveOrphanedSegments, {
				rundownExternalId: rundown.externalId,
				peripheralDeviceId: null,
				orphanedHiddenSegmentIds: candidateSegmentIds.hidden,
				orphanedDeletedSegmentIds: candidateSegmentIds.deleted,
			})
		}
	}

	const removePartInstanceIds: PartInstanceId[] = []
	// Cleanup any orphaned partinstances once they are no longer being played (and the segment isnt orphaned)
	const orphanedInstances = cache.PartInstances.findAll((p) => p.orphaned === 'deleted' && !p.reset)
	for (const partInstance of orphanedInstances) {
		if (PRESERVE_UNSYNCED_PLAYING_SEGMENT_CONTENTS && orphanedSegmentIds.has(partInstance.segmentId)) {
			// If the segment is also orphaned, then don't delete it until it is clear
			continue
		}

		if (
			partInstance._id !== playlist.currentPartInfo?.partInstanceId &&
			partInstance._id !== playlist.nextPartInfo?.partInstanceId
		) {
			removePartInstanceIds.push(partInstance._id)
		}
	}

	// Cleanup any instances from above
	if (removePartInstanceIds.length > 0) {
		resetPartInstancesWithPieceInstances(context, cache, { _id: { $in: removePartInstanceIds } })
	}
}

/**
 * Set or clear the nexted-segment.
 * @param context Context for the running job
 * @param cache The playout cache of the playlist
 * @param nextSegment The segment to set as next, or null to clear it
 */
export async function setNextSegment(
	context: JobContext,
	cache: CacheForPlayout,
	nextSegment: DBSegment | null
): Promise<void> {
	const span = context.startSpan('setNextSegment')
	if (nextSegment) {
		// Just run so that errors will be thrown if something wrong:
		const partsInSegment = sortPartsInSortedSegments(
			cache.Parts.findAll((p) => p.segmentId === nextSegment._id),
			[nextSegment]
		)
		const firstPlayablePart = partsInSegment.find((p) => isPartPlayable(p))
		if (!firstPlayablePart) {
			throw new Error('Segment contains no valid parts')
		}

		const { nextPartInstance, currentPartInstance } = getSelectedPartInstancesFromCache(cache)

		// if there is not currentPartInstance or the nextPartInstance is not in the current segment
		// behave as if user chose SetNextPart on the first playable part of the segment
		if (currentPartInstance === undefined || currentPartInstance.segmentId !== nextPartInstance?.segmentId) {
			// Clear any existing nextSegment, as this call 'replaces' it
			cache.Playlist.update((p) => {
				delete p.nextSegmentId
				return p
			})

			return setNextPart(
				context,
				cache,
				{
					part: firstPlayablePart,
					consumesNextSegmentId: false,
				},
				true
			)
		}

		cache.Playlist.update((p) => {
			p.nextSegmentId = nextSegment._id
			return p
		})
	} else {
		cache.Playlist.update((p) => {
			delete p.nextSegmentId
			return p
		})
	}
	if (span) span.end()
}

/**
 * Set the nexted part, from a given DBPart
 * @param context Context for the running job
 * @param cache The playout cache of the playlist
 * @param nextPart The Part to set as next
 * @param setManually Whether this was manually chosen by the user
 * @param nextTimeOffset The offset into the Part to start playback
 */
export async function setNextPartFromPart(
	context: JobContext,
	cache: CacheForPlayout,
	nextPart: DBPart,
	setManually: boolean,
	nextTimeOffset?: number | undefined
): Promise<void> {
	const playlist = cache.Playlist.doc
	if (!playlist.activationId) throw UserError.create(UserErrorMessage.InactiveRundown)
	if (playlist.holdState === RundownHoldState.ACTIVE || playlist.holdState === RundownHoldState.PENDING) {
		throw UserError.create(UserErrorMessage.DuringHold)
	}

	const consumesNextSegmentId = doesPartConsumeNextSegmentId(cache, nextPart)

	await setNextPart(context, cache, { part: nextPart, consumesNextSegmentId }, setManually, nextTimeOffset)
}

function doesPartConsumeNextSegmentId(cache: CacheForPlayout, nextPart: DBPart) {
	// If we're setting the next point to somewhere other than the current segment, and in the queued segment, clear the queued segment
	const playlist = cache.Playlist.doc
	const { currentPartInstance } = getSelectedPartInstancesFromCache(cache)
	return !!(
		currentPartInstance &&
		currentPartInstance.segmentId !== nextPart.segmentId &&
		playlist.nextSegmentId === nextPart.segmentId
	)
}
