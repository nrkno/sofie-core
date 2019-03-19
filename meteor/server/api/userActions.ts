import * as _ from 'underscore'
import { check } from 'meteor/check'
import { Meteor } from 'meteor/meteor'
import { ClientAPI } from '../../lib/api/client'
import {
	RunningOrders,
	RunningOrderHoldState
} from '../../lib/collections/RunningOrders'
import { getCurrentTime } from '../../lib/lib'
import {
	SegmentLines
} from '../../lib/collections/SegmentLines'
import { logger } from '../logging'
import { ServerPlayoutAPI } from './playout'
import { UserActionAPI } from '../../lib/api/userActions'
import {
	EvaluationBase
} from '../../lib/collections/Evaluations'
import { StudioInstallations } from '../../lib/collections/StudioInstallations'
import { SegmentLineItems, SegmentLineItem } from '../../lib/collections/SegmentLineItems'
import { SourceLayerType } from 'tv-automation-sofie-blueprints-integration'
import { storeRunningOrderSnapshot } from './snapshot'
import { setMeteorMethods } from '../methods'
import { ServerRunningOrderAPI } from './runningOrder'
import { ServerTestToolsAPI, getStudioConfig } from './testTools'
import { RecordedFiles } from '../../lib/collections/RecordedFiles'
import { saveEvaluation } from './evaluations'
import { MediaManagerAPI } from './mediaManager'
import { number } from 'prop-types';
import { RunningOrderDataCache } from '../../lib/collections/RunningOrderDataCache';
import { MosIntegration, replaceStoryItem } from './integration/mos';

const MINIMUM_TAKE_SPAN = 1000

/*
	The functions in this file are used to provide a pre-check, before calling the real functions.
	The pre-checks should contain relevant checks, to return user-friendly messages instead of throwing a nasty error.

	If it's not possible to perform an action due to an internal error (such as data not found, etc)
		-> throw an error
	If it's not possible to perform an action due to something the user can easily fix
		-> ClientAPI.responseError('Friendly message')
*/

