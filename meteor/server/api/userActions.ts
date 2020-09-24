import * as _ from 'underscore'
import { check, Match } from '../../lib/check'
import { Meteor } from 'meteor/meteor'
import { ClientAPI } from '../../lib/api/client'
import { getCurrentTime, getHash, Omit, makePromise } from '../../lib/lib'
import { Rundowns, RundownHoldState, RundownId, Rundown } from '../../lib/collections/Rundowns'
import { Parts, Part, PartId } from '../../lib/collections/Parts'
import { logger } from '../logging'
import { ServerPlayoutAPI } from './playout/playout'
import { NewUserActionAPI, RESTART_SALT, UserActionAPIMethods } from '../../lib/api/userActions'
import { EvaluationBase } from '../../lib/collections/Evaluations'
import { Studios, StudioId } from '../../lib/collections/Studios'
import { Pieces, PieceId } from '../../lib/collections/Pieces'
import { SourceLayerType, IngestPart, IngestAdlib, ActionUserData } from 'tv-automation-sofie-blueprints-integration'
import { storeRundownPlaylistSnapshot } from './snapshot'
import { registerClassToMeteorMethods } from '../methods'
import { ServerRundownAPI } from './rundown'
import { saveEvaluation } from './evaluations'
import { MediaManagerAPI } from './mediaManager'
import { IngestDataCache, IngestCacheType } from '../../lib/collections/IngestDataCache'
import { MOSDeviceActions } from './ingest/mosDevice/actions'
import { getActiveRundownPlaylistsInStudio } from './playout/studio'
import { IngestActions } from './ingest/actions'
import { RundownPlaylists, RundownPlaylistId, RundownPlaylist } from '../../lib/collections/RundownPlaylists'
import { PartInstances, PartInstanceId } from '../../lib/collections/PartInstances'
import {
	PieceInstances,
	PieceInstanceId,
	PieceInstancePiece,
	omitPiecePropertiesForInstance,
} from '../../lib/collections/PieceInstances'
import { MediaWorkFlowId } from '../../lib/collections/MediaWorkFlows'
import { MethodContext, MethodContextAPI } from '../../lib/api/methods'
import { ServerClientAPI } from './client'
import { SegmentId, Segment, Segments } from '../../lib/collections/Segments'
import { UserId } from '../../lib/typings/meteor'
import { resolveCredentials } from '../security/lib/credentials'
import { OrganizationId } from '../../lib/collections/Organization'
import { Settings } from '../../lib/Settings'
import { OrganizationContentWriteAccess } from '../security/organization'
import { PeripheralDeviceContentWriteAccess } from '../security/peripheralDevice'
import { RundownPlaylistContentWriteAccess } from '../security/rundownPlaylist'
import { StudioContentWriteAccess } from '../security/studio'
import { SystemWriteAccess } from '../security/system'
import { triggerWriteAccessBecauseNoCheckNecessary } from '../security/lib/securityVerify'
import { syncFunction } from '../codeControl'
import { getShowStyleCompound, ShowStyleVariantId } from '../../lib/collections/ShowStyleVariants'
import { BucketId, Buckets, Bucket } from '../../lib/collections/Buckets'
import { updateBucketAdlibFromIngestData } from './ingest/bucketAdlibs'
import { ServerPlayoutAdLibAPI } from './playout/adlib'
import { BucketsAPI } from './buckets'
import { BucketAdLib } from '../../lib/collections/BucketAdlibs'
import { rundownContentAllowWrite } from '../security/rundown'
import { profiler } from './profiler'

