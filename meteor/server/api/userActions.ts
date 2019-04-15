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
	SegmentLines, SegmentLine
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
import { storeRundownSnapshot } from './snapshot'
import { setMeteorMethods } from '../methods'
import { ServerRundownAPI } from './rundown'
import { ServerTestToolsAPI, getStudioConfig } from './testTools'
import { RecordedFiles } from '../../lib/collections/RecordedFiles'
import { saveEvaluation } from './evaluations'
import { MediaManagerAPI } from './mediaManager'
import { RundownDataCache } from '../../lib/collections/RundownDataCache'
import { replaceStoryItem } from './integration/mos'

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
	if (!rundown.nextSegmentLineId) {
		return ClientAPI.responseError('No Next point found, please set a segmentLine as Next before doing a TAKE.')
	}
	if (rundown.currentSegmentLineId) {
		const currentSegmentLine = SegmentLines.findOne(rundown.currentSegmentLineId)
		if (currentSegmentLine && currentSegmentLine.timings) {
			const lastStartedPlayback = currentSegmentLine.timings.startedPlayback ? currentSegmentLine.timings.startedPlayback[currentSegmentLine.timings.startedPlayback.length - 1] : 0
			const lastTake = currentSegmentLine.timings.take ? currentSegmentLine.timings.take[currentSegmentLine.timings.take.length - 1] : 0
			const lastChange = Math.max(lastTake, lastStartedPlayback)
			if (getCurrentTime() - lastChange < MINIMUM_TAKE_SPAN) {
				logger.debug(`Time since last take is shorter than ${MINIMUM_TAKE_SPAN} for ${currentSegmentLine._id}: ${getCurrentTime() - lastStartedPlayback}`)
				logger.debug(`lastStartedPlayback: ${lastStartedPlayback}, getCurrentTime(): ${getCurrentTime()}`)
				return ClientAPI.responseError(`Ignoring TAKES that are too quick after eachother (${MINIMUM_TAKE_SPAN} ms)`)
			}
		} else {
			throw new Meteor.Error(404, `SegmentLine "${rundown.currentSegmentLineId}", set as currentSegmentLine in "${rundownId}", not found!`)
		}
	}
	return ServerPlayoutAPI.rundownTake(rundown)
}
export function setNext (rundownId: string, nextSlId: string | null, setManually?: boolean, timeOffset?: number | undefined): ClientAPI.ClientResponse {
	check(rundownId, String)
	if (nextSlId) check(nextSlId, String)

	const rundown = Rundowns.findOne(rundownId)
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
	if (!rundown.active) return ClientAPI.responseError('Rundown is not active, please activate it before setting a segmentLine as Next')

	let nextSegmentLine: SegmentLine | undefined
	if (nextSlId) {
		nextSegmentLine = SegmentLines.findOne(nextSlId)
		if (!nextSegmentLine) throw new Meteor.Error(404, `Segment Line "${nextSlId}" not found!`)

		if (nextSegmentLine.invalid) return ClientAPI.responseError('SegmentLine is marked as invalid, cannot set as next.')
	}

	if (rundown.holdState && rundown.holdState !== RundownHoldState.COMPLETE) {
		return ClientAPI.responseError('The Next cannot be changed next during a Hold!')
	}

	return ServerPlayoutAPI.rundownSetNext(rundownId, nextSlId, setManually, timeOffset)
}
export function moveNext (
	rundownId: string,
	horisontalDelta: number,
	verticalDelta: number,
	setManually: boolean,
	currentNextSegmentLineItemId?: string
): ClientAPI.ClientResponse {
	const rundown = Rundowns.findOne(rundownId)
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
	if (!rundown.active) return ClientAPI.responseError('Rundown is not active, please activate it first')

	if (rundown.holdState && rundown.holdState !== RundownHoldState.COMPLETE) {
		return ClientAPI.responseError('The Next cannot be changed next during a Hold!')
	}

	if (!currentNextSegmentLineItemId) {
		if (!rundown.nextSegmentLineId) {
			return ClientAPI.responseError('Rundown has no next segmentLine!')
		}
	}
	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.rundownMoveNext(
			rundownId,
			horisontalDelta,
			verticalDelta,
			setManually,
			currentNextSegmentLineItemId
		)
	)
}
export function prepareForBroadcast (rundownId: string): ClientAPI.ClientResponse {
	let rundown = Rundowns.findOne(rundownId)
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
	if (rundown.active) return ClientAPI.responseError('Rundown is active, please deactivate before preparing it for broadcast')
	const anyOtherActiveRundowns = ServerPlayoutAPI.areThereActiveROsInStudio(rundown.studioInstallationId, rundown._id)
	if (anyOtherActiveRundowns.length) {
		return ClientAPI.responseError('Only one rundown can be active at the same time. Currently active rundowns: ' + _.pluck(anyOtherActiveRundowns, 'name').join(', '))
	}
	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.rundownPrepareForBroadcast(rundownId)
	)
}
export function resetRundown (rundownId: string): ClientAPI.ClientResponse {
	let rundown = Rundowns.findOne(rundownId)
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
	if (rundown.active && !rundown.rehearsal) {
		return ClientAPI.responseError('Rundown is active but not in rehearsal, please deactivate it or set in in rehearsal to be able to reset it.')
	}

	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.rundownResetRundown(rundownId)
	)
}
export function resetAndActivate (rundownId: string): ClientAPI.ClientResponse {
	let rundown = Rundowns.findOne(rundownId)
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
	if (rundown.active && !rundown.rehearsal) {
		return ClientAPI.responseError('Rundown is active but not in rehearsal, please deactivate it or set in in rehearsal to be able to reset it.')
	}
	const anyOtherActiveRundowns = ServerPlayoutAPI.areThereActiveROsInStudio(rundown.studioInstallationId, rundown._id)
	if (anyOtherActiveRundowns.length) {
		return ClientAPI.responseError('Only one rundown can be active at the same time. Currently active rundowns: ' + _.pluck(anyOtherActiveRundowns, 'name').join(', '))
	}

	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.rundownResetAndActivate(rundownId)
	)
}
export function activate (rundownId: string, rehearsal: boolean): ClientAPI.ClientResponse {
	check(rehearsal, Boolean)
	let rundown = Rundowns.findOne(rundownId)
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
	const anyOtherActiveRundowns = ServerPlayoutAPI.areThereActiveROsInStudio(rundown.studioInstallationId, rundown._id)
	if (anyOtherActiveRundowns.length) {
		return ClientAPI.responseError('Only one rundown can be active at the same time. Currently active rundowns: ' + _.pluck(anyOtherActiveRundowns, 'name').join(', '))
	}
	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.rundownActivate(rundownId, rehearsal)
	)
}
export function deactivate (rundownId: string): ClientAPI.ClientResponse {
	let rundown = Rundowns.findOne(rundownId)
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.rundownDeactivate(rundownId)
	)

}
export function reloadData (rundownId: string) {
	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.reloadData(rundownId)
	)
}
export function disableNextSegmentLineItem (rundownId: string, undo?: boolean) {
	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.rundownDisableNextSegmentLineItem(rundownId, undo)
	)
}
export function toggleSegmentLineArgument (rundownId: string, slId: string, property: string, value: string) {
	const rundown = Rundowns.findOne(rundownId)
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
	if (rundown.holdState === RundownHoldState.ACTIVE || rundown.holdState === RundownHoldState.PENDING) {
		return ClientAPI.responseError(`SegmentLine-arguments can't be toggled while Rundown is in Hold mode!`)
	}
	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.rundownToggleSegmentLineArgument(rundownId, slId, property, value)
	)
}
export function segmentLineItemTakeNow (rundownId: string, slId: string, sliId: string) {
	check(rundownId, String)
	check(slId, String)
	check(sliId, String)

	let rundown = Rundowns.findOne(rundownId)
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
	if (!rundown.active) return ClientAPI.responseError(`The Rundown isn't active, please activate it before starting an AdLib!`)

	let slItem = SegmentLineItems.findOne({
		_id: sliId,
		rundownId: rundownId
	}) as SegmentLineItem
	if (!slItem) throw new Meteor.Error(404, `SegmentLineItem "${sliId}" not found!`)

	let segLine = SegmentLines.findOne({
		_id: slId,
		rundownId: rundownId
	})
	if (!segLine) throw new Meteor.Error(404, `SegmentLine "${slId}" not found!`)
	if (rundown.currentSegmentLineId !== segLine._id) return ClientAPI.responseError(`SegmentLine AdLib Items can be only placed in a current segment line!`)

	let showStyleBase = rundown.getShowStyleBase()
	const sourceL = showStyleBase.sourceLayers.find(i => i._id === slItem.sourceLayerId)
	if (sourceL && sourceL.type !== SourceLayerType.GRAPHICS) return ClientAPI.responseError(`SegmentLine "${slId}" is not a GRAPHICS item!`)

	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.segmentLineItemTakeNow(rundownId, slId, sliId)
	)
}
export function segmentLineItemSetInOutPoints (rundownId: string, slId: string, sliId: string, inPoint: number, duration: number) {
	check(rundownId, String)
	check(slId, String)
	check(sliId, String)
	check(inPoint, Number)
	check(duration, Number)

	const rundown = Rundowns.findOne(rundownId)
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
	const sl = SegmentLines.findOne(slId)
	if (!sl) throw new Meteor.Error(404, `SegmentLine "${slId}" not found!`)
	if (rundown && rundown.active && sl.status === 'PLAY') {
		return ClientAPI.responseError(`SegmentLine cannot be active while setting in/out!`) // @todo: un-hardcode
	}
	const slCache = RundownDataCache.findOne(rundownId + '_fullStory' + slId)
	if (!slCache) throw new Meteor.Error(404, `SegmentLine Cache for "${slId}" not found!`)
	const sli = SegmentLineItems.findOne(sliId)
	if (!sli) throw new Meteor.Error(404, `SegmentLineItem "${sliId}" not found!`)

	return ClientAPI.responseSuccess(
		replaceStoryItem(rundown, sli, slCache, inPoint / 1000, duration / 1000) // MOS data is in seconds
	)

}
export function segmentAdLibLineItemStart (rundownId: string, slId: string, slaiId: string, queue: boolean) {
	check(rundownId, String)
	check(slId, String)
	check(slaiId, String)

	let rundown = Rundowns.findOne(rundownId)
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
	if (!rundown.active) return ClientAPI.responseError(`The Rundown isn't active, please activate it before starting an AdLib!`)
	if (rundown.holdState === RundownHoldState.ACTIVE || rundown.holdState === RundownHoldState.PENDING) {
		return ClientAPI.responseError(`Can't start AdLib item when the Rundown is in Hold mode!`)
	}

	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.segmentAdLibLineItemStart(rundownId, slId, slaiId, queue)
	)
}
export function sourceLayerOnLineStop (rundownId: string, slId: string, sourceLayerId: string) {
	check(rundownId, String)
	check(slId, String)
	check(sourceLayerId, String)

	let rundown = Rundowns.findOne(rundownId)
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
	if (!rundown.active) return ClientAPI.responseError(`The Rundown isn't active, can't stop an AdLib on a deactivated Rundown!`)

	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.sourceLayerOnLineStop(rundownId, slId, sourceLayerId)
	)
}
export function rundownBaselineAdLibItemStart (rundownId: string, slId: string, robaliId: string, queue: boolean) {
	check(rundownId, String)
	check(slId, String)
	check(robaliId, String)

	let rundown = Rundowns.findOne(rundownId)
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
	if (!rundown.active) return ClientAPI.responseError(`The Rundown isn't active, please activate it before starting an AdLib!`)
	if (rundown.holdState === RundownHoldState.ACTIVE || rundown.holdState === RundownHoldState.PENDING) {
		return ClientAPI.responseError(`Can't start AdLib item when the Rundown is in Hold mode!`)
	}
	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.rundownBaselineAdLibItemStart(rundownId, slId, robaliId, queue)
	)
}
export function segmentAdLibLineItemStop (rundownId: string, slId: string, sliId: string) {
	check(rundownId, String)
	check(slId, String)
	check(sliId, String)

	let rundown = Rundowns.findOne(rundownId)
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
	if (!rundown.active) return ClientAPI.responseError(`The Rundown isn't active, can't stop an AdLib in a deactivated Rundown!`)

	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.segmentAdLibLineItemStop(rundownId, slId, sliId)
	)
}
export function sourceLayerStickyItemStart (rundownId: string, sourceLayerId: string) {
	check(rundownId, String)
	check(sourceLayerId, String)

	const rundown = Rundowns.findOne(rundownId)
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
	if (!rundown.active) return ClientAPI.responseError(`The Rundown isn't active, please activate it before starting a sticky-item!`)
	if (!rundown.currentSegmentLineId) return ClientAPI.responseError(`No segmentLine is playing, please Take a segmentLine before starting a sticky.item.`)

	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.sourceLayerStickyItemStart(rundownId, sourceLayerId)
	)
}
export function activateHold (rundownId: string) {
	check(rundownId, String)

	let rundown = Rundowns.findOne(rundownId)
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)

	if (!rundown.currentSegmentLineId) return ClientAPI.responseError(`No segmentLine is currently playing, please Take a segmentLine before activating Hold mode!`)
	if (!rundown.nextSegmentLineId) return ClientAPI.responseError(`No segmentLine is set as Next, please set a Next before activating Hold mode!`)

	let currentSegmentLine = SegmentLines.findOne({_id: rundown.currentSegmentLineId})
	if (!currentSegmentLine) throw new Meteor.Error(404, `Segment Line "${rundown.currentSegmentLineId}" not found!`)
	let nextSegmentLine = SegmentLines.findOne({_id: rundown.nextSegmentLineId})
	if (!nextSegmentLine) throw new Meteor.Error(404, `Segment Line "${rundown.nextSegmentLineId}" not found!`)
	if (rundown.holdState) {
		return ClientAPI.responseError(`Rundown is already doing a hold!`)
	}

	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.rundownActivateHold(rundownId)
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

