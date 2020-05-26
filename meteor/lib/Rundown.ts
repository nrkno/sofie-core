import * as _ from 'underscore'
import * as SuperTimeline from 'superfly-timeline'
import { Pieces, Piece, PieceId } from './collections/Pieces'
import {
	PieceLifespan,
	getPieceGroupId,
	IOutputLayer,
	ISourceLayer
} from 'tv-automation-sofie-blueprints-integration'
import { normalizeArray, literal, waitForPromise, fetchNext, last, unprotectObject } from './lib'
import { Segment, DBSegment } from './collections/Segments'
import { Part, Parts, DBPart, PartId } from './collections/Parts'
import { Rundown } from './collections/Rundowns'
import { RundownPlaylist } from './collections/RundownPlaylists'
import { ShowStyleBase } from './collections/ShowStyleBases'
import { interpretExpression } from 'superfly-timeline/dist/resolver/expression'
import { PartInstance, findPartInstanceOrWrapToTemporary } from './collections/PartInstances'
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
	sourceLayers: Array<ISourceLayerExtended>,
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

function getPieceInstancesForPartInstance (partInstance: PartInstance) {
	if (partInstance.isTemporary || partInstance.isScratch) {
		return Pieces.find({
			partId: partInstance.part._id
		}).map(p => wrapPieceToTemporaryInstance(p, partInstance._id))
	} else {
		return PieceInstances.find({ partInstanceId: partInstance._id }).fetch()
	}
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
 * @param {RundownPlaylist} playlist
 * @param {Segment} segment
 * @param {boolean} [checkFollowingSegment]
 */
export function getResolvedSegment (
	showStyleBase: ShowStyleBase,
	playlist: RundownPlaylist,
	segment: DBSegment,
	checkFollowingSegment?: boolean
): {
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
	/** The part that is currently set as next, if the Segment is next */
	currentNextPart: PartExtended | undefined,
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
	let currentNextPart: PartExtended | undefined = undefined
	// let nextPart: PartExtended | undefined = undefined
	let hasAlreadyPlayed = false
	let hasRemoteItems = false
	let hasGuestItems = false
	let followingPart: PartExtended | undefined

	let autoNextPart = false

	let segmentExtended = literal<SegmentExtended>({
		...segment,
		/** Create maps for outputLayers and sourceLayers */
		outputLayers: {},
		sourceLayers: {}
	})

	// fetch all the parts for the segment
	let partsE: Array<PartExtended> = []

	const { currentPartInstance, nextPartInstance } = playlist.getSelectedPartInstances()
	const segmentsAndParts = playlist.getSegmentsAndPartsSync()
	const activePartInstancesMap = playlist.getActivePartInstancesMap()

	const partsInSegment = _.filter(segmentsAndParts.parts, p => p.segmentId === segment._id)

	if (partsInSegment.length > 0) {
		if (checkFollowingSegment) {
			let tmpFollowingPart = fetchNext(segmentsAndParts.parts, last(partsInSegment))

			if (tmpFollowingPart) {
				const tmpFollowingPartInstance = findPartInstanceOrWrapToTemporary(activePartInstancesMap, tmpFollowingPart)
				const pieces = getPieceInstancesForPartInstance(tmpFollowingPartInstance)

				followingPart = literal<PartExtended>({
					partId: tmpFollowingPart._id,
					instance: tmpFollowingPartInstance,
					pieces: _.map(pieces, (piece) => literal<PieceExtended>({
						instance: piece,
						// sourceLayer: ISourceLayerExtended,
						// outputLayer: IOutputLayerExtended,
						renderedInPoint: null,
						renderedDuration: null,
						// cropped: false,
						// continuedByRef: PieceExtended,
						// continuesRef: PieceExtended,
						// maxLabelWidth: 0
					})),
					renderedDuration: 0, // ?
					startsAt: 0, // ?
					willProbablyAutoNext: false // ?
				})
			}
		}

		// create local deep copies of the studio outputLayers and sourceLayers so that we can store
		// pieces present on those layers inside and also figure out which layers are used when inside the rundown
		const outputLayers = normalizeArray<IOutputLayerExtended>(
			showStyleBase.outputLayers.map((layer) => literal<IOutputLayerExtended>({
				...layer,
				sourceLayers: [],
				used: false
			})),
			'_id')
		const sourceLayers = normalizeArray<ISourceLayerExtended>(
			showStyleBase.sourceLayers.map((layer) => literal<ISourceLayerExtended>({
				...layer,
				followingItems: [],
				pieces: []
			})),
			'_id')

		// the SuperTimeline has an issue with resolving pieces that start at the 0 absolute time point
		// we therefore need a constant offset that we can offset everything to make sure it's not at 0 point.
		const TIMELINE_TEMP_OFFSET = 1

		// create a lookup map to match original pieces to their resolved counterparts
		let piecesLookup = new Map<PieceId, PieceExtended>()
		// a buffer to store durations for the displayDuration groups
		const displayDurationGroups: _.Dictionary<number> = {}

		let startsAt = 0
		let previousPart: PartExtended | undefined
		// fetch all the pieces for the parts
		partsE = _.map(partsInSegment, (part, itIndex) => {
			const partInstance = findPartInstanceOrWrapToTemporary(activePartInstancesMap, part)
			let partTimeline: SuperTimeline.TimelineObject[] = []

			// extend objects to match the Extended interface
			let partE = literal<PartExtended>({
				partId: part._id,
				instance: partInstance,
				pieces: _.map(getPieceInstancesForPartInstance(partInstance), (piece) => literal<PieceExtended>({
					instance: piece,
					renderedDuration: 0,
					renderedInPoint: 0
				})),
				renderedDuration: 0,
				startsAt: 0,
				willProbablyAutoNext: !!(previousPart && (
						previousPart.instance.part.autoNext
					) && (
						previousPart.instance.part.expectedDuration !== 0
					))
			})

			// set the flags for isLiveSegment, isNextSegment, autoNextPart, hasAlreadyPlayed
			if (currentPartInstance && currentPartInstance._id === partE.instance._id) {
				isLiveSegment = true
				currentLivePart = partE
			}
			if (nextPartInstance && nextPartInstance._id === partE.instance._id) {
				isNextSegment = true
				currentNextPart = partE
			}
			autoNextPart = !!(
				currentLivePart &&
				currentLivePart.instance.part.autoNext &&
				currentLivePart.instance.part.expectedDuration
			)
			if (partE.instance.part.startedPlayback !== undefined) {
				hasAlreadyPlayed = true
			}

			// insert items into the timeline for resolution
			_.each<PieceExtended>(partE.pieces, (piece) => {
				partTimeline.push({
					id: getPieceGroupId(unprotectObject(piece.instance.piece)),
					enable: calculatePieceTimelineEnable(piece.instance.piece, TIMELINE_TEMP_OFFSET),
					layer: piece.instance.piece.outputLayerId,
					content: {
						id: piece.instance.piece._id
					}
				})
				// find the target output layer
				let outputLayer = outputLayers[piece.instance.piece.outputLayerId] as IOutputLayerExtended | undefined
				piece.outputLayer = outputLayer

				if (!piece.instance.piece.virtual && outputLayer) {
					// mark the output layer as used within this segment
					if (sourceLayers[piece.instance.piece.sourceLayerId] && !sourceLayers[piece.instance.piece.sourceLayerId].isHidden) {
						outputLayer.used = true
					}
					// attach the sourceLayer to the output, if it hasn't been already
					// find matching layer in the output
					let sourceLayer = outputLayer.sourceLayers.find((el) => {
						return el._id === piece.instance.piece.sourceLayerId
					})
					// if the source has not yet been used on this output
					if (!sourceLayer) {
						sourceLayer = sourceLayers[piece.instance.piece.sourceLayerId]
						if (sourceLayer) {
							sourceLayer = _.clone(sourceLayer)
							let part = sourceLayer
							part.pieces = []
							outputLayer.sourceLayers.push(part)
						}
					}

					if (sourceLayer) {
						piece.sourceLayer = sourceLayer
						// attach the piece to the sourceLayer in this segment
						piece.sourceLayer.pieces.push(piece)

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
				piecesLookup.set(piece.instance.piece._id, piece)
				const continues = piece.instance.piece.continuesRefId && piecesLookup.get(piece.instance.piece.continuesRefId)
				if (piece.instance.piece.continuesRefId && continues) {
					continues.continuedByRef = piece
					piece.continuesRef = continues
				}
			})

			// Use the SuperTimeline library to resolve all the items within the Part
			let tlResolved = SuperTimeline.Resolver.resolveTimeline(partTimeline, { time: 0 })
			// furthestDuration is used to figure out how much content (in terms of time) is there in the Part
			let furthestDuration = 0
			_.each(tlResolved.objects, (obj) => {
				if (obj.resolved.resolved) {
					// Timeline actually has copies of the content object, instead of the object itself, so we need to match it back to the Part
					let piece = piecesLookup.get(obj.content.id)
					const instance = obj.resolved.instances[0]
					if (piece && instance) {
						piece.renderedDuration = instance.end ? (instance.end - instance.start) : null

						// if there is no renderedInPoint, use 0 as the starting time for the item
						piece.renderedInPoint = instance.start ? instance.start - TIMELINE_TEMP_OFFSET : 0

						// if the duration is finite, set the furthestDuration as the inPoint+Duration to know how much content there is
						if (
							Number.isFinite(piece.renderedDuration || 0) &&
							(piece.renderedInPoint || 0) + (piece.renderedDuration || 0) > furthestDuration
						) {
							furthestDuration = (piece.renderedInPoint || 0) + (piece.renderedDuration || 0)
						}
					} else {
						// TODO - should this piece be removed?
					}
				}
			})

			// use the expectedDuration and fallback to the default display duration for the part
			partE.renderedDuration = partE.expectedDuration || Settings.defaultDisplayDuration // furthestDuration

			// displayDuration groups are sets of Parts that share their expectedDurations.
			// If a member of the group has a displayDuration > 0, this displayDuration is used as the renderedDuration of a part.
			// This value is then deducted from the expectedDuration and the result leftover duration is added to the group pool.
			// If a member has a displayDuration == 0, it will use up whatever is available in the pool.
			// displayDurationGroups is specifically designed for a situation where the Rundown has a lead-in piece to camera
			// and then has a B-Roll to be played out over a VO from the host.
			if (partE.instance.part.displayDurationGroup && (
				// either this is not the first element of the displayDurationGroup
				(displayDurationGroups[partE.instance.part.displayDurationGroup] !== undefined) ||
				// or there is a following member of this displayDurationGroup
				(partsInSegment[itIndex + 1] && partsInSegment[itIndex + 1].displayDurationGroup === partE.instance.part.displayDurationGroup)
			)) {
				displayDurationGroups[partE.instance.part.displayDurationGroup] = (displayDurationGroups[partE.instance.part.displayDurationGroup] || 0) + (partE.instance.part.expectedDuration || 0)
				partE.renderedDuration = partE.instance.part.duration || Math.min(partE.instance.part.displayDuration || 0, partE.instance.part.expectedDuration || 0) || displayDurationGroups[partE.instance.part.displayDurationGroup]
				displayDurationGroups[partE.instance.part.displayDurationGroup] = Math.max(0, displayDurationGroups[partE.instance.part.displayDurationGroup] - (partE.instance.part.duration || partE.renderedDuration))
			}

			// push the startsAt value, to figure out when each of the parts starts, relative to the beginning of the segment
			partE.startsAt = startsAt
			startsAt = partE.startsAt + (partE.renderedDuration || 0)

			previousPart = partE
			return partE
		})

		// resolve the duration of a Piece to be used for display
		const resolveDuration = (item: PieceExtended): number => {
			const expectedDurationNumber = (typeof item.instance.piece.enable.duration === 'number' ? item.instance.piece.enable.duration || 0 : 0)
			const userDurationNumber = (item.instance.piece.userDuration && typeof item.instance.piece.userDuration.duration === 'number' ? item.instance.piece.userDuration.duration || 0 : 0)
			return (item.instance.piece.playoutDuration || userDurationNumber || item.renderedDuration || expectedDurationNumber)
		}

		_.each<PartExtended>(partsE, (part) => {
			if (part.pieces) {
				// if an item is continued by another item, rendered duration may need additional resolution
				_.each<PieceExtended>(part.pieces, (item) => {
					if (item.continuedByRef) {
						item.renderedDuration = resolveDuration(item)
					}
				})

				const itemsByLayer = _.groupBy(part.pieces, (item) => {
					return item.outputLayer && item.sourceLayer && item.outputLayer.isFlattened ?
						item.instance.piece.outputLayerId + '_' + item.sourceLayer.exclusiveGroup :
						item.instance.piece.outputLayerId + '_' + item.instance.piece.sourceLayerId
				})
				// check if the Pieces should be cropped (as should be the case if an item on a layer is placed after
				// an infinite Piece) and limit the width of the labels so that they dont go under or over the next Piece.
				_.each(itemsByLayer, (layerItems, outputSourceCombination) => {
					const sortedItems = _.sortBy(layerItems, 'renderedInPoint')
					for (let i = 1; i < sortedItems.length; i++) {
						const currentItem = sortedItems[i]
						const previousItem = sortedItems[i - 1]
						if (previousItem.renderedInPoint !== null && currentItem.renderedInPoint !== null &&
							previousItem.renderedInPoint !== undefined && currentItem.renderedInPoint !== undefined && previousItem.renderedDuration !== undefined && currentItem.renderedDuration !== undefined) {
							if ((previousItem.instance.piece.infiniteMode) ||
								(previousItem.renderedDuration !== null && (previousItem.renderedInPoint + previousItem.renderedDuration > currentItem.renderedInPoint))
								) {
								previousItem.renderedDuration = currentItem.renderedInPoint - previousItem.renderedInPoint
								previousItem.cropped = true
								if (previousItem.instance.piece.infiniteMode) {
									previousItem.instance.piece.infiniteMode = PieceLifespan.Normal
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
		if (followingPart && followingPart.pieces) {
			_.each<PieceExtended>(followingPart.pieces, (piece) => {
				// match outputs in following part, but do not mark as used
				// we only care about outputs used in this segment
				let outputLayer = outputLayers[piece.instance.piece.outputLayerId] as IOutputLayerExtended | undefined
				piece.outputLayer = outputLayer

				// find matching layer in the outputs
				let sourceLayer = outputLayer && outputLayer.sourceLayers && outputLayer.sourceLayers.find((el) => {
					return el._id === piece.instance.piece.sourceLayerId
				})

				// if layer not found in output, add it to output
				if (sourceLayer === undefined) {
					if (outputLayer) {
						sourceLayer = sourceLayers[piece.instance.piece.sourceLayerId]
						if (sourceLayer) {
							// create a copy of the source layer to be attached inside the output.
							sourceLayer = _.clone(sourceLayer)
							let sl = sourceLayer
							sl.pieces = []
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

		if (isNextSegment && !isLiveSegment && !autoNextPart && currentPartInstance) {
			if (currentPartInstance && currentPartInstance.part.expectedDuration && currentPartInstance.part.autoNext) {
				autoNextPart = true
			}
		}
	}
	return {
		segmentExtended,
		parts: partsE,
		isLiveSegment,
		currentLivePart,
		currentNextPart,
		isNextSegment,
		hasAlreadyPlayed,
		hasGuestItems,
		hasRemoteItems,
		autoNextPart,
		followingPart
	}

	// get the part immediately after the last segment

}

export function offsetTimelineEnableExpression (val: SuperTimeline.Expression | undefined, offset: string | number | undefined) {
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
				r: offset
			})
		} else if (val === undefined) {
			return offset
		} else { // Unreachable fallback case
			return val
		}
	}
}

export function calculatePieceTimelineEnable (piece: Piece, offset?: number): SuperTimeline.TimelineEnable {
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
			duration: duration
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
