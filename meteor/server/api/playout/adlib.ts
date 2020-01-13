import { Meteor } from 'meteor/meteor'
import { check } from 'meteor/check'
import { Random } from 'meteor/random'
import * as _ from 'underscore'
import { SourceLayerType } from 'tv-automation-sofie-blueprints-integration'
import { getCurrentTime, literal } from '../../../lib/lib'
import { logger } from '../../../lib/logging'
import { Rundowns, RundownHoldState, Rundown } from '../../../lib/collections/Rundowns'
import { TimelineObjGeneric, TimelineObjType } from '../../../lib/collections/Timeline'
import { AdLibPieces, AdLibPiece } from '../../../lib/collections/AdLibPieces'
import { RundownBaselineAdLibPieces } from '../../../lib/collections/RundownBaselineAdLibPieces'
import { RundownPlaylists, RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { Pieces } from '../../../lib/collections/Pieces'
import { Parts, Part, DBPart } from '../../../lib/collections/Parts'
import { prefixAllObjectIds } from './lib'
import { convertAdLibToPieceInstance, getResolvedPieces } from './pieces'
import { cropInfinitesOnLayer, stopInfinitesRunningOnLayer } from './infinites'
import { updateTimeline } from './timeline'
import { updatePartRanks } from '../rundown'
import { rundownSyncFunction, RundownSyncFunctionPriority } from '../ingest/rundownInput'

import { ServerPlayoutAPI } from './playout' // TODO - this should not be calling back like this
import { PieceInstances, PieceInstance } from '../../../lib/collections/PieceInstances'
import { PartInstances } from '../../../lib/collections/PartInstances'

export namespace ServerPlayoutAdLibAPI {
	export function pieceTakeNow (rundownPlaylistId: string, partInstanceId: string, pieceInstanceIdToCopy: string) {
		return rundownSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.Playout, () => {
			const rundownPlaylists = RundownPlaylists.findOne(rundownPlaylistId)
			if (!rundownPlaylists) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found!`)
			if (!rundownPlaylists.active) throw new Meteor.Error(403, `Part AdLib-pieces can be only placed in an active rundown!`)
			if (rundownPlaylists.currentPartInstanceId !== partInstanceId) throw new Meteor.Error(403, `Part AdLib-pieces can be only placed in a current part!`)

			const pieceInstanceToCopy = PieceInstances.findOne(pieceInstanceIdToCopy) as PieceInstance
			if (!pieceInstanceToCopy) throw new Meteor.Error(404, `PieceInstance "${pieceInstanceIdToCopy}" not found!`)

			const partInstance = PartInstances.findOne(partInstanceId)
			if (!partInstance) throw new Meteor.Error(404, `PartInstance "${partInstanceId}" not found!`)

			const rundown = Rundowns.findOne(partInstance.rundownId)
			if (!rundown) throw new Meteor.Error(404, `Rundown "${partInstance.rundownId}" not found!`)

			const showStyleBase = rundown.getShowStyleBase()
			const sourceL = showStyleBase.sourceLayers.find(i => i._id === pieceInstanceToCopy.piece.sourceLayerId)
			if (sourceL && sourceL.type !== SourceLayerType.GRAPHICS) throw new Meteor.Error(403, `PieceInstance "${pieceInstanceIdToCopy}" is not a GRAPHICS item!`)

			const newPieceInstance = convertAdLibToPieceInstance(pieceInstanceToCopy.piece, partInstance, false)
			if (newPieceInstance.piece.content && newPieceInstance.piece.content.timelineObjects) {
				newPieceInstance.piece.content.timelineObjects = prefixAllObjectIds(
					_.compact(
						_.map(newPieceInstance.piece.content.timelineObjects, (obj) => {
							return literal<TimelineObjGeneric>({
								...obj,
								// @ts-ignore _id
								_id: obj.id || obj._id,
								studioId: '', // set later
								objectType: TimelineObjType.RUNDOWN
							})
						})
					),
					newPieceInstance._id
				)
			}

			// Disable the original piece if from the same Part
			if (pieceInstanceToCopy.partInstanceId === partInstance._id) {
				const pieces = getResolvedPieces(part)
				const origResolvedPiece = pieces.find(p => p._id === pieceInstanceToCopy._id)

				// Ensure the piece being copied isnt currently live
				if (pieceInstanceToCopy.piece.startedPlayback && pieceInstanceToCopy.piece.startedPlayback <= getCurrentTime()) {
					if (
						origResolvedPiece &&
						origResolvedPiece.piece.playoutDuration !== undefined &&
						(
							pieceInstanceToCopy.piece.infiniteMode ||
							pieceInstanceToCopy.piece.startedPlayback + origResolvedPiece.piece.playoutDuration >= getCurrentTime()
						)
					) {
						// logger.debug(`Piece "${piece._id}" is currently live and cannot be used as an ad-lib`)
						throw new Meteor.Error(409, `PieceInstance "${pieceInstanceToCopy._id}" is currently live and cannot be used as an ad-lib`)
					}
				}

				PieceInstances.update(pieceInstanceToCopy._id, {$set: {
					'piece.disabled': true,
					'piece.hidden': true
				}})
				// TODO-PartInstance - pending new data flow
				Pieces.update(pieceInstanceToCopy.piece._id, {$set: {
					disabled: true,
					hidden: true
				}})
			}

			PieceInstances.insert(newPieceInstance)
			// TODO-PartInstance - pending new data flow
			Pieces.insert(newPieceInstance.piece)

			cropInfinitesOnLayer(rundown, partInstance, newPieceInstance)
			stopInfinitesRunningOnLayer(rundown, partInstance, newPieceInstance.piece.sourceLayerId)
			updateTimeline(rundown.studioId)
		})
	}
	export function segmentAdLibPieceStart (rundownPlaylistId: string, rundownId: string, partInstanceId: string, adLibPieceId: string, queue: boolean) {
		return rundownSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.Playout, () => {
			const rundownPlaylist = RundownPlaylists.findOne(rundownPlaylistId)
			if (!rundownPlaylist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found!`)
			if (!rundownPlaylist.active) throw new Meteor.Error(403, `Part AdLib-pieces can be only placed in an active rundown!`)
			if (rundownPlaylist.holdState === RundownHoldState.ACTIVE || rundownPlaylist.holdState === RundownHoldState.PENDING) {
				throw new Meteor.Error(403, `Part AdLib-pieces can not be used in combination with hold!`)
			}

			const partInstance = PartInstances.findOne(partInstanceId)
			if (!partInstance) throw new Meteor.Error(404, `PartInstance "${partInstanceId}" not found!`)
			const rundown = Rundowns.findOne(rundownId)
			if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
			if (rundown.playlistId !== rundownPlaylistId) throw new Meteor.Error(406, `Rundown "${rundown._id}" not a part of RundownPlaylist "${rundownPlaylistId}!"`)
			if (partInstance.rundownId !== rundownId) throw new Meteor.Error(406, `PartInstance "${partInstanceId}" not a part of rundown "${rundownId}!"`)

			const adLibPiece = AdLibPieces.findOne({
				_id: adLibPieceId,
				rundownId: rundownId
			})
			if (!adLibPiece) throw new Meteor.Error(404, `Part Ad Lib Item "${adLibPieceId}" not found!`)
			if (adLibPiece.invalid) throw new Meteor.Error(404, `Cannot take invalid Part Ad Lib Item "${adLibPieceId}"!`)
			if (adLibPiece.floated) throw new Meteor.Error(404, `Cannot take floated Part Ad Lib Item "${adLibPieceId}"!`)

			if (!queue && rundownPlaylist.currentPartInstanceId !== partInstanceId) throw new Meteor.Error(403, `Part AdLib-pieces can be only placed in a currently playing part!`)

			innerStartAdLibPiece(rundownPlaylist, rundown, queue, partInstanceId, adLibPiece)
		})
	}
	export function rundownBaselineAdLibPieceStart (rundownPlaylistId: string, rundownId: string, partInstanceId: string, baselineAdLibPieceId: string, queue: boolean) {
		return rundownSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.Playout, () => {
			logger.debug('rundownBaselineAdLibPieceStart')

			const rundownPlaylist = RundownPlaylists.findOne(rundownPlaylistId)
			if (!rundownPlaylist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found!`)
			if (!rundownPlaylist.active) throw new Meteor.Error(403, `Rundown Baseline AdLib-pieces can be only placed in an active rundown!`)
			if (rundownPlaylist.holdState === RundownHoldState.ACTIVE || rundownPlaylist.holdState === RundownHoldState.PENDING) {
				throw new Meteor.Error(403, `Part AdLib-pieces can not be used in combination with hold!`)
			}

			const partInstance = PartInstances.findOne(partInstanceId)
			if (!partInstance) throw new Meteor.Error(404, `PartInstance "${partInstanceId}" not found!`)
			const rundown = Rundowns.findOne(rundownId)
			if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
			if (rundown.playlistId !== rundownPlaylistId) throw new Meteor.Error(406, `Rundown "${rundown._id}" not a part of RundownPlaylist "${rundownPlaylistId}!"`)
			if (partInstance.rundownId !== rundownId) throw new Meteor.Error(406, `PartInstance "${partInstanceId}" not a part of rundown "${rundownId}!"`)

			const adLibPiece = RundownBaselineAdLibPieces.findOne({
				_id: baselineAdLibPieceId,
				rundownId: rundownId
			})
			if (!adLibPiece) throw new Meteor.Error(404, `Rundown Baseline Ad Lib Item "${baselineAdLibPieceId}" not found!`)
			if (!queue && rundownPlaylist.currentPartInstanceId !== partInstanceId) throw new Meteor.Error(403, `Rundown Baseline AdLib-pieces can be only placed in a currently playing part!`)

			innerStartAdLibPiece(rundownPlaylist, rundown, queue, partInstanceId, adLibPiece)
		})
	}
	function innerStartAdLibPiece(rundownPlaylist: RundownPlaylist, rundown: Rundown, queue: boolean, partInstanceId0: string, adLibPiece: AdLibPiece) {
		let partInstanceId = partInstanceId0
		if (queue) {
			// insert a NEW, adlibbed part after this part
			partInstanceId = adlibQueueInsertPartInstance(rundown, partInstanceId, adLibPiece)
		}
		let partInstance = PartInstances.findOne({
			_id: partInstanceId,
			rundownId: rundown._id
		})
		if (!partInstance) throw new Meteor.Error(404, `PartInstance "${partInstanceId}" not found!`)

		const newPieceInstance = convertAdLibToPieceInstance(adLibPiece, partInstance, queue)

		PieceInstances.insert(newPieceInstance)
		// TODO-PartInstance - pending new data flow
		Pieces.insert(newPieceInstance.piece)

		if (queue) {
			// TODO-ASAP - should this not handled by a call to updateInfinites? if not then re-enable
			// keep infinite pieces
			// Pieces.find({ rundownId: rundown._id, partId: orgPartId }).forEach(piece => {
			// 	// console.log(piece.name + ' has life span of ' + piece.infiniteMode)
			// 	if (piece.infiniteMode && piece.infiniteMode >= PieceLifespan.Infinite) {
			// 		let newPiece = convertAdLibToPiece(piece, part!, queue)
			// 		Pieces.insert(newPiece)
			// 	}
			// })

			ServerPlayoutAPI.setNextPartInner(rundownPlaylist, partInstance)
		} else {
			cropInfinitesOnLayer(rundown, partInstance, newPieceInstance)
			stopInfinitesRunningOnLayer(rundown, partInstance, newPieceInstance.piece.sourceLayerId)
			updateTimeline(rundown.studioId)
		}
	}
	function adlibQueueInsertPartInstance (rundown: Rundown, afterPartInstanceId: string, adLibPiece: AdLibPiece) {
		logger.info('adlibQueueInsertPartInstance')

		const afterPartInstance = PartInstances.findOne(afterPartInstanceId)
		if (!afterPartInstance) throw new Meteor.Error(404, `PartInstance "${afterPartInstanceId}" not found!`)

		const newPartInstanceId = Random.id()

		const newPart = literal<DBPart>({
			_id: Random.id(),
			_rank: 99999, // something high, so it will be placed after current part. The rank will be updated later to its correct value
			externalId: '',
			segmentId: afterPartInstance.segmentId,
			rundownId: rundown._id,
			title: adLibPiece.name,
			dynamicallyInserted: true,
			afterPart: afterPartInstance.part.afterPart || afterPartInstance.part._id,
			typeVariant: 'adlib'
		})
		PartInstances.insert({
			_id: newPartInstanceId,
			rundownId: newPart.rundownId,
			segmentId: newPart.segmentId,
			takeCount: afterPartInstance.takeCount + 1,
			part: new Part(newPart)
		})

		// TODO-PartInstance - pending new data flow
		Parts.insert(newPart)

		updatePartRanks(rundown) // place in order

		return newPartInstanceId
	}
	export function stopAdLibPiece (rundownPlaylistId: string, rundownId: string, partInstanceId: string, pieceInstanceId: string) {
		check(rundownPlaylistId, String)
		check(partInstanceId, String)
		check(pieceInstanceId, String)

		throw new Meteor.Error(500, 'So this is actually used? It should be updated then')
		// return rundownSyncFunction(rundownId, RundownSyncFunctionPriority.Playout, () => {
		// 	const rundownPlaylist = RundownPlaylists.findOne(rundownPlaylistId)
		// 	if (!rundownPlaylist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found!`)
		// 	if (!rundownPlaylist.active) throw new Meteor.Error(403, `Part AdLib-copy-pieces can be only manipulated in an active rundown!`)
		// 	if (rundownPlaylist.currentPartId !== partId) throw new Meteor.Error(403, `Part AdLib-copy-pieces can be only manipulated in a current part!`)
		// 	const rundown = Rundowns.findOne(rundownId)
		// 	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)

		// 	const part = Parts.findOne({
		// 		_id: partId,
		// 		rundownId: rundownId
		// 	})
		// 	if (!part) throw new Meteor.Error(404, `Part "${partId}" not found!`)

		// 	const piece = Pieces.findOne({
		// 		_id: pieceId,
		// 		rundownId: rundownId
		// 	})
		// 	if (!piece) throw new Meteor.Error(404, `Part AdLib-copy-piece "${pieceId}" not found!`)
		// 	if (!piece.dynamicallyInserted) throw new Meteor.Error(501, `"${pieceId}" does not appear to be a dynamic Piece!`)
		// 	if (!piece.adLibSourceId) throw new Meteor.Error(501, `"${pieceId}" does not appear to be a Part AdLib-copy-piece!`)

		// 	// To establish playback time, we need to look at the actual Timeline
		// 	const tlObj = Timeline.findOne({
		// 		_id: getPieceGroupId(pieceId)
		// 	})
		// 	if (!tlObj) throw new Meteor.Error(404, `Part AdLib-copy-piece "${pieceId}" not found in the playout Timeline!`)

		// 	// The ad-lib item positioning will be relative to the startedPlayback of the part
		// 	let parentOffset = 0
		// 	if (part.startedPlayback) {
		// 		parentOffset = part.getLastStartedPlayback() || parentOffset
		// 	}

		// 	let newExpectedDuration = 0
		// 	if (piece.startedPlayback) {
		// 		newExpectedDuration = getCurrentTime() - piece.startedPlayback
		// 	} else if (_.isNumber(tlObj.enable.start)) {
		// 		// If start is absolute within the part, we can do a better estimate
		// 		const actualStartTime = parentOffset + tlObj.enable.start
		// 		newExpectedDuration = getCurrentTime() - actualStartTime
		// 	} else {
		// 		logger.warn(`"${pieceId}" timeline object is not positioned absolutely or is still set to play now, assuming it's about to be played.`)
		// 	}

		// 	Pieces.update({
		// 		_id: pieceId
		// 	}, {
		// 		$set: {
		// 			userDuration: {
		// 				duration: newExpectedDuration
		// 			}
		// 		}
		// 	})

		// 	updateTimeline(rundown.studioId)
		// })
	}
}
