import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import {
	LookaheadMode,
	Timeline as TimelineTypes,
	OnGenerateTimelineObj,
} from 'tv-automation-sofie-blueprints-integration'
import { Studio, MappingExt } from '../../../lib/collections/Studios'
import {
	TimelineObjGeneric,
	TimelineObjRundown,
	fixTimelineId,
	TimelineObjType,
} from '../../../lib/collections/Timeline'
import { Part, PartId } from '../../../lib/collections/Parts'
import { Piece } from '../../../lib/collections/Pieces'
import { orderPieces, PieceResolved } from './pieces'
import { literal, clone, unprotectString, protectString } from '../../../lib/lib'
import { RundownPlaylistPlayoutData, RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { PieceInstance, wrapPieceToInstance } from '../../../lib/collections/PieceInstances'
import { selectNextPart, getSelectedPartInstancesFromCache, getAllOrderedPartsFromCache } from './lib'
import { PartInstanceId, PartInstance } from '../../../lib/collections/PartInstances'
import { CacheForRundownPlaylist } from '../../DatabaseCaches'

const LOOKAHEAD_OBJ_PRIORITY = 0.1

interface PartInstanceAndPieceInstances {
	part: PartInstance
	pieces: PieceInstance[]
}
interface PartAndPieces {
	part: Part
	pieces: Piece[]
}

export function getLookeaheadObjects(
	cache: CacheForRundownPlaylist,
	studio: Studio,
	playlist: RundownPlaylist
): Array<TimelineObjGeneric> {
	const timelineObjs: Array<TimelineObjGeneric> = []
	const mutateAndPushObject = (
		rawObj: TimelineObjRundown,
		i: string,
		enable: TimelineObjRundown['enable'],
		mapping: MappingExt,
		priority: number
	) => {
		const obj: TimelineObjGeneric = clone(rawObj)

		obj.id = `lookahead_${i}_${obj.id}`
		obj.priority = priority
		obj.enable = enable
		obj.isLookahead = true
		if (obj.keyframes) {
			obj.keyframes = obj.keyframes.filter((kf) => kf.preserveForLookahead)
		}
		delete obj.inGroup // force it to be cleared

		if (mapping.lookahead === LookaheadMode.PRELOAD) {
			obj.lookaheadForLayer = obj.layer
			obj.layer += '_lookahead'
		}

		timelineObjs.push(obj)
	}

	const calculateStartAfterPreviousObj = (prevObj: TimelineObjRundown): TimelineTypes.TimelineEnable => {
		const prevHasDelayFlag = (prevObj.classes || []).indexOf('_lookahead_start_delay') !== -1

		// Start with previous piece
		const startOffset = prevHasDelayFlag ? 2000 : 0
		return {
			start: `#${prevObj.id}.start + ${startOffset}`,
		}
	}

	function getPartInstancePieces(partInstanceId: PartInstanceId) {
		return cache.PieceInstances.findFetch((pieceInstance: PieceInstance) => {
			return !!(
				pieceInstance.partInstanceId === partInstanceId &&
				pieceInstance.piece.content &&
				pieceInstance.piece.content.timelineObjects
			)
		})
	}
	const { currentPartInstance, nextPartInstance, previousPartInstance } = getSelectedPartInstancesFromCache(
		cache,
		playlist
	)
	// Get the PieceInstances which are on the timeline
	const partInstancesOnTimeline: PartInstanceAndPieceInstances[] = _.compact([
		currentPartInstance,
		currentPartInstance && currentPartInstance.part.autoNext ? nextPartInstance : undefined,
	]).map((part) => ({
		part,
		pieces: getPartInstancePieces(part._id),
	}))
	// Track the previous info for checking how the timeline will be built
	let previousPartInfo: PartInstanceAndPieceInstances | undefined
	if (previousPartInstance) {
		const previousPieces = getPartInstancePieces(previousPartInstance._id)
		previousPartInfo = {
			part: previousPartInstance,
			pieces: previousPieces,
		}
	}

	const orderedParts = getAllOrderedPartsFromCache(cache, playlist)

	// nextPartInstance should always have a backing part (if it exists), so this will be safe
	let futureParts: Part[] = []
	const lastPartInstanceOnTimeline = _.last(partInstancesOnTimeline) || previousPartInfo || null
	if (
		lastPartInstanceOnTimeline &&
		nextPartInstance &&
		lastPartInstanceOnTimeline.part._id !== nextPartInstance._id
	) {
		// We need to find the nextPart and do lookahead from there
		const nextPartIndex = orderedParts.findIndex((p) => p._id === nextPartInstance.part._id)
		futureParts = nextPartIndex !== undefined ? orderedParts.slice(nextPartIndex) : []
	} else {
		// next is already handled, so work from after that
		const nextPartIndex = selectNextPart(playlist, lastPartInstanceOnTimeline?.part ?? null, orderedParts)?.index
		futureParts = nextPartIndex !== undefined ? orderedParts.slice(nextPartIndex) : []
	}

	const orderedPiecesCache = new Map<PartId, PieceResolved[]>()

	_.each(studio.mappings || {}, (mapping: MappingExt, layerId: string) => {
		const lookaheadTargetObjects = mapping.lookahead === LookaheadMode.PRELOAD ? mapping.lookaheadDepth || 1 : 1 // TODO - test other modes
		const lookaheadMaxSearchDistance =
			mapping.lookaheadMaxSearchDistance !== undefined && mapping.lookaheadMaxSearchDistance >= 0
				? mapping.lookaheadMaxSearchDistance
				: undefined
		const lookaheadObjs = findLookaheadForlayer(
			cache,
			playlist,
			partInstancesOnTimeline,
			previousPartInfo,
			futureParts.slice(0, lookaheadMaxSearchDistance),
			orderedPiecesCache,
			layerId,
			mapping.lookahead,
			lookaheadTargetObjects,
			lookaheadMaxSearchDistance
		)
		if (!lookaheadObjs) {
			return
		}

		// Add the objects that have some timing info
		_.each(lookaheadObjs.timed, (entry, i) => {
			let enable: TimelineTypes.TimelineEnable = {
				start: 1, // Absolute 0 without a group doesnt work
			}
			if (i !== 0) {
				const prevObj = lookaheadObjs.timed[i - 1].obj
				enable = calculateStartAfterPreviousObj(prevObj)
			}
			if (!entry.obj.id) throw new Meteor.Error(500, 'lookahead: timeline obj id not set')

			enable.end = `#${entry.obj.id}.start`

			mutateAndPushObject(entry.obj, `timed${i}`, enable, mapping, LOOKAHEAD_OBJ_PRIORITY)
		})

		// Add each of the future objects, that have no end point
		const futureObjCount = lookaheadObjs.future.length
		const futurePriorityScale = LOOKAHEAD_OBJ_PRIORITY / (futureObjCount + 1)
		_.each(lookaheadObjs.future, (entry, i) => {
			if (!entry.obj.id) throw new Meteor.Error(500, 'lookahead: timeline obj id not set')

			// WHEN_CLEAR mode can't take multiple futures, as they are always flattened into the single layer. so give it some real timings, and only output one
			const singleFutureObj = mapping.lookahead === LookaheadMode.WHEN_CLEAR
			if (singleFutureObj && i !== 0) {
				return
			}

			const lastTimedObj = _.last(lookaheadObjs.timed)
			const enable =
				singleFutureObj && lastTimedObj ? calculateStartAfterPreviousObj(lastTimedObj.obj) : { while: '1' }
			// We use while: 1 for the enabler, as any time before it should be active will be filled by either a playing object, or a timed lookahead.
			// And this allows multiple futures to be timed in a way that allows them to co-exist

			// Prioritise so that the earlier ones are higher, decreasing within the range 'reserved' for lookahead
			const priority = singleFutureObj ? LOOKAHEAD_OBJ_PRIORITY : futurePriorityScale * (futureObjCount - i)
			mutateAndPushObject(entry.obj, `future${i}`, enable, mapping, priority)
		})
	})
	return timelineObjs
}

export interface LookaheadObjectEntry {
	obj: TimelineObjRundown
	partId: PartId
}

export interface LookaheadResult {
	timed: Array<LookaheadObjectEntry>
	future: Array<LookaheadObjectEntry>
}

function findLookaheadForlayer(
	cache: CacheForRundownPlaylist,
	playlist: RundownPlaylist,
	partInstancesOnTimeline: PartInstanceAndPieceInstances[],
	previousPartInstanceInfo: PartInstanceAndPieceInstances | undefined,
	futureParts: Part[],
	orderedPiecesCache: Map<PartId, PieceResolved[]>,
	layer: string,
	mode: LookaheadMode,
	lookaheadTargetObjects: number,
	lookaheadMaxSearchDistance?: number
): LookaheadResult | null {
	const res: LookaheadResult = {
		timed: [],
		future: [],
	}

	if (mode === undefined || mode === LookaheadMode.NONE) {
		return null
	}

	function filterPartInstancePieces(pieces: PieceInstance[]) {
		return pieces.filter(
			(p) => !!_.find((p.piece.content || {}).timelineObjects || [], (o) => o && o.layer === layer)
		)
	}

	// Track the previous info for checking how the timeline will be built
	let previousPartInfo: PartAndPieces | undefined
	if (previousPartInstanceInfo) {
		const previousPieces = filterPartInstancePieces(previousPartInstanceInfo.pieces)
		previousPartInfo = {
			part: previousPartInstanceInfo.part.part,
			pieces: previousPieces.map((p) => p.piece),
		}
	}

	// Generate timed objects for parts on the timeline
	_.each(partInstancesOnTimeline, (partInstance) => {
		const pieces = filterPartInstancePieces(partInstance.pieces)
		const partInfo = {
			part: partInstance.part.part,
			pieces: pieces.map((p) => p.piece),
		}

		findObjectsForPart(
			cache,
			playlist,
			orderedPiecesCache,
			layer,
			previousPartInfo,
			partInfo,
			partInstance.part._id
		).forEach((o) => res.timed.push({ obj: o, partId: partInstance.part.part._id }))
		previousPartInfo = partInfo
	})

	// find all pieces that touch the layer
	const piecesUsingLayer = cache.Pieces.findFetch((piece: Piece) => {
		return !!(
			piece.content &&
			piece.content.timelineObjects &&
			_.find(piece.content.timelineObjects, (o) => o && o.layer === layer)
		)
	})
	if (piecesUsingLayer.length === 0) {
		return res
	}

	if (futureParts.length === 0) {
		return res
	}

	// have pieces grouped by part, so we can look based on rank to choose the correct one
	const piecesUsingLayerByPart: { [partId: string]: Piece[] | undefined } = {}
	piecesUsingLayer.forEach((i) => {
		const partId = unprotectString(i.partId)
		if (!piecesUsingLayerByPart[partId]) {
			piecesUsingLayerByPart[partId] = []
		}

		piecesUsingLayerByPart[partId]!.push(i)
	})

	for (const part of futureParts) {
		// Stop if we have enough objects already
		if (res.future.length >= lookaheadTargetObjects) {
			break
		}

		const pieces = piecesUsingLayerByPart[unprotectString(part._id)] || []
		if (pieces.length > 0 && part.isPlayable()) {
			const partInfo = { part, pieces }
			findObjectsForPart(
				cache,
				playlist,
				orderedPiecesCache,
				layer,
				previousPartInfo,
				partInfo,
				null
			).forEach((o) => res.future.push({ obj: o, partId: part._id }))
			previousPartInfo = partInfo
		}
	}

	return res
}

function findObjectsForPart(
	cache: CacheForRundownPlaylist,
	playlist: RundownPlaylist,
	orderedPiecesCache: Map<PartId, PieceResolved[]>,
	layer: string,
	previousPartInfo: PartAndPieces | undefined,
	partInfo: PartAndPieces,
	partInstanceId: PartInstanceId | null
): (TimelineObjRundown & OnGenerateTimelineObj)[] {
	const activePlaylist = playlist

	// Sanity check, if no part to search, then abort
	if (!partInfo || partInfo.pieces.length === 0) {
		return []
	}

	let allObjs: TimelineObjRundown[] = []
	partInfo.pieces.forEach((piece) => {
		if (piece.content && piece.content.timelineObjects) {
			// Calculate the pieceInstanceId or fallback to the pieceId. This is ok, as its only for lookahead
			const pieceInstanceId = partInstanceId ? wrapPieceToInstance(piece, partInstanceId)._id : piece._id

			_.each(piece.content.timelineObjects, (obj) => {
				if (obj) {
					fixTimelineId(obj)
					allObjs.push(
						literal<TimelineObjRundown & OnGenerateTimelineObj>({
							...obj,
							_id: protectString(''), // set later
							studioId: protectString(''), // set later
							objectType: TimelineObjType.RUNDOWN,
							pieceInstanceId: unprotectString(pieceInstanceId),
							infinitePieceId: unprotectString(piece.infiniteId),
						})
					)
				}
			})
		}
	})
	// let allObjs: TimelineObjRundown[] = _.compact(rawObjs)

	if (allObjs.length === 0) {
		// Should never happen. suggests something got 'corrupt' during this process
		return []
	} else if (allObjs.length === 1) {
		// Only one, just return it
		return allObjs
	} else {
		// They need to be ordered
		let orderedItems = orderedPiecesCache.get(partInfo.part._id)
		if (!orderedItems) {
			orderedItems = orderPieces(
				cache.Pieces.findFetch({ partId: partInfo.part._id }),
				partInfo.part._id,
				partInfo.part.getLastStartedPlayback()
			)
			orderedPiecesCache.set(partInfo.part._id, orderedItems)
		}

		let allowTransition = false
		let classesFromPreviousPart: string[] = []
		if (previousPartInfo && activePlaylist.currentPartInstanceId) {
			// If we have a previous and not at the start of the rundown
			allowTransition = !previousPartInfo.part.disableOutTransition
			classesFromPreviousPart = previousPartInfo.part.classesForNext || []
		}

		const transObj = orderedItems.find((i) => !!i.isTransition)
		const transObj2 = transObj ? partInfo.pieces.find((l) => l._id === transObj._id) : undefined
		const hasTransition =
			allowTransition &&
			transObj2 &&
			transObj2.content &&
			transObj2.content.timelineObjects &&
			transObj2.content.timelineObjects.find((o) => o != null && o.layer === layer)

		const res: TimelineObjRundown[] = []
		orderedItems.forEach((i) => {
			if (!partInfo || (!allowTransition && i.isTransition)) {
				return
			}

			const piece = partInfo.pieces.find((l) => l._id === i._id)
			if (!piece || !piece.content || !piece.content.timelineObjects) {
				return
			}

			// If there is a transition and this piece is abs0, it is assumed to be the primary piece and so does not need lookahead
			if (
				hasTransition &&
				!i.isTransition &&
				piece.enable.start === 0 // <-- need to discuss this!
			) {
				return
			}

			// Note: This is assuming that there is only one use of a layer in each piece.
			const obj = piece.content.timelineObjects.find((o) => o !== null && o.layer === layer)
			if (obj) {
				// Try and find a keyframe that is used when in a transition
				let transitionKF: TimelineTypes.TimelineKeyframe | undefined = undefined
				if (allowTransition) {
					transitionKF = _.find(obj.keyframes || [], (kf) => kf.enable.while === '.is_transition')

					// TODO - this keyframe matching is a hack, and is very fragile

					if (!transitionKF && classesFromPreviousPart && classesFromPreviousPart.length > 0) {
						// Check if the keyframe also uses a class to match. This handles a specific edge case
						transitionKF = _.find(obj.keyframes || [], (kf) =>
							_.any(classesFromPreviousPart, (cl) => kf.enable.while === `.is_transition & .${cl}`)
						)
					}
				}
				const newContent = Object.assign({}, obj.content, transitionKF ? transitionKF.content : {})

				// Calculate the pieceInstanceId or fallback to the pieceId. This is ok, as its only for lookahead
				const pieceInstanceId = partInstanceId ? wrapPieceToInstance(piece, partInstanceId)._id : piece._id

				res.push(
					literal<TimelineObjRundown & OnGenerateTimelineObj>({
						...obj,
						_id: protectString(''), // set later
						studioId: protectString(''), // set later
						objectType: TimelineObjType.RUNDOWN,
						pieceInstanceId: unprotectString(pieceInstanceId),
						infinitePieceId: unprotectString(piece.infiniteId),
						content: newContent,
					})
				)
			}
		})
		return res
	}
}
