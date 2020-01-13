
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
	OnGenerateTimelineObj,
	TSR
} from 'tv-automation-sofie-blueprints-integration'
import { transformTimeline } from '../../../lib/timeline'
import { AdLibPiece } from '../../../lib/collections/AdLibPieces'
import { Random } from 'meteor/random'
import { prefixAllObjectIds } from './lib'
import { calculatePieceTimelineEnable } from '../../../lib/Rundown'
import { RundownPlaylistPlayoutData } from '../../../lib/collections/RundownPlaylists'
import { postProcessAdLibPieces } from '../blueprints/postProcess'
import { PieceInstance } from '../../../lib/collections/PieceInstances'
import { PartInstance } from '../../../lib/collections/PartInstances'

export interface PieceResolved extends Piece {
	/** Resolved start time of the piece */
	resolvedStart: number
	/** Whether the piece was successfully resolved */
	resolved: boolean
}
export function orderPieces (pieces: Piece[], partId: string, partStarted?: number): Array<PieceResolved> {
	const now = getCurrentTime()

	const itemMap: { [key: string]: Piece } = {}
	pieces.forEach(i => itemMap[i._id] = i)

	const objs: Array<TimelineObjRundown> = pieces.map(piece => {
		const obj = clone(createPieceGroup(undefined, piece))

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
		logger.error(`Got ${unresolvedCount} unresolved timeline-objects for part #${partId} (${unresolvedIds.join(', ')})`)
	}
	if (pieces.length !== resolvedPieces.length) {
		logger.error(`Got ${resolvedPieces.length} ordered pieces. Expected ${pieces.length} for part #${partId}`)
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
/**
 * Returns a list of the pieces in a Part, ordered in the order they will be played
 * @param part
 */
export function getOrderedPiece (part: Part): Array<PieceResolved> {
	const pieces = part.getAllPieces()
	const partStarted = part.getLastStartedPlayback()

	return orderPieces(pieces, part._id, partStarted)
}
export function createPieceGroupFirstObject (
	playlistId: string | undefined,
	pieceInstance: PieceInstance,
	pieceGroup: TimelineObjRundown,
	firstObjClasses?: string[]
): (TimelineObjPieceAbstract & OnGenerateTimelineObj) {
	return literal<TimelineObjPieceAbstract & OnGenerateTimelineObj>({
		id: getPieceFirstObjectId(pieceInstance.piece),
		_id: '', // set later
		studioId: '', // set later
		playlistId: playlistId || '',
		rundownId: pieceInstance.rundownId,
		pieceId: pieceInstance._id,
		infinitePieceId: pieceInstance.piece.infiniteId,
		objectType: TimelineObjType.RUNDOWN,
		enable: { start: 0 },
		layer: pieceInstance.piece.sourceLayerId + '_firstobject',
		content: {
			deviceType: TSR.DeviceType.ABSTRACT,
			type: 'callback',

			callBack: 'piecePlaybackStarted',
			callBackData: {
				rundownId: pieceInstance.rundownId,
				pieceId: pieceInstance._id
			},
			callBackStopped: 'piecePlaybackStopped' // Will cause a callback to be called, when the object stops playing:
		},
		classes: firstObjClasses,
		inGroup: pieceGroup.id
	})
}
export function createPieceGroup (
	playlistId: string | undefined,
	pieceInstance: PieceInstance,
	partGroup?: TimelineObjRundown
): TimelineObjGroup & TimelineObjRundown & OnGenerateTimelineObj {
	return literal<TimelineObjGroup & TimelineObjRundown & OnGenerateTimelineObj>({
		id: getPieceGroupId(pieceInstance.piece),
		_id: '', // set later
		studioId: '', // set later
		content: {
			deviceType: TSR.DeviceType.ABSTRACT,
			type: TimelineContentTypeOther.GROUP
		},
		children: [],
		inGroup: partGroup && partGroup.id,
		isGroup: true,
		playlistId: playlistId || '',
		rundownId: pieceInstance.rundownId,
		pieceId: pieceInstance._id,
		infinitePieceId: pieceInstance.piece.infiniteId,
		objectType: TimelineObjType.RUNDOWN,
		enable: calculatePieceTimelineEnable(pieceInstance.piece),
		layer: pieceInstance.piece.sourceLayerId,
		metadata: {
			pieceId: pieceInstance._id
		}
	})
}
export function getResolvedPieces (part: Part): PieceInstance[] {
	// TODO - was this mangled for endState and could it have broken something else?
	const pieces = part.getAllPieces()

	const itemMap: { [key: string]: Piece } = {}
	pieces.forEach(piece => itemMap[piece._id] = piece)

	const objs = pieces.map(piece => clone(createPieceGroup(undefined, piece)))
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

export function getResolvedPiecesFromFullTimeline (rundownData: RundownPlaylistPlayoutData, allObjs: TimelineObjGeneric[]): { pieces: PieceInstance[], time: number } {
	const objs = clone(allObjs.filter(o => o.isGroup && ((o as any).isPartGroup || (o.metadata && o.metadata.pieceId))))

	const now = getCurrentTime()

	const partInstanceIds = _.compact([rundownData.rundownPlaylist.previousPartInstanceId, rundownData.rundownPlaylist.currentPartInstanceId])

	const pieceInstances: PieceInstance[] = rundownData.selectedInstancePieces.filter(p => partInstanceIds.indexOf(p.partInstanceId) !== -1)

	if (rundownData.currentPartInstance && rundownData.currentPartInstance.part.autoNext && rundownData.rundownPlaylist.nextPartInstanceId) {
		pieceInstances.push(...rundownData.selectedInstancePieces.filter(p => p.partInstanceId === rundownData.rundownPlaylist.nextPartInstanceId))
	}

	const itemMap: { [key: string]: PieceInstance } = {}
	pieceInstances.forEach(instance => itemMap[instance._id] = instance)

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
		piece: PieceInstance
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
	if (pieceInstances.length !== events.length) {
		logger.warn(`Got ${events.length} ordered pieces. Expected ${pieceInstances.length}.`)
	}

	events.sort((a, b) => {
		if (a.start < b.start) {
			return -1
		} else if (a.start > b.start) {
			return 1
		} else if (a.piece && b.piece) {
			if (a.piece.piece.isTransition === b.piece.piece.isTransition) {
				return 0
			} else if (b.piece.piece.isTransition) {
				return 1
			} else {
				return -1
			}
		} else {
			return 0
		}
	})

	const processedPieces: PieceInstance[] = events.map<PieceInstance>(event => {
		return literal<PieceInstance>({
			...event.piece,
			piece: {
				...event.piece.piece,
				enable: {
					start: Math.max(0, event.start - 1),
				},
				playoutDuration: Math.max(0, (event.end || 0) - event.start) || undefined
			}
		})
	})

	// crop infinite pieces
	processedPieces.forEach((instance, index, source) => {
		if (instance.piece.infiniteMode) { // && piece.infiniteMode !== PieceLifespan.OutOnNextPart) {
			for (let i = index + 1; i < source.length; i++) {
				const sourceInstance = source[i]
				if (instance.piece.sourceLayerId === sourceInstance.piece.sourceLayerId) {
					// TODO - verify this, the min is necessary and correct though
					const infDuration = (sourceInstance.piece.enable.start as number) - (instance.piece.enable.start as number)
					if (instance.piece.playoutDuration) {
						instance.piece.playoutDuration = Math.min(instance.piece.playoutDuration, infDuration)
					} else {
						instance.piece.playoutDuration = infDuration
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

export function convertAdLibToPieceInstance (adLibPiece: AdLibPiece | Piece, partInstance: PartInstance, queue: boolean): PieceInstance {
	let duration: number | string | undefined = undefined
	if (adLibPiece['expectedDuration']) {
		duration = adLibPiece['expectedDuration']
	} else if (adLibPiece['enable'] && adLibPiece['enable'].duration) {
		duration = adLibPiece['enable'].duration
	}

	const newPieceId = Random.id()
	const newPieceInstance = literal<PieceInstance>({
		_id: `${partInstance._id}_${newPieceId}`,
		rundownId: partInstance.rundownId,
		partInstanceId: partInstance._id,
		piece: {
			..._.omit(adLibPiece, '_rank', 'expectedDuration', 'startedPlayback', 'stoppedPlayback'), // TODO - this could be typed stronger
			_id: newPieceId,
			enable: {
				start: (queue ? 0 : 'now'),
				duration: duration
			}
		}
	})

	if (newPieceInstance.piece.content && newPieceInstance.piece.content.timelineObjects) {
		let contentObjects = newPieceInstance.piece.content.timelineObjects
		const objs = prefixAllObjectIds(_.compact(
			_.map(contentObjects, (obj) => {
				return extendMandadory<TimelineObjectCoreExt, TimelineObjGeneric>(obj, {
					_id: '', // set later
					studioId: '', // set later
					objectType: TimelineObjType.RUNDOWN
				})
			})
		), newPieceId + '_')
		newPieceInstance.piece.content.timelineObjects = objs
	}
	return newPieceInstance
}

// export function resolveActivePieces (playlistId: string, part: Part, now: number): Piece[] {
// 	const pieces = part.getAllPieces()

// 	const itemMap: { [key: string]: Piece } = {}
// 	pieces.forEach(i => itemMap[i._id] = i)

// 	const partStartTime = part.startedPlayback ? part.getLastStartedPlayback() || 0 : 0
// 	const targetTime = part.startedPlayback ? now - partStartTime : 0

// 	const objs: Array<TimelineObjRundown> = pieces.map(piece => {
// 		const obj = createPieceGroup(playlistId, piece)

// 		// If start is now, then if the part is active set it to be now, or fallback to start of the part
// 		if (piece.enable.start === 'now') {
// 			piece.enable.start = targetTime
// 		}

// 		return obj
// 	})

// 	const resolved = Resolver.resolveTimeline(transformTimeline(objs), {
// 		time: targetTime
// 	})

// 	const state = Resolver.getState(resolved, targetTime, 1)

// 	let unresolvedIds: string[] = []
// 	let unresolvedCount = resolved.statistics.unresolvedCount
// 	_.each(resolved.objects, obj0 => {
// 		if (!obj0.resolved.resolved || !obj0.resolved.instances || obj0.resolved.instances.length === 0) {
// 			const obj = obj0 as any as TimelineObjRundown
// 			const pieceId = (obj.metadata || {}).pieceId
// 			const piece = itemMap[pieceId]
// 			if (piece && piece.virtual) {
// 				// Virtuals always are unresolved and should be ignored
// 				unresolvedCount -= 1
// 			} else {
// 				unresolvedIds.push(obj.id)
// 			}
// 		}
// 	})

// 	let activePieces: Array<Piece> = []
// 	_.each(state.layers, obj0 => {
// 		const obj = obj0 as any as TimelineObjRundown
// 		const pieceId = (obj.metadata || {}).pieceId
// 		const piece = itemMap[pieceId]

// 		if (piece) {
// 			activePieces.push(piece)
// 		}
// 	})

// 	if (unresolvedCount > 0) {
// 		logger.error(`Got ${unresolvedCount} unresolved timeline-objects for part #${part._id} (${unresolvedIds.join(', ')})`)
// 	}

// 	return activePieces
// }
