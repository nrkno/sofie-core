
/* tslint:disable:no-use-before-declare */
import { Resolver } from 'superfly-timeline'
import * as _ from 'underscore'
import { Part } from '../../../lib/collections/Parts'
import { Piece } from '../../../lib/collections/Pieces'
import { literal, extendMandadory, getCurrentTime, clone } from '../../../lib/lib'
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
	TimelineObjectCoreExt,
	PieceLifespan,
	OnGenerateTimelineObj
} from 'tv-automation-sofie-blueprints-integration'
import { transformTimeline } from '../../../lib/timeline'
import { AdLibPiece } from '../../../lib/collections/AdLibPieces'
import { Random } from 'meteor/random'
import { prefixAllObjectIds } from './lib'
import { DeviceType } from 'timeline-state-resolver-types'
import { calculatePieceTimelineEnable } from '../../../lib/Rundown'
import { RundownData } from '../../../lib/collections/Rundowns'
import { postProcessAdLibPieces } from '../blueprints/postProcess'

export interface PieceResolved extends Piece {
	/** Resolved start time of the piece */
	resolvedStart: number
	/** Whether the piece was successfully resolved */
	resolved: boolean
}
/**
 * Returns a list of the pieces in a Part, ordered in the order they will be played
 * @param part
 */
