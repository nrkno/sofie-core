import * as React from 'react'
import * as PropTypes from 'prop-types'
import * as _ from 'underscore'
import { PieceLifespan } from 'tv-automation-sofie-blueprints-integration'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { Segments, SegmentId } from '../../../lib/collections/Segments'
import { Studio } from '../../../lib/collections/Studios'
import { SegmentTimeline, SegmentTimelineClass } from './SegmentTimeline'
import { RundownTiming, computeSegmentDuration, TimingEvent } from '../RundownView/RundownTiming'
import { UIStateStorage } from '../../lib/UIStateStorage'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import {
	IOutputLayerExtended,
	ISourceLayerExtended,
	PieceExtended,
	PartExtended,
	SegmentExtended,
} from '../../../lib/Rundown'
import { RundownViewEvents, IContextMenuContext, IGoToPartEvent, IGoToPartInstanceEvent } from '../RundownView'
import { ShowStyleBase } from '../../../lib/collections/ShowStyleBases'
import { SpeechSynthesiser } from '../../lib/speechSynthesis'
import { NoteType, SegmentNote } from '../../../lib/api/notes'
import { getElementWidth } from '../../utils/dimensions'
import { isMaintainingFocus, scrollToSegment, getHeaderHeight } from '../../lib/viewPort'
import { PubSub } from '../../../lib/api/pubsub'
import { unprotectString, equalSets } from '../../../lib/lib'
import { RundownUtils } from '../../lib/rundown'
import { Settings } from '../../../lib/Settings'
import { RundownId } from '../../../lib/collections/Rundowns'
import { PartInstanceId, PartInstances, PartInstance } from '../../../lib/collections/PartInstances'
import { Parts, PartId } from '../../../lib/collections/Parts'
import { doUserAction, UserAction } from '../../lib/userAction'
import { MeteorCall } from '../../../lib/api/methods'
import { Tracker } from 'meteor/tracker'

export const SIMULATED_PLAYBACK_SOFT_MARGIN = 0
export const SIMULATED_PLAYBACK_HARD_MARGIN = 2500
const SIMULATED_PLAYBACK_CROSSFADE_STEP = 0.02

