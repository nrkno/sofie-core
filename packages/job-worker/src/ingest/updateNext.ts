import { isTooCloseToAutonext } from '../playout/lib'
import { selectNextPart } from '../playout/selectNextPart'
import { PlayoutModel } from '../playout/model/PlayoutModel'
import { JobContext } from '../jobs'
import { setNextPart } from '../playout/setNext'
import { isPartPlayable } from '@sofie-automation/corelib/dist/dataModel/Part'
import { updateTimeline } from '../playout/timeline/generate'

/**
 * Make sure that the nextPartInstance for the current Playlist is still correct
 * This will often change the nextPartInstance
 * @param context Context of the job being run
 * @param playoutModel Playout Cache to operate on
 */
export async function ensureNextPartIsValid(context: JobContext, playoutModel: PlayoutModel): Promise<void> {
	const span = context.startSpan('api.ingest.ensureNextPartIsValid')

	// Ensure the next-id is still valid
	const playlist = playoutModel.Playlist
	if (playlist?.activationId) {
		const currentPartInstance = playoutModel.CurrentPartInstance
		const nextPartInstance = playoutModel.NextPartInstance

		if (
			playlist.nextPartInfo?.manuallySelected &&
			nextPartInstance &&
			isPartPlayable(nextPartInstance.PartInstance.part) &&
			nextPartInstance.PartInstance.orphaned !== 'deleted'
		) {
			// Manual next part is almost always valid. This includes orphaned (adlib-part) partinstances
			span?.end()
			return
		}

		// If we are close to an autonext, then leave it to avoid glitches
		if (isTooCloseToAutonext(currentPartInstance?.PartInstance) && nextPartInstance) {
			span?.end()
			return
		}

		const orderedSegments = playoutModel.getAllOrderedSegments()
		const orderedParts = playoutModel.getAllOrderedParts()

		if (currentPartInstance && nextPartInstance) {
			// Check if the part is the same
			const newNextPart = selectNextPart(
				context,
				playlist,
				currentPartInstance.PartInstance,
				nextPartInstance.PartInstance,
				orderedSegments,
				orderedParts
			)

			if (
				// Nothing should be nexted
				!newNextPart ||
				// The nexted-part should be different to what is selected
				newNextPart.part._id !== nextPartInstance.PartInstance.part._id ||
				// The nexted-part Instance is no longer playable
				!isPartPlayable(nextPartInstance.PartInstance.part)
			) {
				// The 'new' next part is before the current next, so move the next point
				await setNextPart(context, playoutModel, newNextPart ?? null, false)

				await updateTimeline(context, playoutModel)
			}
		} else if (!nextPartInstance || nextPartInstance.PartInstance.orphaned === 'deleted') {
			// Don't have a nextPart or it has been deleted, so autoselect something
			const newNextPart = selectNextPart(
				context,
				playlist,
				currentPartInstance?.PartInstance ?? null,
				nextPartInstance?.PartInstance ?? null,
				orderedSegments,
				orderedParts
			)
			await setNextPart(context, playoutModel, newNextPart ?? null, false)

			await updateTimeline(context, playoutModel)
		}
	}

	span?.end()
}
