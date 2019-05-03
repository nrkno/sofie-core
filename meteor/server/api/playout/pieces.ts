
/* tslint:disable:no-use-before-declare */
import { TriggerType, Resolver } from 'superfly-timeline'
import * as _ from 'underscore'
import { Part } from '../../../lib/collections/Parts'
import { Piece } from '../../../lib/collections/Pieces'
import { literal, extendMandadory, getCurrentTime } from '../../../lib/lib'
import {
	TimelineContentTypeOther,
	TimelineObjPieceAbstract,
	TimelineObjGroup,
	TimelineObjType,
	TimelineObjRundown,
	TimelineObjGeneric,
} from '../../../lib/collections/Timeline'
import { logger } from '../../logging'
import {
	getPieceGroupId,
	getPieceFirstObjectId,
	TimelineObjectCoreExt
} from 'tv-automation-sofie-blueprints-integration'
let clone = require('fast-clone')
import { transformTimeline } from '../../../lib/timeline'
import { AdLibPiece } from '../../../lib/collections/AdLibPieces'
import { Random } from 'meteor/random'
import { prefixAllObjectIds } from './lib'

export interface PieceResolved extends Piece {
	/** Resolved start time of the piece */
	resolvedStart: number
	/** Whether the piece was successfully resolved */
	resolved: boolean
}
export function getOrderedPiece (part: Part): Array<PieceResolved> {
	const pieces = part.getAllPieces()

	const itemMap: { [key: string]: Piece } = {}
	pieces.forEach(i => itemMap[i._id] = i)

	const objs: Array<TimelineObjRundown> = pieces.map(
		i => clone(createPieceGroup(i, i.durationOverride || i.duration || i.expectedDuration || 0))
	)
	objs.forEach(o => {
		if (o.trigger.type === TriggerType.TIME_ABSOLUTE && (o.trigger.value === 0 || o.trigger.value === 'now')) {
			o.trigger.value = 100
		}
	})
	const tlResolved = Resolver.getTimelineInWindow(transformTimeline(objs))

	let resolvedPieces: Array<PieceResolved> = []
	_.each(tlResolved.resolved, e => {
		const id = ((e as any || {}).metadata || {}).pieceId
		let item = _.clone(itemMap[id]) as PieceResolved
		item.resolvedStart = e.resolved.startTime || 0
		item.resolved = true
		resolvedPieces.push(item)
	})
	_.each(tlResolved.unresolved, e => {
		const id = ((e as any || {}).metadata || {}).pieceId

		let item = _.clone(itemMap[id]) as PieceResolved
		item.resolvedStart = 0
		item.resolved = false

		resolvedPieces.push(item)
	})
	if (tlResolved.unresolved.length > 0) {
		logger.error(`Got ${tlResolved.unresolved.length} unresolved timeline-objects for part #${part._id} (first is ${tlResolved.unresolved[0].id})`)

	}
	if (pieces.length !== resolvedPieces.length) {
		logger.error(`Got ${resolvedPieces.length} ordered pieces. Expected ${pieces.length} for part #${part._id}`)
	}

	resolvedPieces.sort((a, b) => {
		if (a.resolvedStart < b.resolvedStart) return -1
		if (a.resolvedStart > b.resolvedStart) return 1

		if (a.isTransition === b.isTransition) return 0
		if (b.isTransition) return 1
		return -1
	})

	return resolvedPieces
}
export function createPieceGroupFirstObject (
	piece: Piece,
	pieceGroup: TimelineObjRundown,
	firstObjClasses?: string[]
): TimelineObjPieceAbstract {
	return literal<TimelineObjPieceAbstract>({
		id: getPieceFirstObjectId(piece),
		_id: '', // set later
		studioId: '', // set later
		rundownId: piece.rundownId,
		objectType: TimelineObjType.RUNDOWN,
		trigger: {
			type: TriggerType.TIME_ABSOLUTE,
			value: 0
		},
		duration: 0,
		LLayer: piece.sourceLayerId + '_firstobject',
		isAbstract: true,
		content: {
			type: TimelineContentTypeOther.NOTHING,
		},
		classes: firstObjClasses,
		inGroup: pieceGroup._id,
		pieceId: piece._id,
	})
}
export function createPieceGroup (
	item: Piece,
	duration: number | string,
	partGroup?: TimelineObjRundown
): TimelineObjGroup & TimelineObjRundown {
	return literal<TimelineObjGroup & TimelineObjRundown>({
		id: getPieceGroupId(item),
		_id: '', // set later
		studioId: '', // set later
		content: {
			type: TimelineContentTypeOther.GROUP,
			objects: []
		},
		inGroup: partGroup && partGroup._id,
		isGroup: true,
		rundownId: item.rundownId,
		objectType: TimelineObjType.RUNDOWN,
		trigger: item.trigger,
		duration: duration,
		LLayer: item.sourceLayerId,
		metadata: {
			pieceId: item._id
		}
	})
}
export function getResolvedPieces (line: Part): Piece[] {
	const pieces = line.getAllPieces()

	const itemMap: { [key: string]: Piece } = {}
	pieces.forEach(i => itemMap[i._id] = i)

	const objs = pieces.map(i => clone(createPieceGroup(i, i.durationOverride || i.duration || i.expectedDuration || 0)))
	objs.forEach(o => {
		if (o.trigger.type === TriggerType.TIME_ABSOLUTE && (o.trigger.value === 0 || o.trigger.value === 'now')) {
			o.trigger.value = 1
		}
	})
	const events = Resolver.getTimelineInWindow(transformTimeline(objs))

	let eventMap = events.resolved.map(e => {
		const id = ((e as any || {}).metadata || {}).pieceId
		return {
			start: e.resolved.startTime || 0,
			end: e.resolved.endTime || 0,
			id: id,
			item: itemMap[id]
		}
	})
	events.unresolved.forEach(e => {
		const id = ((e as any || {}).metadata || {}).pieceId
		eventMap.push({
			start: 0,
			end: 0,
			id: id,
			item: itemMap[id]
		})
	})
	if (events.unresolved.length > 0) {
		logger.warn(`Got ${events.unresolved.length} unresolved pieces for piece #${line._id}`)
	}
	if (pieces.length !== eventMap.length) {
		logger.warn(`Got ${eventMap.length} ordered pieces. Expected ${pieces.length}. for piece #${line._id}`)
	}

	eventMap.sort((a, b) => {
		if (a.start < b.start) {
			return -1
		} else if (a.start > b.start) {
			return 1
		} else {
			if (a.item.isTransition === b.item.isTransition) {
				return 0
			} else if (b.item.isTransition) {
				return 1
			} else {
				return -1
			}
		}
	})

	const processedPieces = eventMap.map(e => _.extend(e.item, {
		trigger: {
			type: TriggerType.TIME_ABSOLUTE,
			value: Math.max(0, e.start - 1)
		},
		duration: Math.max(0, e.end - e.start)
	}) as Piece)

	// crop infinite pieces
	processedPieces.forEach((value, index, source) => {
		if (value.infiniteMode) {
			for (let i = index + 1; i < source.length; i++) {
				const li = source[i]
				if (value.sourceLayerId === li.sourceLayerId) {
					value.duration = (li.trigger.value as number) - (value.trigger.value as number)
					return
				}
			}
		}
	})

	return processedPieces
}
export function convertPieceToAdLibPiece (piece: Piece): AdLibPiece {
	// const oldId = piece._id
	const newId = Random.id()
	const newAdLibPiece = literal<AdLibPiece>(_.extend(
		piece,
		{
			_id: newId,
			trigger: {
				type: TriggerType.TIME_ABSOLUTE,
				value: 'now'
			},
			dynamicallyInserted: true,
			infiniteMode: piece.originalInfiniteMode !== undefined ? piece.originalInfiniteMode : piece.infiniteMode,
			expectedDuration: piece.originalExpectedDuration !== undefined ? piece.originalExpectedDuration : piece.expectedDuration || 0 // set duration to infinite if not set by AdLibItem
		}
	))
	delete newAdLibPiece.trigger
	delete newAdLibPiece.timings
	delete newAdLibPiece.startedPlayback
	delete newAdLibPiece['infiniteId']
	delete newAdLibPiece['stoppedPlayback']

	if (newAdLibPiece.content && newAdLibPiece.content.timelineObjects) {
		let contentObjects = newAdLibPiece.content.timelineObjects
		const objs = prefixAllObjectIds(
			_.compact(
				_.map(contentObjects, (obj: TimelineObjectCoreExt) => {
					return extendMandadory<TimelineObjectCoreExt, TimelineObjGeneric>(obj, {
						_id: '', // set later
						studioId: '', // set later
						objectType: TimelineObjType.RUNDOWN
					})
				})
			),
			newId + '_'
		)
		newAdLibPiece.content.timelineObjects = objs
	}
	return newAdLibPiece
}

export function convertAdLibToPiece (adLibPiece: AdLibPiece | Piece, part: Part, queue: boolean): Piece {
	const newId = Random.id()
	const newPiece = literal<Piece>(_.extend(
		_.clone(adLibPiece),
		{
			_id: newId,
			trigger: {
				type: TriggerType.TIME_ABSOLUTE,
				value: (queue ? 0 : 'now')
			},
			partId: part._id,
			adLibSourceId: adLibPiece._id,
			dynamicallyInserted: !queue,
			expectedDuration: adLibPiece.expectedDuration || 0, // set duration to infinite if not set by AdLibItem
			timings: {
				take: [getCurrentTime()]
			}
		}
	))

	if (newPiece.content && newPiece.content.timelineObjects) {
		let contentObjects = newPiece.content.timelineObjects
		const objs = prefixAllObjectIds(_.compact(
			_.map(contentObjects, (obj) => {
				return extendMandadory<TimelineObjectCoreExt, TimelineObjGeneric>(obj, {
					_id: '', // set later
					studioId: '', // set later
					objectType: TimelineObjType.RUNDOWN
				})
			})
		), newId + '_')
		newPiece.content.timelineObjects = objs
	}
	return newPiece
}
