import { Methods, setMeteorMethods } from '../../methods'
import { PlayoutAPI } from '../../../lib/api/playout'
import { ServerPlayoutAPI } from './playout'
import { getCurrentTime } from '../../../lib/lib'
import { logger } from '../../logging'

let methods: Methods = {}
methods[PlayoutAPI.methods.rundownPrepareForBroadcast] = (rundownId: string) => {
	return ServerPlayoutAPI.prepareRundownForBroadcast(rundownId)
}
methods[PlayoutAPI.methods.rundownResetRundown] = (rundownId: string) => {
	return ServerPlayoutAPI.resetRundown(rundownId)
}
methods[PlayoutAPI.methods.rundownResetAndActivate] = (rundownId: string) => {
	return ServerPlayoutAPI.resetAndActivateRundown(rundownId)
}
methods[PlayoutAPI.methods.rundownActivate] = (rundownId: string, rehearsal: boolean) => {
	return ServerPlayoutAPI.activateRundown(rundownId, rehearsal)
}
methods[PlayoutAPI.methods.rundownDeactivate] = (rundownId: string) => {
	return ServerPlayoutAPI.deactivateRundown(rundownId)
}
methods[PlayoutAPI.methods.reloadData] = (rundownId: string) => {
	return ServerPlayoutAPI.reloadData(rundownId)
}
methods[PlayoutAPI.methods.pieceTakeNow] = (rundownId: string, partId: string, pieceId: string) => {
	return ServerPlayoutAPI.pieceTakeNow(rundownId, partId, pieceId)
}
methods[PlayoutAPI.methods.rundownTake] = (rundownId: string) => {
	return ServerPlayoutAPI.takeNextPart(rundownId)
}
methods[PlayoutAPI.methods.rundownTogglePartArgument] = (rundownId: string, partId: string, property: string, value: string) => {
	return ServerPlayoutAPI.rundownTogglePartArgument(rundownId, partId, property, value)
}
methods[PlayoutAPI.methods.rundownSetNext] = (rundownId: string, partId: string, timeOffset?: number | undefined) => {
	return ServerPlayoutAPI.setNextPart(rundownId, partId, true, timeOffset)
}
methods[PlayoutAPI.methods.rundownActivateHold] = (rundownId: string) => {
	return ServerPlayoutAPI.activateHold(rundownId)
}
// methods[PlayoutAPI.methods.rundownStoriesMoved] = (rundownId: string, onAirNextWindowWidth: number | undefined, nextPosition: number | undefined) => {
// 	return ServerPlayoutAPI.rundownStoriesMoved(rundownId, onAirNextWindowWidth, nextPosition)
// }
methods[PlayoutAPI.methods.rundownDisableNextPiece] = (rundownId: string, undo?: boolean) => {
	return ServerPlayoutAPI.disableNextPiece(rundownId, undo)
}
methods[PlayoutAPI.methods.partPlaybackStartedCallback] = (rundownId: string, partId: string, startedPlayback: number) => {
	return ServerPlayoutAPI.onPartPlaybackStarted(rundownId, partId, startedPlayback)
}
methods[PlayoutAPI.methods.piecePlaybackStartedCallback] = (rundownId: string, pieceId: string, startedPlayback: number) => {
	return ServerPlayoutAPI.onPiecePlaybackStarted(rundownId, pieceId, startedPlayback)
}
methods[PlayoutAPI.methods.segmentAdLibLineItemStart] = (rundownId: string, partId: string, salliId: string, queue: boolean) => {
	return ServerPlayoutAPI.segmentAdLibPieceStart(rundownId, partId, salliId, queue)
}
methods[PlayoutAPI.methods.rundownBaselineAdLibPieceStart] = (rundownId: string, partId: string, robaliId: string, queue: boolean) => {
	return ServerPlayoutAPI.rundownBaselineAdLibPieceStart(rundownId, partId, robaliId, queue)
}
methods[PlayoutAPI.methods.segmentAdLibLineItemStop] = (rundownId: string, partId: string, pieceId: string) => {
	return ServerPlayoutAPI.startAdLibPiece(rundownId, partId, pieceId)
}
methods[PlayoutAPI.methods.sourceLayerOnLineStop] = (rundownId: string, partId: string, sourceLayerId: string) => {
	return ServerPlayoutAPI.sourceLayerOnLineStop(rundownId, partId, sourceLayerId)
}
methods[PlayoutAPI.methods.timelineTriggerTimeUpdateCallback] = (timelineObjId: string, time: number) => {
	return ServerPlayoutAPI.timelineTriggerTimeUpdateCallback(timelineObjId, time)
}
methods[PlayoutAPI.methods.sourceLayerStickyItemStart] = (rundownId: string, sourceLayerId: string) => {
	return ServerPlayoutAPI.sourceLayerStickyItemStart(rundownId, sourceLayerId)
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