let MINIMUM_TAKE_SPAN = 1000
export function setMinimumTakeSpan(span: number) {
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

function checkAccessAndGetPlaylist(context: MethodContext, playlistId: RundownPlaylistId): RundownPlaylist {
	const access = RundownPlaylistContentWriteAccess.playout(context, playlistId)
	const playlist = access.playlist
	if (!playlist) throw new Meteor.Error(404, `RundownPlaylist "${playlistId}" not found!`)
	return playlist
}
function checkAccessAndGetRundown(context: MethodContext, rundownId: RundownId): Rundown {
	const access = RundownPlaylistContentWriteAccess.rundown(context, rundownId)
	const rundown = access.rundown
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
	return rundown
}

// TODO - these use the rundownSyncFunction earlier, to ensure there arent differences when we get to the syncFunction?
export const take = syncFunction(function take(
	context: MethodContext,
	rundownPlaylistId: RundownPlaylistId
): ClientAPI.ClientResponse<void> {
	// Called by the user. Wont throw as nasty errors
	const now = getCurrentTime()

	let playlist = checkAccessAndGetPlaylist(context, rundownPlaylistId)

	if (!playlist.active) {
		return ClientAPI.responseError(`Rundown is not active, please activate the rundown before doing a TAKE.`)
	}
	if (!playlist.nextPartInstanceId) {
		return ClientAPI.responseError('No Next point found, please set a part as Next before doing a TAKE.')
	}
	if (playlist.currentPartInstanceId) {
		const currentPartInstance = PartInstances.findOne(playlist.currentPartInstanceId)
		if (currentPartInstance && currentPartInstance.timings) {
			const lastStartedPlayback = currentPartInstance.timings.startedPlayback || 0
			const lastTake = currentPartInstance.timings.take || 0
			const lastChange = Math.max(lastTake, lastStartedPlayback)
			if (now - lastChange < MINIMUM_TAKE_SPAN) {
				logger.debug(
					`Time since last take is shorter than ${MINIMUM_TAKE_SPAN} for ${
						currentPartInstance._id
					}: ${getCurrentTime() - lastStartedPlayback}`
				)
				logger.debug(`lastStartedPlayback: ${lastStartedPlayback}, getCurrentTime(): ${getCurrentTime()}`)
				return ClientAPI.responseError(
					`Ignoring TAKES that are too quick after eachother (${MINIMUM_TAKE_SPAN} ms)`
				)
			}
		} else {
			// Don't throw an error here. It's bad, but it's more important to be able to continue with the take.
			logger.error(
				`PartInstance "${playlist.currentPartInstanceId}", set as currentPart in "${rundownPlaylistId}", not found!`
			)
		}
	}
	return ServerPlayoutAPI.takeNextPart(context, playlist._id)
},
'userActionsTake$0')

export function setNext(
	context: MethodContext,
	rundownPlaylistId: RundownPlaylistId,
	nextPartId: PartId | null,
	setManually?: boolean,
	timeOffset?: number | undefined
): ClientAPI.ClientResponse<void> {
	check(rundownPlaylistId, String)
	if (nextPartId) check(nextPartId, String)

	let playlist = checkAccessAndGetPlaylist(context, rundownPlaylistId)
	if (!playlist.active)
		return ClientAPI.responseError(
			'RundownPlaylist is not active, please activate it before setting a part as Next'
		)

	let nextPart: Part | undefined
	if (nextPartId) {
		nextPart = Parts.findOne(nextPartId)
		if (!nextPart) throw new Meteor.Error(404, `Part "${nextPartId}" not found!`)

		if (!nextPart.isPlayable()) return ClientAPI.responseError('Part is unplayable, cannot set as next.')
	}

	if (playlist.holdState && playlist.holdState !== RundownHoldState.COMPLETE) {
		return ClientAPI.responseError('The Next cannot be changed next during a Hold!')
	}
	return ServerPlayoutAPI.setNextPart(context, rundownPlaylistId, nextPartId, setManually, timeOffset)
}
export function setNextSegment(
	context: MethodContext,
	rundownPlaylistId: RundownPlaylistId,
	nextSegmentId: SegmentId | null
): ClientAPI.ClientResponse<void> {
	check(rundownPlaylistId, String)
	if (nextSegmentId) check(nextSegmentId, String)
	else check(nextSegmentId, null)

	let playlist = checkAccessAndGetPlaylist(context, rundownPlaylistId)
	if (!playlist.active)
		return ClientAPI.responseError('Rundown is not active, please activate it before setting a part as Next')

	let nextSegment: Segment | null = null

	if (nextSegmentId) {
		nextSegment = Segments.findOne(nextSegmentId) || null
		if (!nextSegment) throw new Meteor.Error(404, `Segment "${nextSegmentId}" not found!`)

		const rundownIds = playlist.getRundownIDs()
		if (rundownIds.indexOf(nextSegment.rundownId) === -1) {
			throw new Meteor.Error(
				404,
				`Segment "${nextSegmentId}" does not belong to Rundown Playlist "${rundownPlaylistId}"!`
			)
		}

		const partsInSegment = nextSegment.getParts()
		const firstValidPartInSegment = _.find(
			partsInSegment,
			(p) => p.isPlayable() && !p.dynamicallyInsertedAfterPartId
		)

		if (!firstValidPartInSegment) return ClientAPI.responseError('Segment contains no valid parts')

		const { currentPartInstance, nextPartInstance } = playlist.getSelectedPartInstances()
		if (!currentPartInstance || !nextPartInstance || nextPartInstance.segmentId !== currentPartInstance.segmentId) {
			// Special: in this case, the user probably dosen't want to setNextSegment, but rather just setNextPart
			return ServerPlayoutAPI.setNextPart(context, rundownPlaylistId, firstValidPartInSegment._id, true, 0)
		}
	}

	return ServerPlayoutAPI.setNextSegment(context, rundownPlaylistId, nextSegmentId)
}
export function moveNext(
	context: MethodContext,
	rundownPlaylistId: RundownPlaylistId,
	horisontalDelta: number,
	verticalDelta: number,
	setManually: boolean
): ClientAPI.ClientResponse<PartId | null> {
	let playlist = checkAccessAndGetPlaylist(context, rundownPlaylistId)
	if (!playlist.active) return ClientAPI.responseError('Rundown Playlist is not active, please activate it first')

	if (playlist.holdState && playlist.holdState !== RundownHoldState.COMPLETE) {
		return ClientAPI.responseError('The Next cannot be changed during a Hold!')
	}
	if (!playlist.nextPartInstanceId && !playlist.currentPartInstanceId) {
		return ClientAPI.responseError('RundownPlaylist has no next and no current part!')
	}

	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.moveNextPart(context, rundownPlaylistId, horisontalDelta, verticalDelta, setManually)
	)
}
export function prepareForBroadcast(
	context: MethodContext,
	rundownPlaylistId: RundownPlaylistId
): ClientAPI.ClientResponse<void> {
	check(rundownPlaylistId, String)
	let playlist = checkAccessAndGetPlaylist(context, rundownPlaylistId)

	if (playlist.active)
		return ClientAPI.responseError(
			'Rundown Playlist is active, please deactivate before preparing it for broadcast'
		)
	const anyOtherActiveRundowns = getActiveRundownPlaylistsInStudio(null, playlist.studioId, playlist._id)
	if (anyOtherActiveRundowns.length) {
		return ClientAPI.responseError(
			409,
			'Only one rundown can be active at the same time. Currently active rundowns: ' +
				_.map(anyOtherActiveRundowns, (p) => p.name).join(', '),
			anyOtherActiveRundowns
		)
	}
	return ClientAPI.responseSuccess(ServerPlayoutAPI.prepareRundownPlaylistForBroadcast(context, rundownPlaylistId))
}
export function resetRundownPlaylist(
	context: MethodContext,
	rundownPlaylistId: RundownPlaylistId
): ClientAPI.ClientResponse<void> {
	check(rundownPlaylistId, String)
	let playlist = checkAccessAndGetPlaylist(context, rundownPlaylistId)
	if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found!`)
	if (playlist.active && !playlist.rehearsal && !Settings.allowRundownResetOnAir) {
		return ClientAPI.responseError(
			'RundownPlaylist is active but not in rehearsal, please deactivate it or set in in rehearsal to be able to reset it.'
		)
	}

	return ClientAPI.responseSuccess(ServerPlayoutAPI.resetRundownPlaylist(context, rundownPlaylistId))
}
export function resetAndActivate(
	context: MethodContext,
	rundownPlaylistId: RundownPlaylistId,
	rehearsal?: boolean
): ClientAPI.ClientResponse<void> {
	check(rundownPlaylistId, String)
	let playlist = checkAccessAndGetPlaylist(context, rundownPlaylistId)
	if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found!`)
	if (playlist.active && !playlist.rehearsal && !Settings.allowRundownResetOnAir) {
		return ClientAPI.responseError(
			'RundownPlaylist is active but not in rehearsal, please deactivate it or set in in rehearsal to be able to reset it.'
		)
	}
	const anyOtherActiveRundownPlaylists = getActiveRundownPlaylistsInStudio(null, playlist.studioId, playlist._id)
	if (anyOtherActiveRundownPlaylists.length) {
		return ClientAPI.responseError(
			409,
			'Only one rundownPlaylist can be active at the same time. Currently active rundownPlaylists: ' +
				_.map(anyOtherActiveRundownPlaylists, (p) => p.name).join(', '),
			anyOtherActiveRundownPlaylists
		)
	}

	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.resetAndActivateRundownPlaylist(context, rundownPlaylistId, rehearsal)
	)
}
export function forceResetAndActivate(
	context: MethodContext,
	rundownPlaylistId: RundownPlaylistId,
	rehearsal: boolean
): ClientAPI.ClientResponse<void> {
	// Reset and activates a rundown, automatically deactivates any other running rundowns

	check(rehearsal, Boolean)
	checkAccessAndGetPlaylist(context, rundownPlaylistId)

	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.forceResetAndActivateRundownPlaylist(context, rundownPlaylistId, rehearsal)
	)
}
export function activate(
	context: MethodContext,
	rundownPlaylistId: RundownPlaylistId,
	rehearsal: boolean
): ClientAPI.ClientResponse<void> {
	check(rundownPlaylistId, String)
	check(rehearsal, Boolean)

	let playlist = checkAccessAndGetPlaylist(context, rundownPlaylistId)
	const anyOtherActiveRundowns = getActiveRundownPlaylistsInStudio(null, playlist.studioId, playlist._id)

	if (anyOtherActiveRundowns.length) {
		return ClientAPI.responseError(
			409,
			'Only one rundown can be active at the same time. Currently active rundowns: ' +
				_.map(anyOtherActiveRundowns, (p) => p.name).join(', '),
			anyOtherActiveRundowns
		)
	}
	return ClientAPI.responseSuccess(ServerPlayoutAPI.activateRundownPlaylist(context, playlist._id, rehearsal))
}
export function deactivate(
	context: MethodContext,
	rundownPlaylistId: RundownPlaylistId
): ClientAPI.ClientResponse<void> {
	return ClientAPI.responseSuccess(ServerPlayoutAPI.deactivateRundownPlaylist(context, rundownPlaylistId))
}
export function reloadRundownPlaylistData(context: MethodContext, rundownPlaylistId: RundownPlaylistId) {
	return ClientAPI.responseSuccess(ServerPlayoutAPI.reloadRundownPlaylistData(context, rundownPlaylistId))
}
export function unsyncRundown(context: MethodContext, rundownId: RundownId) {
	return ClientAPI.responseSuccess(ServerRundownAPI.unsyncRundown(context, rundownId))
}
export function disableNextPiece(context: MethodContext, rundownPlaylistId: RundownPlaylistId, undo?: boolean) {
	return ClientAPI.responseSuccess(ServerPlayoutAPI.disableNextPiece(context, rundownPlaylistId, undo))
}
export function pieceTakeNow(
	context: MethodContext,
	rundownPlaylistId: RundownPlaylistId,
	partInstanceId: PartInstanceId,
	pieceInstanceIdOrPieceIdToCopy: PieceInstanceId | PieceId
) {
	check(rundownPlaylistId, String)
	check(partInstanceId, String)
	check(pieceInstanceIdOrPieceIdToCopy, String)

	let playlist = checkAccessAndGetPlaylist(context, rundownPlaylistId)
	if (!playlist.active)
		return ClientAPI.responseError(`The Rundown isn't active, please activate it before starting an AdLib!`)
	if (playlist.currentPartInstanceId !== partInstanceId)
		return ClientAPI.responseError(`Part AdLib-pieces can be only placed in a current part!`)

	let pieceToCopy: PieceInstancePiece | undefined
	let rundownId: RundownId | undefined
	const pieceInstanceToCopy = PieceInstances.findOne(pieceInstanceIdOrPieceIdToCopy)
	if (pieceInstanceToCopy) {
		pieceToCopy = pieceInstanceToCopy.piece
		rundownId = pieceInstanceToCopy.rundownId
	} else {
		const piece = Pieces.findOne(pieceInstanceIdOrPieceIdToCopy)
		if (piece) {
			pieceToCopy = omitPiecePropertiesForInstance(piece)
			rundownId = piece.startRundownId
		}
	}
	if (!pieceToCopy || !rundownId) {
		throw new Meteor.Error(404, `PieceInstance or Piece "${pieceInstanceIdOrPieceIdToCopy}" not found!`)
	}

	const rundown = Rundowns.findOne(rundownId)
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)

	const partInstance = PartInstances.findOne({
		_id: partInstanceId,
		rundownId: rundown._id,
	})
	if (!partInstance) throw new Meteor.Error(404, `PartInstance "${partInstanceId}" not found!`)

	let showStyleBase = rundown.getShowStyleBase()
	const sourceLayerId = pieceToCopy.sourceLayerId
	const sourceL = showStyleBase.sourceLayers.find((i) => i._id === sourceLayerId)
	if (sourceL && sourceL.type !== SourceLayerType.GRAPHICS)
		return ClientAPI.responseError(
			`PieceInstance or Piece "${pieceInstanceIdOrPieceIdToCopy}" is not a GRAPHICS piece!`
		)

	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.pieceTakeNow(context, rundownPlaylistId, partInstanceId, pieceInstanceIdOrPieceIdToCopy)
	)
}
export function pieceSetInOutPoints(
	context: MethodContext,
	rundownPlaylistId: RundownPlaylistId,
	partId: PartId,
	pieceId: PieceId,
	inPoint: number,
	duration: number
) {
	check(rundownPlaylistId, String)
	check(partId, String)
	check(pieceId, String)
	check(inPoint, Number)
	check(duration, Number)

	let playlist = checkAccessAndGetPlaylist(context, rundownPlaylistId)
	const part = Parts.findOne(partId)
	if (!part) throw new Meteor.Error(404, `Part "${partId}" not found!`)
	if (playlist && playlist.active && part.status === 'PLAY') {
		throw new Meteor.Error(`Part cannot be active while setting in/out!`) // @todo: un-hardcode
	}
	const rundown = Rundowns.findOne(part.rundownId)
	if (!rundown) throw new Meteor.Error(501, `Rundown "${part.rundownId}" not found!`)

	const partCache = IngestDataCache.findOne({
		rundownId: rundown._id,
		partId: part._id,
		type: IngestCacheType.PART,
	})
	if (!partCache) throw new Meteor.Error(404, `Part Cache for "${partId}" not found!`)
	const piece = Pieces.findOne(pieceId)
	if (!piece) throw new Meteor.Error(404, `Piece "${pieceId}" not found!`)

	// TODO: replace this with a general, non-MOS specific method
	return MOSDeviceActions.setPieceInOutPoint(
		rundown,
		piece,
		partCache.data as IngestPart,
		inPoint / 1000,
		duration / 1000
	) // MOS data is in seconds
		.then(() => ClientAPI.responseSuccess(undefined))
		.catch((error) => ClientAPI.responseError(error))
}
export function executeAction(
	context: MethodContext,
	rundownPlaylistId: RundownPlaylistId,
	actionId: string,
	userData: any
) {
	check(rundownPlaylistId, String)
	check(actionId, String)
	check(userData, Match.Any)

	const playlist = checkAccessAndGetPlaylist(context, rundownPlaylistId)
	if (!playlist) throw new Meteor.Error(404, `RundownPlaylist "${rundownPlaylistId}" not found!`)
	if (!playlist.active)
		return ClientAPI.responseError(`The Rundown isn't active, please activate it before executing an action!`)
	if (!playlist.currentPartInstanceId)
		return ClientAPI.responseError(`No part is playing, please Take a part before executing an action.`)

	return ClientAPI.responseSuccess(ServerPlayoutAPI.executeAction(context, rundownPlaylistId, actionId, userData))
}
export function segmentAdLibPieceStart(
	context: MethodContext,
	rundownPlaylistId: RundownPlaylistId,
	partInstanceId: PartInstanceId,
	adlibPieceId: PieceId,
	queue: boolean
) {
	check(rundownPlaylistId, String)
	check(partInstanceId, String)
	check(adlibPieceId, String)

	let playlist = checkAccessAndGetPlaylist(context, rundownPlaylistId)

	if (!playlist.active)
		return ClientAPI.responseError(`The Rundown isn't active, please activate it before starting an AdLib!`)
	if (playlist.holdState === RundownHoldState.ACTIVE || playlist.holdState === RundownHoldState.PENDING) {
		return ClientAPI.responseError(`Can't start AdLibPiece when the Rundown is in Hold mode!`)
	}

	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.segmentAdLibPieceStart(context, rundownPlaylistId, partInstanceId, adlibPieceId, queue)
	)
}
export function sourceLayerOnPartStop(
	context: MethodContext,
	rundownPlaylistId: RundownPlaylistId,
	partInstanceId: PartInstanceId,
	sourceLayerIds: string[]
) {
	check(rundownPlaylistId, String)
	check(partInstanceId, String)
	check(sourceLayerIds, Match.OneOf(String, Array))

	let playlist = checkAccessAndGetPlaylist(context, rundownPlaylistId)
	if (!playlist.active)
		return ClientAPI.responseError(`The Rundown isn't active, can't stop an AdLib on a deactivated Rundown!`)

	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.sourceLayerOnPartStop(context, rundownPlaylistId, partInstanceId, sourceLayerIds)
	)
}
export function rundownBaselineAdLibPieceStart(
	context: MethodContext,
	rundownPlaylistId: RundownPlaylistId,
	partInstanceId: PartInstanceId,
	adlibPieceId: PieceId,
	queue: boolean
) {
	check(rundownPlaylistId, String)
	check(partInstanceId, String)
	check(adlibPieceId, String)

	let playlist = checkAccessAndGetPlaylist(context, rundownPlaylistId)

	if (!playlist.active)
		return ClientAPI.responseError(`The Rundown isn't active, please activate it before starting an AdLib!`)
	if (playlist.holdState === RundownHoldState.ACTIVE || playlist.holdState === RundownHoldState.PENDING) {
		return ClientAPI.responseError(`Can't start AdLib piece when the Rundown is in Hold mode!`)
	}
	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.rundownBaselineAdLibPieceStart(context, rundownPlaylistId, partInstanceId, adlibPieceId, queue)
	)
}
export function sourceLayerStickyPieceStart(
	context: MethodContext,
	rundownPlaylistId: RundownPlaylistId,
	sourceLayerId: string
) {
	check(rundownPlaylistId, String)
	check(sourceLayerId, String)

	let playlist = checkAccessAndGetPlaylist(context, rundownPlaylistId)
	if (!playlist.active)
		return ClientAPI.responseError(`The Rundown isn't active, please activate it before starting a sticky-item!`)
	if (!playlist.currentPartInstanceId)
		return ClientAPI.responseError(`No part is playing, please Take a part before starting a sticky-item.`)

	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.sourceLayerStickyPieceStart(context, rundownPlaylistId, sourceLayerId)
	)
}
export function activateHold(
	context: MethodContext,
	rundownPlaylistId: RundownPlaylistId,
	undo?: boolean
): ClientAPI.ClientResponse<void> {
	check(rundownPlaylistId, String)

	let playlist = checkAccessAndGetPlaylist(context, rundownPlaylistId)

	if (!playlist.currentPartInstanceId)
		return ClientAPI.responseError(`No part is currently playing, please Take a part before activating Hold mode!`)
	if (!playlist.nextPartInstanceId)
		return ClientAPI.responseError(`No part is set as Next, please set a Next before activating Hold mode!`)

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
		return ClientAPI.responseSuccess(ServerPlayoutAPI.deactivateHold(context, rundownPlaylistId))
	} else {
		return ClientAPI.responseSuccess(ServerPlayoutAPI.activateHold(context, rundownPlaylistId))
	}
}
export function userSaveEvaluation(context: MethodContext, evaluation: EvaluationBase): ClientAPI.ClientResponse<void> {
	return ClientAPI.responseSuccess(saveEvaluation(context, evaluation))
}
export function userStoreRundownSnapshot(context: MethodContext, playlistId: RundownPlaylistId, reason: string) {
	return ClientAPI.responseSuccess(storeRundownPlaylistSnapshot(context, playlistId, reason))
}
export function removeRundownPlaylist(context: MethodContext, playlistId: RundownPlaylistId) {
	let playlist = checkAccessAndGetPlaylist(context, playlistId)

	return ClientAPI.responseSuccess(ServerRundownAPI.removeRundownPlaylist(context, playlist._id))
}
export function resyncRundownPlaylist(context: MethodContext, playlistId: RundownPlaylistId) {
	let playlist = checkAccessAndGetPlaylist(context, playlistId)

	return ClientAPI.responseSuccess(ServerRundownAPI.resyncRundownPlaylist(context, playlist._id))
}
export function removeRundown(context: MethodContext, rundownId: RundownId) {
	let rundown = checkAccessAndGetRundown(context, rundownId)

	return ClientAPI.responseSuccess(ServerRundownAPI.removeRundown(context, rundown._id))
}
export function resyncRundown(context: MethodContext, rundownId: RundownId) {
	let rundown = checkAccessAndGetRundown(context, rundownId)

	return ClientAPI.responseSuccess(ServerRundownAPI.resyncRundown(context, rundown._id))
}
export function resyncSegment(context: MethodContext, rundownId: RundownId, segmentId: SegmentId) {
	rundownContentAllowWrite(context.userId, { rundownId })
	let segment = Segments.findOne(segmentId)
	if (!segment) throw new Meteor.Error(404, `Rundown "${segmentId}" not found!`)

	return ClientAPI.responseSuccess(ServerRundownAPI.resyncSegment(context, segment.rundownId, segmentId))
}
export function mediaRestartWorkflow(context: MethodContext, workflowId: MediaWorkFlowId) {
	return ClientAPI.responseSuccess(MediaManagerAPI.restartWorkflow(context, workflowId))
}
export function mediaAbortWorkflow(context: MethodContext, workflowId: MediaWorkFlowId) {
	return ClientAPI.responseSuccess(MediaManagerAPI.abortWorkflow(context, workflowId))
}
export function mediaPrioritizeWorkflow(context: MethodContext, workflowId: MediaWorkFlowId) {
	return ClientAPI.responseSuccess(MediaManagerAPI.prioritizeWorkflow(context, workflowId))
}
export function mediaRestartAllWorkflows(context: MethodContext) {
	const access = OrganizationContentWriteAccess.anyContent(context)
	return ClientAPI.responseSuccess(MediaManagerAPI.restartAllWorkflows(context, access.organizationId))
}
export function mediaAbortAllWorkflows(context: MethodContext) {
	const access = OrganizationContentWriteAccess.anyContent(context)
	return ClientAPI.responseSuccess(MediaManagerAPI.abortAllWorkflows(context, access.organizationId))
}
export function bucketsRemoveBucket(context: MethodContext, id: BucketId) {
	check(id, String)

	return ClientAPI.responseSuccess(BucketsAPI.removeBucket(context, id))
}
export function bucketsModifyBucket(context: MethodContext, id: BucketId, bucket: Partial<Omit<Bucket, '_id'>>) {
	check(id, String)
	check(bucket, Object)

	return ClientAPI.responseSuccess(BucketsAPI.modifyBucket(context, id, bucket))
}
export function bucketsEmptyBucket(context: MethodContext, id: BucketId) {
	check(id, String)

	return ClientAPI.responseSuccess(BucketsAPI.emptyBucket(context, id))
}
export function bucketsCreateNewBucket(
	context: MethodContext,
	name: string,
	studioId: StudioId,
	userId: string | null
) {
	check(name, String)
	check(studioId, String)

	return ClientAPI.responseSuccess(BucketsAPI.createNewBucket(context, name, studioId, userId))
}
export function bucketsRemoveBucketAdLib(context: MethodContext, id: PieceId) {
	check(id, String)

	return ClientAPI.responseSuccess(BucketsAPI.removeBucketAdLib(context, id))
}
export function bucketsModifyBucketAdLib(
	context: MethodContext,
	id: PieceId,
	adlib: Partial<Omit<BucketAdLib, '_id'>>
) {
	check(id, String)
	check(adlib, Object)

	return ClientAPI.responseSuccess(BucketsAPI.modifyBucketAdLib(context, id, adlib))
}
export function regenerateRundownPlaylist(context: MethodContext, rundownPlaylistId: RundownPlaylistId) {
	check(rundownPlaylistId, String)

	let playlist = checkAccessAndGetPlaylist(context, rundownPlaylistId)

	if (playlist.active) {
		return ClientAPI.responseError(`Rundown Playlist is active, please deactivate it before regenerating it.`)
	}

	return ClientAPI.responseSuccess(IngestActions.regenerateRundownPlaylist(rundownPlaylistId))
}