export interface SegmentUi extends SegmentExtended {
	/** Output layers available in the installation used by this segment */
	outputLayers: {
		[key: string]: IOutputLayerUi
	}
	/** Source layers used by this segment */
	sourceLayers: {
		[key: string]: ISourceLayerUi
	}
}
export interface PartUi extends PartExtended {}
export interface IOutputLayerUi extends IOutputLayerExtended {
	/** Is output layer group collapsed */
	collapsed?: boolean
}
export interface ISourceLayerUi extends ISourceLayerExtended {}
export interface PieceUi extends PieceExtended {
	/** This item has already been linked to the parent item of the spanning item group */
	linked?: boolean
	/** Metadata object */
	contentMetaData?: any
	message?: string | null
}
interface IProps {
	id: string
	rundownId: RundownId
	segmentId: SegmentId
	segmentsIdsBefore: Set<SegmentId>
	orderedAllPartIds: PartId[]
	studio: Studio
	showStyleBase: ShowStyleBase
	playlist: RundownPlaylist
	timeScale: number
	liveLineHistorySize: number
	onPieceDoubleClick?: (item: PieceUi, e: React.MouseEvent<HTMLDivElement>) => void
	onPieceClick?: (piece: PieceUi, e: React.MouseEvent<HTMLDivElement>) => void
	onTimeScaleChange?: (timeScaleVal: number) => void
	onContextMenu?: (contextMenuContext: IContextMenuContext) => void
	onSegmentScroll?: () => void
	onHeaderNoteClick?: (level: NoteType) => void
	followLiveSegments: boolean
	segmentRef?: (el: React.ComponentClass, sId: string) => void
	isLastSegment: boolean
	ownCurrentPartInstance: PartInstance | undefined
	ownNextPartInstance: PartInstance | undefined
}
interface IState {
	scrollLeft: number
	collapsedOutputs: {
		[key: string]: boolean
	}
	collapsed: boolean
	followLiveLine: boolean
	livePosition: number
	displayTimecode: number
	autoExpandCurrentNextSegment: boolean
}
interface ITrackedProps {
	segmentui: SegmentUi | undefined
	parts: Array<PartUi>
	segmentNotes: Array<SegmentNote>
	isLiveSegment: boolean
	isNextSegment: boolean
	currentLivePart: PartUi | undefined
	currentNextPart: PartUi | undefined
	hasRemoteItems: boolean
	hasGuestItems: boolean
	hasAlreadyPlayed: boolean
	autoNextPart: boolean
	lastValidPartIndex: number | undefined
}
export const SegmentTimelineContainer = translateWithTracker<IProps, IState, ITrackedProps>(
	(props: IProps) => {
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
				currentNextPart: undefined,
				hasRemoteItems: false,
				hasGuestItems: false,
				hasAlreadyPlayed: false,
				autoNextPart: false,
				lastValidPartIndex: undefined,
			}
		}

		let o = RundownUtils.getResolvedSegment(
			props.showStyleBase,
			props.playlist,
			segment,
			props.segmentsIdsBefore,
			props.orderedAllPartIds,
			props.ownCurrentPartInstance,
			props.ownNextPartInstance
		)
		let notes: Array<SegmentNote> = []
		o.parts.forEach((part) => {
			notes = notes.concat(
				part.instance.part.getMinimumReactiveNotes(props.studio, props.showStyleBase),
				part.instance.part.getInvalidReasonNotes()
			)
		})
		notes = notes.concat(segment.notes || [])

		let lastValidPartIndex = o.parts.length - 1

		for (let i = lastValidPartIndex; i > 0; i--) {
			if (o.parts[i].instance.part.invalid) {
				lastValidPartIndex = i - 1
			} else {
				break
			}
		}

		return {
			segmentui: o.segmentExtended,
			parts: o.parts,
			segmentNotes: notes,
			isLiveSegment: o.isLiveSegment,
			currentLivePart: o.currentLivePart,
			currentNextPart: o.currentNextPart,
			isNextSegment: o.isNextSegment,
			hasAlreadyPlayed: o.hasAlreadyPlayed,
			hasRemoteItems: o.hasRemoteItems,
			hasGuestItems: o.hasGuestItems,
			autoNextPart: o.autoNextPart,
			lastValidPartIndex,
		}
	},
	(data: ITrackedProps, props: IProps, nextProps: IProps): boolean => {
		// This is a potentailly very dangerous hook into the React component lifecycle. Re-use with caution.
		// Check obvious primitive changes
		if (
			props.followLiveSegments !== nextProps.followLiveSegments ||
			props.liveLineHistorySize !== nextProps.liveLineHistorySize ||
			props.onContextMenu !== nextProps.onContextMenu ||
			props.onSegmentScroll !== nextProps.onSegmentScroll ||
			props.onTimeScaleChange !== nextProps.onTimeScaleChange ||
			props.segmentId !== nextProps.segmentId ||
			props.segmentRef !== nextProps.segmentRef ||
			props.timeScale !== nextProps.timeScale
		) {
			return true
		}
		// Check rundown changes that are important to the segment
		if (
			typeof props.playlist !== typeof nextProps.playlist ||
			(props.playlist.nextSegmentId !== nextProps.playlist.nextSegmentId &&
				(props.playlist.nextSegmentId === props.segmentId || nextProps.playlist.nextSegmentId === props.segmentId)) ||
			((props.playlist.currentPartInstanceId !== nextProps.playlist.currentPartInstanceId ||
				props.playlist.nextPartInstanceId !== nextProps.playlist.nextPartInstanceId) &&
				data.parts &&
				(data.parts.find(
					(i) =>
						i.instance._id === props.playlist.currentPartInstanceId ||
						i.instance._id === nextProps.playlist.currentPartInstanceId
				) ||
					data.parts.find(
						(i) =>
							i.instance._id === props.playlist.nextPartInstanceId ||
							i.instance._id === nextProps.playlist.nextPartInstanceId
					))) ||
			props.playlist.holdState !== nextProps.playlist.holdState ||
			props.playlist.nextTimeOffset !== nextProps.playlist.nextTimeOffset
		) {
			return true
		}
		// Check studio installation changes that are important to the segment.
		// We also could investigate just skipping this and requiring a full reload if the studio installation is changed
		if (
			typeof props.studio !== typeof nextProps.studio ||
			!_.isEqual(props.studio.settings, nextProps.studio.settings) ||
			!_.isEqual(props.showStyleBase.sourceLayers, nextProps.showStyleBase.sourceLayers) ||
			!_.isEqual(props.showStyleBase.outputLayers, nextProps.showStyleBase.outputLayers)
		) {
			return true
		}

		return false
	},
	true
)(
	class SegmentTimelineContainer extends MeteorReactComponent<Translated<IProps> & ITrackedProps, IState> {
		static contextTypes = {
			durations: PropTypes.object.isRequired,
		}

		isLiveSegment: boolean
		isVisible: boolean
		rundownCurrentPartInstanceId: PartInstanceId | null
		timelineDiv: HTMLDivElement
		intersectionObserver: IntersectionObserver | undefined
		mountedTime: number
		playbackSimulationPercentage: number = 0

		private pastInfinitesComp: Tracker.Computation | undefined

		constructor(props: IProps & ITrackedProps) {
			super(props)

			this.state = {
				collapsedOutputs: UIStateStorage.getItemBooleanMap(
					`rundownView.${this.props.playlist._id}`,
					`segment.${props.segmentId}.outputs`,
					{}
				),
				collapsed: UIStateStorage.getItemBoolean(
					`rundownView.${this.props.playlist._id}`,
					`segment.${props.segmentId}`,
					!!Settings.defaultToCollapsedSegments
				),
				scrollLeft: 0,
				followLiveLine: false,
				livePosition: 0,
				displayTimecode: 0,
				autoExpandCurrentNextSegment: !!Settings.autoExpandCurrentNextSegment,
			}

			this.isLiveSegment = props.isLiveSegment || false
			this.isVisible = false
		}

		shouldComponentUpdate(nextProps: IProps & ITrackedProps, nextState: IState) {
			return !_.isMatch(this.props, nextProps) || !_.isMatch(this.state, nextState)
		}

		componentDidMount() {
			this.subscribe(PubSub.segments, {
				rundownId: this.props.rundownId,
				_id: this.props.segmentId,
			})
			this.subscribe(PubSub.parts, {
				rundownId: this.props.rundownId,
				segmentId: this.props.segmentId,
			})
			this.subscribe(PubSub.partInstances, {
				rundownId: this.props.rundownId,
				segmentId: this.props.segmentId,
				reset: {
					$ne: true,
				},
			})
			this.autorun(() => {
				const partIds = Parts.find({
					segmentId: this.props.segmentId,
				}).map((part) => part._id)
				const partInstanceIds = PartInstances.find({
					segmentId: this.props.segmentId,
				}).map((instance) => instance._id)

				this.subscribe(PubSub.pieces, {
					startRundownId: this.props.rundownId,
					startPartId: {
						$in: partIds,
					},
				})
				this.subscribe(PubSub.pieceInstances, {
					rundownId: this.props.rundownId,
					partInstanceId: {
						$in: partInstanceIds,
					},
					reset: {
						$ne: true,
					},
				})
			})
			// past inifnites subscription
			this.pastInfinitesComp = this.autorun(() => {
				const segment = Segments.findOne(this.props.segmentId)
				segment &&
					this.subscribe(PubSub.piecesSimple, {
						invalid: {
							$ne: true,
						},
						// same rundown, and previous segment
						lifespan: { $in: [PieceLifespan.OutOnRundownEnd, PieceLifespan.OutOnRundownChange] },
						startRundownId: segment.rundownId,
						startSegmentId: { $in: Array.from(this.props.segmentsIdsBefore.values()) },
					})
			})
			SpeechSynthesiser.init()

			this.rundownCurrentPartInstanceId = this.props.playlist.currentPartInstanceId
			if (this.isLiveSegment === true) {
				this.onFollowLiveLine(true, {})
				this.startLive()

				if (this.state.autoExpandCurrentNextSegment) {
					this.setState({
						collapsed: false,
					})
				}
			}
			window.addEventListener(RundownViewEvents.rewindsegments, this.onRewindSegment)
			window.addEventListener(RundownViewEvents.goToPart, this.onGoToPart)
			window.addEventListener(RundownViewEvents.goToPartInstance, this.onGoToPart)
			window.requestAnimationFrame(() => {
				this.mountedTime = Date.now()
				if (this.isLiveSegment && this.props.followLiveSegments && !this.isVisible) {
					scrollToSegment(this.props.segmentId, true).catch(console.error)
				}
			})
		}

		componentDidUpdate(prevProps: IProps & ITrackedProps) {
			if (this.rundownCurrentPartInstanceId !== this.props.playlist.currentPartInstanceId) {
				this.playbackSimulationPercentage = 0
			}

			this.rundownCurrentPartInstanceId = this.props.playlist.currentPartInstanceId

			// segment is becoming live
			if (this.isLiveSegment === false && this.props.isLiveSegment === true) {
				this.isLiveSegment = true
				this.onFollowLiveLine(true, {})
				this.startLive()

				if (this.state.autoExpandCurrentNextSegment) {
					this.setState({
						collapsed: false,
					})
				}
			}
			// segment is stopping from being live
			if (this.isLiveSegment === true && this.props.isLiveSegment === false) {
				this.isLiveSegment = false
				this.stopLive()
				if (Settings.autoRewindLeavingSegment) this.onRewindSegment()

				if (this.props.segmentui && this.props.segmentui.unsynced) {
					const { t } = this.props
					// TODO: This doesn't seem right? componentDidUpdate can be triggered in a lot of different ways.
					// What is this supposed to do?
					doUserAction(t, undefined, UserAction.RESYNC_SEGMENT, (e) =>
						MeteorCall.userAction.resyncSegment('', this.props.segmentui!.rundownId, this.props.segmentui!._id)
					)
				}

				if (this.state.autoExpandCurrentNextSegment) {
					this.setState({
						collapsed: UIStateStorage.getItemBoolean(
							`rundownView.${this.props.playlist._id}`,
							`segment.${this.props.segmentId}`,
							!!Settings.defaultToCollapsedSegments
						),
					})
				}
			}
			if (
				// the segment isn't live, is next, and the nextPartId has changed
				!this.props.isLiveSegment &&
				this.props.isNextSegment &&
				this.props.currentNextPart &&
				this.props.playlist.nextPartInstanceId &&
				prevProps.playlist.nextPartInstanceId !== this.props.playlist.nextPartInstanceId
			) {
				const partOffset =
					(this.context.durations &&
						this.context.durations.partDisplayStartsAt &&
						this.context.durations.partDisplayStartsAt[unprotectString(this.props.currentNextPart.partId)] -
							this.context.durations.partDisplayStartsAt[unprotectString(this.props.parts[0].instance.part._id)]) ||
					0

				if (this.state.scrollLeft > partOffset) {
					this.setState({
						scrollLeft: partOffset,
					})
				}
			}
			// segment is becoming next
			if (prevProps.isNextSegment === false && this.props.isNextSegment === true) {
				if (this.state.autoExpandCurrentNextSegment) {
					this.setState({
						collapsed: false,
					})
				}
			}
			// segment is stopping from becoming and it's not live either
			if (
				prevProps.isNextSegment === true &&
				this.props.isNextSegment === false &&
				this.props.isLiveSegment === false
			) {
				if (this.state.autoExpandCurrentNextSegment) {
					this.setState({
						collapsed: UIStateStorage.getItemBoolean(
							`rundownView.${this.props.playlist._id}`,
							`segment.${this.props.segmentId}`,
							!!Settings.defaultToCollapsedSegments
						),
					})
				}
			}

			// rewind all scrollLeft's to 0 on rundown activate
			if (this.props.playlist && this.props.playlist.active && prevProps.playlist && !prevProps.playlist.active) {
				this.setState({
					scrollLeft: 0,
				})
			} else if (
				this.props.playlist &&
				!this.props.playlist.active &&
				prevProps.playlist &&
				prevProps.playlist.active
			) {
				this.setState({
					livePosition: 0,
				})
			}

			if (this.props.followLiveSegments && !prevProps.followLiveSegments) {
				this.onFollowLiveLine(true, {})
			}

			if (this.pastInfinitesComp && !equalSets(this.props.segmentsIdsBefore, prevProps.segmentsIdsBefore)) {
				this.pastInfinitesComp.invalidate()
			}
		}

		componentWillUnmount() {
			this._cleanUp()
			if (this.intersectionObserver && this.props.isLiveSegment && this.props.followLiveSegments) {
				if (typeof this.props.onSegmentScroll === 'function') this.props.onSegmentScroll()
			}
			this.stopLive()
			window.removeEventListener(RundownViewEvents.rewindsegments, this.onRewindSegment)
		}

		onCollapseOutputToggle = (outputLayer: IOutputLayerUi) => {
			let collapsedOutputs = { ...this.state.collapsedOutputs }
			collapsedOutputs[outputLayer._id] =
				outputLayer.isDefaultCollapsed && collapsedOutputs[outputLayer._id] === undefined
					? false
					: collapsedOutputs[outputLayer._id] !== true
			UIStateStorage.setItem(
				`rundownView.${this.props.playlist._id}`,
				`segment.${this.props.segmentId}.outputs`,
				collapsedOutputs
			)
			this.setState({ collapsedOutputs })
		}
		onCollapseSegmentToggle = () => {
			UIStateStorage.setItem(
				`rundownView.${this.props.playlist._id}`,
				`segment.${this.props.segmentId}`,
				!this.state.collapsed
			)
			this.setState({ collapsed: !this.state.collapsed })
		}
		/** The user has scrolled scrollLeft seconds to the left in a child component */
		onScroll = (scrollLeft: number, event: any) => {
			this.setState({
				scrollLeft: scrollLeft,
				followLiveLine: false,
			})
			if (typeof this.props.onSegmentScroll === 'function') this.props.onSegmentScroll()
		}

		onRewindSegment = () => {
			if (!this.props.isLiveSegment) {
				this.setState({
					scrollLeft: 0,
				})
			}
		}

		onGoToPart = (e: CustomEvent<IGoToPartEvent>) => {
			if (this.props.segmentId === e.detail.segmentId) {
				const part = this.props.parts.find((part) => part.partId === e.detail.partId)
				if (part) {
					this.setState({
						scrollLeft: part.startsAt,
					})
				}
			}
		}

		onGoToPartInstance = (e: CustomEvent<IGoToPartInstanceEvent>) => {
			if (this.props.segmentId === e.detail.segmentId) {
				for (const part of this.props.parts) {
					if (part.instance._id === e.detail.partInstanceId) {
						this.setState({
							scrollLeft: part.startsAt,
						})
					}
				}
			}
		}

		onAirLineRefresh = (e: TimingEvent) => {
			if (this.props.isLiveSegment && this.props.currentLivePart) {
				const currentLivePart = this.props.currentLivePart.instance.part

				let simulationPercentage = this.playbackSimulationPercentage
				const partOffset =
					(this.context.durations &&
						this.context.durations.partDisplayStartsAt &&
						this.context.durations.partDisplayStartsAt[unprotectString(currentLivePart._id)] -
							this.context.durations.partDisplayStartsAt[unprotectString(this.props.parts[0].instance.part._id)]) ||
					0

				let isExpectedToPlay: boolean = currentLivePart.startedPlayback || false
				const lastTake = currentLivePart.getLastTake()
				const lastStartedPlayback = currentLivePart.getLastStartedPlayback()
				const lastTakeOffset = currentLivePart.getLastPlayOffset() || 0
				let virtualStartedPlayback =
					(lastTake || 0) > (lastStartedPlayback || -1)
						? lastTake
						: lastStartedPlayback
						? lastStartedPlayback - lastTakeOffset
						: undefined
				if (currentLivePart.taken && lastTake && lastTake + SIMULATED_PLAYBACK_HARD_MARGIN > e.detail.currentTime) {
					isExpectedToPlay = true

					// If we are between the SOFT_MARGIN and HARD_MARGIN and the take timing has already flowed through
					if (lastStartedPlayback && lastTake + SIMULATED_PLAYBACK_SOFT_MARGIN < e.detail.currentTime) {
						if (lastTake < lastStartedPlayback && simulationPercentage < 1) {
							virtualStartedPlayback =
								simulationPercentage * lastStartedPlayback + (1 - simulationPercentage) * lastTake
						}
					}
				}

				let newLivePosition =
					isExpectedToPlay && virtualStartedPlayback
						? partOffset + e.detail.currentTime - virtualStartedPlayback + lastTakeOffset
						: partOffset + lastTakeOffset

				if (lastStartedPlayback && simulationPercentage < 1) {
					this.playbackSimulationPercentage = Math.min(simulationPercentage + SIMULATED_PLAYBACK_CROSSFADE_STEP, 1)
				}

				//@ts-ignore
				this.setState({
					livePosition: newLivePosition,
					scrollLeft: this.state.followLiveLine
						? Math.max(newLivePosition - this.props.liveLineHistorySize / this.props.timeScale, 0)
						: this.state.scrollLeft,
				})
			}
		}

		visibleChanged = (entries: IntersectionObserverEntry[]) => {
			if (entries[0].intersectionRatio < 0.99 && !isMaintainingFocus() && Date.now() - this.mountedTime > 2000) {
				if (typeof this.props.onSegmentScroll === 'function') this.props.onSegmentScroll()
				this.isVisible = false
			} else {
				this.isVisible = true
			}
		}

		startLive = () => {
			window.addEventListener(RundownTiming.Events.timeupdateHR, this.onAirLineRefresh)
			// calculate the browser viewport zoom factor. Works perfectly in Chrome on Windows.
			const zoomFactor = window.outerWidth / window.innerWidth
			this.intersectionObserver = new IntersectionObserver(this.visibleChanged, {
				// As of Chrome 76, IntersectionObserver rootMargin works in screen pixels when root
				// is viewport. This seems like an implementation bug and IntersectionObserver is
				// an Experimental Feature in Chrome, so this might change in the future.
				rootMargin: `-${getHeaderHeight() * zoomFactor}px 0px -${20 * zoomFactor}px 0px`,
				threshold: [0, 0.25, 0.5, 0.75, 0.98],
			})
			this.intersectionObserver.observe(this.timelineDiv.parentElement!.parentElement!)
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
				scrollLeft: Math.max(this.state.livePosition - this.props.liveLineHistorySize / this.props.timeScale, 0),
			})

			/* if (this.state.followLiveLine) {
			this.debugDemoLiveLine()
		} */
		}

		segmentRef = (el: SegmentTimelineClass, segmentId: SegmentId) => {
			this.timelineDiv = el.timeline
		}

		onShowEntireSegment = (event: any) => {
			this.setState({
				scrollLeft: 0,
				followLiveLine: this.props.isLiveSegment ? false : this.state.followLiveLine,
			})
			if (typeof this.props.onTimeScaleChange === 'function') {
				this.props.onTimeScaleChange(
					(getElementWidth(this.timelineDiv) || 1) /
						(computeSegmentDuration(
							this.context.durations,
							this.props.parts.map((i) => i.instance.part._id),
							true
						) || 1)
				)
			}
			if (typeof this.props.onSegmentScroll === 'function') this.props.onSegmentScroll()
		}

		onZoomChange = (newScale: number, e: any) => {
			this.props.onTimeScaleChange && this.props.onTimeScaleChange(newScale)
		}

		render() {
			return (
				(this.props.segmentui && (
					<SegmentTimeline
						id={this.props.id}
						segmentRef={this.segmentRef}
						key={unprotectString(this.props.segmentui._id)}
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
						playlist={this.props.playlist}
						followLiveSegments={this.props.followLiveSegments}
						isLiveSegment={this.props.isLiveSegment}
						isNextSegment={this.props.isNextSegment}
						isQueuedSegment={this.props.playlist.nextSegmentId === this.props.segmentId}
						hasRemoteItems={this.props.hasRemoteItems}
						hasGuestItems={this.props.hasGuestItems}
						autoNextPart={this.props.autoNextPart}
						hasAlreadyPlayed={this.props.hasAlreadyPlayed}
						followLiveLine={this.state.followLiveLine}
						liveLineHistorySize={this.props.liveLineHistorySize}
						livePosition={this.state.livePosition}
						onContextMenu={this.props.onContextMenu}
						onFollowLiveLine={this.onFollowLiveLine}
						onShowEntireSegment={this.onShowEntireSegment}
						onZoomChange={this.onZoomChange}
						onScroll={this.onScroll}
						isLastSegment={this.props.isLastSegment}
						lastValidPartIndex={this.props.lastValidPartIndex}
						onHeaderNoteClick={this.props.onHeaderNoteClick}
					/>
				)) ||
				null
			)
		}
	}
)
