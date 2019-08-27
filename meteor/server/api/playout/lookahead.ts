import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { LookaheadMode, Timeline as TimelineTypes, OnGenerateTimelineObj } from 'tv-automation-sofie-blueprints-integration'
import { RundownData, Rundown } from '../../../lib/collections/Rundowns'
import { Studio, MappingExt } from '../../../lib/collections/Studios'
import { TimelineObjGeneric, TimelineObjRundown, fixTimelineId, TimelineObjType } from '../../../lib/collections/Timeline'
import { Part } from '../../../lib/collections/Parts'
import { Piece } from '../../../lib/collections/Pieces'
import { getOrderedPiece } from './pieces'
import { literal, extendMandadory, clone } from '../../../lib/lib'
import { RundownPlaylist, RundownPlaylistData } from '../../../lib/collections/RundownPlaylists'

const LOOKAHEAD_OBJ_PRIORITY = 0.1

export function getLookeaheadObjects (rundownData: RundownPlaylistData, studio: Studio): Array<TimelineObjGeneric> {
	const activePlaylist = rundownData.rundownPlaylist
	const currentPart = activePlaylist.currentPartId ? rundownData.partsMap[activePlaylist.currentPartId] : undefined

	const timelineObjs: Array<TimelineObjGeneric> = []
	const mutateAndPushObject = (rawObj: TimelineObjRundown, i: string, enable: TimelineObjRundown['enable'], mapping: MappingExt, priority: number) => {
		const obj: TimelineObjGeneric = clone(rawObj)

		obj.id = `lookahead_${i}_${obj.id}`
		obj.priority = priority
		obj.enable = enable
		obj.isLookahead = true
		delete obj.keyframes
		delete obj.inGroup // force it to be cleared

		if (mapping.lookahead === LookaheadMode.PRELOAD) {
			obj.lookaheadForLayer = obj.layer
			obj.layer += '_lookahead'
		}

		timelineObjs.push(obj)
	}

	_.each(studio.mappings || {}, (mapping: MappingExt, layerId: string) => {
		const lookaheadDepth = mapping.lookahead === LookaheadMode.PRELOAD ? mapping.lookaheadDepth || 1 : 1 // TODO - test other modes
		const lookaheadObjs = findLookaheadForlayer(rundownData, layerId, mapping.lookahead, lookaheadDepth)

		// Add the objects that have some timing info
		_.each(lookaheadObjs.timed, (entry, i) => {
			const enable: TimelineTypes.TimelineEnable = {
				start: 1 // Absolute 0 without a group doesnt work
			}
			if (i !== 0) {
				const prevObj = lookaheadObjs.timed[i - 1].obj
				const prevHasDelayFlag = (prevObj.classes || []).indexOf('_lookahead_start_delay') !== -1

				// Start with previous piece
				const startOffset = prevHasDelayFlag ? 1000 : 0
				enable.start = `#${prevObj.id}.start + ${startOffset}`
			}
			if (!entry.obj.id) throw new Meteor.Error(500, 'lookahead: timeline obj id not set')

			const finiteDuration = entry.partId === activePlaylist.currentPartId || (currentPart && currentPart.autoNext && entry.partId === activePlaylist.nextPartId)
			enable.end = finiteDuration ? `#${entry.obj.id}.start` : undefined

			mutateAndPushObject(entry.obj, `timed${i}`, enable, mapping, LOOKAHEAD_OBJ_PRIORITY)
		})

		// Add each of the future objects, that have no end point
		const futureObjCount = lookaheadObjs.future.length
		const futurePriorityScale = LOOKAHEAD_OBJ_PRIORITY / (futureObjCount + 1)
		_.each(lookaheadObjs.future, (entry, i) => {
			if (!entry.obj.id) throw new Meteor.Error(500, 'lookahead: timeline obj id not set')

			// Prioritise so that the earlier ones are higher, decreasing within the range 'reserved' for lookahead
			const priority = futurePriorityScale * (futureObjCount - i)
			mutateAndPushObject(entry.obj, `future${i}`, { while: '1' }, mapping, priority)
			// We use while: 1 for the enabler, as any time before it should be active will be filled by either a playing object, or a timed lookahead.
			// And this allows multiple futures to be timed in a way that allows them to co-exist
		})
	})
	return timelineObjs
}

interface PartInfo {
	partId: string
	segmentId: string
	part: Part
}
interface PartInfoWithPieces extends PartInfo {
	pieces: Piece[]
}

export interface LookaheadObjectEntry {
	obj: TimelineObjRundown
	partId: string
}

export interface LookaheadResult {
	timed: Array<LookaheadObjectEntry>
	future: Array<LookaheadObjectEntry>
}