export function getOrderedPiece (part: Part): Array<PieceResolved> {
	const pieces = part.getAllPieces()
	const now = getCurrentTime()
	const partStarted = part.getLastStartedPlayback()

	const itemMap: { [key: string]: Piece } = {}
	pieces.forEach(i => itemMap[i._id] = i)

	const objs: Array<TimelineObjRundown> = pieces.map(piece => {
		const obj = clone(createPieceGroup(piece))

		if (obj.enable.start === 0) {
			if (piece.infiniteId && piece.infiniteId !== piece._id) {
				// Infinite coninuation, needs to start earlier otherwise it will likely end up being unresolved
				obj.enable.start = 0
			} else {
				obj.enable.start = 100 // TODO: write a motivation for this. perhaps to try and avoid unresolved pieces, due to them never having length?
			}
		} else if (obj.enable.start === 'now') {
			obj.enable.start = (partStarted ? now - partStarted : 0) + 100
			// I think this is + 100 as 'now' will at the earliest happen in 100ms from now, so we are trying to compensate?
		}

		return obj
	})

	const tlResolved = Resolver.resolveTimeline(transformTimeline(objs), {
		time: 0
	})

	let resolvedPieces: Array<PieceResolved> = []
	let unresolvedIds: string[] = []
	let unresolvedCount = tlResolved.statistics.unresolvedCount
	_.each(tlResolved.objects, obj0 => {
		const obj = obj0 as any as TimelineObjRundown
		const pieceId = (obj.metadata || {}).pieceId
		const piece = _.clone(itemMap[pieceId]) as PieceResolved
		if (obj0.resolved.resolved && obj0.resolved.instances && obj0.resolved.instances.length > 0) {
			piece.resolvedStart = obj0.resolved.instances[0].start || 0
			piece.resolved = true
			resolvedPieces.push(piece)
		} else {
			piece.resolvedStart = 0
			piece.resolved = false

			resolvedPieces.push(piece)

			if (piece.virtual) {
				// Virtuals always are unresolved and should be ignored
				unresolvedCount -= 1
			} else {
				unresolvedIds.push(obj.id)
			}
		}
	})

	if (unresolvedCount > 0) {
		logger.error(`Got ${unresolvedCount} unresolved timeline-objects for part #${part._id} (${unresolvedIds.join(', ')})`)
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
): (TimelineObjPieceAbstract & OnGenerateTimelineObj) {
	return literal<TimelineObjPieceAbstract & OnGenerateTimelineObj>({
		id: getPieceFirstObjectId(piece),
		_id: '', // set later
		studioId: '', // set later
		rundownId: piece.rundownId,
		pieceId: piece._id,
		infinitePieceId: piece.infiniteId,
		objectType: TimelineObjType.RUNDOWN,
		enable: { start: 0 },
		layer: piece.sourceLayerId + '_firstobject',
		content: {
			deviceType: DeviceType.ABSTRACT,
			type: 'callback',

			callBack: 'piecePlaybackStarted',
			callBackData: {
				rundownId: piece.rundownId,
				pieceId: piece._id
			},
			callBackStopped: 'piecePlaybackStopped' // Will cause a callback to be called, when the object stops playing:
		},
		classes: firstObjClasses,
		inGroup: pieceGroup.id
	})
}
export function createPieceGroup (
	piece: Piece,
	partGroup?: TimelineObjRundown
): TimelineObjGroup & TimelineObjRundown & OnGenerateTimelineObj {
	return literal<TimelineObjGroup & TimelineObjRundown & OnGenerateTimelineObj>({
		id: getPieceGroupId(piece),
		_id: '', // set later
		studioId: '', // set later
		content: {
			deviceType: DeviceType.ABSTRACT,
			type: TimelineContentTypeOther.GROUP
		},
		children: [],
		inGroup: partGroup && partGroup.id,
		isGroup: true,
		rundownId: piece.rundownId,
		pieceId: piece._id,
		infinitePieceId: piece.infiniteId,
		objectType: TimelineObjType.RUNDOWN,
		enable: calculatePieceTimelineEnable(piece),
		layer: piece.sourceLayerId,
		metadata: {
			pieceId: piece._id
		}
	})
}
export function getResolvedPieces (part: Part): Piece[] {
	// TODO - was this mangled for endState and could it have broken something else?
	const pieces = part.getAllPieces()

	const itemMap: { [key: string]: Piece } = {}
	pieces.forEach(piece => itemMap[piece._id] = piece)

	const objs = pieces.map(piece => clone(createPieceGroup(piece)))
	objs.forEach(o => {
		if (o.enable.start === 'now' && part.getLastStartedPlayback()) {
			// Emulate playout starting now. TODO - ensure didnt break other uses
			o.enable.start = getCurrentTime() - (part.getLastStartedPlayback() || 0)
		} else if (o.enable.start === 0 || o.enable.start === 'now') {
			o.enable.start = 1
		}
	})
	const tlResolved = Resolver.resolveTimeline(transformTimeline(objs), {
		time: 0
	})
	const events: Array<{
		start: number
		end: number | undefined
		id: string
		piece: Piece
	}> = []

	let unresolvedIds: string[] = []
	_.each(tlResolved.objects, (obj0) => {
		const obj = obj0 as any as TimelineObjRundown
		const id = (obj.metadata || {}).pieceId

		if (obj0.resolved.resolved && obj0.resolved.instances && obj0.resolved.instances.length > 0) {
			const firstInstance = obj0.resolved.instances[0] || {}
			events.push({
				start: firstInstance.start || 0,
				end: firstInstance.end || undefined,
				id: id,
				piece: itemMap[id]
			})
		} else {
			events.push({
				start: 0,
				end: undefined,
				id: id,
				piece: itemMap[id]
			})
			unresolvedIds.push(id)
		}
	})

	if (tlResolved.statistics.unresolvedCount > 0) {
		logger.warn(`Got ${tlResolved.statistics.unresolvedCount} unresolved pieces for piece #${part._id} (${unresolvedIds.join(', ')})`)
	}
	if (pieces.length !== events.length) {
		logger.warn(`Got ${events.length} ordered pieces. Expected ${pieces.length}. for piece #${part._id}`)
	}

	events.sort((a, b) => {
		if (a.start < b.start) {
			return -1
		} else if (a.start > b.start) {
			return 1
		} else {
			if (a.piece.isTransition === b.piece.isTransition) {
				return 0
			} else if (b.piece.isTransition) {
				return 1
			} else {
				return -1
			}
		}
	})

	const processedPieces: Piece[] = events.map<Piece>(event => {
		return literal<Piece>({
			...event.piece,
			enable: {
				start: Math.max(0, event.start - 1),
			},
			playoutDuration: Math.max(0, (event.end || 0) - event.start) || undefined
		})
	})

	// crop infinite pieces
	processedPieces.forEach((piece, index, source) => {
		if (piece.infiniteMode) {
			for (let i = index + 1; i < source.length; i++) {
				const sourcePiece = source[i]
				if (piece.sourceLayerId === sourcePiece.sourceLayerId) {
					// TODO - verify this
					piece.playoutDuration = (sourcePiece.enable.start as number) - (piece.enable.start as number)
					return
				}
			}
		}
	})

	return processedPieces
}

export function getResolvedPiecesFromFullTimeline (rundownData: RundownData, allObjs: TimelineObjGeneric[]): { pieces: Piece[], time: number } {
	const objs = clone(allObjs.filter(o => o.isGroup && ((o as any).isPartGroup || (o.metadata && o.metadata.pieceId))))

	const now = getCurrentTime()

	const partIds = _.compact([rundownData.rundown.previousPartId, rundownData.rundown.currentPartId])
	const pieces: Piece[] = rundownData.pieces.filter(p => partIds.indexOf(p.partId) !== -1)

	if (rundownData.rundown.currentPartId && rundownData.rundown.nextPartId) {
		const part = rundownData.partsMap[rundownData.rundown.currentPartId]
		if (part && part.autoNext) {
			pieces.push(...rundownData.pieces.filter(p => p.partId === rundownData.rundown.nextPartId))
		}
	}

	const itemMap: { [key: string]: Piece } = {}
	pieces.forEach(piece => itemMap[piece._id] = piece)

	objs.forEach(o => {
		if (o.enable.start === 'now') {
			o.enable.start = now
		}
	})

	const tlResolved = Resolver.resolveTimeline(transformTimeline(objs), {
		time: now
	})
	const events: Array<{
		start: number
		end: number | undefined
		id: string
		piece: Piece
	}> = []

	let unresolvedIds: string[] = []
	_.each(tlResolved.objects, (obj0) => {
		const obj = obj0 as any as TimelineObjRundown
		const id = (obj.metadata || {}).pieceId

		// Probably the part
		if (!id) return

		// Erm... How?
		if (!itemMap[id]) {
			unresolvedIds.push(id)
			return
		}

		if (obj0.resolved.resolved && obj0.resolved.instances && obj0.resolved.instances.length > 0) {
			const firstInstance = obj0.resolved.instances[0] || {}
			events.push({
				start: firstInstance.start || now,
				end: firstInstance.end || undefined,
				id: id,
				piece: itemMap[id]
			})
		} else {
			events.push({
				start: now,
				end: undefined,
				id: id,
				piece: itemMap[id]
			})
			unresolvedIds.push(id)
		}
	})

	if (tlResolved.statistics.unresolvedCount > 0) {
		logger.warn(`Got ${tlResolved.statistics.unresolvedCount} unresolved pieces (${unresolvedIds.join(', ')})`)
	}
	if (pieces.length !== events.length) {
		logger.warn(`Got ${events.length} ordered pieces. Expected ${pieces.length}.`)
	}

	events.sort((a, b) => {
		if (a.start < b.start) {
			return -1
		} else if (a.start > b.start) {
			return 1
		} else if (a.piece && b.piece) {
			if (a.piece.isTransition === b.piece.isTransition) {
				return 0
			} else if (b.piece.isTransition) {
				return 1
			} else {
				return -1
			}
		} else {
			return 0
		}
	})

	const processedPieces: Piece[] = events.map<Piece>(event => {
		return literal<Piece>({
			...event.piece,
			enable: {
				start: Math.max(0, event.start - 1),
			},
			playoutDuration: Math.max(0, (event.end || 0) - event.start) || undefined
		})
	})

	// crop infinite pieces
	processedPieces.forEach((piece, index, source) => {
		if (piece.infiniteMode) { // && piece.infiniteMode !== PieceLifespan.OutOnNextPart) {
			for (let i = index + 1; i < source.length; i++) {
				const sourcePiece = source[i]
				if (piece.sourceLayerId === sourcePiece.sourceLayerId) {
					// TODO - verify this, the min is necessary and correct though
					const infDuration = (sourcePiece.enable.start as number) - (piece.enable.start as number)
					if (piece.playoutDuration) {
						piece.playoutDuration = Math.min(piece.playoutDuration, infDuration)
					} else {
						piece.playoutDuration = infDuration
					}
					return
				}
			}
		}
	})

	return {
		pieces: processedPieces,
		time: now
	}
}


export function convertPieceToAdLibPiece (piece: Piece): AdLibPiece {
	// const oldId = piece._id
	const newId = Random.id()
	const newAdLibPiece = literal<AdLibPiece>({
		..._.omit(piece, 'userDuration', 'timings', 'startedPlayback', 'stoppedPlayback', 'infiniteId'),
		_id: newId,
		_rank: 0,
		disabled: false,
		dynamicallyInserted: true,
		infiniteMode: piece.originalInfiniteMode !== undefined ? piece.originalInfiniteMode : piece.infiniteMode,
		expectedDuration: _.isNumber(piece.enable.duration) ? piece.enable.duration : 0
	})

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
	let duration: number | string | undefined = undefined
	if (adLibPiece['expectedDuration']) {
		duration = adLibPiece['expectedDuration']
	} else if (adLibPiece['enable'] && adLibPiece['enable'].duration) {
		duration = adLibPiece['enable'].duration
	}

	const newId = Random.id()
	const newPiece = literal<Piece>({
		..._.omit(adLibPiece, '_rank', 'expectedDuration', 'startedPlayback', 'stoppedPlayback'), // TODO - this could be typed stronger
		_id: newId,
		enable: {
			start: (queue ? 0 : 'now'),
			duration: duration
		},
		partId: part._id,
		adLibSourceId: adLibPiece._id,
		dynamicallyInserted: !queue,
		// expectedDuration: adLibPiece.expectedDuration || 0, // set duration to infinite if not set by AdLibItem
		timings: {
			take: [getCurrentTime()],
			startedPlayback: [],
			next: [],
			stoppedPlayback: [],
			playOffset: [],
			takeDone: [],
			takeOut: [],
		}
	})

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

export function resolveActivePieces (part: Part, now: number): Piece[] {
	const pieces = part.getAllPieces()

	const itemMap: { [key: string]: Piece } = {}
	pieces.forEach(i => itemMap[i._id] = i)

	const partStartTime = part.startedPlayback ? part.getLastStartedPlayback() || 0 : 0
	const targetTime = part.startedPlayback ? now - partStartTime : 0

	const objs: Array<TimelineObjRundown> = pieces.map(piece => {
		const obj = createPieceGroup(piece)

		// If start is now, then if the part is active set it to be now, or fallback to start of the part
		if (piece.enable.start === 'now') {
			piece.enable.start = targetTime
		}

		return obj
	})

	const resolved = Resolver.resolveTimeline(transformTimeline(objs), {
		time: targetTime
	})

	const state = Resolver.getState(resolved, targetTime, 1)

	let unresolvedIds: string[] = []
	let unresolvedCount = resolved.statistics.unresolvedCount
	_.each(resolved.objects, obj0 => {
		if (!obj0.resolved.resolved || !obj0.resolved.instances || obj0.resolved.instances.length === 0) {
			const obj = obj0 as any as TimelineObjRundown
			const pieceId = (obj.metadata || {}).pieceId
			const piece = itemMap[pieceId]
			if (piece && piece.virtual) {
				// Virtuals always are unresolved and should be ignored
				unresolvedCount -= 1
			} else {
				unresolvedIds.push(obj.id)
			}
		}
	})

	let activePieces: Array<Piece> = []
	_.each(state.layers, obj0 => {
		const obj = obj0 as any as TimelineObjRundown
		const pieceId = (obj.metadata || {}).pieceId
		const piece = itemMap[pieceId]

		if (piece) {
			activePieces.push(piece)
		}
	})

	if (unresolvedCount > 0) {
		logger.error(`Got ${unresolvedCount} unresolved timeline-objects for part #${part._id} (${unresolvedIds.join(', ')})`)
	}

	return activePieces
}
