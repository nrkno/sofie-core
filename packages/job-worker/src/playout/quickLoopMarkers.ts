import { UserError, UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import { SetQuickLoopMarkerProps } from '@sofie-automation/corelib/dist/worker/studio'
import { JobContext } from '../jobs'
import { runJobWithPlayoutModel } from './lock'

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
		}
	)
}
