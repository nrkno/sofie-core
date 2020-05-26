import { Meteor } from 'meteor/meteor'
import { Mongo } from 'meteor/mongo'
import { check } from 'meteor/check'
import { Random } from 'meteor/random'
import * as _ from 'underscore'
import { SourceLayerType } from 'tv-automation-sofie-blueprints-integration'
import { getCurrentTime, literal, protectString, unprotectString, getRandomId } from '../../../lib/lib'
import { logger } from '../../../lib/logging'
import { Rundowns, RundownHoldState, Rundown } from '../../../lib/collections/Rundowns'
import { TimelineObjGeneric, TimelineObjType } from '../../../lib/collections/Timeline'
import { AdLibPieces, AdLibPiece } from '../../../lib/collections/AdLibPieces'
import { RundownBaselineAdLibPieces } from '../../../lib/collections/RundownBaselineAdLibPieces'
import { RundownPlaylists, RundownPlaylist, RundownPlaylistId } from '../../../lib/collections/RundownPlaylists'
import { Pieces, Piece, PieceId } from '../../../lib/collections/Pieces'
import { Parts, Part, DBPart } from '../../../lib/collections/Parts'
import { prefixAllObjectIds, setNextPart, getPartBeforeSegment, getPreviousPart } from './lib'
import { cropInfinitesOnLayer, stopInfinitesRunningOnLayer, updateSourceLayerInfinitesAfterPart } from './infinites'
import { convertAdLibToPieceInstance, getResolvedPieces, convertPieceToAdLibPiece } from './pieces'
import { updateTimeline } from './timeline'
import { updatePartRanks, afterRemoveParts } from '../rundown'
import { rundownPlaylistSyncFunction, RundownSyncFunctionPriority } from '../ingest/rundownInput'

import { PieceInstances, PieceInstance, PieceInstanceId } from '../../../lib/collections/PieceInstances'
import { PartInstances, PartInstance, PartInstanceId } from '../../../lib/collections/PartInstances'

