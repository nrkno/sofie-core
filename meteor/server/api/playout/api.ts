import { Methods, setMeteorMethods } from '../../methods'
import { PlayoutAPI } from '../../../lib/api/playout'
import { ServerPlayoutAPI } from './playout'
import { getCurrentTime } from '../../../lib/lib'
import { logger } from '../../logging'

let methods: Methods = {}
methods[PlayoutAPI.methods.rundownPrepareForBroadcast] = (playlistId: string) => {
	return ServerPlayoutAPI.prepareRundownForBroadcast(playlistId)
}
methods[PlayoutAPI.methods.rundownResetRundown] = (playlistId: string) => {
	return ServerPlayoutAPI.resetRundown(playlistId)
}
methods[PlayoutAPI.methods.rundownResetAndActivate] = (playlistId: string, rehearsal?: boolean) => {
	return ServerPlayoutAPI.resetAndActivateRundown(playlistId, rehearsal)
}
methods[PlayoutAPI.methods.rundownActivate] = (playlistId: string, rehearsal: boolean) => {
	return ServerPlayoutAPI.activateRundown(playlistId, rehearsal)
}
methods[PlayoutAPI.methods.rundownDeactivate] = (playlistId: string) => {
	return ServerPlayoutAPI.deactivateRundown(playlistId)
}
methods[PlayoutAPI.methods.reloadData] = (playlistId: string) => {
	return ServerPlayoutAPI.reloadData(playlistId)
}
methods[PlayoutAPI.methods.pieceTakeNow] = (playlistId: string, partInstanceId: string, pieceInstanceIdOrPieceIdToCopy: string) => {
	return ServerPlayoutAPI.pieceTakeNow(playlistId, partInstanceId, pieceInstanceIdOrPieceIdToCopy)
}
methods[PlayoutAPI.methods.rundownTake] = (playlistId: string) => {
	return ServerPlayoutAPI.takeNextPart(playlistId)
}
methods[PlayoutAPI.methods.rundownTogglePartArgument] = (playlistId: string, partId: string, property: string, value: string) => {
	return ServerPlayoutAPI.rundownTogglePartArgument(playlistId, partId, property, value)
}
methods[PlayoutAPI.methods.rundownSetNext] = (playlistId: string, partId: string, timeOffset?: number | undefined) => {
	return ServerPlayoutAPI.setNextPart(playlistId, partId, true, timeOffset)
}
methods[PlayoutAPI.methods.rundownMoveNext] = (playlistId: string, horisontalDelta: number, verticalDelta: number) => {
	return ServerPlayoutAPI.moveNextPart(playlistId, horisontalDelta, verticalDelta, true)
}
methods[PlayoutAPI.methods.rundownActivateHold] = (playlistId: string) => {
	return ServerPlayoutAPI.activateHold(playlistId)
}
methods[PlayoutAPI.methods.rundownDisableNextPiece] = (rundownPlaylistId: string, undo?: boolean) => {
	return ServerPlayoutAPI.disableNextPiece(rundownPlaylistId, undo)
}
// methods[PlayoutAPI.methods.partPlaybackStartedCallback] = (rundownId: string, partId: string, startedPlayback: number) => {
// 	return ServerPlayoutAPI.onPartPlaybackStarted(rundownId, partId, startedPlayback)
// }
// methods[PlayoutAPI.methods.piecePlaybackStartedCallback] = (rundownId: string, pieceId: string, startedPlayback: number) => {
// 	return ServerPlayoutAPI.onPiecePlaybackStarted(rundownId, pieceId, startedPlayback)
// }
methods[PlayoutAPI.methods.segmentAdLibPieceStart] = (rundownPlaylistId: string, partId: string, pieceId: string, queue: boolean) => {
	return ServerPlayoutAPI.segmentAdLibPieceStart(rundownPlaylistId, partId, pieceId, queue)
}
methods[PlayoutAPI.methods.rundownBaselineAdLibPieceStart] = (rundownPlaylistId: string, partId: string, pieceId: string, queue: boolean) => {
	return ServerPlayoutAPI.rundownBaselineAdLibPieceStart(rundownPlaylistId, partId, pieceId, queue)
}
methods[PlayoutAPI.methods.segmentAdLibPieceStop] = (rundownPlaylistId: string, partInstanceId: string, pieceInstanceId: string) => {
	return ServerPlayoutAPI.stopAdLibPiece(rundownPlaylistId, partInstanceId, pieceInstanceId)
}
methods[PlayoutAPI.methods.sourceLayerOnPartStop] = (rundownPlaylistId: string, partId: string, sourceLayerId: string) => {
	return ServerPlayoutAPI.sourceLayerOnPartStop(rundownPlaylistId, partId, sourceLayerId)
}
// methods[PlayoutAPI.methods.timelineTriggerTimeUpdateCallback] = (timelineObjId: string, time: number) => {
// 	return ServerPlayoutAPI.timelineTriggerTimeUpdateCallback(timelineObjId, time)
// }
methods[PlayoutAPI.methods.sourceLayerStickyPieceStart] = (playlistId: string, sourceLayerId: string) => {
	return ServerPlayoutAPI.sourceLayerStickyPieceStart(playlistId, sourceLayerId)
}
methods[PlayoutAPI.methods.updateStudioBaseline] = (studioId: string) => {
	return ServerPlayoutAPI.updateStudioBaseline(studioId)
}
methods[PlayoutAPI.methods.shouldUpdateStudioBaseline] = (studioId: string) => {
	return ServerPlayoutAPI.shouldUpdateStudioBaseline(studioId)
}
// Apply methods:
setMeteorMethods(methods)

// Temporary methods
setMeteorMethods({
	'debug__printTime': () => {
		let now = getCurrentTime()
		logger.debug(new Date(now))
		return now
	},
})
