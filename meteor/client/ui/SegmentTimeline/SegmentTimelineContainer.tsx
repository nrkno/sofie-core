import * as React from 'react'
import * as PropTypes from 'prop-types'
import * as _ from 'underscore'
import { PieceLifespan } from '@sofie-automation/blueprints-integration'
import { SegmentTimeline, SegmentTimelineClass } from './SegmentTimeline'
import { computeSegmentDisplayDuration, RundownTiming, TimingEvent } from '../RundownView/RundownTiming/RundownTiming'
import { UIStateStorage } from '../../lib/UIStateStorage'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { PartExtended } from '../../../lib/Rundown'
import { MAGIC_TIME_SCALE_FACTOR } from '../RundownView'
import { SpeechSynthesiser } from '../../lib/speechSynthesis'
import { getElementWidth } from '../../utils/dimensions'
import { isMaintainingFocus, scrollToSegment, getHeaderHeight } from '../../lib/viewPort'
import { meteorSubscribe, PubSub } from '../../../lib/api/pubsub'
import { unprotectString, equalSets, equivalentArrays } from '../../../lib/lib'
import { Settings } from '../../../lib/Settings'
import { Tracker } from 'meteor/tracker'
import { Meteor } from 'meteor/meteor'
import RundownViewEventBus, {
	RundownViewEvents,
	GoToPartEvent,
	GoToPartInstanceEvent,
} from '../../../lib/api/triggers/RundownViewEventBus'
import { SegmentTimelinePartClass } from './Parts/SegmentTimelinePart'
import {
	PartUi,
	withResolvedSegment,
	IProps as IResolvedSegmentProps,
	ITrackedProps,
	IOutputLayerUi,
} from '../SegmentContainer/withResolvedSegment'
import { computeSegmentDuration, RundownTimingContext } from '../../lib/rundownTiming'
import { RundownViewShelf } from '../RundownView/RundownViewShelf'
import { PartInstanceId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PartInstances, Parts, Segments } from '../../collections'

// Kept for backwards compatibility
export { SegmentUi, PartUi, PieceUi, ISourceLayerUi, IOutputLayerUi } from '../SegmentContainer/withResolvedSegment'

export const SIMULATED_PLAYBACK_SOFT_MARGIN = 0
export const SIMULATED_PLAYBACK_HARD_MARGIN = 3500

export const LIVE_LINE_TIME_PADDING = 150
export const LIVELINE_HISTORY_SIZE = 100
export const TIMELINE_RIGHT_PADDING =
	// TODO: This is only temporary, for hands-on tweaking -- Jan Starzak, 2021-06-01
	parseInt(localStorage.getItem('EXP_timeline_right_padding')!) || LIVELINE_HISTORY_SIZE + LIVE_LINE_TIME_PADDING
const FALLBACK_ZOOM_FACTOR = MAGIC_TIME_SCALE_FACTOR
export let MINIMUM_ZOOM_FACTOR = FALLBACK_ZOOM_FACTOR

Meteor.startup(() => {
	MINIMUM_ZOOM_FACTOR = // TODO: This is only temporary, for hands-on tweaking -- Jan Starzak, 2021-06-01
		parseInt(localStorage.getItem('EXP_timeline_min_time_scale')!) ||
		MAGIC_TIME_SCALE_FACTOR * Settings.defaultTimeScale
})

interface IState {
	scrollLeft: number
	collapsedOutputs: {
		[key: string]: boolean
	}
	followLiveLine: boolean
	livePosition: number
	displayTimecode: number
	isLiveSegment: boolean
	isNextSegment: boolean
	currentLivePart: PartUi | undefined
	currentNextPart: PartUi | undefined
	autoNextPart: boolean
	budgetDuration: number | undefined
	budgetGap: number
	timeScale: number
	maxTimeScale: number
	showingAllSegment: boolean
}

interface IProps extends IResolvedSegmentProps {
	id: string
}

