import * as _ from 'underscore'
import { Meteor } from 'meteor/meteor'
import { PieceLifespan, getPieceGroupId } from 'tv-automation-sofie-blueprints-integration'

import { Rundown } from '../../../lib/collections/Rundowns'
import { Part } from '../../../lib/collections/Parts'
import { syncFunctionIgnore, syncFunction } from '../../codeControl'
import { Piece, Pieces } from '../../../lib/collections/Pieces'
import { getOrderedPiece, PieceResolved } from './pieces'
import { asyncCollectionUpdate, waitForPromiseAll, asyncCollectionRemove, asyncCollectionInsert, normalizeArray, toc, makePromise, waitForPromise } from '../../../lib/lib'

export const updateSourceLayerInfinitesAfterPart: (rundown: Rundown, previousPart?: Part, runUntilEnd?: boolean) => void
= syncFunctionIgnore(updateSourceLayerInfinitesAfterPartInner)
export function updateSourceLayerInfinitesAfterPartInner (rundown: Rundown, previousPart?: Part, runUntilEnd?: boolean): string {
	let activeInfinitePieces: { [layer: string]: Piece } = {}
	let activeInfiniteItemsSegmentId: { [layer: string]: string } = {}

	if (previousPart === undefined) {
	   // If running from start (no previousPart), then always run to the end
	   runUntilEnd = true
	}

	let ps: Array<Promise<any>> = []

	const pPartsToProcess = makePromise(() => rundown.getParts())

	if (previousPart) {
	   // figure out the baseline to set
	   let prevPieces = getOrderedPiece(previousPart)
	   _.each(prevPieces, piece => {
		   if (!piece.infiniteMode || piece.playoutDuration || piece.userDuration || piece.enable.end || piece.enable.duration) {
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
	   partsToProcess = partsToProcess.filter(l => l._rank > previousPart._rank)
	}

   // Prepare pieces:
	let psPopulateCache: Array<Promise<any>> = []
	const currentItemsCache: {[partId: string]: PieceResolved[]} = {}
	_.each(partsToProcess, (part) => {
	   psPopulateCache.push(new Promise((resolve, reject) => {
		   try {
			   let currentItems = getOrderedPiece(part)

			   currentItemsCache[part._id] = currentItems
			   resolve()
		   } catch (e) {
			   reject(e)
		   }
	   }))
	})
	waitForPromiseAll(psPopulateCache)

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
	   // let currentItems = getOrderedPiece(part)
	   let currentItems = currentItemsCache[part._id]
	   if (!currentItems) throw new Meteor.Error(500, `currentItemsCache didn't contain "${part._id}", which it should have`)

	   let currentInfinites = currentItems.filter(i => i.infiniteId && i.infiniteId !== i._id)
	   let removedInfinites: string[] = []

	   for (let piece of currentInfinites) {
		   const active = activeInfinitePieces[piece.sourceLayerId]
		   if (!active || active.infiniteId !== piece.infiniteId) {
			   // Previous piece no longer enforces the existence of this one
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
		   return part._id
	   }

	   // figure out what infinites are to be extended
	   currentItems = currentItems.filter(i => removedInfinites.indexOf(i._id) < 0)
	   let oldInfiniteContinuation: string[] = []
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
		   newPiece._id = newPiece.infiniteId + '_' + part._id
		   newPiece.startedPlayback = undefined
		   newPiece.stoppedPlayback = undefined
		   newPiece.timings = undefined

		   if (existingItems && existingItems.length) {
			   newPiece.enable.end = `#${getPieceGroupId(existingItems[0])}.start`
			   delete newPiece.enable.duration
			   newPiece.infiniteMode = PieceLifespan.Normal // it is no longer infinite, and the ui needs this to draw properly
		   }

		   if (existingPiece) { // Some properties need to be persisted
			   newPiece.userDuration = existingPiece.userDuration
			   newPiece.startedPlayback = existingPiece.startedPlayback
			   newPiece.stoppedPlayback = existingPiece.stoppedPlayback
			   newPiece.timings = existingPiece.timings
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
			//    logger.debug(`updateSourceLayerInfinitesAfterPart: updated infinite continuation "${pieceToInsert._id}"`)
		   } else {
			   if (existingPiece) {
				   ps.push(asyncCollectionRemove(Pieces, existingPiece._id))
			   }
			   if (pieceToInsert) {
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
	return ''
}

export const cropInfinitesOnLayer = syncFunction(function cropInfinitesOnLayer (rundown: Rundown, part: Part, newPiece: Piece) {
	let showStyleBase = rundown.getShowStyleBase()
	const sourceLayerLookup = normalizeArray(showStyleBase.sourceLayers, '_id')
	const newItemExclusivityGroup = sourceLayerLookup[newPiece.sourceLayerId].exclusiveGroup

	const pieces = part.getAllPieces().filter(i =>
		(i.sourceLayerId === newPiece.sourceLayerId
			|| (newItemExclusivityGroup && sourceLayerLookup[i.sourceLayerId] && sourceLayerLookup[i.sourceLayerId].exclusiveGroup === newItemExclusivityGroup)
		) && i._id !== newPiece._id && i.infiniteMode
	)

	let ps: Array<Promise<any>> = []
	for (const piece of pieces) {
		ps.push(asyncCollectionUpdate(Pieces, piece._id, { $set: {
			userDuration: { end: `#${getPieceGroupId(newPiece)}.start + ${newPiece.adlibPreroll || 0}` },
			infiniteMode: PieceLifespan.Normal,
			originalInfiniteMode: piece.originalInfiniteMode !== undefined ? piece.originalInfiniteMode : piece.infiniteMode
		}}))
	}
	waitForPromiseAll(ps)
})

export const stopInfinitesRunningOnLayer = syncFunction(function stopInfinitesRunningOnLayer (rundown: Rundown, part: Part, sourceLayer: string) {
	let remainingParts = rundown.getParts().filter(l => l._rank > part._rank)
	for (let line of remainingParts) {
		let continuations = line.getAllPieces().filter(i => i.infiniteMode && i.infiniteId && i.infiniteId !== i._id && i.sourceLayerId === sourceLayer)
		if (continuations.length === 0) {
			break
		}

		continuations.forEach(i => Pieces.remove(i))
	}

	// ensure adlib is extended correctly if infinite
	updateSourceLayerInfinitesAfterPart(rundown, part)
})
