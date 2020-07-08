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
import { Piece, Pieces } from '../../../lib/collections/Pieces'
import { literal, clone, unprotectString, protectString, asyncCollectionFindFetch } from '../../../lib/lib'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { PieceInstance, PieceInstancePiece, rewrapPieceToInstance } from '../../../lib/collections/PieceInstances'
import {
	selectNextPart,
	getSelectedPartInstancesFromCache,
	getAllOrderedPartsFromCache,
	getRundownIDsFromCache,
} from './lib'
import { PartInstanceId, PartInstance } from '../../../lib/collections/PartInstances'
import { CacheForRundownPlaylist } from '../../DatabaseCaches'
import { sortPiecesByStart } from './pieces'

const LOOKAHEAD_OBJ_PRIORITY = 0.1

interface PartInstanceAndPieceInstances {
	part: PartInstance
	onTimeline: boolean
	allPieces: PieceInstance[]
}
interface PartAndPieces {
	part: Part
	pieces: PieceInstancePiece[]
	// allPieces: PieceInstancePiece[]
}

function findLargestLookaheadDistance(mappings: Array<[string, MappingExt]>): number {
	const defaultSearchDistance = 10 // TODO-INFINITES - refine (Note: This is a breaking change to before)
	const values = mappings.map(([id, m]) => m.lookaheadMaxSearchDistance ?? defaultSearchDistance)
	return _.max(values)
}

// TODO-INFINITES this might be useful elsewhere, maybe it should move?
/**
 * Excludes the previous, current and next part
 */
export function getOrderedPartsAfterPlayhead(
	cache: CacheForRundownPlaylist,
	playlist: RundownPlaylist,
	partCount: number
): Part[] {
	if (partCount <= 0) {
		return []
	}

	const orderedParts = getAllOrderedPartsFromCache(cache, playlist)
	const { currentPartInstance, nextPartInstance } = getSelectedPartInstancesFromCache(cache, playlist)

	// If the nextPartInstance consumes the
	const alreadyConsumedNextSegmentId =
		nextPartInstance && (!currentPartInstance || currentPartInstance.segmentId !== nextPartInstance.segmentId)

	const strippedPlaylist = {
		nextSegmentId: alreadyConsumedNextSegmentId ? undefined : playlist.nextSegmentId,
		loop: playlist.loop,
	}
	const nextNextPart = selectNextPart(strippedPlaylist, nextPartInstance ?? currentPartInstance ?? null, orderedParts)
	if (!nextNextPart) {
		// We don't know where to begin searching, so we can't do anything
		return []
	}

	const playablePartsSlice = orderedParts.slice(nextNextPart.index).filter((p) => p.isPlayable())

	const res: Part[] = []

	const nextSegmentIndex = playablePartsSlice.findIndex((p) => p.segmentId === playlist.nextSegmentId)
	if (
		playlist.nextSegmentId &&
		!alreadyConsumedNextSegmentId &&
		nextSegmentIndex !== -1 &&
		!nextNextPart.consumesNextSegmentId
	) {
		// TODO - this if clause needs some decent testing

		// Push the next part and the remainder of its segment
		res.push(...playablePartsSlice.filter((p) => p.segmentId === nextNextPart.part.segmentId))

		// Push from nextSegmentId to the end of the playlist
		res.push(...playablePartsSlice.slice(nextSegmentIndex))
	} else {
		// Push as many parts as we want
		res.push(...playablePartsSlice)
	}

	if (res.length < partCount && !playlist.loop) {
		// The rundown would loop here, so lets run with that
		const playableParts = orderedParts.filter((p) => p.isPlayable())
		// Note: We only add it once, as lookahead is unlikely to show anything new in a second pass
		res.push(...playableParts)

		// Final trim to ensure it is within bounds
		return res.slice(0, partCount)
	} else {
		// We reached the target or ran out of parts
		return res.slice(0, partCount)
	}
}

