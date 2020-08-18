import { Meteor } from 'meteor/meteor'
import { ClientAPI } from '../../../lib/api/client'
import { MethodContextAPI } from '../../../lib/api/methods'
import { NewPlayoutAPI, PlayoutAPIMethods } from '../../../lib/api/playout'
import { PartInstanceId } from '../../../lib/collections/PartInstances'
import { PartId } from '../../../lib/collections/Parts'
import { PieceInstanceId } from '../../../lib/collections/PieceInstances'
import { PieceId } from '../../../lib/collections/Pieces'
import { RundownPlaylistId } from '../../../lib/collections/RundownPlaylists'
import { SegmentId } from '../../../lib/collections/Segments'
import { StudioId } from '../../../lib/collections/Studios'
import { getCurrentTime, makePromise } from '../../../lib/lib'
import { Settings } from '../../../lib/Settings'
import { logger } from '../../logging'
import { registerClassToMeteorMethods } from '../../methods'
import { ServerPlayoutAPI } from './playout'

class ServerPlayoutAPIClass extends MethodContextAPI implements NewPlayoutAPI {
	rundownPrepareForBroadcast(playlistId: RundownPlaylistId) {
		return makePromise(() => ServerPlayoutAPI.prepareRundownPlaylistForBroadcast(this, playlistId))
	}
	rundownResetRundown(playlistId: RundownPlaylistId) {
		return makePromise(() => ServerPlayoutAPI.resetRundownPlaylist(this, playlistId))
	}
	rundownResetAndActivate(playlistId: RundownPlaylistId, rehearsal?: boolean) {
		return makePromise(() => ServerPlayoutAPI.resetAndActivateRundownPlaylist(this, playlistId, rehearsal))
	}
	rundownActivate(playlistId: RundownPlaylistId, rehearsal: boolean) {
		return makePromise(() => ServerPlayoutAPI.activateRundownPlaylist(this, playlistId, rehearsal))
	}
	rundownDeactivate(playlistId: RundownPlaylistId) {
		return makePromise(() => ServerPlayoutAPI.deactivateRundownPlaylist(this, playlistId))
	}
	reloadRundownPlaylistData(playlistId: RundownPlaylistId) {
		return makePromise(() => ServerPlayoutAPI.reloadRundownPlaylistData(this, playlistId))
	}
	pieceTakeNow(
		playlistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		pieceInstanceIdOrPieceIdToCopy: PieceInstanceId | PieceId
	) {
		return makePromise(() =>
			ServerPlayoutAPI.pieceTakeNow(this, playlistId, partInstanceId, pieceInstanceIdOrPieceIdToCopy)
		)
	}
	rundownTake(playlistId: RundownPlaylistId) {
		return makePromise(() => ServerPlayoutAPI.takeNextPart(this, playlistId))
	}
	rundownTogglePartArgument(
		playlistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		property: string,
		value: string
	) {
		return makePromise(() => ClientAPI.responseSuccess(undefined))
		// return makePromise(() =>
		// 	ServerPlayoutAPI.rundownTogglePartArgument(this, playlistId, partInstanceId, property, value)
		// )
	}
	rundownSetNext(playlistId: RundownPlaylistId, partId: PartId, timeOffset?: number | undefined) {
		return makePromise(() => ServerPlayoutAPI.setNextPart(this, playlistId, partId, true, timeOffset))
	}
	rundownSetNextSegment(playlistId: RundownPlaylistId, segmentId: SegmentId | null) {
		return makePromise(() => ServerPlayoutAPI.setNextSegment(this, playlistId, segmentId))
	}
	rundownMoveNext(playlistId: RundownPlaylistId, horisontalDelta: number, verticalDelta: number) {
		return makePromise(() => ServerPlayoutAPI.moveNextPart(this, playlistId, horisontalDelta, verticalDelta, true))
	}
	rundownActivateHold(playlistId: RundownPlaylistId) {
		return makePromise(() => ServerPlayoutAPI.activateHold(this, playlistId))
	}
	rundownDisableNextPiece(rundownPlaylistId: RundownPlaylistId, undo?: boolean) {
		return makePromise(() => ServerPlayoutAPI.disableNextPiece(this, rundownPlaylistId, undo))
	}
	segmentAdLibPieceStart(
		rundownPlaylistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		pieceId: PieceId,
		queue: boolean
	) {
		return makePromise(() =>
			ServerPlayoutAPI.segmentAdLibPieceStart(this, rundownPlaylistId, partInstanceId, pieceId, queue)
		)
	}
	rundownBaselineAdLibPieceStart(
		rundownPlaylistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		pieceId: PieceId,
		queue: boolean
	) {
		return makePromise(() =>
			ServerPlayoutAPI.rundownBaselineAdLibPieceStart(this, rundownPlaylistId, partInstanceId, pieceId, queue)
		)
	}
	sourceLayerOnPartStop(
		rundownPlaylistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		sourceLayerIds: string[]
	) {
		return makePromise(() =>
			ServerPlayoutAPI.sourceLayerOnPartStop(this, rundownPlaylistId, partInstanceId, sourceLayerIds)
		)
	}
	sourceLayerStickyPieceStart(playlistId: RundownPlaylistId, sourceLayerId: string) {
		return makePromise(() => ServerPlayoutAPI.sourceLayerStickyPieceStart(this, playlistId, sourceLayerId))
	}
	updateStudioBaseline(studioId: StudioId) {
		return makePromise(() => ServerPlayoutAPI.updateStudioBaseline(this, studioId))
	}
	shouldUpdateStudioBaseline(studioId: StudioId) {
		return makePromise(() => ServerPlayoutAPI.shouldUpdateStudioBaseline(this, studioId))
	}
}
registerClassToMeteorMethods(PlayoutAPIMethods, ServerPlayoutAPIClass, false)

if (!Settings.enableUserAccounts) {
	// Temporary methods
	Meteor.methods({
		debug__printTime: () => {
			let now = getCurrentTime()
			logger.debug(new Date(now))
			return now
		},
	})
}