export namespace ServerPlayoutAdLibAPI {
	export function pieceTakeNow (rundownPlaylistId: RundownPlaylistId, partInstanceId: PartInstanceId, pieceInstanceIdOrPieceIdToCopy: PieceInstanceId | PieceId) {
		return rundownPlaylistSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.USER_PLAYOUT, () => {
			const rundownPlaylist = RundownPlaylists.findOne(rundownPlaylistId)
			if (!rundownPlaylist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found!`)
			if (!rundownPlaylist.active) throw new Meteor.Error(403, `Part AdLib-pieces can be only placed in an active rundown!`)
			if (rundownPlaylist.currentPartInstanceId !== partInstanceId) throw new Meteor.Error(403, `Part AdLib-pieces can be only placed in a current part!`)

			const pieceInstanceToCopy = PieceInstances.findOne(pieceInstanceIdOrPieceIdToCopy)
			const pieceToCopy = pieceInstanceToCopy ? pieceInstanceToCopy.piece : Pieces.findOne(pieceInstanceIdOrPieceIdToCopy) as Piece
			if (!pieceToCopy) {
				throw new Meteor.Error(404, `PieceInstance or Piece "${pieceInstanceIdOrPieceIdToCopy}" not found!`)
			}

			const partInstance = PartInstances.findOne(partInstanceId)
			if (!partInstance) throw new Meteor.Error(404, `PartInstance "${partInstanceId}" not found!`)

			const rundown = Rundowns.findOne(partInstance.rundownId)
			if (!rundown) throw new Meteor.Error(404, `Rundown "${partInstance.rundownId}" not found!`)

			const showStyleBase = rundown.getShowStyleBase()
			const sourceL = showStyleBase.sourceLayers.find(i => i._id === pieceToCopy.sourceLayerId)
			if (sourceL && sourceL.type !== SourceLayerType.GRAPHICS) throw new Meteor.Error(403, `PieceInstance or Piece "${pieceInstanceIdOrPieceIdToCopy}" is not a GRAPHICS item!`)

			const newPieceInstance = convertAdLibToPieceInstance(pieceToCopy, partInstance, false)
			if (newPieceInstance.piece.content && newPieceInstance.piece.content.timelineObjects) {
				newPieceInstance.piece.content.timelineObjects = prefixAllObjectIds(
					_.compact(
						_.map(newPieceInstance.piece.content.timelineObjects, (obj) => {
							return literal<TimelineObjGeneric>({
								...obj,
								// @ts-ignore _id
								_id: obj.id || obj._id,
								studioId: protectString(''), // set later
								objectType: TimelineObjType.RUNDOWN
							})
						})
					),
					unprotectString(newPieceInstance._id)
				)
			}

			// Disable the original piece if from the same Part
			if (pieceInstanceToCopy && pieceInstanceToCopy.partInstanceId === partInstance._id) {
				const pieces = getResolvedPieces(partInstance)
				const resolvedPieceBeingCopied = pieces.find(p => p._id === pieceInstanceToCopy._id)

				// Ensure the piece being copied isnt currently live
				if (pieceInstanceToCopy.piece.startedPlayback && pieceInstanceToCopy.piece.startedPlayback <= getCurrentTime()) {
					if (
						resolvedPieceBeingCopied &&
						resolvedPieceBeingCopied.piece.playoutDuration !== undefined &&
						(
							pieceInstanceToCopy.piece.infiniteMode ||
							pieceInstanceToCopy.piece.startedPlayback + resolvedPieceBeingCopied.piece.playoutDuration >= getCurrentTime()
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
			stopInfinitesRunningOnLayer(rundownPlaylist, rundown, partInstance, newPieceInstance.piece.sourceLayerId)
			updateTimeline(rundown.studioId)
		})
	}
	export function segmentAdLibPieceStart (rundownPlaylistId: RundownPlaylistId, partInstanceId: PartInstanceId, adLibPieceId: PieceId, queue: boolean) {
		return rundownPlaylistSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.USER_PLAYOUT, () => {
			const rundownPlaylist = RundownPlaylists.findOne(rundownPlaylistId)
			if (!rundownPlaylist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found!`)
			if (!rundownPlaylist.active) throw new Meteor.Error(403, `Part AdLib-pieces can be only placed in an active rundown!`)
			if (rundownPlaylist.holdState === RundownHoldState.ACTIVE || rundownPlaylist.holdState === RundownHoldState.PENDING) {
				throw new Meteor.Error(403, `Part AdLib-pieces can not be used in combination with hold!`)
			}

			const partInstance = PartInstances.findOne(partInstanceId)
			if (!partInstance) throw new Meteor.Error(404, `PartInstance "${partInstanceId}" not found!`)
			const rundown = Rundowns.findOne(partInstance.rundownId)
			if (!rundown) throw new Meteor.Error(404, `Rundown "${partInstance.rundownId}" not found!`)
			if (rundown.playlistId !== rundownPlaylistId) throw new Meteor.Error(406, `Rundown "${rundown._id}" not a part of RundownPlaylist "${rundownPlaylistId}!"`)

			const adLibPiece = AdLibPieces.findOne({
				_id: adLibPieceId,
				rundownId: partInstance.rundownId
			})
			if (!adLibPiece) throw new Meteor.Error(404, `Part Ad Lib Item "${adLibPieceId}" not found!`)
			if (adLibPiece.invalid) throw new Meteor.Error(404, `Cannot take invalid Part Ad Lib Item "${adLibPieceId}"!`)
			if (adLibPiece.floated) throw new Meteor.Error(404, `Cannot take floated Part Ad Lib Item "${adLibPieceId}"!`)

			if (!queue && rundownPlaylist.currentPartInstanceId !== partInstanceId) throw new Meteor.Error(403, `Part AdLib-pieces can be only placed in a currently playing part!`)

			innerStartAdLibPiece(rundownPlaylist, rundown, queue, partInstanceId, adLibPiece)
		})
	}
	export function rundownBaselineAdLibPieceStart (rundownPlaylistId: RundownPlaylistId, partInstanceId: PartInstanceId, baselineAdLibPieceId: PieceId, queue: boolean) {
		return rundownPlaylistSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.USER_PLAYOUT, () => {
			logger.debug('rundownBaselineAdLibPieceStart')

			const rundownPlaylist = RundownPlaylists.findOne(rundownPlaylistId)
			if (!rundownPlaylist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found!`)
			if (!rundownPlaylist.active) throw new Meteor.Error(403, `Rundown Baseline AdLib-pieces can be only placed in an active rundown!`)
			if (rundownPlaylist.holdState === RundownHoldState.ACTIVE || rundownPlaylist.holdState === RundownHoldState.PENDING) {
				throw new Meteor.Error(403, `Part AdLib-pieces can not be used in combination with hold!`)
			}

			const partInstance = PartInstances.findOne(partInstanceId)
			if (!partInstance) throw new Meteor.Error(404, `PartInstance "${partInstanceId}" not found!`)
			const rundown = Rundowns.findOne(partInstance.rundownId)
			if (!rundown) throw new Meteor.Error(404, `Rundown "${partInstance.rundownId}" not found!`)
			if (rundown.playlistId !== rundownPlaylistId) throw new Meteor.Error(406, `Rundown "${rundown._id}" not a part of RundownPlaylist "${rundownPlaylistId}!"`)

			const adLibPiece = RundownBaselineAdLibPieces.findOne({
				_id: baselineAdLibPieceId,
				rundownId: partInstance.rundownId
			})
			if (!adLibPiece) throw new Meteor.Error(404, `Rundown Baseline Ad Lib Item "${baselineAdLibPieceId}" not found!`)
			if (!queue && rundownPlaylist.currentPartInstanceId !== partInstanceId) throw new Meteor.Error(403, `Rundown Baseline AdLib-pieces can be only placed in a currently playing part!`)

			innerStartAdLibPiece(rundownPlaylist, rundown, queue, partInstanceId, adLibPiece)
		})
	}
	function innerStartAdLibPiece (rundownPlaylist: RundownPlaylist, rundown: Rundown, queue: boolean, partInstanceId0: PartInstanceId, adLibPiece: AdLibPiece) {
		if (adLibPiece.toBeQueued) {
			// Allow adlib to request to always be queued
			queue = true
		}

		let partInstanceId = partInstanceId0
		let previousPartInstance: PartInstance | undefined

		if (queue) {
			previousPartInstance = PartInstances.findOne(partInstanceId0)
			if (!previousPartInstance) throw new Meteor.Error(404, `PartInstance "${partInstanceId0}" not found!`)

			// insert a NEW, adlibbed part after this part
			partInstanceId = adlibQueueInsertPartInstance(rundownPlaylist, rundown, previousPartInstance, adLibPiece)
		}
		let partInstance = PartInstances.findOne({
			_id: partInstanceId,
			rundownId: rundown._id
		})
		if (!partInstance) throw new Meteor.Error(404, `PartInstance "${partInstanceId}" not found!`)

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

		PieceInstances.insert(newPieceInstance)
		// TODO-PartInstance - pending new data flow
		Pieces.insert(newPieceInstance.piece)

		if (queue) {
				if (!showStyle) throw new Meteor.Error(`Could not find showstyle base with Id "${rundown.showStyleBaseId}"`)
            // NRK
            // NRK
			// Update any infinites
			updateSourceLayerInfinitesAfterPart(rundown, previousPartInstance!.part)

			// Copy across adlib-preroll and other properties needed on the part
			PartInstances.update(partInstance._id, {
				$set: {
					prerollDuration: adLibPiece.adlibPreroll,
					autoNext: adLibPiece.adlibAutoNext,
					autoNextOverlap: adLibPiece.adlibAutoNextOverlap,
					disableOutTransition: adLibPiece.adlibDisableOutTransition,
					expectedDuration: adLibPiece.expectedDuration
				}
			})

			setNextPart(rundownPlaylist, partInstance)
		}
		cropInfinitesOnLayer(rundown, partInstance, newPieceInstance)
		stopInfinitesRunningOnLayer(rundownPlaylist, rundown, partInstance, newPieceInstance.piece.sourceLayerId)
		updateTimeline(rundownPlaylist.studioId)
	}
	function adlibQueueInsertPartInstance (rundownPlaylist: RundownPlaylist, rundown: Rundown, afterPartInstance: PartInstance, adLibPiece: AdLibPiece): PartInstanceId {
		logger.info('adlibQueueInsertPartInstance')

		// check if there's already a queued part after this:
		const afterPartId = afterPartInstance.part.afterPart || afterPartInstance.part._id
		const alreadyQueuedPartInstance = PartInstances.findOne({
			rundownId: rundown._id,
			segmentId: afterPartInstance.segmentId,
			'part.afterPart': afterPartId,
			'part._rank': { $gt: afterPartInstance.part._rank }
		}, {
			sort: { _rank: -1, _id: -1 }
		})
		if (alreadyQueuedPartInstance) {
			if (rundownPlaylist.currentPartInstanceId !== alreadyQueuedPartInstance._id) {
				Parts.remove(alreadyQueuedPartInstance.part._id)
				PartInstances.remove(alreadyQueuedPartInstance._id)
				afterRemoveParts(rundown._id, [alreadyQueuedPartInstance.part])
			}
		}

		const newPartInstanceId = protectString<PartInstanceId>(Random.id())
		const newPart = literal<DBPart>({
			_id: getRandomId(),
			_rank: 99999, // something high, so it will be placed after current part. The rank will be updated later to its correct value
			externalId: '',
			segmentId: afterPartInstance.segmentId,
			rundownId: rundown._id,
			title: adLibPiece.name,
			dynamicallyInserted: true,
			afterPart: afterPartInstance.part.afterPart || afterPartInstance.part._id,
			typeVariant: 'adlib',
			prerollDuration: adLibPiece.adlibPreroll,
			expectedDuration: adLibPiece.expectedDuration
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
	export function sourceLayerStickyPieceStart (rundownPlaylistId: RundownPlaylistId, sourceLayerId: string) {
		return rundownPlaylistSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.USER_PLAYOUT, () => {
			const playlist = RundownPlaylists.findOne(rundownPlaylistId)
			if (!playlist) throw new Meteor.Error(404, `Rundown "${rundownPlaylistId}" not found!`)
			if (!playlist.active) throw new Meteor.Error(403, `Pieces can be only manipulated in an active rundown!`)
			if (!playlist.currentPartInstanceId) throw new Meteor.Error(400, `A part needs to be active to place a sticky item`)

			const currentPartInstance = PartInstances.findOne(playlist.currentPartInstanceId)
			if (!currentPartInstance) throw new Meteor.Error(501, `Current PartInstance "${playlist.currentPartInstanceId}" could not be found.`)

			const rundown = Rundowns.findOne(currentPartInstance.rundownId)
			if (!rundown) throw new Meteor.Error(501, `Current Rundown "${currentPartInstance.rundownId}" could not be found`)

			let showStyleBase = rundown.getShowStyleBase()

			const sourceLayer = showStyleBase.sourceLayers.find(i => i._id === sourceLayerId)
			if (!sourceLayer) throw new Meteor.Error(404, `Source layer "${sourceLayerId}" not found!`)
			if (!sourceLayer.isSticky) throw new Meteor.Error(400, `Only sticky layers can be restarted. "${sourceLayerId}" is not sticky.`)

			const query = {
				rundownId: rundown._id,
				'piece.sourceLayerId': sourceLayer._id,
				'piece.startedPlayback': {
					$exists: true
				}
			}

			if (sourceLayer.stickyOriginalOnly) {
				// Ignore adlibs if using original only
				query['pieces.adLibSourceId'] = {
					$exists: false
				}
			}

			const lastPieceInstances = PieceInstances.find(query, {
				sort: {
					'piece.startedPlayback': -1
				},
				limit: 1
			}).fetch()

			if (lastPieceInstances.length > 0) {
				const lastPiece = convertPieceToAdLibPiece(lastPieceInstances[0].piece)
				innerStartAdLibPiece(playlist, rundown, false, playlist.currentPartInstanceId, lastPiece)
			}
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
