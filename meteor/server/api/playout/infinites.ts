import * as _ from 'underscore'
import { Meteor } from 'meteor/meteor'
import { PieceLifespan, getPieceGroupId } from 'tv-automation-sofie-blueprints-integration'
import { logger } from '../../../lib/logging'
import { Rundown } from '../../../lib/collections/Rundowns'
import { Part, PartId } from '../../../lib/collections/Parts'
import { syncFunctionIgnore, syncFunction } from '../../codeControl'
import { Piece, Pieces, PieceId } from '../../../lib/collections/Pieces'
import { getOrderedPiece, PieceResolved, orderPieces } from './pieces'
import {
	asyncCollectionUpdate,
	waitForPromiseAll,
	asyncCollectionRemove,
	asyncCollectionInsert,
	makePromise,
	waitForPromise,
	asyncCollectionFindFetch,
	literal,
	protectString,
	unprotectObject,
	getCurrentTime
} from '../../../lib/lib'
import { PartInstance, PartInstances } from '../../../lib/collections/PartInstances'
import { PieceInstances, PieceInstance, wrapPieceToInstance } from '../../../lib/collections/PieceInstances'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { getPartsAfter } from './lib'
import { SegmentId } from '../../../lib/collections/Segments'

/** When we crop a piece, set the piece as "it has definitely ended" this far into the future. */
const DEFINITELY_ENDED_FUTURE_DURATION = 10 * 1000

