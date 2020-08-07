import * as _ from 'underscore'
import { Match } from 'meteor/check'
import { Meteor } from 'meteor/meteor'
import { ClientAPI } from '../../lib/api/client'
import { Rundowns, RundownHoldState, RundownId } from '../../lib/collections/Rundowns'
import { getCurrentTime, getHash, Omit, makePromise, check, protectString } from '../../lib/lib'
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
import { ServerTestToolsAPI, getStudioConfig } from './testTools'
import { RecordedFiles, RecordedFileId } from '../../lib/collections/RecordedFiles'
import { saveEvaluation } from './evaluations'
import { MediaManagerAPI } from './mediaManager'
import { IngestDataCache, IngestCacheType } from '../../lib/collections/IngestDataCache'
import { MOSDeviceActions } from './ingest/mosDevice/actions'
import { getActiveRundownPlaylistsInStudio } from './playout/studio'
import { IngestActions } from './ingest/actions'
import { RundownPlaylists, RundownPlaylistId } from '../../lib/collections/RundownPlaylists'
import { PartInstances, PartInstanceId } from '../../lib/collections/PartInstances'
import {
	PieceInstances,
	PieceInstanceId,
	PieceInstancePiece,
	omitPiecePropertiesForInstance,
} from '../../lib/collections/PieceInstances'
import { MediaWorkFlowId } from '../../lib/collections/MediaWorkFlows'
import { MethodContext } from '../../lib/api/methods'
import { ServerClientAPI } from './client'
import { SegmentId, Segment, Segments } from '../../lib/collections/Segments'
import { syncFunction } from '../codeControl'
import { getShowStyleCompound, ShowStyleVariantId } from '../../lib/collections/ShowStyleVariants'
import { BucketId, Buckets, Bucket } from '../../lib/collections/Buckets'
import { updateBucketAdlibFromIngestData } from './ingest/bucketAdlibs'
import { ServerPlayoutAdLibAPI } from './playout/adlib'
import { BucketsAPI } from './buckets'
import { BucketAdLib } from '../../lib/collections/BucketAdlibs'
import { Settings } from '../../lib/Settings'

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