export const SegmentTimelineContainer = withResolvedSegment(
	class SegmentTimelineContainer extends MeteorReactComponent<IProps & ITrackedProps, IState> {
		static contextTypes = {
			durations: PropTypes.object.isRequired,
			syncedDurations: PropTypes.object.isRequired,
		}

		isVisible: boolean
		rundownCurrentPartInstanceId: PartInstanceId | null
		timelineDiv: HTMLDivElement
		intersectionObserver: IntersectionObserver | undefined
		mountedTime: number
		nextPartOffset: number

		private pastInfinitesComp: Tracker.Computation | undefined

		constructor(props: IProps & ITrackedProps) {
			super(props)

			this.state = {
				collapsedOutputs: UIStateStorage.getItemBooleanMap(
					`rundownView.${this.props.playlist._id}`,
					`segment.${props.segmentId}.outputs`,
					{}
				),
				scrollLeft: 0,
				followLiveLine: false,
				livePosition: 0,
				displayTimecode: 0,
				isLiveSegment: !!props.ownCurrentPartInstance,
				isNextSegment: !!props.ownNextPartInstance,
				autoNextPart: false,
				currentLivePart: undefined,
				currentNextPart: undefined,
				budgetDuration: undefined,
				budgetGap: 0,
				timeScale: props.timeScale,
				maxTimeScale: props.timeScale,
				showingAllSegment: true,
			}

			this.isVisible = false
		}

		shouldComponentUpdate(nextProps: IProps & ITrackedProps, nextState: IState) {
			return !_.isMatch(this.props, nextProps) || !_.isMatch(this.state, nextState)
		}

		componentDidMount(): void {
			this.autorun(() => {
				const partIds = Parts.find(
					{
						segmentId: this.props.segmentId,
					},
					{
						fields: {
							_id: 1,
						},
					}
				).map((part) => part._id)

				this.subscribe(PubSub.pieces, {
					startRundownId: this.props.rundownId,
					startPartId: {
						$in: partIds,
					},
				})
			})
			this.autorun(() => {
				const partInstanceIds = PartInstances.find(
					{
						segmentId: this.props.segmentId,
						reset: {
							$ne: true,
						},
					},
					{
						fields: {
							_id: 1,
							part: 1,
						},
					}
				).map((instance) => instance._id)
				this.subscribeToPieceInstances(partInstanceIds)
			})
			// past inifnites subscription
			this.pastInfinitesComp = this.autorun(() => {
				const segment = Segments.findOne(this.props.segmentId, {
					fields: {
						rundownId: 1,
						_rank: 1,
					},
				})
				segment &&
					this.subscribe(PubSub.pieces, {
						invalid: {
							$ne: true,
						},
						$or: [
							// same rundown, and previous segment
							{
								startRundownId: this.props.rundownId,
								startSegmentId: { $in: Array.from(this.props.segmentsIdsBefore.values()) },
								lifespan: {
									$in: [
										PieceLifespan.OutOnRundownEnd,
										PieceLifespan.OutOnRundownChange,
										PieceLifespan.OutOnShowStyleEnd,
									],
								},
							},
							// Previous rundown
							{
								startRundownId: { $in: Array.from(this.props.rundownIdsBefore.values()) },
								lifespan: {
									$in: [PieceLifespan.OutOnShowStyleEnd],
								},
							},
						],
					})
			})
			SpeechSynthesiser.init()

			this.rundownCurrentPartInstanceId = this.props.playlist.currentPartInstanceId
			if (this.state.isLiveSegment === true) {
				this.onFollowLiveLine(true)
				this.startLive()
			}
			RundownViewEventBus.on(RundownViewEvents.REWIND_SEGMENTS, this.onRewindSegment)
			RundownViewEventBus.on(RundownViewEvents.GO_TO_PART, this.onGoToPart)
			RundownViewEventBus.on(RundownViewEvents.GO_TO_PART_INSTANCE, this.onGoToPartInstance)
			window.requestAnimationFrame(() => {
				this.mountedTime = Date.now()
				if (this.state.isLiveSegment && this.props.followLiveSegments && !this.isVisible) {
					scrollToSegment(this.props.segmentId, true).catch((error) => {
						if (!error.toString().match(/another scroll/)) console.warn(error)
					})
				}
			})
			window.addEventListener('resize', this.onWindowResize)
			this.updateMaxTimeScale()
				.then(() => this.showEntireSegment())
				.catch(console.error)
		}

		componentDidUpdate(prevProps: IProps & ITrackedProps) {
			let isLiveSegment = false
			let isNextSegment = false
			let currentLivePart: PartExtended | undefined = undefined
			let currentNextPart: PartExtended | undefined = undefined

			let autoNextPart = false

			if (this.props.ownCurrentPartInstance && this.props.ownCurrentPartInstance.segmentId === this.props.segmentId) {
				isLiveSegment = true
				currentLivePart = this.props.parts.find((part) => part.instance._id === this.props.ownCurrentPartInstance?._id)
			}
			if (this.props.ownNextPartInstance) {
				isNextSegment = true
				currentNextPart = this.props.parts.find((part) => part.instance._id === this.props.ownNextPartInstance?._id)
			}
			autoNextPart = !!(
				currentLivePart &&
				currentLivePart.instance.part.autoNext &&
				currentLivePart.instance.part.expectedDuration
			)
			if (isNextSegment && !isLiveSegment && !autoNextPart && this.props.ownCurrentPartInstance) {
				if (
					this.props.ownCurrentPartInstance &&
					this.props.ownCurrentPartInstance.part.expectedDuration &&
					this.props.ownCurrentPartInstance.part.autoNext
				) {
					autoNextPart = true
				}
			}

			this.rundownCurrentPartInstanceId = this.props.playlist.currentPartInstanceId

			// segment is becoming live
			if (this.state.isLiveSegment === false && isLiveSegment === true) {
				this.setState({ isLiveSegment: true })
				this.onFollowLiveLine(true)
				this.startLive()
			}
			// segment is stopping from being live
			if (this.state.isLiveSegment === true && isLiveSegment === false) {
				this.setState({ isLiveSegment: false }, () => {
					if (Settings.autoRewindLeavingSegment) {
						this.onRewindSegment()
						this.onShowEntireSegment()
					}
				})
				this.stopLive()
			}

			// Setting the correct scroll position on parts when setting is next
			const nextPartDisplayStartsAt =
				currentNextPart &&
				this.context.durations?.partDisplayStartsAt &&
				this.context.durations.partDisplayStartsAt[unprotectString(currentNextPart.partId)]
			const partOffset =
				nextPartDisplayStartsAt -
				(this.props.parts.length > 0
					? this.context.durations.partDisplayStartsAt[unprotectString(this.props.parts[0].instance.part._id)] ?? 0
					: 0)
			const nextPartIdOrOffsetHasChanged =
				currentNextPart &&
				this.props.playlist.nextPartInstanceId &&
				(prevProps.playlist.nextPartInstanceId !== this.props.playlist.nextPartInstanceId ||
					this.nextPartOffset !== partOffset)
			const isBecomingNextSegment = this.state.isNextSegment === false && isNextSegment
			// the segment isn't live, will be next, and either the nextPartId has changed or it is just becoming next
			if (
				!isLiveSegment &&
				isNextSegment &&
				currentNextPart &&
				(nextPartIdOrOffsetHasChanged || isBecomingNextSegment)
			) {
				const timelineWidth = this.timelineDiv instanceof HTMLElement ? getElementWidth(this.timelineDiv) : 0 // unsure if this is a good default/substitute
				// If part is not within viewport scroll to its start
				if (
					this.state.scrollLeft > partOffset ||
					this.state.scrollLeft * this.state.timeScale + timelineWidth < partOffset * this.state.timeScale
				) {
					this.setState({
						scrollLeft: partOffset,
					})
				}
				this.nextPartOffset = partOffset
			}

			// rewind all scrollLeft's to 0 on rundown activate
			if (
				this.props.playlist &&
				this.props.playlist.activationId &&
				prevProps.playlist &&
				!prevProps.playlist.activationId
			) {
				this.setState({
					scrollLeft: 0,
				})
			} else if (
				this.props.playlist &&
				!this.props.playlist.activationId &&
				prevProps.playlist &&
				prevProps.playlist.activationId
			) {
				this.setState({
					livePosition: 0,
				})
			}

			if (this.props.followLiveSegments && !prevProps.followLiveSegments) {
				this.onFollowLiveLine(true)
			}

			if (
				this.pastInfinitesComp &&
				(!equalSets(this.props.segmentsIdsBefore, prevProps.segmentsIdsBefore) ||
					!_.isEqual(this.props.rundownIdsBefore, prevProps.rundownIdsBefore))
			) {
				this.pastInfinitesComp.invalidate()
			}

			const budgetDuration = this.getSegmentBudgetDuration()

			if (!isLiveSegment && this.props.parts !== prevProps.parts) {
				this.updateMaxTimeScale().catch(console.error)
			}

			if (!isLiveSegment && this.props.parts !== prevProps.parts && this.state.showingAllSegment) {
				this.showEntireSegment()
			}

			this.setState({
				isLiveSegment,
				isNextSegment,
				currentLivePart,
				currentNextPart,
				autoNextPart,
				budgetDuration,
			})
		}

		componentWillUnmount(): void {
			this._cleanUp()
			if (this.intersectionObserver && this.state.isLiveSegment && this.props.followLiveSegments) {
				if (typeof this.props.onSegmentScroll === 'function') this.props.onSegmentScroll()
			}
			if (this.partInstanceSub !== undefined) {
				const sub = this.partInstanceSub
				setTimeout(() => {
					sub.stop()
				}, 500)
			}
			this.stopLive()
			RundownViewEventBus.off(RundownViewEvents.REWIND_SEGMENTS, this.onRewindSegment)
			RundownViewEventBus.off(RundownViewEvents.GO_TO_PART, this.onGoToPart)
			RundownViewEventBus.off(RundownViewEvents.GO_TO_PART_INSTANCE, this.onGoToPartInstance)
			window.removeEventListener('resize', this.onWindowResize)
		}

		private getSegmentBudgetDuration(): number | undefined {
			let duration = 0
			let anyBudgetDurations = false
			for (const part of this.props.parts) {
				if (part.instance.part.budgetDuration !== undefined) {
					anyBudgetDurations = true
					duration += part.instance.part.budgetDuration
				}
			}
			if (anyBudgetDurations) {
				return duration
			}
			return undefined
		}

		private partInstanceSub: Meteor.SubscriptionHandle | undefined
		private partInstanceSubPartInstanceIds: PartInstanceId[] | undefined
		private subscribeToPieceInstancesInner = (partInstanceIds: PartInstanceId[]) => {
			this.partInstanceSubDebounce = undefined
			if (
				this.partInstanceSubPartInstanceIds &&
				equivalentArrays(this.partInstanceSubPartInstanceIds, partInstanceIds)
			) {
				// old subscription is equivalent to the new one, don't do anything
				return
			}
			// avoid having the subscription automatically scrapped by a re-run of the autorun
			Tracker.nonreactive(() => {
				if (this.partInstanceSub !== undefined) {
					this.partInstanceSub.stop()
				}
				// we handle this subscription manually
				this.partInstanceSub = meteorSubscribe(PubSub.pieceInstances, {
					rundownId: this.props.rundownId,
					partInstanceId: {
						$in: partInstanceIds,
					},
					reset: {
						$ne: true,
					},
				})
				this.partInstanceSubPartInstanceIds = partInstanceIds
			})
		}
		private partInstanceSubDebounce: number | undefined
		private subscribeToPieceInstances(partInstanceIds: PartInstanceId[]) {
			// run the first subscribe immediately, to avoid unneccessary wait time during bootup
			if (this.partInstanceSub === undefined) {
				this.subscribeToPieceInstancesInner(partInstanceIds)
			} else {
				if (this.partInstanceSubDebounce !== undefined) {
					clearTimeout(this.partInstanceSubDebounce)
				}
				this.partInstanceSubDebounce = setTimeout(this.subscribeToPieceInstancesInner, 40, partInstanceIds)
			}
		}

		onWindowResize = _.throttle(() => {
			if (this.state.showingAllSegment) {
				this.updateMaxTimeScale()
					.then(() => this.showEntireSegment())
					.catch(console.error)
			}
		}, 250)

		onTimeScaleChange = (timeScaleVal: number) => {
			if (Number.isFinite(timeScaleVal) && timeScaleVal > 0) {
				this.setState((state) => ({
					timeScale: timeScaleVal,
					showingAllSegment: timeScaleVal === state.maxTimeScale,
				}))
			}
		}

		onCollapseOutputToggle = (outputLayer: IOutputLayerUi) => {
			const collapsedOutputs = { ...this.state.collapsedOutputs }
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
		/** The user has scrolled scrollLeft seconds to the left in a child component */
		onScroll = (scrollLeft: number) => {
			this.setState({
				scrollLeft: Math.max(
					0,
					Math.min(
						scrollLeft,
						(computeSegmentDuration(
							this.context.durations,
							this.props.parts.map((i) => i.instance.part._id),
							true
						) || 1) -
							LIVELINE_HISTORY_SIZE / this.state.timeScale
					)
				),
				followLiveLine: false,
			})
			if (typeof this.props.onSegmentScroll === 'function') this.props.onSegmentScroll()
		}

		onRewindSegment = () => {
			if (!this.state.isLiveSegment) {
				this.updateMaxTimeScale()
					.then(() => {
						this.showEntireSegment()
						this.setState({
							scrollLeft: 0,
							livePosition: 0,
						})
					})
					.catch(console.error)
			}
		}

		onGoToPartInner = (part: PartUi, _timingDurations: RundownTimingContext, zoomInToFit?: boolean) => {
			this.setState((state) => {
				let newScale: number | undefined

				let scrollLeft = state.scrollLeft

				if (zoomInToFit) {
					const timelineWidth = this.timelineDiv instanceof HTMLElement ? getElementWidth(this.timelineDiv) : 0 // unsure if this is good default/substitute
					newScale =
						(Math.max(0, timelineWidth - TIMELINE_RIGHT_PADDING * 2) / 3 || 1) /
						(SegmentTimelinePartClass.getPartDisplayDuration(part, this.context?.durations) || 1)

					scrollLeft = Math.max(0, scrollLeft - TIMELINE_RIGHT_PADDING / newScale)
				}

				return {
					scrollLeft,
					timeScale: newScale ?? state.timeScale,
					showingAllSegment: newScale !== undefined ? false : state.showingAllSegment,
				}
			})
		}

		onGoToPart = (e: GoToPartEvent) => {
			if (this.props.segmentId === e.segmentId) {
				const timingDurations = this.context?.durations as RundownTimingContext

				const part = this.props.parts.find((part) => part.partId === e.partId)
				if (part) {
					this.onGoToPartInner(part, timingDurations, e.zoomInToFit)
				}
			}
		}

		onGoToPartInstance = (e: GoToPartInstanceEvent) => {
			if (this.props.segmentId === e.segmentId) {
				const timingDurations = this.context?.durations as RundownTimingContext

				const part = this.props.parts.find((part) => part.instance._id === e.partInstanceId)

				if (part) {
					this.onGoToPartInner(part, timingDurations, e.zoomInToFit)
				}
			}
		}

		onAirLineRefresh = (e: TimingEvent) => {
			this.setState((state) => {
				if (state.isLiveSegment && state.currentLivePart) {
					const currentLivePartInstance = state.currentLivePart.instance
					const currentLivePart = currentLivePartInstance.part

					const partOffset =
						(this.context.durations?.partDisplayStartsAt?.[unprotectString(currentLivePart._id)] || 0) -
						(this.context.durations?.partDisplayStartsAt?.[unprotectString(this.props.parts[0]?.instance.part._id)] ||
							0)

					let isExpectedToPlay = !!currentLivePartInstance.timings?.plannedStartedPlayback
					const lastTake = currentLivePartInstance.timings?.take
					const lastStartedPlayback = currentLivePartInstance.timings?.plannedStartedPlayback
					const lastTakeOffset = currentLivePartInstance.timings?.playOffset || 0
					const virtualStartedPlayback =
						(lastTake || 0) > (lastStartedPlayback || -1)
							? lastTake
							: lastStartedPlayback !== undefined
							? lastStartedPlayback - lastTakeOffset
							: undefined

					if (lastTake && lastTake + SIMULATED_PLAYBACK_HARD_MARGIN > e.detail.currentTime) {
						isExpectedToPlay = true
					}

					const newLivePosition =
						isExpectedToPlay && virtualStartedPlayback
							? partOffset + e.detail.currentTime - virtualStartedPlayback + lastTakeOffset
							: partOffset + lastTakeOffset

					const budgetDuration = this.getSegmentBudgetDuration()

					return {
						livePosition: newLivePosition,
						scrollLeft: state.followLiveLine
							? Math.max(newLivePosition - LIVELINE_HISTORY_SIZE / state.timeScale, 0)
							: state.scrollLeft,
						budgetDuration,
					}
				}
				return null
			})
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
			window.addEventListener(RundownTiming.Events.timeupdateHighResolution, this.onAirLineRefresh)
			// As of Chrome 76, IntersectionObserver rootMargin works in screen pixels when root
			// is viewport. This seems like an implementation bug and IntersectionObserver is
			// an Experimental Feature in Chrome, so this might change in the future.
			// Additionally, it seems that the screen scale factor needs to be taken into account as well
			const zoomFactor = window.outerWidth / window.innerWidth / window.devicePixelRatio
			this.intersectionObserver = new IntersectionObserver(this.visibleChanged, {
				rootMargin: `-${getHeaderHeight() * zoomFactor}px 0px -${20 * zoomFactor}px 0px`,
				threshold: [0, 0.25, 0.5, 0.75, 0.98],
			})
			this.intersectionObserver.observe(this.timelineDiv.parentElement!)
		}

		stopLive = () => {
			window.removeEventListener(RundownTiming.Events.timeupdateHighResolution, this.onAirLineRefresh)
			if (this.intersectionObserver) {
				this.intersectionObserver.disconnect()
				this.intersectionObserver = undefined
			}
		}

		onFollowLiveLine = (state: boolean) => {
			this.setState({
				followLiveLine: state,
				scrollLeft: Math.max(this.state.livePosition - LIVELINE_HISTORY_SIZE / this.state.timeScale, 0),
			})
		}

		segmentRef = (el: SegmentTimelineClass, _segmentId: SegmentId) => {
			this.timelineDiv = el.timeline
		}

		getShowAllTimeScale = () => {
			if (!this.timelineDiv || isLiveSegmentButLivePositionNotSet(this.state.isLiveSegment, this.state.livePosition)) {
				return this.state.maxTimeScale
			}

			let calculatedTimelineDivWidth = 1
			if (this.timelineDiv instanceof HTMLElement) {
				calculatedTimelineDivWidth = getElementWidth(this.timelineDiv) - TIMELINE_RIGHT_PADDING || 1
			}

			const segmentDisplayDuration: number =
				computeSegmentDisplayDuration(this.context.durations, this.props.parts) || 1
			const livePosition = this.state.isLiveSegment ? this.state.livePosition : 0

			let newScale = calculatedTimelineDivWidth / (segmentDisplayDuration - livePosition)
			newScale = Math.min(MINIMUM_ZOOM_FACTOR, newScale)
			if (!Number.isFinite(newScale) || newScale === 0) {
				newScale = FALLBACK_ZOOM_FACTOR
			}
			return newScale
		}

		updateMaxTimeScale = () => {
			return new Promise<number>((resolve) =>
				this.setState(
					() => {
						const maxTimeScale = this.getShowAllTimeScale()
						return {
							maxTimeScale,
						}
					},
					() => resolve(this.state.maxTimeScale)
				)
			)
		}

		showEntireSegment = () => {
			this.updateMaxTimeScale()
				.then(() => {
					this.onTimeScaleChange(this.getShowAllTimeScale())
				})
				.catch(console.error)
		}

		onShowEntireSegment = () => {
			this.setState({
				scrollLeft: 0,
				followLiveLine: this.state.isLiveSegment ? true : this.state.followLiveLine,
			})
			this.showEntireSegment()
		}

		onZoomChange = (newScale: number) => {
			this.onTimeScaleChange(newScale)
		}

		render(): JSX.Element | null {
			return this.props.segmentui ? (
				<React.Fragment key={unprotectString(this.props.segmentui._id)}>
					{!this.props.segmentui.isHidden && (
						<SegmentTimeline
							id={this.props.id}
							segmentRef={this.segmentRef}
							key={unprotectString(this.props.segmentui._id)}
							segment={this.props.segmentui}
							studio={this.props.studio}
							parts={this.props.parts}
							segmentNoteCounts={this.props.segmentNoteCounts}
							timeScale={this.state.timeScale}
							maxTimeScale={this.state.maxTimeScale}
							onRecalculateMaxTimeScale={this.updateMaxTimeScale}
							showingAllSegment={this.state.showingAllSegment}
							onItemClick={this.props.onPieceClick}
							onItemDoubleClick={this.props.onPieceDoubleClick}
							onCollapseOutputToggle={this.onCollapseOutputToggle}
							collapsedOutputs={this.state.collapsedOutputs}
							scrollLeft={this.state.scrollLeft}
							playlist={this.props.playlist}
							followLiveSegments={this.props.followLiveSegments}
							isLiveSegment={this.state.isLiveSegment}
							isNextSegment={this.state.isNextSegment}
							isQueuedSegment={this.props.playlist.nextSegmentId === this.props.segmentId}
							hasRemoteItems={this.props.hasRemoteItems}
							hasGuestItems={this.props.hasGuestItems}
							autoNextPart={this.state.autoNextPart}
							hasAlreadyPlayed={this.props.hasAlreadyPlayed}
							followLiveLine={this.state.followLiveLine}
							liveLineHistorySize={LIVELINE_HISTORY_SIZE}
							livePosition={this.state.livePosition}
							displayLiveLineCounter={this.props.displayLiveLineCounter}
							onContextMenu={this.props.onContextMenu}
							onFollowLiveLine={this.onFollowLiveLine}
							onShowEntireSegment={this.onShowEntireSegment}
							onZoomChange={this.onZoomChange}
							onSwitchViewMode={this.props.onSwitchViewMode}
							onScroll={this.onScroll}
							isLastSegment={this.props.isLastSegment}
							lastValidPartIndex={this.props.lastValidPartIndex}
							onHeaderNoteClick={this.props.onHeaderNoteClick}
							budgetDuration={this.props.budgetDuration}
							showCountdownToSegment={this.props.showCountdownToSegment}
							fixedSegmentDuration={this.props.fixedSegmentDuration}
							showDurationSourceLayers={this.props.showDurationSourceLayers}
						/>
					)}
					{this.props.segmentui.showShelf && this.props.adLibSegmentUi && (
						<RundownViewShelf
							studio={this.props.studio}
							segment={this.props.segmentui}
							playlist={this.props.playlist}
							showStyleBase={this.props.showStyleBase}
							adLibSegmentUi={this.props.adLibSegmentUi}
							hotkeyGroup={unprotectString(this.props.segmentui._id) + '_RundownViewShelf'}
							miniShelfFilter={this.props.miniShelfFilter}
							studioMode={this.props.studioMode}
						/>
					)}
				</React.Fragment>
			) : null
		}
	}
)

function isLiveSegmentButLivePositionNotSet(isLiveSegment: boolean, livePosition: number): boolean {
	return isLiveSegment && livePosition === 0
}
