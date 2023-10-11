import { OnPlayoutPlaybackChangedProps } from '@sofie-automation/corelib/dist/worker/studio'
import { logger } from '../../logging'
import { JobContext } from '../../jobs'
import { runJobWithPlayoutModel } from '../lock'
import { assertNever } from '@sofie-automation/corelib/dist/lib'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { PlayoutChangedType } from '@sofie-automation/shared-lib/dist/peripheralDevice/peripheralDeviceAPI'
import { onPiecePlaybackStarted, onPiecePlaybackStopped } from './piecePlayback'
import { onPartPlaybackStarted, onPartPlaybackStopped } from './partPlayback'

export { handleTimelineTriggerTime } from './timelineTriggerTime'

/**
 * Called by playout-gateway when playback timings of any Parts or Pieces on the timeline have changed
 */
export async function handleOnPlayoutPlaybackChanged(
	context: JobContext,
	data: OnPlayoutPlaybackChangedProps
): Promise<void> {
	return runJobWithPlayoutModel(context, data, null, async (playoutModel) => {
		for (const change of data.changes) {
			try {
				if (change.type === PlayoutChangedType.PART_PLAYBACK_STARTED) {
					await onPartPlaybackStarted(context, playoutModel, {
						partInstanceId: change.data.partInstanceId,
						startedPlayback: change.data.time,
					})
				} else if (change.type === PlayoutChangedType.PART_PLAYBACK_STOPPED) {
					onPartPlaybackStopped(context, playoutModel, {
						partInstanceId: change.data.partInstanceId,
						stoppedPlayback: change.data.time,
					})
				} else if (change.type === PlayoutChangedType.PIECE_PLAYBACK_STARTED) {
					onPiecePlaybackStarted(context, playoutModel, {
						partInstanceId: change.data.partInstanceId,
						pieceInstanceId: change.data.pieceInstanceId,
						startedPlayback: change.data.time,
					})
				} else if (change.type === PlayoutChangedType.PIECE_PLAYBACK_STOPPED) {
					onPiecePlaybackStopped(context, playoutModel, {
						partInstanceId: change.data.partInstanceId,
						pieceInstanceId: change.data.pieceInstanceId,
						stoppedPlayback: change.data.time,
					})
				} else {
					assertNever(change)
				}
			} catch (err) {
				logger.error(stringifyError(err))
			}
		}
	})
}
