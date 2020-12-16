import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import {
	LookaheadMode,
	Timeline as TimelineTypes,
	OnGenerateTimelineObj,
	TimelineObjectCoreExt,
} from 'tv-automation-sofie-blueprints-integration'
import { Studio, MappingExt } from '../../../lib/collections/Studios'
import { TimelineObjRundown, TimelineObjType } from '../../../lib/collections/Timeline'
import { Part, PartId } from '../../../lib/collections/Parts'
import { Piece, Pieces } from '../../../lib/collections/Pieces'
import { literal, clone, unprotectString, asyncCollectionFindFetch } from '../../../lib/lib'
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
import { profiler } from '../profiler'
import {
	hasPieceInstanceDefinitelyEnded,
	SelectedPartInstancesTimelineInfo,
	SelectedPartInstanceTimelineInfo,
} from './timeline'
import { Mongo } from 'meteor/mongo'

const LOOKAHEAD_OBJ_PRIORITY = 0.1

interface PartInstanceAndPieceInstances {
	part: PartInstance
	onTimeline: boolean
	allPieces: PieceInstance[]
}
interface PartAndPieces {
	part: Part
	pieces: Piece[] | PieceInstance[]
	// allPieces: PieceInstancePiece[]
}

function isPieceInstance(piece: Piece | PieceInstance | PieceInstancePiece): piece is PieceInstance {
	const tmpPiece = piece as PieceInstance
	return typeof tmpPiece.piece !== 'undefined'
}
function isPieceInstanceArray(pieces: Piece[] | PieceInstance[] | PieceInstancePiece[]): pieces is PieceInstance[] {
	const tmpPieces = pieces as PieceInstance[]
	const samplePiece = tmpPieces[0]
	return typeof samplePiece?.piece !== 'undefined'
}

function findLargestLookaheadDistance(mappings: Array<[string, MappingExt]>): number {
	const defaultSearchDistance = 10
	const values = mappings.map(([id, m]) => m.lookaheadMaxSearchDistance ?? defaultSearchDistance)
	return _.max(values)
}

/**
 * Excludes the previous, current and next part
 */
function getOrderedPartsAfterPlayhead(
	cache: CacheForRundownPlaylist,
	playlist: RundownPlaylist,
	partCount: number
): Part[] {
	if (partCount <= 0) {
		return []
	}
	const span = profiler.startSpan('getOrderedPartsAfterPlayhead')

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

	if (res.length < partCount && playlist.loop) {
		// The rundown would loop here, so lets run with that
		const playableParts = orderedParts.filter((p) => p.isPlayable())
		// Note: We only add it once, as lookahead is unlikely to show anything new in a second pass
		res.push(...playableParts)

		if (span) span.end()
		// Final trim to ensure it is within bounds
		return res.slice(0, partCount)
	} else {
		if (span) span.end()
		// We reached the target or ran out of parts
		return res.slice(0, partCount)
	}
}