export async function getLookeaheadObjects(
	cache: CacheForRundownPlaylist,
	studio: Studio,
	playlist: RundownPlaylist
): Promise<Array<TimelineObjGeneric>> {
	const mappingsToConsider = Object.entries(studio.mappings ?? {}).filter(
		([id, map]) => map.lookahead !== LookaheadMode.NONE
	)
	if (mappingsToConsider.length === 0) {
		return []
	}

	const maxLookaheadDistance = findLargestLookaheadDistance(mappingsToConsider)
	const orderedPartsFollowingPlayhead = getOrderedPartsAfterPlayhead(cache, playlist, maxLookaheadDistance)
	if (orderedPartsFollowingPlayhead.length === 0) {
		// Nothing to search through
		return []
	}

	const rundownIds = getRundownIDsFromCache(cache, playlist)
	const pPiecesToSearch = asyncCollectionFindFetch(Pieces, {
		startPartId: { $in: orderedPartsFollowingPlayhead.map((p) => p._id) },
		startRundownId: { $in: rundownIds },
	})

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
			return !!(pieceInstance.partInstanceId === partInstanceId && pieceInstance.piece.content?.timelineObjects)
		})
	}
	const { currentPartInstance, nextPartInstance, previousPartInstance } = getSelectedPartInstancesFromCache(
		cache,
		playlist
	)
	// Get the PieceInstances which are on the timeline
	const partInstancesInfo: PartInstanceAndPieceInstances[] = _.compact([
		currentPartInstance
			? {
					part: currentPartInstance,
					onTimeline: true,
					allPieces: getPartInstancePieces(currentPartInstance._id),
			  }
			: undefined,
		nextPartInstance
			? {
					part: nextPartInstance,
					onTimeline: !!currentPartInstance?.part?.autoNext,
					allPieces: getPartInstancePieces(nextPartInstance._id),
			  }
			: undefined,
	])
	// Track the previous info for checking how the timeline will be built
	let previousPartInfo: PartInstanceAndPieceInstances | undefined
	if (previousPartInstance) {
		const previousPieces = getPartInstancePieces(previousPartInstance._id)
		previousPartInfo = {
			part: previousPartInstance,
			onTimeline: true,
			allPieces: previousPieces,
		}
	}

	const piecesToSearch = await pPiecesToSearch

	for (const [layerId, mapping] of mappingsToConsider) {
		const lookaheadTargetObjects = mapping.lookahead === LookaheadMode.PRELOAD ? mapping.lookaheadDepth || 1 : 1 // TODO - test other modes
		const lookaheadMaxSearchDistance =
			mapping.lookaheadMaxSearchDistance !== undefined && mapping.lookaheadMaxSearchDistance >= 0
				? mapping.lookaheadMaxSearchDistance
				: orderedPartsFollowingPlayhead.length
		const lookaheadObjs = findLookaheadForlayer(
			playlist,
			partInstancesInfo,
			previousPartInfo,
			orderedPartsFollowingPlayhead,
			piecesToSearch,
			layerId,
			mapping.lookahead,
			lookaheadTargetObjects,
			lookaheadMaxSearchDistance
		)

		// Add the objects that have some timing info
		lookaheadObjs.timed.forEach((entry, i) => {
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
		lookaheadObjs.future.forEach((entry, i) => {
			if (!entry.obj.id) throw new Meteor.Error(500, 'lookahead: timeline obj id not set')

			// WHEN_CLEAR mode can't take multiple futures, as they are always flattened into the single layer. so give it some real timings, and only output one
			const singleFutureObj = mapping.lookahead !== LookaheadMode.WHEN_CLEAR
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
	}
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
	playlist: RundownPlaylist,
	partInstancesInfo: PartInstanceAndPieceInstances[],
	previousPartInstanceInfo: PartInstanceAndPieceInstances | undefined,
	orderedPartsFollowingPlayhead: Part[],
	piecesToSearch: Piece[],
	layer: string,
	mode: LookaheadMode,
	lookaheadTargetObjects: number,
	lookaheadMaxSearchDistance: number
): LookaheadResult {
	const res: LookaheadResult = {
		timed: [],
		future: [],
	}

	if (mode === undefined || mode === LookaheadMode.NONE || lookaheadMaxSearchDistance <= 0) {
		return res
	}

	function filterPartInstancePieces(pieces: PieceInstance[]) {
		return pieces.filter((p) => !!_.find(p.piece.content?.timelineObjects ?? [], (o) => o && o.layer === layer))
	}

	// Track the previous info for checking how the timeline will be built
	let previousPartInfo: PartAndPieces | undefined
	if (previousPartInstanceInfo) {
		const previousPieces = filterPartInstancePieces(previousPartInstanceInfo.allPieces)
		previousPartInfo = {
			part: previousPartInstanceInfo.part.part,
			pieces: previousPieces.map((p) => p.piece),
		}
	}

	// Generate timed objects for parts on the timeline
	for (const partInstanceInfo of partInstancesInfo) {
		const pieces = filterPartInstancePieces(partInstanceInfo.allPieces)
		const partInfo: PartAndPieces = {
			part: partInstanceInfo.part.part,
			pieces: pieces.map((p) => p.piece),
		}

		findObjectsForPart(playlist, layer, previousPartInfo, partInfo, partInstanceInfo.part._id).forEach((o) => {
			if (partInstanceInfo.onTimeline) {
				res.timed.push({ obj: o, partId: partInstanceInfo.part.part._id })
			} else {
				res.future.push({ obj: o, partId: partInstanceInfo.part.part._id })
			}
		})
		previousPartInfo = partInfo
	}

	if (lookaheadMaxSearchDistance > 1) {
		// have pieces grouped by part, so we can look based on rank to choose the correct one
		const piecesUsingLayerByPart = new Map<PartId, Piece[]>()
		for (const piece of piecesToSearch) {
			if (_.find(piece.content?.timelineObjects ?? [], (o) => o && o.layer === layer)) {
				const existing = piecesUsingLayerByPart.get(piece.startPartId)
				if (existing) {
					existing.push(piece)
				} else {
					piecesUsingLayerByPart.set(piece.startPartId, [piece])
				}
			}
		}

		for (const part of orderedPartsFollowingPlayhead.slice(0, lookaheadMaxSearchDistance - 1)) {
			// Stop if we have enough objects already
			if (res.future.length >= lookaheadTargetObjects) {
				break
			}

			const pieces = piecesUsingLayerByPart.get(part._id) ?? []
			if (pieces.length > 0 && part.isPlayable()) {
				const partInfo: PartAndPieces = { part, pieces }
				findObjectsForPart(playlist, layer, previousPartInfo, partInfo, null).forEach((o) =>
					res.future.push({ obj: o, partId: part._id })
				)
				previousPartInfo = partInfo
			}
		}
	}

	return res
}

function findObjectsForPart(
	playlist: RundownPlaylist,
	layer: string,
	previousPartInfo: PartAndPieces | undefined,
	partInfo: PartAndPieces,
	partInstanceId: PartInstanceId | null
): (TimelineObjRundown & OnGenerateTimelineObj)[] {
	// Sanity check, if no part to search, then abort
	if (!partInfo || partInfo.pieces.length === 0) {
		return []
	}

	let allObjs: TimelineObjRundown[] = []
	for (const piece of partInfo.pieces) {
		// Calculate the pieceInstanceId or fallback to the pieceId. This is ok, as its only for lookahead
		const pieceInstanceId = partInstanceId
			? rewrapPieceToInstance(piece, partInfo.part.rundownId, partInstanceId)._id
			: piece._id

		for (const obj of piece.content?.timelineObjects ?? []) {
			if (obj) {
				fixTimelineId(obj)
				allObjs.push(
					literal<TimelineObjRundown & OnGenerateTimelineObj>({
						...obj,
						_id: protectString(''), // set later
						studioId: protectString(''), // set later
						objectType: TimelineObjType.RUNDOWN,
						pieceInstanceId: unprotectString(pieceInstanceId),
						infinitePieceId: unprotectString(piece._id),
					})
				)
			}
		}
	}

	if (allObjs.length === 0) {
		// Should never happen. suggests something got 'corrupt' during this process
		return []
	} else if (allObjs.length === 1) {
		// Only one, just return it
		return allObjs
	} else {
		// They need to be ordered
		const orderedPieces = sortPiecesByStart(partInfo.pieces)

		let allowTransition = false
		let classesFromPreviousPart: string[] = []
		if (previousPartInfo && playlist.currentPartInstanceId) {
			// If we have a previous and not at the start of the rundown
			allowTransition = !previousPartInfo.part.disableOutTransition
			classesFromPreviousPart = previousPartInfo.part.classesForNext || []
		}

		const transObj = orderedPieces.find((i) => !!i.isTransition)
		const hasTransition =
			allowTransition && transObj?.content?.timelineObjects?.find((o) => o != null && o.layer === layer)

		const res: TimelineObjRundown[] = []
		orderedPieces.forEach((piece) => {
			if (!partInfo || (!allowTransition && piece.isTransition)) {
				return
			}

			// If there is a transition and this piece is abs0, it is assumed to be the primary piece and so does not need lookahead
			if (
				hasTransition &&
				!piece.isTransition &&
				piece.enable.start === 0 // <-- need to discuss this!
			) {
				return
			}

			// Note: This is assuming that there is only one use of a layer in each piece.
			const obj = piece.content?.timelineObjects?.find((o) => o !== null && o.layer === layer)
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
				const pieceInstanceId = partInstanceId
					? rewrapPieceToInstance(piece, partInfo.part.rundownId, partInstanceId)._id
					: piece._id

				res.push(
					literal<TimelineObjRundown & OnGenerateTimelineObj>({
						...obj,
						_id: protectString(''), // set later
						studioId: protectString(''), // set later
						objectType: TimelineObjType.RUNDOWN,
						pieceInstanceId: unprotectString(pieceInstanceId),
						infinitePieceId: unprotectString(piece._id),
						content: newContent,
					})
				)
			}
		})
		return res
	}
}
