import { Methods, setMeteorMethods } from '../../methods'
import { PlayoutAPI } from '../../../lib/api/playout'
import { ServerPlayoutAPI } from './playout'
import { getCurrentTime } from '../../../lib/lib'
import { logger } from '../../logging'
import { RundownPlaylistId } from '../../../lib/collections/RundownPlaylists'
import { PartInstanceId } from '../../../lib/collections/PartInstances'
import { PartId } from '../../../lib/collections/Parts'
import { PieceId } from '../../../lib/collections/Pieces'
import { StudioId } from '../../../lib/collections/Studios'
import { PieceInstanceId } from '../../../lib/collections/PieceInstances'

let methods: Methods = {}
methods[PlayoutAPI.methods.rundownPrepareForBroadcast] = (playlistId: RundownPlaylistId) => {
	return ServerPlayoutAPI.prepareRundownPlaylistForBroadcast(playlistId)
}
methods[PlayoutAPI.methods.rundownResetRundown] = (playlistId: RundownPlaylistId) => {
	return ServerPlayoutAPI.resetRundownPlaylist(playlistId)
}
methods[PlayoutAPI.methods.rundownResetAndActivate] = (playlistId: RundownPlaylistId, rehearsal?: boolean) => {
	return ServerPlayoutAPI.resetAndActivateRundownPlaylist(playlistId, rehearsal)
}
methods[PlayoutAPI.methods.rundownActivate] = (playlistId: RundownPlaylistId, rehearsal: boolean) => {
	return ServerPlayoutAPI.activateRundownPlaylist(playlistId, rehearsal)
}
methods[PlayoutAPI.methods.rundownDeactivate] = (playlistId: RundownPlaylistId) => {
	return ServerPlayoutAPI.deactivateRundownPlaylist(playlistId)
}
methods[PlayoutAPI.methods.reloadRundownPlaylistData] = (playlistId: RundownPlaylistId) => {
	return ServerPlayoutAPI.reloadRundownPlaylistData(playlistId)
}
methods[PlayoutAPI.methods.pieceTakeNow] = (playlistId: RundownPlaylistId, partInstanceId: PartInstanceId, pieceInstanceIdOrPieceIdToCopy: PieceInstanceId | PieceId) => {
	return ServerPlayoutAPI.pieceTakeNow(playlistId, partInstanceId, pieceInstanceIdOrPieceIdToCopy)
}
methods[PlayoutAPI.methods.rundownTake] = (playlistId: RundownPlaylistId) => {
	return ServerPlayoutAPI.takeNextPart(playlistId)
}
methods[PlayoutAPI.methods.rundownTogglePartArgument] = (playlistId: RundownPlaylistId, partInstanceId: PartInstanceId, property: string, value: string) => {
	return ServerPlayoutAPI.rundownTogglePartArgument(playlistId, partInstanceId, property, value)
}
methods[PlayoutAPI.methods.rundownSetNext] = (playlistId: RundownPlaylistId, partId: PartId, timeOffset?: number | undefined) => {
	return ServerPlayoutAPI.setNextPart(playlistId, partId, true, timeOffset)
}
methods[PlayoutAPI.methods.rundownMoveNext] = (playlistId: RundownPlaylistId, horisontalDelta: number, verticalDelta: number) => {
	return ServerPlayoutAPI.moveNextPart(playlistId, horisontalDelta, verticalDelta, true)
}
methods[PlayoutAPI.methods.rundownActivateHold] = (playlistId: RundownPlaylistId) => {
	return ServerPlayoutAPI.activateHold(playlistId)
}
methods[PlayoutAPI.methods.rundownDisableNextPiece] = (rundownPlaylistId: RundownPlaylistId, undo?: boolean) => {
	return ServerPlayoutAPI.disableNextPiece(rundownPlaylistId, undo)
}
// methods[PlayoutAPI.methods.partPlaybackStartedCallback] = (rundownId: RundownId, partId: PartId, startedPlayback: number) => {
// 	return ServerPlayoutAPI.onPartPlaybackStarted(rundownId, partId, startedPlayback)
// }
// methods[PlayoutAPI.methods.piecePlaybackStartedCallback] = (rundownId: RundownId, pieceId: PieceId, startedPlayback: number) => {
// 	return ServerPlayoutAPI.onPiecePlaybackStarted(rundownId, pieceId, startedPlayback)
// }
methods[PlayoutAPI.methods.segmentAdLibPieceStart] = (rundownPlaylistId: RundownPlaylistId, partInstanceId: PartInstanceId, pieceId: PieceId, queue: boolean) => {
	return ServerPlayoutAPI.segmentAdLibPieceStart(rundownPlaylistId, partInstanceId, pieceId, queue)
}
methods[PlayoutAPI.methods.rundownBaselineAdLibPieceStart] = (rundownPlaylistId: RundownPlaylistId, partInstanceId: PartInstanceId, pieceId: PieceId, queue: boolean) => {
	return ServerPlayoutAPI.rundownBaselineAdLibPieceStart(rundownPlaylistId, partInstanceId, pieceId, queue)
}
methods[PlayoutAPI.methods.sourceLayerOnPartStop] = (rundownPlaylistId: RundownPlaylistId, partInstanceId: PartInstanceId, sourceLayerId: string) => {
	return ServerPlayoutAPI.sourceLayerOnPartStop(rundownPlaylistId, partInstanceId, sourceLayerId)
}
// methods[PlayoutAPI.methods.timelineTriggerTimeUpdateCallback] = (timelineObjId: string, time: number) => {
// 	return ServerPlayoutAPI.timelineTriggerTimeUpdateCallback(timelineObjId, time)
// }
methods[PlayoutAPI.methods.sourceLayerStickyPieceStart] = (playlistId: RundownPlaylistId, sourceLayerId: string) => {
	return ServerPlayoutAPI.sourceLayerStickyPieceStart(playlistId, sourceLayerId)
}
methods[PlayoutAPI.methods.updateStudioBaseline] = (studioId: StudioId) => {
	return ServerPlayoutAPI.updateStudioBaseline(studioId)
}
methods[PlayoutAPI.methods.shouldUpdateStudioBaseline] = (studioId: StudioId) => {
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
