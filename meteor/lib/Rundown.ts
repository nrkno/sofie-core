import * as _ from 'underscore'
import * as SuperTimeline from 'superfly-timeline'
import { Pieces, Piece } from './collections/Pieces'
import { PieceLifespan, getPieceGroupId } from 'tv-automation-sofie-blueprints-integration'
import { normalizeArray, extendMandadory } from './lib'
import { Segment } from './collections/Segments'
import { SegmentLine, SegmentLines } from './collections/SegmentLines'
import { Rundown } from './collections/Rundowns'
import { ShowStyleBase } from './collections/ShowStyleBases'
import { IOutputLayer, ISourceLayer } from 'tv-automation-sofie-blueprints-integration'

export const DEFAULT_DISPLAY_DURATION = 3000

export interface SegmentExtended extends Segment {
	/** Output layers available in the installation used by this segment */
	outputLayers: {
		[key: string]: IOutputLayerExtended
	}
	/** Source layers used by this segment */
	sourceLayers: {
		[key: string]: ISourceLayerExtended
	}
}

export interface SegmentLineExtended extends SegmentLine {
	/** Pieces belonging to this segment line */
	items: Array<PieceExtended>
	renderedDuration: number
	startsAt: number
	willProbablyAutoNext: boolean
}

export interface IOutputLayerExtended extends IOutputLayer {
	/** Is this output layer used in this segment */
	used: boolean
	/** Source layers that will be used by this output layer */
	sourceLayers: Array<ISourceLayerExtended>,
}
export interface ISourceLayerExtended extends ISourceLayer {
	/** Pieces present on this source layer */
	items: Array<PieceExtended>
	followingItems: Array<PieceExtended>
}
interface IPieceExtendedDictionary {
	[key: string]: PieceExtended
}
export interface PieceExtended extends Piece {
	/** Source layer that this piece belongs to */
	sourceLayer?: ISourceLayerExtended
	/** Output layer that this segment line uses */
	outputLayer?: IOutputLayerExtended
	/** Position in timeline, relative to the beginning of the segment */
	renderedInPoint: number | null
	/** Duration in timeline */
	renderedDuration: number | null
	/** If set, the item was cropped in runtime by another item following it */
	cropped?: boolean
	/** This item is being continued by another, linked, item in another SegmentLine */
	continuedByRef?: PieceExtended
	/** This item is continuing another, linked, item in another SegmentLine */
	continuesRef?: PieceExtended
	/** Maximum width of a label so as not to appear underneath the following item */
	maxLabelWidth?: number
}

