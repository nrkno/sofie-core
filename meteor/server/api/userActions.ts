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

const MINIMUM_TAKE_SPAN = 1000

/*
	The functions in this file are used to provide a pre-check, before calling the real functions.
	The pre-checks should contain relevant checks, to return user-friendly messages instead of throwing a nasty error.

	If it's not possible to perform an action due to an internal error (such as data not found, etc)
		-> throw an error
	If it's not possible to perform an action due to something the user can easily fix
		-> ClientAPI.responseError('Friendly message')
*/

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
			throw new Meteor.Error(404, `Part "${rundown.currentPartId}", set as currentPart in "${rundownId}", not found!`)
		}
	}
	return ServerPlayoutAPI.takeNextPart(rundown)
}
export function setNext (rundownId: string, nextSlId: string | null, setManually?: boolean, timeOffset?: number | undefined): ClientAPI.ClientResponse {
	check(rundownId, String)
	if (nextSlId) check(nextSlId, String)

	const rundown = Rundowns.findOne(rundownId)
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
	if (!rundown.active) return ClientAPI.responseError('Rundown is not active, please activate it before setting a part as Next')

	let nextPart: Part | undefined
	if (nextSlId) {
		nextPart = Parts.findOne(nextSlId)
		if (!nextPart) throw new Meteor.Error(404, `Part "${nextSlId}" not found!`)

		if (nextPart.invalid) return ClientAPI.responseError('Part is marked as invalid, cannot set as next.')
	}

	if (rundown.holdState && rundown.holdState !== RundownHoldState.COMPLETE) {
		return ClientAPI.responseError('The Next cannot be changed next during a Hold!')
	}

	return ServerPlayoutAPI.setNextPart(rundownId, nextSlId, setManually, timeOffset)
}
export function moveNext (
	rundownId: string,
	horisontalDelta: number,
	verticalDelta: number,
	setManually: boolean,
	currentNextPieceId?: string
): ClientAPI.ClientResponse {
	const rundown = Rundowns.findOne(rundownId)
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
	if (!rundown.active) return ClientAPI.responseError('Rundown is not active, please activate it first')

	if (rundown.holdState && rundown.holdState !== RundownHoldState.COMPLETE) {
		return ClientAPI.responseError('The Next cannot be changed next during a Hold!')
	}

	if (!currentNextPieceId) {
		if (!rundown.nextPartId) {
			return ClientAPI.responseError('Rundown has no next part!')
		}
	}
	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.moveNextPart(
			rundownId,
			horisontalDelta,
			verticalDelta,
			setManually,
			currentNextPieceId
		)
	)
}
export function prepareForBroadcast (rundownId: string): ClientAPI.ClientResponse {
	let rundown = Rundowns.findOne(rundownId)
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
	if (rundown.active) return ClientAPI.responseError('Rundown is active, please deactivate before preparing it for broadcast')
	const anyOtherActiveRundowns = areThereActiveRundownsInStudio(rundown.studioId, rundown._id)
	if (anyOtherActiveRundowns.length) {
		return ClientAPI.responseError('Only one rundown can be active at the same time. Currently active rundowns: ' + _.map(anyOtherActiveRundowns, rundown.name).join(', '))
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
export function resetAndActivate (rundownId: string): ClientAPI.ClientResponse {
	let rundown = Rundowns.findOne(rundownId)
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
	if (rundown.active && !rundown.rehearsal) {
		return ClientAPI.responseError('Rundown is active but not in rehearsal, please deactivate it or set in in rehearsal to be able to reset it.')
	}
	const anyOtherActiveRundowns = areThereActiveRundownsInStudio(rundown.studioId, rundown._id)
	if (anyOtherActiveRundowns.length) {
		return ClientAPI.responseError('Only one rundown can be active at the same time. Currently active rundowns: ' + _.map(anyOtherActiveRundowns, rundown.name).join(', '))
	}

	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.resetAndActivateRundown(rundownId)
	)
}
export function activate (rundownId: string, rehearsal: boolean): ClientAPI.ClientResponse {
	check(rehearsal, Boolean)
	let rundown = Rundowns.findOne(rundownId)
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
	const anyOtherActiveRundowns = areThereActiveRundownsInStudio(rundown.studioId, rundown._id)
	if (anyOtherActiveRundowns.length) {
		return ClientAPI.responseError('Only one rundown can be active at the same time. Currently active rundowns: ' + _.map(anyOtherActiveRundowns, rundown.name).join(', '))
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
	if (rundown.currentPartId !== part._id) return ClientAPI.responseError(`Part AdLib Items can be only placed in a current part!`)

	let showStyleBase = rundown.getShowStyleBase()
	const sourceL = showStyleBase.sourceLayers.find(i => i._id === piece.sourceLayerId)
	if (sourceL && sourceL.type !== SourceLayerType.GRAPHICS) return ClientAPI.responseError(`Part "${pieceId}" is not a GRAPHICS item!`)

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
		partId: part.externalId,
		type: IngestCacheType.PART
	})
	if (!partCache) throw new Meteor.Error(404, `Part Cache for "${partId}" not found!`)
	const piece = Pieces.findOne(pieceId)
	if (!piece) throw new Meteor.Error(404, `Piece "${pieceId}" not found!`)

	return ClientAPI.responseSuccess(
		// TODO: replace this with a general, non-MOS specific method
		MOSDeviceActions.setPieceInOutPoint(rundown, piece, partCache.data as IngestPart, inPoint / 1000, duration / 1000) // MOS data is in seconds
	)

}
export function segmentAdLibLineItemStart (rundownId: string, partId: string, slaiId: string, queue: boolean) {
	check(rundownId, String)
	check(partId, String)
	check(slaiId, String)

	let rundown = Rundowns.findOne(rundownId)
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
	if (!rundown.active) return ClientAPI.responseError(`The Rundown isn't active, please activate it before starting an AdLib!`)
	if (rundown.holdState === RundownHoldState.ACTIVE || rundown.holdState === RundownHoldState.PENDING) {
		return ClientAPI.responseError(`Can't start AdLib item when the Rundown is in Hold mode!`)
	}

	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.segmentAdLibPieceStart(rundownId, partId, slaiId, queue)
	)
}
export function sourceLayerOnLineStop (rundownId: string, partId: string, sourceLayerId: string) {
	check(rundownId, String)
	check(partId, String)
	check(sourceLayerId, String)

	let rundown = Rundowns.findOne(rundownId)
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
	if (!rundown.active) return ClientAPI.responseError(`The Rundown isn't active, can't stop an AdLib on a deactivated Rundown!`)

	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.sourceLayerOnLineStop(rundownId, partId, sourceLayerId)
	)
}
export function rundownBaselineAdLibPieceStart (rundownId: string, partId: string, robaliId: string, queue: boolean) {
	check(rundownId, String)
	check(partId, String)
	check(robaliId, String)

	let rundown = Rundowns.findOne(rundownId)
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
	if (!rundown.active) return ClientAPI.responseError(`The Rundown isn't active, please activate it before starting an AdLib!`)
	if (rundown.holdState === RundownHoldState.ACTIVE || rundown.holdState === RundownHoldState.PENDING) {
		return ClientAPI.responseError(`Can't start AdLib item when the Rundown is in Hold mode!`)
	}
	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.rundownBaselineAdLibPieceStart(rundownId, partId, robaliId, queue)
	)
}
export function segmentAdLibLineItemStop (rundownId: string, partId: string, pieceId: string) {
	check(rundownId, String)
	check(partId, String)
	check(pieceId, String)

	let rundown = Rundowns.findOne(rundownId)
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
	if (!rundown.active) return ClientAPI.responseError(`The Rundown isn't active, can't stop an AdLib in a deactivated Rundown!`)

	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.startAdLibPiece(rundownId, partId, pieceId)
	)
}
export function sourceLayerStickyItemStart (rundownId: string, sourceLayerId: string) {
	check(rundownId, String)
	check(sourceLayerId, String)

	const rundown = Rundowns.findOne(rundownId)
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
	if (!rundown.active) return ClientAPI.responseError(`The Rundown isn't active, please activate it before starting a sticky-item!`)
	if (!rundown.currentPartId) return ClientAPI.responseError(`No part is playing, please Take a part before starting a sticky.item.`)

	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.sourceLayerStickyItemStart(rundownId, sourceLayerId)
	)
}
export function activateHold (rundownId: string) {
	check(rundownId, String)

	let rundown = Rundowns.findOne(rundownId)
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)

	if (!rundown.currentPartId) return ClientAPI.responseError(`No part is currently playing, please Take a part before activating Hold mode!`)
	if (!rundown.nextPartId) return ClientAPI.responseError(`No part is set as Next, please set a Next before activating Hold mode!`)

	let currentPart = Parts.findOne({ _id: rundown.currentPartId })
	if (!currentPart) throw new Meteor.Error(404, `Part "${rundown.currentPartId}" not found!`)
	let nextPart = Parts.findOne({ _id: rundown.nextPartId })
	if (!nextPart) throw new Meteor.Error(404, `Part "${rundown.nextPartId}" not found!`)
	if (rundown.holdState) {
		return ClientAPI.responseError(`Rundown is already doing a hold!`)
	}

	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.activateHold(rundownId)
	)
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

