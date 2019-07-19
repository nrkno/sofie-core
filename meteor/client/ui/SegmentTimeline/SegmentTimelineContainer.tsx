import * as React from 'react'
import * as PropTypes from 'prop-types'
import * as _ from 'underscore'
import { withTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { Rundown } from '../../../lib/collections/Rundowns'
import { Segment, Segments } from '../../../lib/collections/Segments'
import { Studio } from '../../../lib/collections/Studios'
import { SegmentTimeline, SegmentTimelineClass } from './SegmentTimeline'
import { getCurrentTime } from '../../../lib/lib'
import { RundownTiming, computeSegmentDuration } from '../RundownView/RundownTiming'
import { UIStateStorage } from '../../lib/UIStateStorage'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { getResolvedSegment,
	IOutputLayerExtended,
	ISourceLayerExtended,
	PieceExtended,
	PartExtended
} from '../../../lib/Rundown'
import { RundownViewEvents } from '../RundownView'
import { ShowStyleBase } from '../../../lib/collections/ShowStyleBases'
import { SpeechSynthesiser } from '../../lib/speechSynthesis'
import { getSpeakingMode } from '../../lib/localStorage'
import { NoteType, PartNote } from '../../../lib/api/notes'
import { getElementWidth } from '../../utils/dimensions';
import { isMaintainingFocus, scrollToSegment } from '../../lib/viewPort';

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
export interface PartUi extends PartExtended {
}
export interface IOutputLayerUi extends IOutputLayerExtended {
	/** Is output layer group collapsed */
	collapsed?: boolean
}
export interface ISourceLayerUi extends ISourceLayerExtended {
}
export interface PieceUi extends PieceExtended {
	/** This item has already been linked to the parent item of the spanning item group */
	linked?: boolean
	/** Metadata object */
	contentMetaData?: any
	message?: string | null
}
interface IProps {
	id: string
	segmentId: string,
	studio: Studio,
	showStyleBase: ShowStyleBase,
	rundown: Rundown,
	timeScale: number,
	liveLineHistorySize: number
	onPieceDoubleClick?: (item: PieceUi, e: React.MouseEvent<HTMLDivElement>) => void
	onPieceClick?: (piece: PieceUi, e: React.MouseEvent<HTMLDivElement>) => void
	onTimeScaleChange?: (timeScaleVal: number) => void
	onContextMenu?: (contextMenuContext: any) => void
	onSegmentScroll?: () => void
	onHeaderNoteClick?: (level: NoteType) => void
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
	parts: Array<PartUi>,
	segmentNotes: Array<PartNote>,
	isLiveSegment: boolean,
	isNextSegment: boolean,
	currentLivePart: PartUi | undefined,
	hasRemoteItems: boolean,
	hasGuestItems: boolean,
	hasAlreadyPlayed: boolean,
	autoNextPart: boolean
	followingPart: PartUi | undefined
}
export const SegmentTimelineContainer = withTracker<IProps, IState, ITrackedProps>((props: IProps) => {
	// console.log('PeripheralDevices',PeripheralDevices);
	// console.log('PeripheralDevices.find({}).fetch()',PeripheralDevices.find({}, { sort: { created: -1 } }).fetch());
	const segment = Segments.findOne(props.segmentId) as SegmentUi | undefined

	// We need the segment to do anything
	if (!segment) {
		return {
			segmentui: undefined,
			parts: [],
			segmentNotes: [],
			isLiveSegment: false,
			isNextSegment: false,
			currentLivePart: undefined,
			hasRemoteItems: false,
			hasGuestItems: false,
			hasAlreadyPlayed: false,
			autoNextPart: false,
			followingPart: undefined
		}
	}

	let o = getResolvedSegment(props.showStyleBase, props.rundown, segment)
	let notes: Array<PartNote> = []
	_.each(o.parts, (part) => {
		notes = notes.concat(part.getNotes(true))
	})
	notes = notes.concat(segment.notes || [])

	return {
		segmentui: o.segmentExtended,
		parts: o.parts,
		segmentNotes: notes,
		isLiveSegment: o.isLiveSegment,
		currentLivePart: o.currentLivePart,
		isNextSegment: o.isNextSegment,
		hasAlreadyPlayed: o.hasAlreadyPlayed,
		hasRemoteItems: o.hasRemoteItems,
		hasGuestItems: o.hasGuestItems,
		autoNextPart: o.autoNextPart,
		followingPart: o.followingPart
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
	// Check rundown changes that are important to the segment
	if (
		(typeof props.rundown !== typeof nextProps.rundown) ||
		(
			(
				props.rundown.currentPartId !== nextProps.rundown.currentPartId ||
				props.rundown.nextPartId !== nextProps.rundown.nextPartId
			) && (
				(data.parts && (
					data.parts.find(i => (i._id === props.rundown.currentPartId) || (i._id === nextProps.rundown.currentPartId)) ||
					data.parts.find(i => (i._id === props.rundown.nextPartId) || (i._id === nextProps.rundown.nextPartId))
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
		(typeof props.studio !== typeof nextProps.studio) ||
		!_.isEqual(props.studio.config, nextProps.studio.config) ||
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
	isVisible: boolean
	rundownCurrentSegmentId: string | null
	timelineDiv: HTMLDivElement
	intersectionObserver: IntersectionObserver | undefined
	mountedTime: number

	private _prevDisplayTime: number

	constructor (props: IProps & ITrackedProps) {
		super(props)

		this.state = {
			collapsedOutputs: UIStateStorage.getItemBooleanMap(`rundownView.${this.props.rundown._id}`, `segment.${props.segmentId}.outputs`, {}),
			collapsed: UIStateStorage.getItemBoolean(`rundownView.${this.props.rundown._id}`, `segment.${props.segmentId}`, false),
			scrollLeft: 0,
			followLiveLine: false,
			livePosition: 0,
			displayTimecode: 0
		}

		this.isLiveSegment = props.isLiveSegment || false
		this.isVisible = false
	}

	componentWillMount () {
		this.subscribe('segment', {
			_id: this.props.segmentId
		})
		this.subscribe('parts', {
			segmentId: this.props.segmentId
		})
		SpeechSynthesiser.init()
	}

	componentDidMount () {
		this.rundownCurrentSegmentId = this.props.rundown.currentPartId
		if (this.isLiveSegment === true) {
			this.onFollowLiveLine(true, {})
			this.startLive()
		}
		window.addEventListener(RundownViewEvents.rewindsegments, this.onRewindSegment)
		window.requestAnimationFrame(() => {
			this.mountedTime = Date.now()
			if (this.isLiveSegment && this.props.followLiveSegments && !this.isVisible) {
				scrollToSegment(this.props.segmentId, true)
			}
		})
	}

	componentDidUpdate (prevProps) {
		this.rundownCurrentSegmentId = this.props.rundown.currentPartId
		if (this.isLiveSegment === false && this.props.isLiveSegment === true) {
			this.isLiveSegment = true
			this.onFollowLiveLine(true, {})
			this.startLive()
		}
		if (this.isLiveSegment === true && this.props.isLiveSegment === false) {
			this.isLiveSegment = false
			this.stopLive()
		}

		// rewind all scrollLeft's to 0 on rundown activate
		if (this.props.rundown && this.props.rundown.active && prevProps.rundown && !prevProps.rundown.active) {
			this.setState({
				scrollLeft: 0
			})
		} else if (this.props.rundown && !this.props.rundown.active && prevProps.rundown && prevProps.rundown.active) {
			this.setState({
				livePosition: 0,
				displayTimecode: 0
			})
		}

		if (this.props.followLiveSegments && !prevProps.followLiveSegments) {
			this.onFollowLiveLine(true, {})
		}

		this.updateSpeech()
	}

	componentWillUnmount () {
		this._cleanUp()
		this.stopLive()
		window.removeEventListener(RundownViewEvents.rewindsegments, this.onRewindSegment)
	}

	onCollapseOutputToggle = (outputLayer: IOutputLayerUi) => {
		let collapsedOutputs = { ...this.state.collapsedOutputs }
		collapsedOutputs[outputLayer._id] = collapsedOutputs[outputLayer._id] === true ? false : true
		UIStateStorage.setItem(`rundownView.${this.props.rundown._id}`, `segment.${this.props.segmentId}.outputs`, collapsedOutputs)
		this.setState({ collapsedOutputs })
	}
	onCollapseSegmentToggle = () => {
		UIStateStorage.setItem(`rundownView.${this.props.rundown._id}`, `segment.${this.props.segmentId}`, !this.state.collapsed)
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
		if (this.props.isLiveSegment && this.props.currentLivePart) {
			const partOffset = this.context.durations &&
				this.context.durations.partDisplayStartsAt &&
				(this.context.durations.partDisplayStartsAt[this.props.currentLivePart._id]
					- this.context.durations.partDisplayStartsAt[this.props.parts[0]._id])
				|| 0

			const lastStartedPlayback = this.props.currentLivePart.getLastStartedPlayback()
			const lastPlayOffset = this.props.currentLivePart.getLastPlayOffset() || 0

			let newLivePosition = this.props.currentLivePart.startedPlayback && lastStartedPlayback ?
				(getCurrentTime() - lastStartedPlayback + partOffset + lastPlayOffset) :
				partOffset

			let onAirPartDuration = (this.props.currentLivePart.duration || this.props.currentLivePart.expectedDuration || 0)
			if (this.props.currentLivePart.displayDurationGroup && !this.props.currentLivePart.displayDuration) {
				onAirPartDuration = this.props.currentLivePart.renderedDuration || onAirPartDuration
			}

			this.setState(_.extend({
				livePosition: newLivePosition,
				displayTimecode: this.props.currentLivePart.startedPlayback && lastStartedPlayback ?
					(getCurrentTime() - (lastStartedPlayback + onAirPartDuration)) :
					(onAirPartDuration * -1)
			}, this.state.followLiveLine ? {
				scrollLeft: Math.max(newLivePosition - (this.props.liveLineHistorySize / this.props.timeScale), 0)
			} : null))
		}
	}

	visibleChanged = (entries: IntersectionObserverEntry[]) => {
		// console.log("visibleChanged")
		if ((entries[0].intersectionRatio < 0.99) && !isMaintainingFocus() && (Date.now() - this.mountedTime > 2000)) {
			if (typeof this.props.onSegmentScroll === 'function') this.props.onSegmentScroll()
			// console.log("onSegmentScroll", entries[0].intersectionRatio, isMaintainingFocus())
			this.isVisible = false
		} else {
			this.isVisible = true
		}
	}

	startLive = () => {
		window.addEventListener(RundownTiming.Events.timeupdateHR, this.onAirLineRefresh)
		this.intersectionObserver = new IntersectionObserver(this.visibleChanged, {
			rootMargin: '-150px 0px -20px 0px',
			threshold: [0, 0.25, 0.5, 0.75, 0.98]
		})
		this.intersectionObserver.observe(this.timelineDiv)
	}

	stopLive = () => {
		window.removeEventListener(RundownTiming.Events.timeupdateHR, this.onAirLineRefresh)
		if (this.intersectionObserver) {
			this.intersectionObserver.disconnect()
			this.intersectionObserver = undefined
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

	segmentRef = (el: SegmentTimelineClass, sId: string) => {
		this.timelineDiv = el.timeline
	}

	onShowEntireSegment = (event: any) => {
		this.setState(_.extend({
			scrollLeft: 0
		}, this.props.isLiveSegment ? {
			followLiveLine: false
		} : {}))
		if (typeof this.props.onTimeScaleChange === 'function') this.props.onTimeScaleChange((getElementWidth(this.timelineDiv) || 1) / (computeSegmentDuration(this.context.durations, this.props.parts.map(i => i._id)) || 1))
		if (typeof this.props.onSegmentScroll === 'function') this.props.onSegmentScroll()
	}
	updateSpeech () {

		let displayTime = Math.floor((this.state.displayTimecode / 1000))

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
					text = 'Zerundown'
				}
			}
			this._prevDisplayTime = displayTime
			if (text) {
				SpeechSynthesiser.speak(text)
			}
		}
	}

	render () {
		return this.props.segmentui && (
			<SegmentTimeline
				id={this.props.id}
				segmentRef={this.segmentRef}
				key={this.props.segmentui._id}
				segment={this.props.segmentui}
				studio={this.props.studio}
				parts={this.props.parts}
				segmentNotes={this.props.segmentNotes}
				timeScale={this.props.timeScale}
				onItemClick={this.props.onPieceClick}
				onItemDoubleClick={this.props.onPieceDoubleClick}
				onCollapseOutputToggle={this.onCollapseOutputToggle}
				collapsedOutputs={this.state.collapsedOutputs}
				onCollapseSegmentToggle={this.onCollapseSegmentToggle}
				isCollapsed={this.state.collapsed}
				scrollLeft={this.state.scrollLeft}
				rundown={this.props.rundown}
				followLiveSegments={this.props.followLiveSegments}
				isLiveSegment={this.props.isLiveSegment}
				isNextSegment={this.props.isNextSegment}
				hasRemoteItems={this.props.hasRemoteItems}
				hasGuestItems={this.props.hasGuestItems}
				autoNextPart={this.props.autoNextPart}
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
				followingPart={this.props.followingPart}
				isLastSegment={this.props.isLastSegment}
				onHeaderNoteClick={this.props.onHeaderNoteClick} />
		) || null
	}
}
)
