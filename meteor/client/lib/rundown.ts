import * as SuperTimeline from 'superfly-timeline'
import * as _ from 'underscore'
import { PieceUi, PartUi } from '../ui/SegmentTimeline/SegmentTimelineContainer'
import { Timecode } from 'timecode'
import { Settings } from '../../lib/Settings'
import {
	SourceLayerType,
	PieceLifespan,
	IBlueprintActionManifestDisplay,
	IBlueprintActionManifestDisplayContent,
	TimelineObjectCoreExt,
} from 'tv-automation-sofie-blueprints-integration'
import {
	SegmentExtended,
	PartExtended,
	getPieceInstancesForPartInstance,
	PieceExtended,
	IOutputLayerExtended,
	ISourceLayerExtended,
	PartInstanceLimited,
} from '../../lib/Rundown'
import { DBSegment, SegmentId } from '../../lib/collections/Segments'
import { RundownPlaylist } from '../../lib/collections/RundownPlaylists'
import { ShowStyleBase } from '../../lib/collections/ShowStyleBases'
import { literal, normalizeArray, getCurrentTime, applyToArray } from '../../lib/lib'
import { findPartInstanceOrWrapToTemporary, PartInstance } from '../../lib/collections/PartInstances'
import { PieceId } from '../../lib/collections/Pieces'
import { AdLibPieceUi } from '../ui/Shelf/AdLibPanel'
import { PartId } from '../../lib/collections/Parts'
import { processAndPrunePieceInstanceTimings } from '../../lib/rundown/infinites'
import { createPieceGroupAndCap, PieceGroupMetadata } from '../../lib/rundown/pieces'
import { PieceInstances } from '../../lib/collections/PieceInstances'

interface PieceGroupMetadataExt extends PieceGroupMetadata {
	id: PieceId
}

export namespace RundownUtils {
	function padZerundown(input: number, places?: number): string {
		places = places || 2
		return input < Math.pow(10, places - 1) ? '0'.repeat(places - 1) + input.toString(10) : input.toString(10)
	}

	export function getSegmentDuration(parts: Array<PartUi>, display?: boolean) {
		return parts.reduce((memo, part) => {
			return (
				memo +
				(part.instance.timings?.duration ||
					part.instance.part.expectedDuration ||
					part.renderedDuration ||
					(display ? Settings.defaultDisplayDuration : 0))
			)
		}, 0)
	}

	export function formatTimeToTimecode(
		milliseconds: number,
		showPlus?: boolean,
		enDashAsMinus?: boolean,
		hideFrames?: boolean
	): string {
		let sign = ''
		if (milliseconds < 0) {
			milliseconds = milliseconds * -1
			sign = enDashAsMinus ? '\u2013' : '-'
		} else {
			if (showPlus) sign = '+'
		}
		const tc = Timecode.init({
			framerate: Settings.frameRate + '',
			timecode: (milliseconds * Settings.frameRate) / 1000,
			drop_frame: !Number.isInteger(Settings.frameRate),
		})
		const timeCodeString: String = tc.toString()
		return sign + (hideFrames ? timeCodeString.substr(0, timeCodeString.length - 3) : timeCodeString)
	}

	export function formatTimeToShortTime(milliseconds: number): string {
		return formatDiffToTimecode(Math.max(milliseconds, 0), false)
	}

