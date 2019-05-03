import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { LookaheadMode, TimelineObjectCoreExt } from 'tv-automation-sofie-blueprints-integration'
import { TimelineTrigger, TriggerType } from 'superfly-timeline'
import { RundownData, Rundown } from '../../../lib/collections/Rundowns'
import { Studio } from '../../../lib/collections/Studios'
import { TimelineObjGeneric, TimelineObjRundown, fixTimelineId, TimelineObjType } from '../../../lib/collections/Timeline'
import { Part } from '../../../lib/collections/Parts'
import { Piece } from '../../../lib/collections/Pieces'
import { getOrderedPiece } from './pieces'
import { extendMandadory } from '../../../lib/lib'
let clone = require('fast-clone')

export function getLookeaheadObjects (rundownData: RundownData, studio: Studio): Array<TimelineObjGeneric> {
	const activeRundown = rundownData.rundown

	const currentPart = activeRundown.currentPartId ? rundownData.partsMap[activeRundown.currentPartId] : undefined

	const timelineObjs: Array<TimelineObjGeneric> = []
	_.each(studio.mappings || {}, (m, l) => {

		const res = findLookaheadForLLayer(rundownData, l, m.lookahead)
		if (res.length === 0) {
			return
		}

		for (let i = 0; i < res.length; i++) {
			const r = clone(res[i].obj) as TimelineObjGeneric

			let trigger: TimelineTrigger = {
				type: TriggerType.TIME_ABSOLUTE,
				value: 1 // Absolute 0 without a group doesnt work
			}
			if (i !== 0) {
				const prevObj = res[i - 1].obj
				const prevHasDelayFlag = (prevObj.classes || []).indexOf('_lookahead_start_delay') !== -1

				// Start with previous item
				const startOffset = prevHasDelayFlag ? 1000 : 0
				trigger = {
					type: TriggerType.TIME_RELATIVE,
					value: `#${prevObj.id}.start + ${startOffset}`
				}
			}
			if (!r.id) throw new Meteor.Error(500, 'lookahead: timeline obj id not set')

			r.id = 'lookahead_' + i + '_' + r.id
			r.priority = 0.1
			const finiteDuration = res[i].partId === activeRundown.currentPartId || (currentPart && currentPart.autoNext && res[i].partId === activeRundown.nextPartId)
			r.duration = finiteDuration ? `#${res[i].obj.id}.start - #.start` : 0
			r.trigger = trigger
			r.isBackground = true
			delete r.inGroup // force it to be cleared

			if (m.lookahead === LookaheadMode.PRELOAD) {
				r.originalLLayer = r.LLayer
				r.LLayer += '_lookahead'
			}

			timelineObjs.push(r)
		}
	})
	return timelineObjs
}

