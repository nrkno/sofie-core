import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import * as PropTypes from 'prop-types'
import * as _ from 'underscore'
import { withTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { Rundown } from '../../../lib/collections/Rundowns'
import { Part, Parts } from '../../../lib/collections/Parts'
import { getCurrentTime } from '../../../lib/lib'
import { RundownUtils } from '../../lib/rundown'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'

export namespace RundownTiming {
	/**
	 * Events used by the RundownTimingProvider
	 * @export
	 * @enum {number}
	 */
	export enum Events {
		/** Event is emitted every now-and-then, generally to be used for simple displays */
		'timeupdate'		= 'sofie:rundownTimeUpdate',
		/** event is emmited with a very high frequency (60 Hz), to be used sparingly as hooking up Components to it will cause a lot of renders */
		'timeupdateHR'		= 'sofie:rundownTimeUpdateHR'
	}

	/**
	 * Context object that will be passed to listening components. The dictionaries use the Part ID as a key.
	 * @export
	 * @interface RundownTimingContext
	 */
	export interface RundownTimingContext {
		/** This is the total duration of the rundown as planned (using expectedDurations). */
		totalRundownDuration?: number
		/** This is the content remaining to be played in the rundown (based on the expectedDurations).  */
		remainingRundownDuration?: number
		/** This is the tottal duration of the rundown: as planned for the unplayed content, and as-run for the played-out. */
		asPlayedRundownDuration?: number
		/** this is the countdown to each of the parts relative to the current on air part. */
		partCountdown?: {
			[key: string]: number
		}
		/** The calculated durations of each of the Parts: as-planned/as-run depending on state. */
		partDurations?: {
			[key: string]: number
		}
		/** The offset of each of the Parts from the beginning of the Rundown. */
		partStartsAt?: {
			[key: string]: number
		}
		/** Same as partStartsAt, but will include display duration overrides (such as minimal display width for an Part, etc.). */
		partDisplayStartsAt?: {
			[key: string]: number
		}
		/** Same as partDurations, but will include display duration overrides (such as minimal display width for an Part, etc.). */
		partDisplayDurations?: {
			[key: string]: number
		}
		/** As-played durations of each part. Will be 0, if not yet played. Will be counted from start to now if currently playing. */
		partPlayed?: {
			[key: string]: number
		}
		/** Expected durations of each of the parts or the as-played duration, if the Part does not have an expected duration. */
		partExpectedDurations?: {
			[key: string]: number
		}
	}

	/**
	 * This are the properties that will be injected by the withTiming HOC.
	 * @export
	 * @interface InjectedROTimingProps
	 */
	export interface InjectedROTimingProps {
		timingDurations: RundownTimingContext
	}
}

const TIMING_DEFAULT_REFRESH_INTERVAL = 1000 / 60 // the interval for high-resolution events (timeupdateHR)
const LOW_RESOLUTION_TIMING_DECIMATOR = 15 // the low-resolution events will be called every LOW_RESOLUTION_TIMING_DECIMATOR-th time of the high-resolution events

/**
 * RundownTimingProvider properties.
 * @interface IRundownTimingProviderProps
 */
interface IRundownTimingProviderProps {
	/** Rundown that is to be used for generating the timing information. */
	rundown?: Rundown
	/** Interval for high-resolution timing events. If undefined, it will fall back onto TIMING_DEFAULT_REFRESH_INTERVAL. */
	refreshInterval?: number
	/** Fallback duration for Parts that have no as-played duration of their own. */
	defaultDuration?: number
}
interface IRundownTimingProviderChildContext {
	durations: RundownTiming.RundownTimingContext
}
interface IRundownTimingProviderState {
}
interface IRundownTimingProviderTrackedProps {
	parts: Array<Part>
}

/**
 * RundownTimingProvider is a container component that provides a timing context to all child elements. It allows calculating a single
 * @class RundownTimingProvider
 * @extends React.Component<IRundownTimingProviderProps>
 */
export const RundownTimingProvider = withTracker<IRundownTimingProviderProps, IRundownTimingProviderState, IRundownTimingProviderTrackedProps>(
(props) => {
	let parts: Array<Part> = []
	if (props.rundown) {
		parts = Parts.find({
			'rundownId': props.rundown._id,
		}, {
			sort: {
				'_rank': 1
			}
		}).fetch()
	}
	return {
		parts
	}
})(class RundownTimingProvider extends MeteorReactComponent<IRundownTimingProviderProps & IRundownTimingProviderTrackedProps, IRundownTimingProviderState> implements React.ChildContextProvider<IRundownTimingProviderChildContext> {
	static childContextTypes = {
		durations: PropTypes.object.isRequired
	}

	durations: RundownTiming.RundownTimingContext = {}
	refreshTimer: number
	refreshTimerInterval: number
	refreshDecimator: number

	constructor (props: IRundownTimingProviderProps & IRundownTimingProviderTrackedProps) {
		super(props)

		this.refreshTimerInterval = props.refreshInterval || TIMING_DEFAULT_REFRESH_INTERVAL

		this.refreshDecimator = 0
	}

	getChildContext (): IRundownTimingProviderChildContext {
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
		this.onRefreshTimer()
	}

	componentDidUpdate (prevProps: IRundownTimingProviderProps & IRundownTimingProviderTrackedProps) {
		// change refresh interval if needed
		if (this.refreshTimerInterval !== this.props.refreshInterval && this.refreshTimer) {
			this.refreshTimerInterval = this.props.refreshInterval || TIMING_DEFAULT_REFRESH_INTERVAL
			Meteor.clearInterval(this.refreshTimer)
			this.refreshTimer = Meteor.setInterval(this.onRefreshTimer, this.refreshTimerInterval)
		}
	}

	componentWillUnmount () {
		this._cleanUp()
		Meteor.clearInterval(this.refreshTimer)
	}

	dispatchHREvent () {
		const event = new Event(RundownTiming.Events.timeupdateHR)
		window.dispatchEvent(event)
	}

	dispatchEvent () {
		const event = new Event(RundownTiming.Events.timeupdate)
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

		let debugConsole = ''

		const { rundown, parts } = this.props
		const linearSegLines: Array<[string, number | null]> = []
		// look at the comments on RundownTimingContext to understand what these do
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
		const segLineDisplayDurations: {
			[key: string]: number
		} = {}
		const displayDurationGroups: _.Dictionary<number> = {}

		let nextAIndex = -1
		let currentAIndex = -1

		let now = getCurrentTime()

		if (rundown && parts) {
			parts.forEach((item, itIndex) => {
				// add piece to accumulator
				const aIndex = linearSegLines.push([item._id, waitAccumulator]) - 1

				// if this is next segementLine, clear previous countdowns and clear accumulator
				if (rundown.nextPartId === item._id) {
					nextAIndex = aIndex
				} else if (rundown.currentPartId === item._id) {
					currentAIndex = aIndex
				}

				// expected is just a sum of expectedDurations
				totalRundownDuration += item.expectedDuration || 0

				const lastStartedPlayback = item.getLastStartedPlayback()

				// asPlayed is the actual duration so far and expected durations in unplayed lines
				// item is onAir right now, and it's already taking longer than rendered/expectedDuration
				if (item.startedPlayback && lastStartedPlayback && !item.duration && lastStartedPlayback + (item.expectedDuration || 0) < now) {
					asPlayedRundownDuration += (now - lastStartedPlayback)
				} else {
					asPlayedRundownDuration += (item.duration || item.expectedDuration || 0)
				}

				let segLineDuration = 0
				let segLineDisplayDuration = 0
				let displayDuration = 0

				const playOffset = item.timings && item.timings.playOffset && _.last(item.timings.playOffset) || 0

				// Display Duration groups are groups of two or more Parts, where some of them have an expectedDuration and some have 0.
				// Then, some of them will have a displayDuration. The expectedDurations are pooled together, the parts with
				// display durations will take up that much time in the Rundown. The left-over time from the display duration group
				// will be used by Parts without expectedDurations.
				let memberOfDisplayDurationGroup = false // using a separate displayDurationGroup processing flag simplifies implementation
				if (item.displayDurationGroup && (
					// either this is not the first element of the displayDurationGroup
					(displayDurationGroups[item.displayDurationGroup]) ||
					// or there is a following member of this displayDurationGroup
					(parts[itIndex + 1] && parts[itIndex + 1].displayDurationGroup === item.displayDurationGroup)
				)) {
					displayDurationGroups[item.displayDurationGroup] = (displayDurationGroups[item.displayDurationGroup] || 0) + (item.expectedDuration || 0)
					displayDuration = Math.min(item.displayDuration || item.expectedDuration || 0, item.expectedDuration || 0) || displayDurationGroups[item.displayDurationGroup]
					memberOfDisplayDurationGroup = true
				}
				if (item.startedPlayback && lastStartedPlayback && !item.duration) {
					currentRemaining = Math.max(0, (item.duration || displayDuration || item.expectedDuration || 0) - (now - lastStartedPlayback))
					segLineDuration = Math.max((item.duration || item.expectedDuration || 0), (now - lastStartedPlayback))
					segLineDisplayDuration = Math.max((item.duration || displayDuration || item.expectedDuration || 0), (now - lastStartedPlayback))
					segLinePlayed[item._id] = (now - lastStartedPlayback)
				} else {
					segLineDuration = item.duration || item.expectedDuration || 0
					segLineDisplayDuration = Math.max(0, item.duration || displayDuration || item.expectedDuration || 0)
					segLinePlayed[item._id] = item.duration || 0
				}
				if (memberOfDisplayDurationGroup && item.displayDurationGroup) {
					displayDurationGroups[item.displayDurationGroup] = Math.max(0, displayDurationGroups[item.displayDurationGroup] - segLineDisplayDuration)
				}
				/* if (item.displayDurationGroup && item.slug.startsWith('Julian')) {
					console.log(item.displayDurationGroup + ', ' + item.slug + ': ' + (segLineDisplayDuration / 1000))
				} */
				segLineExpectedDurations[item._id] = item.expectedDuration || item.duration || 0
				segLineStartsAt[item._id] = startsAtAccumulator
				segLineDisplayStartsAt[item._id] = displayStartsAtAccumulator
				segLineDurations[item._id] = segLineDuration
				segLineDisplayDurations[item._id] = segLineDisplayDuration
				startsAtAccumulator += segLineDurations[item._id]
				displayStartsAtAccumulator += segLineDisplayDuration || this.props.defaultDuration || 3000
				// waitAccumulator is used to calculate the countdowns for Parts relative to the current Part
				// always add the full duration, in case by some manual intervention this segment should play twice
				// console.log('%c' + item._id + ', ' + waitAccumulator, 'color: red')
				if (memberOfDisplayDurationGroup) {
					waitAccumulator += (item.duration || segLineDisplayDuration || item.expectedDuration || 0)
				} else {
					waitAccumulator += (item.duration || item.expectedDuration || 0)
				}

				// remaining is the sum of unplayed lines + whatever is left of the current segment
				if (!item.startedPlayback) {
					remainingRundownDuration += item.expectedDuration || 0
					// item is onAir right now, and it's is currently shorter than expectedDuration
				} else if (item.startedPlayback && lastStartedPlayback && !item.duration && rundown.currentPartId === item._id && lastStartedPlayback + (item.expectedDuration || 0) > now) {
					// console.log((now - item.startedPlayback))
					remainingRundownDuration += (item.expectedDuration || 0) - (now - lastStartedPlayback)
				}
			})

			// This is where the waitAccumulator-generated data in the linearSegLines is used to calculate the countdowns.
			let localAccum = 0
			for (let i = 0; i < linearSegLines.length; i++) {
				if (i < nextAIndex) { // this is a line before next line
					localAccum = linearSegLines[i][1] || 0
					linearSegLines[i][1] = null // we use null to express 'will not probably be played out, if played in order'
				} else if (i === nextAIndex) { // this is a calculation for the next line, which is basically how much there is left of the current line
					localAccum = linearSegLines[i][1] || 0 // if there is no current line, rebase following lines to the next line
					linearSegLines[i][1] = currentRemaining
				} else { // these are lines after next line
					// we take whatever value this line has, subtract the value as set on the Next Part
					// (note that the Next Part value will be using currentRemaining as the countdown)
					// and add the currentRemaining countdown, since we are currentRemaining + diff between next and
					// this away from this line.
					linearSegLines[i][1] = (linearSegLines[i][1] || 0) - localAccum + currentRemaining
				}
			}

			// if (this.refreshDecimator % LOW_RESOLUTION_TIMING_DECIMATOR === 0) {
			// 	const c = document.getElementById('debug-console')
			// 	if (c) c.innerHTML = debugConsole.replace(/\n/g, '<br>')
			// }
		}

		// console.log(linearSegLines.map((value) => value[1]))

		this.durations = _.extend(this.durations, {
			totalRundownDuration,
			remainingRundownDuration,
			asPlayedRundownDuration,
			partCountdown: _.object(linearSegLines),
			partDurations: segLineDurations,
			partPlayed: segLinePlayed,
			partStartsAt: segLineStartsAt,
			partDisplayStartsAt: segLineDisplayStartsAt,
			partExpectedDurations: segLineExpectedDurations,
			partDisplayDurations: segLineDisplayDurations
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
export type WithTiming<T> = T & RundownTiming.InjectedROTimingProps
type IWrappedComponent<IProps, IState> = new (props: WithTiming<IProps>, state: IState) => React.Component<WithTiming<IProps>, IState>

/**
 * Wrap a component in a HOC that will inject a the timing context as a prop. Takes an optional options object that
 * allows a high timing resolution or filtering of the changes in the context, so that the child component only
 * re-renders when a change to the filtered value happens.
 * The options object can also be replaced with an options generator function that will take the incoming props
 * as an argument and produce a {WithTimingOptions} object
 * @export
 * @template IProps The props interface of the child component
 * @template IState The state interface of the child component
 * @param  {(WithTimingOptions | ((props: IProps) => WithTimingOptions))} [options] The options object or the options object generator
 * @return (WrappedComponent: IWrappedComponent<IProps, IState>) =>
 * 		new (props: IProps, context: any ) => React.Component<IProps, IState>
 */
export function withTiming<IProps, IState> (options?: WithTimingOptions | ((props: IProps) => WithTimingOptions)):
	(WrappedComponent: IWrappedComponent<IProps, IState>) =>
		new (props: IProps, context: any) => React.Component<IProps, IState> {
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
						RundownTiming.Events.timeupdateHR :
						RundownTiming.Events.timeupdate
				, this.refreshComponent)
			}

			componentWillUnmount () {
				window.removeEventListener(
					expandedOptions.isHighResolution ?
						RundownTiming.Events.timeupdateHR :
						RundownTiming.Events.timeupdate
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
				const durations: RundownTiming.RundownTimingContext
					= this.context.durations

				const allProps: WithTiming<IProps> = _.extend({
					timingDurations: durations
				}, this.props)
				return <WrappedComponent { ...allProps } />
			}
		}
	}
}

interface IPartCountdownProps {
	partId?: string
	hideOnZero?: boolean
}
interface IPartCountdownState {
}

/**
 * A presentational component that will render a countdown to a given Part
 * @class PartCountdown
 * @extends React.Component<WithTiming<IPartCountdownProps>>
 */
export const PartCountdown = withTiming<IPartCountdownProps, IPartCountdownState>()(
class PartCountdown extends React.Component<WithTiming<IPartCountdownProps>, IPartCountdownState> {
	render () {
		return (<span>
			{this.props.partId &&
				this.props.timingDurations &&
				this.props.timingDurations.partCountdown &&
				this.props.timingDurations.partCountdown[this.props.partId] !== undefined &&
				(this.props.hideOnZero !== true || this.props.timingDurations.partCountdown[this.props.partId] > 0) &&
					RundownUtils.formatTimeToShortTime(this.props.timingDurations.partCountdown[this.props.partId])}
		</span>)
	}
})
interface ISegmentDurationProps {
	partIds: Array<string>
}
interface ISegmentDurationState {
}

/**
 * A presentational component that will render a counter that will show how much content is left in a segment consisting of given parts
 * @class SegmentDuration
 * @extends React.Component<WithTiming<ISegmentDurationProps>>
 */
export const SegmentDuration = withTiming<ISegmentDurationProps, ISegmentDurationState>()(
class SegmentDuration extends React.Component<WithTiming<ISegmentDurationProps>, ISegmentDurationState> {
	render () {
		if (
			this.props.partIds &&
			this.props.timingDurations.partExpectedDurations &&
			this.props.timingDurations.partPlayed
		) {
			let partExpectedDurations = this.props.timingDurations.partExpectedDurations
			let partPlayed = this.props.timingDurations.partPlayed

			const duration = this.props.partIds.reduce((memo, item) => {
				return partExpectedDurations[item] !== undefined ?
					memo + Math.max(0, partExpectedDurations[item] - (partPlayed[item] || 0)) :
					memo
			}, 0)

			return <span className={duration < 0 ? 'negative' : undefined}>
				{RundownUtils.formatDiffToTimecode(duration, false, false, true, false, true, '+')}
			</span>
		}

		return null
	}
})

/**
 * Computes the actual (as-played fallbacking to expected) duration of a segment, consisting of given parts
 * @export
 * @param  {RundownTiming.RundownTimingContext} timingDurations The timing durations calculated for the Rundown
 * @param  {Array<string>} partIds The IDs of parts that are members of the segment
 * @return number
 */
export function computeSegmentDuration (timingDurations: RundownTiming.RundownTimingContext, partIds: Array<string>): number {
	let partDurations = timingDurations.partDurations

	if (partDurations === undefined) return 0

	return partIds.reduce((memo, item) => {
		return partDurations ?
				partDurations[item] !== undefined ?
				memo + partDurations[item] :
				memo
			: 0
	}, 0)
}
