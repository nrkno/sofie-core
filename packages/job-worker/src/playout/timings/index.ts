import { OnPlayoutPlaybackChangedProps } from '@sofie-automation/corelib/dist/worker/studio'
import { logger } from '../../logging'
import { JobContext } from '../../jobs'
import { runJobWithPlayoutCache } from '../lock'
import { assertNever, stringifyError } from '@sofie-automation/corelib/dist/lib'
import { PlayoutChangedType } from '@sofie-automation/shared-lib/dist/peripheralDevice/peripheralDeviceAPI'
import { _onPiecePlaybackStarted, _onPiecePlaybackStopped } from './piecePlayback'
import { _onPartPlaybackStarted, _onPartPlaybackStopped } from './partPlayback'

export { handleTimelineTriggerTime } from './timelineTriggerTime'

/**
 * Called by playout-gateway when playback timings of any Parts or Pieces on the timeline have changed
 * @param context Context from the job queue
 * @param data Playout timings changes
 */
export async function onPlayoutPlaybackChanged(
	context: JobContext,
	data: OnPlayoutPlaybackChangedProps
): Promise<void> {
	return runJobWithPlayoutCache(context, data, null, async (cache) => {
		for (const change of data.changes) {
			try {
				if (change.type === PlayoutChangedType.PART_PLAYBACK_STARTED) {
					await _onPartPlaybackStarted(context, cache, {
						partInstanceId: change.data.partInstanceId,
						startedPlayback: change.data.time,
					})
				} else if (change.type === PlayoutChangedType.PART_PLAYBACK_STOPPED) {
					_onPartPlaybackStopped(context, cache, {
						partInstanceId: change.data.partInstanceId,
						stoppedPlayback: change.data.time,
					})
				} else if (change.type === PlayoutChangedType.PIECE_PLAYBACK_STARTED) {
					_onPiecePlaybackStarted(context, cache, {
						pieceInstanceId: change.data.pieceInstanceId,
						startedPlayback: change.data.time,
					})
				} else if (change.type === PlayoutChangedType.PIECE_PLAYBACK_STOPPED) {
					_onPiecePlaybackStopped(context, cache, {
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