export function findLookaheadForLLayer (
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
		line: Part
	}
	// find all slis that touch the layer
	const layerItems = _.filter(rundownData.pieces, (piece: Piece) => {
		return !!(
			piece.content &&
			piece.content.timelineObjects &&
			_.find(piece.content.timelineObjects, (o) => (o && o.LLayer === layer))
		)
	})
	if (layerItems.length === 0) {
		return []
	}

	// If mode is retained, and only one use, we can take a shortcut
	if (mode === LookaheadMode.RETAIN && layerItems.length === 1) {
		const i = layerItems[0]
		if (i.content && i.content.timelineObjects) {
			const r = i.content.timelineObjects.find(o => o !== null && o.LLayer === layer)
			if (r) {
				fixTimelineId(r)
				return [{ obj: r as TimelineObjRundown, partId: i.partId }]
			}
		}
		return []
	}

	// have slis grouped by part, so we can look based on rank to choose the correct one
	const grouped: {[partId: string]: Piece[]} = {}
	layerItems.forEach(i => {
		if (!grouped[i.partId]) {
			grouped[i.partId] = []
		}

		grouped[i.partId].push(i)
	})

	let partsInfo: PartInfo[] | undefined
	let currentPos = 0
	let currentSegmentId: string | undefined

	if (!partsInfo) {
		// calculate ordered list of parts, which can be cached for other llayers
		const lines = rundownData.parts.map(l => ({ id: l._id, rank: l._rank, segmentId: l.segmentId, line: l }))
		lines.sort((a, b) => {
			if (a.rank < b.rank) {
				return -1
			}
			if (a.rank > b.rank) {
				return 1
			}
			return 0
		})

		const currentIndex = lines.findIndex(l => l.id === activeRundown.currentPartId)
		let res: PartInfo[] = []
		if (currentIndex >= 0) {
			res = res.concat(lines.slice(0, currentIndex + 1))
			currentSegmentId = res[res.length - 1].segmentId
			currentPos = currentIndex
		}

		const nextLine = activeRundown.nextPartId
			? lines.findIndex(l => l.id === activeRundown.nextPartId)
			: (currentIndex >= 0 ? currentIndex + 1 : -1)

		if (nextLine >= 0) {
			res = res.concat(...lines.slice(nextLine))
		}

		partsInfo = res.map(l => ({ id: l.id, segmentId: l.segmentId, line: l.line }))
	}

	if (partsInfo.length === 0) {
		return []
	}

	interface GroupedPieces {
		partId: string
		segmentId: string
		items: Piece[]
		line: Part
	}

	const orderedGroups: GroupedPieces[] = partsInfo.map(i => ({
		partId: i.id,
		segmentId: i.segmentId,
		line: i.line,
		items: grouped[i.id] || []
	}))

	// Start by taking the value from the current (if any), or search forwards
	let pieceGroup: GroupedPieces | undefined
	let pieceGroupIndex: number = -1
	for (let i = currentPos; i < orderedGroups.length; i++) {
		const v = orderedGroups[i]
		if (v.items.length > 0) {
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

			if (v.items.length > 0) {
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
		if (!pieceGroup || pieceGroup.items.length === 0) {
			return []
		}

		let allObjs: TimelineObjRundown[] = []
		pieceGroup.items.forEach(i => {
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
			if (pieceGroup.line) {
				const orderedItems = getOrderedPiece(pieceGroup.line)

				let allowTransition = false
				if (pieceGroupIndex >= 1 && activeRundown.currentPartId) {
					const prevPieceGroup = orderedGroups[pieceGroupIndex - 1]
					allowTransition = !prevPieceGroup.line.disableOutTransition
				}

				const transObj = orderedItems.find(i => !!i.isTransition)
				const transObj2 = transObj ? pieceGroup.items.find(l => l._id === transObj._id) : undefined
				const hasTransition = allowTransition && transObj2 && transObj2.content && transObj2.content.timelineObjects && transObj2.content.timelineObjects.find(o => o != null && o.LLayer === layer)

				const res: TimelineObjRundown[] = []
				orderedItems.forEach(i => {
					if (!pieceGroup || (!allowTransition && i.isTransition)) {
						return
					}

					const item = pieceGroup.items.find(l => l._id === i._id)
					if (!item || !item.content || !item.content.timelineObjects) {
						return
					}

					// If there is a transition and this item is abs0, it is assumed to be the primary piece and so does not need lookahead
					if (hasTransition && !i.isTransition && item.trigger.type === TriggerType.TIME_ABSOLUTE && item.trigger.value === 0) {
						return
					}

					// Note: This is assuming that there is only one use of a layer in each piece.
					const obj = item.content.timelineObjects.find(o => o !== null && o.LLayer === layer)
					if (obj) {
						res.push(extendMandadory<TimelineObjectCoreExt, TimelineObjRundown>(obj, {
							_id: '', // set later
							studioId: '', // set later
							objectType: TimelineObjType.RUNDOWN,
							rundownId: rundownData.rundown._id
						}))
					}
				})

				return res
			}
		}

		return allObjs
	}

	const res: {obj: TimelineObjRundown, partId: string}[] = []

	const partId = pieceGroup.partId
	const objs = findObjectForPart()
	objs.forEach(o => res.push({ obj: o, partId: partId }))

	// this is the current one, so look ahead to next to find the next thing to preload too
	if (pieceGroup && pieceGroup.partId === activeRundown.currentPartId) {
		pieceGroup = undefined
		for (let i = currentPos + 1; i < orderedGroups.length; i++) {
			const v = orderedGroups[i]
			if (v.items.length > 0) {
				pieceGroup = v
				pieceGroupIndex = i
				break
			}
		}

		if (pieceGroup) {
			const partId2 = pieceGroup.partId
			const objs2 = findObjectForPart()
			objs2.forEach(o => res.push({ obj: o, partId: partId2 }))
		}
	}

	return res
}
