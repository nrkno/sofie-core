import { getOrderedPartsAfterPlayhead, PartAndPieces, PartInstanceAndPieceInstances } from './util'
import { findLookaheadForLayer, LookaheadResult } from './findForLayer'
import { CacheForPlayout, getRundownIDsFromCache } from '../cache'
import { sortPieceInstancesByStart } from '../pieces'
import { MappingExt } from '@sofie-automation/corelib/dist/dataModel/Studio'
import {
	Timeline as TimelineTypes,
	LookaheadMode,
	OnGenerateTimelineObj,
} from '@sofie-automation/blueprints-integration'
import { SelectedPartInstancesTimelineInfo, SelectedPartInstanceTimelineInfo } from '../timeline/generate'
import {
	OnGenerateTimelineObjExt,
	TimelineObjRundown,
	updateLookaheadLayer,
} from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { JobContext } from '../../jobs'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { PieceInstance, wrapPieceToInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { PartId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { clone } from '@sofie-automation/corelib/dist/lib'
import { Filter as FilterQuery } from 'mongodb'
import _ = require('underscore')
import { LOOKAHEAD_DEFAULT_SEARCH_DISTANCE } from '@sofie-automation/shared-lib/dist/core/constants'
import { prefixSingleObjectId } from '../lib'
import { LookaheadTimelineObject } from './findObjects'
import { hasPieceInstanceDefinitelyEnded } from '../timeline/lib'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'

const LOOKAHEAD_OBJ_PRIORITY = 0.1

function parseSearchDistance(rawVal: number | undefined): number {
	if (typeof rawVal !== 'number' || rawVal <= -1) {
		return LOOKAHEAD_DEFAULT_SEARCH_DISTANCE
	} else {
		return rawVal
	}
}

function findLargestLookaheadDistance(mappings: Array<[string, MappingExt]>): number {
	const values = mappings.map(([_id, m]) => parseSearchDistance(m.lookaheadMaxSearchDistance))
	return _.max(values)
}

type ValidLookaheadMode = LookaheadMode.PRELOAD | LookaheadMode.WHEN_CLEAR

export async function getLookeaheadObjects(
	context: JobContext,
	cache: CacheForPlayout,
	partInstancesInfo0: SelectedPartInstancesTimelineInfo
): Promise<Array<TimelineObjRundown & OnGenerateTimelineObjExt>> {
	const span = context.startSpan('getLookeaheadObjects')
	const allMappings = applyAndValidateOverrides(context.studio.mappingsWithOverrides)
	const mappingsToConsider = Object.entries(allMappings.obj).filter(
		([_id, map]) => map.lookahead !== LookaheadMode.NONE && map.lookahead !== undefined
	)
	if (mappingsToConsider.length === 0) {
		if (span) span.end()
		return []
	}

	const maxLookaheadDistance = findLargestLookaheadDistance(mappingsToConsider)
	const orderedPartsFollowingPlayhead = getOrderedPartsAfterPlayhead(context, cache, maxLookaheadDistance)

	const piecesToSearchQuery: FilterQuery<Piece> = {
		startRundownId: { $in: getRundownIDsFromCache(cache) },
		startPartId: { $in: orderedPartsFollowingPlayhead.map((p) => p._id) },
		invalid: { $ne: true },
	}
	const pPiecesToSearch = context.directCollections.Pieces.findFetch(piecesToSearchQuery, {
		projection: {
			metaData: 0,

			// these are known to be chunky when they exist
			'content.externalPayload': 0,
			'content.payload': 0,
		},
	})

	function removeInfiniteContinuations(info: PartInstanceAndPieceInstances): PartInstanceAndPieceInstances {
		const partId = info.part.part._id
		return {
			...info,
			// Ignore PieceInstances that continue from the previous part, as they will not need lookahead
			allPieces: info.allPieces.filter((inst) => !inst.infinite || inst.piece.startPartId === partId),
		}
	}

	function getPrunedEndedPieceInstances(info: SelectedPartInstanceTimelineInfo) {
		if (!info.partInstance.timings?.plannedStartedPlayback) {
			return info.pieceInstances
		} else {
			return info.pieceInstances.filter((p) => !hasPieceInstanceDefinitelyEnded(p, info.nowInPart))
		}
	}
	const partInstancesInfo: PartInstanceAndPieceInstances[] = _.compact([
		partInstancesInfo0.current
			? removeInfiniteContinuations({
					part: partInstancesInfo0.current.partInstance,
					onTimeline: true,
					nowInPart: partInstancesInfo0.current.nowInPart,
					allPieces: getPrunedEndedPieceInstances(partInstancesInfo0.current),
			  })
			: undefined,
		partInstancesInfo0.next
			? removeInfiniteContinuations({
					part: partInstancesInfo0.next.partInstance,
					onTimeline: !!partInstancesInfo0.current?.partInstance?.part?.autoNext,
					nowInPart: partInstancesInfo0.next.nowInPart,
					allPieces: partInstancesInfo0.next.pieceInstances,
			  })
			: undefined,
	])

	// Track the previous info for checking how the timeline will be built
	let previousPartInfo: PartInstanceAndPieceInstances | undefined
	if (partInstancesInfo0.previous) {
		previousPartInfo = removeInfiniteContinuations({
			part: partInstancesInfo0.previous.partInstance,
			onTimeline: true,
			nowInPart: partInstancesInfo0.previous.nowInPart,
			allPieces: getPrunedEndedPieceInstances(partInstancesInfo0.previous),
		})
	}

	// TODO: Do we need to use processAndPrunePieceInstanceTimings on these pieces? In theory yes, but that gets messy and expensive.
	// In reality, there are not likely to be any/many conflicts if the blueprints are written well so it shouldnt be a problem
	const piecesToSearch = await pPiecesToSearch

	const piecesByPart = new Map<PartId, Array<PieceInstance>>()
	for (const piece of piecesToSearch) {
		const pieceInstance = wrapPieceToInstance(piece, protectString(''), protectString(''), true)
		const existing = piecesByPart.get(piece.startPartId)
		if (existing) {
			existing.push(pieceInstance)
		} else {
			piecesByPart.set(piece.startPartId, [pieceInstance])
		}
	}

	const orderedPartInfos: Array<PartAndPieces> = orderedPartsFollowingPlayhead.map((part) => ({
		part,
		pieces: sortPieceInstancesByStart(piecesByPart.get(part._id) || [], 0),
	}))

	const span2 = context.startSpan('getLookeaheadObjects.iterate')
	const timelineObjs: Array<TimelineObjRundown & OnGenerateTimelineObjExt> = []
	const futurePartCount = orderedPartInfos.length + (partInstancesInfo0.next ? 1 : 0)
	for (const [layerId, mapping] of mappingsToConsider) {
		if (mapping.lookahead !== LookaheadMode.NONE) {
			const lookaheadTargetObjects = mapping.lookaheadDepth || 1
			const lookaheadMaxSearchDistance = Math.min(
				parseSearchDistance(mapping.lookaheadMaxSearchDistance),
				futurePartCount
			)

			const lookaheadObjs = findLookaheadForLayer(
				context,
				cache.Playlist.doc.currentPartInstanceId,
				partInstancesInfo,
				previousPartInfo,
				orderedPartInfos,
				layerId,
				lookaheadTargetObjects,
				lookaheadMaxSearchDistance
			)

			timelineObjs.push(...processResult(lookaheadObjs, mapping.lookahead))
		}
	}
	span2?.end()

	span?.end()
	return timelineObjs
}

// elsewhere uses prefixAllObjectIds to do this, but we want to apply to a single object from itself
const getStartOfObjectRef = (obj: TimelineObjRundown & OnGenerateTimelineObj<any>): string =>
	`#${prefixSingleObjectId(obj, obj.pieceInstanceId ?? '')}.start`
const calculateStartAfterPreviousObj = (
	prevObj: TimelineObjRundown & OnGenerateTimelineObj<any>
): TimelineTypes.TimelineEnable => {
	const prevHasDelayFlag = (prevObj.classes || []).indexOf('_lookahead_start_delay') !== -1

	// Start with previous piece
	const startOffset = prevHasDelayFlag ? 2000 : 0
	return {
		start: `${getStartOfObjectRef(prevObj)} + ${startOffset}`,
	}
}
function mutateLookaheadObject(
	rawObj: LookaheadTimelineObject,
	i: string,
	enable: TimelineObjRundown['enable'],
	mode: ValidLookaheadMode,
	priority: number,
	disabled: boolean
): LookaheadTimelineObject {
	const obj = clone(rawObj)

	obj.id = `lookahead_${i}_${prefixSingleObjectId(obj, obj.pieceInstanceId)}`
	obj.priority = priority
	obj.enable = enable
	obj.isLookahead = true
	if (obj.keyframes) {
		obj.keyframes = obj.keyframes
			.filter((kf) => kf.preserveForLookahead)
			.map((kf, i) => ({
				...kf,
				id: `${obj.id}_keyframe_${i}`,
			}))
	}
	delete obj.inGroup // force it to be cleared
	obj.disabled = disabled

	if (mode === LookaheadMode.PRELOAD) {
		// Set lookaheadForLayer to reference the original layer:
		updateLookaheadLayer(obj)
	}
	return obj
}

function processResult(lookaheadObjs: LookaheadResult, mode: ValidLookaheadMode): Array<LookaheadTimelineObject> {
	const res: Array<LookaheadTimelineObject> = []

	// Add the objects that have some timing info
	lookaheadObjs.timed.forEach((obj, i) => {
		let enable: TimelineTypes.TimelineEnable = {
			start: 1, // Absolute 0 without a group doesnt work
		}
		if (i !== 0) {
			const prevObj = lookaheadObjs.timed[i - 1]
			enable = calculateStartAfterPreviousObj(prevObj)
		}
		if (!obj.id) throw new Error('lookahead: timeline obj id not set')

		enable.end = getStartOfObjectRef(obj)

		res.push(mutateLookaheadObject(obj, `timed${i}`, enable, mode, LOOKAHEAD_OBJ_PRIORITY, false))
	})

	// Add each of the future objects, that have no end point
	const futureObjCount = lookaheadObjs.future.length
	const futurePriorityScale = LOOKAHEAD_OBJ_PRIORITY / (futureObjCount + 1)
	lookaheadObjs.future.some((obj, i) => {
		if (!obj.id) throw new Error('lookahead: timeline obj id not set')

		// WHEN_CLEAR mode can't take multiple futures, as they are always flattened into the single layer.
		// so give it some real timings, and only leave one enabled. The rest are added for onTimelineGenerate to do some 'magic'
		const singleEnabledObj = mode === LookaheadMode.WHEN_CLEAR

		const lastTimedObj = _.last(lookaheadObjs.timed)
		const enable =
			singleEnabledObj && i === 0 && lastTimedObj ? calculateStartAfterPreviousObj(lastTimedObj) : { while: '1' }
		// We use while: 1 for the enabler, as any time before it should be active will be filled by either a playing object, or a timed lookahead.
		// And this allows multiple futures to be timed in a way that allows them to co-exist

		// Prioritise so that the earlier ones are higher, decreasing within the range 'reserved' for lookahead
		const priority = futurePriorityScale * (futureObjCount - i)
		res.push(mutateLookaheadObject(obj, `future${i}`, enable, mode, priority, singleEnabledObj && i !== 0))
	})

	return res
}
