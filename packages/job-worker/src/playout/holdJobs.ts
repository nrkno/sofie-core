import { PartHoldMode } from '@sofie-automation/blueprints-integration'
import { RundownHoldState } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { UserError, UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import { ActivateHoldProps, DeactivateHoldProps } from '@sofie-automation/corelib/dist/worker/studio'
import { JobContext } from '../jobs'
import { runJobWithPlayoutModel } from './lock'
import { updateTimeline } from './timeline/generate'

/**
 * Activate Hold
 */
export async function handleActivateHold(context: JobContext, data: ActivateHoldProps): Promise<void> {
	return runJobWithPlayoutModel(
		context,
		data,
		async (playoutModel) => {
			const playlist = playoutModel.Playlist

			if (!playlist.activationId) throw UserError.create(UserErrorMessage.InactiveRundown)

			if (!playlist.currentPartInfo) throw UserError.create(UserErrorMessage.NoCurrentPart)
			if (!playlist.nextPartInfo) throw UserError.create(UserErrorMessage.HoldNeedsNextPart)

			if (playlist.holdState) throw UserError.create(UserErrorMessage.HoldAlreadyActive)
		},
		async (playoutModel) => {
			const playlist = playoutModel.Playlist
			const currentPartInstance = playoutModel.CurrentPartInstance
			if (!currentPartInstance)
				throw new Error(`PartInstance "${playlist.currentPartInfo?.partInstanceId}" not found!`)
			const nextPartInstance = playoutModel.NextPartInstance
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
					!!p.PieceInstance.dynamicallyInserted &&
					// If its a continuation of an infinite adlib it is probably a graphic, so is 'fine'
					!p.PieceInstance.infinite?.fromPreviousPart &&
					!p.PieceInstance.infinite?.fromPreviousPlayhead
			)
			if (hasDynamicallyInserted) throw UserError.create(UserErrorMessage.HoldAfterAdlib)

			playoutModel.setHoldState(RundownHoldState.PENDING)

			await updateTimeline(context, playoutModel)
		}
	)
}

/**
 * Deactivate Hold
 */
export async function handleDeactivateHold(context: JobContext, data: DeactivateHoldProps): Promise<void> {
	return runJobWithPlayoutModel(
		context,
		data,
		async (playoutModel) => {
			const playlist = playoutModel.Playlist

			if (!playlist.activationId) throw UserError.create(UserErrorMessage.InactiveRundown)

			if (playlist.holdState !== RundownHoldState.PENDING)
				throw UserError.create(UserErrorMessage.HoldNotCancelable)
		},
		async (playoutModel) => {
			playoutModel.setHoldState(RundownHoldState.NONE)

			await updateTimeline(context, playoutModel)
		}
	)
}
