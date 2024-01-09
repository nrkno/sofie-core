import { UserError, UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import { SetQuickLoopMarkerProps } from '@sofie-automation/corelib/dist/worker/studio'
import { JobContext } from '../jobs'
import { runJobWithPlayoutModel } from './lock'
import { updateTimeline } from './timeline/generate'

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

			playoutModel.setQuickLoopMarker(data.type, data.marker)
			// TODO: this needs to set Next if we're clearing while on the next part
			await updateTimeline(context, playoutModel) // TODO: does this need a condition
		}
	)
}
