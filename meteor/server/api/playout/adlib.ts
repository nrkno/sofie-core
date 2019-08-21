import { Meteor } from 'meteor/meteor'
import { check } from 'meteor/check'
import { Random } from 'meteor/random'
import * as _ from 'underscore'
import { SourceLayerType, TimelineObjectCoreExt, PieceLifespan, getPieceGroupId } from 'tv-automation-sofie-blueprints-integration'
import { extendMandadory, getCurrentTime, literal } from '../../../lib/lib'
import { logger } from '../../../lib/logging'
import { Rundowns, RundownHoldState, Rundown } from '../../../lib/collections/Rundowns'
import { Timeline, TimelineObjGeneric, TimelineObjType } from '../../../lib/collections/Timeline'
import { AdLibPieces, AdLibPiece } from '../../../lib/collections/AdLibPieces'
import { RundownBaselineAdLibPieces } from '../../../lib/collections/RundownBaselineAdLibPieces'
import { RundownPlaylists, RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { Pieces, Piece } from '../../../lib/collections/Pieces'
import { Parts } from '../../../lib/collections/Parts'
import { prefixAllObjectIds } from './lib'
import { convertAdLibToPiece, getResolvedPieces } from './pieces'
import { cropInfinitesOnLayer, stopInfinitesRunningOnLayer } from './infinites'
import { updateTimeline } from './timeline'
import { updatePartRanks } from '../rundown'
import { rundownSyncFunction, RundownSyncFunctionPriority } from '../ingest/rundownInput'

import { ServerPlayoutAPI } from './playout' // TODO - this should not be calling back like this

export namespace ServerPlayoutAdLibAPI {
	export function pieceTakeNow (rundownPlaylistId: string, partId: string, pieceId: string) {
		return rundownSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.Playout, () => {
			const rundownPlaylists = RundownPlaylists.findOne(rundownPlaylistId)
			if (!rundownPlaylists) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found!`)
			if (!rundownPlaylists.active) throw new Meteor.Error(403, `Part AdLib-pieces can be only placed in an active rundown!`)

			const piece = Pieces.findOne({
				_id: pieceId,
			}) as Piece
			if (!piece) throw new Meteor.Error(404, `Piece "${pieceId}" not found!`)

			const part = Parts.findOne({
				_id: partId,
			})
			if (!part) throw new Meteor.Error(404, `Part "${partId}" not found!`)
			if (rundownPlaylists.currentPartId !== part._id) throw new Meteor.Error(403, `Part AdLib-pieces can be only placed in a current part!`)

			const rundown = Rundowns.findOne(part.rundownId)
			if (!rundown) throw new Meteor.Error(404, `rundown "${part.rundownId}" not found!`)

			const showStyleBase = rundown.getShowStyleBase()
			const sourceL = showStyleBase.sourceLayers.find(i => i._id === piece.sourceLayerId)
			if (sourceL && sourceL.type !== SourceLayerType.GRAPHICS) throw new Meteor.Error(403, `Piece "${pieceId}" is not a GRAPHICS item!`)

			const newPiece = convertAdLibToPiece(piece, part, false)
			if (newPiece.content && newPiece.content.timelineObjects) {
				newPiece.content.timelineObjects = prefixAllObjectIds(
					_.compact(
						_.map(newPiece.content.timelineObjects, (obj) => {
							return literal<TimelineObjGeneric>({
								...obj,
								// @ts-ignore _id
								_id: obj.id || obj._id,
								studioId: '', // set later
								objectType: TimelineObjType.RUNDOWN
							})
						})
					),
					newPiece._id
				)
			}

			// Disable the original piece if from the same Part
			if (piece.partId === part._id) {
				const pieces = getResolvedPieces(part)
				const resPiece = pieces.find(p => p._id === piece._id)

				if (piece.startedPlayback && piece.startedPlayback <= getCurrentTime()) {
					if (
						resPiece &&
						resPiece.playoutDuration !== undefined &&
						(
							piece.infiniteMode ||
							piece.startedPlayback + resPiece.playoutDuration >= getCurrentTime()
						)
					) {
						// logger.debug(`Piece "${piece._id}" is currently live and cannot be used as an ad-lib`)
						throw new Meteor.Error(409, `Piece "${piece._id}" is currently live and cannot be used as an ad-lib`)
					}
				}

				Pieces.update(piece._id, {$set: {
					disabled: true,
					hidden: true
				}})
			}
			Pieces.insert(newPiece)

			cropInfinitesOnLayer(rundown, part, newPiece)
			stopInfinitesRunningOnLayer(rundown, part, newPiece.sourceLayerId)
			updateTimeline(rundown.studioId)
		})
	}
	export function segmentAdLibPieceStart (rundownPlaylistId: string, rundownId: string, partId: string, adLibPieceId: string, queue: boolean) {
		return rundownSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.Playout, () => {
			const rundownPlaylist = RundownPlaylists.findOne(rundownPlaylistId)
			if (!rundownPlaylist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found!`)
			if (!rundownPlaylist.active) throw new Meteor.Error(403, `Part AdLib-pieces can be only placed in an active rundown!`)
			if (rundownPlaylist.holdState === RundownHoldState.ACTIVE || rundownPlaylist.holdState === RundownHoldState.PENDING) {
				throw new Meteor.Error(403, `Part AdLib-pieces can not be used in combination with hold!`)
			}
			const part = Parts.findOne(partId)
			if (!part) throw new Meteor.Error(404, `Part "${partId}" not found!`)
			const rundown = Rundowns.findOne(rundownId)
			if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
			if (part.rundownId !== rundownId) throw new Meteor.Error(406, `Part "${partId}" not a part of rundown "${rundownId}!"`)
			const adLibPiece = AdLibPieces.findOne({
				_id: adLibPieceId,
				rundownId: part.rundownId
			})
			if (!adLibPiece) throw new Meteor.Error(404, `Part Ad Lib Item "${adLibPieceId}" not found!`)
			if (adLibPiece.invalid) throw new Meteor.Error(404, `Cannot take invalid Part Ad Lib Item "${adLibPieceId}"!`)

			if (!queue && rundownPlaylist.currentPartId !== partId) throw new Meteor.Error(403, `Part AdLib-pieces can be only placed in a currently playing part!`)

			innerStartAdLibPiece(rundownPlaylist, rundown, queue, partId, adLibPiece)
		})
	}
	export function rundownBaselineAdLibPieceStart (rundownPlaylistId: string, rundownId: string, partId: string, baselineAdLibPieceId: string, queue: boolean) {
		return rundownSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.Playout, () => {
			logger.debug('rundownBaselineAdLibPieceStart')

			const rundownPlaylist = RundownPlaylists.findOne(rundownPlaylistId)
			if (!rundownPlaylist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found!`)
			if (!rundownPlaylist.active) throw new Meteor.Error(403, `Rundown Baseline AdLib-pieces can be only placed in an active rundown!`)
			if (rundownPlaylist.holdState === RundownHoldState.ACTIVE || rundownPlaylist.holdState === RundownHoldState.PENDING) {
				throw new Meteor.Error(403, `Part AdLib-pieces can not be used in combination with hold!`)
			}
			const part = Parts.findOne(partId)
			if (!part) throw new Meteor.Error(404, `Part "${partId}" not found!`)
			const rundown = Rundowns.findOne(rundownId)
			if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
			if (part.rundownId !== rundownId) throw new Meteor.Error(406, `Part "${partId}" not a part of rundown "${rundownId}!"`)
			const adLibPiece = RundownBaselineAdLibPieces.findOne({
				_id: baselineAdLibPieceId,
				rundownId: part.rundownId
			})
			if (!adLibPiece) throw new Meteor.Error(404, `Rundown Baseline Ad Lib Item "${baselineAdLibPieceId}" not found!`)
			if (!queue && rundownPlaylist.currentPartId !== partId) throw new Meteor.Error(403, `Rundown Baseline AdLib-pieces can be only placed in a currently playing part!`)

			innerStartAdLibPiece(rundownPlaylist, rundown, queue, partId, adLibPiece)
		})
	}
	function innerStartAdLibPiece(rundownPlaylist: RundownPlaylist, rundown: Rundown, queue: boolean, partId: string, adLibPiece: AdLibPiece) {
		let orgPartId = partId
		if (queue) {
			// insert a NEW, adlibbed part after this part
			partId = adlibQueueInsertPart(rundownPlaylist, rundown, partId, adLibPiece)
		}
		let part = Parts.findOne({
			_id: partId,
			rundownId: rundown._id
		})
		if (!part) throw new Meteor.Error(404, `Part "${partId}" not found!`)

		let newPiece = convertAdLibToPiece(adLibPiece, part, queue)
		Pieces.insert(newPiece)

		if (queue) {
			// keep infinite pieces
			Pieces.find({ rundownId: rundown._id, partId: orgPartId }).forEach(piece => {
				// console.log(piece.name + ' has life span of ' + piece.infiniteMode)
				if (piece.infiniteMode && piece.infiniteMode >= PieceLifespan.Infinite) {
					let newPiece = convertAdLibToPiece(piece, part!, queue)
					Pieces.insert(newPiece)
				}
			})

			ServerPlayoutAPI.setNextPartInner(rundownPlaylist, partId)
		} else {
			cropInfinitesOnLayer(rundown, part, newPiece)
			stopInfinitesRunningOnLayer(rundown, part, newPiece.sourceLayerId)
			updateTimeline(rundown.studioId)
		}
	}
	function adlibQueueInsertPart (rundownPlaylist: RundownPlaylist, rundown: Rundown, partId: string, adLibPiece: AdLibPiece) {
		logger.info('adlibQueueInsertPart')

		const part = Parts.findOne(partId)
		if (!part) throw new Meteor.Error(404, `Part "${partId}" not found!`)

		const newPartId = Random.id()
		Parts.insert({
			_id: newPartId,
			_rank: 99999, // something high, so it will be placed last
			externalId: '',
			segmentId: part.segmentId,
			rundownId: rundown._id,
			title: adLibPiece.name,
			dynamicallyInserted: true,
			afterPart: part.afterPart || part._id,
			typeVariant: 'adlib'
		})

		updatePartRanks(rundown._id) // place in order

		return newPartId
	}
	export function stopAdLibPiece (rundownPlaylistId: string, rundownId: string, partId: string, pieceId: string) {
		check(rundownId, String)
		check(partId, String)
		check(pieceId, String)

		return rundownSyncFunction(rundownId, RundownSyncFunctionPriority.Playout, () => {
			const rundownPlaylist = RundownPlaylists.findOne(rundownPlaylistId)
			if (!rundownPlaylist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found!`)
			if (!rundownPlaylist.active) throw new Meteor.Error(403, `Part AdLib-copy-pieces can be only manipulated in an active rundown!`)
			if (rundownPlaylist.currentPartId !== partId) throw new Meteor.Error(403, `Part AdLib-copy-pieces can be only manipulated in a current part!`)
			const rundown = Rundowns.findOne(rundownId)
			if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)

			const part = Parts.findOne({
				_id: partId,
				rundownId: rundownId
			})
			if (!part) throw new Meteor.Error(404, `Part "${partId}" not found!`)

			const piece = Pieces.findOne({
				_id: pieceId,
				rundownId: rundownId
			})
			if (!piece) throw new Meteor.Error(404, `Part AdLib-copy-piece "${pieceId}" not found!`)
			if (!piece.dynamicallyInserted) throw new Meteor.Error(501, `"${pieceId}" does not appear to be a dynamic Piece!`)
			if (!piece.adLibSourceId) throw new Meteor.Error(501, `"${pieceId}" does not appear to be a Part AdLib-copy-piece!`)

			// To establish playback time, we need to look at the actual Timeline
			const tlObj = Timeline.findOne({
				_id: getPieceGroupId(pieceId)
			})
			if (!tlObj) throw new Meteor.Error(404, `Part AdLib-copy-piece "${pieceId}" not found in the playout Timeline!`)

			// The ad-lib item positioning will be relative to the startedPlayback of the part
			let parentOffset = 0
			if (part.startedPlayback) {
				parentOffset = part.getLastStartedPlayback() || parentOffset
			}

			let newExpectedDuration = 0
			if (piece.startedPlayback) {
				newExpectedDuration = getCurrentTime() - piece.startedPlayback
			} else if (_.isNumber(tlObj.enable.start)) {
				// If start is absolute within the part, we can do a better estimate
				const actualStartTime = parentOffset + tlObj.enable.start
				newExpectedDuration = getCurrentTime() - actualStartTime
			} else {
				logger.warn(`"${pieceId}" timeline object is not positioned absolutely or is still set to play now, assuming it's about to be played.`)
			}

			Pieces.update({
				_id: pieceId
			}, {
				$set: {
					userDuration: {
						duration: newExpectedDuration
					}
				}
			})

			updateTimeline(rundown.studioId)
		})
	}
}
