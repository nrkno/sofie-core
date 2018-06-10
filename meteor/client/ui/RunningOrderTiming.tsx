import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import * as PropTypes from 'prop-types'
import * as _ from 'underscore'
import { withTracker } from '../lib/ReactMeteorData/react-meteor-data'

import { RunningOrder, RunningOrders } from '../../lib/collections/RunningOrders'
import { Segment, Segments } from '../../lib/collections/Segments'
import { SegmentLineItemUi, SegmentUi } from './SegmentTimeline/SegmentTimelineContainer'
import { SegmentContextMenu } from './SegmentTimeline/SegmentContextMenu'
import { StudioInstallation, StudioInstallations } from '../../lib/collections/StudioInstallations'
import { SegmentLine, SegmentLines } from '../../lib/collections/SegmentLines'

import timer from 'react-timer-hoc'
import { getCurrentTime } from '../../lib/lib'

import { RundownUtils } from '../lib/rundown'

export namespace RunningOrderTiming {
	export enum Events {
		'timeupdate'		= 'sofie:roTimeUpdate',
		'timeupdateHR'		= 'sofie:roTimeUpdateHR'
	}

	export interface RunningOrderTimingContext {
		totalRundownDuration?: number
		remainingRundownDuration?: number
		asPlayedRundownDuration?: number
		segmentLineCountdown?: {
			[key: string]: number
		}
		segmentLineDurations?: {
			[key: string]: number
		}
		segmentLineStartsAt?: {
			[key: string]: number
		}
	}

	export interface InjectedROTimingProps {
		timingDurations: RunningOrderTimingContext
	}
}

const TIMING_DEFAULT_REFRESH_INTERVAL = 1000 / 60

interface IRunningOrderTimingProviderProps {
	runningOrder?: RunningOrder
	// segmentLines: Array<SegmentLine>
	refreshInterval?: number
}
interface IRunningOrderTimingProviderChildContext {
	durations: RunningOrderTiming.RunningOrderTimingContext
}
interface IRunningOrderTimingProviderState {
}
interface IRunningOrderTimingProviderTrackedProps {
	segmentLines: Array<SegmentLine>
}