interface UserMethods {
	[method: string]: (...args: any[]) => ClientAPI.ClientResponse
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
methods[UserActionAPI.methods.resetAndActivate] = function (rundownId: string): ClientAPI.ClientResponse {
	return resetAndActivate.call(this, rundownId)
}
methods[UserActionAPI.methods.activate] = function (rundownId: string, rehearsal: boolean): ClientAPI.ClientResponse {
	return activate.call(this, rundownId, rehearsal)
}
methods[UserActionAPI.methods.deactivate] = function (rundownId: string): ClientAPI.ClientResponse {
	return deactivate.call(this, rundownId)
}
methods[UserActionAPI.methods.reloadData] = function (rundownId: string): ClientAPI.ClientResponse {
	return reloadData.call(this, rundownId)
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
	return pieceSetInOutPoints(rundownId, partId, pieceId, inPoint, duration)
}
methods[UserActionAPI.methods.segmentAdLibLineItemStart] = function (rundownId: string, partId: string, salliId: string, queue: boolean) {
	return segmentAdLibLineItemStart.call(this, rundownId, partId, salliId, queue)
}
methods[UserActionAPI.methods.sourceLayerOnLineStop] = function (rundownId: string, partId: string, sourceLayerId: string) {
	return sourceLayerOnLineStop.call(this, rundownId, partId, sourceLayerId)
}
methods[UserActionAPI.methods.baselineAdLibItemStart] = function (rundownId: string, partId: string, robaliId: string, queue: boolean) {
	return rundownBaselineAdLibPieceStart.call(this, rundownId, partId, robaliId, queue)
}
methods[UserActionAPI.methods.segmentAdLibLineItemStop] = function (rundownId: string, partId: string, pieceId: string) {
	return segmentAdLibLineItemStop.call(this, rundownId, partId, pieceId)
}
methods[UserActionAPI.methods.sourceLayerStickyItemStart] = function (rundownId: string, sourceLayerId: string) {
	return sourceLayerStickyItemStart.call(this, rundownId, sourceLayerId)
}
methods[UserActionAPI.methods.activateHold] = function (rundownId: string): ClientAPI.ClientResponse {
	return activateHold.call(this, rundownId)
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

// Apply methods:
setMeteorMethods(methods)