export function findLookaheadForlayer (
	rundownData: RundownPlaylistData,
	layer: string,
	mode: LookaheadMode,
	lookaheadDepth: number
	): LookaheadResult {
	let activePlaylist: RundownPlaylist = rundownData.rundownPlaylist
	const currentPart = activePlaylist.currentPartId ? rundownData.partsMap[activePlaylist.currentPartId] : undefined
	const currentRundown = currentPart ? rundownData.rundownsMap[currentPart.rundownId] : undefined

	if (mode === undefined || mode === LookaheadMode.NONE) {
		return { timed: [], future: [] }
	}

	// find all pieces that touch the layer
	const piecesUsingLayer = _.filter(rundownData.pieces, (piece: Piece) => {
		return !!(
			piece.content &&
			piece.content.timelineObjects &&
			_.find(piece.content.timelineObjects, (o) => (o && o.layer === layer))
		)
	})
	if (piecesUsingLayer.length === 0) {
		return { timed: [], future: [] }
	}

	// If mode is retained, and only one instance exists in the rundown, then we can take a shortcut
	if (mode === LookaheadMode.RETAIN && piecesUsingLayer.length === 1) {
		const piece = piecesUsingLayer[0]
		if (piece.content && piece.content.timelineObjects) {
			const obj = piece.content.timelineObjects.find(o => o !== null && o.layer === layer)
			if (obj) {
				fixTimelineId(obj)
				return {
					timed: [], // TODO - is this correct?
					future: [{ obj: obj as TimelineObjRundown, partId: piece.partId }]
				}
			}
		}
		return { timed: [], future: [] }
	}

	// have pieces grouped by part, so we can look based on rank to choose the correct one
	const piecesUsingLayerByPart: {[partId: string]: Piece[]} = {}
	piecesUsingLayer.forEach(i => {
		if (!piecesUsingLayerByPart[i.partId]) {
			piecesUsingLayerByPart[i.partId] = []
		}

		piecesUsingLayerByPart[i.partId].push(i)
	})

	const { timeOrderedParts, currentPartIndex, currentSegmentId } = getPartsOrderedByTime(rundownData)
	if (timeOrderedParts.length === 0) {
		return { timed: [], future: [] }
	}


	const timeOrderedPartsWithPieces: PartInfoWithPieces[] = timeOrderedParts.map(part => ({
		...part,
		pieces: piecesUsingLayerByPart[part.partId] || []
	}))

	// Start by taking the value from the current (if any), or search forwards
	let startingPartOnLayer: PartInfoWithPieces | undefined
	let startingPartOnLayerIndex: number = -1
	for (let i = currentPartIndex; i < timeOrderedPartsWithPieces.length; i++) {
		const v = timeOrderedPartsWithPieces[i]
		if (v.pieces.length > 0) {
			startingPartOnLayer = v
			startingPartOnLayerIndex = i
			break
		}
	}

	// If set to retain, then look backwards.
	// This sets the previous usage of the layer as the current part. This lets the algorithm include the object even though it has already played and finished
	if (mode === LookaheadMode.RETAIN) {
		for (let i = currentPartIndex - 1; i >= 0; i--) {
			const part = timeOrderedPartsWithPieces[i]

			// abort if the piece potential match is from another segment
			if (startingPartOnLayer && part.segmentId !== currentSegmentId) {
				break
			}

			if (part.pieces.length > 0) {
				startingPartOnLayer = part
				startingPartOnLayerIndex = i
				break
			}
		}
	}

	// No possible part was found using the layer, so nothing to lookahead
	if (!startingPartOnLayer) {
		return { timed: [], future: [] }
	}

	const res: LookaheadResult = {
		timed: [],
		future: []
	}

	const partId = startingPartOnLayer.partId
	const startingPartIsFuture = startingPartOnLayer.partId !== activePlaylist.currentPartId
	findObjectsForPart(rundownData, layer, timeOrderedPartsWithPieces, startingPartOnLayerIndex, startingPartOnLayer)
		.forEach(o => (startingPartIsFuture ? res.future : res.timed).push({ obj: o, partId: partId }))

	// Loop over future parts until we have enough objects, or run out of parts
	let nextPartOnLayerIndex = startingPartOnLayerIndex
	while (nextPartOnLayerIndex !== -1 && res.future.length < lookaheadDepth) {
		nextPartOnLayerIndex = _.findIndex(timeOrderedPartsWithPieces, (v, i) => i > nextPartOnLayerIndex && v.pieces.length > 0)

		if (nextPartOnLayerIndex !== -1) {
			const nextPartOnLayer = timeOrderedPartsWithPieces[nextPartOnLayerIndex]
			const partId = nextPartOnLayer.partId
			findObjectsForPart(rundownData, layer, timeOrderedPartsWithPieces, nextPartOnLayerIndex, nextPartOnLayer)
				.forEach(o => res.future.push({ obj: o, partId: partId }))
		}
	}

	return res
}

