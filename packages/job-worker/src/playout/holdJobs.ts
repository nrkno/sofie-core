import { PartHoldMode } from '@sofie-automation/blueprints-integration'
import { RundownHoldState } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { UserError, UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import { ActivateHoldProps, DeactivateHoldProps } from '@sofie-automation/corelib/dist/worker/studio'
import { JobContext } from '../jobs'
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
			const playlist = cache.Playlist

			if (!playlist.activationId) throw UserError.create(UserErrorMessage.InactiveRundown)

			if (!playlist.currentPartInfo) throw UserError.create(UserErrorMessage.NoCurrentPart)
			if (!playlist.nextPartInfo) throw UserError.create(UserErrorMessage.HoldNeedsNextPart)

			if (playlist.holdState) throw UserError.create(UserErrorMessage.HoldAlreadyActive)
		},
		async (cache) => {
			const playlist = cache.Playlist
			const currentPartInstance = cache.CurrentPartInstance
			if (!currentPartInstance)
				throw new Error(`PartInstance "${playlist.currentPartInfo?.partInstanceId}" not found!`)
			const nextPartInstance = cache.NextPartInstance
			if (!nextPartInstance) throw new Error(`PartInstance "${playlist.nextPartInfo?.partInstanceId}" not found!`)

			if (
				currentPartInstance.PartInstance.part.holdMode !== PartHoldMode.FROM ||
				nextPartInstance.PartInstance.part.holdMode !== PartHoldMode.TO ||
				currentPartInstance.PartInstance.part.segmentId !== nextPartInstance.PartInstance.part.segmentId
			) {
				throw UserError.create(UserErrorMessage.HoldIncompatibleParts)
			}

			const hasDynamicallyInserted = currentPartInstance.PieceInstances.find(
				(p) =>
					!!p.dynamicallyInserted &&
					// If its a continuation of an infinite adlib it is probably a graphic, so is 'fine'
					!p.infinite?.fromPreviousPart &&
					!p.infinite?.fromPreviousPlayhead
			)
			if (hasDynamicallyInserted) throw UserError.create(UserErrorMessage.HoldAfterAdlib)

			cache.setHoldState(RundownHoldState.PENDING)

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
			const playlist = cache.Playlist

			if (!playlist.activationId) throw UserError.create(UserErrorMessage.InactiveRundown)

			if (playlist.holdState !== RundownHoldState.PENDING)
				throw UserError.create(UserErrorMessage.HoldNotCancelable)
		},
		async (cache) => {
			cache.setHoldState(RundownHoldState.NONE)

			await updateTimeline(context, cache)
		}
	)
}
