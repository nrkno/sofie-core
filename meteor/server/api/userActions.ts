import * as _ from 'underscore'
import { check } from 'meteor/check'
import { Meteor } from 'meteor/meteor'
import { ClientAPI } from '../../lib/api/client'
import {
	Rundowns,
	RundownHoldState
} from '../../lib/collections/Rundowns'
import { getCurrentTime } from '../../lib/lib'
import {
	Parts, Part
} from '../../lib/collections/Parts'
import { logger } from '../logging'
import { ServerPlayoutAPI } from './playout/playout'
import { UserActionAPI } from '../../lib/api/userActions'
import {
	EvaluationBase
} from '../../lib/collections/Evaluations'
import { Studios } from '../../lib/collections/Studios'
import { Pieces, Piece } from '../../lib/collections/Pieces'
import { SourceLayerType, IngestPart } from 'tv-automation-sofie-blueprints-integration'
import { storeRundownSnapshot } from './snapshot'
import { setMeteorMethods } from '../methods'
import { ServerRundownAPI } from './rundown'
import { ServerTestToolsAPI, getStudioConfig } from './testTools'
import { RecordedFiles } from '../../lib/collections/RecordedFiles'
import { saveEvaluation } from './evaluations'
import { MediaManagerAPI } from './mediaManager'
import { IngestDataCache, IngestCacheType } from '../../lib/collections/IngestDataCache'
import { MOSDeviceActions } from './ingest/mosDevice/actions'
import { areThereActiveRundownsInStudio } from './playout/studio'
import { IngestActions } from './ingest/actions'

let MINIMUM_TAKE_SPAN = 1000
export function setMinimumTakeSpan (span: number) {
	// Used in tests
	MINIMUM_TAKE_SPAN = span
}
/*
	The functions in this file are used to provide a pre-check, before calling the real functions.
	The pre-checks should contain relevant checks, to return user-friendly messages instead of throwing a nasty error.

	If it's not possible to perform an action due to an internal error (such as data not found, etc)
		-> throw an error
	If it's not possible to perform an action due to something the user can easily fix
		-> ClientAPI.responseError('Friendly message')
*/