export function bucketAdlibImport(
	context: MethodContext,
	studioId: StudioId,
	showStyleVariantId: ShowStyleVariantId,
	bucketId: BucketId,
	ingestItem: IngestAdlib
) {
	const { studio } = OrganizationContentWriteAccess.studio(context, studioId)

	check(studioId, String)
	check(showStyleVariantId, String)
	check(bucketId, String)
	// TODO - validate IngestAdlib

	if (!studio) throw new Meteor.Error(404, `Studio "${studioId}" not found`)
	const showStyleCompound = getShowStyleCompound(showStyleVariantId)
	if (!showStyleCompound) throw new Meteor.Error(404, `ShowStyle Variant "${showStyleVariantId}" not found`)

	if (studio.supportedShowStyleBase.indexOf(showStyleCompound._id) === -1) {
		throw new Meteor.Error(500, `ShowStyle Variant "${showStyleVariantId}" not supported by studio "${studioId}"`)
	}

	const bucket = Buckets.findOne(bucketId)
	if (!bucket) throw new Meteor.Error(404, `Bucket "${bucketId}" not found`)

	updateBucketAdlibFromIngestData(showStyleCompound, studio, bucketId, ingestItem)

	return ClientAPI.responseSuccess(undefined)
}

export function bucketAdlibStart(
	context: MethodContext,
	rundownPlaylistId: RundownPlaylistId,
	partInstanceId: PartInstanceId,
	bucketAdlibId: PieceId,
	queue?: boolean
) {
	RundownPlaylistContentWriteAccess.playout(context, rundownPlaylistId)
	check(rundownPlaylistId, String)
	check(partInstanceId, String)
	check(bucketAdlibId, String)

	let rundown = RundownPlaylists.findOne(rundownPlaylistId)
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownPlaylistId}" not found!`)
	if (!rundown.active)
		return ClientAPI.responseError(`The Rundown isn't active, please activate it before starting an AdLib!`)
	if (rundown.holdState === RundownHoldState.ACTIVE || rundown.holdState === RundownHoldState.PENDING) {
		return ClientAPI.responseError(`Can't start AdLibPiece when the Rundown is in Hold mode!`)
	}

	return ClientAPI.responseSuccess(
		ServerPlayoutAdLibAPI.startBucketAdlibPiece(rundownPlaylistId, partInstanceId, bucketAdlibId, !!queue)
	)
}

