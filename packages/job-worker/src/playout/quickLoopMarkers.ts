import { UserError, UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import { SetQuickLoopMarkerProps } from '@sofie-automation/corelib/dist/worker/studio'
import { JobContext } from '../jobs'
import { runJobWithPlayoutModel } from './lock'
import { updateTimeline } from './timeline/generate'
import { selectNextPart } from './selectNextPart'
import { setNextPart } from './setNext'

export async function handleSetQuickLoopMarker(context: JobContext, data: SetQuickLoopMarkerProps): Promise<void> {
	return runJobWithPlayoutModel(
		context,
		data,
		async (playoutModel) => {
			const playlist = playoutModel.playlist
			if (!playlist.activationId) throw UserError.create(UserErrorMessage.InactiveRundown)
		},
		async (playoutModel) => {
			const playlist = playoutModel.playlist
			if (!playlist.activationId) throw new Error(`Playlist has no activationId!`)
			const wasQuickLoopRunning = playoutModel.playlist.quickLoop?.running
			playoutModel.setQuickLoopMarker(data.type, data.marker)

			if (wasQuickLoopRunning) {
				const nextPart = selectNextPart(
					context,
					playoutModel.playlist,
					playoutModel.currentPartInstance?.partInstance ?? null,
					playoutModel.nextPartInstance?.partInstance ?? null,
					playoutModel.getAllOrderedSegments(),
					playoutModel.getAllOrderedParts(),
					{ ignoreUnplayable: true, ignoreQuickLoop: false }
				)
				if (nextPart?.part._id !== playoutModel.nextPartInstance?.partInstance.part._id) {
					await setNextPart(context, playoutModel, nextPart, false)
				}
			}
			await updateTimeline(context, playoutModel)
		}
	)
}
