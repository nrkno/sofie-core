import * as SuperTimeline from 'superfly-timeline'
import { IOutputLayer, ISourceLayer } from 'tv-automation-sofie-blueprints-integration'
import * as _ from 'underscore'
import { PartInstance } from './collections/PartInstances'
import { DBPart, PartId } from './collections/Parts'
import { PieceInstance, PieceInstances } from './collections/PieceInstances'
import { Piece, Pieces } from './collections/Pieces'
import { DBSegment, SegmentId } from './collections/Segments'
import { literal } from './lib'
import {
	buildPastInfinitePiecesForThisPartQuery,
	buildPiecesStartingInThisPartQuery,
	getPieceInstancesForPart,
} from './rundown/infinites'

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

export interface PartExtended {
	partId: PartId
	instance: PartInstance
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
		buildPastInfinitePiecesForThisPartQuery(part, partsBeforeThisInSegment, segmentsBeforeThisInRundown)
	).fetch()

	return [...piecesStartingInPart, ...infinitePieces]
}

export function getPieceInstancesForPartInstance(
	partInstance: PartInstance,
	partsBeforeThisInSegmentSet: Set<PartId>,
	segmentsBeforeThisInRundownSet: Set<SegmentId>,
	orderedAllParts: PartId[],
	nextPartIsAfterCurrentPart: boolean
) {
	if (partInstance.isTemporary) {
		return getPieceInstancesForPart(
			undefined,
			undefined,
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
		return PieceInstances.find({ partInstanceId: partInstance._id }).fetch()
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