export const updateSourceLayerInfinitesAfterPart: (rundown: Rundown, previousPart?: Part, runUntilEnd?: boolean) => void
= syncFunctionIgnore(updateSourceLayerInfinitesAfterPartInner)
export function updateSourceLayerInfinitesAfterPartInner (rundown: Rundown, previousPart?: Part, runUntilEnd?: boolean): void {
	let activeInfinitePieces: { [layer: string]: Piece } = {}
	let activeInfiniteItemsSegmentId: { [layer: string]: SegmentId } = {}

	// TODO-PartInstance - pending new data flow for this whole function

	if (previousPart === undefined) {
	   // If running from start (no previousPart), then always run to the end
	   runUntilEnd = true
	}

	let ps: Array<Promise<any>> = []

	const pInstancesToUpdate = asyncCollectionFindFetch(PartInstances, {
		rundownId: rundown._id,
		reset: { $ne: true }
	})
	const pPartsToProcess = makePromise(() => rundown.getParts())

	if (previousPart) {
	   // figure out the baseline to set
	   let prevPieces = getOrderedPiece(previousPart)
	   _.each(prevPieces, piece => {
		   if (!piece.infiniteMode || piece.playoutDuration || piece.userDuration || piece.enable.end || piece.enable.duration || piece.definitelyEnded) {
			   delete activeInfinitePieces[piece.sourceLayerId]
			   delete activeInfiniteItemsSegmentId[piece.sourceLayerId]
		   } else {
			   if (!piece.infiniteId) {
				   // ensure infinite id is set
				   piece.infiniteId = piece._id
				   ps.push(
					   asyncCollectionUpdate(Pieces, piece._id, {
						   $set: { infiniteId: piece.infiniteId }
					   })
				   )
				   ps.push(
					asyncCollectionUpdate(PieceInstances, {
						'piece._id': piece._id,
						reset: { $ne: true }
					}, {
						$set: { 'piece.infiniteId': piece.infiniteId }
					})
				)
				//    logger.debug(`updateSourceLayerInfinitesAfterPart: marked "${piece._id}" as start of infinite`)
			   }
			   if (piece.infiniteMode !== PieceLifespan.OutOnNextPart) {
				   activeInfinitePieces[piece.sourceLayerId] = piece
				   activeInfiniteItemsSegmentId[piece.sourceLayerId] = previousPart.segmentId
			   }
		   }
	   })
	}

	let partsToProcess = waitForPromise(pPartsToProcess)
	waitForPromiseAll(ps)

	if (previousPart) {
		partsToProcess = getPartsAfter(previousPart, partsToProcess)
	}

	let allPieces = Pieces.find({
		partId: {
			$in: partsToProcess.map(i => i._id)
		}
	}).fetch()

	let instancesToUpdate: PartInstance[] | undefined
	const getInstancesToUpdate = () => {
		if (instancesToUpdate === undefined) {
			instancesToUpdate = waitForPromise(pInstancesToUpdate) || []
		}
		return instancesToUpdate
	}

	ps = []
	for (let part of partsToProcess) {
	   // Drop any that relate only to previous segments
	   for (let k in activeInfiniteItemsSegmentId) {
		   let s = activeInfiniteItemsSegmentId[k]
		   let i = activeInfinitePieces[k]
		   if (!i.infiniteMode || i.infiniteMode === PieceLifespan.OutOnNextSegment && s !== part.segmentId) {
			   delete activeInfinitePieces[k]
			   delete activeInfiniteItemsSegmentId[k]
		   }
	   }

	   // ensure any currently defined infinites are still wanted
		const partStarted = part.getLastStartedPlayback()
		let currentItems = orderPieces(allPieces.filter(p => p.partId === part._id), part._id, partStarted)

	   let currentInfinites = currentItems.filter(i => i.infiniteId && i.infiniteId !== i._id)
	   let removedInfinites: PieceId[] = []

	   for (let piece of currentInfinites) {
		   const active = activeInfinitePieces[piece.sourceLayerId]
		   if (!active || active.infiniteId !== piece.infiniteId) {
			   // Previous piece no longer enforces the existence of this one
			   ps.push(asyncCollectionRemove(PieceInstances, {
				   'piece._id': piece._id,
				   reset: { $ne: true }
			}))
			ps.push(asyncCollectionRemove(Pieces, piece._id))

			   removedInfinites.push(piece._id)
			//    logger.debug(`updateSourceLayerInfinitesAfterPart: removed old infinite "${piece._id}" from "${piece.partId}"`)
		   }
	   }

	   // stop if not running to the end and there is/was nothing active
	   const midInfinites = currentInfinites.filter(i => !i.enable.end && !i.enable.duration && i.infiniteMode)
	   if (!runUntilEnd && Object.keys(activeInfiniteItemsSegmentId).length === 0 && midInfinites.length === 0) {
		   // TODO - this guard is useless, as all shows have klokke and logo as infinites throughout...
		   // This should instead do a check after each iteration to check if anything changed (even fields such as name on the piece)
		   // If nothing changed, then it is safe to assume that it doesnt need to go further
		   logger.info('Stopping infinite propogation early')
		   return
	   }

	   // figure out what infinites are to be extended
	   currentItems = currentItems.filter(i => removedInfinites.indexOf(i._id) < 0)
	   let oldInfiniteContinuation: PieceId[] = []
	   let newInfiniteContinations: Piece[] = []
	   for (let k in activeInfinitePieces) {
		   let newPiece: Piece = activeInfinitePieces[k]

		   let existingPiece: PieceResolved | undefined = undefined
		   let allowInsert: boolean = true

		   // If something exists on the layer, the infinite must be stopped and potentially replaced
		   const existingItems = currentItems.filter(i => i.sourceLayerId === newPiece.sourceLayerId)
		   if (existingItems && existingItems.length > 0) {
			   // remove the existing, as we need to update its contents
			   const existInf = existingItems.findIndex(e => !!e.infiniteId && e.infiniteId === newPiece.infiniteId)
			   if (existInf >= 0) {
				   existingPiece = existingItems[existInf]
				   oldInfiniteContinuation.push(existingPiece._id)

				   existingItems.splice(existInf, 1)
			   }

			   if (existingItems.length > 0) {
				   // It will be stopped by this line
				   delete activeInfinitePieces[k]
				   delete activeInfiniteItemsSegmentId[k]

				   const lastExistingPiece = _.last(existingItems) as PieceResolved
				   const firstExistingPiece = _.first(existingItems) as PieceResolved
				   // if we matched with an infinite, then make sure that infinite is kept going
				   if (lastExistingPiece.infiniteMode && lastExistingPiece.infiniteMode !== PieceLifespan.OutOnNextPart) {
					   activeInfinitePieces[k] = existingItems[0]
					   activeInfiniteItemsSegmentId[k] = part.segmentId
				   }

				   // If something starts at the beginning, then dont bother adding this infinite.
				   // Otherwise we should add the infinite but set it to end at the start of the first piece
				   if (firstExistingPiece.enable.start === 0) {
					   // skip the infinite, as it will never show
					   allowInsert = false
				   }
			   }
		   }
		   newPiece.partId = part._id
		   newPiece.continuesRefId = newPiece._id
		   newPiece.enable = { start: 0 }
		   newPiece._id = protectString<PieceId>(newPiece.infiniteId + '_' + part._id)
		   newPiece.startedPlayback = undefined
		   newPiece.stoppedPlayback = undefined
		   newPiece.timings = undefined

		   if (existingItems && existingItems.length) {
			   newPiece.enable.end = `#${getPieceGroupId(unprotectObject(existingItems[0]))}.start`
			   delete newPiece.enable.duration
			   newPiece.infiniteMode = PieceLifespan.Normal // it is no longer infinite, and the ui needs this to draw properly
		   }

		   if (existingPiece) { // Some properties need to be persisted
			   newPiece.userDuration = existingPiece.userDuration
			   newPiece.startedPlayback = existingPiece.startedPlayback
			   newPiece.stoppedPlayback = existingPiece.stoppedPlayback
			   newPiece.timings = existingPiece.timings

			   if (newPiece.expectedPlayoutItems) {
				   newPiece.expectedPlayoutItems = []
			   }
		   }

		   let pieceToInsert: Piece | null = (allowInsert ? newPiece : null)
		   if (pieceToInsert) {
			   newInfiniteContinations.push(pieceToInsert)

			   delete pieceToInsert['resolvedStart']
			   delete pieceToInsert['resolved']
		   }

		   if (existingPiece && pieceToInsert && _.isEqual(existingPiece, pieceToInsert)) {
			   // no change, since the new piece is equal to the existing one
			   // logger.debug(`updateSourceLayerInfinitesAfterPart: no change to infinite continuation "${itemToInsert._id}"`)
		   } else if (existingPiece && pieceToInsert && existingPiece._id === pieceToInsert._id) {
				// same _id; we can do an update:
			ps.push(asyncCollectionUpdate(Pieces, pieceToInsert._id, pieceToInsert))// note; not a $set, because we want to replace the object
			ps.push(asyncCollectionUpdate(PieceInstances, {
				'piece._id': pieceToInsert._id,
				reset: { $ne: true }
			}, {
				$set: { piece: pieceToInsert }
			}, { multi: true }))
			//    logger.debug(`updateSourceLayerInfinitesAfterPart: updated infinite continuation "${pieceToInsert._id}"`)
		   } else {
			   if (existingPiece) {
				ps.push(asyncCollectionRemove(PieceInstances, {
					'piece._id': existingPiece._id,
					reset: { $ne: true }
				}))
				ps.push(asyncCollectionRemove(Pieces, existingPiece._id))
			   }
			   if (pieceToInsert) {
				   const partId = pieceToInsert.partId
				   const affectedInstances = getInstancesToUpdate().filter(i => i.part._id === partId)
				   // insert instance into any active instances
				   for (const partInstance of affectedInstances) {
					ps.push(asyncCollectionInsert(PieceInstances, wrapPieceToInstance(pieceToInsert, partInstance._id)))
				   }

				   ps.push(asyncCollectionInsert(Pieces, pieceToInsert))
				//    logger.debug(`updateSourceLayerInfinitesAfterPart: inserted infinite continuation "${pieceToInsert._id}"`)
			   }
		   }
	   }

	   // find any new infinites exposed by this
	   currentItems = currentItems.filter(i => oldInfiniteContinuation.indexOf(i._id) < 0)
	   for (let piece of newInfiniteContinations.concat(currentItems)) {
		   if (
			   !piece.infiniteMode ||
			   piece.playoutDuration ||
			   piece.userDuration ||
			   piece.enable.end ||
			   piece.enable.duration
		   ) {
			   delete activeInfinitePieces[piece.sourceLayerId]
			   delete activeInfiniteItemsSegmentId[piece.sourceLayerId]
		   } else if (piece.infiniteMode !== PieceLifespan.OutOnNextPart) {
			   if (!piece.infiniteId) {
					// ensure infinite id is set
				piece.infiniteId = piece._id
				ps.push(asyncCollectionUpdate(PieceInstances, {
					'piece._id': piece._id,
					reset: { $ne: true }
				}, { $set: {
					'piece.infiniteId': piece.infiniteId }
				}, { multi: true }))
				ps.push(asyncCollectionUpdate(Pieces, piece._id, { $set: {
					infiniteId: piece.infiniteId }
				}))
				//    logger.debug(`updateSourceLayerInfinitesAfterPart: marked "${piece._id}" as start of infinite`)
			   }

			   activeInfinitePieces[piece.sourceLayerId] = piece
			   activeInfiniteItemsSegmentId[piece.sourceLayerId] = part.segmentId
		   }
	   }
	}

	waitForPromiseAll(ps)
}

