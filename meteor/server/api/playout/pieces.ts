/* tslint:disable:no-use-before-declare */
import { Resolver } from 'superfly-timeline'
import * as _ from 'underscore'
import { Part, PartId } from '../../../lib/collections/Parts'
import { Piece } from '../../../lib/collections/Pieces'
import {
	literal,
	extendMandadory,
	getCurrentTime,
	clone,
	normalizeArray,
	protectString,
	unprotectObject,
	unprotectString,
} from '../../../lib/lib'
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
	TSR,
	PieceLifespan,
} from 'tv-automation-sofie-blueprints-integration'
import { transformTimeline, TimelineContentObject } from '../../../lib/timeline'
import { AdLibPiece } from '../../../lib/collections/AdLibPieces'
import { Random } from 'meteor/random'
import { prefixAllObjectIds, getAllPiecesFromCache, getSelectedPartInstancesFromCache } from './lib'
import { calculatePieceTimelineEnable } from '../../../lib/Rundown'
import { RundownPlaylistPlayoutData, RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { postProcessAdLibPieces } from '../blueprints/postProcess'
import { BucketAdLib } from '../../../lib/collections/BucketAdlibs'
import { PieceInstance, ResolvedPieceInstance, PieceInstanceId } from '../../../lib/collections/PieceInstances'
import { PartInstance } from '../../../lib/collections/PartInstances'
import { CacheForRundownPlaylist } from '../../DatabaseCaches'

export interface PieceResolved extends Piece {
	/** Resolved start time of the piece */
	resolvedStart: number
	/** Whether the piece was successfully resolved */
	resolved: boolean
}
export function orderPieces(pieces: Piece[], partId: PartId, partStarted?: number): Array<PieceResolved> {
	const now = getCurrentTime()

	const pieceMap = normalizeArray(pieces, '_id')

	const objs: Array<TimelineObjRundown> = pieces.map((piece) => {
		const obj = createPieceGroup({
			_id: protectString(unprotectString(piece._id)) as PieceInstanceId, // Set the id to the same, as it is just for metadata
			rundownId: piece.rundownId,
			piece: piece,
		})

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
		time: 0,
	})

	let resolvedPieces: Array<PieceResolved> = []
	let unresolvedIds: string[] = []
	let unresolvedCount = tlResolved.statistics.unresolvedCount
	_.each(tlResolved.objects, (obj0) => {
		const obj = (obj0 as any) as TimelineObjRundown
		const pieceInstanceId = (obj.metaData || {}).pieceId
		const piece = _.clone(pieceMap[pieceInstanceId]) as PieceResolved
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
		logger.error(
			`Got ${unresolvedCount} unresolved timeline-objects for part #${partId} (${unresolvedIds.join(', ')})`
		)
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
export function getOrderedPiece(cache: CacheForRundownPlaylist, part: Part): Array<PieceResolved> {
	const pieces = getAllPiecesFromCache(cache, part)
	const partStarted = part.getLastStartedPlayback()

	return orderPieces(pieces, part._id, partStarted)
}
export function createPieceGroupFirstObject(
	pieceInstance: PieceInstance,
	pieceGroup: TimelineObjRundown,
	firstObjClasses?: string[]
): TimelineObjPieceAbstract & OnGenerateTimelineObj {
	const firstObject = literal<TimelineObjPieceAbstract & OnGenerateTimelineObj>({
		id: getPieceFirstObjectId(unprotectObject(pieceInstance.piece)),
		_id: protectString(''), // set later
		studioId: protectString(''), // set later
		pieceInstanceId: unprotectString(pieceInstance._id),
		infinitePieceId: unprotectString(pieceInstance.piece.infiniteId),
		objectType: TimelineObjType.RUNDOWN,
		enable: { start: 0 },
		layer: pieceInstance.piece.sourceLayerId + '_firstobject',
		content: {
			deviceType: TSR.DeviceType.ABSTRACT,
			type: 'callback',
			callBack: 'piecePlaybackStarted',
			callBackData: {
				rundownId: pieceInstance.rundownId,
				pieceInstanceId: pieceInstance._id,
				dynamicallyInserted: pieceInstance.piece.dynamicallyInserted,
			},
			callBackStopped: 'piecePlaybackStopped', // Will cause a callback to be called, when the object stops playing:
		},
		classes: firstObjClasses,
		inGroup: pieceGroup.id,
	})
	return firstObject
}
export function createPieceGroup(
	pieceInstance: Pick<PieceInstance, '_id' | 'rundownId' | 'piece'>,
	partGroup?: TimelineObjRundown
): TimelineObjGroup & TimelineObjRundown & OnGenerateTimelineObj {
	return literal<TimelineObjGroup & TimelineObjRundown & OnGenerateTimelineObj>({
		id: getPieceGroupId(unprotectObject(pieceInstance.piece)),
		_id: protectString(''), // set later
		studioId: protectString(''), // set later
		content: {
			deviceType: TSR.DeviceType.ABSTRACT,
			type: TimelineContentTypeOther.GROUP,
		},
		children: [],
		inGroup: partGroup && partGroup.id,
		isGroup: true,
		pieceInstanceId: unprotectString(pieceInstance._id),
		infinitePieceId: unprotectString(pieceInstance.piece.infiniteId),
		objectType: TimelineObjType.RUNDOWN,
		enable: calculatePieceTimelineEnable(pieceInstance.piece),
		layer: pieceInstance.piece.sourceLayerId,
		metaData: {
			pieceId: pieceInstance._id,
		},
	})
}

function resolvePieceTimeline(
	objs: TimelineContentObject[],
	baseTime: number,
	pieceInstanceMap: { [id: string]: PieceInstance | undefined },
	resolveForStr: string
): ResolvedPieceInstance[] {
	const tlResolved = Resolver.resolveTimeline(objs, { time: baseTime })
	const resolvedPieces: Array<ResolvedPieceInstance> = []

	let unresolvedIds: string[] = []
	_.each(tlResolved.objects, (obj0) => {
		const obj = (obj0 as any) as TimelineObjRundown
		const id = (obj.metaData || {}).pieceId

		if (!id) return

		const pieceInstance = pieceInstanceMap[id]
		// Erm... How?
		if (!pieceInstance) {
			unresolvedIds.push(id)
			return
		}

		if (obj0.resolved.resolved && obj0.resolved.instances && obj0.resolved.instances.length > 0) {
			const firstInstance = obj0.resolved.instances[0] || {}
			resolvedPieces.push(
				literal<ResolvedPieceInstance>({
					...pieceInstance,
					resolvedStart: firstInstance.start || baseTime,
					resolvedDuration: firstInstance.end
						? firstInstance.end - (firstInstance.start || baseTime)
						: undefined,
				})
			)
		} else {
			resolvedPieces.push(
				literal<ResolvedPieceInstance>({
					...pieceInstance,
					resolvedStart: baseTime,
					resolvedDuration: undefined,
				})
			)
			unresolvedIds.push(id)
		}
	})

	if (tlResolved.statistics.unresolvedCount > 0) {
		logger.warn(
			`Got ${tlResolved.statistics.unresolvedCount} unresolved pieces for ${resolveForStr} (${unresolvedIds.join(
				', '
			)})`
		)
	}
	if (_.size(pieceInstanceMap) !== resolvedPieces.length) {
		logger.warn(
			`Got ${resolvedPieces.length} ordered pieces. Expected ${_.size(pieceInstanceMap)}. for ${resolveForStr}`
		)
	}

	// Sort the pieces by time, then transitions first
	resolvedPieces.sort((a, b) => {
		if (a.resolvedStart < b.resolvedStart) {
			return -1
		} else if (a.resolvedStart > b.resolvedStart) {
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

	// Clamp the times to be reasonably valid
	resolvedPieces.forEach((resolvedPiece) => {
		resolvedPiece.resolvedStart = Math.max(0, resolvedPiece.resolvedStart - 1)
		resolvedPiece.resolvedDuration = resolvedPiece.resolvedDuration
			? Math.max(0, resolvedPiece.resolvedDuration)
			: undefined // TODO does this behave the same?
	})

	return resolvedPieces
}

export function getResolvedPieces(cache: CacheForRundownPlaylist, partInstance: PartInstance): ResolvedPieceInstance[] {
	const pieceInstances = cache.PieceInstances.findFetch({ partInstanceId: partInstance._id })

	const pieceInststanceMap = normalizeArray(pieceInstances, '_id')

	const objs = pieceInstances.map((piece) => clone(createPieceGroup(piece)))
	objs.forEach((o) => {
		if (o.enable.start === 'now' && partInstance.part.getLastStartedPlayback()) {
			// Emulate playout starting now. TODO - ensure didnt break other uses
			o.enable.start = getCurrentTime() - (partInstance.part.getLastStartedPlayback() || 0)
		} else if (o.enable.start === 0 || o.enable.start === 'now') {
			o.enable.start = 1
		}
	})

	const resolvedPieces = resolvePieceTimeline(
		transformTimeline(objs),
		0,
		pieceInststanceMap,
		`PartInstance #${partInstance._id}`
	)

	// crop infinite pieces
	resolvedPieces.forEach((pieceInstance, index, source) => {
		if (pieceInstance.piece.infiniteMode) {
			for (let i = index + 1; i < source.length; i++) {
				const sourcePieceInstance = source[i]
				if (pieceInstance.piece.sourceLayerId === sourcePieceInstance.piece.sourceLayerId) {
					// TODO - verify this (it is different to the getResolvedPiecesFromFullTimeline...)
					pieceInstance.resolvedDuration = sourcePieceInstance.resolvedStart - pieceInstance.resolvedStart
					return
				}
			}
		}
	})

	return resolvedPieces
}
export function getResolvedPiecesFromFullTimeline(
	cache: CacheForRundownPlaylist,
	playlist: RundownPlaylist,
	allObjs: TimelineObjGeneric[]
): { pieces: ResolvedPieceInstance[]; time: number } {
	const objs = clone(
		allObjs.filter((o) => o.isGroup && ((o as any).isPartGroup || (o.metaData && o.metaData.pieceId)))
	)

	const now = getCurrentTime()

	const partInstanceIds = _.compact([playlist.previousPartInstanceId, playlist.currentPartInstanceId])
	const pieceInstances: PieceInstance[] = cache.PieceInstances.findFetch(
		(p) => partInstanceIds.indexOf(p.partInstanceId) !== -1
	)

	const { currentPartInstance, nextPartInstance } = getSelectedPartInstancesFromCache(cache, playlist) // todo: should these be passed as a parameter from getTimelineRundown?

	if (currentPartInstance && currentPartInstance.part.autoNext && playlist.nextPartInstanceId) {
		pieceInstances.push(...cache.PieceInstances.findFetch((p) => p.partInstanceId === playlist.nextPartInstanceId))
	}

	const replaceNows = (obj: TimelineContentObject, parentAbsoluteStart: number) => {
		let absoluteStart = parentAbsoluteStart
		if (obj.enable.start === 'now') {
			// Start is always relative to parent start, so we need to factor that when flattening the 'now
			obj.enable.start = Math.max(0, now - parentAbsoluteStart)
			absoluteStart = now
		} else if (typeof obj.enable.start === 'number') {
			absoluteStart += obj.enable.start
		} else {
			// We can't resolve this here, so lets hope there are no 'now' inside and end
			return
		}

		// Ensure any children have their 'now's updated
		if (obj.isGroup && obj.children && obj.children.length) {
			obj.children.forEach((ch) => replaceNows(ch, absoluteStart))
		}
	}
	const transformedObjs = transformTimeline(objs)
	transformedObjs.forEach((o) => replaceNows(o, 0))

	const pieceInstanceMap = normalizeArray(pieceInstances, '_id')
	const resolvedPieces = resolvePieceTimeline(transformedObjs, now, pieceInstanceMap, 'timeline')

	// crop infinite pieces
	resolvedPieces.forEach((instance, index, source) => {
		if (instance.piece.infiniteMode) {
			// && piece.infiniteMode !== PieceLifespan.OutOnNextPart) {
			for (let i = index + 1; i < source.length; i++) {
				const sourceInstance = source[i]
				if (instance.piece.sourceLayerId === sourceInstance.piece.sourceLayerId) {
					// TODO - verify this, the min is necessary and correct though (and it is different to getResolvedPieces)
					const infDuration = sourceInstance.resolvedStart - instance.resolvedStart
					if (instance.resolvedDuration) {
						instance.resolvedDuration = Math.min(instance.resolvedDuration, infDuration)
					} else {
						instance.resolvedDuration = infDuration
					}
					return
				}
			}
		}
	})

	return {
		pieces: resolvedPieces,
		time: now,
	}
}

export function convertPieceToAdLibPiece(piece: Piece): AdLibPiece {
	// const oldId = piece._id
	const newId = Random.id()
	const newAdLibPiece = literal<AdLibPiece>({
		..._.omit(piece, 'userDuration', 'timings', 'startedPlayback', 'stoppedPlayback', 'infiniteId'),
		_id: newId,
		_rank: 0,
		disabled: false,
		dynamicallyInserted: true,
		infiniteMode: piece.originalInfiniteMode !== undefined ? piece.originalInfiniteMode : piece.infiniteMode,
		expectedDuration: _.isNumber(piece.enable.duration) ? piece.enable.duration : 0,
	})

	if (newAdLibPiece.content && newAdLibPiece.content.timelineObjects) {
		let contentObjects = newAdLibPiece.content.timelineObjects
		const objs = prefixAllObjectIds(
			_.compact(
				_.map(contentObjects, (obj: TimelineObjectCoreExt) => {
					return extendMandadory<TimelineObjectCoreExt, TimelineObjGeneric>(obj, {
						_id: protectString(''), // set later
						studioId: protectString(''), // set later
						objectType: TimelineObjType.RUNDOWN,
					})
				})
			),
			newId + '_'
		)
		newAdLibPiece.content.timelineObjects = objs
	}
	return newAdLibPiece
}

export function convertAdLibToPieceInstance(
	adLibPiece: AdLibPiece | Piece | BucketAdLib,
	partInstance: PartInstance,
	queue: boolean
): PieceInstance {
	let duration: number | string | undefined = undefined
	if (adLibPiece['expectedDuration']) {
		duration = adLibPiece['expectedDuration']
	} else if (adLibPiece['enable'] && adLibPiece['enable'].duration) {
		duration = adLibPiece['enable'].duration
	}

	const newPieceId = Random.id()
	const newPieceInstance = literal<PieceInstance>({
		_id: protectString(`${partInstance._id}_${newPieceId}`),
		rundownId: partInstance.rundownId,
		partInstanceId: partInstance._id,
		piece: {
			..._.omit(adLibPiece, '_rank', 'expectedDuration', 'startedPlayback', 'stoppedPlayback'), // TODO - this could be typed stronger
			_id: newPieceId,
			rundownId: partInstance.rundownId,
			partId: partInstance.part._id,
			enable: {
				start: queue ? 0 : 'now',
				duration: !queue && adLibPiece.infiniteMode === PieceLifespan.Normal ? duration : undefined,
			},
			adLibSourceId: adLibPiece._id,
			dynamicallyInserted: !queue,
			timings: {
				take: [getCurrentTime()],
				startedPlayback: [],
				next: [],
				stoppedPlayback: [],
				playOffset: [],
				takeDone: [],
				takeOut: [],
			},
		},
	})

	if (newPieceInstance.piece.content && newPieceInstance.piece.content.timelineObjects) {
		let contentObjects = newPieceInstance.piece.content.timelineObjects
		const objs = prefixAllObjectIds(
			_.compact(
				_.map(contentObjects, (obj) => {
					return extendMandadory<TimelineObjectCoreExt, TimelineObjGeneric>(obj, {
						_id: protectString(''), // set later
						studioId: protectString(''), // set later
						objectType: TimelineObjType.RUNDOWN,
					})
				})
			),
			newPieceId + '_'
		)
		newPieceInstance.piece.content.timelineObjects = objs
	}
	return newPieceInstance
}

// export function resolveActivePieces (playlistId: RundownPlaylistId, part: Part, now: number): Piece[] {
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