// TODO - these use the rundownSyncFunction earlier, to ensure there arent differences when we get to the syncFunction?
export const take = syncFunction(function take(rundownPlaylistId: RundownPlaylistId): ClientAPI.ClientResponse<void> {
	// Called by the user. Wont throw as nasty errors
	const now = getCurrentTime()

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
	return ServerPlayoutAPI.takeNextPart(playlist._id)
}, 'userActionsTake$0')
export function setNext(
	rundownPlaylistId: RundownPlaylistId,
	nextPartId: PartId | null,
	setManually?: boolean,
	timeOffset?: number | undefined
): ClientAPI.ClientResponse<void> {
	check(rundownPlaylistId, String)
	if (nextPartId) check(nextPartId, String)

	const playlist = RundownPlaylists.findOne(rundownPlaylistId)
	if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found!`)
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
	return ServerPlayoutAPI.setNextPart(rundownPlaylistId, nextPartId, setManually, timeOffset)
}
export function setNextSegment(
	rundownPlaylistId: RundownPlaylistId,
	nextSegmentId: SegmentId | null
): ClientAPI.ClientResponse<void> {
	check(rundownPlaylistId, String)
	if (nextSegmentId) check(nextSegmentId, String)
	else check(nextSegmentId, null)

	const playlist = RundownPlaylists.findOne(rundownPlaylistId)
	if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found!`)
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
		const firstValidPartInSegment = _.find(partsInSegment, (p) => p.isPlayable())

		if (!firstValidPartInSegment) return ClientAPI.responseError('Segment contains no valid parts')

		const { currentPartInstance, nextPartInstance } = playlist.getSelectedPartInstances()
		if (!currentPartInstance || !nextPartInstance || nextPartInstance.segmentId !== currentPartInstance.segmentId) {
			// Special: in this case, the user probably dosen't want to setNextSegment, but rather just setNextPart
			return ServerPlayoutAPI.setNextPart(rundownPlaylistId, firstValidPartInSegment._id, true, 0)
		}
	}

	return ServerPlayoutAPI.setNextSegment(rundownPlaylistId, nextSegmentId)
}
export function moveNext(
	rundownPlaylistId: RundownPlaylistId,
	horisontalDelta: number,
	verticalDelta: number,
	setManually: boolean
): ClientAPI.ClientResponse<PartId | null> {
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
		ServerPlayoutAPI.moveNextPart(rundownPlaylistId, horisontalDelta, verticalDelta, setManually)
	)
}
export function prepareForBroadcast(rundownPlaylistId: RundownPlaylistId): ClientAPI.ClientResponse<void> {
	check(rundownPlaylistId, String)
	let playlist = RundownPlaylists.findOne(rundownPlaylistId)
	if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found!`)
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
	return ClientAPI.responseSuccess(ServerPlayoutAPI.prepareRundownPlaylistForBroadcast(rundownPlaylistId))
}
export function resetRundownPlaylist(rundownPlaylistId: RundownPlaylistId): ClientAPI.ClientResponse<void> {
	check(rundownPlaylistId, String)
	let playlist = RundownPlaylists.findOne(rundownPlaylistId)
	if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found!`)
	if (playlist.active && !playlist.rehearsal && !Settings.allowRundownResetOnAir) {
		return ClientAPI.responseError(
			'RundownPlaylist is active but not in rehearsal, please deactivate it or set in in rehearsal to be able to reset it.'
		)
	}

	return ClientAPI.responseSuccess(ServerPlayoutAPI.resetRundownPlaylist(rundownPlaylistId))
}
export function resetAndActivate(
	rundownPlaylistId: RundownPlaylistId,
	rehearsal?: boolean
): ClientAPI.ClientResponse<void> {
	check(rundownPlaylistId, String)
	let playlist = RundownPlaylists.findOne(rundownPlaylistId)
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

	return ClientAPI.responseSuccess(ServerPlayoutAPI.resetAndActivateRundownPlaylist(rundownPlaylistId, rehearsal))
}
export function forceResetAndActivate(
	rundownPlaylistId: RundownPlaylistId,
	rehearsal: boolean
): ClientAPI.ClientResponse<void> {
	// Reset and activates a rundown, automatically deactivates any other running rundowns

	check(rehearsal, Boolean)
	const playlist = RundownPlaylists.findOne(rundownPlaylistId)
	if (!playlist) throw new Meteor.Error(404, `RundownPlaylist "${rundownPlaylistId}" not found!`)

	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.forceResetAndActivateRundownPlaylist(rundownPlaylistId, rehearsal)
	)
}
export function activate(rundownPlaylistId: RundownPlaylistId, rehearsal: boolean): ClientAPI.ClientResponse<void> {
	check(rundownPlaylistId, String)
	check(rehearsal, Boolean)
	let playlist = RundownPlaylists.findOne(rundownPlaylistId)
	if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found!`)
	const anyOtherActiveRundowns = getActiveRundownPlaylistsInStudio(null, playlist.studioId, playlist._id)
	if (anyOtherActiveRundowns.length) {
		return ClientAPI.responseError(
			409,
			'Only one rundown can be active at the same time. Currently active rundowns: ' +
				_.map(anyOtherActiveRundowns, (p) => p.name).join(', '),
			anyOtherActiveRundowns
		)
	}
	return ClientAPI.responseSuccess(ServerPlayoutAPI.activateRundownPlaylist(playlist._id, rehearsal))
}
export function deactivate(rundownPlaylistId: RundownPlaylistId): ClientAPI.ClientResponse<void> {
	let playlist = RundownPlaylists.findOne(rundownPlaylistId)
	if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found!`)
	return ClientAPI.responseSuccess(ServerPlayoutAPI.deactivateRundownPlaylist(playlist._id))
}
export function reloadRundownPlaylistData(rundownPlaylistId: RundownPlaylistId) {
	return ClientAPI.responseSuccess(ServerPlayoutAPI.reloadRundownPlaylistData(rundownPlaylistId))
}
export function unsyncRundown(rundownId: RundownId) {
	return ClientAPI.responseSuccess(ServerRundownAPI.unsyncRundown(rundownId))
}
export function disableNextPiece(rundownPlaylistId: RundownPlaylistId, undo?: boolean) {
	return ClientAPI.responseSuccess(ServerPlayoutAPI.disableNextPiece(rundownPlaylistId, undo))
}
// export function togglePartArgument(
// 	rundownPlaylistId: RundownPlaylistId,
// 	partInstanceId: PartInstanceId,
// 	property: string,
// 	value: string
// ) {
// 	const playlist = RundownPlaylists.findOne(rundownPlaylistId)
// 	if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found!`)
// 	if (playlist.holdState === RundownHoldState.ACTIVE || playlist.holdState === RundownHoldState.PENDING) {
// 		return ClientAPI.responseError(`Part-arguments can't be toggled while Rundown is in Hold mode!`)
// 	}

