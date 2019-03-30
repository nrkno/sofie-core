import * as React from 'react'
import * as PropTypes from 'prop-types'
import * as _ from 'underscore'
import { withTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { RunningOrder } from '../../../lib/collections/RunningOrders'
import { Segment, Segments } from '../../../lib/collections/Segments'
import { StudioInstallation } from '../../../lib/collections/StudioInstallations'
import { SegmentTimeline, SegmentTimelineClass } from './SegmentTimeline'
import { getCurrentTime } from '../../../lib/lib'
import { RunningOrderTiming, computeSegmentDuration } from '../RunningOrderView/RunningOrderTiming'
import { CollapsedStateStorage } from '../../lib/CollapsedStateStorage'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { getResolvedSegment,
	IOutputLayerExtended,
	ISourceLayerExtended,
	SegmentLineItemExtended,
	SegmentLineExtended
} from '../../../lib/RunningOrder'
import { RunningOrderViewEvents } from '../RunningOrderView'
import { SegmentLineNote, SegmentLineNoteType } from '../../../lib/collections/SegmentLines'
import { ShowStyleBase } from '../../../lib/collections/ShowStyleBases'
import { SpeechSynthesiser } from '../../lib/speechSynthesis'
import { getSpeakingMode } from '../../lib/localStorage'

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
	message?: string | null
}
interface IProps {
	segmentId: string,
	studioInstallation: StudioInstallation,
	showStyleBase: ShowStyleBase,
	runningOrder: RunningOrder,
	timeScale: number,
	liveLineHistorySize: number
	onItemDoubleClick?: (item: SegmentLineItemUi, e: React.MouseEvent<HTMLDivElement>) => void
	onTimeScaleChange?: (timeScaleVal: number) => void
	onContextMenu?: (contextMenuContext: any) => void
	onSegmentScroll?: () => void
	onHeaderNoteClick?: (level: SegmentLineNoteType) => void
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
	segmentNotes: Array<SegmentLineNote>,
	isLiveSegment: boolean,
	isNextSegment: boolean,
	currentLiveSegmentLine: SegmentLineUi | undefined,
	hasRemoteItems: boolean,
	hasGuestItems: boolean,
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
			segmentNotes: [],
			isLiveSegment: false,
			isNextSegment: false,
			currentLiveSegmentLine: undefined,
			hasRemoteItems: false,
			hasGuestItems: false,
			hasAlreadyPlayed: false,
			autoNextSegmentLine: false,
			followingSegmentLine: undefined
		}
	}

	let o = getResolvedSegment(props.showStyleBase, props.runningOrder, segment)
	let notes: Array<SegmentLineNote> = []
	_.each(o.segmentLines, (sl) => {
		notes = notes.concat(sl.getNotes(true))
	})
	notes = notes.concat(segment.notes || [])

	return {
		segmentui: o.segmentExtended,
		segmentLines: o.segmentLines,
		segmentNotes: notes,
		isLiveSegment: o.isLiveSegment,
		currentLiveSegmentLine: o.currentLiveSegmentLine,
		isNextSegment: o.isNextSegment,
		hasAlreadyPlayed: o.hasAlreadyPlayed,
		hasRemoteItems: o.hasRemoteItems,
		hasGuestItems: o.hasGuestItems,
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
		!_.isEqual(props.showStyleBase.config, nextProps.showStyleBase.config) ||
		!_.isEqual(props.showStyleBase.sourceLayers, nextProps.showStyleBase.sourceLayers) ||
		!_.isEqual(props.showStyleBase.outputLayers, nextProps.showStyleBase.outputLayers)
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
	timelineDiv: HTMLDivElement

	private _prevDisplayTime: number

	constructor (props: IProps & ITrackedProps) {
		super(props)

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
		SpeechSynthesiser.init()
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
			const segmentLineOffset = this.context.durations &&
									  this.context.durations.segmentLineDisplayStartsAt &&
									  (this.context.durations.segmentLineDisplayStartsAt[this.props.currentLiveSegmentLine._id] - this.context.durations.segmentLineDisplayStartsAt[this.props.segmentLines[0]._id])
									  || 0

			const lastStartedPlayback = this.props.currentLiveSegmentLine.getLastStartedPlayback()
			let newLivePosition = this.props.currentLiveSegmentLine.startedPlayback && lastStartedPlayback ?
				(getCurrentTime() - lastStartedPlayback + segmentLineOffset) :
				segmentLineOffset

			let onAirLineDuration = (this.props.currentLiveSegmentLine.duration || this.props.currentLiveSegmentLine.expectedDuration || 0)
			if (this.props.currentLiveSegmentLine.displayDurationGroup && !this.props.currentLiveSegmentLine.displayDuration) {
				onAirLineDuration = this.props.currentLiveSegmentLine.renderedDuration || onAirLineDuration
			}

			this.setState(_.extend({
				livePosition: newLivePosition,
				displayTimecode: this.props.currentLiveSegmentLine.startedPlayback && lastStartedPlayback ?
					(getCurrentTime() - (lastStartedPlayback + onAirLineDuration)) :
					(onAirLineDuration * -1)
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

	segmentRef = (el: SegmentTimelineClass, sId: string) => {
		this.timelineDiv = el.timeline
	}

	onShowEntireSegment = (event: any) => {
		this.setState(_.extend({
			scrollLeft: 0
		}, this.props.isLiveSegment ? {
			followLiveLine: false
		} : {}))
		if (typeof this.props.onTimeScaleChange === 'function') this.props.onTimeScaleChange(($(this.timelineDiv).width() || 1) / (computeSegmentDuration(this.context.durations, this.props.segmentLines.map(i => i._id)) || 1))
		if (typeof this.props.onSegmentScroll === 'function') this.props.onSegmentScroll()
	}
	updateSpeech () {

		let displayTime = Math.floor( ( this.state.displayTimecode / 1000))

		if (this._prevDisplayTime !== displayTime) {

			let text = ''

			if (getSpeakingMode()) {
				switch (displayTime) {
					case -1: text = 'One'; break
					case -2: text = 'Two'; break
					case -3: text = 'Three'; break
					case -4: text = 'Four'; break
					case -5: text = 'Five'; break
					case -6: text = 'Six'; break
					case -7: text = 'Seven'; break
					case -8: text = 'Eight'; break
					case -9: text = 'Nine'; break
					case -10: text = 'Ten'; break
				}
				if (displayTime === 0 && this._prevDisplayTime === -1) {
					text = 'Zero'
				}
			}
			this._prevDisplayTime = displayTime
			if (text) {
				SpeechSynthesiser.speak(text)
			}
		}
	}

	render () {

		this.updateSpeech()

		return this.props.segmentui && (
			<SegmentTimeline
				segmentRef={this.segmentRef}
				key={this.props.segmentui._id}
				segment={this.props.segmentui}
				studioInstallation={this.props.studioInstallation}
				segmentLines={this.props.segmentLines}
				segmentNotes={this.props.segmentNotes}
				timeScale={this.props.timeScale}
				onItemDoubleClick={this.props.onItemDoubleClick}
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
				hasGuestItems={this.props.hasGuestItems}
				autoNextSegmentLine={this.props.autoNextSegmentLine}
				hasAlreadyPlayed={this.props.hasAlreadyPlayed}
				followLiveLine={this.state.followLiveLine}
				liveLineHistorySize={this.props.liveLineHistorySize}
				livePosition={this.state.livePosition}
				displayTimecode={this.state.displayTimecode}
				onContextMenu={this.props.onContextMenu}
				onFollowLiveLine={this.onFollowLiveLine}
				onShowEntireSegment={this.onShowEntireSegment}
				onZoomChange={(newScale: number, e) => this.props.onTimeScaleChange && this.props.onTimeScaleChange(newScale)}
				onScroll={this.onScroll}
				followingSegmentLine={this.props.followingSegmentLine}
				isLastSegment={this.props.isLastSegment}
				onHeaderNoteClick={this.props.onHeaderNoteClick} />
		) || null
	}
}
)
