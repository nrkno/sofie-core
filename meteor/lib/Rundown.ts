import * as _ from 'underscore'
import * as SuperTimeline from 'superfly-timeline'
import { Pieces, Piece } from './collections/Pieces'
import {
	PieceLifespan,
	getPieceGroupId,
	IOutputLayer,
	ISourceLayer
} from 'tv-automation-sofie-blueprints-integration'
import { normalizeArray, extendMandadory } from './lib'
import { Segment } from './collections/Segments'
import { Part, Parts } from './collections/Parts'
import { Rundown } from './collections/Rundowns'
import { ShowStyleBase } from './collections/ShowStyleBases'

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

export interface PartExtended extends Part {
	/** Pieces belonging to this part */
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

/**
 * This function allows to see what the output of the playback will look like.
 * It simulates the operations done by the playout operations in core and playout-gateway
 * and produces a list of Pieces across Parts timed relatively.
 * 
 * This method is primarly used by the GUI to visualize segments, but other functions
 * utilize it as well when information about timing & time placement is needed.
 *
 * @export
 * @param {ShowStyleBase} showStyleBase
 * @param {Rundown} rundown
 * @param {Segment} segment
 * @param {boolean} [checkFollowingSegment]
 */
export function getResolvedSegment (showStyleBase: ShowStyleBase, rundown: Rundown, segment: Segment, checkFollowingSegment?: boolean): {
	/** A Segment with some additional information */
	segmentExtended: SegmentExtended,
	/** Parts in the segment, with additional information on the Part and the Pieces */
	parts: Array<PartExtended>,
	/** A flag if the segment is currently on air (one of it's Parts is on air) */
	isLiveSegment: boolean,
	/** A flag if the segment is currently next (one of it's Parts is on air) */
	isNextSegment: boolean,
	/** The part that is currently on air, if the Segment is on air */
	currentLivePart: PartExtended | undefined,
	/** A flag if any of the Parts have a Piece on a Layer with the 'Remote' flag on */
	hasRemoteItems: boolean,
	/** A flag if any of the Parts have a Piece on a Layer with the 'Guest' flag on */
	hasGuestItems: boolean,
	/** A flag if any of the Parts have already played */
	hasAlreadyPlayed: boolean,
	/** A flag if the current on air part (doesn't have to be of this segment) will autonext */
	autoNextPart: boolean
	/** If checkFollowingPart is true, it will return the part that will follow this segment */
	followingPart: PartExtended | undefined
} {
	let isLiveSegment = false
	let isNextSegment = false
	let currentLivePart: PartExtended | undefined = undefined
	// let nextPart: PartExtended | undefined = undefined
	let hasAlreadyPlayed = false
	let hasRemoteItems = false
	let hasGuestItems = false
	let followingPart: PartExtended | undefined = undefined

	let autoNextPart = false

	let segmentExtended = _.clone(segment) as SegmentExtended
	/** Create maps for outputLayers and sourceLayers */
	segmentExtended.outputLayers = {}
	segmentExtended.sourceLayers = {}

	// fetch all the parts for the segment
	let partsE: Array<PartExtended> = []
	const parts = segment.getParts()

	if (parts.length > 0) {
		if (checkFollowingSegment) {
			let followingSLines = Parts.find({
				rundownId: segment.rundownId,
				_rank: {
					$gt: parts[parts.length - 1]._rank
				}
			}, { sort: { _rank: 1 }, limit: 1 }).fetch()
			if (followingSLines.length > 0) {
				let followingSLine = followingSLines[0]

				let pieces = Pieces.find({
					partId: followingSLine._id
				}).fetch()

				followingPart = extendMandadory<Part, PartExtended>(followingSLine, {
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

		// create local deep copies of the studio outputLayers and sourceLayers so that we can store
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

		// the SuperTimeline has an issue with resolving items that start at the 0 absolute time point
		// we therefore need a constant offset that we can offset everything to make sure it's not at 0 point.
		const TIMELINE_TEMP_OFFSET = 1

		// create a lookup map to match original pieces to their resolved counterparts
		let piecesLookup: IPieceExtendedDictionary = {}
		// a buffer to store durations for the displayDuration groups
		const displayDurationGroups: _.Dictionary<number> = {}

		let startsAt = 0
		let previousPart: PartExtended
		// fetch all the pieces for the parts
		partsE = _.map(parts, (part, itIndex) => {
			let partTimeline: SuperTimeline.UnresolvedTimeline = []

			// extend objects to match the Extended interface
			let partE: PartExtended = extendMandadory(part, {
				items: _.map(Pieces.find({ partId: part._id }).fetch(), (piece) => {
					return extendMandadory<Piece, PieceExtended>(piece, {
						renderedDuration: 0,
						renderedInPoint: 0
					})
				}),
				renderedDuration: 0,
				startsAt: 0,
				willProbablyAutoNext: (
						(previousPart || {}).autoNext || false
					) && (
						(previousPart || {}).expectedDuration !== 0
					)
			})

			// set the flags for isLiveSegment, isNextSegment, autoNextPart, hasAlreadyPlayed
			if (rundown.currentPartId === partE._id) {
				isLiveSegment = true
				currentLivePart = partE
			}
			if (rundown.nextPartId === partE._id) {
				isNextSegment = true
			}
			autoNextPart = (
				currentLivePart ?
				currentLivePart.autoNext || false : false
			) && (
				(
					currentLivePart &&
					currentLivePart.expectedDuration !== undefined
				) ?
				currentLivePart.expectedDuration !== 0 :
				false
			)
			if (partE.startedPlayback !== undefined) {
				hasAlreadyPlayed = true
			}

			// insert items into the timeline for resolution
			_.each<PieceExtended>(partE.items, (piece) => {
				partTimeline.push({
					id: getPieceGroupId(piece),
					trigger: offsetTrigger(piece.trigger, TIMELINE_TEMP_OFFSET),
					duration: piece.durationOverride || piece.duration || piece.expectedDuration || 0,
					LLayer: piece.outputLayerId,
					content: {
						id: piece._id
					}
				})
				// find the target output layer
				let outputLayer = outputLayers[piece.outputLayerId] as IOutputLayerExtended | undefined
				piece.outputLayer = outputLayer

				if (!piece.virtual && outputLayer) {
					// mark the output layer as used within this segment
					if (sourceLayers[piece.sourceLayerId] && !sourceLayers[piece.sourceLayerId].isHidden) {
						outputLayer.used = true
					}
					// attach the sourceLayer to the output, if it hasn't been already
					// find matching layer in the output
					let sourceLayer = outputLayer.sourceLayers.find((el) => {
						return el._id === piece.sourceLayerId
					})
					// if the source has not yet been used on this output
					if (!sourceLayer) {
						sourceLayer = sourceLayers[piece.sourceLayerId]
						if (sourceLayer) {
							sourceLayer = _.clone(sourceLayer)
							let part = sourceLayer
							part.items = []
							outputLayer.sourceLayers.push(part)
						}
					}

					if (sourceLayer) {
						piece.sourceLayer = sourceLayer
						// attach the piece to the sourceLayer in this segment
						piece.sourceLayer.items.push(piece)

						// mark the special Remote and Guest flags, these are dependant on the sourceLayer configuration
						// check if the segment should be in a special state for segments with remote input
						if (piece.sourceLayer.isRemoteInput) {
							hasRemoteItems = true
						}
						if (piece.sourceLayer.isGuestInput) {
							hasGuestItems = true
						}
					}
				}

				// add the piece to the map to make future searches quicker
				piecesLookup[piece._id] = piece
				if (piece.continuesRefId && piecesLookup[piece.continuesRefId]) {
					piecesLookup[piece.continuesRefId].continuedByRef = piece
					piece.continuesRef = piecesLookup[piece.continuesRefId]
				}
			})

			// Use the SuperTimeline library to resolve all the items within the Part
			let partRTimeline = SuperTimeline.Resolver.getTimelineInWindow(partTimeline)
			// furthestDuration is used to figure out how much content (in terms of time) is there in the Part
			let furthestDuration = 0
			partRTimeline.resolved.forEach((tlItem) => {
				// Timeline actually has copies of the content object, instead of the object itself, so we need to match it back to the Part
				let piece = piecesLookup[tlItem.content.id]
				piece.renderedDuration = tlItem.resolved.outerDuration || null

				// if there is no renderedInPoint, use 0 as the starting time for the item
				piece.renderedInPoint = tlItem.resolved.startTime ? tlItem.resolved.startTime - TIMELINE_TEMP_OFFSET : 0

				// if the duration is finite, set the furthestDuration as the inPoint+Duration to know how much content there is
				if (Number.isFinite(piece.renderedDuration || 0) && ((piece.renderedInPoint || 0) + (piece.renderedDuration || 0) > furthestDuration)) {
					furthestDuration = (piece.renderedInPoint || 0) + (piece.renderedDuration || 0)
				}
			})

			// use the expectedDuration and fallback to the DEFAULT_DISPLAY_DURATION for the part
			partE.renderedDuration = partE.expectedDuration || DEFAULT_DISPLAY_DURATION // furthestDuration

			// displayDuration groups are sets of Parts that share their expectedDurations.
			// If a member of the group has a displayDuration > 0, this displayDuration is used as the renderedDuration of a part.
			// This value is then deducted from the expectedDuration and the result leftover duration is added to the group pool.
			// If a member has a displayDuration == 0, it will use up whatever is available in the pool.
			// displayDurationGroups is specifically designed for a situation where the Rundown has a lead-in piece to camera
			// and then has a B-Roll to be played out over a VO from the host.
			if (partE.displayDurationGroup && (
				// either this is not the first element of the displayDurationGroup
				(displayDurationGroups[partE.displayDurationGroup] !== undefined) ||
				// or there is a following member of this displayDurationGroup
				(parts[itIndex + 1] && parts[itIndex + 1].displayDurationGroup === partE.displayDurationGroup)
			)) {
				displayDurationGroups[partE.displayDurationGroup] = (displayDurationGroups[partE.displayDurationGroup] || 0) + (partE.expectedDuration || 0)
				partE.renderedDuration = partE.duration || Math.min(partE.displayDuration || 0, partE.expectedDuration || 0) || displayDurationGroups[partE.displayDurationGroup]
				displayDurationGroups[partE.displayDurationGroup] = Math.max(0, displayDurationGroups[partE.displayDurationGroup] - (partE.duration || partE.renderedDuration))
			}

			// push the startsAt value, to figure out when each of the parts starts, relative to the beginning of the segment
			partE.startsAt = startsAt
			startsAt = partE.startsAt + (partE.renderedDuration || 0)

			previousPart = partE
			return partE
		})

		// resolve the duration of a Piece to be used for display
		const resolveDuration = (item: PieceExtended): number => {
			const expectedDurationNumber = (typeof item.expectedDuration === 'number' ? item.expectedDuration || 0 : 0)
			return (item.durationOverride || item.duration || item.renderedDuration || expectedDurationNumber)
		}

		_.each<PartExtended>(partsE, (part) => {
			if (part.items) {
				// if an item is continued by another item, rendered duration may need additional resolution
				_.each<PieceExtended>(part.items, (item) => {
					if (item.continuedByRef) {
						item.renderedDuration = resolveDuration(item)
					}
				})

				const itemsByLayer = _.groupBy(part.items, (item) => {
					return item.outputLayerId + '_' + item.sourceLayerId
				})
				// check if the Pieces should be cropped (as should be the case if an item on a layer is placed after
				// an infinite Piece) and limit the width of the labels so that they dont go under or over the next Piece.
				_.each(itemsByLayer, (layerItems, outputSourceCombination) => {
					const sortedItems = _.sortBy(layerItems, 'renderedInPoint')
					for (let i = 1; i < sortedItems.length; i++) {
						const currentItem = sortedItems[i]
						const previousItem = sortedItems[i - 1]
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

		// Following part allows display of the following part (one in another segment), but only in the context
		// of a given segment. So if segment B follows segment A, only outputs and layers used in segment A will
		// be 'resolved' by this code (shown as used, etc.). Any other outputs and layers will be ignored.
		if (followingPart && followingPart.items) {
			_.each<PieceExtended>(followingPart.items, (piece) => {
				// match outputs in following part, but do not mark as used
				// we only care about outputs used in this segment
				let outputLayer = outputLayers[piece.outputLayerId] as IOutputLayerExtended | undefined
				piece.outputLayer = outputLayer

				// find matching layer in the outputs
				let sourceLayer = outputLayer && outputLayer.sourceLayers && outputLayer.sourceLayers.find((el) => {
					return el._id === piece.sourceLayerId
				})

				// if layer not found in output, add it to output
				if (sourceLayer === undefined) {
					if (outputLayer) {
						sourceLayer = sourceLayers[piece.sourceLayerId]
						if (sourceLayer) {
							// create a copy of the source layer to be attached inside the output.
							sourceLayer = _.clone(sourceLayer)
							let sl = sourceLayer
							sl.items = []
							outputLayer.sourceLayers.push(sl)
							sl.followingItems.push(piece)
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

		if (isNextSegment && !isLiveSegment && !autoNextPart && rundown.currentPartId) {
			const currentOtherPart = Parts.findOne(rundown.currentPartId)
			if (currentOtherPart && currentOtherPart.expectedDuration && currentOtherPart.autoNext) {
				autoNextPart = true
			}
		}
	}
	return {
		segmentExtended,
		parts: partsE,
		isLiveSegment,
		currentLivePart,
		isNextSegment,
		hasAlreadyPlayed,
		hasGuestItems,
		hasRemoteItems,
		autoNextPart,
		followingPart
	}

	// get the part immediately after the last segment

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
				// value: part.startedPlayback ? getCurrentTime() - part.startedPlayback : offset
				value: offset
			})
		} else {
			return _.extend({}, trigger, {
				value: trigger.value + offset
			})
		}
	}
}
