import { Meteor } from 'meteor/meteor'
import { check } from 'meteor/check'
import { Random } from 'meteor/random'
import * as _ from 'underscore'
import { SourceLayerType, TimelineObjectCoreExt, PieceLifespan, getPieceGroupId } from 'tv-automation-sofie-blueprints-integration'
import { extendMandadory, getCurrentTime } from '../../../lib/lib'
import { logger } from '../../../lib/logging'
import { Rundowns, RundownHoldState, Rundown } from '../../../lib/collections/Rundowns'
import { Timeline, TimelineObjGeneric, TimelineObjType } from '../../../lib/collections/Timeline'
import { AdLibPieces, AdLibPiece } from '../../../lib/collections/AdLibPieces'
import { RundownBaselineAdLibPieces } from '../../../lib/collections/RundownBaselineAdLibPieces'
import { Pieces, Piece } from '../../../lib/collections/Pieces'
import { Parts } from '../../../lib/collections/Parts'
import { prefixAllObjectIds } from './lib'
import { convertAdLibToPiece, getResolvedPieces } from './pieces'
import { cropInfinitesOnLayer, stopInfinitesRunningOnLayer } from './infinites'
import { updateTimeline } from './timeline'
import { updateParts } from '../rundown'
import { rundownSyncFunction, RundownSyncFunctionPriority } from '../ingest/rundownInput'
import { TriggerType } from 'superfly-timeline'

import { ServerPlayoutAPI } from './playout' // TODO - this should not be calling back like this

