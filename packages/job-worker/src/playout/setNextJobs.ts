import { PartId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBPart, isPartPlayable } from '@sofie-automation/corelib/dist/dataModel/Part'
import { RundownHoldState } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { UserError, UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import { SetNextPartProps, MoveNextPartProps, SetNextSegmentProps } from '@sofie-automation/corelib/dist/worker/studio'
import { JobContext } from '../jobs'
import { runJobWithPlayoutCache } from './lock'
import { setNextPartInner, moveNextPartInner, setNextSegment } from './setNext'
import { updateTimeline } from './timeline/generate'

/**
 * Set the next Part to a specified id
 */
export async function handleSetNextPart(context: JobContext, data: SetNextPartProps): Promise<void> {
	return runJobWithPlayoutCache(
		context,
		data,
		async (cache) => {
			const playlist = cache.Playlist.doc

			if (!playlist.activationId) throw UserError.create(UserErrorMessage.InactiveRundown, undefined, 412)
			if (playlist.holdState && playlist.holdState !== RundownHoldState.COMPLETE) {
				throw UserError.create(UserErrorMessage.DuringHold, undefined, 412)
			}
		},
		async (cache) => {
			let nextPart: DBPart | undefined
			if (data.nextPartId) {
				// Ensure the part is playable and found
				nextPart = cache.Parts.findOne(data.nextPartId)
				if (!nextPart) throw UserError.create(UserErrorMessage.PartNotFound, undefined, 404)
				if (!isPartPlayable(nextPart)) throw UserError.create(UserErrorMessage.PartNotPlayable, undefined, 412)
			}

			await setNextPartInner(
				context,
				cache,
				nextPart ?? null,
				data.setManually,
				data.nextTimeOffset,
				data.clearNextSegment
			)
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

			const playlist = cache.Playlist.doc

			if (!playlist.activationId) throw UserError.create(UserErrorMessage.InactiveRundown, undefined, 412)
			if (playlist.holdState === RundownHoldState.ACTIVE || playlist.holdState === RundownHoldState.PENDING) {
				throw UserError.create(UserErrorMessage.DuringHold, undefined, 412)
			}

			if (!playlist.nextPartInfo && !playlist.currentPartInfo) {
				throw UserError.create(UserErrorMessage.NoCurrentOrNextPart, undefined, 412)
			}
		},
		async (cache) => {
			return moveNextPartInner(context, cache, data.partDelta, data.segmentDelta)
		}
	)
}

/**
 * Set the next Segment to a specified id
 */
export async function handleSetNextSegment(context: JobContext, data: SetNextSegmentProps): Promise<void> {
	return runJobWithPlayoutCache(
		context,
		data,
		async (cache) => {
			const playlist = cache.Playlist.doc
			if (!playlist.activationId) throw UserError.create(UserErrorMessage.InactiveRundown, undefined, 412)

			if (playlist.holdState && playlist.holdState !== RundownHoldState.COMPLETE) {
				throw UserError.create(UserErrorMessage.DuringHold, undefined, 412)
			}
		},
		async (cache) => {
			let nextSegment: DBSegment | null = null
			if (data.nextSegmentId) {
				nextSegment = cache.Segments.findOne(data.nextSegmentId) || null
				if (!nextSegment) throw new Error(`Segment "${data.nextSegmentId}" not found!`)
			}

			setNextSegment(context, cache, nextSegment)

			// Update any future lookaheads
			await updateTimeline(context, cache)
		}
	)
}