	export function formatDiffToTimecode(
		milliseconds: number,
		showPlus?: boolean,
		showHours?: boolean,
		enDashAsMinus?: boolean,
		useSmartFloor?: boolean,
		useSmartHours?: boolean,
		minusPrefix?: string,
		floorTime?: boolean,
		hardFloor?: boolean
	): string {
		let isNegative = milliseconds < 0
		if (isNegative) {
			milliseconds = milliseconds * -1
		}

		let hours = 0

		let minutes = Math.floor(milliseconds / (60 * 1000))
		hours = Math.floor(minutes / 60)
		if (showHours || (useSmartHours && hours > 0)) {
			minutes = minutes % 60
		}
		let secondsRest
		if (!hardFloor) {
			if (floorTime) {
				secondsRest = useSmartFloor
					? milliseconds < 100
						? 0
						: Math.floor(Math.floor(milliseconds % (60 * 1000)) / 1000)
					: Math.floor(Math.floor(milliseconds % (60 * 1000)) / 1000)
			} else {
				secondsRest = useSmartFloor
					? milliseconds < 100
						? 0
						: Math.ceil(Math.floor(milliseconds % (60 * 1000)) / 1000)
					: Math.ceil(Math.floor(milliseconds % (60 * 1000)) / 1000)

				// cascade the overflowing second
				let overflow = secondsRest % 60
				if (overflow !== secondsRest) {
					secondsRest = overflow
					overflow = ++minutes % 60
					if (overflow !== minutes) {
						minutes = overflow
						hours++
					}
				}
			}
		} else {
			if (!isNegative) {
				secondsRest = useSmartFloor
					? milliseconds < 100
						? 0
						: Math.floor(Math.floor(milliseconds % (60 * 1000)) / 1000)
					: Math.floor(Math.floor(milliseconds % (60 * 1000)) / 1000)
			} else {
				secondsRest = useSmartFloor
					? milliseconds < 100
						? 0
						: Math.ceil(Math.floor(milliseconds % (60 * 1000)) / 1000)
					: Math.ceil(Math.floor(milliseconds % (60 * 1000)) / 1000)

				// cascade the overflowing second
				let overflow = secondsRest % 60
				if (overflow !== secondsRest) {
					secondsRest = overflow
					overflow = ++minutes % 60
					if (overflow !== minutes) {
						minutes = overflow
						hours++
					}
				}
			}

			// a hack for very close to 0 to be negative
			if (hours === 0 && minutes === 0 && secondsRest === 0) {
				isNegative = true
			}
		}

		return (
			(isNegative
				? minusPrefix !== undefined
					? minusPrefix
					: enDashAsMinus
					? '\u2013'
					: '-'
				: showPlus && milliseconds > 0
				? '+'
				: '') +
			(showHours || (useSmartHours && hours > 0) ? padZerundown(hours) + ':' : '') +
			padZerundown(minutes) +
			':' +
			padZerundown(secondsRest)
		)
	}

	export function isInsideViewport(
		scrollLeft: number,
		scrollWidth: number,
		part: PartUi,
		partStartsAt: number | undefined,
		partDuration: number | undefined,
		piece?: PieceUi
	) {
		if (
			scrollLeft + scrollWidth <
			(partStartsAt || part.startsAt || 0) + (piece !== undefined ? piece.renderedInPoint || 0 : 0)
		) {
			return false
		} else if (
			scrollLeft >
			(partStartsAt || part.startsAt || 0) +
				(piece !== undefined
					? (piece.renderedInPoint || 0) +
					  (piece.renderedDuration ||
							(part.instance.timings?.duration !== undefined
								? part.instance.timings.duration + (part.instance.timings?.playOffset || 0)
								: (partDuration || part.renderedDuration || part.instance.part.expectedDuration || 0) -
								  (piece.renderedInPoint || 0)))
					: part.instance.timings?.duration !== undefined
					? part.instance.timings.duration + (part.instance.timings?.playOffset || 0)
					: partDuration || part.renderedDuration || 0)
		) {
			return false
		}
		return true
	}