// TODO - these use the rundownSyncFunction earlier, to ensure there arent differences when we get to the syncFunction?
export function take (rundownId: string): ClientAPI.ClientResponse {
	// Called by the user. Wont throw as nasty errors

	let rundown = Rundowns.findOne(rundownId)
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
	if (!rundown.active) {
		return ClientAPI.responseError(`Rundown is not active, please activate the rundown before doing a TAKE.`)
	}
	if (!rundown.nextPartId) {
		return ClientAPI.responseError('No Next point found, please set a part as Next before doing a TAKE.')
	}
	if (rundown.currentPartId) {
		const currentPart = Parts.findOne(rundown.currentPartId)
		if (currentPart && currentPart.timings) {
			const lastStartedPlayback = currentPart.timings.startedPlayback ? currentPart.timings.startedPlayback[currentPart.timings.startedPlayback.length - 1] : 0
			const lastTake = currentPart.timings.take ? currentPart.timings.take[currentPart.timings.take.length - 1] : 0
			const lastChange = Math.max(lastTake, lastStartedPlayback)
			if (getCurrentTime() - lastChange < MINIMUM_TAKE_SPAN) {
				logger.debug(`Time since last take is shorter than ${MINIMUM_TAKE_SPAN} for ${currentPart._id}: ${getCurrentTime() - lastStartedPlayback}`)
				logger.debug(`lastStartedPlayback: ${lastStartedPlayback}, getCurrentTime(): ${getCurrentTime()}`)
				return ClientAPI.responseError(`Ignoring TAKES that are too quick after eachother (${MINIMUM_TAKE_SPAN} ms)`)
			}
		} else {
			// Don't throw an error here. It's bad, but it's more important to be able to continue with the take.
			logger.error(`Part "${rundown.currentPartId}", set as currentPart in "${rundownId}", not found!`)
		}
	}
	return ServerPlayoutAPI.takeNextPart(rundown._id)
}
export function setNext (rundownId: string, nextPartId: string | null, setManually?: boolean, timeOffset?: number | undefined): ClientAPI.ClientResponse {
	check(rundownId, String)
	if (nextPartId) check(nextPartId, String)

	const rundown = Rundowns.findOne(rundownId)
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
	if (!rundown.active) return ClientAPI.responseError('Rundown is not active, please activate it before setting a part as Next')

	let nextPart: Part | undefined
	if (nextPartId) {
		nextPart = Parts.findOne(nextPartId)
		if (!nextPart) throw new Meteor.Error(404, `Part "${nextPartId}" not found!`)

		if (nextPart.invalid) return ClientAPI.responseError('Part is marked as invalid, cannot set as next.')
	}

	if (rundown.holdState && rundown.holdState !== RundownHoldState.COMPLETE) {
		return ClientAPI.responseError('The Next cannot be changed next during a Hold!')
	}

	return ServerPlayoutAPI.setNextPart(rundownId, nextPartId, setManually, timeOffset)
}
export function moveNext (
	rundownId: string,
	horisontalDelta: number,
	verticalDelta: number,
	setManually: boolean
): ClientAPI.ClientResponse {
	const rundown = Rundowns.findOne(rundownId)
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
	if (!rundown.active) return ClientAPI.responseError('Rundown is not active, please activate it first')

	if (rundown.holdState && rundown.holdState !== RundownHoldState.COMPLETE) {
		return ClientAPI.responseError('The Next cannot be changed next during a Hold!')
	}

	if (!rundown.nextPartId && !rundown.currentPartId) {
		return ClientAPI.responseError('Rundown has no next and no current part!')
	}

	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.moveNextPart(
			rundownId,
			horisontalDelta,
			verticalDelta,
			setManually
		)
	)
}
export function prepareForBroadcast (rundownId: string): ClientAPI.ClientResponse {
	let rundown = Rundowns.findOne(rundownId)
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
	if (rundown.active) return ClientAPI.responseError('Rundown is active, please deactivate before preparing it for broadcast')
	const anyOtherActiveRundowns = areThereActiveRundownsInStudio(rundown.studioId, rundown._id)
	if (anyOtherActiveRundowns.length) {
		return ClientAPI.responseError(409, 'Only one rundown can be active at the same time. Currently active rundowns: ' + _.map(anyOtherActiveRundowns, rundown.name).join(', '), anyOtherActiveRundowns)
	}
	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.prepareRundownForBroadcast(rundownId)
	)
}
export function resetRundown (rundownId: string): ClientAPI.ClientResponse {
	let rundown = Rundowns.findOne(rundownId)
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
	if (rundown.active && !rundown.rehearsal) {
		return ClientAPI.responseError('Rundown is active but not in rehearsal, please deactivate it or set in in rehearsal to be able to reset it.')
	}

	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.resetRundown(rundownId)
	)
}
export function resetAndActivate (rundownId: string, rehearsal?: boolean): ClientAPI.ClientResponse {
	let rundown = Rundowns.findOne(rundownId)
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
	if (rundown.active && !rundown.rehearsal) {
		return ClientAPI.responseError('Rundown is active but not in rehearsal, please deactivate it or set in in rehearsal to be able to reset it.')
	}
	const anyOtherActiveRundowns = areThereActiveRundownsInStudio(rundown.studioId, rundown._id)
	if (anyOtherActiveRundowns.length) {
		return ClientAPI.responseError(409, 'Only one rundown can be active at the same time. Currently active rundowns: ' + _.map(anyOtherActiveRundowns, rundown.name).join(', '), anyOtherActiveRundowns)
	}

	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.resetAndActivateRundown(rundownId, rehearsal)
	)
}
export function forceResetAndActivate (rundownId: string, rehearsal: boolean): ClientAPI.ClientResponse {
	// Reset and activates a rundown, automatically deactivates any other running rundowns

	check(rehearsal, Boolean)
	let rundown = Rundowns.findOne(rundownId)
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)

	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.forceResetAndActivateRundown(rundownId, rehearsal)
	)
}
export function activate (rundownId: string, rehearsal: boolean): ClientAPI.ClientResponse {
	check(rehearsal, Boolean)
	let rundown = Rundowns.findOne(rundownId)
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
	const anyOtherActiveRundowns = areThereActiveRundownsInStudio(rundown.studioId, rundown._id)
	if (anyOtherActiveRundowns.length) {
		return ClientAPI.responseError(409, 'Only one rundown can be active at the same time. Currently active rundowns: ' + _.map(anyOtherActiveRundowns, rundown.name).join(', '), anyOtherActiveRundowns)
	}
	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.activateRundown(rundownId, rehearsal)
	)
}
export function deactivate (rundownId: string): ClientAPI.ClientResponse {
	let rundown = Rundowns.findOne(rundownId)
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.deactivateRundown(rundownId)
	)

}
export function reloadData (rundownId: string) {
	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.reloadData(rundownId)
	)
}
export function unsyncRundown (rundownId: string) {
	return ClientAPI.responseSuccess(
		ServerRundownAPI.unsyncRundown(rundownId)
	)
}
export function disableNextPiece (rundownId: string, undo?: boolean) {
	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.disableNextPiece(rundownId, undo)
	)
}
export function togglePartArgument (rundownId: string, partId: string, property: string, value: string) {
	const rundown = Rundowns.findOne(rundownId)
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
	if (rundown.holdState === RundownHoldState.ACTIVE || rundown.holdState === RundownHoldState.PENDING) {
		return ClientAPI.responseError(`Part-arguments can't be toggled while Rundown is in Hold mode!`)
	}
	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.rundownTogglePartArgument(rundownId, partId, property, value)
	)
}
export function pieceTakeNow (rundownId: string, partId: string, pieceId: string) {
	check(rundownId, String)
	check(partId, String)
	check(pieceId, String)

	let rundown = Rundowns.findOne(rundownId)
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
	if (!rundown.active) return ClientAPI.responseError(`The Rundown isn't active, please activate it before starting an AdLib!`)

	let piece = Pieces.findOne({
		_id: pieceId,
		rundownId: rundownId
	}) as Piece
	if (!piece) throw new Meteor.Error(404, `Piece "${pieceId}" not found!`)

	let part = Parts.findOne({
		_id: partId,
		rundownId: rundownId
	})
	if (!part) throw new Meteor.Error(404, `Part "${partId}" not found!`)
	if (rundown.currentPartId !== part._id) return ClientAPI.responseError(`Part AdLib-pieces can be only placed in a current part!`)

	let showStyleBase = rundown.getShowStyleBase()
	const sourceL = showStyleBase.sourceLayers.find(i => i._id === piece.sourceLayerId)
	if (sourceL && sourceL.type !== SourceLayerType.GRAPHICS) return ClientAPI.responseError(`Part "${pieceId}" is not a GRAPHICS piece!`)

	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.pieceTakeNow(rundownId, partId, pieceId)
	)
}
export function pieceSetInOutPoints (rundownId: string, partId: string, pieceId: string, inPoint: number, duration: number) {
	check(rundownId, String)
	check(partId, String)
	check(pieceId, String)
	check(inPoint, Number)
	check(duration, Number)

	const rundown = Rundowns.findOne(rundownId)
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
	const part = Parts.findOne(partId)
	if (!part) throw new Meteor.Error(404, `Part "${partId}" not found!`)
	if (rundown && rundown.active && part.status === 'PLAY') {
		return ClientAPI.responseError(`Part cannot be active while setting in/out!`) // @todo: un-hardcode
	}
	const partCache = IngestDataCache.findOne({
		rundownId: rundown._id,
		partId: part._id,
		type: IngestCacheType.PART
	})
	if (!partCache) throw new Meteor.Error(404, `Part Cache for "${partId}" not found!`)
	const piece = Pieces.findOne(pieceId)
	if (!piece) throw new Meteor.Error(404, `Piece "${pieceId}" not found!`)

	// TODO: replace this with a general, non-MOS specific method
	return MOSDeviceActions.setPieceInOutPoint(rundown, piece, partCache.data as IngestPart, inPoint / 1000, duration / 1000) // MOS data is in seconds
		.then((res) => ClientAPI.responseSuccess(res))
		.catch((err) => ClientAPI.responseError(err))
}
export function segmentAdLibPieceStart (rundownId: string, partId: string, slaiId: string, queue: boolean) {
	check(rundownId, String)
	check(partId, String)
	check(slaiId, String)

	let rundown = Rundowns.findOne(rundownId)
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
	if (!rundown.active) return ClientAPI.responseError(`The Rundown isn't active, please activate it before starting an AdLib!`)
	if (rundown.holdState === RundownHoldState.ACTIVE || rundown.holdState === RundownHoldState.PENDING) {
		return ClientAPI.responseError(`Can't start AdLibPiece when the Rundown is in Hold mode!`)
	}

	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.segmentAdLibPieceStart(rundownId, partId, slaiId, queue)
	)
}
export function sourceLayerOnPartStop (rundownId: string, partId: string, sourceLayerId: string) {
	check(rundownId, String)
	check(partId, String)
	check(sourceLayerId, String)

	let rundown = Rundowns.findOne(rundownId)
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
	if (!rundown.active) return ClientAPI.responseError(`The Rundown isn't active, can't stop an AdLib on a deactivated Rundown!`)

	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.sourceLayerOnPartStop(rundownId, partId, sourceLayerId)
	)
}
export function rundownBaselineAdLibPieceStart (rundownId: string, partId: string, pieceId: string, queue: boolean) {
	check(rundownId, String)
	check(partId, String)
	check(pieceId, String)

	let rundown = Rundowns.findOne(rundownId)
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
	if (!rundown.active) return ClientAPI.responseError(`The Rundown isn't active, please activate it before starting an AdLib!`)
	if (rundown.holdState === RundownHoldState.ACTIVE || rundown.holdState === RundownHoldState.PENDING) {
		return ClientAPI.responseError(`Can't start AdLib piece when the Rundown is in Hold mode!`)
	}
	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.rundownBaselineAdLibPieceStart(rundownId, partId, pieceId, queue)
	)
}
export function segmentAdLibPieceStop (rundownId: string, partId: string, pieceId: string) {
	check(rundownId, String)
	check(partId, String)
	check(pieceId, String)

	let rundown = Rundowns.findOne(rundownId)
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
	if (!rundown.active) return ClientAPI.responseError(`The Rundown isn't active, can't stop an AdLib in a deactivated Rundown!`)

	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.stopAdLibPiece(rundownId, partId, pieceId)
	)
}
export function sourceLayerStickyPieceStart (rundownId: string, sourceLayerId: string) {
	check(rundownId, String)
	check(sourceLayerId, String)

	const rundown = Rundowns.findOne(rundownId)
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
	if (!rundown.active) return ClientAPI.responseError(`The Rundown isn't active, please activate it before starting a sticky-item!`)
	if (!rundown.currentPartId) return ClientAPI.responseError(`No part is playing, please Take a part before starting a sticky-item.`)

	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.sourceLayerStickyPieceStart(rundownId, sourceLayerId)
	)
}
export function activateHold (rundownId: string, undo?: boolean) {
	check(rundownId, String)

	let rundown = Rundowns.findOne(rundownId)
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)

	if (!rundown.currentPartId) return ClientAPI.responseError(`No part is currently playing, please Take a part before activating Hold mode!`)
	if (!rundown.nextPartId) return ClientAPI.responseError(`No part is set as Next, please set a Next before activating Hold mode!`)

	let currentPart = Parts.findOne({ _id: rundown.currentPartId })
	if (!currentPart) throw new Meteor.Error(404, `Part "${rundown.currentPartId}" not found!`)
	let nextPart = Parts.findOne({ _id: rundown.nextPartId })
	if (!nextPart) throw new Meteor.Error(404, `Part "${rundown.nextPartId}" not found!`)
	if (!undo && rundown.holdState) {
		return ClientAPI.responseError(`Rundown is already doing a hold!`)
	}
	if (undo && rundown.holdState !== RundownHoldState.PENDING) {
		return ClientAPI.responseError(`Can't undo hold from state: ${RundownHoldState[rundown.holdState || 0]}`)
	}

	if (undo) {
		return ClientAPI.responseSuccess(
			ServerPlayoutAPI.deactivateHold(rundownId)
		)
	} else {
		return ClientAPI.responseSuccess(
			ServerPlayoutAPI.activateHold(rundownId)
		)
	}
}
export function userSaveEvaluation (evaluation: EvaluationBase): ClientAPI.ClientResponse {
	return ClientAPI.responseSuccess(
		saveEvaluation.call(this, evaluation)
	)
}
export function userStoreRundownSnapshot (rundownId: string, reason: string) {
	return ClientAPI.responseSuccess(
		storeRundownSnapshot(rundownId, reason)
	)
}
export function removeRundown (rundownId: string) {
	let rundown = Rundowns.findOne(rundownId)
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
	if (rundown.active) return ClientAPI.responseError(`The Rundown is currently active, you can't remove an active Rundown!`)

	return ClientAPI.responseSuccess(
		ServerRundownAPI.removeRundown(rundownId)
	)
}
export function resyncRundown (rundownId: string) {
	let rundown = Rundowns.findOne(rundownId)
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
	// if (rundown.active) return ClientAPI.responseError(`The Rundown is currently active, you need to deactivate it before resyncing it.`)

	return ClientAPI.responseSuccess(
		ServerRundownAPI.resyncRundown(rundownId)
	)
}
export function recordStop (studioId: string) {
	check(studioId, String)
	const record = RecordedFiles.findOne({
		studioId: studioId,
		stoppedAt: { $exists: false }
	})
	if (!record) return ClientAPI.responseError(`No active recording for "${studioId}" was found!`)
	return ClientAPI.responseSuccess(
		ServerTestToolsAPI.recordStop(studioId)
	)
}

