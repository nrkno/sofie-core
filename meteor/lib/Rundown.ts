import * as _ from 'underscore'
import * as SuperTimeline from 'superfly-timeline'
import { Pieces, Piece } from './collections/Pieces'
import { IOutputLayer, ISourceLayer } from 'tv-automation-sofie-blueprints-integration'
import { literal } from './lib'
import { DBSegment, SegmentId } from './collections/Segments'
import { PartId, Part, DBPart } from './collections/Parts'
import { PartInstance } from './collections/PartInstances'
import { PieceInstance, PieceInstances, wrapPieceToTemporaryInstance } from './collections/PieceInstances'
import {
	getPieceInstancesForPart,
	buildPiecesStartingInThisPartQuery,
	buildPastInfinitePiecesForThisPartQuery,
} from './rundown/infinites'
import { FindOptions } from './typings/meteor'

export interface SegmentExtended extends DBSegment {
	/** Output layers available in the installation used by this segment */
	outputLayers: {
		[key: string]: IOutputLayerExtended
	}
	/** Source layers used by this segment */
	sourceLayers: {
		[key: string]: ISourceLayerExtended
	}
}

export type PartInstanceLimited = Omit<PartInstance, 'isTaken' | 'previousPartEndState' | 'takeCount'>

export interface PartExtended {
	partId: PartId
	instance: PartInstanceLimited
	/** Pieces belonging to this part */
	pieces: Array<PieceExtended>
	renderedDuration: number
	startsAt: number
	willProbablyAutoNext: boolean
}

export interface IOutputLayerExtended extends IOutputLayer {
	/** Is this output layer used in this segment */
	used: boolean
	/** Source layers that will be used by this output layer */
	sourceLayers: Array<ISourceLayerExtended>
}
export interface ISourceLayerExtended extends ISourceLayer {
	/** Pieces present on this source layer */
	pieces: Array<PieceExtended>
	followingItems: Array<PieceExtended>
}
interface IPieceExtendedDictionary {
	[key: string]: PieceExtended
}
export interface PieceExtended {
	instance: PieceInstance

	/** Source layer that this piece belongs to */
	sourceLayer?: ISourceLayerExtended
	/** Output layer that this part uses */
	outputLayer?: IOutputLayerExtended
	/** Position in timeline, relative to the beginning of the segment */
	renderedInPoint: number | null
	/** Duration in timeline */
	renderedDuration: number | null
	/** If set, the item was cropped in runtime by another item following it */
	cropped?: boolean
	/** This item is being continued by another, linked, item in another Part */
	continuedByRef?: PieceExtended
	/** This item is continuing another, linked, item in another Part */
	continuesRef?: PieceExtended
	/** Maximum width of a label so as not to appear underneath the following item */
	maxLabelWidth?: number
}

export function fetchPiecesThatMayBeActiveForPart(
	part: DBPart,
	partsBeforeThisInSegmentSet: Set<PartId>,
	segmentsBeforeThisInRundownSet: Set<SegmentId>
): Piece[] {
	const piecesStartingInPart = Pieces.find(buildPiecesStartingInThisPartQuery(part)).fetch()

	const partsBeforeThisInSegment = Array.from(partsBeforeThisInSegmentSet.values())
	const segmentsBeforeThisInRundown = Array.from(segmentsBeforeThisInRundownSet.values())

	const infinitePieces = Pieces.find(
		buildPastInfinitePiecesForThisPartQuery(part, partsBeforeThisInSegment, segmentsBeforeThisInRundown),
		{
			fields: {
				timings: 0,
				startedPlayback: 0,
				stoppedPlayback: 0,
			},
		}
	).fetch()

	return [...piecesStartingInPart, ...infinitePieces]
}

export function getPieceInstancesForPartInstance(
	partInstance: PartInstanceLimited,
	partsBeforeThisInSegmentSet: Set<PartId>,
	segmentsBeforeThisInRundownSet: Set<SegmentId>,
	orderedAllParts: PartId[],
	nextPartIsAfterCurrentPart: boolean,
	currentPartInstance: PartInstance | undefined,
	currentPartInstancePieceInstances: PieceInstance[] | undefined,
	options?: FindOptions<PieceInstance>
) {
	if (partInstance.isTemporary) {
		return getPieceInstancesForPart(
			currentPartInstance,
			currentPartInstancePieceInstances,
			partInstance.part,
			partsBeforeThisInSegmentSet,
			segmentsBeforeThisInRundownSet,
			fetchPiecesThatMayBeActiveForPart(
				partInstance.part,
				partsBeforeThisInSegmentSet,
				segmentsBeforeThisInRundownSet
			),
			orderedAllParts,
			partInstance._id,
			nextPartIsAfterCurrentPart,
			partInstance.isTemporary
		)
	} else {
		return PieceInstances.find({ partInstanceId: partInstance._id }, options).fetch()
	}
}

export function offsetTimelineEnableExpression(
	val: SuperTimeline.Expression | undefined,
	offset: string | number | undefined
) {
	if (offset === undefined) {
		return val
	} else {
		// return literal<SuperTimeline.ExpressionObj>({
		// 	l: interpretExpression(val || null) || 0,
		// 	o: '+',
		// 	r: offset
		// })
		if (_.isString(val) || _.isNumber(val)) {
			return `${val} + ${offset}`
		} else if (_.isObject(val)) {
			return literal<SuperTimeline.ExpressionObj>({
				l: val || 0,
				o: '+',
				r: offset,
			})
		} else if (val === undefined) {
			return offset
		} else {
			// Unreachable fallback case
			return val
		}
	}
}

// 1 reactivelly listen to data changes
/*
setup () {
	RundownPlaylists.find().observeChanges(
		asdf: onReactiveDataChange
	)
}

onReactiveDataChange () {
	setTimeoutIgnore(() => {
		updateCalculatedData()
	}, 200)
}

const cachedSegments = {}
updateCalculatedData () {

	const data = calculateBigDataSet()

	data.segments
}
*/
