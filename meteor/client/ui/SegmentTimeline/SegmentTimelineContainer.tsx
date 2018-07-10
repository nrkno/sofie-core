import * as React from 'react'
import * as PropTypes from 'prop-types'
import * as _ from 'underscore'
import { withTracker } from '../../lib/ReactMeteorData/react-meteor-data'

import { normalizeArray } from '../../lib/utils'

import * as SuperTimeline from 'superfly-timeline'

import { RunningOrder } from '../../../lib/collections/RunningOrders'
import { Segment } from '../../../lib/collections/Segments'
import { SegmentLine, SegmentLines } from '../../../lib/collections/SegmentLines'
import { SegmentLineItem, SegmentLineItems } from '../../../lib/collections/SegmentLineItems'
import { StudioInstallation, IOutputLayer, ISourceLayer } from '../../../lib/collections/StudioInstallations'

import { SegmentTimeline } from './SegmentTimeline'

import { getCurrentTime } from '../../../lib/lib'
import { RunningOrderTiming } from '../RunningOrderTiming'
import { PlayoutTimelinePrefixes } from '../../../lib/api/playout'

export interface SegmentUi extends Segment {
	/** Output layers available in the installation used by this segment */
	outputLayers?: {
		[key: string]: IOutputLayerUi
	}
	/** Source layers used by this segment */
	sourceLayers?: {
		[key: string]: ISourceLayerUi
	}
}
export interface SegmentLineUi extends SegmentLine {
	/** Segment line items belonging to this segment line */
	items?: Array<SegmentLineItem>
	renderedDuration?: number
	startsAt?: number
	willProbablyAutoNext?: boolean
}
export interface IOutputLayerUi extends IOutputLayer {
	/** Is this output layer used in this segment */
	used?: boolean
	/** Source layers that will be used by this output layer */
	sourceLayers?: Array<ISourceLayer>,
	/** Is output layer group collapsed */
	collapsed?: boolean
}
export interface ISourceLayerUi extends ISourceLayer {
	/** Segment line items present on this source layer */
	items?: Array<SegmentLineItem>
	followingItems?: Array<SegmentLineItem>
}
export interface SegmentLineItemUi extends SegmentLineItem {
	/** Source layer that this segment line item belongs to */
	sourceLayer?: ISourceLayerUi
	/** Output layer that this segment line uses */
	outputLayer?: IOutputLayerUi
	/** Position in timeline, relative to the beginning of the segment */
	renderedInPoint?: number | null
	/** Duration in timeline */
	renderedDuration?: number | null
	/** This item is being continued by another, linked, item in another SegmentLine */
	continuedByRef?: SegmentLineItemUi
	/** This item is continuing another, linked, item in another SegmentLine */
	continuesRef?: SegmentLineItemUi
	/** This item has already been linked to the parent item of the spanning item group */
	linked?: boolean
}
interface ISegmentLineItemUiDictionary {
	[key: string]: SegmentLineItemUi
}
interface IProps {
	segment: Segment,
	studioInstallation: StudioInstallation,
	runningOrder: RunningOrder,
	timeScale: number,
	liveLineHistorySize: number
	onTimeScaleChange?: (timeScaleVal: number) => void
	onContextMenu?: (contextMenuContext: any) => void
	onSegmentScroll?: () => void
	followLiveSegments: boolean
}
interface IState {
	scrollLeft: number,
	collapsedOutputs: {
		[key: string]: boolean
	},
	collapsed: boolean,
	followLiveLine: boolean,
	livePosition: number,
	displayTimecode: number
}
interface ITrackedProps {
	segmentui: SegmentUi,
	segmentLines: Array<SegmentLineUi>,
	isLiveSegment: boolean,
	isNextSegment: boolean,
	currentLiveSegmentLine: SegmentLineUi | undefined,
	hasRemoteItems: boolean,
	hasAlreadyPlayed: boolean,
	autoNextSegmentLine: boolean
	followingSegmentLine: SegmentLineUi | undefined
}
export const SegmentTimelineContainer = withTracker<IProps, IState, ITrackedProps>((props: IProps) => {
	// console.log('PeripheralDevices',PeripheralDevices);
	// console.log('PeripheralDevices.find({}).fetch()',PeripheralDevices.find({}, { sort: { created: -1 } }).fetch());

	let segmentui = _.clone(props.segment) as SegmentUi

	let isLiveSegment = false
	let isNextSegment = false
	let currentLiveSegmentLine: SegmentLineUi | undefined = undefined
	let nextSegmentLine: SegmentLineUi | undefined = undefined
	let hasAlreadyPlayed = false
	let hasRemoteItems = false

	// fetch all the segment lines for the segment
	let segmentLines = SegmentLines.find({
		segmentId: props.segment._id
	}, { sort: { _rank: 1 } }).fetch()

	// get the segment line immediately after the last segment
	let followingSegmentLine: SegmentLineUi | undefined = undefined
	let followingSLines = SegmentLines.find({
		runningOrderId: segmentui.runningOrderId,
		_rank: {
			$gt: segmentLines[segmentLines.length - 1]._rank
		}
	}, { sort: { _rank: 1 }, limit: 1 }).fetch()
	if (followingSLines.length > 0) {
		followingSegmentLine = followingSLines[0]

		let segmentLineItems = SegmentLineItems.find({
			segmentLineId: followingSegmentLine._id
		}).fetch()
		followingSegmentLine.items = segmentLineItems
	}

	// create local deep copies of the studioInstallation outputLayers and sourceLayers so that we can store
	// items present on those layers inside and also figure out which layers are used when inside the rundown
	const outputLayers = props.studioInstallation ? normalizeArray<IOutputLayerUi>(props.studioInstallation.outputLayers.map((layer) => { return _.clone(layer) }), '_id') : {}
	const sourceLayers = props.studioInstallation ? normalizeArray<ISourceLayerUi>(props.studioInstallation.sourceLayers.map((layer) => { return _.clone(layer) }), '_id') : {}

	const TIMELINE_TEMP_OFFSET = 1

	// ensure that the sourceLayers array in the segment outputLayers is created
	_.forEach(outputLayers, (outputLayer) => {
		if (_.isArray(outputLayer.sourceLayers)) {
			outputLayer.sourceLayers.length = 0
		} else {
			outputLayer.sourceLayers = new Array<ISourceLayer>()
		}
		// reset the used property, in case the output layer lost all of its contents
		outputLayer.used = false
	})

	// ensure that the items array is created
	_.forEach(sourceLayers, (sourceLayer) => {
		if (_.isArray(sourceLayer.items)) {
			sourceLayer.items.length = 0
		} else {
			sourceLayer.items = new Array<SegmentLineItem>()
		}
	})

	let segmentLineItemsLookup: ISegmentLineItemUiDictionary = {}

	let startsAt = 0
	let autoNextSegmentLine = false
	let previousSegmentLine: SegmentLineUi
	// fetch all the segment line items for the segment lines
	_.forEach<SegmentLineUi>(segmentLines, (segmentLine) => {
		let slTimeline: SuperTimeline.UnresolvedTimeline = []

		if (props.runningOrder.currentSegmentLineId === segmentLine._id) {
			isLiveSegment = true
			currentLiveSegmentLine = segmentLine
		}
		if (props.runningOrder.nextSegmentLineId === segmentLine._id) {
			isNextSegment = true
			// next is only auto, if current has a duration
			autoNextSegmentLine = (currentLiveSegmentLine ? currentLiveSegmentLine.autoNext || false : false) && ((currentLiveSegmentLine && currentLiveSegmentLine.expectedDuration !== undefined) ? currentLiveSegmentLine.expectedDuration !== 0 : false)
			nextSegmentLine = segmentLine
		}

		segmentLine.willProbablyAutoNext = ((previousSegmentLine || {}).autoNext || false) && ((previousSegmentLine || {}).expectedDuration !== 0)

		if (segmentLine.startedPlayback !== undefined) {
			hasAlreadyPlayed = true
		}

		let segmentLineItems = SegmentLineItems.find({
			segmentLineId: segmentLine._id
		}).fetch()
		segmentLine.items = segmentLineItems

		const offsetTrigger = (trigger: {
			type: SuperTimeline.TriggerType,
			value: string | number | null
		}, offset) => {
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

		_.forEach<SegmentLineItemUi>(segmentLine.items, (segmentLineItem) => {
			slTimeline.push({
				id: PlayoutTimelinePrefixes.SEGMENT_LINE_ITEM_GROUP_PREFIX + segmentLineItem._id,
				trigger: offsetTrigger(segmentLineItem.trigger, TIMELINE_TEMP_OFFSET),
				duration: segmentLineItem.duration || segmentLineItem.expectedDuration || 0,
				LLayer: segmentLineItem.outputLayerId,
				content: {
					id: segmentLineItem._id
				}
			})

			segmentLineItem.outputLayer = outputLayers[segmentLineItem.outputLayerId]
			// mark the output layer as used within this segment
			// console.log(segmentLineItem)
			outputLayers[segmentLineItem.outputLayerId].used = true
			// attach the sourceLayer to the outputLayer, if it hasn't been already

			// find matching layer in the output layer
			let sourceLayer = outputLayers[segmentLineItem.outputLayerId].sourceLayers!.find((el) => {
				return el._id === segmentLineItem.sourceLayerId
			})

			if (sourceLayer === undefined) {
				sourceLayer = sourceLayers[segmentLineItem.sourceLayerId]
				if (sourceLayer) {
					sourceLayer = _.clone(sourceLayer)
					let sl = sourceLayer as ISourceLayerUi
					sl.items = []
					outputLayers[segmentLineItem.outputLayerId].sourceLayers!.push(sl)
				}
			}

			if (sourceLayer !== undefined) {
				segmentLineItem.sourceLayer = sourceLayer
				if (segmentLineItem.sourceLayer.items === undefined) {
					segmentLineItem.sourceLayer.items = []
				}
				// attach the segmentLineItem to the sourceLayer in this segment
				segmentLineItem.sourceLayer.items.push(segmentLineItem)

				// check if the segment should be in a special state for segments with remote input
				if (segmentLineItem.sourceLayer.isRemoteInput) {
					hasRemoteItems = true
				}
			}

			segmentLineItemsLookup[segmentLineItem._id] = segmentLineItem
			if (segmentLineItem.continuesRefId && segmentLineItemsLookup[segmentLineItem.continuesRefId]) {
				segmentLineItemsLookup[segmentLineItem.continuesRefId].continuedByRef = segmentLineItem
				segmentLineItem.continuesRef = segmentLineItemsLookup[segmentLineItem.continuesRefId]
			}
		})

		// SuperTimeline.Resolver.setTraceLevel(SuperTimeline.TraceLevel.TRACE)

		let slRTimeline = SuperTimeline.Resolver.getTimelineInWindow(slTimeline)
		let furthestDuration = 0
		slRTimeline.resolved.forEach((tlItem) => {
			let segmentLineItem = segmentLineItemsLookup[tlItem.content.id] // Timeline actually has copies of the content object, instead of the object itself
			segmentLineItem.renderedDuration = tlItem.resolved.outerDuration

			// if there is no renderedInPoint, use 0 as the starting time for the item
			segmentLineItem.renderedInPoint = tlItem.resolved.startTime ? tlItem.resolved.startTime - TIMELINE_TEMP_OFFSET : 0
			// console.log(segmentLineItem._id + ': ' + segmentLineItem.renderedInPoint)

			if (Number.isFinite(segmentLineItem.renderedDuration || 0) && ((segmentLineItem.renderedInPoint || 0) + (segmentLineItem.renderedDuration || 0) > furthestDuration)) {
				furthestDuration = (segmentLineItem.renderedInPoint || 0) + (segmentLineItem.renderedDuration || 0)
			}
		})

		segmentLine.renderedDuration = segmentLine.expectedDuration || 3000 // furthestDuration
		segmentLine.startsAt = startsAt
		startsAt = segmentLine.startsAt + (segmentLine.renderedDuration || 0)

		previousSegmentLine = segmentLine
	})

	const resolveDuration = (item: SegmentLineItemUi): number => {
		let childDuration = 0
		/* if (item.continuedByRef) {
			childDuration = resolveDuration(item.continuedByRef)
			item.continuedByRef.linked = true
		} */
		return (item.duration || item.renderedDuration || item.expectedDuration) + childDuration
	}

	_.forEach<SegmentLineUi>(segmentLines, (line) => {
		line.items && _.forEach<SegmentLineItemUi>(line.items, (item) => {
			if (item.continuedByRef) {
				item.renderedDuration = resolveDuration(item)
			}
		})
	})

	if (followingSegmentLine && followingSegmentLine.items) {
		_.forEach<SegmentLineItemUi>(followingSegmentLine.items, (segmentLineItem) => {
			// match output layers in following segment line, but do not mark as used
			// we only care about output layers used in this segment.
			segmentLineItem.outputLayer = outputLayers[segmentLineItem.outputLayerId]

			// find matching layer in the output layer
			let sourceLayer = outputLayers[segmentLineItem.outputLayerId].sourceLayers!.find((el) => {
				return el._id === segmentLineItem.sourceLayerId
			})

			if (sourceLayer === undefined) {
				sourceLayer = sourceLayers[segmentLineItem.sourceLayerId]
				if (sourceLayer) {
					sourceLayer = _.clone(sourceLayer)
					let sl = sourceLayer as ISourceLayerUi
					sl.items = []
					outputLayers[segmentLineItem.outputLayerId].sourceLayers!.push(sl)
				}
			}

			if (sourceLayer !== undefined) {
				segmentLineItem.sourceLayer = sourceLayer
				if (segmentLineItem.sourceLayer.followingItems === undefined) {
					segmentLineItem.sourceLayer.followingItems = []
				}
				// attach the segmentLineItem to the sourceLayer in this segment
				segmentLineItem.sourceLayer.followingItems.push(segmentLineItem)
			}
		})
	}

	segmentui.outputLayers = outputLayers
	segmentui.sourceLayers = sourceLayers

	if (isNextSegment && !isLiveSegment && !autoNextSegmentLine && props.runningOrder.currentSegmentLineId) {
		const currentOtherSegmentLine = SegmentLines.findOne(props.runningOrder.currentSegmentLineId)
		if (currentOtherSegmentLine && currentOtherSegmentLine.expectedDuration && currentOtherSegmentLine.autoNext) {
			autoNextSegmentLine = true
		}
	}

	return {
		segmentui,
		segmentLines,
		isLiveSegment,
		currentLiveSegmentLine,
		isNextSegment,
		hasAlreadyPlayed,
		hasRemoteItems,
		autoNextSegmentLine,
		followingSegmentLine
	}
})(class extends React.Component<IProps & ITrackedProps, IState> {
	static contextTypes = {
		durations: PropTypes.object.isRequired
	}

	isLiveSegment: boolean
	roCurrentSegmentId: string | null

	constructor (props: IProps & ITrackedProps, context) {
		super(props, context)

		let that = this
		this.state = {
			collapsedOutputs: {},
			collapsed: false,
			scrollLeft: 0,
			followLiveLine: false,
			livePosition: 0,
			displayTimecode: 0
		}

		this.isLiveSegment = props.isLiveSegment || false

		/* that.setState({
			timeScale: that.state.timeScale * 1.1
		}) */
	}

	componentDidMount () {
		this.roCurrentSegmentId = this.props.runningOrder.currentSegmentLineId
		if (this.isLiveSegment === true) {
			this.onFollowLiveLine(true, {})
			this.startOnAirLine()
		}
	}

	componentDidUpdate (prevProps) {
		this.roCurrentSegmentId = this.props.runningOrder.currentSegmentLineId
		if (this.isLiveSegment === false && this.props.isLiveSegment === true) {
			this.isLiveSegment = true
			this.onFollowLiveLine(true, {})
			this.startOnAirLine()
		}
		if (this.isLiveSegment === true && this.props.isLiveSegment === false) {
			this.isLiveSegment = false
			this.stopOnAirLine()
		}

		// rewind all scrollLeft's to 0 on running order activate
		if (this.props.runningOrder && this.props.runningOrder.active && prevProps.runningOrder && !prevProps.runningOrder.active) {
			this.setState({
				scrollLeft: 0
			})
		}

		if (this.props.followLiveSegments && !prevProps.followLiveSegments) {
			this.onFollowLiveLine(true, {})
		}
	}

	componentWillUnmount () {
		this.stopOnAirLine()
	}

	onCollapseOutputToggle = (outputLayer: IOutputLayerUi) => {
		let collapsedOutputs = {...this.state.collapsedOutputs}
		collapsedOutputs[outputLayer._id] = collapsedOutputs[outputLayer._id] === true ? false : true
		this.setState({ collapsedOutputs })
	}
	onCollapseSegmentToggle = () => {
		this.setState({ collapsed: !this.state.collapsed })
	}
	/** The user has scrolled scrollLeft seconds to the left in a child component */
	onScroll = (scrollLeft: number, event: any) => {
		this.setState({
			scrollLeft: scrollLeft,
			followLiveLine: false
		})
		if (typeof this.props.onSegmentScroll === 'function') this.props.onSegmentScroll()
	}

	onAirLineRefresh = () => {
		if (this.props.isLiveSegment && this.props.currentLiveSegmentLine) {
			let speed = 1
			const segmentLineOffset = this.context.durations &&
									  this.context.durations.segmentLineStartsAt &&
									  (this.context.durations.segmentLineStartsAt[this.props.currentLiveSegmentLine._id] - this.context.durations.segmentLineStartsAt[this.props.segmentLines[0]._id])
									  || 0
			let newLivePosition = this.props.currentLiveSegmentLine.startedPlayback ?
				(getCurrentTime() - this.props.currentLiveSegmentLine.startedPlayback + segmentLineOffset) :
				segmentLineOffset

			this.setState(_.extend({
				livePosition: newLivePosition,
				displayTimecode: this.props.currentLiveSegmentLine.startedPlayback ?
					(getCurrentTime() - (this.props.currentLiveSegmentLine.startedPlayback + (this.props.currentLiveSegmentLine.duration || this.props.currentLiveSegmentLine.expectedDuration || 0))) :
					(this.props.currentLiveSegmentLine.duration || this.props.currentLiveSegmentLine.expectedDuration)
			}, this.state.followLiveLine ? {
				scrollLeft: Math.max(newLivePosition - (this.props.liveLineHistorySize / this.props.timeScale), 0)
			} : null))
		}
	}

	startOnAirLine = () => {
		window.addEventListener(RunningOrderTiming.Events.timeupdateHR, this.onAirLineRefresh)
	}

	stopOnAirLine = () => {
		window.removeEventListener(RunningOrderTiming.Events.timeupdateHR, this.onAirLineRefresh)
	}

	onFollowLiveLine = (state: boolean, event: any) => {
		this.setState({
			followLiveLine: state,
			scrollLeft: Math.max(this.state.livePosition - (this.props.liveLineHistorySize / this.props.timeScale), 0)
		})

		/* if (this.state.followLiveLine) {
			this.debugDemoLiveLine()
		} */
	}

	render () {
		return (
			<SegmentTimeline
				key={this.props.segment._id}
				segment={this.props.segmentui}
				studioInstallation={this.props.studioInstallation}
				segmentLines={this.props.segmentLines}
				timeScale={this.props.timeScale}
				onCollapseOutputToggle={this.onCollapseOutputToggle}
				collapsedOutputs={this.state.collapsedOutputs}
				onCollapseSegmentToggle={this.onCollapseSegmentToggle}
				isCollapsed={this.state.collapsed}
				scrollLeft={this.state.scrollLeft}
				runningOrder={this.props.runningOrder}
				followLiveSegments={this.props.followLiveSegments}
				isLiveSegment={this.props.isLiveSegment}
				isNextSegment={this.props.isNextSegment}
				hasRemoteItems={this.props.hasRemoteItems}
				autoNextSegmentLine={this.props.autoNextSegmentLine}
				hasAlreadyPlayed={this.props.hasAlreadyPlayed}
				followLiveLine={this.state.followLiveLine}
				liveLineHistorySize={this.props.liveLineHistorySize}
				livePosition={this.state.livePosition}
				displayTimecode={this.state.displayTimecode}
				onContextMenu={this.props.onContextMenu}
				onFollowLiveLine={this.onFollowLiveLine}
				onZoomChange={(newScale: number, e) => this.props.onTimeScaleChange && this.props.onTimeScaleChange(newScale)}
				onScroll={this.onScroll}
				followingSegmentLine={this.props.followingSegmentLine} />
		)
	}
}
)
