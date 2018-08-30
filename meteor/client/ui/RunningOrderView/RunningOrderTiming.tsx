import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import * as PropTypes from 'prop-types'
import * as _ from 'underscore'
import { withTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { RunningOrder } from '../../../lib/collections/RunningOrders'
import { SegmentLine, SegmentLines } from '../../../lib/collections/SegmentLines'
import { getCurrentTime } from '../../../lib/lib'
import { RundownUtils } from '../../lib/rundown'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'

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
		segmentLineDisplayStartsAt?: {
			[key: string]: number
		}
		segmentLinePlayed?: {
			[key: string]: number
		}
		segmentLineExpectedDurations?: {
			[key: string]: number
		}
	}

	export interface InjectedROTimingProps {
		timingDurations: RunningOrderTimingContext
	}
}

const TIMING_DEFAULT_REFRESH_INTERVAL = 1000 / 60
const LOW_RESOLUTION_TIMING_DECIMATOR = 15

interface IRunningOrderTimingProviderProps {
	runningOrder?: RunningOrder
	// segmentLines: Array<SegmentLine>
	refreshInterval?: number
	defaultDuration?: number
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
(props) => {
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
})(class extends MeteorReactComponent<IRunningOrderTimingProviderProps & IRunningOrderTimingProviderTrackedProps, IRunningOrderTimingProviderState> implements React.ChildContextProvider<IRunningOrderTimingProviderChildContext> {
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

		this.refreshDecimator = 0
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
		if (this.refreshDecimator % LOW_RESOLUTION_TIMING_DECIMATOR === 0) {
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
		this._cleanUp()
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
		let displayStartsAtAccumulator = 0

		const { runningOrder, segmentLines } = this.props
		const linearSegLines: Array<[string, number | null]> = []
		const segLineDurations: {
			[key: string]: number
		} = {}
		const segLineExpectedDurations: {
			[key: string]: number
		} = {}
		const segLinePlayed: {
			[key: string]: number
		} = {}
		const segLineStartsAt: {
			[key: string]: number
		} = {}
		const segLineDisplayStartsAt: {
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
					segLinePlayed[item._id] = (now - item.startedPlayback)
				} else {
					segLineDurations[item._id] = item.duration || item.expectedDuration || 0
					segLinePlayed[item._id] = item.duration || 0
				}
				segLineExpectedDurations[item._id] = item.expectedDuration || item.duration || 0
				segLineStartsAt[item._id] = startsAtAccumulator
				segLineDisplayStartsAt[item._id] = displayStartsAtAccumulator
				startsAtAccumulator += segLineDurations[item._id]
				displayStartsAtAccumulator += segLineDurations[item._id] || this.props.defaultDuration || 3000
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
					localAccum = linearSegLines[i][1] || 0
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
			segmentLinePlayed: segLinePlayed,
			segmentLineStartsAt: segLineStartsAt,
			segmentLineDisplayStartsAt: segLineDisplayStartsAt,
			segmentLineExpectedDurations: segLineExpectedDurations
		})
	}

	render () {
		return this.props.children
	}
})

export interface WithTimingOptions {
	isHighResolution?: boolean
	filter?: string | any[]
}
export type WithTiming<T> = T & RunningOrderTiming.InjectedROTimingProps
type IWrappedComponent<IProps, IState> = new (props: WithTiming<IProps>, state: IState) => React.Component<WithTiming<IProps>, IState>

export function withTiming<IProps, IState> (options?: WithTimingOptions | Function):
	(WrappedComponent: IWrappedComponent<IProps, IState>) =>
		new (props: IProps, context: any ) => React.Component<IProps, IState> {
	let expandedOptions: WithTimingOptions = _.extend({
		isHighResolution: false
	}, typeof options === 'function' ? {} : options)

	return (WrappedComponent) => {
		return class WithTimingHOCComponent extends React.Component<IProps, IState> {
			static contextTypes = {
				durations: PropTypes.object.isRequired
			}

			filterGetter: (o: any) => any
			previousValue: any = null

			constructor (props, context) {
				super(props, context)

				if (typeof options === 'function') {
					expandedOptions = _.extend(expandedOptions, options(this.props))
				}

				if (expandedOptions.filter) {
					this.filterGetter = _.property(expandedOptions.filter as string)
				}
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
				if (!this.filterGetter) {
					this.forceUpdate()
				} else {
					const buf = this.filterGetter(this.context.durations || {})
					if (buf !== this.previousValue) {
						this.previousValue = buf
						this.forceUpdate()
					}
				}
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
	hideOnZero?: boolean
}
interface ISegmentLineCountdownState {
}
export const SegmentLineCountdown = withTiming<ISegmentLineCountdownProps, ISegmentLineCountdownState>()(
class extends React.Component<WithTiming<ISegmentLineCountdownProps>, ISegmentLineCountdownState> {
	render () {
		return (<span>
			{this.props.segmentLineId &&
				this.props.timingDurations &&
				this.props.timingDurations.segmentLineCountdown &&
				this.props.timingDurations.segmentLineCountdown[this.props.segmentLineId] !== undefined &&
				(this.props.hideOnZero !== true || this.props.timingDurations.segmentLineCountdown[this.props.segmentLineId] > 0) &&
					RundownUtils.formatTimeToShortTime(this.props.timingDurations.segmentLineCountdown[this.props.segmentLineId])}
		</span>)
	}
})
interface ISegmentDurationProps {
	segmentLineIds: Array<string>
}
interface ISegmentDurationState {
}
export const SegmentDuration = withTiming<ISegmentDurationProps, ISegmentDurationState>()(
	class extends React.Component<WithTiming<ISegmentDurationProps>, ISegmentDurationState> {
		render () {
			if (this.props.segmentLineIds &&
				this.props.timingDurations &&
				this.props.timingDurations.segmentLineExpectedDurations) {
				const duration = this.props.segmentLineIds.reduce((memo, item) => {
					return this.props.timingDurations!.segmentLineExpectedDurations![item] !== undefined ?
						memo + Math.max(0, this.props.timingDurations!.segmentLineExpectedDurations![item] - (this.props.timingDurations!.segmentLinePlayed![item] || 0)) :
						memo
				}, 0)

				return <span className={duration < 0 ? 'negative' : undefined}>
					{RundownUtils.formatDiffToTimecode(duration, false, false, true, false, true, '+')}
				</span>
			}
			return null
		}
	})