	export function getSourceLayerClassName(sourceLayerType: SourceLayerType): string {
		// CAMERA_MOVEMENT -> "camera-movement"
		return ((SourceLayerType[sourceLayerType] || 'unknown-sourceLayer-' + sourceLayerType) + '')
			.toLowerCase()
			.replace(/_/g, '-')
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
	 */
	export function getResolvedSegment(
		showStyleBase: ShowStyleBase,
		playlist: RundownPlaylist,
		segment: DBSegment,
		segmentsBeforeThisInRundownSet: Set<SegmentId>,
		orderedAllPartIds: PartId[]
	): {
		/** A Segment with some additional information */
		segmentExtended: SegmentExtended
		/** Parts in the segment, with additional information on the Part and the Pieces */
		parts: Array<PartExtended>
		/** A flag if the segment is currently on air (one of it's Parts is on air) */
		isLiveSegment: boolean
		/** A flag if the segment is currently next (one of it's Parts is on air) */
		isNextSegment: boolean
		/** The part that is currently on air, if the Segment is on air */
		currentLivePart: PartExtended | undefined
		/** The part that is currently set as next, if the Segment is next */
		currentNextPart: PartExtended | undefined
		/** A flag if any of the Parts have a Piece on a Layer with the 'Remote' flag on */
		hasRemoteItems: boolean
		/** A flag if any of the Parts have a Piece on a Layer with the 'Guest' flag on */
		hasGuestItems: boolean
		/** A flag if any of the Parts have already played */
		hasAlreadyPlayed: boolean
		/** A flag if the current on air part (doesn't have to be of this segment) will autonext */
		autoNextPart: boolean
	} {
		let isLiveSegment = false
		let isNextSegment = false
		let currentLivePart: PartExtended | undefined = undefined
		let currentNextPart: PartExtended | undefined = undefined
		let hasAlreadyPlayed = false
		let hasRemoteItems = false
		let hasGuestItems = false

		let autoNextPart = false

		let segmentExtended = literal<SegmentExtended>({
			...segment,
			/** Create maps for outputLayers and sourceLayers */
			outputLayers: {},
			sourceLayers: {},
		})

		// fetch all the parts for the segment
		let partsE: Array<PartExtended> = []

		const { currentPartInstance, nextPartInstance } = playlist.getSelectedPartInstances()
		const segmentsAndParts = playlist.getSegmentsAndPartsSync(
			{
				_id: segment._id,
			},
			{
				segmentId: segment._id,
			}
		)
		const activePartInstancesMap = playlist.getActivePartInstancesMap(
			{
				segmentId: segment._id,
			},
			{
				fields: {
					isTaken: 0,
					previousPartEndState: 0,
					takeCount: 0,
				},
			}
		) as { [indexKey: string]: PartInstanceLimited }

		const partsInSegment = segmentsAndParts.parts

		if (partsInSegment.length > 0) {
			// create local deep copies of the studio outputLayers and sourceLayers so that we can store
			// pieces present on those layers inside and also figure out which layers are used when inside the rundown
			const outputLayers = normalizeArray<IOutputLayerExtended>(
				showStyleBase.outputLayers.map((layer) =>
					literal<IOutputLayerExtended>({
						...layer,
						sourceLayers: [],
						used: false,
					})
				),
				'_id'
			)
			const sourceLayers = normalizeArray<ISourceLayerExtended>(
				showStyleBase.sourceLayers.map((layer) =>
					literal<ISourceLayerExtended>({
						...layer,
						followingItems: [],
						pieces: [],
					})
				),
				'_id'
			)

			// create a lookup map to match original pieces to their resolved counterparts
			let piecesLookup = new Map<PieceId, PieceExtended>()
			// a buffer to store durations for the displayDuration groups
			const displayDurationGroups = new Map<string, number>()

			let startsAt = 0
			let previousPart: PartExtended | undefined
			// fetch all the pieces for the parts
			const partIds = partsInSegment.map((part) => part._id)

			const currentPartIndex = currentPartInstance
				? orderedAllPartIds.indexOf(currentPartInstance.part._id)
				: null

			const nextPartIndex = nextPartInstance ? orderedAllPartIds.indexOf(nextPartInstance.part._id) : null

			partsE = partsInSegment.map((part, itIndex) => {
				const partInstance = findPartInstanceOrWrapToTemporary(activePartInstancesMap, part)
				let partTimeline: SuperTimeline.TimelineObject[] = []

				// extend objects to match the Extended interface
				let partE = literal<PartExtended>({
					partId: part._id,
					instance: partInstance,
					pieces: [],
					renderedDuration: 0,
					startsAt: 0,
					willProbablyAutoNext: !!(
						previousPart &&
						previousPart.instance.part.autoNext &&
						previousPart.instance.part.expectedDuration !== 0
					),
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
				if (partE.instance.timings?.startedPlayback !== undefined) {
					hasAlreadyPlayed = true
				}

				const rawPieceInstances = getPieceInstancesForPartInstance(
					partInstance,
					new Set(partIds.slice(0, itIndex)),
					segmentsBeforeThisInRundownSet,
					orderedAllPartIds,
					currentPartIndex !== null && nextPartIndex !== null ? currentPartIndex < nextPartIndex : false,
					currentPartInstance,
					currentPartInstance
						? PieceInstances.find({
								partInstanceId: currentPartInstance._id,
						  }).fetch()
						: undefined,
					{
						fields: {
							//@ts-ignore deep property
							'piece.startedPlayback': 0,
							'piece.timings': 0,
						},
					}
				)

				const partStarted = partE.instance.timings?.startedPlayback
				const nowInPart = partStarted ? getCurrentTime() - partStarted : 0

				const preprocessedPieces = processAndPrunePieceInstanceTimings(
					showStyleBase,
					rawPieceInstances,
					nowInPart
				)

				// insert items into the timeline for resolution
				partE.pieces = preprocessedPieces.map((piece) => {
					const resPiece: PieceExtended = {
						instance: piece,
						renderedDuration: 0,
						renderedInPoint: 0,
					}

					const { pieceGroup, capObjs } = createPieceGroupAndCap(piece)
					pieceGroup.metaData = literal<PieceGroupMetadataExt>({
						id: piece.piece._id,
						pieceId: piece._id,
					})
					partTimeline.push(pieceGroup)
					partTimeline.push(...capObjs)

					// if there is an userDuration override, override it for the timeline
					if (piece.userDuration) {
						delete pieceGroup.enable.duration
						pieceGroup.enable.end = piece.userDuration.end
					}

					// find the target output layer
					let outputLayer = outputLayers[piece.piece.outputLayerId] as IOutputLayerExtended | undefined
					resPiece.outputLayer = outputLayer

					if (!piece.piece.virtual && outputLayer) {
						// mark the output layer as used within this segment
						if (
							sourceLayers[piece.piece.sourceLayerId] &&
							!sourceLayers[piece.piece.sourceLayerId].isHidden
						) {
							outputLayer.used = true
						}
						// attach the sourceLayer to the output, if it hasn't been already
						// find matching layer in the output
						let sourceLayer = outputLayer.sourceLayers.find((el) => {
							return el._id === piece.piece.sourceLayerId
						})
						// if the source has not yet been used on this output
						if (!sourceLayer) {
							sourceLayer = sourceLayers[piece.piece.sourceLayerId]
							if (sourceLayer) {
								sourceLayer = { ...sourceLayer }
								let partSourceLayer = sourceLayer
								partSourceLayer.pieces = []
								outputLayer.sourceLayers.push(partSourceLayer)
							}
						}

						if (sourceLayer) {
							resPiece.sourceLayer = sourceLayer
							// attach the piece to the sourceLayer in this segment
							resPiece.sourceLayer.pieces.push(resPiece)

							// mark the special Remote and Guest flags, these are dependant on the sourceLayer configuration
							// check if the segment should be in a special state for segments with remote input
							if (resPiece.sourceLayer.isRemoteInput) {
								hasRemoteItems = true
							}
							if (resPiece.sourceLayer.isGuestInput) {
								hasGuestItems = true
							}
						}
					}

					// add the piece to the map to make future searches quicker
					piecesLookup.set(piece.piece._id, resPiece)
					const continues = piece.piece.continuesRefId && piecesLookup.get(piece.piece.continuesRefId)
					if (piece.piece.continuesRefId && continues) {
						continues.continuedByRef = resPiece
						resPiece.continuesRef = continues
					}

					return resPiece
				})

				// Use the SuperTimeline library to resolve all the items within the Part
				partTimeline.forEach((obj) => {
					applyToArray(obj.enable, (enable) => {
						if (enable.start === 'now') {
							enable.start = nowInPart
						}
					})
				})
				let tlResolved = SuperTimeline.Resolver.resolveTimeline(partTimeline, { time: 0 })
				// furthestDuration is used to figure out how much content (in terms of time) is there in the Part
				let furthestDuration = 0
				const objs = Object.values(tlResolved.objects)
				for (let i = 0; i < objs.length; i++) {
					const obj = objs[i]
					const obj0 = (obj as unknown) as TimelineObjectCoreExt<PieceGroupMetadataExt>
					if (obj.resolved.resolved && obj0.metaData) {
						// Timeline actually has copies of the content object, instead of the object itself, so we need to match it back to the Part
						const piece = piecesLookup.get(obj0.metaData.id)
						const instance = obj.resolved.instances[0]
						if (piece && instance) {
							piece.renderedDuration = instance.end ? instance.end - instance.start : null

							// if there is no renderedInPoint, use 0 as the starting time for the item
							piece.renderedInPoint = instance.start ? instance.start : 0

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
				}

				// use the expectedDuration and fallback to the default display duration for the part
				partE.renderedDuration = partE.instance.part.expectedDuration || Settings.defaultDisplayDuration // furthestDuration

				// displayDuration groups are sets of Parts that share their expectedDurations.
				// If a member of the group has a displayDuration > 0, this displayDuration is used as the renderedDuration of a part.
				// This value is then deducted from the expectedDuration and the result leftover duration is added to the group pool.
				// If a member has a displayDuration == 0, it will use up whatever is available in the pool.
				// displayDurationGroups is specifically designed for a situation where the Rundown has a lead-in piece to camera
				// and then has a B-Roll to be played out over a VO from the host.
				if (
					partE.instance.part.displayDurationGroup &&
					// either this is not the first element of the displayDurationGroup
					(displayDurationGroups.get(partE.instance.part.displayDurationGroup) !== undefined ||
						// or there is a following member of this displayDurationGroup
						(partsInSegment[itIndex + 1] &&
							partsInSegment[itIndex + 1].displayDurationGroup ===
								partE.instance.part.displayDurationGroup))
				) {
					displayDurationGroups.set(
						partE.instance.part.displayDurationGroup,
						(displayDurationGroups.get(partE.instance.part.displayDurationGroup) || 0) +
							(partE.instance.part.expectedDuration || 0)
					)
					partE.renderedDuration =
						partE.instance.timings?.duration ||
						Math.min(partE.instance.part.displayDuration || 0, partE.instance.part.expectedDuration || 0) ||
						displayDurationGroups.get(partE.instance.part.displayDurationGroup) ||
						0
					displayDurationGroups.set(
						partE.instance.part.displayDurationGroup,
						Math.max(
							0,
							(displayDurationGroups.get(partE.instance.part.displayDurationGroup) || 0) -
								(partE.instance.timings?.duration || partE.renderedDuration)
						)
					)
				}

				// push the startsAt value, to figure out when each of the parts starts, relative to the beginning of the segment
				partE.startsAt = startsAt
				startsAt = partE.startsAt + (partE.renderedDuration || 0)

				previousPart = partE
				return partE
			})

			// resolve the duration of a Piece to be used for display
			const resolveDuration = (item: PieceExtended): number => {
				const expectedDurationNumber =
					typeof item.instance.piece.enable.duration === 'number'
						? item.instance.piece.enable.duration || 0
						: 0
				const userDurationNumber =
					item.instance.userDuration &&
					typeof item.instance.userDuration.end === 'number' &&
					item.instance.startedPlayback
						? item.instance.userDuration.end - item.instance.startedPlayback
						: 0
				return userDurationNumber || item.renderedDuration || expectedDurationNumber
			}

			partsE.forEach((part) => {
				if (part.pieces) {
					// if an item is continued by another item, rendered duration may need additional resolution
					part.pieces.forEach((item) => {
						if (item.continuedByRef) {
							item.renderedDuration = resolveDuration(item)
						}
					})

					const itemsByLayer = _.groupBy(part.pieces, (item) => {
						return item.outputLayer && item.sourceLayer && item.outputLayer.isFlattened
							? item.instance.piece.outputLayerId + '_' + item.sourceLayer.exclusiveGroup
							: item.instance.piece.outputLayerId + '_' + item.instance.piece.sourceLayerId
					})
					// check if the Pieces should be cropped (as should be the case if an item on a layer is placed after
					// an infinite Piece) and limit the width of the labels so that they dont go under or over the next Piece.
					for (let [outputSourceCombination, layerItems] of Object.entries(itemsByLayer)) {
						const sortedItems = _.sortBy(layerItems, 'renderedInPoint')
						for (let i = 1; i < sortedItems.length; i++) {
							const currentItem = sortedItems[i]
							const previousItem = sortedItems[i - 1]
							if (
								previousItem.renderedInPoint !== null &&
								currentItem.renderedInPoint !== null &&
								previousItem.renderedInPoint !== undefined &&
								currentItem.renderedInPoint !== undefined &&
								previousItem.renderedDuration !== undefined &&
								currentItem.renderedDuration !== undefined
							) {
								if (
									previousItem.instance.infinite ||
									(previousItem.renderedDuration !== null &&
										previousItem.renderedInPoint + previousItem.renderedDuration >
											currentItem.renderedInPoint)
								) {
									previousItem.renderedDuration =
										currentItem.renderedInPoint - previousItem.renderedInPoint
									previousItem.cropped = true
									if (previousItem.instance.infinite) {
										previousItem.instance.piece.lifespan = PieceLifespan.WithinPart
										delete previousItem.instance.infinite
									}
								}

								previousItem.maxLabelWidth = currentItem.renderedInPoint - previousItem.renderedInPoint
							}
						}
					}
				}
			})

			segmentExtended.outputLayers = outputLayers
			segmentExtended.sourceLayers = sourceLayers

			if (isNextSegment && !isLiveSegment && !autoNextPart && currentPartInstance) {
				if (
					currentPartInstance &&
					currentPartInstance.part.expectedDuration &&
					currentPartInstance.part.autoNext
				) {
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
		}

		// get the part immediately after the last segment
	}

	export function isPieceInstance(piece: PieceUi | AdLibPieceUi): piece is PieceUi {
		if (piece['instance'] && piece['name'] === undefined) {
			return true
		}
		return false
	}

	export function isAdLibPiece(piece: PieceUi | AdLibPieceUi): piece is AdLibPieceUi {
		if (piece['instance'] || piece['name'] === undefined) {
			return false
		}
		return true
	}

	export function isAdlibActionContent(
		display: IBlueprintActionManifestDisplay | IBlueprintActionManifestDisplayContent
	): display is IBlueprintActionManifestDisplayContent {
		if ((display as any).sourceLayerId !== undefined) {
			return true
		}
		return false
	}
}
