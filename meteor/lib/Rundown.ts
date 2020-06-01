import * as _ from 'underscore'
import * as SuperTimeline from 'superfly-timeline'
import { Pieces, Piece } from './collections/Pieces'
import { IOutputLayer, ISourceLayer } from 'tv-automation-sofie-blueprints-integration'
import { literal } from './lib'
import { DBSegment } from './collections/Segments'
import { PartId } from './collections/Parts'
import { PartInstance } from './collections/PartInstances'
import { PieceInstance, PieceInstances, wrapPieceToTemporaryInstance } from './collections/PieceInstances'
import { Settings } from './Settings'

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

export function getPieceInstancesForPartInstance(partInstance: PartInstance) {
	if (partInstance.isTemporary || partInstance.isScratch) {
		return Pieces.find({
			partId: partInstance.part._id,
		}).map((p) => wrapPieceToTemporaryInstance(p, partInstance._id))
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

export function calculatePieceTimelineEnable(piece: Piece, offset?: number): SuperTimeline.TimelineEnable {
	let duration: SuperTimeline.Expression | undefined
	let end: SuperTimeline.Expression | undefined
	if (piece.playoutDuration !== undefined) {
		duration = piece.playoutDuration
	} else if (piece.userDuration !== undefined) {
		duration = piece.userDuration.duration
		end = piece.userDuration.end
	} else {
		duration = piece.enable.duration
		end = piece.enable.end
	}

	// If we have an end and not a start, then use that with a duration
	if ((end !== undefined || piece.enable.end !== undefined) && piece.enable.start === undefined) {
		return {
			end: end !== undefined ? end : offsetTimelineEnableExpression(piece.enable.end, offset),
			duration: duration,
		}
		// Otherwise, if we have a start, then use that with either the end or duration
	} else if (piece.enable.start !== undefined) {
		let enable = literal<SuperTimeline.TimelineEnable>({})

		if (piece.enable.start === 'now') {
			enable.start = 'now'
		} else {
			enable.start = offsetTimelineEnableExpression(piece.enable.start, offset)
		}

		if (duration !== undefined) {
			enable.duration = duration
		} else if (end !== undefined) {
			enable.end = end
		} else if (piece.enable.end !== undefined) {
			enable.end = offsetTimelineEnableExpression(piece.enable.end, offset)
		}
		return enable
	} else {
		return {
			start: 0,
			duration: duration,
			end: end,
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