export async function getLookeaheadObjects(
	cache: CacheForRundownPlaylist,
	studio: Studio,
	playlist: RundownPlaylist,
	partInstancesInfo0: SelectedPartInstancesTimelineInfo
): Promise<Array<TimelineObjRundown>> {
	const span = profiler.startSpan('getLookeaheadObjects')
	const mappingsToConsider = Object.entries(studio.mappings ?? {}).filter(
		([id, map]) => map.lookahead !== LookaheadMode.NONE
	)
	if (mappingsToConsider.length === 0) {
		if (span) span.end()
		return []
	}

	const maxLookaheadDistance = findLargestLookaheadDistance(mappingsToConsider)
	const orderedPartsFollowingPlayhead = getOrderedPartsAfterPlayhead(cache, playlist, maxLookaheadDistance)
	if (orderedPartsFollowingPlayhead.length === 0) {
		// Nothing to search through
		return []
	}

	const piecesToSearchQuery: Mongo.Query<Piece> = {
		startPartId: { $in: orderedPartsFollowingPlayhead.map((p) => p._id) },
		startRundownId: { $in: getRundownIDsFromCache(cache, playlist) },
		invalid: { $ne: true },
	}
	const pPiecesToSearch = cache.Pieces.initialized
		? Promise.resolve(cache.Pieces.findFetch(piecesToSearchQuery))
		: asyncCollectionFindFetch(Pieces, piecesToSearchQuery)

	const timelineObjs: Array<TimelineObjRundown> = []
	const mutateAndPushObject = (
		rawObj: TimelineObjRundown,
		i: string,
		enable: TimelineObjRundown['enable'],
		mapping: MappingExt,
		priority: number
	) => {
		const obj: TimelineObjRundown & OnGenerateTimelineObj = clone(rawObj)

		obj.id = `lookahead_${i}_${obj.id}`
		obj.priority = priority
		obj.enable = enable
		obj.isLookahead = true
		if (obj.keyframes) {
			obj.keyframes = obj.keyframes.filter((kf) => kf.preserveForLookahead)
		}
		delete obj.inGroup // force it to be cleared
		// delete obj.pieceInstanceId
		// delete obj.infinitePieceId

		if (mapping.lookahead === LookaheadMode.PRELOAD) {
			obj.lookaheadForLayer = obj.layer
			obj.layer += '_lookahead'
		}

		timelineObjs.push(obj)
	}

	// elsewhere uses prefixAllObjectIds to do this, but we want to apply to a single object from itself
	const getStartOfObjectRef = (obj: TimelineObjRundown & OnGenerateTimelineObj): string =>
		`#${obj.pieceInstanceId ?? ''}${obj.originalId ?? obj.id}.start`
	const calculateStartAfterPreviousObj = (
		prevObj: TimelineObjRundown & OnGenerateTimelineObj
	): TimelineTypes.TimelineEnable => {
		const prevHasDelayFlag = (prevObj.classes || []).indexOf('_lookahead_start_delay') !== -1

		// Start with previous piece
		const startOffset = prevHasDelayFlag ? 2000 : 0
		return {
			start: `${getStartOfObjectRef(prevObj)} + ${startOffset}`,
		}
	}

	function getPrunedEndedPieceInstances(info: SelectedPartInstanceTimelineInfo) {
		if (!info.partInstance.timings?.startedPlayback) {
			return info.pieceInstances
		} else {
			return info.pieceInstances.filter((p) => !hasPieceInstanceDefinitelyEnded(p, info.nowInPart))
		}
	}
	const partInstancesInfo: PartInstanceAndPieceInstances[] = _.compact([
		partInstancesInfo0.current
			? {
					part: partInstancesInfo0.current.partInstance,
					onTimeline: true,
					allPieces: getPrunedEndedPieceInstances(partInstancesInfo0.current),
			  }
			: undefined,
		partInstancesInfo0.next
			? {
					part: partInstancesInfo0.next.partInstance,
					onTimeline: !!partInstancesInfo0.current?.partInstance?.part?.autoNext,
					allPieces: partInstancesInfo0.next.pieceInstances,
			  }
			: undefined,
	])
	// Track the previous info for checking how the timeline will be built
	let previousPartInfo: PartInstanceAndPieceInstances | undefined
	if (partInstancesInfo0.previous) {
		previousPartInfo = {
			part: partInstancesInfo0.previous.partInstance,
			onTimeline: true,
			allPieces: getPrunedEndedPieceInstances(partInstancesInfo0.previous),
		}
	}

	// TODO: Do we need to use processAndPrunePieceInstanceTimings on these pieces? In theory yes, but that gets messy and expensive.
	// In reality, there are not likely to be any/many conflicts if the blueprints are written well so it shouldnt be a problem
	const piecesToSearch = await pPiecesToSearch

	const piecesByPart = new Map<PartId, Piece[]>()
	for (const piece of piecesToSearch) {
		const existing = piecesByPart.get(piece.startPartId)
		if (existing) {
			existing.push(piece)
		} else {
			piecesByPart.set(piece.startPartId, [piece])
		}
	}

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
			piecesByPart,
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

			enable.end = getStartOfObjectRef(entry.obj)

			mutateAndPushObject(entry.obj, `timed${i}`, enable, mapping, LOOKAHEAD_OBJ_PRIORITY)
		})

		// Add each of the future objects, that have no end point
		const futureObjCount = lookaheadObjs.future.length
		const futurePriorityScale = LOOKAHEAD_OBJ_PRIORITY / (futureObjCount + 1)
		lookaheadObjs.future.forEach((entry, i) => {
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
	}
	if (span) span.end()
	return timelineObjs
}