methods[UserActionAPI.methods.take] = function (rundownId: string): ClientAPI.ClientResponse {
	return take.call(this, rundownId)
}
methods[UserActionAPI.methods.setNext] = function (rundownId: string, slId: string, timeOffset?: number): ClientAPI.ClientResponse {
	return setNext.call(this, rundownId, slId, true, timeOffset)
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
methods[UserActionAPI.methods.disableNextSegmentLineItem] = function (rundownId: string, undo?: boolean): ClientAPI.ClientResponse {
	return disableNextSegmentLineItem.call(this, rundownId, undo)
}
methods[UserActionAPI.methods.toggleSegmentLineArgument] = function (rundownId: string, slId: string, property: string, value: string): ClientAPI.ClientResponse {
	return toggleSegmentLineArgument.call(this, rundownId, slId, property, value)
}
methods[UserActionAPI.methods.segmentLineItemTakeNow] = function (rundownId: string, slId: string, sliId: string): ClientAPI.ClientResponse {
	return segmentLineItemTakeNow.call(this, rundownId, slId, sliId)
}
methods[UserActionAPI.methods.setInOutPoints] = function (rundownId: string, slId: string, sliId: string, inPoint: number, duration: number): ClientAPI.ClientResponse {
	return segmentLineItemSetInOutPoints(rundownId, slId, sliId, inPoint, duration)
}
methods[UserActionAPI.methods.segmentAdLibLineItemStart] = function (rundownId: string, slId: string, salliId: string, queue: boolean) {
	return segmentAdLibLineItemStart.call(this, rundownId, slId, salliId, queue)
}
methods[UserActionAPI.methods.sourceLayerOnLineStop] = function (rundownId: string, slId: string, sourceLayerId: string) {
	return sourceLayerOnLineStop.call(this, rundownId, slId, sourceLayerId)
}
methods[UserActionAPI.methods.baselineAdLibItemStart] = function (rundownId: string, slId: string, robaliId: string, queue: boolean) {
	return rundownBaselineAdLibItemStart.call(this, rundownId, slId, robaliId, queue)
}
methods[UserActionAPI.methods.segmentAdLibLineItemStop] = function (rundownId: string, slId: string, sliId: string) {
	return segmentAdLibLineItemStop.call(this, rundownId, slId, sliId)
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
