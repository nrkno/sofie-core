import { PartInstanceId, RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PieceInstance, ResolvedPieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { TimelineObjGeneric, TimelineObjRundown } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { IBlueprintPieceType, TSR } from '@sofie-automation/blueprints-integration/dist'
import { clone, literal, normalizeArray, applyToArray, normalizeArrayToMap } from '@sofie-automation/corelib/dist/lib'
import { Resolver, TimelineEnable } from 'superfly-timeline'
import { logger } from '../logging'
import { CacheForPlayout, getSelectedPartInstancesFromCache } from './cache'
import { SourceLayers } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { JobContext } from '../jobs'
import _ = require('underscore')
import { getCurrentTime } from '../lib'
import { transformTimeline, TimelineContentObject } from '@sofie-automation/corelib/dist/playout/timeline'
import {
	PieceInstanceWithTimings,
	processAndPrunePieceInstanceTimings,
} from '@sofie-automation/corelib/dist/playout/processAndPrune'
import { createPieceGroupAndCap, PieceTimelineMetadata } from '@sofie-automation/corelib/dist/playout/pieces'
import { ReadOnlyCache } from '../cache/CacheBase'

function resolvePieceTimeline(
	objs: TimelineContentObject[],
	baseTime: number,
	pieceInstanceMap: { [id: string]: PieceInstance | undefined },
	resolveForStr: string
): ResolvedPieceInstance[] {
	const tlResolved = Resolver.resolveTimeline(objs as any, { time: baseTime })
	const resolvedPieces: Array<ResolvedPieceInstance> = []

	const unresolvedIds: string[] = []
	_.each(tlResolved.objects, (obj0) => {
		const obj = obj0 as any as TimelineObjRundown
		const pieceInstanceId = unprotectString(
			(obj.metaData as Partial<PieceTimelineMetadata> | undefined)?.pieceInstanceGroupId
		)

		if (!pieceInstanceId) return

		const pieceInstance = pieceInstanceMap[pieceInstanceId]
		// Erm... How?
		if (!pieceInstance) {
			unresolvedIds.push(pieceInstanceId)
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
			unresolvedIds.push(pieceInstanceId)
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

/**
 * Resolve an array of PieceInstanceWithTimings to approximated numbers within the PartInstance
 * @param nowInPart Approximate time of the playhead within the PartInstance
 * @param pieceInstances The PieceInstances to resolve
 */
export function resolvePrunedPieceInstances(
	nowInPart: number,
	pieceInstances: PieceInstanceWithTimings[]
): ResolvedPieceInstance[] {
	const pieceInstancesMap = normalizeArrayToMap(pieceInstances, '_id')

	const resolveStartOfInstance = (instance: PieceInstanceWithTimings): number => {
		return instance.piece.enable.start === 'now' ? nowInPart : instance.piece.enable.start
	}

	return pieceInstances.map((instance) => {
		const resolvedStart = resolveStartOfInstance(instance)

		// Interpret the `resolvedEndCap` property into a number
		let resolvedEnd: number | undefined
		if (typeof instance.resolvedEndCap === 'number') {
			resolvedEnd = instance.resolvedEndCap
			// } else if (instance.resolvedEndCap === 'now') {
			// 	// TODO - something should test this route?
			// 	// resolvedEnd = nowInPart
		} else if (instance.resolvedEndCap) {
			const otherInstance = pieceInstancesMap.get(instance.resolvedEndCap.relativeToStartOf)
			if (otherInstance) {
				resolvedEnd = resolveStartOfInstance(otherInstance)
			}
		}

		// There are multiple potential durations of this Piece
		const caps: number[] = []
		if (resolvedEnd !== undefined) caps.push(resolvedEnd - resolvedStart)

		// If the piece has a duration set, that may be the needed duration
		if (instance.piece.enable.duration !== undefined) caps.push(instance.piece.enable.duration)

		// If the piece has a userDuration set, that may be the needed duration
		if (instance.userDuration) {
			if ('endRelativeToPart' in instance.userDuration) {
				caps.push(instance.userDuration.endRelativeToPart - resolvedStart)
			} else if ('endRelativeToNow' in instance.userDuration) {
				caps.push(nowInPart + instance.userDuration.endRelativeToNow - resolvedStart)
			}
		}

		return {
			...instance,
			resolvedStart,
			resolvedDuration: caps.length ? Math.min(...caps) : undefined,
		}
	})
}

/**
 * Resolve the PieceInstances for a PartInstance
 * Uses the getCurrentTime() as approximation for 'now'
 * @param context Context for current job
 * @param cache Cache for the active Playlist
 * @param sourceLayers SourceLayers for the current ShowStyle
 * @param partInstance PartInstance to resolve
 * @returns ResolvedPieceInstances sorted by startTime
 */
export function getResolvedPieces(
	context: JobContext,
	cache: ReadOnlyCache<CacheForPlayout>,
	sourceLayers: SourceLayers,
	partInstance: Pick<DBPartInstance, '_id' | 'timings'>
): ResolvedPieceInstance[] {
	const pieceInstances = cache.PieceInstances.findAll((p) => p.partInstanceId === partInstance._id)

	const now = getCurrentTime()
	const partStarted = partInstance.timings?.plannedStartedPlayback
	const nowInPart = partStarted ? now - partStarted : null

	return getResolvedPiecesInner(context, sourceLayers, cache.PlaylistId, partInstance._id, nowInPart, pieceInstances)
}

export function getResolvedPiecesInner(
	context: JobContext,
	sourceLayers: SourceLayers,
	playlistId: RundownPlaylistId,
	partInstanceId: PartInstanceId,
	nowInPart: number | null,
	pieceInstances: PieceInstance[]
): ResolvedPieceInstance[] {
	const span = context.startSpan('getResolvedPieces')

	const pieceInststanceMap = normalizeArray(pieceInstances, '_id')

	const preprocessedPieces = processAndPrunePieceInstanceTimings(sourceLayers, pieceInstances, nowInPart ?? 0)

	const deNowify = (o: TimelineObjRundown) => {
		applyToArray(o.enable, (enable) => {
			if (enable.start === 'now' && nowInPart !== null) {
				// Emulate playout starting now. TODO - ensure didnt break other uses
				enable.start = nowInPart
			} else if (enable.start === 0 || enable.start === 'now') {
				enable.start = 1
			}
		})
		return o
	}

	const objs: TimelineObjGeneric[] = []
	for (const piece of preprocessedPieces) {
		let controlObjEnable: TSR.Timeline.TimelineEnable = piece.piece.enable
		if (piece.userDuration) {
			controlObjEnable = {
				start: piece.piece.enable.start,
			}

			if ('endRelativeToPart' in piece.userDuration) {
				controlObjEnable.end = piece.userDuration.endRelativeToPart
			} else {
				controlObjEnable.end = nowInPart ?? 0 + piece.userDuration.endRelativeToNow
			}
		}

		const { controlObj, childGroup, capObjs } = createPieceGroupAndCap(playlistId, piece, controlObjEnable)
		objs.push(deNowify(controlObj), ...capObjs.map(deNowify), deNowify(childGroup))
	}

	const resolvedPieces = resolvePieceTimeline(
		transformTimeline(objs),
		0,
		pieceInststanceMap,
		`PartInstance #${partInstanceId}`
	)

	if (span) span.end()
	return resolvedPieces
}

/**
 * Parse the timeline, to compile the resolved PieceInstances on the timeline
 * Uses the getCurrentTime() as approximation for 'now'
 * @param context Context for current job
 * @param cache Cache for the active Playlist
 * @param allObjs TimelineObjects to consider
 * @returns ResolvedPieceInstances sorted by startTime
 */
export function getResolvedPiecesFromFullTimeline(
	context: JobContext,
	cache: ReadOnlyCache<CacheForPlayout>,
	allObjs: TimelineObjGeneric[]
): { pieces: ResolvedPieceInstance[]; time: number } {
	const span = context.startSpan('getResolvedPiecesFromFullTimeline')
	const objs = clone(
		allObjs.filter((o) => (o.metaData as Partial<PieceTimelineMetadata> | undefined)?.isPieceTimeline)
	)

	const now = getCurrentTime()

	const playlist = cache.Playlist.doc
	const partInstanceIds = new Set(
		_.compact([playlist.previousPartInfo?.partInstanceId, playlist.currentPartInfo?.partInstanceId])
	)
	const pieceInstances: PieceInstance[] = cache.PieceInstances.findAll((p) => partInstanceIds.has(p.partInstanceId))

	const { currentPartInstance } = getSelectedPartInstancesFromCache(cache) // todo: should these be passed as a parameter from getTimelineRundown?

	if (currentPartInstance?.part?.autoNext && playlist.nextPartInfo) {
		pieceInstances.push(
			...cache.PieceInstances.findAll((p) => p.partInstanceId === playlist.nextPartInfo?.partInstanceId)
		)
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
 * @param transformedObjs Timeline objects to consider
 * @param nowTime Time to substitute in instead of 'now'
 */
function deNowifyTimeline(transformedObjs: TimelineContentObject[], nowTime: number): void {
	for (const obj of transformedObjs) {
		let groupAbsoluteStart: number | null = null

		const obj2 = obj as TimelineContentObject & { partInstanceId?: PartInstanceId }
		const partInstanceId = 'partInstanceId' in obj2 ? obj2.partInstanceId : undefined

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
			if (partInstanceId && obj.isGroup && obj.children && obj.children.length) {
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
