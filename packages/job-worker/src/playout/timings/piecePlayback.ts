import { PartInstanceId, PieceInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { logger } from '../../logging'
import { JobContext } from '../../jobs'
import { PlayoutModel } from '../cacheModel/PlayoutModel'
import { Time } from '@sofie-automation/blueprints-integration'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { PartInstanceWithPieces } from '../cacheModel/PartInstanceWithPieces'
import { ReadonlyDeep } from 'type-fest'

/**
 * Set the playback of a piece is confirmed to have started
 * @param context Context from the job queue
 * @param cache DB cache for the current playlist
 * @param data Details on the piece start event
 */
export function onPiecePlaybackStarted(
	context: JobContext,
	cache: PlayoutModel,
	data: {
		partInstanceId: PartInstanceId
		pieceInstanceId: PieceInstanceId
		startedPlayback: Time
	}
): void {
	const playlist = cache.Playlist

	const partInstance = cache.getPartInstance(data.partInstanceId)
	if (!partInstance) {
		if (!playlist.activationId) {
			logger.warn(`onPiecePlaybackStarted: Received for inactive RundownPlaylist "${playlist._id}"`)
		} else {
			throw new Error(`PartInstance "${data.partInstanceId}" in RundownPlaylist "${playlist._id}" not found!`)
		}
		return
	}

	const pieceInstance = partInstance.getPieceInstance(data.pieceInstanceId)
	if (!pieceInstance) {
		if (!playlist.activationId) {
			logger.warn(`onPiecePlaybackStarted: Received for inactive RundownPlaylist "${playlist._id}"`)
		} else {
			throw new Error(`PieceInstance "${data.partInstanceId}" in RundownPlaylist "${playlist._id}" not found!`)
		}
		return
	}

	const isPlaying = !!(pieceInstance.reportedStartedPlayback && !pieceInstance.reportedStoppedPlayback)
	if (!isPlaying) {
		logger.debug(
			`onPiecePlaybackStarted: Playout reports pieceInstance "${
				data.pieceInstanceId
			}" has started playback on timestamp ${new Date(data.startedPlayback).toISOString()}`
		)
		reportPieceHasStarted(context, cache, partInstance, pieceInstance, data.startedPlayback)

		// We don't need to bother with an updateTimeline(), as this hasn't changed anything, but lets us accurately add started items when reevaluating
	}
}

/**
 * Set the playback of a piece is confirmed to have stopped
 * @param context Context from the job queue
 * @param cache DB cache for the current playlist
 * @param data Details on the piece stop event
 */
export function onPiecePlaybackStopped(
	context: JobContext,
	cache: PlayoutModel,
	data: {
		partInstanceId: PartInstanceId
		pieceInstanceId: PieceInstanceId
		stoppedPlayback: Time
	}
): void {
	const playlist = cache.Playlist

	const partInstance = cache.getPartInstance(data.partInstanceId)
	if (!partInstance) {
		// PartInstance not found, so we can rely on the onPartPlaybackStopped callback erroring
		return
	}

	const pieceInstance = partInstance.getPieceInstance(data.pieceInstanceId)
	if (!pieceInstance) {
		if (!playlist.activationId) {
			logger.warn(`onPiecePlaybackStopped: Received for inactive RundownPlaylist "${playlist._id}"`)
		} else {
			throw new Error(`PieceInstance "${data.partInstanceId}" in RundownPlaylist "${playlist._id}" not found!`)
		}
		return
	}

	const isPlaying = !!(pieceInstance.reportedStartedPlayback && !pieceInstance.reportedStoppedPlayback)
	if (isPlaying) {
		logger.debug(
			`onPiecePlaybackStopped: Playout reports pieceInstance "${
				data.pieceInstanceId
			}" has stopped playback on timestamp ${new Date(data.stoppedPlayback).toISOString()}`
		)

		reportPieceHasStopped(context, cache, partInstance, pieceInstance, data.stoppedPlayback)
	}
}

/**
 * Set the playback of a PieceInstance is confirmed to have started
 * @param context Context from the job queue
 * @param cache DB cache for the current playlist
 * @param pieceInstance PieceInstance to be updated
 * @param timestamp timestamp the PieceInstance started
 */
function reportPieceHasStarted(
	_context: JobContext,
	cache: PlayoutModel,
	partInstance: PartInstanceWithPieces,
	pieceInstance: ReadonlyDeep<PieceInstance>,
	timestamp: Time
): void {
	const timestampChanged = partInstance.setPieceInstancedReportedStartedPlayback(pieceInstance._id, timestamp)
	if (timestampChanged) {
		if (!cache.isMultiGatewayMode) {
			partInstance.setPieceInstancedPlannedStartedPlayback(pieceInstance._id, timestamp)
		}

		// Update the copy in the next-part if there is one, so that the infinite has the same start after a take
		const nextPartInstance = cache.NextPartInstance
		if (
			pieceInstance.infinite &&
			nextPartInstance &&
			nextPartInstance.PartInstance._id !== partInstance.PartInstance._id
		) {
			const infiniteInstanceId = pieceInstance.infinite.infiniteInstanceId
			for (const nextPieceInstance of nextPartInstance.PieceInstances) {
				if (
					!!nextPieceInstance.infinite &&
					nextPieceInstance.infinite.infiniteInstanceId === infiniteInstanceId
				) {
					nextPartInstance.setPieceInstancedReportedStartedPlayback(nextPieceInstance._id, timestamp)

					if (!cache.isMultiGatewayMode) {
						nextPartInstance.setPieceInstancedPlannedStartedPlayback(nextPieceInstance._id, timestamp)
					}
				}
			}
		}

		cache.queuePartInstanceTimingEvent(partInstance.PartInstance._id)
	}
}

/**
 * Set the playback of a PieceInstance is confirmed to have stopped
 * @param context Context from the job queue
 * @param cache DB cache for the current playlist
 * @param pieceInstance PieceInstance to be updated
 * @param timestamp timestamp the PieceInstance stopped
 */
function reportPieceHasStopped(
	_context: JobContext,
	cache: PlayoutModel,
	partInstance: PartInstanceWithPieces,
	pieceInstance: ReadonlyDeep<PieceInstance>,
	timestamp: Time
): void {
	const timestampChanged = partInstance.setPieceInstancedReportedStoppedPlayback(pieceInstance._id, timestamp)

	if (timestampChanged) {
		if (!cache.isMultiGatewayMode) {
			partInstance.setPieceInstancedPlannedStoppedPlayback(pieceInstance._id, timestamp)
		}

		cache.queuePartInstanceTimingEvent(partInstance.PartInstance._id)
	}
}