export function getResolvedSegment (showStyleBase: ShowStyleBase, rundown: Rundown, segment: Segment, checkFollowingSegment?: boolean): {
	segmentExtended: SegmentExtended,
	segmentLines: Array<SegmentLineExtended>,
	isLiveSegment: boolean,
	isNextSegment: boolean,
	currentLiveSegmentLine: SegmentLineExtended | undefined,
	hasRemoteItems: boolean,
	hasGuestItems: boolean,
	hasAlreadyPlayed: boolean,
	autoNextSegmentLine: boolean
	followingSegmentLine: SegmentLineExtended | undefined
} {
	let isLiveSegment = false
	let isNextSegment = false
	let currentLiveSegmentLine: SegmentLineExtended | undefined = undefined
	// let nextSegmentLine: SegmentLineExtended | undefined = undefined
	let hasAlreadyPlayed = false
	let hasRemoteItems = false
	let hasGuestItems = false
	let followingSegmentLine: SegmentLineExtended | undefined = undefined

	let autoNextSegmentLine = false

	let segmentExtended = _.clone(segment) as SegmentExtended
	segmentExtended.outputLayers = {}
	segmentExtended.sourceLayers = {}

	// fetch all the segment lines for the segment
	let segmentLinesE: Array<SegmentLineExtended> = []
	// let segmentLines = segment.getSegmentLines()
	const segmentLines = segment.getSegmentLines()

	if (segmentLines.length > 0) {
		if (checkFollowingSegment) {
			let followingSLines = SegmentLines.find({
				rundownId: segment.rundownId,
				_rank: {
					$gt: segmentLines[segmentLines.length - 1]._rank
				}
			}, { sort: { _rank: 1 }, limit: 1 }).fetch()
			if (followingSLines.length > 0) {
				let followingSLine = followingSLines[0]

				let pieces = Pieces.find({
					segmentLineId: followingSLine._id
				}).fetch()

				followingSegmentLine = extendMandadory<SegmentLine, SegmentLineExtended>(followingSLine, {
					items: _.map(pieces, (piece) => {
						return extendMandadory<Piece, PieceExtended>(piece, {
							// sourceLayer: ISourceLayerExtended,
							// outputLayer: IOutputLayerExtended,
							renderedInPoint: null,
							renderedDuration: null,
							// cropped: false,
							// continuedByRef: PieceExtended,
							// continuesRef: PieceExtended,
							// maxLabelWidth: 0
						})
					}),
					renderedDuration: 0, // ?
					startsAt: 0, // ?
					willProbablyAutoNext: false // ?
				})
			}
		}

		// create local deep copies of the studioInstallation outputLayers and sourceLayers so that we can store
		// items present on those layers inside and also figure out which layers are used when inside the rundown
		const outputLayers = normalizeArray<IOutputLayerExtended>(
			showStyleBase.outputLayers.map((layer) => {
				return extendMandadory<IOutputLayer, IOutputLayerExtended>(
					_.clone(layer),
					{
						sourceLayers: [],
						used: false
					}
				)
			}),
			'_id')
		const sourceLayers = normalizeArray<ISourceLayerExtended>(
			showStyleBase.sourceLayers.map((layer) => {
				return extendMandadory<ISourceLayer, ISourceLayerExtended>(
					_.clone(layer),
					{
						followingItems: [],
						items: []
					}
				)
			}),
			'_id')

		const TIMELINE_TEMP_OFFSET = 1

		// ensure that the sourceLayers array in the segment outputLayers is created
		// _.each(outputLayers, (outputLayer) => {
		// 	if (_.isArray(outputLayer.sourceLayers)) {
		// 		outputLayer.sourceLayers.length = 0
		// 	} else {
		// 		outputLayer.sourceLayers = new Array<ISourceLayer>()
		// 	}
		// 	// reset the used property, in case the output layer lost all of its contents
		// 	outputLayer.used = false
		// })
		//
		// ensure that the items array is created
		// _.each(sourceLayers, (sourceLayer) => {
		// 	if (_.isArray(sourceLayer.items)) {
		// 		sourceLayer.items.length = 0
		// 	} else {
		// 		sourceLayer.items = new Array<Piece>()
		// 	}
		// })

		let piecesLookup: IPieceExtendedDictionary = {}
		const displayDurationGroups: _.Dictionary<number> = {}

		let startsAt = 0
		let previousSegmentLine: SegmentLineExtended
		// fetch all the pieces for the segment lines
		segmentLinesE = _.map(segmentLines, (segmentLine, itIndex) => {
			let slTimeline: SuperTimeline.UnresolvedTimeline = []

			let segmentLineE: SegmentLineExtended = extendMandadory(segmentLine, {
				items: _.map(Pieces.find({ segmentLineId: segmentLine._id }).fetch(), (piece) => {
					return extendMandadory<Piece, PieceExtended>(piece, {
						renderedDuration: 0,
						renderedInPoint: 0
					})
				}),
				renderedDuration: 0,
				startsAt: 0,
				willProbablyAutoNext: (
						(previousSegmentLine || {}).autoNext || false
					) && (
						(previousSegmentLine || {}).expectedDuration !== 0
					)
			})

			if (rundown.currentSegmentLineId === segmentLineE._id) {
				isLiveSegment = true
				currentLiveSegmentLine = segmentLineE
			}
			if (rundown.nextSegmentLineId === segmentLineE._id) {
				isNextSegment = true
				// next is only auto, if current has a duration
				// nextSegmentLine = segmentLineE
			}
			autoNextSegmentLine = (
				currentLiveSegmentLine ?
				currentLiveSegmentLine.autoNext || false : false
			) && (
				(
					currentLiveSegmentLine &&
					currentLiveSegmentLine.expectedDuration !== undefined
				) ?
				currentLiveSegmentLine.expectedDuration !== 0 :
				false
			)

			if (segmentLineE.startedPlayback !== undefined) {
				hasAlreadyPlayed = true
			}

			_.each<PieceExtended>(segmentLineE.items, (piece) => {
				slTimeline.push({
					id: getPieceGroupId(piece),
					trigger: offsetTrigger(piece.trigger, TIMELINE_TEMP_OFFSET),
					duration: piece.durationOverride || piece.duration || piece.expectedDuration || 0,
					LLayer: piece.outputLayerId,
					content: {
						id: piece._id
					}
				})
				let outputLayer = outputLayers[piece.outputLayerId] as IOutputLayerExtended | undefined
				piece.outputLayer = outputLayer

				if (!piece.virtual && outputLayer) {
					// mark the output layer as used within this segment
					// console.log(piece)
					if (sourceLayers[piece.sourceLayerId] && !sourceLayers[piece.sourceLayerId].isHidden) {
						outputLayer.used = true
					}
					// attach the sourceLayer to the outputLayer, if it hasn't been already

					// find matching layer in the output layer
					let sourceLayer = outputLayer.sourceLayers.find((el) => {
						return el._id === piece.sourceLayerId
					})

					if (!sourceLayer) {
						sourceLayer = sourceLayers[piece.sourceLayerId]
						if (sourceLayer) {
							sourceLayer = _.clone(sourceLayer)
							let sl = sourceLayer as ISourceLayerExtended
							sl.items = []
							outputLayer.sourceLayers.push(sl)
						}
					}

					if (sourceLayer) {
						piece.sourceLayer = sourceLayer
						// attach the piece to the sourceLayer in this segment
						piece.sourceLayer.items.push(piece)

						// check if the segment should be in a special state for segments with remote input
						if (piece.sourceLayer.isRemoteInput) {
							hasRemoteItems = true
						}

						if (piece.sourceLayer.isGuestInput) {
							hasGuestItems = true
						}
					}
				}

				piecesLookup[piece._id] = piece
				if (piece.continuesRefId && piecesLookup[piece.continuesRefId]) {
					piecesLookup[piece.continuesRefId].continuedByRef = piece
					piece.continuesRef = piecesLookup[piece.continuesRefId]
				}
			})

			// SuperTimeline.Resolver.setTraceLevel(SuperTimeline.TraceLevel.TRACE)

			let slRTimeline = SuperTimeline.Resolver.getTimelineInWindow(slTimeline)
			let furthestDuration = 0
			slRTimeline.resolved.forEach((tlItem) => {
				let piece = piecesLookup[tlItem.content.id] // Timeline actually has copies of the content object, instead of the object itself
				piece.renderedDuration = tlItem.resolved.outerDuration || null

				// if there is no renderedInPoint, use 0 as the starting time for the item
				piece.renderedInPoint = tlItem.resolved.startTime ? tlItem.resolved.startTime - TIMELINE_TEMP_OFFSET : 0
				// console.log(piece._id + ': ' + piece.renderedInPoint)

				if (Number.isFinite(piece.renderedDuration || 0) && ((piece.renderedInPoint || 0) + (piece.renderedDuration || 0) > furthestDuration)) {
					furthestDuration = (piece.renderedInPoint || 0) + (piece.renderedDuration || 0)
				}
			})

			segmentLineE.renderedDuration = segmentLineE.expectedDuration || DEFAULT_DISPLAY_DURATION // furthestDuration

			if (segmentLineE.displayDurationGroup && (
				// either this is not the first element of the displayDurationGroup
				(displayDurationGroups[segmentLineE.displayDurationGroup] !== undefined) ||
				// or there is a following member of this displayDurationGroup
				(segmentLines[itIndex + 1] && segmentLines[itIndex + 1].displayDurationGroup === segmentLineE.displayDurationGroup)
			)) {
				displayDurationGroups[segmentLineE.displayDurationGroup] = (displayDurationGroups[segmentLineE.displayDurationGroup] || 0) + (segmentLineE.expectedDuration || 0)
				segmentLineE.renderedDuration = segmentLineE.duration || Math.min(segmentLineE.displayDuration || 0, segmentLineE.expectedDuration || 0) || displayDurationGroups[segmentLineE.displayDurationGroup]
				displayDurationGroups[segmentLineE.displayDurationGroup] = Math.max(0, displayDurationGroups[segmentLineE.displayDurationGroup] - (segmentLineE.duration || segmentLineE.renderedDuration))
			}

			segmentLineE.startsAt = startsAt
			startsAt = segmentLineE.startsAt + (segmentLineE.renderedDuration || 0)

			previousSegmentLine = segmentLineE
			return segmentLineE
		})

		const resolveDuration = (item: PieceExtended): number => {
			let childDuration = 0
			const expectedDurationNumber = (typeof item.expectedDuration === 'number' ? item.expectedDuration || 0 : 0)
			return (item.durationOverride || item.duration || item.renderedDuration || expectedDurationNumber) + childDuration
		}

		_.each<SegmentLineExtended>(segmentLinesE, (segmentLine) => {
			if (segmentLine.items) {
				_.each<PieceExtended>(segmentLine.items, (item) => {
					if (item.continuedByRef) {
						item.renderedDuration = resolveDuration(item)
					}
				})

				const itemsByLayer = _.groupBy(segmentLine.items, (item) => {
					return item.outputLayerId + '_' + item.sourceLayerId
				})
				_.each(itemsByLayer, (layerItems, outputSourceCombination) => {
					const sortedItems = _.sortBy(layerItems, 'renderedInPoint')
					for (let i = 1; i < sortedItems.length; i++) {
						const currentItem = sortedItems[i] as PieceExtended
						const previousItem = sortedItems[i - 1] as PieceExtended
						if (previousItem.renderedInPoint !== null && currentItem.renderedInPoint !== null && previousItem.renderedDuration !== null && currentItem.renderedDuration !== null &&
							previousItem.renderedInPoint !== undefined && currentItem.renderedInPoint !== undefined && previousItem.renderedDuration !== undefined && currentItem.renderedDuration !== undefined) {
							if ((previousItem.renderedInPoint + previousItem.renderedDuration > currentItem.renderedInPoint) ||
							 (previousItem.infiniteMode)
								) {
								previousItem.renderedDuration = currentItem.renderedInPoint - previousItem.renderedInPoint
								previousItem.cropped = true
								if (previousItem.infiniteMode) {
									previousItem.infiniteMode = PieceLifespan.Normal
								}
							}

							previousItem.maxLabelWidth = currentItem.renderedInPoint - previousItem.renderedInPoint
						}
					}
				})
			}
		})

		if (followingSegmentLine && followingSegmentLine.items) {
			_.each<PieceExtended>(followingSegmentLine.items, (piece) => {
				// match output layers in following segment line, but do not mark as used
				// we only care about output layers used in this segment.
				let outputLayer = outputLayers[piece.outputLayerId] as IOutputLayerExtended | undefined
				piece.outputLayer = outputLayer

				// find matching layer in the output layer
				let sourceLayer = outputLayer && outputLayer.sourceLayers && outputLayer.sourceLayers.find((el) => {
					return el._id === piece.sourceLayerId
				})

				if (sourceLayer === undefined) {
					if (outputLayer) {
						sourceLayer = sourceLayers[piece.sourceLayerId]
						if (sourceLayer) {
							sourceLayer = _.clone(sourceLayer)
							let sl = sourceLayer as ISourceLayerExtended
							sl.items = []
							outputLayer.sourceLayers.push(sl)
						}
					}
				} else {
					piece.sourceLayer = sourceLayer
					if (piece.sourceLayer.followingItems === undefined) {
						piece.sourceLayer.followingItems = []
					}
					// attach the piece to the sourceLayer in this segment
					piece.sourceLayer.followingItems.push(piece)
				}
			})
		}

		segmentExtended.outputLayers = outputLayers
		segmentExtended.sourceLayers = sourceLayers

		if (isNextSegment && !isLiveSegment && !autoNextSegmentLine && rundown.currentSegmentLineId) {
			const currentOtherSegmentLine = SegmentLines.findOne(rundown.currentSegmentLineId)
			if (currentOtherSegmentLine && currentOtherSegmentLine.expectedDuration && currentOtherSegmentLine.autoNext) {
				autoNextSegmentLine = true
			}
		}
	}
	return {
		segmentExtended,
		segmentLines: segmentLinesE,
		isLiveSegment,
		currentLiveSegmentLine,
		isNextSegment,
		hasAlreadyPlayed,
		hasGuestItems,
		hasRemoteItems,
		autoNextSegmentLine,
		followingSegmentLine
	}

	// get the segment line immediately after the last segment

}

function offsetTrigger (
	trigger: {
		type: SuperTimeline.TriggerType,
		value: string | number | null
	},
	offset
) {
	if (trigger.type !== SuperTimeline.TriggerType.TIME_ABSOLUTE) {
		return trigger
	} else {
		if (trigger.type === SuperTimeline.TriggerType.TIME_ABSOLUTE && trigger.value === 'now') {
			return _.extend({}, trigger, {
				// value: segmentLine.startedPlayback ? getCurrentTime() - segmentLine.startedPlayback : offset
				value: offset
			})
		} else {
			return _.extend({}, trigger, {
				value: trigger.value + offset
			})
		}
	}
}