function getPartsOrderedByTime (rundownData: RundownPlaylistData) {
	// This could be cached across all lookahead layers, as it doesnt care about layer
	const activePlaylist = rundownData.rundownPlaylist

	// calculate ordered list of parts, which can be cached for other layers
	const parts = rundownData.parts.map(part => ({
		partId: part._id,
		rank: part._rank,
		segmentId: part.segmentId,
		part: part
	}))
	parts.sort((a, b) => {
		if (a.rank < b.rank) {
			return -1
		}
		if (a.rank > b.rank) {
			return 1
		}
		return 0
	})

	let currentPartIndex = 0
	let currentSegmentId: string | undefined

	const currentIndex = parts.findIndex(l => l.partId === activePlaylist.currentPartId)
	let partInfos: PartInfo[] = []
	if (currentIndex >= 0) {
		// Find the current part, and the parts before
		partInfos = partInfos.concat(parts.slice(0, currentIndex + 1))
		currentSegmentId = partInfos[partInfos.length - 1].segmentId
		currentPartIndex = currentIndex
	}

	// Find the next part
	const nextPartIndex = activePlaylist.nextPartId
		? parts.findIndex(l => l.partId === activePlaylist.nextPartId)
		: (currentIndex >= 0 ? currentIndex + 1 : -1)

	if (nextPartIndex >= 0) {
		// Add the future parts to the array
		partInfos = partInfos.concat(...parts.slice(nextPartIndex))
	}

	const timeOrderedParts = partInfos.map(partInfo => ({
		partId: partInfo.partId,
		segmentId: partInfo.segmentId,
		part: partInfo.part
	}))

	return {
		timeOrderedParts,
		currentPartIndex,
		currentSegmentId
	}
}

function findObjectsForPart (rundownData: RundownPlaylistData, layer: string, timeOrderedPartsWithPieces: PartInfoWithPieces[], startingPartOnLayerIndex: number, startingPartOnLayer: PartInfoWithPieces): (TimelineObjRundown & OnGenerateTimelineObj)[] {
	const activePlaylist = rundownData.rundownPlaylist
	const activeRundown = rundownData.rundownsMap[startingPartOnLayer.part.rundownId]

	// Sanity check, if no part to search, then abort
	if (!startingPartOnLayer || startingPartOnLayer.pieces.length === 0) {
		return []
	}

	let allObjs: TimelineObjRundown[] = []
	startingPartOnLayer.pieces.forEach(i => {
		if (i.content && i.content.timelineObjects) {

			_.each(i.content.timelineObjects, (obj) => {
				if (obj) {
					fixTimelineId(obj)
					allObjs.push(literal<TimelineObjRundown & OnGenerateTimelineObj>({
						...obj,
						_id: '', // set later
						studioId: '', // set later
						objectType: TimelineObjType.RUNDOWN,
						rundownId: activeRundown._id,
						playlistId: activePlaylist._id,
						pieceId: i._id,
						infinitePieceId: i.infiniteId
					}))
				}
			})
		}
	})
	// let allObjs: TimelineObjRundown[] = _.compact(rawObjs)

	if (allObjs.length === 0) {
		// Should never happen. suggests something got 'corrupt' during this process
		return []
	}
	if (allObjs.length > 1) {
		if (startingPartOnLayer.part) {
			const orderedItems = getOrderedPiece(startingPartOnLayer.part)

			let allowTransition = false
			if (startingPartOnLayerIndex >= 1 && activePlaylist.currentPartId) {
				const prevPieceGroup = timeOrderedPartsWithPieces[startingPartOnLayerIndex - 1]
				allowTransition = !prevPieceGroup.part.disableOutTransition
			}

			const transObj = orderedItems.find(i => !!i.isTransition)
			const transObj2 = transObj ? startingPartOnLayer.pieces.find(l => l._id === transObj._id) : undefined
			const hasTransition = (
				allowTransition &&
				transObj2 &&
				transObj2.content &&
				transObj2.content.timelineObjects &&
				transObj2.content.timelineObjects.find(o => o != null && o.layer === layer)
			)

			const res: TimelineObjRundown[] = []
			orderedItems.forEach(i => {
				if (!startingPartOnLayer || (!allowTransition && i.isTransition)) {
					return
				}

				const piece = startingPartOnLayer.pieces.find(l => l._id === i._id)
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
				const obj = piece.content.timelineObjects.find(o => o !== null && o.layer === layer)
				if (obj) {
					// Try and find a keyframe that is used when in a transition
					let transitionKF: TimelineTypes.TimelineKeyframe | undefined = undefined
					if (allowTransition) {
						transitionKF = _.find(obj.keyframes || [], kf => kf.enable.while === '.is_transition')
					}
					const newContent = Object.assign({}, obj.content, transitionKF ? transitionKF.content : {})

					res.push(literal<TimelineObjRundown & OnGenerateTimelineObj>({
						...obj,
						_id: '', // set later
						studioId: '', // set later
						objectType: TimelineObjType.RUNDOWN,
						rundownId: activeRundown._id,
						playlistId: rundownData.rundownPlaylist._id,
						pieceId: piece._id,
						infinitePieceId: piece.infiniteId,
						content: newContent
					}))
				}
			})

			return res
		}
	}

	return allObjs
}