export function take (roId: string): ClientAPI.ClientResponse {
	// Called by the user. Wont throw as nasty errors

	let runningOrder = RunningOrders.findOne(roId)
	if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)
	if (!runningOrder.active) {
		return ClientAPI.responseError(`RunningOrder is not active, please activate the runningOrder before doing a TAKE.`)
	}
	if (!runningOrder.nextSegmentLineId) {
		return ClientAPI.responseError('No Next point found, please set a segmentLine as Next before doing a TAKE.')
	}
	if (runningOrder.currentSegmentLineId) {
		const currentSegmentLine = SegmentLines.findOne(runningOrder.currentSegmentLineId)
		if (currentSegmentLine && currentSegmentLine.timings) {
			const lastStartedPlayback = currentSegmentLine.timings.startedPlayback ? currentSegmentLine.timings.startedPlayback[currentSegmentLine.timings.startedPlayback.length - 1] : 0
			const lastTake = currentSegmentLine.timings.take ? currentSegmentLine.timings.take[currentSegmentLine.timings.take.length - 1] : 0
			const lastChange = Math.max(lastTake, lastStartedPlayback)
			if (getCurrentTime() - lastChange < MINIMUM_TAKE_SPAN) {
				logger.debug(`Time since last take is shorter than ${MINIMUM_TAKE_SPAN} for ${currentSegmentLine._id}: ${getCurrentTime() - lastStartedPlayback}`)
				return ClientAPI.responseError(`Ignoring TAKES that are too quick after eachother (${MINIMUM_TAKE_SPAN} ms)`)
			}
		} else {
			throw new Meteor.Error(404, `SegmentLine "${runningOrder.currentSegmentLineId}", set as currentSegmentLine in "${roId}", not found!`)
		}
	}
	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.roTake(runningOrder)
	)
}
export function setNext (roId: string, nextSlId: string | null, setManually?: boolean): ClientAPI.ClientResponse {
	check(roId, String)
	if (nextSlId) check(nextSlId, String)

	const runningOrder = RunningOrders.findOne(roId)
	if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)
	if (!runningOrder.active) return ClientAPI.responseError('RunningOrder is not active, please activate it before setting a segmentLine as Next')

	if (runningOrder.holdState && runningOrder.holdState !== RunningOrderHoldState.COMPLETE) {
		return ClientAPI.responseError('The Next cannot be changed next during a Hold!')
	}

	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.roSetNext(roId, nextSlId, setManually)
	)
}
export function moveNext (
	roId: string,
	horisontalDelta: number,
	verticalDelta: number,
	setManually: boolean,
	currentNextSegmentLineItemId?: string
): ClientAPI.ClientResponse {
	const runningOrder = RunningOrders.findOne(roId)
	if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)
	if (!runningOrder.active) return ClientAPI.responseError('RunningOrder is not active, please activate it first')

	if (runningOrder.holdState && runningOrder.holdState !== RunningOrderHoldState.COMPLETE) {
		return ClientAPI.responseError('The Next cannot be changed next during a Hold!')
	}

	if (!currentNextSegmentLineItemId) {
		if (!runningOrder.nextSegmentLineId) {
			return ClientAPI.responseError('RunningOrder has no next segmentLine!')
		}
	}
	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.roMoveNext(
			roId,
			horisontalDelta,
			verticalDelta,
			setManually,
			currentNextSegmentLineItemId
		)
	)
}
export function prepareForBroadcast (roId: string): ClientAPI.ClientResponse {
	let runningOrder = RunningOrders.findOne(roId)
	if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)
	if (runningOrder.active) return ClientAPI.responseError('RunningOrder is active, please deactivate before preparing it for broadcast')
	const anyOtherActiveRunningOrders = ServerPlayoutAPI.areThereActiveROsInStudio(runningOrder.studioInstallationId, runningOrder._id)
	if (anyOtherActiveRunningOrders.length) {
		return ClientAPI.responseError('Only one running-order can be active at the same time. Currently active runningOrders: ' + _.pluck(anyOtherActiveRunningOrders, 'name').join(', '))
	}
	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.roPrepareForBroadcast(roId)
	)
}
export function resetRunningOrder (roId: string): ClientAPI.ClientResponse {
	let runningOrder = RunningOrders.findOne(roId)
	if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)
	if (runningOrder.active && !runningOrder.rehearsal) {
		return ClientAPI.responseError('RunningOrder is active but not in rehearsal, please deactivate it or set in in rehearsal to be able to reset it.')
	}

	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.roResetRunningOrder(roId)
	)
}
export function resetAndActivate (roId: string): ClientAPI.ClientResponse {
	let runningOrder = RunningOrders.findOne(roId)
	if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)
	if (runningOrder.active && !runningOrder.rehearsal) {
		return ClientAPI.responseError('RunningOrder is active but not in rehearsal, please deactivate it or set in in rehearsal to be able to reset it.')
	}
	const anyOtherActiveRunningOrders = ServerPlayoutAPI.areThereActiveROsInStudio(runningOrder.studioInstallationId, runningOrder._id)
	if (anyOtherActiveRunningOrders.length) {
		return ClientAPI.responseError('Only one running-order can be active at the same time. Currently active runningOrders: ' + _.pluck(anyOtherActiveRunningOrders, 'name').join(', '))
	}

	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.roResetAndActivate(roId)
	)
}
export function activate (roId: string, rehearsal: boolean): ClientAPI.ClientResponse {
	check(rehearsal, Boolean)
	let runningOrder = RunningOrders.findOne(roId)
	if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)
	const anyOtherActiveRunningOrders = ServerPlayoutAPI.areThereActiveROsInStudio(runningOrder.studioInstallationId, runningOrder._id)
	if (anyOtherActiveRunningOrders.length) {
		return ClientAPI.responseError('Only one running-order can be active at the same time. Currently active runningOrders: ' + _.pluck(anyOtherActiveRunningOrders, 'name').join(', '))
	}
	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.roActivate(roId, rehearsal)
	)
}
export function deactivate (roId: string): ClientAPI.ClientResponse {
	let runningOrder = RunningOrders.findOne(roId)
	if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)
	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.roDeactivate(roId)
	)

}
export function reloadData (roId: string) {
	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.reloadData(roId)
	)
}
export function disableNextSegmentLineItem (roId: string, undo?: boolean) {
	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.roDisableNextSegmentLineItem(roId, undo)
	)
}
export function toggleSegmentLineArgument (roId: string, slId: string, property: string, value: string) {
	const runningOrder = RunningOrders.findOne(roId)
	if (!runningOrder) throw new Meteor.Error(404, `Running order "${roId}" not found!`)
	if (runningOrder.holdState === RunningOrderHoldState.ACTIVE || runningOrder.holdState === RunningOrderHoldState.PENDING) {
		return ClientAPI.responseError(`SegmentLine-arguments can't be toggled while RunningOrder is in Hold mode!`)
	}
	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.roToggleSegmentLineArgument(roId, slId, property, value)
	)
}
export function segmentLineItemTakeNow (roId: string, slId: string, sliId: string) {
	check(roId, String)
	check(slId, String)
	check(sliId, String)

	let runningOrder = RunningOrders.findOne(roId)
	if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)
	if (!runningOrder.active) return ClientAPI.responseError(`The RunningOrder isn't active, please activate it before starting an AdLib!`)

	let slItem = SegmentLineItems.findOne({
		_id: sliId,
		runningOrderId: roId
	}) as SegmentLineItem
	if (!slItem) throw new Meteor.Error(404, `SegmentLineItem "${sliId}" not found!`)

	let segLine = SegmentLines.findOne({
		_id: slId,
		runningOrderId: roId
	})
	if (!segLine) throw new Meteor.Error(404, `SegmentLine "${slId}" not found!`)
	if (runningOrder.currentSegmentLineId !== segLine._id) return ClientAPI.responseError(`SegmentLine AdLib Items can be only placed in a current segment line!`)

	let showStyleBase = runningOrder.getShowStyleBase()
	const sourceL = showStyleBase.sourceLayers.find(i => i._id === slItem.sourceLayerId)
	if (sourceL && sourceL.type !== SourceLayerType.GRAPHICS) return ClientAPI.responseError(`SegmentLine "${slId}" is not a GRAPHICS item!`)

	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.segmentLineItemTakeNow(roId, slId, sliId)
	)
}
export function segmentLineItemSetInOutPoints (roId: string, slId: string, sliId: string, inPoint: number, outPoint: number) {
	check(roId, String)
	check(slId, String)
	check(sliId, String)
	check(inPoint, Number)
	check(outPoint, Number)

	const runningOrder = RunningOrders.findOne(roId)
	if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)
	const sl = SegmentLines.findOne(slId)
	if (!sl) throw new Meteor.Error(404, `SegmentLine "${slId}" not found!`)
	if (runningOrder && runningOrder.active && sl.status === "PLAY") {
		return ClientAPI.responseError(`SegmentLine cannot be active while setting in/out!`) // @todo: un-hardcode
	}
	const slCache = RunningOrderDataCache.findOne(roId + '_fullStory' + slId)
	if (!slCache) throw new Meteor.Error(404, `SegmentLine Cache for "${slId}" not found!`)
	const sli = SegmentLineItems.findOne(sliId)
	if (!sli) throw new Meteor.Error(404, `SegmentLineItem "${sliId}" not found!`)

	return ClientAPI.responseSuccess(
		replaceStoryItem(runningOrder, sli, slCache, inPoint, outPoint)
	)

}
export function segmentAdLibLineItemStart (roId: string, slId: string, slaiId: string, queue: boolean) {
	check(roId, String)
	check(slId, String)
	check(slaiId, String)

	let runningOrder = RunningOrders.findOne(roId)
	if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)
	if (!runningOrder.active) return ClientAPI.responseError(`The RunningOrder isn't active, please activate it before starting an AdLib!`)
	if (runningOrder.holdState === RunningOrderHoldState.ACTIVE || runningOrder.holdState === RunningOrderHoldState.PENDING) {
		return ClientAPI.responseError(`Can't start AdLib item when the RunningOrder is in Hold mode!`)
	}

	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.segmentAdLibLineItemStart(roId, slId, slaiId, queue)
	)
}
export function sourceLayerOnLineStop (roId: string, slId: string, sourceLayerId: string) {
	check(roId, String)
	check(slId, String)
	check(sourceLayerId, String)

	let runningOrder = RunningOrders.findOne(roId)
	if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)
	if (!runningOrder.active) return ClientAPI.responseError(`The RunningOrder isn't active, can't stop an AdLib on a deactivated RunningOrder!`)

	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.sourceLayerOnLineStop(roId, slId, sourceLayerId)
	)
}
export function runningOrderBaselineAdLibItemStart (roId: string, slId: string, robaliId: string, queue: boolean) {
	check(roId, String)
	check(slId, String)
	check(robaliId, String)

	let runningOrder = RunningOrders.findOne(roId)
	if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)
	if (!runningOrder.active) return ClientAPI.responseError(`The RunningOrder isn't active, please activate it before starting an AdLib!`)
	if (runningOrder.holdState === RunningOrderHoldState.ACTIVE || runningOrder.holdState === RunningOrderHoldState.PENDING) {
		return ClientAPI.responseError(`Can't start AdLib item when the RunningOrder is in Hold mode!`)
	}
	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.runningOrderBaselineAdLibItemStart(roId, slId, robaliId, queue)
	)
}
export function segmentAdLibLineItemStop (roId: string, slId: string, sliId: string) {
	check(roId, String)
	check(slId, String)
	check(sliId, String)

	let runningOrder = RunningOrders.findOne(roId)
	if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)
	if (!runningOrder.active) return ClientAPI.responseError(`The RunningOrder isn't active, can't stop an AdLib in a deactivated RunningOrder!`)

	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.segmentAdLibLineItemStop(roId, slId, sliId)
	)
}
export function sourceLayerStickyItemStart (roId: string, sourceLayerId: string) {
	check(roId, String)
	check(sourceLayerId, String)

	const runningOrder = RunningOrders.findOne(roId)
	if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)
	if (!runningOrder.active) return ClientAPI.responseError(`The RunningOrder isn't active, please activate it before starting a sticky-item!`)
	if (!runningOrder.currentSegmentLineId) return ClientAPI.responseError(`No segmentLine is playing, please Take a segmentLine before starting a sticky.item.`)

	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.sourceLayerStickyItemStart(roId, sourceLayerId)
	)
}
export function activateHold (roId: string) {
	check(roId, String)

	let runningOrder = RunningOrders.findOne(roId)
	if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)

	if (!runningOrder.currentSegmentLineId) return ClientAPI.responseError(`No segmentLine is currently playing, please Take a segmentLine before activating Hold mode!`)
	if (!runningOrder.nextSegmentLineId) return ClientAPI.responseError(`No segmentLine is set as Next, please set a Next before activating Hold mode!`)

	let currentSegmentLine = SegmentLines.findOne({_id: runningOrder.currentSegmentLineId})
	if (!currentSegmentLine) throw new Meteor.Error(404, `Segment Line "${runningOrder.currentSegmentLineId}" not found!`)
	let nextSegmentLine = SegmentLines.findOne({_id: runningOrder.nextSegmentLineId})
	if (!nextSegmentLine) throw new Meteor.Error(404, `Segment Line "${runningOrder.nextSegmentLineId}" not found!`)
	if (runningOrder.holdState) {
		return ClientAPI.responseError(`RunningOrder is already doing a hold!`)
	}

	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.roActivateHold(roId)
	)
}
export function userSaveEvaluation (evaluation: EvaluationBase): ClientAPI.ClientResponse {
	return ClientAPI.responseSuccess(
		saveEvaluation.call(this, evaluation)
	)
}
export function userStoreRunningOrderSnapshot (runningOrderId: string, reason: string) {
	return ClientAPI.responseSuccess(
		storeRunningOrderSnapshot(runningOrderId, reason)
	)
}
export function removeRunningOrder (runningOrderId: string) {
	let runningOrder = RunningOrders.findOne(runningOrderId)
	if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${runningOrderId}" not found!`)
	if (runningOrder.active) return ClientAPI.responseError(`The RunningOrder is currently active, you can't remove an active RunningOrder!`)

	return ClientAPI.responseSuccess(
		ServerRunningOrderAPI.removeRunningOrder(runningOrderId)
	)
}
export function resyncRunningOrder (runningOrderId: string) {
	let runningOrder = RunningOrders.findOne(runningOrderId)
	if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${runningOrderId}" not found!`)
	// if (runningOrder.active) return ClientAPI.responseError(`The RunningOrder is currently active, you need to deactivate it before resyncing it.`)

	return ClientAPI.responseSuccess(
		ServerRunningOrderAPI.resyncRunningOrder(runningOrderId)
	)
}
export function recordStop (studioId: string) {
	check(studioId, String)
	const record = RecordedFiles.findOne({
		studioId: studioId,
		stoppedAt: {$exists: false}
	})
	if (!record) return ClientAPI.responseError(`No active recording for "${studioId}" was found!`)
	return ClientAPI.responseSuccess(
		ServerTestToolsAPI.recordStop(studioId)
	)
}

