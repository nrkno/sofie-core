import * as React from 'react'
import * as PropTypes from 'prop-types'
import * as _ from 'underscore'
import { withTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { withRenderLimiter } from '../../lib/RenderLimiter'

import * as SuperTimeline from 'superfly-timeline'

import { RunningOrder } from '../../../lib/collections/RunningOrders'
import { Segment, Segments } from '../../../lib/collections/Segments'
import { SegmentLine, SegmentLines } from '../../../lib/collections/SegmentLines'
import { SegmentLineItem, SegmentLineItems, SegmentLineItemLifespan } from '../../../lib/collections/SegmentLineItems'
import { StudioInstallation, IOutputLayer, ISourceLayer } from '../../../lib/collections/StudioInstallations'

import { SegmentTimeline } from './SegmentTimeline'

import { getCurrentTime, Time } from '../../../lib/lib'
import { RunningOrderTiming } from '../RunningOrderView/RunningOrderTiming'
import { PlayoutTimelinePrefixes } from '../../../lib/api/playout'

import { CollapsedStateStorage } from '../../lib/CollapsedStateStorage'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { getResolvedSegment,
	IOutputLayerExtended,
	ISourceLayerExtended,
	SegmentLineItemExtended,
	SegmentExtended,
	SegmentLineExtended
} from '../../../lib/RunningOrder'
import { RunningOrderViewEvents } from '../RunningOrderView'

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
export interface SegmentLineUi extends SegmentLineExtended {
}
export interface IOutputLayerUi extends IOutputLayerExtended {
	/** Is output layer group collapsed */
	collapsed?: boolean
}
export interface ISourceLayerUi extends ISourceLayerExtended {
}
export interface SegmentLineItemUi extends SegmentLineItemExtended {
	/** This item has already been linked to the parent item of the spanning item group */
	linked?: boolean
	/** Metadata object */
	metadata?: any
}
interface ISegmentLineItemUiDictionary {
	[key: string]: SegmentLineItemUi
}
interface IProps {
	segmentId: string,
	studioInstallation: StudioInstallation,
	runningOrder: RunningOrder,
	timeScale: number,
	liveLineHistorySize: number
	onTimeScaleChange?: (timeScaleVal: number) => void
	onContextMenu?: (contextMenuContext: any) => void
	onSegmentScroll?: () => void
	followLiveSegments: boolean
	segmentRef?: (el: React.ComponentClass, sId: string) => void
	isLastSegment: boolean
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
	segmentui: SegmentUi | undefined,
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
	const segment = Segments.findOne(props.segmentId) as SegmentUi | undefined

	// We need the segment to do anything
	if (!segment) {
		return {
			segmentui: undefined,
			segmentLines: [],
			isLiveSegment: false,
			isNextSegment: false,
			currentLiveSegmentLine: undefined,
			hasRemoteItems: false,
			hasAlreadyPlayed: false,
			autoNextSegmentLine: false,
			followingSegmentLine: undefined
		}
	}

	let o = getResolvedSegment(props.studioInstallation, props.runningOrder, segment)

	return {
		segmentui: o.segmentExtended,
		segmentLines: o.segmentLines,
		isLiveSegment: o.isLiveSegment,
		currentLiveSegmentLine: o.currentLiveSegmentLine,
		isNextSegment: o.isNextSegment,
		hasAlreadyPlayed: o.hasAlreadyPlayed,
		hasRemoteItems: o.hasRemoteItems,
		autoNextSegmentLine: o.autoNextSegmentLine,
		followingSegmentLine: o.followingSegmentLine
	}
}, (data: ITrackedProps, props: IProps, nextProps: IProps): boolean => {
	// This is a potentailly very dangerous hook into the React component lifecycle. Re-use with caution.
	// Check obvious primitive changes
	if (
		(props.followLiveSegments !== nextProps.followLiveSegments) ||
		(props.liveLineHistorySize !== nextProps.liveLineHistorySize) ||
		(props.onContextMenu !== nextProps.onContextMenu) ||
		(props.onSegmentScroll !== nextProps.onSegmentScroll) ||
		(props.onTimeScaleChange !== nextProps.onTimeScaleChange) ||
		(props.segmentId !== nextProps.segmentId) ||
		(props.segmentRef !== nextProps.segmentRef) ||
		(props.timeScale !== nextProps.timeScale)
	) {
		return true
	}
	// Check running order changes that are important to the segment
	if (
		(typeof props.runningOrder !== typeof nextProps.runningOrder) ||
		(
			(
				props.runningOrder.currentSegmentLineId !== nextProps.runningOrder.currentSegmentLineId ||
				props.runningOrder.nextSegmentLineId !== nextProps.runningOrder.nextSegmentLineId
			) && (
				(data.segmentLines && (
					data.segmentLines.find(i => (i._id === props.runningOrder.currentSegmentLineId) || (i._id === nextProps.runningOrder.currentSegmentLineId)) ||
					data.segmentLines.find(i => (i._id === props.runningOrder.nextSegmentLineId) || (i._id === nextProps.runningOrder.nextSegmentLineId))
					)
				)
			)
		)
	) {
		return true
	}
	// Check studio installation changes that are important to the segment.
	// We also could investigate just skipping this and requiring a full reload if the studio installation is changed
	if (
		(typeof props.studioInstallation !== typeof nextProps.studioInstallation) ||
		!_.isEqual(props.studioInstallation.config, nextProps.studioInstallation.config) ||
		!_.isEqual(props.studioInstallation.sourceLayers, nextProps.studioInstallation.sourceLayers) ||
		!_.isEqual(props.studioInstallation.outputLayers, nextProps.studioInstallation.outputLayers)
	) {
		return true
	}
	return false
})(class extends MeteorReactComponent<IProps & ITrackedProps, IState> {
	static contextTypes = {
		durations: PropTypes.object.isRequired
	}

	isLiveSegment: boolean
	roCurrentSegmentId: string | null
	lastRender: JSX.Element

	constructor (props: IProps & ITrackedProps) {
		super(props)

		let that = this
		this.state = {
			collapsedOutputs: CollapsedStateStorage.getItemBooleanMap(`runningOrderView.segment.${props.segmentId}.outputs`, {}),
			collapsed: CollapsedStateStorage.getItemBoolean(`runningOrderView.segment.${props.segmentId}`, false),
			scrollLeft: 0,
			followLiveLine: false,
			livePosition: 0,
			displayTimecode: 0
		}

		this.isLiveSegment = props.isLiveSegment || false
	}

	componentWillMount () {
		this.subscribe('segment', {
			_id: this.props.segmentId
		})
		this.subscribe('segmentLines', {
			segmentId: this.props.segmentId
		})
	}

	componentDidMount () {
		this.roCurrentSegmentId = this.props.runningOrder.currentSegmentLineId
		if (this.isLiveSegment === true) {
			this.onFollowLiveLine(true, {})
			this.startOnAirLine()
		}
		window.addEventListener(RunningOrderViewEvents.rewindsegments, this.onRewindSegment)
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
		} else if (this.props.runningOrder && !this.props.runningOrder.active && prevProps.runningOrder && prevProps.runningOrder.active) {
			this.setState({
				livePosition: 0,
				displayTimecode: 0
			})
		}

		if (this.props.followLiveSegments && !prevProps.followLiveSegments) {
			this.onFollowLiveLine(true, {})
		}
	}

	componentWillUnmount () {
		this._cleanUp()
		this.stopOnAirLine()
		window.removeEventListener(RunningOrderViewEvents.rewindsegments, this.onRewindSegment)
	}

	onCollapseOutputToggle = (outputLayer: IOutputLayerUi) => {
		let collapsedOutputs = {...this.state.collapsedOutputs}
		collapsedOutputs[outputLayer._id] = collapsedOutputs[outputLayer._id] === true ? false : true
		CollapsedStateStorage.setItem(`runningOrderView.segment.${this.props.segmentId}.outputs`, collapsedOutputs)
		this.setState({ collapsedOutputs })
	}
	onCollapseSegmentToggle = () => {
		CollapsedStateStorage.setItem(`runningOrderView.segment.${this.props.segmentId}`, !this.state.collapsed)
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

	onRewindSegment = () => {
		if (!this.props.isLiveSegment) {
			this.setState({
				scrollLeft: 0
			})
		}
	}

	onAirLineRefresh = () => {
		if (this.props.isLiveSegment && this.props.currentLiveSegmentLine) {
			let speed = 1
			const segmentLineOffset = this.context.durations &&
									  this.context.durations.segmentLineDisplayStartsAt &&
									  (this.context.durations.segmentLineDisplayStartsAt[this.props.currentLiveSegmentLine._id] - this.context.durations.segmentLineDisplayStartsAt[this.props.segmentLines[0]._id])
									  || 0

			const lastStartedPlayback = this.props.currentLiveSegmentLine.getLastStartedPlayback()
			let newLivePosition = this.props.currentLiveSegmentLine.startedPlayback && lastStartedPlayback ?
				(getCurrentTime() - lastStartedPlayback + segmentLineOffset) :
				segmentLineOffset

			this.setState(_.extend({
				livePosition: newLivePosition,
				displayTimecode: this.props.currentLiveSegmentLine.startedPlayback && lastStartedPlayback ?
					(getCurrentTime() - (lastStartedPlayback + (this.props.currentLiveSegmentLine.duration || this.props.currentLiveSegmentLine.expectedDuration || 0))) :
					((this.props.currentLiveSegmentLine.duration || this.props.currentLiveSegmentLine.expectedDuration || 0) * -1)
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
		return this.props.segmentui && (
			<SegmentTimeline
				segmentRef={this.props.segmentRef}
				key={this.props.segmentui._id}
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
				followingSegmentLine={this.props.followingSegmentLine}
				isLastSegment={this.props.isLastSegment} />
		)
	}
}
)