export interface LookaheadObjectEntry {
	obj: TimelineObjRundown & OnGenerateTimelineObj
	// pieceInstanceId: PieceInstanceId
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
	piecesByPart: Map<PartId, Piece[]>,
	layer: string,
	mode: LookaheadMode,
	lookaheadTargetObjects: number,
	lookaheadMaxSearchDistance: number
): LookaheadResult {
	const span = profiler.startSpan('findLookaheadForlayer')
	const res: LookaheadResult = {
		timed: [],
		future: [],
	}

	if (mode === undefined || mode === LookaheadMode.NONE || lookaheadMaxSearchDistance <= 0) {
		return res
	}

	// Track the previous info for checking how the timeline will be built
	let previousPartInfo: PartAndPieces | undefined
	if (previousPartInstanceInfo) {
		previousPartInfo = {
			part: previousPartInstanceInfo.part.part,
			pieces: previousPartInstanceInfo.allPieces,
		}
	}

	// Generate timed objects for parts on the timeline
	for (const partInstanceInfo of partInstancesInfo) {
		const partInfo: PartAndPieces = {
			part: partInstanceInfo.part.part,
			pieces: partInstanceInfo.allPieces,
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
		for (const part of orderedPartsFollowingPlayhead.slice(0, lookaheadMaxSearchDistance - 1)) {
			// Stop if we have enough objects already
			if (res.future.length >= lookaheadTargetObjects) {
				break
			}

			const pieces = piecesByPart.get(part._id) ?? []
			if (pieces.length > 0 && part.isPlayable()) {
				const partInfo: PartAndPieces = { part, pieces }
				findObjectsForPart(playlist, layer, previousPartInfo, partInfo, null).forEach((o) =>
					res.future.push({ obj: o, partId: part._id })
				)
				previousPartInfo = partInfo
			}
		}
	}

	if (span) span.end()
	return res
}

function getBestPieceIsntanceId(
	piece: PieceInstance | Piece,
	partInfo: PartAndPieces,
	partInstanceId: PartInstanceId | null
): string {
	if (isPieceInstance(piece)) {
		return unprotectString(piece._id)
	}
	if (partInstanceId) {
		// Approximate what it would be
		return unprotectString(rewrapPieceToInstance(piece, partInfo.part.rundownId, partInstanceId)._id)
	}
	// Something is needed, and it must be distant future here, so accuracy is not important
	return unprotectString(piece._id)
}

// type MatchedTimelineObj = RequiredSelective<TimelineObjRundown & OnGenerateTimelineObj, 'pieceInstanceId'>
function tryActivateKeyframesForObject(
	obj: TimelineObjectCoreExt,
	hasTransition: boolean,
	classesFromPreviousPart: string[] | undefined
): TimelineObjectCoreExt['content'] {
	// Try and find a keyframe that is used when in a transition
	let transitionKF: TimelineTypes.TimelineKeyframe | undefined = undefined
	if (hasTransition) {
		transitionKF = _.find(
			obj.keyframes || [],
			(kf) => !Array.isArray(kf.enable) && kf.enable.while === '.is_transition'
		)

		// TODO - this keyframe matching is a hack, and is very fragile

		if (!transitionKF && classesFromPreviousPart && classesFromPreviousPart.length > 0) {
			// Check if the keyframe also uses a class to match. This handles a specific edge case
			transitionKF = _.find(obj.keyframes || [], (kf) =>
				_.any(
					classesFromPreviousPart,
					(cl) => !Array.isArray(kf.enable) && kf.enable.while === `.is_transition & .${cl}`
				)
			)
		}
		return { ...obj.content, ...transitionKF?.content }
	} else {
		return obj.content
	}
}

function findObjectsForPart(
	playlist: RundownPlaylist,
	layer: string,
	previousPartInfo: PartAndPieces | undefined,
	partInfo: PartAndPieces,
	partInstanceId: PartInstanceId | null
): Array<TimelineObjRundown & OnGenerateTimelineObj> {
	// Sanity check, if no part to search, then abort
	if (!partInfo || partInfo.pieces.length === 0) {
		return []
	}
	const span = profiler.startSpan('findObjectsForPart')

	let allObjs: Array<TimelineObjRundown & OnGenerateTimelineObj> = []
	for (const rawPiece of partInfo.pieces) {
		const tmpPieceInstanceId = getBestPieceIsntanceId(rawPiece, partInfo, partInstanceId)
		const piece = isPieceInstance(rawPiece) ? rawPiece.piece : rawPiece
		for (const obj of piece.content?.timelineObjects ?? []) {
			if (obj && obj.layer === layer) {
				allObjs.push(
					literal<TimelineObjRundown & OnGenerateTimelineObj>({
						...obj,
						objectType: TimelineObjType.RUNDOWN,
						pieceInstanceId: tmpPieceInstanceId,
					})
				)
			}
		}
	}

	if (allObjs.length === 0) {
		if (span) span.end()
		// Should never happen. suggests something got 'corrupt' during this process
		return []
	}

	let allowTransition = !partInstanceId
	let classesFromPreviousPart: string[] = []
	if (previousPartInfo && playlist.currentPartInstanceId && partInstanceId) {
		// If we have a previous and not at the start of the rundown
		allowTransition = !previousPartInfo.part.disableOutTransition
		classesFromPreviousPart = previousPartInfo.part.classesForNext || []
	}

	const rawPieces = isPieceInstanceArray(partInfo.pieces) ? partInfo.pieces.map((p) => p.piece) : partInfo.pieces
	const transitionPiece = rawPieces.find((i) => !!i.isTransition)

	if (allObjs.length === 1) {
		// Only one, just return it
		const obj = allObjs[0]
		const patchedContent = tryActivateKeyframesForObject(
			obj,
			allowTransition && !!transitionPiece,
			classesFromPreviousPart
		)

		if (span) span.end()
		return [
			{
				...obj,
				content: patchedContent,
			},
		]
	} else {
		// They need to be ordered
		const orderedPieces = sortPiecesByStart(rawPieces)

		const hasTransitionObj =
			allowTransition && !!transitionPiece?.content?.timelineObjects?.find((o) => o != null && o.layer === layer)

		const res: Array<TimelineObjRundown & OnGenerateTimelineObj> = []
		orderedPieces.forEach((piece) => {
			if (!partInfo || (!allowTransition && piece.isTransition)) {
				return
			}

			// If there is a transition and this piece is abs0, it is assumed to be the primary piece and so does not need lookahead
			if (
				hasTransitionObj &&
				!piece.isTransition &&
				piece.enable.start === 0 // <-- need to discuss this!
			) {
				return
			}

			// Note: This is assuming that there is only one use of a layer in each piece.
			const obj = piece.content?.timelineObjects?.find((o) => o !== null && o.layer === layer)
			if (obj) {
				const patchedContent = tryActivateKeyframesForObject(obj, hasTransitionObj, classesFromPreviousPart)

				// Calculate the pieceInstanceId or fallback to the pieceId. This is ok, as its only for lookahead
				const pieceInstanceId = partInstanceId
					? rewrapPieceToInstance(piece, partInfo.part.rundownId, partInstanceId)._id
					: piece._id

				res.push(
					literal<TimelineObjRundown & OnGenerateTimelineObj>({
						...obj,
						objectType: TimelineObjType.RUNDOWN,
						pieceInstanceId: unprotectString(pieceInstanceId),
						infinitePieceId: unprotectString(piece._id),
						content: patchedContent,
					})
				)
			}
		})

		if (span) span.end()
		return res
	}
}