let restartToken: string | undefined = undefined

export function generateRestartToken(context: MethodContext) {
	SystemWriteAccess.system(context)
	restartToken = getHash('restart_' + getCurrentTime())
	return ClientAPI.responseSuccess(restartToken)
}

export function restartCore(
	context: MethodContext,
	hashedRestartToken: string
): ClientAPI.ClientResponseSuccess<string> {
	check(hashedRestartToken, String)

	SystemWriteAccess.system(context)

	if (hashedRestartToken !== getHash(RESTART_SALT + restartToken)) {
		throw new Meteor.Error(401, `Restart token is invalid`)
	}

	setTimeout(() => {
		process.exit(0)
	}, 3000)
	return ClientAPI.responseSuccess(`Restarting Core in 3s.`)
}

export function noop(context: MethodContext) {
	triggerWriteAccessBecauseNoCheckNecessary()
	return ClientAPI.responseSuccess(undefined)
}

export function switchRouteSet(
	context: MethodContext,
	studioId: StudioId,
	routeSetId: string,
	state: boolean
): ClientAPI.ClientResponse<void> {
	check(studioId, String)
	check(routeSetId, String)
	check(state, Boolean)

	return ServerPlayoutAPI.switchRouteSet(context, studioId, routeSetId, state)
}

export function traceAction<T>(description: string, fn: (...args: any[]) => T, ...args: any[]) {
	const transaction = profiler.startTransaction(description, 'userAction')
	return makePromise(() => {
		const res = fn(...args)
		if (transaction) transaction.end()
		return res
	})
}