// 	return ServerPlayoutAPI.rundownTogglePartArgument(rundownPlaylistId, partInstanceId, property, value)
// }
export function pieceTakeNow(
	rundownPlaylistId: RundownPlaylistId,
	partInstanceId: PartInstanceId,
	pieceInstanceIdOrPieceIdToCopy: PieceInstanceId | PieceId
) {
	check(rundownPlaylistId, String)
	check(partInstanceId, String)
	check(pieceInstanceIdOrPieceIdToCopy, String)

	const playlist = RundownPlaylists.findOne(rundownPlaylistId)
	if (!playlist) throw new Meteor.Error(404, `RundownPlaylist "${rundownPlaylistId}" not found!`)
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
		ServerPlayoutAPI.pieceTakeNow(rundownPlaylistId, partInstanceId, pieceInstanceIdOrPieceIdToCopy)
	)
}
export function pieceSetInOutPoints(
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

	const playlist = RundownPlaylists.findOne(rundownPlaylistId)
	if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found!`)
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
export function executeAction(rundownPlaylistId: RundownPlaylistId, actionId: string, userData: any) {
	check(rundownPlaylistId, String)
	check(actionId, String)
	check(userData, Match.Any)

	const playlist = RundownPlaylists.findOne(rundownPlaylistId)
	if (!playlist) throw new Meteor.Error(404, `RundownPlaylist "${rundownPlaylistId}" not found!`)
	if (!playlist.active)
		return ClientAPI.responseError(`The Rundown isn't active, please activate it before executing an action!`)
	if (!playlist.currentPartInstanceId)
		return ClientAPI.responseError(`No part is playing, please Take a part before executing an action.`)

	return ClientAPI.responseSuccess(ServerPlayoutAPI.executeAction(rundownPlaylistId, actionId, userData))
}
export function segmentAdLibPieceStart(
	rundownPlaylistId: RundownPlaylistId,
	partInstanceId: PartInstanceId,
	adlibPieceId: PieceId,
	queue: boolean
) {
	check(rundownPlaylistId, String)
	check(partInstanceId, String)
	check(adlibPieceId, String)

	let playlist = RundownPlaylists.findOne(rundownPlaylistId)
	if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found!`)
	if (!playlist.active)
		return ClientAPI.responseError(`The Rundown isn't active, please activate it before starting an AdLib!`)
	if (playlist.holdState === RundownHoldState.ACTIVE || playlist.holdState === RundownHoldState.PENDING) {
		return ClientAPI.responseError(`Can't start AdLibPiece when the Rundown is in Hold mode!`)
	}

	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.segmentAdLibPieceStart(rundownPlaylistId, partInstanceId, adlibPieceId, queue)
	)
}
export function sourceLayerOnPartStop(
	rundownPlaylistId: RundownPlaylistId,
	partInstanceId: PartInstanceId,
	sourceLayerIds: string[]
) {
	check(rundownPlaylistId, String)
	check(partInstanceId, String)
	check(sourceLayerIds, Match.OneOf(String, Array))

	let playlist = RundownPlaylists.findOne(rundownPlaylistId)
	if (!playlist) throw new Meteor.Error(404, `RundownPlaylist "${rundownPlaylistId}" not found!`)
	if (!playlist.active)
		return ClientAPI.responseError(`The Rundown isn't active, can't stop an AdLib on a deactivated Rundown!`)

	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.sourceLayerOnPartStop(rundownPlaylistId, partInstanceId, sourceLayerIds)
	)
}
export function rundownBaselineAdLibPieceStart(
	rundownPlaylistId: RundownPlaylistId,
	partInstanceId: PartInstanceId,
	adlibPieceId: PieceId,
	queue: boolean
) {
	check(rundownPlaylistId, String)
	check(partInstanceId, String)
	check(adlibPieceId, String)

	let playlist = RundownPlaylists.findOne(rundownPlaylistId)
	if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found!`)
	if (!playlist.active)
		return ClientAPI.responseError(`The Rundown isn't active, please activate it before starting an AdLib!`)
	if (playlist.holdState === RundownHoldState.ACTIVE || playlist.holdState === RundownHoldState.PENDING) {
		return ClientAPI.responseError(`Can't start AdLib piece when the Rundown is in Hold mode!`)
	}
	return ClientAPI.responseSuccess(
		ServerPlayoutAPI.rundownBaselineAdLibPieceStart(rundownPlaylistId, partInstanceId, adlibPieceId, queue)
	)
}
export function sourceLayerStickyPieceStart(rundownPlaylistId: RundownPlaylistId, sourceLayerId: string) {
	check(rundownPlaylistId, String)
	check(sourceLayerId, String)

	const playlist = RundownPlaylists.findOne(rundownPlaylistId)
	if (!playlist) throw new Meteor.Error(404, `RundownPlaylist "${rundownPlaylistId}" not found!`)
	if (!playlist.active)
		return ClientAPI.responseError(`The Rundown isn't active, please activate it before starting a sticky-item!`)
	if (!playlist.currentPartInstanceId)
		return ClientAPI.responseError(`No part is playing, please Take a part before starting a sticky-item.`)

	return ClientAPI.responseSuccess(ServerPlayoutAPI.sourceLayerStickyPieceStart(rundownPlaylistId, sourceLayerId))
}
export function activateHold(rundownPlaylistId: RundownPlaylistId, undo?: boolean): ClientAPI.ClientResponse<void> {
	check(rundownPlaylistId, String)

	let playlist = RundownPlaylists.findOne(rundownPlaylistId)
	if (!playlist) throw new Meteor.Error(404, `RundownPlaylist "${rundownPlaylistId}" not found!`)

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
		return ClientAPI.responseSuccess(ServerPlayoutAPI.deactivateHold(rundownPlaylistId))
	} else {
		return ClientAPI.responseSuccess(ServerPlayoutAPI.activateHold(rundownPlaylistId))
	}
}
export function userSaveEvaluation(
	methodContext: MethodContext,
	evaluation: EvaluationBase
): ClientAPI.ClientResponse<void> {
	return ClientAPI.responseSuccess(saveEvaluation(methodContext, evaluation))
}
export function userStoreRundownSnapshot(playlistId: RundownPlaylistId, reason: string) {
	return ClientAPI.responseSuccess(storeRundownPlaylistSnapshot(playlistId, reason))
}
export function removeRundownPlaylist(playlistId: RundownPlaylistId) {
	let playlist = RundownPlaylists.findOne(playlistId)
	if (!playlist) throw new Meteor.Error(404, `RundownPlaylist "${playlistId}" not found!`)

	return ClientAPI.responseSuccess(ServerRundownAPI.removeRundownPlaylist(playlistId))
}
export function resyncRundownPlaylist(playlistId: RundownPlaylistId) {
	let playlist = RundownPlaylists.findOne(playlistId)
	if (!playlist) throw new Meteor.Error(404, `RundownPlaylist "${playlistId}" not found!`)

	return ClientAPI.responseSuccess(ServerRundownAPI.resyncRundownPlaylist(playlistId))
}
export function removeRundown(rundownId: RundownId) {
	let rundown = Rundowns.findOne(rundownId)
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)

	return ClientAPI.responseSuccess(ServerRundownAPI.removeRundown(rundownId))
}
export function resyncRundown(rundownId: RundownId) {
	let rundown = Rundowns.findOne(rundownId)
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)

	return ClientAPI.responseSuccess(ServerRundownAPI.resyncRundown(rundownId))
}
export function resyncSegment(segmentId: SegmentId) {
	let segment = Segments.findOne(segmentId)
	if (!segment) throw new Meteor.Error(404, `Rundown "${segmentId}" not found!`)

	return ClientAPI.responseSuccess(ServerRundownAPI.resyncSegment(segmentId))
}
export function recordStop(studioId: StudioId) {
	check(studioId, String)
	const record = RecordedFiles.findOne({
		studioId: studioId,
		stoppedAt: { $exists: false },
	})
	if (!record) return ClientAPI.responseError(`No active recording for "${studioId}" was found!`)
	return ClientAPI.responseSuccess(ServerTestToolsAPI.recordStop(studioId))
}