export const RunningOrderTimingProvider = withTracker<IRunningOrderTimingProviderProps, IRunningOrderTimingProviderState, IRunningOrderTimingProviderTrackedProps>(
(props, state) => {
	let segmentLines: Array<SegmentLine> = []
	if (props.runningOrder) {
		segmentLines = SegmentLines.find({
			'runningOrderId': props.runningOrder._id,
		}, {
			sort: {
				'_rank': 1
			}
		}).fetch()
	}
	return {
		segmentLines
	}
})(class extends React.Component<IRunningOrderTimingProviderProps & IRunningOrderTimingProviderTrackedProps, IRunningOrderTimingProviderState> implements React.ChildContextProvider<IRunningOrderTimingProviderChildContext> {
	static childContextTypes = {
		durations: PropTypes.object.isRequired
	}

	durations: RunningOrderTiming.RunningOrderTimingContext = {}
	refreshTimer: number
	refreshTimerInterval: number
	refreshDecimator: number

	constructor (props) {
		super(props)

		if (props.refreshInterval && _.isNumber(props.refreshInterval)) {
			this.refreshTimerInterval = props.refreshInverval
		} else {
			this.refreshTimerInterval = TIMING_DEFAULT_REFRESH_INTERVAL
		}

		this.refreshDecimator = 15
	}

	getChildContext (): IRunningOrderTimingProviderChildContext {
		return {
			durations: this.durations
		}
	}

	onRefreshTimer = () => {
		this.updateDurations()

		this.dispatchHREvent()

		this.refreshDecimator++
		if (this.refreshDecimator % 15 === 0) {
			this.dispatchEvent()
		}
	}

	componentDidMount () {
		this.refreshTimer = Meteor.setInterval(this.onRefreshTimer, this.refreshTimerInterval)
	}

	componentWillReceiveProps (nextProps) {
		// change refresh interval if needed
		if (this.refreshTimerInterval !== nextProps.refreshInterval && _.isNumber(nextProps.refreshInterval) && this.refreshTimer) {
			this.refreshTimerInterval = nextProps.refreshInterval
			Meteor.clearInterval(this.refreshTimer)
			this.refreshTimer = Meteor.setInterval(this.onRefreshTimer, this.refreshTimerInterval)
		}
	}

	componentWillUnmount () {
		Meteor.clearInterval(this.refreshTimer)
	}

	dispatchHREvent () {
		const event = new Event(RunningOrderTiming.Events.timeupdateHR)
		window.dispatchEvent(event)
	}

	dispatchEvent () {
		const event = new Event(RunningOrderTiming.Events.timeupdate)
		window.dispatchEvent(event)
	}

	updateDurations () {
		let totalRundownDuration = 0
		let remainingRundownDuration = 0
		let asPlayedRundownDuration = 0
		let waitAccumulator = 0
		let currentRemaining = 0
		let startsAtAccumulator = 0

		const { runningOrder, segmentLines } = this.props
		const linearSegLines: Array<[string, number | null]> = []
		const segLineDurations: {
			[key: string]: number
		} = {}
		const segLineStartsAt: {
			[key: string]: number
		} = {}

		let nextAIndex = -1
		let curAIndex = -1

		let now = getCurrentTime()

		if (runningOrder && segmentLines) {
			segmentLines.forEach((item, itIndex) => {
				// add segmentLineItem to accumulator
				const aIndex = linearSegLines.push([item._id, waitAccumulator]) - 1

				// if this is next segementLine, clear previous countdowns and clear accumulator
				if (runningOrder.nextSegmentLineId === item._id) {
					nextAIndex = aIndex
				}

				// expected is just a sum of expectedDurations
				totalRundownDuration += item.expectedDuration || 0

				// asPlayed is the actual duration so far and expected durations in unplayed lines
				// item is onAir right now, and it's already taking longer than rendered/expectedDuration
				if (item.startedPlayback && !item.duration && runningOrder.currentSegmentLineId === item._id && item.startedPlayback + (item.expectedDuration || 0) < now) {
					asPlayedRundownDuration += (now - item.startedPlayback)
				} else {
					asPlayedRundownDuration += (item.duration || item.expectedDuration || 0)
				}

				if (item.startedPlayback && !item.duration && runningOrder.currentSegmentLineId === item._id) {
					currentRemaining = Math.max(0, (item.duration || item.expectedDuration || 0) - (now - item.startedPlayback))
					segLineDurations[item._id] = Math.max((item.duration || item.expectedDuration || 0), (now - item.startedPlayback))
				} else {
					segLineDurations[item._id] = item.duration || item.expectedDuration || 0
				}
				segLineStartsAt[item._id] = startsAtAccumulator
				startsAtAccumulator += segLineDurations[item._id]
				// always add the full duration, in case by some manual intervention this segment should play twice
				waitAccumulator += (item.duration || item.expectedDuration || 0)

				// remaining is the sum of unplayed lines + whatever is left of the current segment
				if (!item.startedPlayback) {
					remainingRundownDuration += item.expectedDuration || 0
					// item is onAir right now, and it's is currently shorter than expectedDuration
				} else if (item.startedPlayback && !item.duration && runningOrder.currentSegmentLineId === item._id && item.startedPlayback + (item.expectedDuration || 0) > now) {
					// console.log((now - item.startedPlayback))
					remainingRundownDuration += (item.expectedDuration || 0) - (now - item.startedPlayback)
				}
			})

			let localAccum = 0
			for (let i = 0; i < linearSegLines.length; i++) {
				if (i < nextAIndex) {
					localAccum += linearSegLines[i][1] || 0
					linearSegLines[i][1] = null
				} else if (i === nextAIndex) {
					// localAccum += linearSegLines[i][1] || 0
					linearSegLines[i][1] = currentRemaining
				} else {
					linearSegLines[i][1] = (linearSegLines[i][1] || 0) - localAccum + currentRemaining
				}
			}
		}

		// console.log(linearSegLines.map((value) => value[1]))

		this.durations = _.extend(this.durations, {
			totalRundownDuration,
			remainingRundownDuration,
			asPlayedRundownDuration,
			segmentLineCountdown: _.object(linearSegLines),
			segmentLineDurations: segLineDurations,
			segmentLineStartsAt: segLineStartsAt
		})
	}

	render () {
		return this.props.children
	}
})

