import { Meteor } from 'meteor/meteor'
import { registerClassToMeteorMethods } from '../../methods'
import { NewPlayoutAPI, PlayoutAPIMethods } from '../../../lib/api/playout'
import { ServerPlayoutAPI } from './playout'
import { getCurrentTime, makePromise } from '../../../lib/lib'
import { logger } from '../../logging'
import { RundownPlaylistId } from '../../../lib/collections/RundownPlaylists'
import { PartInstanceId } from '../../../lib/collections/PartInstances'
import { PartId } from '../../../lib/collections/Parts'
import { PieceId } from '../../../lib/collections/Pieces'
import { StudioId } from '../../../lib/collections/Studios'
import { PieceInstanceId } from '../../../lib/collections/PieceInstances'
import { ClientAPI } from '../../../lib/api/client'
import { SegmentId } from '../../../lib/collections/Segments'

class ServerPlayoutAPIClass implements NewPlayoutAPI {
	rundownPrepareForBroadcast(playlistId: RundownPlaylistId) {
		return makePromise(() => ServerPlayoutAPI.prepareRundownPlaylistForBroadcast(playlistId))
	}
	rundownResetRundown(playlistId: RundownPlaylistId) {
		return makePromise(() => ServerPlayoutAPI.resetRundownPlaylist(playlistId))
	}
	rundownResetAndActivate(playlistId: RundownPlaylistId, rehearsal?: boolean) {
		return makePromise(() => ServerPlayoutAPI.resetAndActivateRundownPlaylist(playlistId, rehearsal))
	}
	rundownActivate(playlistId: RundownPlaylistId, rehearsal: boolean) {
		return makePromise(() => ServerPlayoutAPI.activateRundownPlaylist(playlistId, rehearsal))
	}
	rundownDeactivate(playlistId: RundownPlaylistId) {
		return makePromise(() => ServerPlayoutAPI.deactivateRundownPlaylist(playlistId))
	}
	reloadRundownPlaylistData(playlistId: RundownPlaylistId) {
		return makePromise(() => ServerPlayoutAPI.reloadRundownPlaylistData(playlistId))
	}
	pieceTakeNow(
		playlistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		pieceInstanceIdOrPieceIdToCopy: PieceInstanceId | PieceId
	) {
		return makePromise(() =>
			ServerPlayoutAPI.pieceTakeNow(playlistId, partInstanceId, pieceInstanceIdOrPieceIdToCopy)
		)
	}
	rundownTake(playlistId: RundownPlaylistId) {
		return makePromise(() => ServerPlayoutAPI.takeNextPart(playlistId))
	}
	rundownTogglePartArgument(
		playlistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		property: string,
		value: string
	) {
		return makePromise(() => ClientAPI.responseSuccess(undefined))
		// return makePromise(() =>
		// 	ServerPlayoutAPI.rundownTogglePartArgument(playlistId, partInstanceId, property, value)
		// )
	}
	rundownSetNext(playlistId: RundownPlaylistId, partId: PartId, timeOffset?: number | undefined) {
		return makePromise(() => ServerPlayoutAPI.setNextPart(playlistId, partId, true, timeOffset))
	}
	rundownSetNextSegment(playlistId: RundownPlaylistId, segmentId: SegmentId | null) {
		return makePromise(() => ServerPlayoutAPI.setNextSegment(playlistId, segmentId))
	}
	rundownMoveNext(playlistId: RundownPlaylistId, horisontalDelta: number, verticalDelta: number) {
		return makePromise(() => ServerPlayoutAPI.moveNextPart(playlistId, horisontalDelta, verticalDelta, true))
	}
	rundownActivateHold(playlistId: RundownPlaylistId) {
		return makePromise(() => ServerPlayoutAPI.activateHold(playlistId))
	}
	rundownDisableNextPiece(rundownPlaylistId: RundownPlaylistId, undo?: boolean) {
		return makePromise(() => ServerPlayoutAPI.disableNextPiece(rundownPlaylistId, undo))
	}
	segmentAdLibPieceStart(
		rundownPlaylistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		pieceId: PieceId,
		queue: boolean
	) {
		return makePromise(() =>
			ServerPlayoutAPI.segmentAdLibPieceStart(rundownPlaylistId, partInstanceId, pieceId, queue)
		)
	}
	rundownBaselineAdLibPieceStart(
		rundownPlaylistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		pieceId: PieceId,
		queue: boolean
	) {
		return makePromise(() =>
			ServerPlayoutAPI.rundownBaselineAdLibPieceStart(rundownPlaylistId, partInstanceId, pieceId, queue)
		)
	}
	sourceLayerOnPartStop(
		rundownPlaylistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		sourceLayerIds: string[]
	) {
		return makePromise(() =>
			ServerPlayoutAPI.sourceLayerOnPartStop(rundownPlaylistId, partInstanceId, sourceLayerIds)
		)
	}
	sourceLayerStickyPieceStart(playlistId: RundownPlaylistId, sourceLayerId: string) {
		return makePromise(() => ServerPlayoutAPI.sourceLayerStickyPieceStart(playlistId, sourceLayerId))
	}
	updateStudioBaseline(studioId: StudioId) {
		return makePromise(() => ServerPlayoutAPI.updateStudioBaseline(studioId))
	}
	shouldUpdateStudioBaseline(studioId: StudioId) {
		return makePromise(() => ServerPlayoutAPI.shouldUpdateStudioBaseline(studioId))
	}
}
registerClassToMeteorMethods(PlayoutAPIMethods, ServerPlayoutAPIClass, false)

// Temporary methods
Meteor.methods({
	debug__printTime: () => {
		let now = getCurrentTime()
		logger.debug(new Date(now))
		return now
	},
})
