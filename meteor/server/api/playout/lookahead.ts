import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { LookaheadMode, TimelineObjectCoreExt, Timeline as TimelineTypes } from 'tv-automation-sofie-blueprints-integration'
import { RundownData, Rundown } from '../../../lib/collections/Rundowns'
import { Studio, MappingExt } from '../../../lib/collections/Studios'
import { TimelineObjGeneric, TimelineObjRundown, fixTimelineId, TimelineObjType } from '../../../lib/collections/Timeline'
import { Part } from '../../../lib/collections/Parts'
import { Piece } from '../../../lib/collections/Pieces'
import { getOrderedPiece } from './pieces'
import { extendMandadory, clone } from '../../../lib/lib'

export function getLookeaheadObjects (rundownData: RundownData, studio: Studio): Array<TimelineObjGeneric> {
	const activeRundown = rundownData.rundown

	const currentPart = activeRundown.currentPartId ? rundownData.partsMap[activeRundown.currentPartId] : undefined

	const timelineObjs: Array<TimelineObjGeneric> = []
	_.each(studio.mappings || {}, (mapping: MappingExt, layerId: string) => {

		const lookaheadObjs = findLookaheadForlayer(rundownData, layerId, mapping.lookahead)
		if (lookaheadObjs.length === 0) {
			return
		}

		for (let i = 0; i < lookaheadObjs.length; i++) {
			const obj = clone(lookaheadObjs[i].obj) as TimelineObjGeneric

			let enable: TimelineTypes.TimelineEnable = {
				start: 1 // Absolute 0 without a group doesnt work
			}
			if (i !== 0) {
				const prevObj = lookaheadObjs[i - 1].obj
				const prevHasDelayFlag = (prevObj.classes || []).indexOf('_lookahead_start_delay') !== -1

				// Start with previous piece
				const startOffset = prevHasDelayFlag ? 1000 : 0
				enable.start = `#${prevObj.id}.start + ${startOffset}`
			}
			if (!obj.id) throw new Meteor.Error(500, 'lookahead: timeline obj id not set')

			const finiteDuration = lookaheadObjs[i].partId === activeRundown.currentPartId || (currentPart && currentPart.autoNext && lookaheadObjs[i].partId === activeRundown.nextPartId)
			enable.end = finiteDuration ? `#${lookaheadObjs[i].obj.id}.start` : undefined

			obj.id = `lookahead_${i}_${obj.id}`
			obj.priority = 0.1
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
	})
	return timelineObjs
}

export function findLookaheadForlayer (
	rundownData: RundownData,
	layer: string,
	mode: LookaheadMode
): Array<{
	obj: TimelineObjRundown,
	partId: string
}> {
	let activeRundown: Rundown = rundownData.rundown

	if (mode === undefined || mode === LookaheadMode.NONE) {
		return []
	}

	interface PartInfo {
		id: string
		segmentId: string
		part: Part
	}
	// find all pieces that touch the layer
	const layerItems = _.filter(rundownData.pieces, (piece: Piece) => {
		return !!(
			piece.content &&
			piece.content.timelineObjects &&
			_.find(piece.content.timelineObjects, (o) => (o && o.layer === layer))
		)
	})
	if (layerItems.length === 0) {
		return []
	}

	// If mode is retained, and only one use, we can take a shortcut
	if (mode === LookaheadMode.RETAIN && layerItems.length === 1) {
		const i = layerItems[0]
		if (i.content && i.content.timelineObjects) {
			const r = i.content.timelineObjects.find(o => o !== null && o.layer === layer)
			if (r) {
				fixTimelineId(r)
				return [{ obj: r as TimelineObjRundown, partId: i.partId }]
			}
		}
		return []
	}

	// have pieces grouped by part, so we can look based on rank to choose the correct one
	const grouped: {[partId: string]: Piece[]} = {}
	layerItems.forEach(i => {
		if (!grouped[i.partId]) {
			grouped[i.partId] = []
		}

		grouped[i.partId].push(i)
	})

	let partInfo: PartInfo[] | undefined
	let currentPos = 0
	let currentSegmentId: string | undefined

	if (!partInfo) {
		// calculate ordered list of parts, which can be cached for other layers
		const parts = rundownData.parts.map(part => ({
			id: part._id,
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

		const currentIndex = parts.findIndex(l => l.id === activeRundown.currentPartId)
		let partInfos: PartInfo[] = []
		if (currentIndex >= 0) {
			partInfos = partInfos.concat(parts.slice(0, currentIndex + 1))
			currentSegmentId = partInfos[partInfos.length - 1].segmentId
			currentPos = currentIndex
		}

		const nextPart = activeRundown.nextPartId
			? parts.findIndex(l => l.id === activeRundown.nextPartId)
			: (currentIndex >= 0 ? currentIndex + 1 : -1)

		if (nextPart >= 0) {
			partInfos = partInfos.concat(...parts.slice(nextPart))
		}

		partInfo = partInfos.map(partInfo => ({
			id: partInfo.id,
			segmentId: partInfo.segmentId,
			part: partInfo.part
		}))
	}

	if (partInfo.length === 0) {
		return []
	}

	interface GroupedPieces {
		partId: string
		segmentId: string
		pieces: Piece[]
		part: Part
	}

	const orderedGroups: GroupedPieces[] = partInfo.map(i => ({
		partId: i.id,
		segmentId: i.segmentId,
		part: i.part,
		pieces: grouped[i.id] || []
	}))

	// Start by taking the value from the current (if any), or search forwards
	let pieceGroup: GroupedPieces | undefined
	let pieceGroupIndex: number = -1
	for (let i = currentPos; i < orderedGroups.length; i++) {
		const v = orderedGroups[i]
		if (v.pieces.length > 0) {
			pieceGroup = v
			pieceGroupIndex = i
			break
		}
	}
	// If set to retain, then look backwards
	if (mode === LookaheadMode.RETAIN) {
		for (let i = currentPos - 1; i >= 0; i--) {
			const v = orderedGroups[i]

			// abort if we have a piece potential match is for another segment
			if (pieceGroup && v.segmentId !== currentSegmentId) {
				break
			}

			if (v.pieces.length > 0) {
				pieceGroup = v
				pieceGroupIndex = i
				break
			}
		}
	}

	if (!pieceGroup) {
		return []
	}

	let findObjectForPart = (): TimelineObjRundown[] => {
		if (!pieceGroup || pieceGroup.pieces.length === 0) {
			return []
		}

		let allObjs: TimelineObjRundown[] = []
		pieceGroup.pieces.forEach(i => {
			if (i.content && i.content.timelineObjects) {

				_.each(i.content.timelineObjects, (obj) => {
					if (obj) {
						fixTimelineId(obj)
						allObjs.push(extendMandadory<TimelineObjectCoreExt, TimelineObjRundown>(obj, {
							_id: '', // set later
							studioId: '', // set later
							objectType: TimelineObjType.RUNDOWN,
							rundownId: rundownData.rundown._id
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
			if (pieceGroup.part) {
				const orderedItems = getOrderedPiece(pieceGroup.part)

				let allowTransition = false
				if (pieceGroupIndex >= 1 && activeRundown.currentPartId) {
					const prevPieceGroup = orderedGroups[pieceGroupIndex - 1]
					allowTransition = !prevPieceGroup.part.disableOutTransition
				}

				const transObj = orderedItems.find(i => !!i.isTransition)
				const transObj2 = transObj ? pieceGroup.pieces.find(l => l._id === transObj._id) : undefined
				const hasTransition = (
					allowTransition &&
					transObj2 &&
					transObj2.content &&
					transObj2.content.timelineObjects &&
					transObj2.content.timelineObjects.find(o => o != null && o.layer === layer)
				)

				const res: TimelineObjRundown[] = []
				orderedItems.forEach(i => {
					if (!pieceGroup || (!allowTransition && i.isTransition)) {
						return
					}

					const piece = pieceGroup.pieces.find(l => l._id === i._id)
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

						res.push(extendMandadory<TimelineObjectCoreExt, TimelineObjRundown>(obj, {
							_id: '', // set later
							studioId: '', // set later
							objectType: TimelineObjType.RUNDOWN,
							rundownId: rundownData.rundown._id,
							content: newContent
						}))
					}
				})

				return res
			}
		}

		return allObjs
	}

	const lookaheadObjs: {obj: TimelineObjRundown, partId: string}[] = []

	const partId = pieceGroup.partId
	const objs = findObjectForPart()
	objs.forEach(o => lookaheadObjs.push({ obj: o, partId: partId }))

	// this is the current one, so look ahead to next to find the next thing to preload too
	if (pieceGroup && pieceGroup.partId === activeRundown.currentPartId) {
		pieceGroup = undefined
		for (let i = currentPos + 1; i < orderedGroups.length; i++) {
			const v = orderedGroups[i]
			if (v.pieces.length > 0) {
				pieceGroup = v
				pieceGroupIndex = i
				break
			}
		}

		if (pieceGroup) {
			const partId2 = pieceGroup.partId
			const objs2 = findObjectForPart()
			objs2.forEach(o => lookaheadObjs.push({ obj: o, partId: partId2 }))
		}
	}

	return lookaheadObjs
}