export interface WithTimingOptions {
	isHighResolution?: boolean
}
export type WithTiming<T> = T & RunningOrderTiming.InjectedROTimingProps
type IWrappedComponent<IProps, IState> = new (props: WithTiming<IProps>, state: IState) => React.Component<WithTiming<IProps>, IState>

export function withTiming<IProps, IState> (options?: WithTimingOptions):
	(WrappedComponent: IWrappedComponent<IProps, IState>) =>
		new (props: IProps, context: any ) => React.Component<IProps, IState> {
	let expandedOptions: WithTimingOptions = _.extend({
		isHighResolution: false
	}, options)

	return (WrappedComponent) => {
		return class WithTimingHOCComponent extends React.Component<IProps, IState> {
			static contextTypes = {
				durations: PropTypes.object.isRequired
			}

			constructor (props, context) {
				super(props, context)
			}

			componentDidMount () {
				window.addEventListener(
					expandedOptions.isHighResolution ?
						RunningOrderTiming.Events.timeupdateHR :
						RunningOrderTiming.Events.timeupdate
				, this.refreshComponent)
			}

			componentWillUnmount () {
				window.removeEventListener(
					expandedOptions.isHighResolution ?
						RunningOrderTiming.Events.timeupdateHR :
						RunningOrderTiming.Events.timeupdate
					, this.refreshComponent)
			}

			refreshComponent = () => {
				this.forceUpdate()
			}

			render () {
				const durations: RunningOrderTiming.RunningOrderTimingContext
					= this.context.durations

				const allProps: WithTiming<IProps> = _.extend({
					timingDurations: durations
				}, this.props)
				return <WrappedComponent { ...allProps } />
			}
		}
	}
}

interface ISegmentLineCountdownProps {
	segmentLineId?: string
	timingDurations?: RunningOrderTiming.RunningOrderTimingContext
}
interface ISegmentLineCountdownState {
}
export const SegmentLineCountdown = withTiming<ISegmentLineCountdownProps, ISegmentLineCountdownState>()(
class extends React.Component<WithTiming<ISegmentLineCountdownProps>, ISegmentLineCountdownState> {
	render () {
		return <span>
			{this.props.segmentLineId &&
				this.props.timingDurations &&
				this.props.timingDurations.segmentLineCountdown &&
				this.props.timingDurations.segmentLineCountdown[this.props.segmentLineId] !== undefined &&
					RundownUtils.formatTimeToShortTime(this.props.timingDurations.segmentLineCountdown[this.props.segmentLineId])}
		</span>
	}
})
interface ISegmentDurationProps {
	segmentLineIds: Array<string>
	timingDurations?: RunningOrderTiming.RunningOrderTimingContext
}
interface ISegmentDurationState {
}
export const SegmentDuration = withTiming<ISegmentDurationProps, ISegmentDurationState>()(
	class extends React.Component<WithTiming<ISegmentDurationProps>, ISegmentDurationState> {
		render () {
			return <span>
				{this.props.segmentLineIds &&
					this.props.timingDurations &&
					this.props.timingDurations.segmentLineDurations &&
						RundownUtils.formatTimeToTimecode(this.props.segmentLineIds.reduce((memo, item) => {
							return this.props.timingDurations!.segmentLineDurations![item] !== undefined ?
								memo + this.props.timingDurations!.segmentLineDurations![item] :
								memo
						}, 0))}
			</span>
		}
	})
