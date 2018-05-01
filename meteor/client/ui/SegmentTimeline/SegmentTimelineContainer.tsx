import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import * as _ from 'underscore'
import { withTracker } from '../../lib/ReactMeteorData/react-meteor-data'

import { normalizeArray } from '../../lib/utils'

import * as SuperTimeline from 'superfly-timeline'

import { RunningOrder } from '../../../lib/collections/RunningOrders'
import { Segment, Segments } from '../../../lib/collections/Segments'
import { SegmentLine, SegmentLines } from '../../../lib/collections/SegmentLines'
import { SegmentLineItem, SegmentLineItems } from '../../../lib/collections/SegmentLineItems'
import { StudioInstallation, StudioInstallations, IOutputLayer, ISourceLayer } from '../../../lib/collections/StudioInstallations'

import { SegmentTimeline } from './SegmentTimeline'

import { Settings } from '../../../lib/Settings'

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
	/** This item has already been linked to the parent item of the spanning item group */
	linked?: boolean
}
interface ISegmentLineItemUiDictionary {
	[key: string]: SegmentLineItemUi
}
interface IPropsHeader {
	key: string,
	segment: SegmentUi,
	studioInstallation: StudioInstallation,
	segmentLines: Array<SegmentLineUi>,
	runningOrder: RunningOrder,
	timeScale: number,
	isLiveSegment: boolean,
	isNextSegment: boolean,
	liveLineHistorySize: number
	onTimeScaleChange?: (timeScaleVal: number) => void
	onContextMenu?: (contextMenuContext: any) => void
}
interface IStateHeader {
	scrollLeft: number,
	collapsedOutputs: {
		[key: string]: boolean
	},
	collapsed: boolean,
	followLiveLine: boolean,
	livePosition: number
}
export const SegmentTimelineContainer = withTracker((props) => {
	// console.log('PeripheralDevices',PeripheralDevices);
	// console.log('PeripheralDevices.find({}).fetch()',PeripheralDevices.find({}, { sort: { created: -1 } }).fetch());

	let segment = _.clone(props.segment)

	let isLiveSegment = false
	let isNextSegment = false

	// fetch all the segment lines for the segment
	let segmentLines = SegmentLines.find({
		segmentId: props.segment._id
	}, { sort: { _rank: 1 } }).fetch()

	// create local deep copies of the studioInstallation outputLayers and sourceLayers so that we can store
	// items present on those layers inside and also figure out which layers are used when inside the rundown
	const outputLayers = normalizeArray<IOutputLayerUi>(props.studioInstallation.outputLayers.map((layer) => { return _.clone(layer) }), '_id')
	const sourceLayers = normalizeArray<ISourceLayerUi>(props.studioInstallation.sourceLayers.map((layer) => { return _.clone(layer) }), '_id')

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
	// fetch all the segment line items for the segment lines
	_.forEach<SegmentLineUi>(segmentLines, (segmentLine) => {
		let slTimeline: SuperTimeline.UnresolvedTimeline = []

		if (props.runningOrder.currentSegmentLineId === segmentLine._id) {
			isLiveSegment = true
		}
		if (!isLiveSegment && props.runningOrder.nextSegmentLineId === segmentLine._id) {
			isNextSegment = true
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
				return _.extend({}, trigger, {
					value: trigger.value + offset
				})
			}
		}

		_.forEach<SegmentLineItemUi>(segmentLine.items, (segmentLineItem) => {
			slTimeline.push({
				id: segmentLineItem._id,
				trigger: offsetTrigger(segmentLineItem.trigger, TIMELINE_TEMP_OFFSET),
				duration: segmentLineItem.duration || segmentLineItem.expectedDuration,
				LLayer: segmentLineItem.outputLayerId,
				content: segmentLineItem
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
			}

			segmentLineItemsLookup[segmentLineItem._id] = segmentLineItem
			if (segmentLineItem.continuesRefId && segmentLineItemsLookup[segmentLineItem.continuesRefId]) {
				segmentLineItemsLookup[segmentLineItem.continuesRefId].continuedByRef = segmentLineItem
			}
		})

		// SuperTimeline.Resolver.setTraceLevel(SuperTimeline.TraceLevel.TRACE)

		let slRTimeline = SuperTimeline.Resolver.getTimelineInWindow(slTimeline)
		let furthestDuration = 0
		slRTimeline.resolved.forEach((tlItem) => {
			let segmentLineItem = tlItem.content as SegmentLineItemUi
			segmentLineItem.renderedDuration = tlItem.resolved.outerDuration

			// if there is no renderedInPoint, use 0 as the starting time for the item
			segmentLineItem.renderedInPoint = tlItem.resolved.startTime ? tlItem.resolved.startTime - TIMELINE_TEMP_OFFSET : 0

			if (Number.isFinite(segmentLineItem.renderedDuration || 0) && ((segmentLineItem.renderedInPoint || 0) + (segmentLineItem.renderedDuration || 0) > furthestDuration)) {
				furthestDuration = (segmentLineItem.renderedInPoint || 0) + (segmentLineItem.renderedDuration || 0)
			}
		})

		segmentLine.renderedDuration = furthestDuration
		segmentLine.startsAt = startsAt
		startsAt = segmentLine.startsAt + (segmentLine.renderedDuration || 0)

		segmentLineItems.forEach((item) => {
			let itemUi = item as SegmentLineItemUi
			if (itemUi.renderedDuration && !Number.isFinite(itemUi.renderedDuration)) {
				itemUi.renderedDuration = segmentLine.renderedDuration! - itemUi.renderedInPoint!
			}
		})
	})

	const resolveDuration = (item: SegmentLineItemUi): number => {
		let childDuration = 0
		if (item.continuedByRef) {
			childDuration = resolveDuration(item.continuedByRef)
			item.continuedByRef.linked = true
		}
		return (item.duration || item.renderedDuration || item.expectedDuration) + childDuration
	}

	_.forEach<SegmentLineUi>(segmentLines, (line) => {
		line.items && _.forEach<SegmentLineItemUi>(line.items, (item) => {
			if (item.continuedByRef && !item.linked) {
				item.renderedDuration = resolveDuration(item)
			}
		})
	})

	segment.outputLayers = outputLayers
	segment.sourceLayers = sourceLayers

	return {
		segment,
		segmentLines,
		isLiveSegment,
		isNextSegment
	}
})(
class extends React.Component<IPropsHeader, IStateHeader> {
	debugDemoLiveLineInterval?: NodeJS.Timer
	debugDemoLiveLineStart: number
	isLiveSegment: boolean
	roCurrentSegmentId: string | null

	constructor (props) {
		super(props)

		let that = this
		this.state = {
			collapsedOutputs: {},
			collapsed: false,
			scrollLeft: 0,
			followLiveLine: false,
			livePosition: 0
		}

		this.isLiveSegment = props.isLiveSegment || false

		/* that.setState({
			timeScale: that.state.timeScale * 1.1
		}) */
	}

	componentDidUpdate () {
		if (this.isLiveSegment === false && this.props.isLiveSegment === true) {
			this.isLiveSegment = true
			this.onFollowLiveLine(true, {})
			this.debugDemoLiveLine()
		}
		if (this.isLiveSegment === true && this.props.isLiveSegment === false) {
			this.isLiveSegment = false
			this.debugStopDemoLiveLine()
		}
		// TODO: This is just a debug/mock implementation. The segments should be cut short on Take Next,
		// thus automatically making the OnAir line be, where it should be
		if (this.roCurrentSegmentId && this.props.runningOrder.currentSegmentLineId !== this.roCurrentSegmentId) {
			// DISABLE THIS ENTIRE SECTION TO REMOVE "JUMP TO NEXT LINE"
			if (this.debugDemoLiveLineInterval) {
				let newCurrentSegmentLine = this.props.segmentLines.findIndex((item) => item._id === this.props.runningOrder.currentSegmentLineId)
				if (newCurrentSegmentLine >= 0 && this.props.segmentLines[newCurrentSegmentLine].startsAt) {
					const playoutLength = (Date.now() - this.debugDemoLiveLineStart) / 1000
					console.log(playoutLength, this.props.segmentLines[newCurrentSegmentLine].startsAt)
					if (this.props.segmentLines[newCurrentSegmentLine].startsAt! > playoutLength) {
						console.log(this.debugDemoLiveLineStart)
						this.debugDemoLiveLineStart -= (this.props.segmentLines[newCurrentSegmentLine].startsAt! - playoutLength) * 1000
						console.log(this.debugDemoLiveLineStart)
					}
				}
			}
			this.roCurrentSegmentId = this.props.runningOrder.currentSegmentLineId
		} else {
			this.roCurrentSegmentId = this.props.runningOrder.currentSegmentLineId
		}
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
	}

	debugStopDemoLiveLine = () => {
		if (this.debugDemoLiveLineInterval) {
			clearInterval(this.debugDemoLiveLineInterval)
		}
	}

	debugDemoLiveLine = () => {
		if (!this.debugDemoLiveLineInterval) {
			let currentSegmentLine = SegmentLines.findOne({'_id': this.props.runningOrder.currentSegmentLineId})

			if (currentSegmentLine) {
				this.debugDemoLiveLineStart = Date.now()
				this.debugDemoLiveLineInterval = setInterval(() => {
					let speed = 1
					let newLivePosition = (Date.now() - this.debugDemoLiveLineStart) / 1000
					this.setState(_.extend({
						livePosition: newLivePosition,
					}, this.state.followLiveLine ? {
						scrollLeft: Math.max(newLivePosition - (this.props.liveLineHistorySize / this.props.timeScale), 0)
					} : null))
				}, 1000 / 60)
			}
		}
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
			<SegmentTimeline key={this.props.segment._id}
							 segment={this.props.segment}
							 studioInstallation={this.props.studioInstallation}
							 segmentLines={this.props.segmentLines}
							 timeScale={this.props.timeScale}
							 onCollapseOutputToggle={this.onCollapseOutputToggle}
							 collapsedOutputs={this.state.collapsedOutputs}
							 onCollapseSegmentToggle={this.onCollapseSegmentToggle}
							 isCollapsed={this.state.collapsed}
							 scrollLeft={this.state.scrollLeft}
							 runningOrder={this.props.runningOrder}
							 isLiveSegment={this.props.isLiveSegment}
							 isNextSegment={this.props.isNextSegment}
							 followLiveLine={this.state.followLiveLine}
							 liveLineHistorySize={this.props.liveLineHistorySize}
							 livePosition={this.state.livePosition}
							 onContextMenu={this.props.onContextMenu}
							 onFollowLiveLine={this.onFollowLiveLine}
							 onZoomChange={(newScale: number, e) => this.props.onTimeScaleChange && this.props.onTimeScaleChange(newScale)}
							 onScroll={this.onScroll} />
		)
	}
}
)