export const cropInfinitesOnLayer = syncFunction(function cropInfinitesOnLayer (rundown: Rundown, partInstance: PartInstance, newPieceInstance: PieceInstance) {
	const showStyleBase = rundown.getShowStyleBase()
	const exclusiveGroup = _.find(showStyleBase.sourceLayers, sl => sl._id === newPieceInstance.piece.sourceLayerId)
	const newItemExclusivityGroup = exclusiveGroup ? exclusiveGroup.exclusiveGroup : undefined
	const layersInExclusivityGroup = newItemExclusivityGroup ? _.map(_.filter(showStyleBase.sourceLayers, sl => sl.exclusiveGroup === newItemExclusivityGroup), i => i._id) : [newPieceInstance.piece.sourceLayerId]

	const pieceInstances = partInstance.getAllPieceInstances().filter(i =>
		i._id !== newPieceInstance._id && i.piece.infiniteMode &&
		(i.piece.sourceLayerId === newPieceInstance.piece.sourceLayerId || layersInExclusivityGroup.indexOf(i.piece.sourceLayerId) !== -1)
	)

	let ps: Array<Promise<any>> = []
	for (const instance of pieceInstances) {
		if (!instance.piece.userDuration || (!instance.piece.userDuration.duration && !instance.piece.userDuration.end)) {
			ps.push(asyncCollectionUpdate(PieceInstances, instance._id, { $set: {
				'piece.userDuration': { end: `#${getPieceGroupId(unprotectObject(newPieceInstance.piece))}.start + ${newPieceInstance.piece.adlibPreroll || 0}` },
				definitelyEnded: getCurrentTime() + DEFINITELY_ENDED_FUTURE_DURATION + (newPieceInstance.piece.adlibPreroll || 0),
				'piece.infiniteMode': PieceLifespan.Normal,
				'piece.originalInfiniteMode': instance.piece.originalInfiniteMode !== undefined ? instance.piece.originalInfiniteMode : instance.piece.infiniteMode
			}}))

			// TODO-PartInstance - pending new data flow
			ps.push(asyncCollectionUpdate(Pieces, instance.piece._id, { $set: {
				userDuration: { end: `#${getPieceGroupId(unprotectObject(newPieceInstance.piece))}.start + ${newPieceInstance.piece.adlibPreroll || 0}` },
				definitelyEnded: getCurrentTime() + DEFINITELY_ENDED_FUTURE_DURATION + (newPieceInstance.piece.adlibPreroll || 0),
				infiniteMode: PieceLifespan.Normal,
				originalInfiniteMode: instance.piece.originalInfiniteMode !== undefined ? instance.piece.originalInfiniteMode : instance.piece.infiniteMode
			}}))
		}
	}
	waitForPromiseAll(ps)
})