export function recordStart(studioId: StudioId, fileName: string) {
	check(studioId, String)
	check(fileName, String)
	const studio = Studios.findOne(studioId)
	if (!studio) throw new Meteor.Error(404, `Studio "${studioId}" was not found!`)

	const active = RecordedFiles.findOne({
		studioId: studioId,
		stoppedAt: { $exists: false },
	})
	if (active) return ClientAPI.responseError(`There is already an active recording in studio "${studioId}"!`)

	const config = getStudioConfig(studio)
	if (!config.recordings.channelIndex)
		return ClientAPI.responseError(`Cannot start recording due to a missing setting: "channel".`)
	if (!config.recordings.deviceId)
		return ClientAPI.responseError(`Cannot start recording due to a missing setting: "device".`)
	if (!config.recordings.decklinkDevice)
		return ClientAPI.responseError(`Cannot start recording due to a missing setting: "decklink".`)
	if (!config.recordings.channelIndex)
		return ClientAPI.responseError(`Cannot start recording due to a missing setting: "channel".`)

	return ClientAPI.responseSuccess(ServerTestToolsAPI.recordStart(studioId, fileName))
}
export function recordDelete(fileId: RecordedFileId) {
	return ClientAPI.responseSuccess(ServerTestToolsAPI.recordDelete(fileId))
}
export function mediaRestartWorkflow(workflowId: MediaWorkFlowId) {
	return ClientAPI.responseSuccess(MediaManagerAPI.restartWorkflow(workflowId))
}
export function mediaAbortWorkflow(workflowId: MediaWorkFlowId) {
	return ClientAPI.responseSuccess(MediaManagerAPI.abortWorkflow(workflowId))
}
export function mediaPrioritizeWorkflow(workflowId: MediaWorkFlowId) {
	return ClientAPI.responseSuccess(MediaManagerAPI.prioritizeWorkflow(workflowId))
}
export function mediaRestartAllWorkflows() {
	return ClientAPI.responseSuccess(MediaManagerAPI.restartAllWorkflows())
}
export function mediaAbortAllWorkflows() {
	return ClientAPI.responseSuccess(MediaManagerAPI.abortAllWorkflows())
}
export function bucketsRemoveBucket(id: BucketId) {
	check(id, String)

	return ClientAPI.responseSuccess(BucketsAPI.removeBucket(id))
}
export function bucketsModifyBucket(id: BucketId, bucket: Partial<Omit<Bucket, '_id'>>) {
	check(id, String)
	check(bucket, Object)

	return ClientAPI.responseSuccess(BucketsAPI.modifyBucket(id, bucket))
}
export function bucketsEmptyBucket(id: BucketId) {
	check(id, String)

	return ClientAPI.responseSuccess(BucketsAPI.emptyBucket(id))
}
export function bucketsCreateNewBucket(name: string, studioId: StudioId, userId: string | null) {
	check(name, String)
	check(studioId, String)

	return ClientAPI.responseSuccess(BucketsAPI.createNewBucket(name, studioId, userId))
}
export function bucketsRemoveBucketAdLib(id: PieceId) {
	check(id, String)

	return ClientAPI.responseSuccess(BucketsAPI.removeBucketAdLib(id))
}
export function bucketsModifyBucketAdLib(id: PieceId, adlib: Partial<Omit<BucketAdLib, '_id'>>) {
	check(id, String)
	check(adlib, Object)

	return ClientAPI.responseSuccess(BucketsAPI.modifyBucketAdLib(id, adlib))
}
export function regenerateRundownPlaylist(rundownPlaylistId: RundownPlaylistId) {
	check(rundownPlaylistId, String)

	const rundownPlaylist = RundownPlaylists.findOne(rundownPlaylistId)
	if (!rundownPlaylist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found`)

	if (rundownPlaylist.active) {
		return ClientAPI.responseError(`Rundown Playlist is active, please deactivate it before regenerating it.`)
	}

	return ClientAPI.responseSuccess(IngestActions.regenerateRundownPlaylist(rundownPlaylistId))
}

export function bucketAdlibImport(
	studioId: StudioId,
	showStyleVariantId: ShowStyleVariantId,
	bucketId: BucketId,
	ingestItem: IngestAdlib
) {
	check(studioId, String)
	check(showStyleVariantId, String)
	check(bucketId, String)
	// TODO - validate IngestAdlib

	const studio = Studios.findOne(studioId)
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
	rundownPlaylistId: RundownPlaylistId,
	partInstanceId: PartInstanceId,
	bucketAdlibId: PieceId,
	queue?: boolean
) {
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

export function generateRestartToken() {
	restartToken = getHash('restart_' + getCurrentTime())
	return ClientAPI.responseSuccess(restartToken)
}

export function restartCore(token: string): ClientAPI.ClientResponseSuccess<string> {
	check(token, String)

	if (token !== getHash(RESTART_SALT + restartToken)) {
		throw new Meteor.Error(401, `Restart token is invalid`)
	}

	setTimeout(() => {
		process.exit(0)
	}, 3000)
	return ClientAPI.responseSuccess(`Restarting Core in 3s.`)
}

export function noop() {
	return ClientAPI.responseSuccess(undefined)
}

class ServerUserActionAPI implements NewUserActionAPI {
	take(_userEvent: string, rundownPlaylistId: RundownPlaylistId) {
		return makePromise(() => take(rundownPlaylistId))
	}
	setNext(_userEvent: string, rundownPlaylistId: RundownPlaylistId, partId: PartId, timeOffset?: number) {
		return makePromise(() => setNext(rundownPlaylistId, partId, true, timeOffset))
	}
	setNextSegment(_userEvent: string, rundownPlaylistId: RundownPlaylistId, segmentId: SegmentId) {
		return makePromise(() => setNextSegment(rundownPlaylistId, segmentId))
	}
	moveNext(_userEvent: string, rundownPlaylistId: RundownPlaylistId, horisontalDelta: number, verticalDelta: number) {
		return makePromise(() => moveNext(rundownPlaylistId, horisontalDelta, verticalDelta, true))
	}
	prepareForBroadcast(_userEvent: string, rundownPlaylistId: RundownPlaylistId) {
		return makePromise(() => prepareForBroadcast(rundownPlaylistId))
	}
	resetRundownPlaylist(_userEvent: string, rundownPlaylistId: RundownPlaylistId) {
		return makePromise(() => resetRundownPlaylist(rundownPlaylistId))
	}
	resetAndActivate(_userEvent: string, rundownPlaylistId: RundownPlaylistId, rehearsal?: boolean) {
		return makePromise(() => resetAndActivate(rundownPlaylistId, rehearsal))
	}
	activate(_userEvent: string, rundownPlaylistId: RundownPlaylistId, rehearsal: boolean) {
		return makePromise(() => activate(rundownPlaylistId, rehearsal))
	}
	deactivate(_userEvent: string, rundownPlaylistId: RundownPlaylistId) {
		return makePromise(() => deactivate(rundownPlaylistId))
	}
	forceResetAndActivate(_userEvent: string, rundownPlaylistId: RundownPlaylistId, rehearsal: boolean) {
		return makePromise(() => forceResetAndActivate(rundownPlaylistId, rehearsal))
	}
	reloadData(_userEvent: string, rundownPlaylistId: RundownPlaylistId) {
		return makePromise(() => reloadRundownPlaylistData(rundownPlaylistId))
	}
	unsyncRundown(_userEvent: string, rundownId: RundownId) {
		return makePromise(() => unsyncRundown(rundownId))
	}
	disableNextPiece(_userEvent: string, rundownPlaylistId: RundownPlaylistId, undo?: boolean) {
		return makePromise(() => disableNextPiece(rundownPlaylistId, undo))
	}
	togglePartArgument(
		_userEvent: string,
		rundownPlaylistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		property: string,
		value: string
	) {
		return makePromise(() => noop())
		// return makePromise(() => togglePartArgument(rundownPlaylistId, partInstanceId, property, value))
	}
	pieceTakeNow(
		_userEvent: string,
		rundownPlaylistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		pieceInstanceIdOrPieceIdToCopy: PieceInstanceId | PieceId
	) {
		return makePromise(() => pieceTakeNow(rundownPlaylistId, partInstanceId, pieceInstanceIdOrPieceIdToCopy))
	}
	setInOutPoints(
		_userEvent: string,
		rundownPlaylistId: RundownPlaylistId,
		partId: PartId,
		pieceId: PieceId,
		inPoint: number,
		duration: number
	) {
		return pieceSetInOutPoints(rundownPlaylistId, partId, pieceId, inPoint, duration)
	}
	executeAction(
		_userEvent: string,
		rundownPlaylistId: RundownPlaylistId,
		actionId: string,
		userData: ActionUserData
	) {
		return makePromise(() => executeAction(rundownPlaylistId, actionId, userData))
	}
	segmentAdLibPieceStart(
		_userEvent: string,
		rundownPlaylistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		adlibPieceId: PieceId,
		queue: boolean
	) {
		return makePromise(() => segmentAdLibPieceStart(rundownPlaylistId, partInstanceId, adlibPieceId, queue))
	}
	sourceLayerOnPartStop(
		_userEvent: string,
		rundownPlaylistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		sourceLayerIds: string[]
	) {
		return makePromise(() => sourceLayerOnPartStop(rundownPlaylistId, partInstanceId, sourceLayerIds))
	}
	baselineAdLibPieceStart(
		_userEvent: string,
		rundownPlaylistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		adlibPieceId: PieceId,
		queue: boolean
	) {
		return makePromise(() => rundownBaselineAdLibPieceStart(rundownPlaylistId, partInstanceId, adlibPieceId, queue))
	}
	sourceLayerStickyPieceStart(_userEvent: string, rundownPlaylistId: RundownPlaylistId, sourceLayerId: string) {
		return makePromise(() => sourceLayerStickyPieceStart(rundownPlaylistId, sourceLayerId))
	}
	bucketAdlibImport(
		_userEvent: string,
		studioId: StudioId,
		showStyleVariantId: ShowStyleVariantId,
		bucketId: BucketId,
		ingestItem: IngestAdlib
	) {
		return makePromise(() => bucketAdlibImport(studioId, showStyleVariantId, bucketId, ingestItem))
	}
	bucketAdlibStart(
		_userEvent: string,
		rundownPlaylistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		bucketAdlibId: PieceId,
		queue?: boolean
	) {
		return makePromise(() => bucketAdlibStart(rundownPlaylistId, partInstanceId, bucketAdlibId, queue))
	}
	activateHold(_userEvent: string, rundownPlaylistId: RundownPlaylistId, undo?: boolean) {
		return makePromise(() => activateHold(rundownPlaylistId, undo))
	}
	saveEvaluation(_userEvent: string, evaluation: EvaluationBase) {
		return makePromise(() => userSaveEvaluation(this as any, evaluation))
	}
	storeRundownSnapshot(_userEvent: string, playlistId: RundownPlaylistId, reason: string) {
		return makePromise(() => userStoreRundownSnapshot(playlistId, reason))
	}
	removeRundownPlaylist(_userEvent: string, playlistId: RundownPlaylistId) {
		return makePromise(() => removeRundownPlaylist(playlistId))
	}
	resyncRundownPlaylist(_userEvent: string, playlistId: RundownPlaylistId) {
		return makePromise(() => resyncRundownPlaylist(playlistId))
	}
	removeRundown(_userEvent: string, rundownId: RundownId) {
		return makePromise(() => removeRundown(rundownId))
	}
	resyncRundown(_userEvent: string, rundownId: RundownId) {
		return makePromise(() => resyncRundown(rundownId))
	}
	resyncSegment(_userEvent: string, segmentId: SegmentId) {
		return makePromise(() => resyncSegment(segmentId))
	}
	recordStop(_userEvent: string, studioId: StudioId) {
		return makePromise(() => recordStop(studioId))
	}
	recordStart(_userEvent: string, studioId: StudioId, name: string) {
		return makePromise(() => recordStart(studioId, name))
	}
	recordDelete(_userEvent: string, id: RecordedFileId) {
		return makePromise(() => recordDelete(id))
	}
	mediaRestartWorkflow(_userEvent: string, workflowId: MediaWorkFlowId) {
		return makePromise(() => mediaRestartWorkflow(workflowId))
	}
	mediaAbortWorkflow(_userEvent: string, workflowId: MediaWorkFlowId) {
		return makePromise(() => mediaAbortWorkflow(workflowId))
	}
	mediaPrioritizeWorkflow(_userEvent: string, workflowId: MediaWorkFlowId) {
		return makePromise(() => mediaPrioritizeWorkflow(workflowId))
	}
	mediaRestartAllWorkflows(_userEvent: string) {
		return makePromise(() => mediaRestartAllWorkflows())
	}
	mediaAbortAllWorkflows(_userEvent: string) {
		return makePromise(() => mediaAbortAllWorkflows())
	}
	regenerateRundownPlaylist(_userEvent: string, playlistId: RundownPlaylistId) {
		return makePromise(() => regenerateRundownPlaylist(playlistId))
	}
	generateRestartToken(_userEvent: string) {
		return makePromise(() => generateRestartToken())
	}
	restartCore(_userEvent: string, token: string) {
		return makePromise(() => restartCore(token))
	}
	guiFocused(_userEvent: string, _viewInfo: any[]) {
		return makePromise(() => noop())
	}
	guiBlurred(_userEvent: string, _viewInfo: any[]) {
		return makePromise(() => noop())
	}
	bucketsRemoveBucket(_userEvent: string, id: BucketId) {
		return makePromise(() => bucketsRemoveBucket(id))
	}
	bucketsModifyBucket(_userEvent: string, id: BucketId, bucket: Partial<Omit<Bucket, '_id'>>) {
		return makePromise(() => bucketsModifyBucket(id, bucket))
	}
	bucketsEmptyBucket(_userEvent: string, id: BucketId) {
		return makePromise(() => bucketsEmptyBucket(id))
	}
	bucketsCreateNewBucket(_userEvent: string, name: string, studioId: StudioId, userId: string | null) {
		return makePromise(() => bucketsCreateNewBucket(name, studioId, userId))
	}
	bucketsRemoveBucketAdLib(_userEvent: string, id: PieceId) {
		return makePromise(() => bucketsRemoveBucketAdLib(id))
	}
	bucketsModifyBucketAdLib(_userEvent: string, id: PieceId, bucketAdlib: Partial<Omit<BucketAdLib, '_id'>>) {
		return makePromise(() => bucketsModifyBucketAdLib(id, bucketAdlib))
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
