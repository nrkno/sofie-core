import { PartHoldMode } from '@sofie-automation/blueprints-integration'
import { RundownHoldState } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { UserError, UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import { ActivateHoldProps, DeactivateHoldProps } from '@sofie-automation/corelib/dist/worker/studio'
import { JobContext } from '../jobs'
import { getSelectedPartInstancesFromCache } from './cache'
import { runJobWithPlayoutCache } from './lock'
import { updateTimeline } from './timeline/generate'

/**
 * Activate Hold
 */
export async function handleActivateHold(context: JobContext, data: ActivateHoldProps): Promise<void> {
	return runJobWithPlayoutCache(
		context,
		data,
		async (cache) => {
			const playlist = cache.Playlist.doc

			if (!playlist.activationId) throw UserError.create(UserErrorMessage.InactiveRundown)

			if (!playlist.currentPartInfo) throw UserError.create(UserErrorMessage.NoCurrentPart)
			if (!playlist.nextPartInfo) throw UserError.create(UserErrorMessage.HoldNeedsNextPart)

			if (playlist.holdState) throw UserError.create(UserErrorMessage.HoldAlreadyActive)
		},
		async (cache) => {
			const playlist = cache.Playlist.doc
			const { currentPartInstance, nextPartInstance } = getSelectedPartInstancesFromCache(cache)
			if (!currentPartInstance)
				throw new Error(`PartInstance "${playlist.currentPartInfo?.partInstanceId}" not found!`)
			if (!nextPartInstance) throw new Error(`PartInstance "${playlist.nextPartInfo?.partInstanceId}" not found!`)

			if (
				currentPartInstance.part.holdMode !== PartHoldMode.FROM ||
				nextPartInstance.part.holdMode !== PartHoldMode.TO ||
				currentPartInstance.part.segmentId !== nextPartInstance.part.segmentId
			) {
				throw UserError.create(UserErrorMessage.HoldIncompatibleParts)
			}

			const hasDynamicallyInserted = cache.PieceInstances.findOne(
				(p) =>
					p.partInstanceId === currentPartInstance._id &&
					!!p.dynamicallyInserted &&
					// If its a continuation of an infinite adlib it is probably a graphic, so is 'fine'
					!p.infinite?.fromPreviousPart &&
					!p.infinite?.fromPreviousPlayhead
			)
			if (hasDynamicallyInserted) throw UserError.create(UserErrorMessage.HoldAfterAdlib)

			cache.Playlist.update((p) => {
				p.holdState = RundownHoldState.PENDING
				return p
			})

			await updateTimeline(context, cache)
		}
	)
}

/**
 * Deactivate Hold
 */
export async function handleDeactivateHold(context: JobContext, data: DeactivateHoldProps): Promise<void> {
	return runJobWithPlayoutCache(
		context,
		data,
		async (cache) => {
			const playlist = cache.Playlist.doc

			if (!playlist.activationId) throw UserError.create(UserErrorMessage.InactiveRundown)

			if (playlist.holdState !== RundownHoldState.PENDING)
				throw UserError.create(UserErrorMessage.HoldNotCancelable)
		},
		async (cache) => {
			cache.Playlist.update((p) => {
				p.holdState = RundownHoldState.NONE
				return p
			})

			await updateTimeline(context, cache)
		}
	)
}
