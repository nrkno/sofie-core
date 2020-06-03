import { Meteor } from 'meteor/meteor'
import { Mongo } from 'meteor/mongo'
import { check } from 'meteor/check'
import { Random } from 'meteor/random'
import * as _ from 'underscore'
import { SourceLayerType, TimelineObjectCoreExt, PieceLifespan, getPieceGroupId } from 'tv-automation-sofie-blueprints-integration'
import { extendMandadory, getCurrentTime, literal, waitForPromise, asyncCollectionFindOne, makePromise, asyncCollectionFindFetch } from '../../../lib/lib'
import { logger } from '../../../lib/logging'
import { Rundowns, RundownHoldState, Rundown } from '../../../lib/collections/Rundowns'
import { Timeline, TimelineObjGeneric, TimelineObjType } from '../../../lib/collections/Timeline'
import { AdLibPieces, AdLibPiece } from '../../../lib/collections/AdLibPieces'
import { RundownBaselineAdLibPieces } from '../../../lib/collections/RundownBaselineAdLibPieces'
import { Pieces, Piece } from '../../../lib/collections/Pieces'
import { Parts } from '../../../lib/collections/Parts'
import { prefixAllObjectIds } from './lib'
import { convertAdLibToPiece, getResolvedPieces, convertPieceToAdLibPiece } from './pieces'
import { cropInfinitesOnLayer, stopInfinitesRunningOnLayer, updateSourceLayerInfinitesAfterPart } from './infinites'
import { updateTimeline } from './timeline'
import { updatePartRanks, afterRemoveParts } from '../rundown'
import { rundownSyncFunction, RundownSyncFunctionPriority } from '../ingest/rundownInput'

import { ServerPlayoutAPI } from './playout' // TODO - this should not be calling back like this
import { ShowStyleBases } from '../../../lib/collections/ShowStyleBases'