export function recordStart (studioId: string, fileName: string) {
	check(studioId, String)
	check(fileName, String)
	const studio = Studios.findOne(studioId)
	if (!studio) throw new Meteor.Error(404, `Studio "${studioId}" was not found!`)

	const active = RecordedFiles.findOne({
		studioId: studioId,
		stoppedAt: { $exists: false }
	})
	if (active) return ClientAPI.responseError(`There is already an active recording in studio "${studioId}"!`)

	const config = getStudioConfig(studio)
	if (!config.recordings.channelIndex)	return ClientAPI.responseError(`Cannot start recording due to a missing setting: "channel".`)
	if (!config.recordings.deviceId)		return ClientAPI.responseError(`Cannot start recording due to a missing setting: "device".`)
	if (!config.recordings.decklinkDevice)	return ClientAPI.responseError(`Cannot start recording due to a missing setting: "decklink".`)
	if (!config.recordings.channelIndex)	return ClientAPI.responseError(`Cannot start recording due to a missing setting: "channel".`)

	return ClientAPI.responseSuccess(
		ServerTestToolsAPI.recordStart(studioId, fileName)
	)
}
export function recordDelete (id: string) {
	return ClientAPI.responseSuccess(
		ServerTestToolsAPI.recordDelete(id)
	)
}
export function mediaRestartWorkflow (workflowId: string) {
	return ClientAPI.responseSuccess(
		MediaManagerAPI.restartWorkflow(workflowId)
	)
}
export function mediaAbortWorkflow (workflowId: string) {
	return ClientAPI.responseSuccess(
		MediaManagerAPI.abortWorkflow(workflowId)
	)
}
export function mediaPrioritizeWorkflow (workflowId: string) {
	return ClientAPI.responseSuccess(
		MediaManagerAPI.prioritizeWorkflow(workflowId)
	)
}
export function mediaRestartAllWorkflows () {
	return ClientAPI.responseSuccess(
		MediaManagerAPI.restartAllWorkflows()
	)
}
export function mediaAbortAllWorkflows () {
	return ClientAPI.responseSuccess(
		MediaManagerAPI.abortAllWorkflows()
	)
}
export function regenerateRundown (rundownId: string) {
	check(rundownId, String)

	const rundown = Rundowns.findOne(rundownId)
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found`)

	if (rundown.active) {
		return ClientAPI.responseError(`Rundown is active, please deactivate it before regenerating it.`)
	}

	return ClientAPI.responseSuccess(
		IngestActions.regenerateRundown(rundownId)
	)
}

interface UserMethods {
	[method: string]: (...args: any[]) => ClientAPI.ClientResponse | Promise<ClientAPI.ClientResponse>
}
let methods: UserMethods = {}

methods[UserActionAPI.methods.take] = function (rundownId: string): ClientAPI.ClientResponse {
	return take.call(this, rundownId)
}
methods[UserActionAPI.methods.setNext] = function (rundownId: string, partId: string, timeOffset?: number): ClientAPI.ClientResponse {
	return setNext.call(this, rundownId, partId, true, timeOffset)
}
methods[UserActionAPI.methods.moveNext] = function (rundownId: string, horisontalDelta: number, verticalDelta: number): ClientAPI.ClientResponse {
	return moveNext.call(this, rundownId, horisontalDelta, verticalDelta, true)
}
methods[UserActionAPI.methods.prepareForBroadcast] = function (rundownId: string): ClientAPI.ClientResponse {
	return prepareForBroadcast.call(this, rundownId)
}
methods[UserActionAPI.methods.resetRundown] = function (rundownId: string): ClientAPI.ClientResponse {
	return resetRundown.call(this, rundownId)
}
methods[UserActionAPI.methods.resetAndActivate] = function (rundownId: string, rehearsal?: boolean): ClientAPI.ClientResponse {
	return resetAndActivate.call(this, rundownId, rehearsal)
}
methods[UserActionAPI.methods.activate] = function (rundownId: string, rehearsal: boolean): ClientAPI.ClientResponse {
	return activate.call(this, rundownId, rehearsal)
}
methods[UserActionAPI.methods.deactivate] = function (rundownId: string): ClientAPI.ClientResponse {
	return deactivate.call(this, rundownId)
}
methods[UserActionAPI.methods.forceResetAndActivate] = function (rundownId: string, rehearsal: boolean): ClientAPI.ClientResponse {
	return forceResetAndActivate.call(this, rundownId, rehearsal)
}
methods[UserActionAPI.methods.reloadData] = function (rundownId: string): ClientAPI.ClientResponse {
	return reloadData.call(this, rundownId)
}
methods[UserActionAPI.methods.unsyncRundown] = function (rundownId: string): ClientAPI.ClientResponse {
	return unsyncRundown.call(this, rundownId)
}
methods[UserActionAPI.methods.disableNextPiece] = function (rundownId: string, undo?: boolean): ClientAPI.ClientResponse {
	return disableNextPiece.call(this, rundownId, undo)
}
methods[UserActionAPI.methods.togglePartArgument] = function (rundownId: string, partId: string, property: string, value: string): ClientAPI.ClientResponse {
	return togglePartArgument.call(this, rundownId, partId, property, value)
}
methods[UserActionAPI.methods.pieceTakeNow] = function (rundownId: string, partId: string, pieceId: string): ClientAPI.ClientResponse {
	return pieceTakeNow.call(this, rundownId, partId, pieceId)
}
methods[UserActionAPI.methods.setInOutPoints] = function (rundownId: string, partId: string, pieceId: string, inPoint: number, duration: number): ClientAPI.ClientResponse {
	return pieceSetInOutPoints.call(this, rundownId, partId, pieceId, inPoint, duration)
}
methods[UserActionAPI.methods.segmentAdLibPieceStart] = function (rundownId: string, partId: string, salliId: string, queue: boolean) {
	return segmentAdLibPieceStart.call(this, rundownId, partId, salliId, queue)
}
methods[UserActionAPI.methods.sourceLayerOnPartStop] = function (rundownId: string, partId: string, sourceLayerId: string) {
	return sourceLayerOnPartStop.call(this, rundownId, partId, sourceLayerId)
}
methods[UserActionAPI.methods.baselineAdLibPieceStart] = function (rundownId: string, partId: string, pieceId: string, queue: boolean) {
	return rundownBaselineAdLibPieceStart.call(this, rundownId, partId, pieceId, queue)
}
methods[UserActionAPI.methods.segmentAdLibPieceStop] = function (rundownId: string, partId: string, pieceId: string) {
	return segmentAdLibPieceStop.call(this, rundownId, partId, pieceId)
}
methods[UserActionAPI.methods.sourceLayerStickyPieceStart] = function (rundownId: string, sourceLayerId: string) {
	return sourceLayerStickyPieceStart.call(this, rundownId, sourceLayerId)
}
methods[UserActionAPI.methods.activateHold] = function (rundownId: string, undo?: boolean): ClientAPI.ClientResponse {
	return activateHold.call(this, rundownId, undo)
}
methods[UserActionAPI.methods.saveEvaluation] = function (evaluation: EvaluationBase): ClientAPI.ClientResponse {
	return userSaveEvaluation.call(this, evaluation)
}
methods[UserActionAPI.methods.storeRundownSnapshot] = function (rundownId: string, reason: string) {
	return userStoreRundownSnapshot.call(this, rundownId, reason)
}
methods[UserActionAPI.methods.removeRundown] = function (rundownId: string) {
	return removeRundown.call(this, rundownId)
}
methods[UserActionAPI.methods.resyncRundown] = function (rundownId: string) {
	return resyncRundown.call(this, rundownId)
}
methods[UserActionAPI.methods.recordStop] = function (studioId: string) {
	return recordStop.call(this, studioId)
}
methods[UserActionAPI.methods.recordStart] = function (studioId: string, name: string) {
	return recordStart.call(this, studioId, name)
}
methods[UserActionAPI.methods.recordDelete] = function (id: string) {
	return recordDelete.call(this, id)
}
methods[UserActionAPI.methods.mediaRestartWorkflow] = function (workflowId: string) {
	return mediaRestartWorkflow.call(this, workflowId)
}
methods[UserActionAPI.methods.mediaAbortWorkflow] = function (workflowId: string) {
	return mediaAbortWorkflow.call(this, workflowId)
}
methods[UserActionAPI.methods.mediaPrioritizeWorkflow] = function (workflowId: string) {
	return mediaPrioritizeWorkflow.call(this, workflowId)
}
methods[UserActionAPI.methods.mediaRestartAllWorkflows] = function () {
	return mediaRestartAllWorkflows.call(this)
}
methods[UserActionAPI.methods.mediaAbortAllWorkflows] = function () {
	return mediaAbortAllWorkflows.call(this)
}
methods[UserActionAPI.methods.regenerateRundown] = function (rundownId: string) {
	return regenerateRundown.call(this, rundownId)
}

// Apply methods:
setMeteorMethods(methods)
