import * as _ from 'underscore'
import { check } from 'meteor/check'
import { Meteor } from 'meteor/meteor'
import { ClientAPI } from '../../lib/api/client'
import {
	Rundown,
	Rundowns,
	RundownHoldState
} from '../../lib/collections/Rundowns'
import { getCurrentTime, getHash } from '../../lib/lib'
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
import { areThereActiveRundownPlaylistsInStudio } from './playout/studio'
import { IngestActions } from './ingest/actions'
import { RundownPlaylists } from '../../lib/collections/RundownPlaylists'
import { PartInstances } from '../../lib/collections/PartInstances'
import { PieceInstances, PieceInstance } from '../../lib/collections/PieceInstances'

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
export function take (rundownPlaylistId: string): ClientAPI.ClientResponse {
	// Called by the user. Wont throw as nasty errors

	let playlist = RundownPlaylists.findOne(rundownPlaylistId)
	if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found!`)
	if (!playlist.active) {
		return ClientAPI.responseError(`Rundown is not active, please activate the rundown before doing a TAKE.`)
	}
	if (!playlist.nextPartInstanceId) {
		return ClientAPI.responseError('No Next point found, please set a part as Next before doing a TAKE.')
	}
	if (playlist.currentPartInstanceId) {
		const currentPartInstance = PartInstances.findOne(playlist.currentPartInstanceId)
		if (currentPartInstance && currentPartInstance.part.timings) {
			const lastStartedPlayback = _.last(currentPartInstance.part.timings.startedPlayback || []) || 0
			const lastTake = _.last(currentPartInstance.part.timings.take || []) || 0
			const lastChange = Math.max(lastTake, lastStartedPlayback)
			if (getCurrentTime() - lastChange < MINIMUM_TAKE_SPAN) {
				logger.debug(`Time since last take is shorter than ${MINIMUM_TAKE_SPAN} for ${currentPartInstance._id}: ${getCurrentTime() - lastStartedPlayback}`)
				logger.debug(`lastStartedPlayback: ${lastStartedPlayback}, getCurrentTime(): ${getCurrentTime()}`)
				return ClientAPI.responseError(`Ignoring TAKES that are too quick after eachother (${MINIMUM_TAKE_SPAN} ms)`)
			}
		} else {
			// Don't throw an error here. It's bad, but it's more important to be able to continue with the take.
			logger.error(`PartInstance "${playlist.currentPartInstanceId}", set as currentPart in "${rundownPlaylistId}", not found!`)
		}
	}
	return ServerPlayoutAPI.takeNextPart(playlist._id)
}
export function setNext (rundownPlaylistId: string, nextPartId: string | null, setManually?: boolean, timeOffset?: number | undefined): ClientAPI.ClientResponse {
	check(rundownPlaylistId, String)
	if (nextPartId) check(nextPartId, String)

	const rundown = RundownPlaylists.findOne(rundownPlaylistId)
	if (!rundown) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found!`)
	if (!rundown.active) return ClientAPI.responseError('Rundown is not active, please activate it before setting a part as Next')

	let nextPart: Part | undefined
	if (nextPartId) {
		nextPart = Parts.findOne(nextPartId)
		if (!nextPart) throw new Meteor.Error(404, `Part "${nextPartId}" not found!`)

		if (!nextPart.isPlayable()) return ClientAPI.responseError('Part is unplayable, cannot set as next.')
	}

	if (rundown.holdState && rundown.holdState !== RundownHoldState.COMPLETE) {
		return ClientAPI.responseError('The Next cannot be changed next during a Hold!')
	}

	return ServerPlayoutAPI.setNextPart(rundownPlaylistId, nextPartId, setManually, timeOffset)
}
export function moveNext (
	rundownPlaylistId: string,
	horisontalDelta: number,
	verticalDelta: number,
	setManually: boolean
): ClientAPI.ClientResponse {
	const playlist = RundownPlaylists.findOne(rundownPlaylistId)
	if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found!`)
	if (!playlist.active) return ClientAPI.responseError('Rundown Playlist is not active, please activate it first')

	if (playlist.holdState && playlist.holdState !== RundownHoldState.COMPLETE) {
		return ClientAPI.responseError('The Next cannot be changed during a Hold!')
	}
	if (!playlist.nextPartInstanceId && !playlist.currentPartInstanceId) {
		return ClientAPI.responseError('RundownPlaylist has no next and no current part!')
	}

	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.moveNextPart(
			rundownPlaylistId,
			horisontalDelta,
			verticalDelta,
			setManually
		)
	)
}
export function prepareForBroadcast (rundownPlaylistId: string): ClientAPI.ClientResponse {
	check(rundownPlaylistId, String)
	let playlist = RundownPlaylists.findOne(rundownPlaylistId)
	if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found!`)
	if (playlist.active) return ClientAPI.responseError('Rundown Playlist is active, please deactivate before preparing it for broadcast')
	const anyOtherActiveRundowns = areThereActiveRundownPlaylistsInStudio(playlist.studioId, playlist._id)
	if (anyOtherActiveRundowns.length) {
		return ClientAPI.responseError(409, 'Only one rundown can be active at the same time. Currently active rundowns: ' + _.map(anyOtherActiveRundowns, p => p.name).join(', '), anyOtherActiveRundowns)
	}
	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.prepareRundownForBroadcast(rundownPlaylistId)
	)
}
export function resetRundown (rundownPlaylistId: string): ClientAPI.ClientResponse {
	check(rundownPlaylistId, String)
	let playlist = RundownPlaylists.findOne(rundownPlaylistId)
	if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found!`)
	if (playlist.active && !playlist.rehearsal) {
		return ClientAPI.responseError('Rundown is active but not in rehearsal, please deactivate it or set in in rehearsal to be able to reset it.')
	}

	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.resetRundown(rundownPlaylistId)
	)
}
export function resetAndActivate(rundownPlaylistId: string, rehearsal?: boolean): ClientAPI.ClientResponse {
	check(rundownPlaylistId, String)
	let playlist = RundownPlaylists.findOne(rundownPlaylistId)
	if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found!`)
	if (playlist.active && !playlist.rehearsal) {
		return ClientAPI.responseError('Rundown is active but not in rehearsal, please deactivate it or set in in rehearsal to be able to reset it.')
	}
	const anyOtherActiveRundowns = areThereActiveRundownPlaylistsInStudio(playlist.studioId, playlist._id)
	if (anyOtherActiveRundowns.length) {
		return ClientAPI.responseError(409, 'Only one rundown can be active at the same time. Currently active rundowns: ' + _.map(anyOtherActiveRundowns, p => p.name).join(', '), anyOtherActiveRundowns)
	}

	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.resetAndActivateRundown(rundownPlaylistId, rehearsal)
	)
}
export function forceResetAndActivate (rundownPlaylistId: string, rehearsal: boolean): ClientAPI.ClientResponse {
	// Reset and activates a rundown, automatically deactivates any other running rundowns

	check(rehearsal, Boolean)
	const playlist = RundownPlaylists.findOne(rundownPlaylistId)
	if (!playlist) throw new Meteor.Error(404, `RundownPlaylist "${rundownPlaylistId}" not found!`)

	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.forceResetAndActivateRundownPlaylist(rundownPlaylistId, rehearsal)
	)
}
export function activate (rundownPlaylistId: string, rehearsal: boolean): ClientAPI.ClientResponse {
	check(rundownPlaylistId, String)
	check(rehearsal, Boolean)
	let playlist = RundownPlaylists.findOne(rundownPlaylistId)
	if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found!`)
	const anyOtherActiveRundowns = areThereActiveRundownPlaylistsInStudio(playlist.studioId, playlist._id)
	if (anyOtherActiveRundowns.length) {
		return ClientAPI.responseError(409, 'Only one rundown can be active at the same time. Currently active rundowns: ' + _.map(anyOtherActiveRundowns, p => p.name).join(', '), anyOtherActiveRundowns)
	}
	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.activateRundown(rundownPlaylistId, rehearsal)
	)
}
export function deactivate (rundownPlaylistId: string): ClientAPI.ClientResponse {
	let rundown = RundownPlaylists.findOne(rundownPlaylistId)
	if (!rundown) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found!`)
	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.deactivateRundown(rundownPlaylistId)
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
export function togglePartArgument (rundownPlaylistId: string, partInstanceId: string, property: string, value: string) {
	const playlist = RundownPlaylists.findOne(rundownPlaylistId)
	if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found!`)
	if (playlist.holdState === RundownHoldState.ACTIVE || playlist.holdState === RundownHoldState.PENDING) {
		return ClientAPI.responseError(`Part-arguments can't be toggled while Rundown is in Hold mode!`)
	}
	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.rundownTogglePartArgument(rundownPlaylistId, partInstanceId, property, value)
	)
}
export function pieceTakeNow (rundownPlaylistId: string, partInstanceId: string, pieceInstanceIdOrPieceIdToCopy: string) {
	check(rundownPlaylistId, String)
	check(partInstanceId, String)
	check(pieceInstanceIdOrPieceIdToCopy, String)

	const playlist = RundownPlaylists.findOne(rundownPlaylistId)
	if (!playlist) throw new Meteor.Error(404, `Rundown "${rundownPlaylistId}" not found!`)
	if (!playlist.active) return ClientAPI.responseError(`The Rundown isn't active, please activate it before starting an AdLib!`)
	if (playlist.currentPartInstanceId !== partInstanceId) return ClientAPI.responseError(`Part AdLib-pieces can be only placed in a current part!`)

	const pieceInstanceToCopy = PieceInstances.findOne(pieceInstanceIdOrPieceIdToCopy)
	const pieceToCopy = pieceInstanceToCopy ? pieceInstanceToCopy.piece : Pieces.findOne(pieceInstanceIdOrPieceIdToCopy) as Piece
	if (!pieceToCopy) {
		throw new Meteor.Error(404, `PieceInstance or Piece "${pieceInstanceIdOrPieceIdToCopy}" not found!`)
	}

	const rundown = Rundowns.findOne(pieceToCopy.rundownId)
	if (!rundown) throw new Meteor.Error(404, `Rundown "${pieceToCopy.rundownId}" not found!`)

	const partInstance = PartInstances.findOne({
		_id: partInstanceId,
		rundownId: rundown._id
	})
	if (!partInstance) throw new Meteor.Error(404, `PartInstance "${partInstanceId}" not found!`)

	let showStyleBase = rundown.getShowStyleBase()
	const sourceL = showStyleBase.sourceLayers.find(i => i._id === pieceToCopy.sourceLayerId)
	if (sourceL && sourceL.type !== SourceLayerType.GRAPHICS) return ClientAPI.responseError(`PieceInstance or Piece "${pieceInstanceIdOrPieceIdToCopy}" is not a GRAPHICS piece!`)

	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.pieceTakeNow(rundownPlaylistId, partInstanceId, pieceInstanceIdOrPieceIdToCopy)
	)
}
export function pieceSetInOutPoints (rundownPlaylistId: string, partId: string, pieceId: string, inPoint: number, duration: number) {
	check(rundownPlaylistId, String)
	check(partId, String)
	check(pieceId, String)
	check(inPoint, Number)
	check(duration, Number)

	const playlist = RundownPlaylists.findOne(rundownPlaylistId)
	if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found!`)
	const part = Parts.findOne(partId)
	if (!part) throw new Meteor.Error(404, `Part "${partId}" not found!`)
	if (playlist && playlist.active && part.status === 'PLAY') {
		return ClientAPI.responseError(`Part cannot be active while setting in/out!`) // @todo: un-hardcode
	}
	const rundown = Rundowns.findOne(part.rundownId)
	if (!rundown) throw new Meteor.Error(501, `Rundown "${part.rundownId}" not found!`)

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
export function segmentAdLibPieceStart (rundownPlaylistId: string, partInstanceId: string, adlibPieceId: string, queue: boolean) {
	check(rundownPlaylistId, String)
	check(partInstanceId, String)
	check(adlibPieceId, String)

	let playlist = RundownPlaylists.findOne(rundownPlaylistId)
	if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found!`)
	if (!playlist.active) return ClientAPI.responseError(`The Rundown isn't active, please activate it before starting an AdLib!`)
	if (playlist.holdState === RundownHoldState.ACTIVE || playlist.holdState === RundownHoldState.PENDING) {
		return ClientAPI.responseError(`Can't start AdLibPiece when the Rundown is in Hold mode!`)
	}

	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.segmentAdLibPieceStart(rundownPlaylistId, partInstanceId, adlibPieceId, queue)
	)
}
export function sourceLayerOnPartStop (rundownPlaylistId: string, partInstanceId: string, sourceLayerId: string) {
	check(rundownPlaylistId, String)
	check(partInstanceId, String)
	check(sourceLayerId, String)

	let playlist = RundownPlaylists.findOne(rundownPlaylistId)
	if (!playlist) throw new Meteor.Error(404, `Rundown "${rundownPlaylistId}" not found!`)
	if (!playlist.active) return ClientAPI.responseError(`The Rundown isn't active, can't stop an AdLib on a deactivated Rundown!`)

	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.sourceLayerOnPartStop(rundownPlaylistId, partInstanceId, sourceLayerId)
	)
}
export function rundownBaselineAdLibPieceStart (rundownPlaylistId: string, partInstanceId: string, adlibPieceId: string, queue: boolean) {
	check(rundownPlaylistId, String)
	check(partInstanceId, String)
	check(adlibPieceId, String)

	let playlist = RundownPlaylists.findOne(rundownPlaylistId)
	if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found!`)
	if (!playlist.active) return ClientAPI.responseError(`The Rundown isn't active, please activate it before starting an AdLib!`)
	if (playlist.holdState === RundownHoldState.ACTIVE || playlist.holdState === RundownHoldState.PENDING) {
		return ClientAPI.responseError(`Can't start AdLib piece when the Rundown is in Hold mode!`)
	}
	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.rundownBaselineAdLibPieceStart(rundownPlaylistId, partInstanceId, adlibPieceId, queue)
	)
}
export function segmentAdLibPieceStop (rundownPlaylistId: string, partInstanceId: string, pieceInstanceId: string) {
	check(rundownPlaylistId, String)
	check(partInstanceId, String)
	check(pieceInstanceId, String)

	let playlist = RundownPlaylists.findOne(rundownPlaylistId)
	if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found!`)
	if (!playlist.active) return ClientAPI.responseError(`The Rundown isn't active, can't stop an AdLib in a deactivated Rundown!`)

	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.stopAdLibPiece(rundownPlaylistId, partInstanceId, pieceInstanceId)
	)
}
export function sourceLayerStickyPieceStart (rundownPlaylistId: string, sourceLayerId: string) {
	check(rundownPlaylistId, String)
	check(sourceLayerId, String)

	const playlist = RundownPlaylists.findOne(rundownPlaylistId)
	if (!playlist) throw new Meteor.Error(404, `Rundown "${rundownPlaylistId}" not found!`)
	if (!playlist.active) return ClientAPI.responseError(`The Rundown isn't active, please activate it before starting a sticky-item!`)
	if (!playlist.currentPartInstanceId) return ClientAPI.responseError(`No part is playing, please Take a part before starting a sticky-item.`)

	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.sourceLayerStickyPieceStart(rundownPlaylistId, sourceLayerId)
	)
}
export function activateHold (rundownPlaylistId: string, undo?: boolean) {
	check(rundownPlaylistId, String)

	let playlist = RundownPlaylists.findOne(rundownPlaylistId)
	if (!playlist) throw new Meteor.Error(404, `Rundown "${rundownPlaylistId}" not found!`)

	if (!playlist.currentPartInstanceId) return ClientAPI.responseError(`No part is currently playing, please Take a part before activating Hold mode!`)
	if (!playlist.nextPartInstanceId) return ClientAPI.responseError(`No part is set as Next, please set a Next before activating Hold mode!`)

	const { currentPartInstance, nextPartInstance } = playlist.getSelectedPartInstances()
	if (!currentPartInstance) throw new Meteor.Error(404, `PartInstance "${playlist.currentPartInstanceId}" not found!`)
	if (!nextPartInstance) throw new Meteor.Error(404, `PartInstance "${playlist.nextPartInstanceId}" not found!`)
	if (!undo && playlist.holdState) {
		return ClientAPI.responseError(`Rundown is already doing a hold!`)
	}
	if (undo && playlist.holdState !== RundownHoldState.PENDING) {
		return ClientAPI.responseError(`Can't undo hold from state: ${RundownHoldState[playlist.holdState || 0]}`)
	}

	if (undo) {
		return ClientAPI.responseSuccess(
			ServerPlayoutAPI.deactivateHold(rundownPlaylistId)
		)
	} else {
		return ClientAPI.responseSuccess(
			ServerPlayoutAPI.activateHold(rundownPlaylistId)
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
	let playlist = Rundowns.findOne(rundownId)
	if (!playlist) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)

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

	const rundown = RundownPlaylists.findOne(rundownId)
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found`)

	if (rundown.active) {
		return ClientAPI.responseError(`Rundown is active, please deactivate it before regenerating it.`)
	}

	return ClientAPI.responseSuccess(
		IngestActions.regenerateRundown(rundownId)
	)
}

let restartToken: string | undefined = undefined

export function generateRestartToken () {
	restartToken = getHash('restart_' + getCurrentTime())
	return ClientAPI.responseSuccess(
		restartToken
	)
}

export function restartCore (token: string) {
	check(token, String)

	if (token !== getHash(UserActionAPI.RESTART_SALT + restartToken))
		throw new Meteor.Error(401, `Restart token is invalid`)

	setTimeout(() => {
		process.exit(0)
	}, 3000)
	return ClientAPI.responseSuccess(`Restarting Core in 3s.`)
}

interface UserMethods {
	[method: string]: (...args: any[]) => ClientAPI.ClientResponse | Promise<ClientAPI.ClientResponse>
}
let methods: UserMethods = {}

methods[UserActionAPI.methods.take] = function (rundownPlaylistId: string): ClientAPI.ClientResponse {
	return take.call(this, rundownPlaylistId)
}
methods[UserActionAPI.methods.setNext] = function (rundownPlaylistId: string, partId: string, timeOffset?: number): ClientAPI.ClientResponse {
	return setNext.call(this, rundownPlaylistId, partId, true, timeOffset)
}
methods[UserActionAPI.methods.moveNext] = function (rundownPlaylistId: string, horisontalDelta: number, verticalDelta: number): ClientAPI.ClientResponse {
	return moveNext.call(this, rundownPlaylistId, horisontalDelta, verticalDelta, true)
}
methods[UserActionAPI.methods.prepareForBroadcast] = function (rundownPlaylistId: string): ClientAPI.ClientResponse {
	return prepareForBroadcast.call(this, rundownPlaylistId)
}
methods[UserActionAPI.methods.resetRundown] = function (rundownPlaylistId: string): ClientAPI.ClientResponse {
	return resetRundown.call(this, rundownPlaylistId)
}
methods[UserActionAPI.methods.resetAndActivate] = function (rundownPlaylistId: string, rehearsal?: boolean): ClientAPI.ClientResponse {
	return resetAndActivate.call(this, rundownPlaylistId, rehearsal)
}
methods[UserActionAPI.methods.activate] = function (rundownPlaylistId: string, rehearsal: boolean): ClientAPI.ClientResponse {
	return activate.call(this, rundownPlaylistId, rehearsal)
}
methods[UserActionAPI.methods.deactivate] = function (rundownPlaylistId: string): ClientAPI.ClientResponse {
	return deactivate.call(this, rundownPlaylistId)
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
methods[UserActionAPI.methods.togglePartArgument] = function (rundownPlaylistId: string, partInstanceId: string, property: string, value: string): ClientAPI.ClientResponse {
	return togglePartArgument.call(this, rundownPlaylistId, partInstanceId, property, value)
}
methods[UserActionAPI.methods.pieceTakeNow] = function (rundownPlaylistId: string, partInstanceId: string, pieceInstanceIdOrPieceIdToCopy: string): ClientAPI.ClientResponse {
	return pieceTakeNow.call(this, rundownPlaylistId, partInstanceId, pieceInstanceIdOrPieceIdToCopy)
}
methods[UserActionAPI.methods.setInOutPoints] = function (rundownPlaylistId: string, partId: string, pieceId: string, inPoint: number, duration: number): ClientAPI.ClientResponse {
	return pieceSetInOutPoints.call(this, rundownPlaylistId, partId, pieceId, inPoint, duration)
}
methods[UserActionAPI.methods.segmentAdLibPieceStart] = function (rundownPlaylistId: string, rundownId: string, partInstanceId: string, salliId: string, queue: boolean) {
	return segmentAdLibPieceStart.call(this, rundownPlaylistId, rundownId, partInstanceId, salliId, queue)
}
methods[UserActionAPI.methods.sourceLayerOnPartStop] = function (rundownPlaylistId: string, partInstanceId: string, sourceLayerId: string) {
	return sourceLayerOnPartStop.call(this, rundownPlaylistId, partInstanceId, sourceLayerId)
}
methods[UserActionAPI.methods.baselineAdLibPieceStart] = function (rundownPlaylistId: string, rundownId: string, partInstanceId: string, adlibPieceId: string, queue: boolean) {
	return rundownBaselineAdLibPieceStart.call(this, rundownPlaylistId, rundownId, partInstanceId, adlibPieceId, queue)
}
methods[UserActionAPI.methods.segmentAdLibPieceStop] = function (rundownPlaylistId: string, rundownId: string, partInstanceId: string, pieceInstanceId: string) {
	return segmentAdLibPieceStop.call(this, rundownPlaylistId, rundownId, partInstanceId, pieceInstanceId)
}
methods[UserActionAPI.methods.sourceLayerStickyPieceStart] = function (rundownPlaylistId: string, sourceLayerId: string) {
	return sourceLayerStickyPieceStart.call(this, rundownPlaylistId, sourceLayerId)
}
methods[UserActionAPI.methods.activateHold] = function (rundownPlaylistId: string, undo?: boolean): ClientAPI.ClientResponse {
	return activateHold.call(this, rundownPlaylistId, undo)
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
methods[UserActionAPI.methods.generateRestartToken] = function () {
	return generateRestartToken.call(this)
}
methods[UserActionAPI.methods.restartCore] = function (token: string) {
	return restartCore.call(this, token)
}

// Apply methods:
setMeteorMethods(methods)