export namespace ServerPlayoutAdLibAPI {
	export function pieceTakeNow (rundownId: string, partId: string, pieceId: string) {
		return rundownSyncFunction(rundownId, RundownSyncFunctionPriority.Playout, () => {
			const rundown = Rundowns.findOne(rundownId)
			if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
			if (!rundown.active) throw new Meteor.Error(403, `Part AdLib-pieces can be only placed in an active rundown!`)

			const pPiece = asyncCollectionFindOne(Pieces, {
				_id: pieceId,
				rundownId: rundownId
			})
			const pPart = asyncCollectionFindOne(Parts, {
				_id: partId,
				rundownId: rundownId
			})
			const pShowStyleBase = makePromise(() => rundown.getShowStyleBase())

			const piece = waitForPromise(pPiece)
			const part = waitForPromise(pPart)
			const showStyleBase = waitForPromise(pShowStyleBase)

			if (!piece) throw new Meteor.Error(404, `Piece "${pieceId}" not found!`)
			if (!part) throw new Meteor.Error(404, `Part "${partId}" not found!`)
			if (rundown.currentPartId !== part._id) throw new Meteor.Error(403, `Part AdLib-pieces can be only placed in a current part!`)

			const sourceL = showStyleBase.sourceLayers.find(i => i._id === piece.sourceLayerId)
			if (sourceL && sourceL.type !== SourceLayerType.GRAPHICS) throw new Meteor.Error(403, `Piece "${pieceId}" is not a GRAPHICS item!`)

			const newPiece = convertAdLibToPiece(piece, part, false, 'now')
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
	export function segmentAdLibPieceStart (rundownId: string, partId: string, adLibPieceId: string, queue: boolean) {
		return rundownSyncFunction(rundownId, RundownSyncFunctionPriority.Playout, () => {
			const rundown = Rundowns.findOne(rundownId)
			if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
			if (!rundown.active) throw new Meteor.Error(403, `Part AdLib-pieces can be only placed in an active rundown!`)
			if (rundown.holdState === RundownHoldState.ACTIVE || rundown.holdState === RundownHoldState.PENDING) {
				throw new Meteor.Error(403, `Part AdLib-pieces can not be used in combination with hold!`)
			}
			const adLibPiece = AdLibPieces.findOne({
				_id: adLibPieceId,
				rundownId: rundownId
			})
			if (!adLibPiece) throw new Meteor.Error(404, `Part Ad Lib Item "${adLibPieceId}" not found!`)
			if (adLibPiece.invalid) throw new Meteor.Error(404, `Cannot take invalid Part Ad Lib Item "${adLibPieceId}"!`)

			if (!queue && rundown.currentPartId !== partId) throw new Meteor.Error(403, `Part AdLib-pieces can be only placed in a currently playing part!`)

			innerStartAdLibPiece(rundown, queue, partId, adLibPiece)
		})
	}
	export function rundownBaselineAdLibPieceStart (rundownId: string, partId: string, baselineAdLibPieceId: string, queue: boolean) {
		return rundownSyncFunction(rundownId, RundownSyncFunctionPriority.Playout, () => {
			logger.debug('rundownBaselineAdLibPieceStart')

			const rundown = Rundowns.findOne(rundownId)
			if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
			if (!rundown.active) throw new Meteor.Error(403, `Rundown Baseline AdLib-pieces can be only placed in an active rundown!`)
			if (rundown.holdState === RundownHoldState.ACTIVE || rundown.holdState === RundownHoldState.PENDING) {
				throw new Meteor.Error(403, `Part AdLib-pieces can not be used in combination with hold!`)
			}

			const adLibPiece = RundownBaselineAdLibPieces.findOne({
				_id: baselineAdLibPieceId,
				rundownId: rundownId
			})
			if (!adLibPiece) throw new Meteor.Error(404, `Rundown Baseline Ad Lib Item "${baselineAdLibPieceId}" not found!`)
			if (!queue && rundown.currentPartId !== partId) throw new Meteor.Error(403, `Rundown Baseline AdLib-pieces can be only placed in a currently playing part!`)
			innerStartAdLibPiece(rundown, queue, partId, adLibPiece)
		})
	}
	function innerStartAdLibPiece (rundown: Rundown, queue: boolean, partId: string, adLibPiece: AdLibPiece) {
		if (adLibPiece.toBeQueued) {
			// Allow adlib to request to always be queued
			queue = true
		}

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

		let nextPart = rundown.nextPartId && rundown.nextPartId !== partId ? Parts.findOne({
			_id: rundown.nextPartId,
			rundownId: rundown._id
		}) : undefined

		let pieceStart: number | 'now' = queue ? 0 : 'now'
		// HACK WARNING: Temporary 'fix' to insert adlibs to the next part if it is a dve and the current one is not.
		// This will soon get a better way to make this decision
		if (!queue && nextPart && part && adLibPiece.sourceLayerId.match(/dve_box/)) {
			// Find any core dve pieces
			const dvePieces = Pieces.find({
				rundownId: rundown._id,
				partId: { $in: [ part._id, nextPart._id ] },
				sourceLayerId: /dve(?!_box|_back)/i // dve layers but not dve_box layers
			}).fetch()
			const partIds = dvePieces.map(p => p.partId)

			// If only next says it is a dve and not current
			if (partIds.indexOf(nextPart._id) !== -1 && partIds.indexOf(part._id) === -1) {
				part = nextPart
				pieceStart = 0

				// Ensure any previous adlibs are pruned first
				Pieces.remove({
					partId: part._id,
					rundownId: rundown._id,
					'enable.start': 0,
					dynamicallyInserted: true,
					sourceLayerId: adLibPiece.sourceLayerId
				})
			}
		}

		let newPiece = convertAdLibToPiece(adLibPiece, part, queue, pieceStart)
		Pieces.insert(newPiece)

		if (queue) {
			// Remove pieces that are in the same exclusivity group / source layer, if parts have been merged
			if (adLibPiece.canCombineQueue && part.canCombineQueue) {
				const showStyle = ShowStyleBases.findOne({ _id: rundown.showStyleBaseId })
				if (!showStyle) throw new Meteor.Error(`Could not find showstyle base with Id "${rundown.showStyleBaseId}"`)

				const adlibPieceSourceLayer = showStyle.sourceLayers.find((layer) => layer._id === adLibPiece.sourceLayerId)
				if (!adlibPieceSourceLayer) throw new Meteor.Error(`Could not find source layer "${adLibPiece.sourceLayerId}" for piece with Id "${adLibPiece._id}"`)

				const pieces = Pieces.find({
					_id: { $ne: newPiece._id },
					partId
				})

				pieces.forEach(piece => {
					const sourceLayer = showStyle.sourceLayers.find((layer) => layer._id === piece.sourceLayerId)
					if (!sourceLayer) throw new Meteor.Error(`Could not find source layer "${piece.sourceLayerId}" for piece with Id "${piece._id}"`)

					if (
						adLibPiece.sourceLayerId === piece.sourceLayerId ||
						(
							sourceLayer.exclusiveGroup &&
							adlibPieceSourceLayer.exclusiveGroup &&
							sourceLayer.exclusiveGroup === adlibPieceSourceLayer.exclusiveGroup
						)
					) {
						Pieces.remove({ _id: piece._id })
					}
				})

				/** HACK: Remove when adlib actions exist */
				if (adLibPiece.additionalPieces) {
					adLibPiece.additionalPieces.forEach(adlib => {
						const extraPiece = convertAdLibToPiece({ ...adLibPiece, ...adlib }, part!, queue, pieceStart)
						Pieces.insert(extraPiece)

						const pieces = Pieces.find({
							_id: { $ne: extraPiece._id },
							partId
						})

						const adlibPieceSourceLayer = showStyle.sourceLayers.find((layer) => layer._id === extraPiece.sourceLayerId)
						if (!adlibPieceSourceLayer) throw new Meteor.Error(`Could not find source layer "${extraPiece.sourceLayerId}" for piece with Id "${extraPiece._id}"`)

						pieces.forEach(piece => {
							const sourceLayer = showStyle.sourceLayers.find((layer) => layer._id === piece.sourceLayerId)
							if (!sourceLayer) throw new Meteor.Error(`Could not find source layer "${piece.sourceLayerId}" for piece with Id "${piece._id}"`)

							if (
								extraPiece.sourceLayerId === piece.sourceLayerId ||
								(
									sourceLayer.exclusiveGroup &&
									adlibPieceSourceLayer.exclusiveGroup &&
									sourceLayer.exclusiveGroup === adlibPieceSourceLayer.exclusiveGroup
								)
							) {
								Pieces.remove({ _id: piece._id })
							}
						})
					})
				}
			}

			// Copy across adlib-preroll and other properties needed on the part
			if (newPiece.adlibPreroll !== undefined) {
				Parts.update(partId, {
					$set: {
						prerollDuration: newPiece.adlibPreroll
					}
				})
			}

			if (newPiece.adlibAutoNext !== undefined) {
				Parts.update(partId, {
					$set: {
						autoNext: newPiece.adlibAutoNext
					}
				})
			}

			if (newPiece.adlibAutoNextOverlap !== undefined) {
				Parts.update(partId, {
					$set: {
						autoNextOverlap: newPiece.adlibAutoNextOverlap
					}
				})
			}

			if (newPiece.adlibDisableOutTransition !== undefined) {
				Parts.update(partId, {
					$set: {
						disableOutTransition: newPiece.adlibDisableOutTransition
					}
				})
			}

			if (adLibPiece.expectedDuration !== undefined) {
				Parts.update(partId, {
					$set: {
						expectedDuration: adLibPiece.expectedDuration
					}
				})
			}

			ServerPlayoutAPI.setNextPartInner(rundown, partId, undefined, undefined, true)
		}

		updateSourceLayerInfinitesAfterPart(rundown)
		cropInfinitesOnLayer(rundown, part, newPiece)
		stopInfinitesRunningOnLayer(rundown, part, newPiece.sourceLayerId)
		updateTimeline(rundown.studioId)
	}
	function adlibQueueInsertPart (rundown: Rundown, partId: string, adLibPiece: AdLibPiece) {
		const part = Parts.findOne(partId)
		if (!part) throw new Meteor.Error(404, `Part "${partId}" not found!`)

		const afterPartId = part.afterPart || part._id

		// check if there's already a queued part after this:
		const alreadyQueuedPart = Parts.findOne({
			rundownId: rundown._id,
			segmentId: part.segmentId,
			afterPart: afterPartId,
			_rank: { $gt: part._rank }
		}, {
			sort: { _rank: -1, _id: -1 }
		})
		if (alreadyQueuedPart && (!adLibPiece.canCombineQueue || !alreadyQueuedPart.canCombineQueue)) {
			if (rundown.currentPartId !== alreadyQueuedPart._id) {
				Parts.remove(alreadyQueuedPart._id)
				afterRemoveParts(rundown, [alreadyQueuedPart], true)
			}
		}

		let newPartId = Random.id()

		if (alreadyQueuedPart && adLibPiece.canCombineQueue && alreadyQueuedPart.canCombineQueue) {
			newPartId = alreadyQueuedPart._id
		} else {
			Parts.insert({
				_id: newPartId,
				_rank: 99999, // something high, so it will be placed last
				externalId: '',
				segmentId: part.segmentId,
				rundownId: rundown._id,
				title: adLibPiece.name,
				dynamicallyInserted: true,
				afterPart: afterPartId,
				typeVariant: 'adlib',
				expectedDuration: adLibPiece.expectedDuration,
				canCombineQueue: adLibPiece.canCombineQueue
			})
		}

		updatePartRanks(rundown._id) // place in order

		return newPartId
	}
	export function stopAdLibPiece (rundownId: string, partId: string, pieceId: string) {
		check(rundownId, String)
		check(partId, String)
		check(pieceId, String)

		return rundownSyncFunction(rundownId, RundownSyncFunctionPriority.Playout, () => {
			const rundown = Rundowns.findOne(rundownId)
			if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
			if (!rundown.active) throw new Meteor.Error(403, `Part AdLib-copy-pieces can be only manipulated in an active rundown!`)
			if (rundown.currentPartId !== partId) throw new Meteor.Error(403, `Part AdLib-copy-pieces can be only manipulated in a current part!`)

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
	export function sourceLayerStickyPieceStart (rundownId: string, sourceLayerId: string) {
		return rundownSyncFunction(rundownId, RundownSyncFunctionPriority.Playout, () => {
			const rundown = Rundowns.findOne(rundownId)
			if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
			if (!rundown.active) throw new Meteor.Error(403, `Pieces can be only manipulated in an active rundown!`)
			if (!rundown.currentPartId) throw new Meteor.Error(400, `A part needs to be active to place a sticky item`)

			let showStyleBase = rundown.getShowStyleBase()

			const sourceLayer = showStyleBase.sourceLayers.find(i => i._id === sourceLayerId)
			if (!sourceLayer) throw new Meteor.Error(404, `Source layer "${sourceLayerId}" not found!`)
			if (!sourceLayer.isSticky) throw new Meteor.Error(400, `Only sticky layers can be restarted. "${sourceLayerId}" is not sticky.`)

			const query = literal<Mongo.Query<Piece>>({
				rundownId: rundown._id,
				sourceLayerId: sourceLayer._id,
				startedPlayback: {
					$exists: true
				}
			})

			if (sourceLayer.stickyOriginalOnly) {
				// Ignore adlibs if using original only
				query.adLibSourceId = {
					$exists: false
				}
			}

			const lastPieces = Pieces.find(query, {
				sort: {
					startedPlayback: -1
				},
				limit: 1
			}).fetch()

			if (lastPieces.length > 0) {
				const currentPart = Parts.findOne(rundown.currentPartId)
				if (!currentPart) throw new Meteor.Error(501, `Current Part "${rundown.currentPartId}" could not be found.`)

				const lastPiece = convertPieceToAdLibPiece(lastPieces[0])
				innerStartAdLibPiece(rundown, false, rundown.currentPartId, lastPiece)
			}
		})
	}
}
