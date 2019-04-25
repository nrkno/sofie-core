import * as _ from 'underscore'
import { Meteor } from 'meteor/meteor'
import { PieceLifespan, getPieceGroupId } from 'tv-automation-sofie-blueprints-integration'
import { Timeline } from 'timeline-state-resolver-types'

import { Rundown } from '../../../lib/collections/Rundowns'
import { Part } from '../../../lib/collections/Parts'
import { syncFunctionIgnore, syncFunction } from '../../codeControl'
import { Piece, Pieces } from '../../../lib/collections/Pieces'
import { getOrderedPiece, PieceResolved } from './pieces'
import { asyncCollectionUpdate, waitForPromiseAll, asyncCollectionRemove, asyncCollectionInsert, normalizeArray } from '../../../lib/lib'
import { logger } from '../../../lib/logging'

export const updateSourceLayerInfinitesAfterLine: (rundown: Rundown, previousLine?: Part, runUntilEnd?: boolean) => void
= syncFunctionIgnore(updateSourceLayerInfinitesAfterLineInner)
export function updateSourceLayerInfinitesAfterLineInner (rundown: Rundown, previousLine?: Part, runUntilEnd?: boolean): string {
	let activeInfiniteItems: { [layer: string]: Piece } = {}
	let activeInfiniteItemsSegmentId: { [layer: string]: string } = {}

	if (previousLine === undefined) {
	   // If running from start (no previousLine), then always run to the end
	   runUntilEnd = true
	}

	if (previousLine) {
	   let ps: Array<Promise<any>> = []
	   // figure out the baseline to set
	   let prevItems = getOrderedPiece(previousLine)
	   _.each(prevItems, item => {
		   if (!item.infiniteMode || item.duration || item.durationOverride || item.expectedDuration) {
			   delete activeInfiniteItems[item.sourceLayerId]
			   delete activeInfiniteItemsSegmentId[item.sourceLayerId]
		   } else {
			   if (!item.infiniteId) {
				   // ensure infinite id is set
				   item.infiniteId = item._id
				   ps.push(
					   asyncCollectionUpdate(Pieces, item._id, {
						   $set: { infiniteId: item.infiniteId }
					   })
				   )
				   logger.debug(`updateSourceLayerInfinitesAfterLine: marked "${item._id}" as start of infinite`)
			   }
			   if (item.infiniteMode !== PieceLifespan.OutOnNextPart) {
				   activeInfiniteItems[item.sourceLayerId] = item
				   activeInfiniteItemsSegmentId[item.sourceLayerId] = previousLine.segmentId
			   }
		   }
	   })
	   waitForPromiseAll(ps)
	}

	let partsToProcess = rundown.getParts()
	if (previousLine) {
	   partsToProcess = partsToProcess.filter(l => l._rank > previousLine._rank)
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

	let ps: Array<Promise<any>> = []
	for (let part of partsToProcess) {
	   // Drop any that relate only to previous segments
	   for (let k in activeInfiniteItemsSegmentId) {
		   let s = activeInfiniteItemsSegmentId[k]
		   let i = activeInfiniteItems[k]
		   if (!i.infiniteMode || i.infiniteMode === PieceLifespan.OutOnNextSegment && s !== part.segmentId) {
			   delete activeInfiniteItems[k]
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
		   const active = activeInfiniteItems[piece.sourceLayerId]
		   if (!active || active.infiniteId !== piece.infiniteId) {
			   // Previous item no longer enforces the existence of this one
			   ps.push(asyncCollectionRemove(Pieces, piece._id))

			   removedInfinites.push(piece._id)
			   logger.debug(`updateSourceLayerInfinitesAfterLine: removed old infinite "${piece._id}" from "${piece.partId}"`)
		   }
	   }

	   // stop if not running to the end and there is/was nothing active
	   const midInfinites = currentInfinites.filter(i => !i.expectedDuration && i.infiniteMode)
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
	   for (let k in activeInfiniteItems) {
		   let newItem: Piece = activeInfiniteItems[k]

		   let existingItem: PieceResolved | undefined = undefined
		   let allowInsert: boolean = true

		   // If something exists on the layer, the infinite must be stopped and potentially replaced
		   const existingItems = currentItems.filter(i => i.sourceLayerId === newItem.sourceLayerId)
		   if (existingItems && existingItems.length > 0) {
			   // remove the existing, as we need to update its contents
			   const existInf = existingItems.findIndex(e => !!e.infiniteId && e.infiniteId === newItem.infiniteId)
			   if (existInf >= 0) {
				   existingItem = existingItems[existInf]
				   oldInfiniteContinuation.push(existingItem._id)

				   existingItems.splice(existInf, 1)
			   }

			   if (existingItems.length > 0) {
				   // It will be stopped by this line
				   delete activeInfiniteItems[k]
				   delete activeInfiniteItemsSegmentId[k]

				   const lastExistingItem = _.last(existingItems) as PieceResolved
				   const firstExistingItem = _.first(existingItems) as PieceResolved
				   // if we matched with an infinite, then make sure that infinite is kept going
				   if (lastExistingItem.infiniteMode && lastExistingItem.infiniteMode !== PieceLifespan.OutOnNextPart) {
					   activeInfiniteItems[k] = existingItems[0]
					   activeInfiniteItemsSegmentId[k] = part.segmentId
				   }

				   // If something starts at the beginning, then dont bother adding this infinite.
				   // Otherwise we should add the infinite but set it to end at the start of the first item
				   if (firstExistingItem.trigger.type === Timeline.TriggerType.TIME_ABSOLUTE && firstExistingItem.trigger.value === 0) {
					   // skip the infinite, as it will never show
					   allowInsert = false
				   }
			   }
		   }
		   newItem.partId = part._id
		   newItem.continuesRefId = newItem._id
		   newItem.trigger = {
			   type: Timeline.TriggerType.TIME_ABSOLUTE,
			   value: 0
		   }
		   newItem._id = newItem.infiniteId + '_' + part._id
		   newItem.startedPlayback = undefined
		   newItem.stoppedPlayback = undefined
		   newItem.timings = undefined

		   if (existingItems && existingItems.length) {
			   newItem.expectedDuration = `#${getPieceGroupId(existingItems[0])}.start - #.start`
			   newItem.infiniteMode = PieceLifespan.Normal // it is no longer infinite, and the ui needs this to draw properly
		   }

		   if (existingItem) { // Some properties need to be persisted
			   newItem.durationOverride = existingItem.durationOverride
			   newItem.startedPlayback = existingItem.startedPlayback
			   newItem.stoppedPlayback = existingItem.stoppedPlayback
			   newItem.timings = existingItem.timings
		   }

		   let itemToInsert: Piece | null = (allowInsert ? newItem : null)
		   if (itemToInsert) {
			   newInfiniteContinations.push(itemToInsert)

			   delete itemToInsert['resolvedStart']
			   delete itemToInsert['resolved']
		   }

		   if (existingItem && itemToInsert && _.isEqual(existingItem, itemToInsert)) {
			   // no change, since the new item is equal to the existing one
			   // logger.debug(`updateSourceLayerInfinitesAfterLine: no change to infinite continuation "${itemToInsert._id}"`)
		   } else if (existingItem && itemToInsert && existingItem._id === itemToInsert._id) {
			   // same _id; we can do an update:
			   ps.push(asyncCollectionUpdate(Pieces, itemToInsert._id, itemToInsert))// note; not a $set, because we want to replace the object
			   logger.debug(`updateSourceLayerInfinitesAfterLine: updated infinite continuation "${itemToInsert._id}"`)
		   } else {
			   if (existingItem) {
				   ps.push(asyncCollectionRemove(Pieces, existingItem._id))
			   }
			   if (itemToInsert) {
				   ps.push(asyncCollectionInsert(Pieces, itemToInsert))
				   logger.debug(`updateSourceLayerInfinitesAfterLine: inserted infinite continuation "${itemToInsert._id}"`)
			   }
		   }
	   }

	   // find any new infinites exposed by this
	   currentItems = currentItems.filter(i => oldInfiniteContinuation.indexOf(i._id) < 0)
	   for (let piece of newInfiniteContinations.concat(currentItems)) {
		   if (
			   !piece.infiniteMode ||
			   piece.duration ||
			   piece.durationOverride ||
			   piece.expectedDuration
		   ) {
			   delete activeInfiniteItems[piece.sourceLayerId]
			   delete activeInfiniteItemsSegmentId[piece.sourceLayerId]
		   } else if (piece.infiniteMode !== PieceLifespan.OutOnNextPart) {
			   if (!piece.infiniteId) {
				   // ensure infinite id is set
				   piece.infiniteId = piece._id
				   ps.push(asyncCollectionUpdate(Pieces, piece._id, { $set: {
					   infiniteId: piece.infiniteId }
				   }))
				   logger.debug(`updateSourceLayerInfinitesAfterLine: marked "${piece._id}" as start of infinite`)
			   }

			   activeInfiniteItems[piece.sourceLayerId] = piece
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

	const items = part.getAllPieces().filter(i =>
		(i.sourceLayerId === newPiece.sourceLayerId
			|| (newItemExclusivityGroup && sourceLayerLookup[i.sourceLayerId] && sourceLayerLookup[i.sourceLayerId].exclusiveGroup === newItemExclusivityGroup)
		) && i._id !== newPiece._id && i.infiniteMode
	)

	let ps: Array<Promise<any>> = []
	for (const i of items) {
		ps.push(asyncCollectionUpdate(Pieces, i._id, { $set: {
			expectedDuration: `#${getPieceGroupId(newPiece)}.start + ${newPiece.adlibPreroll || 0} - #.start`,
			originalExpectedDuration: i.originalExpectedDuration !== undefined ? i.originalExpectedDuration : i.expectedDuration,
			infiniteMode: PieceLifespan.Normal,
			originalInfiniteMode: i.originalInfiniteMode !== undefined ? i.originalInfiniteMode : i.infiniteMode
		}}))
	}
	waitForPromiseAll(ps)
})

export const stopInfinitesRunningOnLayer = syncFunction(function stopInfinitesRunningOnLayer (rundown: Rundown, part: Part, sourceLayer: string) {
	let remainingLines = rundown.getParts().filter(l => l._rank > part._rank)
	for (let line of remainingLines) {
		let continuations = line.getAllPieces().filter(i => i.infiniteMode && i.infiniteId && i.infiniteId !== i._id && i.sourceLayerId === sourceLayer)
		if (continuations.length === 0) {
			break
		}

		continuations.forEach(i => Pieces.remove(i))
	}

	// ensure adlib is extended correctly if infinite
	updateSourceLayerInfinitesAfterLine(rundown, part)
})