export const stopInfinitesRunningOnLayer = syncFunction(function stopInfinitesRunningOnLayer (rundownPlaylist: RundownPlaylist, rundown: Rundown, partInstance: PartInstance, sourceLayer: string) {
	// TODO-PartInstance - pending new data flow for this whole function

	const ps: Array<Promise<void>> = []

	// Cleanup any future parts
	const remainingParts = getPartsAfter(partInstance.part, rundown.getParts())
	const affectedPartIds: PartId[] = []
	for (let part of remainingParts) {
		let continuations = part.getAllPieces().filter(i => i.infiniteMode && i.infiniteId && i.infiniteId !== i._id && i.sourceLayerId === sourceLayer)
		if (continuations.length === 0) {
			// We can stop searching once a part doesnt include it
			break
		}

		affectedPartIds.push(part._id)
		ps.push(asyncCollectionRemove(Pieces, { _id: { $in: continuations.map(p => p._id) } }))
	}

	// Also update the nextPartInstance
	const { nextPartInstance } = rundownPlaylist.getSelectedPartInstances()
	if (nextPartInstance && affectedPartIds.indexOf(nextPartInstance.part._id) !== -1) {
		const toRemove = nextPartInstance.getAllPieceInstances()
			.filter(p => p.piece.infiniteMode && p.piece.infiniteId && p.piece.infiniteId !== p.piece._id && p.piece.sourceLayerId === sourceLayer)

		ps.push(asyncCollectionRemove(PieceInstances, { _id: { $in: toRemove.map(p => p._id) } }))
	}

	waitForPromiseAll(ps)

	// ensure adlib is extended correctly if infinite
	updateSourceLayerInfinitesAfterPart(rundown, partInstance.part)
})