export function recordStart (studioId: string, fileName: string) {
	check(studioId, String)
	check(fileName, String)
	const studio = StudioInstallations.findOne(studioId)
	if (!studio) throw new Meteor.Error(404, `Studio "${studioId}" was not found!`)

	const active = RecordedFiles.findOne({
		studioId: studioId,
		stoppedAt: {$exists: false}
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

methods[UserActionAPI.methods.take] = function (roId: string): ClientAPI.ClientResponse {
	return take.call(this, roId)
}
methods[UserActionAPI.methods.setNext] = function (roId: string, slId: string): ClientAPI.ClientResponse {
	return setNext.call(this, roId, slId, true)
}
methods[UserActionAPI.methods.moveNext] = function (roId: string, horisontalDelta: number, verticalDelta: number): ClientAPI.ClientResponse {
	return moveNext.call(this, roId, horisontalDelta, verticalDelta, true)
}
methods[UserActionAPI.methods.prepareForBroadcast] = function (roId: string): ClientAPI.ClientResponse {
	return prepareForBroadcast.call(this, roId)
}
methods[UserActionAPI.methods.resetRunningOrder] = function (roId: string): ClientAPI.ClientResponse {
	return resetRunningOrder.call(this, roId)
}
methods[UserActionAPI.methods.resetAndActivate] = function (roId: string): ClientAPI.ClientResponse {
	return resetAndActivate.call(this, roId)
}
methods[UserActionAPI.methods.activate] = function (roId: string, rehearsal: boolean): ClientAPI.ClientResponse {
	return activate.call(this, roId, rehearsal)
}
methods[UserActionAPI.methods.deactivate] = function (roId: string): ClientAPI.ClientResponse {
	return deactivate.call(this, roId)
}
methods[UserActionAPI.methods.reloadData] = function (roId: string): ClientAPI.ClientResponse {
	return reloadData.call(this, roId)
}
methods[UserActionAPI.methods.disableNextSegmentLineItem] = function (roId: string, undo?: boolean): ClientAPI.ClientResponse {
	return disableNextSegmentLineItem.call(this, roId, undo)
}
methods[UserActionAPI.methods.toggleSegmentLineArgument] = function (roId: string, slId: string, property: string, value: string): ClientAPI.ClientResponse {
	return toggleSegmentLineArgument.call(this, roId, slId, property, value)
}
methods[UserActionAPI.methods.segmentLineItemTakeNow] = function (roId: string, slId: string, sliId: string): ClientAPI.ClientResponse {
	return segmentLineItemTakeNow.call(this, roId, slId, sliId)
}
methods[UserActionAPI.methods.setInOutPoints] = function (roId: string, slId: string, sliId: string, inPoint: number, outPoint: number): ClientAPI.ClientResponse {
	return segmentLineItemSetInOutPoints(roId, slId, sliId, inPoint, outPoint)
}
methods[UserActionAPI.methods.segmentAdLibLineItemStart] = function (roId: string, slId: string, salliId: string, queue: boolean) {
	return segmentAdLibLineItemStart.call(this, roId, slId, salliId, queue)
}
methods[UserActionAPI.methods.sourceLayerOnLineStop] = function (roId: string, slId: string, sourceLayerId: string) {
	return sourceLayerOnLineStop.call(this, roId, slId, sourceLayerId)
}
methods[UserActionAPI.methods.baselineAdLibItemStart] = function (roId: string, slId: string, robaliId: string, queue: boolean) {
	return runningOrderBaselineAdLibItemStart.call(this, roId, slId, robaliId, queue)
}
methods[UserActionAPI.methods.segmentAdLibLineItemStop] = function (roId: string, slId: string, sliId: string) {
	return segmentAdLibLineItemStop.call(this, roId, slId, sliId)
}
methods[UserActionAPI.methods.sourceLayerStickyItemStart] = function (roId: string, sourceLayerId: string) {
	return sourceLayerStickyItemStart.call(this, roId, sourceLayerId)
}
methods[UserActionAPI.methods.activateHold] = function (roId: string): ClientAPI.ClientResponse {
	return activateHold.call(this, roId)
}
methods[UserActionAPI.methods.saveEvaluation] = function (evaluation: EvaluationBase): ClientAPI.ClientResponse {
	return userSaveEvaluation.call(this, evaluation)
}
methods[UserActionAPI.methods.storeRunningOrderSnapshot] = function (runningOrderId: string, reason: string) {
	return userStoreRunningOrderSnapshot.call(this, runningOrderId, reason)
}
methods[UserActionAPI.methods.removeRunningOrder] = function (roId: string) {
	return removeRunningOrder.call(this, roId)
}
methods[UserActionAPI.methods.resyncRunningOrder] = function (roId: string) {
	return resyncRunningOrder.call(this, roId)
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
