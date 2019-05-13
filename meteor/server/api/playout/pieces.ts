
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
	TimelineObjectCoreExt
} from 'tv-automation-sofie-blueprints-integration'
import { transformTimeline } from '../../../lib/timeline'
import { AdLibPiece } from '../../../lib/collections/AdLibPieces'
import { Random } from 'meteor/random'
import { prefixAllObjectIds } from './lib'
import { DeviceType } from 'timeline-state-resolver-types'

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
		piece => clone(createPieceGroup(piece))
	)
	objs.forEach((o: TimelineObjRundown) => {
		if (o.enable.start === 0 || o.enable.start === 'now') {
			o.enable.start = 100 // TODO: write a motivation for this
		}
	})
	const tlResolved = Resolver.resolveTimeline(transformTimeline(objs), {
		time: 0
	})

	let resolvedPieces: Array<PieceResolved> = []
	let firstUnresolvedId: string = ''
	_.each(tlResolved.objects, obj0 => {
		const obj = obj0 as any as TimelineObjRundown
		const pieceId = (obj.metadata || {}).pieceId
		const piece = _.clone(itemMap[pieceId]) as PieceResolved
		if (obj0.resolved.resolved) {
			piece.resolvedStart = (obj0.resolved.instances[0] || {}).start || 0
			piece.resolved = true
			resolvedPieces.push(piece)
		} else {
			piece.resolvedStart = 0
			piece.resolved = false

			resolvedPieces.push(piece)
			if (!firstUnresolvedId) firstUnresolvedId = obj.id
		}
	})

	if (tlResolved.statistics.unresolvedCount > 0) {
		logger.error(`Got ${tlResolved.statistics.unresolvedCount} unresolved timeline-objects for part #${part._id} (first is ${firstUnresolvedId})`)

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
): TimelineObjGroup & TimelineObjRundown {
	return literal<TimelineObjGroup & TimelineObjRundown>({
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
		objectType: TimelineObjType.RUNDOWN,
		enable: {
			...piece.enable,
			duration: piece.durationOverride || piece.duration || piece.expectedDuration || undefined
		},
		layer: piece.sourceLayerId,
		metadata: {
			pieceId: piece._id
		}
	})
}
export function getResolvedPieces (part: Part): Piece[] {
	const pieces = part.getAllPieces()

	const itemMap: { [key: string]: Piece } = {}
	pieces.forEach(piece => itemMap[piece._id] = piece)

	const objs = pieces.map(piece => clone(createPieceGroup(piece)))
	objs.forEach(o => {
		if (o.enable.start === 0 || o.enable.start === 'now') {
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

	_.each(tlResolved.objects, (obj0) => {
		const obj = obj0 as any as TimelineObjRundown
		const id = (obj.metadata || {}).pieceId

		if (obj0.resolved.resolved) {
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
		}
	})

	if (tlResolved.statistics.unresolvedCount > 0) {
		logger.warn(`Got ${tlResolved.statistics.unresolvedCount} unresolved pieces for piece #${part._id}`)
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
		return {
			...event.piece,
			enable: {
				start: Math.max(0, event.start - 1),
			},
			duration: Math.max(0, (event.end || 0) - event.start) || undefined
		}
	})

	// crop infinite pieces
	processedPieces.forEach((piece, index, source) => {
		if (piece.infiniteMode) {
			for (let i = index + 1; i < source.length; i++) {
				const sourcePiece = source[i]
				if (piece.sourceLayerId === sourcePiece.sourceLayerId) {
					piece.duration = (sourcePiece.enable.start as number) - (piece.enable.start as number)
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
			enable: { start: 'now' },
			dynamicallyInserted: true,
			infiniteMode: piece.originalInfiniteMode !== undefined ? piece.originalInfiniteMode : piece.infiniteMode,
			expectedDuration: piece.originalExpectedDuration !== undefined ? piece.originalExpectedDuration : piece.expectedDuration || 0 // set duration to infinite if not set by AdLibItem
		}
	))
	// delete newAdLibPiece.enable
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
			enable: {
				start: (queue ? 0 : 'now')
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
