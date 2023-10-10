import { PartId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { isPartPlayable } from '@sofie-automation/corelib/dist/dataModel/Part'
import { RundownHoldState } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { UserError, UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import {
	SetNextPartProps,
	MoveNextPartProps,
	SetNextSegmentProps,
	QueueNextSegmentProps,
	QueueNextSegmentResult,
} from '@sofie-automation/corelib/dist/worker/studio'
import { JobContext } from '../jobs'
import { runJobWithPlayoutCache } from './lock'
import { setNextPartFromPart, setNextSegment, queueNextSegment } from './setNext'
import { moveNextPart } from './moveNextPart'
import { updateTimeline } from './timeline/generate'
import { PlayoutSegmentModel } from './model/PlayoutSegmentModel'
import { ReadonlyDeep } from 'type-fest'

/**
 * Set the next Part to a specified id
 */
export async function handleSetNextPart(context: JobContext, data: SetNextPartProps): Promise<void> {
	return runJobWithPlayoutCache(
		context,
		data,
		async (cache) => {
			const playlist = cache.Playlist

			if (!playlist.activationId) throw UserError.create(UserErrorMessage.InactiveRundown, undefined, 412)
			if (playlist.holdState && playlist.holdState !== RundownHoldState.COMPLETE) {
				throw UserError.create(UserErrorMessage.DuringHold, undefined, 412)
			}
		},
		async (cache) => {
			// Ensure the part is playable and found
			const nextPart = cache.findPart(data.nextPartId)
			if (!nextPart) throw UserError.create(UserErrorMessage.PartNotFound, undefined, 404)
			if (!isPartPlayable(nextPart)) throw UserError.create(UserErrorMessage.PartNotPlayable, undefined, 412)

			await setNextPartFromPart(context, cache, nextPart, data.setManually ?? false, data.nextTimeOffset)

			await updateTimeline(context, cache)
		}
	)
}

/**
 * Move which Part is nexted by a Part(horizontal) or Segment (vertical) delta
 */
export async function handleMoveNextPart(context: JobContext, data: MoveNextPartProps): Promise<PartId | null> {
	return runJobWithPlayoutCache(
		context,
		data,
		async (cache) => {
			if (!data.partDelta && !data.segmentDelta)
				throw new Error(`rundownMoveNext: invalid delta: (${data.partDelta}, ${data.segmentDelta})`)

			const playlist = cache.Playlist

			if (!playlist.activationId) throw UserError.create(UserErrorMessage.InactiveRundown, undefined, 412)
			if (playlist.holdState === RundownHoldState.ACTIVE || playlist.holdState === RundownHoldState.PENDING) {
				throw UserError.create(UserErrorMessage.DuringHold, undefined, 412)
			}

			if (!playlist.nextPartInfo && !playlist.currentPartInfo) {
				throw UserError.create(UserErrorMessage.NoCurrentOrNextPart, undefined, 412)
			}
		},
		async (cache) => {
			const newPartId = await moveNextPart(context, cache, data.partDelta, data.segmentDelta)

			if (newPartId) await updateTimeline(context, cache)

			return newPartId
		}
	)
}

/**
 * Set the next part to the first part of a Segment with given id
 */
export async function handleSetNextSegment(context: JobContext, data: SetNextSegmentProps): Promise<PartId> {
	return runJobWithPlayoutCache(
		context,
		data,
		async (cache) => {
			const playlist = cache.Playlist
			if (!playlist.activationId) throw UserError.create(UserErrorMessage.InactiveRundown, undefined, 412)

			if (playlist.holdState && playlist.holdState !== RundownHoldState.COMPLETE) {
				throw UserError.create(UserErrorMessage.DuringHold, undefined, 412)
			}
		},
		async (cache) => {
			const nextSegment = cache.findSegment(data.nextSegmentId)
			if (!nextSegment) throw new Error(`Segment "${data.nextSegmentId}" not found!`)

			const nextedPartId = await setNextSegment(context, cache, nextSegment)

			// Update any future lookaheads
			await updateTimeline(context, cache)

			return nextedPartId
		}
	)
}

/**
 * Set the next part to the first part of a given Segment to a specified id
 */
export async function handleQueueNextSegment(
	context: JobContext,
	data: QueueNextSegmentProps
): Promise<QueueNextSegmentResult> {
	return runJobWithPlayoutCache(
		context,
		data,
		async (cache) => {
			const playlist = cache.Playlist
			if (!playlist.activationId) throw UserError.create(UserErrorMessage.InactiveRundown, undefined, 412)

			if (playlist.holdState && playlist.holdState !== RundownHoldState.COMPLETE) {
				throw UserError.create(UserErrorMessage.DuringHold, undefined, 412)
			}
		},
		async (cache) => {
			let queuedSegment: ReadonlyDeep<PlayoutSegmentModel> | null = null
			if (data.queuedSegmentId) {
				queuedSegment = cache.findSegment(data.queuedSegmentId) ?? null
				if (!queuedSegment) throw new Error(`Segment "${data.queuedSegmentId}" not found!`)
			}

			const result = await queueNextSegment(context, cache, queuedSegment)

			// Update any future lookaheads
			await updateTimeline(context, cache)

			return result
		}
	)
}
