import { PartInstanceId, PieceInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { logger } from '../../logging'
import { JobContext } from '../../jobs'
import { CacheForPlayout } from '../cache'
import { queuePartInstanceTimingEvent } from './events'
import { Time } from '@sofie-automation/blueprints-integration'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'

/**
 * Set the playback of a piece is confirmed to have started
 * @param context Context from the job queue
 * @param cache DB cache for the current playlist
 * @param data Details on the piece start event
 */
export function onPiecePlaybackStarted(
	context: JobContext,
	cache: CacheForPlayout,
	data: {
		pieceInstanceId: PieceInstanceId
		startedPlayback: Time
	}
): void {
	const playlist = cache.Playlist.doc
	const pieceInstance = cache.PieceInstances.findOne(data.pieceInstanceId)

	if (pieceInstance) {
		const isPlaying = !!(pieceInstance.reportedStartedPlayback && !pieceInstance.reportedStoppedPlayback)
		if (!isPlaying) {
			logger.debug(
				`onPiecePlaybackStarted: Playout reports pieceInstance "${
					data.pieceInstanceId
				}" has started playback on timestamp ${new Date(data.startedPlayback).toISOString()}`
			)
			reportPieceHasStarted(context, cache, pieceInstance, data.startedPlayback)

			// We don't need to bother with an updateTimeline(), as this hasn't changed anything, but lets us accurately add started items when reevaluating
		}
	} else if (!playlist.activationId) {
		logger.warn(`onPiecePlaybackStarted: Received for inactive RundownPlaylist "${playlist._id}"`)
	} else {
		throw new Error(`PieceInstance "${data.pieceInstanceId}" in RundownPlaylist "${playlist._id}" not found!`)
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
	cache: CacheForPlayout,
	data: {
		partInstanceId: PartInstanceId
		pieceInstanceId: PieceInstanceId
		stoppedPlayback: Time
	}
): void {
	const playlist = cache.Playlist.doc
	const pieceInstance = cache.PieceInstances.findOne(data.pieceInstanceId)

	if (pieceInstance) {
		const isPlaying = !!(pieceInstance.reportedStartedPlayback && !pieceInstance.reportedStoppedPlayback)
		if (isPlaying) {
			logger.debug(
				`onPiecePlaybackStopped: Playout reports pieceInstance "${
					data.pieceInstanceId
				}" has stopped playback on timestamp ${new Date(data.stoppedPlayback).toISOString()}`
			)

			reportPieceHasStopped(context, cache, pieceInstance, data.stoppedPlayback)
		}
	} else if (!playlist.activationId) {
		logger.warn(`onPiecePlaybackStopped: Received for inactive RundownPlaylist "${playlist._id}"`)
	} else {
		const partInstance = cache.PartInstances.findOne(data.partInstanceId)
		if (!partInstance) {
			// PartInstance not found, so we can rely on the onPartPlaybackStopped callback erroring
		} else {
			throw new Error(`PieceInstance "${data.pieceInstanceId}" in RundownPlaylist "${playlist._id}" not found!`)
		}
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
	context: JobContext,
	cache: CacheForPlayout,
	pieceInstance: PieceInstance,
	timestamp: Time
): void {
	if (pieceInstance.reportedStartedPlayback !== timestamp) {
		cache.PieceInstances.updateOne(pieceInstance._id, (piece) => {
			piece.reportedStartedPlayback = timestamp
			delete piece.reportedStoppedPlayback

			if (!cache.isMultiGatewayMode) {
				piece.plannedStartedPlayback = timestamp
				delete piece.plannedStoppedPlayback
			}

			return piece
		})

		// Update the copy in the next-part if there is one, so that the infinite has the same start after a take
		const playlist = cache.Playlist.doc
		if (pieceInstance.infinite && playlist.nextPartInfo) {
			const infiniteInstanceId = pieceInstance.infinite.infiniteInstanceId
			cache.PieceInstances.updateAll((piece) => {
				if (
					piece.partInstanceId === playlist.nextPartInfo?.partInstanceId &&
					!!piece.infinite &&
					piece.infinite.infiniteInstanceId === infiniteInstanceId
				) {
					piece.reportedStartedPlayback = timestamp
					delete piece.reportedStoppedPlayback

					if (!cache.isMultiGatewayMode) {
						piece.plannedStartedPlayback = timestamp
						delete piece.plannedStoppedPlayback
					}

					return piece
				} else {
					return false
				}
			})
		}

		cache.deferAfterSave(() => {
			queuePartInstanceTimingEvent(context, playlist._id, pieceInstance.partInstanceId)
		})
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
	context: JobContext,
	cache: CacheForPlayout,
	pieceInstance: PieceInstance,
	timestamp: Time
): void {
	if (pieceInstance.reportedStoppedPlayback !== timestamp) {
		cache.PieceInstances.updateOne(pieceInstance._id, (piece) => {
			piece.reportedStoppedPlayback = timestamp

			if (!cache.isMultiGatewayMode) {
				piece.plannedStoppedPlayback = timestamp
			}

			return piece
		})
		cache.deferAfterSave(() => {
			queuePartInstanceTimingEvent(context, cache.PlaylistId, pieceInstance.partInstanceId)
		})
	}
}