class ServerUserActionAPI extends MethodContextAPI implements NewUserActionAPI {
	take(_userEvent: string, rundownPlaylistId: RundownPlaylistId) {
		return traceAction('userAction.take', take, this, rundownPlaylistId)
	}
	setNext(_userEvent: string, rundownPlaylistId: RundownPlaylistId, partId: PartId, timeOffset?: number) {
		return traceAction('userAction.setNext', setNext, this, rundownPlaylistId, partId, true, timeOffset)
	}
	setNextSegment(_userEvent: string, rundownPlaylistId: RundownPlaylistId, segmentId: SegmentId) {
		return traceAction('userAction.setNextSegment', setNextSegment, this, rundownPlaylistId, segmentId)
	}
	moveNext(_userEvent: string, rundownPlaylistId: RundownPlaylistId, horisontalDelta: number, verticalDelta: number) {
		return traceAction(
			'userAction.moveNext',
			moveNext,
			this,
			rundownPlaylistId,
			horisontalDelta,
			verticalDelta,
			true
		)
	}
	prepareForBroadcast(_userEvent: string, rundownPlaylistId: RundownPlaylistId) {
		return traceAction('userAction.prepareForBroadcast', prepareForBroadcast, this, rundownPlaylistId)
	}
	resetRundownPlaylist(_userEvent: string, rundownPlaylistId: RundownPlaylistId) {
		return traceAction('userAction.resetRundownPlaylist', resetRundownPlaylist, this, rundownPlaylistId)
	}
	resetAndActivate(_userEvent: string, rundownPlaylistId: RundownPlaylistId, rehearsal?: boolean) {
		return traceAction('userAction.resetAndActivate', resetAndActivate, this, rundownPlaylistId, rehearsal)
	}
	activate(_userEvent: string, rundownPlaylistId: RundownPlaylistId, rehearsal: boolean) {
		return traceAction('userAction.activate', activate, this, rundownPlaylistId, rehearsal)
	}
	deactivate(_userEvent: string, rundownPlaylistId: RundownPlaylistId) {
		return traceAction('userAction.deactivate', deactivate, this, rundownPlaylistId)
	}
	forceResetAndActivate(_userEvent: string, rundownPlaylistId: RundownPlaylistId, rehearsal: boolean) {
		return traceAction(
			'userAction.forceResetAndActivate',
			forceResetAndActivate,
			this,
			rundownPlaylistId,
			rehearsal
		)
	}
	reloadData(_userEvent: string, rundownPlaylistId: RundownPlaylistId) {
		return traceAction('userAction.reloadRundownPlaylistData', reloadRundownPlaylistData, this, rundownPlaylistId)
	}
	unsyncRundown(_userEvent: string, rundownId: RundownId) {
		return traceAction('userAction.unsyncRundown', unsyncRundown, this, rundownId)
	}
	disableNextPiece(_userEvent: string, rundownPlaylistId: RundownPlaylistId, undo?: boolean) {
		return traceAction('userAction.disableNextPiece', disableNextPiece, this, rundownPlaylistId, undo)
	}
	pieceTakeNow(
		_userEvent: string,
		rundownPlaylistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		pieceInstanceIdOrPieceIdToCopy: PieceInstanceId | PieceId
	) {
		return traceAction(
			'userAction.pieceTakeNow',
			pieceTakeNow,
			this,
			rundownPlaylistId,
			partInstanceId,
			pieceInstanceIdOrPieceIdToCopy
		)
	}
	setInOutPoints(
		_userEvent: string,
		rundownPlaylistId: RundownPlaylistId,
		partId: PartId,
		pieceId: PieceId,
		inPoint: number,
		duration: number
	) {
		return pieceSetInOutPoints(this, rundownPlaylistId, partId, pieceId, inPoint, duration)
	}
	executeAction(
		_userEvent: string,
		rundownPlaylistId: RundownPlaylistId,
		actionId: string,
		userData: ActionUserData
	) {
		return traceAction('userAction.executeAction', executeAction, this, rundownPlaylistId, actionId, userData)
	}
	segmentAdLibPieceStart(
		_userEvent: string,
		rundownPlaylistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		adlibPieceId: PieceId,
		queue: boolean
	) {
		return traceAction(
			'userAction.segmentAdLibPieceStart',
			segmentAdLibPieceStart,
			this,
			rundownPlaylistId,
			partInstanceId,
			adlibPieceId,
			queue
		)
	}
	sourceLayerOnPartStop(
		_userEvent: string,
		rundownPlaylistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		sourceLayerIds: string[]
	) {
		return traceAction(
			'userAction.sourceLayerOnPartStop',
			sourceLayerOnPartStop,
			this,
			rundownPlaylistId,
			partInstanceId,
			sourceLayerIds
		)
	}
	baselineAdLibPieceStart(
		_userEvent: string,
		rundownPlaylistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		adlibPieceId: PieceId,
		queue: boolean
	) {
		return traceAction(
			'userAction.			rundownBaselineAdLibPieceStart',
			rundownBaselineAdLibPieceStart,
			this,
			rundownPlaylistId,
			partInstanceId,
			adlibPieceId,
			queue
		)
	}
	sourceLayerStickyPieceStart(_userEvent: string, rundownPlaylistId: RundownPlaylistId, sourceLayerId: string) {
		return traceAction(
			'userAction.sourceLayerStickyPieceStart',
			sourceLayerStickyPieceStart,
			this,
			rundownPlaylistId,
			sourceLayerId
		)
	}
	bucketAdlibImport(
		_userEvent: string,
		studioId: StudioId,
		showStyleVariantId: ShowStyleVariantId,
		bucketId: BucketId,
		ingestItem: IngestAdlib
	) {
		return traceAction(
			'userAction.bucketAdlibImport',
			bucketAdlibImport,
			this,
			studioId,
			showStyleVariantId,
			bucketId,
			ingestItem
		)
	}
	bucketAdlibStart(
		_userEvent: string,
		rundownPlaylistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		bucketAdlibId: PieceId,
		queue?: boolean
	) {
		return traceAction(
			'userAction.bucketAdlibStart',
			bucketAdlibStart,
			this,
			rundownPlaylistId,
			partInstanceId,
			bucketAdlibId,
			queue
		)
	}
	activateHold(_userEvent: string, rundownPlaylistId: RundownPlaylistId, undo?: boolean) {
		return traceAction('userAction.activateHold', activateHold, this, rundownPlaylistId, undo)
	}
	saveEvaluation(_userEvent: string, evaluation: EvaluationBase) {
		return makePromise(() => userSaveEvaluation(this, evaluation))
	}
	storeRundownSnapshot(_userEvent: string, playlistId: RundownPlaylistId, reason: string) {
		return traceAction('userAction.userStoreRundownSnapshot', userStoreRundownSnapshot, this, playlistId, reason)
	}
	removeRundownPlaylist(_userEvent: string, playlistId: RundownPlaylistId) {
		return traceAction('userAction.removeRundownPlaylist', removeRundownPlaylist, this, playlistId)
	}
	resyncRundownPlaylist(_userEvent: string, playlistId: RundownPlaylistId) {
		return traceAction('userAction.resyncRundownPlaylist', resyncRundownPlaylist, this, playlistId)
	}
	removeRundown(_userEvent: string, rundownId: RundownId) {
		return traceAction('userAction.removeRundown', removeRundown, this, rundownId)
	}
	resyncRundown(_userEvent: string, rundownId: RundownId) {
		return traceAction('userAction.resyncRundown', resyncRundown, this, rundownId)
	}
	resyncSegment(_userEvent: string, rundownId: RundownId, segmentId: SegmentId) {
		return traceAction('userAction.resyncSegment', resyncSegment, this, rundownId, segmentId)
	}
	mediaRestartWorkflow(_userEvent: string, workflowId: MediaWorkFlowId) {
		return makePromise(() => mediaRestartWorkflow(this, workflowId))
	}
	mediaAbortWorkflow(_userEvent: string, workflowId: MediaWorkFlowId) {
		return makePromise(() => mediaAbortWorkflow(this, workflowId))
	}
	mediaPrioritizeWorkflow(_userEvent: string, workflowId: MediaWorkFlowId) {
		return makePromise(() => mediaPrioritizeWorkflow(this, workflowId))
	}
	mediaRestartAllWorkflows(_userEvent: string) {
		return makePromise(() => mediaRestartAllWorkflows(this))
	}
	mediaAbortAllWorkflows(_userEvent: string) {
		return makePromise(() => mediaAbortAllWorkflows(this))
	}
	regenerateRundownPlaylist(_userEvent: string, playlistId: RundownPlaylistId) {
		return traceAction('userAction.regenerateRundownPlaylist', regenerateRundownPlaylist, this, playlistId)
	}
	generateRestartToken(_userEvent: string) {
		return makePromise(() => generateRestartToken(this))
	}
	restartCore(_userEvent: string, token: string) {
		return makePromise(() => restartCore(this, token))
	}
	guiFocused(_userEvent: string, _viewInfo: any[]) {
		return traceAction('userAction.noop', noop, this)
	}
	guiBlurred(_userEvent: string, _viewInfo: any[]) {
		return traceAction('userAction.noop', noop, this)
	}
	bucketsRemoveBucket(_userEvent: string, id: BucketId) {
		return traceAction('userAction.bucketsRemoveBucket', bucketsRemoveBucket, this, id)
	}
	bucketsModifyBucket(_userEvent: string, id: BucketId, bucket: Partial<Omit<Bucket, '_id'>>) {
		return traceAction('userAction.bucketsModifyBucket', bucketsModifyBucket, this, id, bucket)
	}
	bucketsEmptyBucket(_userEvent: string, id: BucketId) {
		return traceAction('userAction.bucketsEmptyBucket', bucketsEmptyBucket, this, id)
	}
	bucketsCreateNewBucket(_userEvent: string, name: string, studioId: StudioId, userId: string | null) {
		return traceAction('userAction.bucketsCreateNewBucket', bucketsCreateNewBucket, this, name, studioId, userId)
	}
	bucketsRemoveBucketAdLib(_userEvent: string, id: PieceId) {
		return traceAction('userAction.bucketsRemoveBucketAdLib', bucketsRemoveBucketAdLib, this, id)
	}
	bucketsModifyBucketAdLib(_userEvent: string, id: PieceId, bucketAdlib: Partial<Omit<BucketAdLib, '_id'>>) {
		return traceAction('userAction.bucketsModifyBucketAdLib', bucketsModifyBucketAdLib, this, id, bucketAdlib)
	}
	switchRouteSet(
		_userEvent: string,
		studioId: StudioId,
		routeSetId: string,
		state: boolean
	): Promise<ClientAPI.ClientResponse<void>> {
		return makePromise(() => switchRouteSet(this, studioId, routeSetId, state))
	}
}
registerClassToMeteorMethods(
	UserActionAPIMethods,
	ServerUserActionAPI,
	false,
	(methodContext: MethodContext, methodName: string, args: any[], fcn: Function) => {
		const eventContext = args[0]
		return ServerClientAPI.runInUserLog(methodContext, eventContext, methodName, args.slice(1), () => {
			return fcn.apply(methodContext, args)
		})
	}
)
