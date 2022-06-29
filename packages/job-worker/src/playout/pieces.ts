import {
	PieceId,
	RundownPlaylistActivationId,
	RundownPlaylistId,
	PartInstanceId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import {
	PieceInstance,
	PieceInstancePiece,
	ResolvedPieceInstance,
} from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import {
	OnGenerateTimelineObjExt,
	TimelineObjGeneric,
	TimelineObjPieceAbstract,
	TimelineObjRundown,
	TimelineObjType,
} from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { ReadonlyDeep } from 'type-fest'
import { PieceLifespan, TSR, IBlueprintPieceType } from '@sofie-automation/blueprints-integration/dist'
import { clone, getRandomId, literal, normalizeArray, flatten, applyToArray } from '@sofie-automation/corelib/dist/lib'
import { Resolver, TimelineEnable } from 'superfly-timeline'
import { logger } from '../logging'
import { CacheForPlayout, getSelectedPartInstancesFromCache } from './cache'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { JobContext } from '../jobs'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import _ = require('underscore')
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { BucketAdLib } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibPiece'
import { getPieceFirstObjectId } from '@sofie-automation/corelib/dist/playout/ids'
import { getCurrentTime } from '../lib'
import { transformTimeline, TimelineContentObject } from '@sofie-automation/corelib/dist/playout/timeline'
import {
	PieceInstanceWithTimings,
	processAndPrunePieceInstanceTimings,
} from '@sofie-automation/corelib/dist/playout/infinites'
import {
	createPieceGroupAndCap,
	PieceGroupMetadata,
	PieceTimelineMetadata,
} from '@sofie-automation/corelib/dist/playout/pieces'

function comparePieceStart<T extends PieceInstancePiece>(a: T, b: T, nowInPart: number): 0 | 1 | -1 {
	if (a.pieceType === IBlueprintPieceType.OutTransition && b.pieceType !== IBlueprintPieceType.OutTransition) {
		return 1
	} else if (a.pieceType !== IBlueprintPieceType.OutTransition && b.pieceType === IBlueprintPieceType.OutTransition) {
		return -1
	}

	const aStart = a.enable.start === 'now' ? nowInPart : a.enable.start
	const bStart = b.enable.start === 'now' ? nowInPart : b.enable.start
	if (aStart < bStart) {
		return -1
	} else if (aStart > bStart) {
		return 1
	} else {
		const aIsInTransition = a.pieceType === IBlueprintPieceType.InTransition
		const bIsInTransition = b.pieceType === IBlueprintPieceType.InTransition
		// Transitions first
		if (aIsInTransition && !bIsInTransition) {
			return -1
		} else if (!aIsInTransition && bIsInTransition) {
			return 1
		} else if (a._id < b._id) {
			// Then go by id to make it consistent
			return -1
		} else if (a._id > b._id) {
			return 1
		} else {
			return 0
		}
	}
}

export function sortPieceInstancesByStart(pieces: PieceInstance[], nowInPart: number): PieceInstance[] {
	pieces.sort((a, b) => comparePieceStart(a.piece, b.piece, nowInPart))
	return pieces
}

export function sortPiecesByStart<T extends PieceInstancePiece>(pieces: T[]): T[] {
	pieces.sort((a, b) => comparePieceStart(a, b, 0))
	return pieces
}

export function createPieceGroupFirstObject(
	playlistId: RundownPlaylistId,
	pieceInstance: ReadonlyDeep<PieceInstance>,
	pieceGroup: TimelineObjRundown & OnGenerateTimelineObjExt,
	firstObjClasses?: string[]
): TimelineObjPieceAbstract & OnGenerateTimelineObjExt {
	const firstObject = literal<TimelineObjPieceAbstract & OnGenerateTimelineObjExt>({
		id: getPieceFirstObjectId(pieceInstance),
		pieceInstanceId: unprotectString(pieceInstance._id),
		infinitePieceInstanceId: pieceInstance.infinite?.infiniteInstanceId,
		partInstanceId: pieceGroup.partInstanceId,
		objectType: TimelineObjType.RUNDOWN,
		enable: { start: 0 },
		layer: pieceInstance.piece.sourceLayerId + '_firstobject',
		content: {
			deviceType: TSR.DeviceType.ABSTRACT,
			type: 'callback',
			callBack: 'piecePlaybackStarted',
			callBackData: {
				rundownPlaylistId: playlistId,
				pieceInstanceId: pieceInstance._id,
				dynamicallyInserted: pieceInstance.dynamicallyInserted !== undefined,
			},
			callBackStopped: 'piecePlaybackStopped', // Will cause a callback to be called, when the object stops playing:
		},
		classes: firstObjClasses,
		inGroup: pieceGroup.id,
	})
	return firstObject
}

function resolvePieceTimeline(
	objs: TimelineContentObject[],
	baseTime: number,
	pieceInstanceMap: { [id: string]: PieceInstance | undefined },
	resolveForStr: string
): ResolvedPieceInstance[] {
	const tlResolved = Resolver.resolveTimeline(objs, { time: baseTime })
	const resolvedPieces: Array<ResolvedPieceInstance> = []

	const unresolvedIds: string[] = []
	_.each(tlResolved.objects, (obj0) => {
		const obj = obj0 as any as TimelineObjRundown
		const id = unprotectString((obj.metaData as Partial<PieceGroupMetadata> | undefined)?.pieceId)

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
			// We only care about inTransitions here, outTransitions are either not present or will be timed appropriately
			const aIsInTransition = a.piece.pieceType === IBlueprintPieceType.InTransition
			const bIsInTransition = b.piece.pieceType === IBlueprintPieceType.InTransition
			if (aIsInTransition === bIsInTransition) {
				return 0
			} else if (bIsInTransition) {
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
			: undefined
	})

	return resolvedPieces
}

export function getResolvedPieces(
	context: JobContext,
	cache: CacheForPlayout,
	showStyleBase: ReadonlyDeep<DBShowStyleBase>,
	partInstance: DBPartInstance
): ResolvedPieceInstance[] {
	const span = context.startSpan('getResolvedPieces')
	const pieceInstances = cache.PieceInstances.findFetch({ partInstanceId: partInstance._id })

	const pieceInststanceMap = normalizeArray(pieceInstances, '_id')

	const now = getCurrentTime()
	const partStarted = partInstance.timings?.startedPlayback
	const nowInPart = now - (partStarted ?? 0)

	const preprocessedPieces: ReadonlyDeep<PieceInstanceWithTimings[]> = processAndPrunePieceInstanceTimings(
		showStyleBase,
		pieceInstances,
		nowInPart
	)

	const objs = flatten(
		preprocessedPieces.map((piece) => {
			const r = createPieceGroupAndCap(piece)
			return [r.pieceGroup, ...r.capObjs]
		})
	)
	objs.forEach((o) => {
		applyToArray(o.enable, (enable) => {
			if (enable.start === 'now' && partStarted) {
				// Emulate playout starting now. TODO - ensure didnt break other uses
				enable.start = nowInPart
			} else if (enable.start === 0 || enable.start === 'now') {
				enable.start = 1
			}
		})
	})

	const resolvedPieces = resolvePieceTimeline(
		transformTimeline(objs),
		0,
		pieceInststanceMap,
		`PartInstance #${partInstance._id}`
	)

	if (span) span.end()
	return resolvedPieces
}
export function getResolvedPiecesFromFullTimeline(
	context: JobContext,
	cache: CacheForPlayout,
	allObjs: TimelineObjGeneric[]
): { pieces: ResolvedPieceInstance[]; time: number } {
	const span = context.startSpan('getResolvedPiecesFromFullTimeline')
	const objs = clone(
		allObjs.filter((o) => (o.metaData as Partial<PieceTimelineMetadata> | undefined)?.isPieceTimeline)
	)

	const now = getCurrentTime()

	const playlist = cache.Playlist.doc
	const partInstanceIds = new Set(_.compact([playlist.previousPartInstanceId, playlist.currentPartInstanceId]))
	const pieceInstances: PieceInstance[] = cache.PieceInstances.findFetch((p) => partInstanceIds.has(p.partInstanceId))

	const { currentPartInstance } = getSelectedPartInstancesFromCache(cache) // todo: should these be passed as a parameter from getTimelineRundown?

	if (currentPartInstance && currentPartInstance.part.autoNext && playlist.nextPartInstanceId) {
		pieceInstances.push(...cache.PieceInstances.findFetch((p) => p.partInstanceId === playlist.nextPartInstanceId))
	}

	const transformedObjs = transformTimeline(objs)
	deNowifyTimeline(transformedObjs, now)

	const pieceInstanceMap = normalizeArray(pieceInstances, '_id')
	const resolvedPieces = resolvePieceTimeline(transformedObjs, now, pieceInstanceMap, 'timeline')

	if (span) span.end()
	return {
		pieces: resolvedPieces,
		time: now,
	}
}

/**
 * Replace any start:'now' in the timeline with concrete times.
 * This assumes that the structure is of a typical timeline, with 'now' being present at the root level, and one level deep.
 * If the parent group of a 'now' is not using a numeric start value, it will not be fixed
 */
export function deNowifyTimeline(transformedObjs: TimelineContentObject[], nowTime: number): void {
	for (const obj of transformedObjs) {
		let groupAbsoluteStart: number | null = null

		// Anything at this level can use nowTime directly
		let count = 0
		applyToArray(obj.enable, (enable: TimelineEnable) => {
			count++

			if (enable.start === 'now') {
				enable.start = nowTime
				groupAbsoluteStart = nowTime
			} else if (typeof enable.start === 'number') {
				groupAbsoluteStart = enable.start
			} else {
				// We can't resolve this here, so lets hope there are no 'now' inside and end
				groupAbsoluteStart = null
			}
		})

		// We know the time of the parent, or there are too many enable times for it
		if (groupAbsoluteStart !== null || count !== 1) {
			if (
				'partInstanceId' in (obj as TimelineContentObject & { partInstanceId?: PartInstanceId }) &&
				obj.isGroup &&
				obj.children &&
				obj.children.length
			) {
				// This should be piece groups, which are allowed to use 'now'
				for (const childObj of obj.children) {
					applyToArray(childObj.enable, (enable: TimelineEnable) => {
						if (enable.start === 'now' && groupAbsoluteStart !== null) {
							// Start is always relative to parent start, so we need to factor that when flattening the 'now
							enable.start = Math.max(0, nowTime - groupAbsoluteStart)
						}
					})

					// Note: we don't need to go deeper, as current timeline structure doesn't allow there to be any 'now' in there
				}
			}
		}
	}
}

export function convertPieceToAdLibPiece(context: JobContext, piece: PieceInstancePiece): AdLibPiece {
	const span = context.startSpan('convertPieceToAdLibPiece')
	// const oldId = piece._id
	const newAdLibPiece = literal<AdLibPiece>({
		...piece,
		_id: getRandomId(),
		_rank: 0,
		expectedDuration: piece.enable.duration,
		rundownId: protectString(''),
	})

	if (span) span.end()
	return newAdLibPiece
}

export function convertAdLibToPieceInstance(
	context: JobContext,
	playlistActivationId: RundownPlaylistActivationId,
	adLibPiece: AdLibPiece | Piece | BucketAdLib | PieceInstancePiece,
	partInstance: DBPartInstance,
	queue: boolean
): PieceInstance {
	const span = context.startSpan('convertAdLibToPieceInstance')
	let duration: number | undefined = undefined
	if ('expectedDuration' in adLibPiece && adLibPiece['expectedDuration']) {
		duration = adLibPiece['expectedDuration']
	} else if ('enable' in adLibPiece && adLibPiece['enable'] && adLibPiece['enable'].duration) {
		duration = adLibPiece['enable'].duration
	}

	const newPieceId: PieceId = getRandomId()
	const newPieceInstance = literal<PieceInstance>({
		_id: protectString(`${partInstance._id}_${newPieceId}`),
		rundownId: partInstance.rundownId,
		partInstanceId: partInstance._id,
		playlistActivationId,
		adLibSourceId: adLibPiece._id,
		dynamicallyInserted: queue ? undefined : getCurrentTime(),
		piece: literal<PieceInstancePiece>({
			...(_.omit(adLibPiece, '_rank', 'expectedDuration', 'partId', 'rundownId') as PieceInstancePiece), // TODO - this could be typed stronger
			_id: newPieceId,
			startPartId: partInstance.part._id,
			pieceType: IBlueprintPieceType.Normal,
			enable: {
				start: queue ? 0 : 'now',
				duration: !queue && adLibPiece.lifespan === PieceLifespan.WithinPart ? duration : undefined,
			},
		}),
	})

	setupPieceInstanceInfiniteProperties(newPieceInstance)

	if (span) span.end()
	return newPieceInstance
}

export function setupPieceInstanceInfiniteProperties(pieceInstance: PieceInstance): void {
	if (pieceInstance.piece.lifespan !== PieceLifespan.WithinPart) {
		// Set it up as an infinite
		pieceInstance.infinite = {
			infiniteInstanceId: getRandomId(),
			infiniteInstanceIndex: 0,
			infinitePieceId: pieceInstance.piece._id,
			fromPreviousPart: false,
		}
	}
}