export namespace ServerPlayoutAdLibAPI {
	export function pieceTakeNow (rundownId: string, partId: string, pieceId: string) {
		return rundownSyncFunction(rundownId, RundownSyncFunctionPriority.Playout, () => {
			const rundown = Rundowns.findOne(rundownId)
			if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
			if (!rundown.active) throw new Meteor.Error(403, `Part Ad Lib Items can be only placed in an active rundown!`)

			const piece = Pieces.findOne({
				_id: pieceId,
				rundownId: rundownId
			}) as Piece
			if (!piece) throw new Meteor.Error(404, `Piece "${pieceId}" not found!`)

			const part = Parts.findOne({
				_id: partId,
				rundownId: rundownId
			})
			if (!part) throw new Meteor.Error(404, `Part "${partId}" not found!`)
			if (rundown.currentPartId !== part._id) throw new Meteor.Error(403, `Part Ad Lib Items can be only placed in a current part!`)

			const showStyleBase = rundown.getShowStyleBase()
			const sourceL = showStyleBase.sourceLayers.find(i => i._id === piece.sourceLayerId)
			if (sourceL && sourceL.type !== SourceLayerType.GRAPHICS) throw new Meteor.Error(403, `Piece "${pieceId}" is not a GRAPHICS item!`)

			const newPiece = convertAdLibToPiece(piece, part, false)
			if (newPiece.content && newPiece.content.timelineObjects) {
				newPiece.content.timelineObjects = prefixAllObjectIds(
					_.compact(
						_.map(newPiece.content.timelineObjects, (obj) => {
							return extendMandadory<TimelineObjectCoreExt, TimelineObjGeneric>(obj, {
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

			// disable the original piece if from the same SL
			if (piece.partId === part._id) {
				const pieces = getResolvedPieces(part)
				const resPiece = pieces.find(item => item._id === piece._id)

				if (piece.startedPlayback && piece.startedPlayback <= getCurrentTime()) {
					if (resPiece && resPiece.duration !== undefined && (piece.infiniteMode || piece.startedPlayback + resPiece.duration >= getCurrentTime())) {
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
	export function segmentAdLibPieceStart (rundownId: string, partId: string, adLibPieceId: string, queue: boolean) {
		return rundownSyncFunction(rundownId, RundownSyncFunctionPriority.Playout, () => {
			const rundown = Rundowns.findOne(rundownId)
			if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
			if (!rundown.active) throw new Meteor.Error(403, `Part Ad Lib Items can be only placed in an active rundown!`)
			if (rundown.holdState === RundownHoldState.ACTIVE || rundown.holdState === RundownHoldState.PENDING) {
				throw new Meteor.Error(403, `Part Ad Lib Items can not be used in combination with hold!`)
			}
			const adLibPiece = AdLibPieces.findOne({
				_id: adLibPieceId,
				rundownId: rundownId
			})
			if (!adLibPiece) throw new Meteor.Error(404, `Part Ad Lib Item "${adLibPieceId}" not found!`)
			if (adLibPiece.invalid) throw new Meteor.Error(404, `Cannot take invalid Part Ad Lib Item "${adLibPieceId}"!`)

			if (!queue && rundown.currentPartId !== partId) throw new Meteor.Error(403, `Part Ad Lib Items can be only placed in a currently playing part!`)

			innerStartAdLibPiece(rundown, queue, partId, adLibPiece)
		})
	}
	export function rundownBaselineAdLibPieceStart (rundownId: string, partId: string, baselineAdLibPieceId: string, queue: boolean) {
		return rundownSyncFunction(rundownId, RundownSyncFunctionPriority.Playout, () => {
			logger.debug('rundownBaselineAdLibPieceStart')

			const rundown = Rundowns.findOne(rundownId)
			if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
			if (!rundown.active) throw new Meteor.Error(403, `Rundown Baseline Ad Lib Items can be only placed in an active rundown!`)
			if (rundown.holdState === RundownHoldState.ACTIVE || rundown.holdState === RundownHoldState.PENDING) {
				throw new Meteor.Error(403, `Part Ad Lib Items can not be used in combination with hold!`)
			}

			const adLibPiece = RundownBaselineAdLibPieces.findOne({
				_id: baselineAdLibPieceId,
				rundownId: rundownId
			})
			if (!adLibPiece) throw new Meteor.Error(404, `Rundown Baseline Ad Lib Item "${baselineAdLibPieceId}" not found!`)
			if (!queue && rundown.currentPartId !== partId) throw new Meteor.Error(403, `Rundown Baseline Ad Lib Items can be only placed in a currently playing part!`)

			innerStartAdLibPiece(rundown, queue, partId, adLibPiece)
		})
	}
	function innerStartAdLibPiece (rundown: Rundown, queue: boolean, partId: string, adLibPiece: AdLibPiece) {
		let orgPartId = partId
		if (queue) {
			// insert a NEW, adlibbed part after this part
			partId = adlibQueueInsertPart(rundown, partId, adLibPiece)
		}
		let part = Parts.findOne({
			_id: partId,
			rundownId: rundown._id
		})
		if (!part) throw new Meteor.Error(404, `Part "${partId}" not found!`)

		let newPiece = convertAdLibToPiece(adLibPiece, part, queue)
		Pieces.insert(newPiece)

		if (queue) {
			// keep infinite sLineItems
			Pieces.find({ rundownId: rundown._id, partId: orgPartId }).forEach(piece => {
				// console.log(piece.name + ' has life span of ' + piece.infiniteMode)
				if (piece.infiniteMode && piece.infiniteMode >= PieceLifespan.Infinite) {
					let newPiece = convertAdLibToPiece(piece, part!, queue)
					Pieces.insert(newPiece)
				}
			})

			ServerPlayoutAPI.setNextPart(rundown._id, partId)
		} else {
			cropInfinitesOnLayer(rundown, part, newPiece)
			stopInfinitesRunningOnLayer(rundown, part, newPiece.sourceLayerId)
			updateTimeline(rundown.studioId)
		}
	}
	function adlibQueueInsertPart (rundown: Rundown, partId: string, adLibPiece: AdLibPiece) {

		// let parts = rundown.getParts()
		logger.info('adlibQueueInsertPart')

		let part = Parts.findOne(partId)
		if (!part) throw new Meteor.Error(404, `Part "${partId}" not found!`)

		// let nextPart = fetchAfter(Parts, {
		// 	rundownId: rundown._id
		// }, part._rank)

		// let newRank = getRank(part, nextPart, 0, 1)

		let newPartId = Random.id()
		Parts.insert({
			_id: newPartId,
			_rank: 99999, // something high, so it will be placed last
			externalId: '',
			segmentId: part.segmentId,
			rundownId: rundown._id,
			title: adLibPiece.name,
			dynamicallyInserted: true,
			afterPart: part._id,
			typeVariant: 'adlib'
		})

		updateParts(rundown._id) // place in order

		return newPartId
	}
	export function startAdLibPiece (rundownId: string, partId: string, pieceId: string) {
		check(rundownId, String)
		check(partId, String)
		check(pieceId, String)

		return rundownSyncFunction(rundownId, RundownSyncFunctionPriority.Playout, () => {
			const rundown = Rundowns.findOne(rundownId)
			if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
			const part = Parts.findOne({
				_id: partId,
				rundownId: rundownId
			})
			if (!part) throw new Meteor.Error(404, `Part "${partId}" not found!`)
			const alCopyItem = Pieces.findOne({
				_id: pieceId,
				rundownId: rundownId
			})
			// To establish playback time, we need to look at the actual Timeline
			const alCopyItemTObj = Timeline.findOne({
				_id: getPieceGroupId(pieceId)
			})
			let parentOffset = 0
			if (!alCopyItem) throw new Meteor.Error(404, `Part Ad Lib Copy Item "${pieceId}" not found!`)
			if (!alCopyItemTObj) throw new Meteor.Error(404, `Part Ad Lib Copy Item "${pieceId}" not found in the playout Timeline!`)
			if (!rundown.active) throw new Meteor.Error(403, `Part Ad Lib Copy Items can be only manipulated in an active rundown!`)
			if (rundown.currentPartId !== part._id) throw new Meteor.Error(403, `Part Ad Lib Copy Items can be only manipulated in a current part!`)
			if (!alCopyItem.dynamicallyInserted) throw new Meteor.Error(501, `"${pieceId}" does not appear to be a dynamic Piece!`)
			if (!alCopyItem.adLibSourceId) throw new Meteor.Error(501, `"${pieceId}" does not appear to be a Part Ad Lib Copy Item!`)

			// The ad-lib item positioning will be relative to the startedPlayback of the part
			if (part.startedPlayback) {
				parentOffset = part.getLastStartedPlayback() || parentOffset
			}

			let newExpectedDuration = 1 // smallest, non-zerundown duration
			if (alCopyItemTObj.trigger.type === TriggerType.TIME_ABSOLUTE && _.isNumber(alCopyItemTObj.trigger.value)) {
				const actualStartTime = parentOffset + alCopyItemTObj.trigger.value
				newExpectedDuration = getCurrentTime() - actualStartTime
			} else {
				logger.warn(`"${pieceId}" timeline object is not positioned absolutely or is still set to play now, assuming it's about to be played.`)
			}

			Pieces.update({
				_id: pieceId
			}, {
				$set: {
					duration: newExpectedDuration
				}
			})

			updateTimeline(rundown.studioId)
		})
	}
}
