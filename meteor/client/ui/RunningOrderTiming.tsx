import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import * as PropTypes from 'prop-types'
import * as _ from 'underscore'
import { withTracker } from '../lib/ReactMeteorData/react-meteor-data'

import { RunningOrder, RunningOrders } from '../../lib/collections/RunningOrders'
import { Segment, Segments } from '../../lib/collections/Segments'
import { SegmentTimelineContainer, SegmentLineItemUi, SegmentUi } from './SegmentTimeline/SegmentTimelineContainer'
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

const TIMING_DEFAULT_REFRESH_INTERVAL = 250

interface IRunningOrderTimingProviderProps {
	runningOrder: RunningOrder
	segmentLines: Array<SegmentLine>
	refreshInterval?: number
}
interface IRunningOrderTimingProviderChildContext {
	durations: RunningOrderTiming.RunningOrderTimingContext
}

export const RunningOrderTimingProvider = withTracker((props, state) => {
	if (props.runningOrder) {
		let segmentLines = SegmentLines.find({
			'runningOrderId': props.runningOrder._id,
		}, {
			sort: {
				'_rank': 1
			}
		}).fetch()

		return {
			segmentLines
		}
	} else {
		return {}
	}
})(class extends React.Component<IRunningOrderTimingProviderProps> implements React.ChildContextProvider<IRunningOrderTimingProviderChildContext> {
	static childContextTypes = {
		durations: PropTypes.object.isRequired
	}

	durations: RunningOrderTiming.RunningOrderTimingContext = {}
	refreshTimer: NodeJS.Timer
	refreshTimerInterval: number

	constructor (props) {
		super(props)

		if (props.refreshInterval && _.isNumber(props.refreshInterval)) {
			this.refreshTimerInterval = props.refreshInverval
		} else {
			this.refreshTimerInterval = TIMING_DEFAULT_REFRESH_INTERVAL
		}
	}

	getChildContext (): IRunningOrderTimingProviderChildContext {
		return {
			durations: this.durations
		}
	}

	componentDidMount () {
		this.refreshTimer = setInterval(() => {
			this.updateDurations()
		}, this.refreshTimerInterval)
	}

	componentWillReceiveProps (nextProps) {
		// change refresh interval if needed
		if (this.refreshTimerInterval !== nextProps.refreshInterval && _.isNumber(nextProps.refreshInterval) && this.refreshTimer) {
			this.refreshTimerInterval = nextProps.refreshInterval
			clearInterval(this.refreshTimer)
			this.refreshTimer = setInterval(() => {
				this.updateDurations()

				const event = new Event(RunningOrderTiming.Events.timeupdate)
				window.dispatchEvent(event)
			}, this.refreshTimerInterval)
		}
	}

	componentWillUnmount () {
		clearInterval(this.refreshTimer)
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

export function withTiming (options?) {
	let expandedOptions = _.extend({
		isHighResolution: false
	}, options)

	return (WrappedComponent) => (
		class WithTimingHOCComponent extends React.Component {
			static contextTypes = {
				durations: PropTypes.object.isRequired
			}

			constructor (props, context) {
				super(props, context)
			}

			componentDidMount () {
				window.addEventListener(RunningOrderTiming.Events.timeupdate, this.refreshComponent)
			}

			componentWillUnmount () {
				window.removeEventListener(RunningOrderTiming.Events.timeupdate, this.refreshComponent)
			}

			refreshComponent = () => {
				this.forceUpdate()
			}

			render () {
				const { durations } = this.context

				return <WrappedComponent { ...this.props } timingDurations={durations} />
			}
		}
	)
}

interface ISegmentLineCountdownProps {
	segmentLineId: string
	timingDurations: RunningOrderTiming.RunningOrderTimingContext
}
export const SegmentLineCountdown = withTiming()((props: ISegmentLineCountdownProps) => (
	<span>
		{props.segmentLineId && props.timingDurations && props.timingDurations.segmentLineCountdown && RundownUtils.formatTimeToTimecode(props.timingDurations.segmentLineCountdown[props.segmentLineId]).substr(3, 5)}
	</span>
))

interface ISegmentLineCountdownProps {
	segmentLineIds: Array<string>
	timingDurations: RunningOrderTiming.RunningOrderTimingContext
}
export const SegmentDuration = withTiming()((props: ISegmentLineCountdownProps) => (
	<span>
		{props.segmentLineIds && props.timingDurations && props.timingDurations.segmentLineDurations && RundownUtils.formatTimeToTimecode(props.segmentLineIds.reduce((memo, item) => {
			return memo + props.timingDurations!.segmentLineDurations![item]
		}, 0))}
	</span>
))