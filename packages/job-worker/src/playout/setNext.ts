import { assertNever } from '@sofie-automation/corelib/dist/lib'
import { SegmentOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { DBPart, isPartPlayable } from '@sofie-automation/corelib/dist/dataModel/Part'
import { JobContext } from '../jobs'
import { PartId, PartInstanceId, RundownId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PlayoutModel } from './model/PlayoutModel'
import { PlayoutPartInstanceModel } from './model/PlayoutPartInstanceModel'
import { PlayoutSegmentModel } from './model/PlayoutSegmentModel'
import {
	fetchPiecesThatMayBeActiveForPart,
	getPieceInstancesForPart,
	syncPlayheadInfinitesForNextPartInstance,
} from './infinites'
import { PRESERVE_UNSYNCED_PLAYING_SEGMENT_CONTENTS } from '@sofie-automation/shared-lib/dist/core/constants'
import { IngestJobs } from '@sofie-automation/corelib/dist/worker/ingest'
import _ = require('underscore')
import { resetPartInstancesWithPieceInstances } from './lib'
import { RundownHoldState } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { UserError, UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import { SelectNextPartResult } from './selectNextPart'
import { ReadonlyDeep } from 'type-fest'
import { QueueNextSegmentResult } from '@sofie-automation/corelib/dist/worker/studio'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'

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
	cache: PlayoutModel,
	rawNextPart: ReadonlyDeep<Omit<SelectNextPartResult, 'index'>> | PlayoutPartInstanceModel | null,
	setManually: boolean,
	nextTimeOffset?: number | undefined
): Promise<void> {
	const span = context.startSpan('setNextPart')

	const rundownIds = cache.getRundownIds()
	const currentPartInstance = cache.CurrentPartInstance
	const nextPartInstance = cache.NextPartInstance

	if (rawNextPart) {
		if (!cache.Playlist.activationId) throw new Error(`RundownPlaylist "${cache.Playlist._id}" is not active`)

		// create new instance
		let newPartInstance: PlayoutPartInstanceModel
		let consumesQueuedSegmentId: boolean
		if ('PartInstance' in rawNextPart) {
			const inputPartInstance: PlayoutPartInstanceModel = rawNextPart
			if (inputPartInstance.PartInstance.part.invalid) {
				throw new Error('Part is marked as invalid, cannot set as next.')
			}

			if (!rundownIds.includes(inputPartInstance.PartInstance.rundownId)) {
				throw new Error(
					`PartInstance "${inputPartInstance.PartInstance._id}" of rundown "${inputPartInstance.PartInstance.rundownId}" not part of RundownPlaylist "${cache.Playlist._id}"`
				)
			}

			consumesQueuedSegmentId = false
			newPartInstance = await prepareExistingPartInstanceForBeingNexted(context, cache, inputPartInstance)
		} else {
			const selectedPart: ReadonlyDeep<Omit<SelectNextPartResult, 'index'>> = rawNextPart
			if (selectedPart.part.invalid) {
				throw new Error('Part is marked as invalid, cannot set as next.')
			}

			if (!rundownIds.includes(selectedPart.part.rundownId)) {
				throw new Error(
					`Part "${selectedPart.part._id}" of rundown "${selectedPart.part.rundownId}" not part of RundownPlaylist "${cache.Playlist._id}"`
				)
			}

			consumesQueuedSegmentId = selectedPart.consumesQueuedSegmentId ?? false

			if (nextPartInstance && nextPartInstance.PartInstance.part._id === selectedPart.part._id) {
				// Re-use existing

				newPartInstance = await prepareExistingPartInstanceForBeingNexted(context, cache, nextPartInstance)
			} else {
				// Create new instance
				newPartInstance = await preparePartInstanceForPartBeingNexted(
					context,
					cache,
					currentPartInstance,
					selectedPart.part
				)
			}
		}

		const selectedPartInstanceIds = _.compact([
			newPartInstance.PartInstance._id,
			cache.Playlist.currentPartInfo?.partInstanceId,
			cache.Playlist.previousPartInfo?.partInstanceId,
		])

		// reset any previous instances of this part
		resetPartInstancesWithPieceInstances(context, cache, {
			_id: { $nin: selectedPartInstanceIds },
			rundownId: newPartInstance.PartInstance.rundownId,
			'part._id': newPartInstance.PartInstance.part._id,
		})

		cache.setPartInstanceAsNext(newPartInstance, setManually, consumesQueuedSegmentId, nextTimeOffset)
	} else {
		// Set to null

		cache.setPartInstanceAsNext(null, setManually, false, nextTimeOffset)
	}

	cache.removeUntakenPartInstances()

	resetPartInstancesWhenChangingSegment(context, cache)

	await cleanupOrphanedItems(context, cache)

	if (span) span.end()
}

async function prepareExistingPartInstanceForBeingNexted(
	context: JobContext,
	cache: PlayoutModel,
	instance: PlayoutPartInstanceModel
): Promise<PlayoutPartInstanceModel> {
	await syncPlayheadInfinitesForNextPartInstance(context, cache, cache.CurrentPartInstance, instance)

	return instance
}

async function preparePartInstanceForPartBeingNexted(
	context: JobContext,
	cache: PlayoutModel,
	currentPartInstance: PlayoutPartInstanceModel | null,
	nextPart: ReadonlyDeep<DBPart>
): Promise<PlayoutPartInstanceModel> {
	const rundown = cache.getRundown(nextPart.rundownId)
	if (!rundown) throw new Error(`Could not find rundown ${nextPart.rundownId}`)

	const possiblePieces = await fetchPiecesThatMayBeActiveForPart(context, cache, undefined, nextPart)
	const newPieceInstances = getPieceInstancesForPart(
		context,
		cache,
		currentPartInstance,
		rundown,
		nextPart,
		possiblePieces,
		protectString('') // Replaced inside cache.createInstanceForPart
	)

	return cache.createInstanceForPart(nextPart, newPieceInstances)
}

/**
 * When entering a segment, or moving backwards in a segment, reset any partInstances in that window
 * In theory the new segment should already be reset, as we do that upon leaving, but it wont be if jumping to earlier in the same segment or maybe if the rundown wasnt reset
 */
function resetPartInstancesWhenChangingSegment(context: JobContext, cache: PlayoutModel) {
	const currentPartInstance = cache.CurrentPartInstance?.PartInstance
	const nextPartInstance = cache.NextPartInstance?.PartInstance

	if (nextPartInstance) {
		const resetPartInstanceIds = new Set<PartInstanceId>()
		if (currentPartInstance) {
			// Always clean the current segment, anything after the current part (except the next part)
			const trailingInOldSegment = cache.LoadedPartInstances.filter(
				(p) =>
					!p.PartInstance.reset &&
					p.PartInstance._id !== currentPartInstance._id &&
					p.PartInstance._id !== nextPartInstance._id &&
					p.PartInstance.segmentId === currentPartInstance.segmentId &&
					p.PartInstance.part._rank > currentPartInstance.part._rank
			)

			for (const part of trailingInOldSegment) {
				resetPartInstanceIds.add(part.PartInstance._id)
			}
		}

		if (
			!currentPartInstance ||
			nextPartInstance.segmentId !== currentPartInstance.segmentId ||
			(nextPartInstance.segmentId === currentPartInstance.segmentId &&
				nextPartInstance.part._rank < currentPartInstance.part._rank)
		) {
			// clean the whole segment if new, or jumping backwards
			const newSegmentParts = cache.LoadedPartInstances.filter(
				(p) =>
					!p.PartInstance.reset &&
					p.PartInstance._id !== nextPartInstance._id &&
					p.PartInstance._id !== currentPartInstance?._id &&
					p.PartInstance.segmentId === nextPartInstance.segmentId
			)
			for (const part of newSegmentParts) {
				resetPartInstanceIds.add(part.PartInstance._id)
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
async function cleanupOrphanedItems(context: JobContext, cache: PlayoutModel) {
	const playlist = cache.Playlist

	const selectedPartInstancesSegmentIds = new Set<SegmentId>()

	const currentPartInstance = cache.CurrentPartInstance?.PartInstance
	const nextPartInstance = cache.NextPartInstance?.PartInstance

	if (currentPartInstance) selectedPartInstancesSegmentIds.add(currentPartInstance.segmentId)
	if (nextPartInstance) selectedPartInstancesSegmentIds.add(nextPartInstance.segmentId)

	// Cleanup any orphaned segments once they are no longer being played. This also cleans up any adlib-parts, that have been marked as deleted as a deferred cleanup operation
	const segments = cache.getAllOrderedSegments().filter((s) => !!s.Segment.orphaned)
	const orphanedSegmentIds = new Set(segments.map((s) => s.Segment._id))

	const alterSegmentsFromRundowns = new Map<RundownId, { deleted: SegmentId[]; hidden: SegmentId[] }>()
	for (const segment of segments) {
		// If the segment is orphaned and not the segment for the next or current partinstance
		if (!selectedPartInstancesSegmentIds.has(segment.Segment._id)) {
			let rundownSegments = alterSegmentsFromRundowns.get(segment.Segment.rundownId)
			if (!rundownSegments) {
				rundownSegments = { deleted: [], hidden: [] }
				alterSegmentsFromRundowns.set(segment.Segment.rundownId, rundownSegments)
			}
			// The segment is finished with. Queue it for attempted removal or reingest
			switch (segment.Segment.orphaned) {
				case SegmentOrphanedReason.DELETED: {
					rundownSegments.deleted.push(segment.Segment._id)
					break
				}
				case SegmentOrphanedReason.HIDDEN: {
					// The segment is finished with. Queue it for attempted resync
					rundownSegments.hidden.push(segment.Segment._id)
					break
				}
				case SegmentOrphanedReason.SCRATCHPAD:
					// Ignore, as these are owned by playout not ingest
					break
				case undefined:
					// Not orphaned
					break
				default:
					assertNever(segment.Segment.orphaned)
					break
			}
		}
	}

	// We need to run this outside of the current lock, and within an ingest lock, so defer to the work queue
	for (const [rundownId, candidateSegmentIds] of alterSegmentsFromRundowns) {
		const rundown = cache.getRundown(rundownId)
		if (rundown?.Rundown?.restoredFromSnapshotId) {
			// This is not valid as the rundownId won't match the externalId, so ingest will fail
			// For now do nothing
		} else if (rundown) {
			await context.queueIngestJob(IngestJobs.RemoveOrphanedSegments, {
				rundownExternalId: rundown.Rundown.externalId,
				peripheralDeviceId: null,
				orphanedHiddenSegmentIds: candidateSegmentIds.hidden,
				orphanedDeletedSegmentIds: candidateSegmentIds.deleted,
			})
		}
	}

	const removePartInstanceIds: PartInstanceId[] = []
	// Cleanup any orphaned partinstances once they are no longer being played (and the segment isnt orphaned)
	const orphanedInstances = cache.LoadedPartInstances.filter(
		(p) => p.PartInstance.orphaned === 'deleted' && !p.PartInstance.reset
	)
	for (const partInstance of orphanedInstances) {
		if (PRESERVE_UNSYNCED_PLAYING_SEGMENT_CONTENTS && orphanedSegmentIds.has(partInstance.PartInstance.segmentId)) {
			// If the segment is also orphaned, then don't delete it until it is clear
			continue
		}

		if (
			partInstance.PartInstance._id !== playlist.currentPartInfo?.partInstanceId &&
			partInstance.PartInstance._id !== playlist.nextPartInfo?.partInstanceId
		) {
			removePartInstanceIds.push(partInstance.PartInstance._id)
		}
	}

	// Cleanup any instances from above
	if (removePartInstanceIds.length > 0) {
		resetPartInstancesWithPieceInstances(context, cache, { _id: { $in: removePartInstanceIds } })
	}
}

/**
 * Set or clear the queued segment.
 * @param context Context for the running job
 * @param cache The playout cache of the playlist
 * @param queuedSegment The segment to queue, or null to clear it
 */
export async function queueNextSegment(
	context: JobContext,
	cache: PlayoutModel,
	queuedSegment: PlayoutSegmentModel | null
): Promise<QueueNextSegmentResult> {
	const span = context.startSpan('queueNextSegment')
	if (queuedSegment) {
		if (queuedSegment.Segment.orphaned === SegmentOrphanedReason.SCRATCHPAD)
			throw new Error(`Segment "${queuedSegment.Segment._id}" is a scratchpad, and cannot be queued!`)

		// Just run so that errors will be thrown if something wrong:
		const firstPlayablePart = findFirstPlayablePartOrThrow(queuedSegment)

		const currentPartInstance = cache.CurrentPartInstance?.PartInstance
		const nextPartInstance = cache.NextPartInstance?.PartInstance

		// if there is not currentPartInstance or the nextPartInstance is not in the current segment
		// behave as if user chose SetNextPart on the first playable part of the segment
		if (currentPartInstance === undefined || currentPartInstance.segmentId !== nextPartInstance?.segmentId) {
			// Clear any existing nextSegment, as this call 'replaces' it
			cache.setQueuedSegment(null)

			await setNextPart(
				context,
				cache,
				{
					part: firstPlayablePart,
					consumesQueuedSegmentId: false,
				},
				true
			)

			span?.end()
			return { nextPartId: firstPlayablePart._id }
		}

		cache.setQueuedSegment(queuedSegment)
	} else {
		cache.setQueuedSegment(null)
	}
	span?.end()
	return { queuedSegmentId: queuedSegment?.Segment?._id ?? null }
}

/**
 * Set the first playable part of a given segment as next.
 * @param context Context for the running job
 * @param cache The playout cache of the playlist
 * @param nextSegment The segment, whose first part is to be set as next
 */
export async function setNextSegment(
	context: JobContext,
	cache: PlayoutModel,
	nextSegment: PlayoutSegmentModel
): Promise<PartId> {
	const span = context.startSpan('setNextSegment')
	// Just run so that errors will be thrown if something wrong:
	const firstPlayablePart = findFirstPlayablePartOrThrow(nextSegment)

	cache.setQueuedSegment(null)

	await setNextPart(
		context,
		cache,
		{
			part: firstPlayablePart,
			consumesQueuedSegmentId: false,
		},
		true
	)

	if (span) span.end()
	return firstPlayablePart._id
}

function findFirstPlayablePartOrThrow(segment: PlayoutSegmentModel): ReadonlyDeep<DBPart> {
	const firstPlayablePart = segment.Parts.find((p) => isPartPlayable(p))
	if (!firstPlayablePart) {
		throw new Error('Segment contains no valid parts')
	}
	return firstPlayablePart
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
	cache: PlayoutModel,
	nextPart: ReadonlyDeep<DBPart>,
	setManually: boolean,
	nextTimeOffset?: number | undefined
): Promise<void> {
	const playlist = cache.Playlist
	if (!playlist.activationId) throw UserError.create(UserErrorMessage.InactiveRundown)
	if (playlist.holdState === RundownHoldState.ACTIVE || playlist.holdState === RundownHoldState.PENDING) {
		throw UserError.create(UserErrorMessage.DuringHold)
	}

	const consumesQueuedSegmentId = doesPartConsumeQueuedSegmentId(cache, nextPart)

	await setNextPart(context, cache, { part: nextPart, consumesQueuedSegmentId }, setManually, nextTimeOffset)
}

function doesPartConsumeQueuedSegmentId(cache: PlayoutModel, nextPart: ReadonlyDeep<DBPart>) {
	// If we're setting the next point to somewhere other than the current segment, and in the queued segment, clear the queued segment
	const playlist = cache.Playlist
	const currentPartInstance = cache.CurrentPartInstance?.PartInstance

	return !!(
		currentPartInstance &&
		currentPartInstance.segmentId !== nextPart.segmentId &&
		playlist.queuedSegmentId === nextPart.segmentId
	)
}
