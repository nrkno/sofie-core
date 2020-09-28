import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import * as PropTypes from 'prop-types'
import * as _ from 'underscore'
import { withTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { Rundown } from '../../../lib/collections/Rundowns'
import { Part, Parts, PartId } from '../../../lib/collections/Parts'
import { getCurrentTime, literal, normalizeArray, unprotectString } from '../../../lib/lib'
import { RundownUtils } from '../../lib/rundown'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import ClassNames from 'classnames'
import { SpeechSynthesiser } from '../../lib/speechSynthesis'
import {
	PartInstance,
	findPartInstanceOrWrapToTemporary,
	PartInstanceId,
	wrapPartToTemporaryInstance,
} from '../../../lib/collections/PartInstances'
import { Settings } from '../../../lib/Settings'

// Minimum duration that a part can be assigned. Used by gap parts to allow them to "compress" to indicate time running out.
const MINIMAL_NONZERO_DURATION = 1

export interface TimeEventArgs {
	currentTime: number
}

export type TimingEvent = CustomEvent<TimeEventArgs>

export namespace RundownTiming {
	/**
	 * Events used by the RundownTimingProvider
	 * @export
	 * @enum {number}
	 */
	export enum Events {
		/** Event is emitted every now-and-then, generally to be used for simple displays */
		'timeupdate' = 'sofie:rundownTimeUpdate',
		/** event is emitted with a very high frequency (60 Hz), to be used sparingly as
		 * hooking up Components to it will cause a lot of renders
		 */
		'timeupdateHR' = 'sofie:rundownTimeUpdateHR',
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
		/** This is the total duration of the rundown: as planned for the unplayed (skipped & future) content, and as-run for the played-out. */
		asDisplayedRundownDuration?: number
		/** This is the complete duration of the rundown: as planned for the unplayed content, and as-run for the played-out, but ignoring unplayed/unplayable parts in order */
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
		/** Same as partStartsAt, but will include display duration overrides
		 *  (such as minimal display width for an Part, etc.).
		 */
		partDisplayStartsAt?: {
			[key: string]: number
		}
		/** Same as partDurations, but will include display duration overrides
		 * (such as minimal display width for an Part, etc.).
		 */
		partDisplayDurations?: {
			[key: string]: number
		}
		/** As-played durations of each part. Will be 0, if not yet played.
		 * Will be counted from start to now if currently playing.
		 */
		partPlayed?: {
			[key: string]: number
		}
		/** Expected durations of each of the parts or the as-played duration,
		 * if the Part does not have an expected duration.
		 */
		partExpectedDurations?: {
			[key: string]: number
		}
		/** Remaining time on current part */
		remainingTimeOnCurrentPart?: number | undefined
		/** Current part will autoNext */
		currentPartWillAutoNext?: boolean
		/** Current time of this calculation */
		currentTime?: number
		/** Was this time context calculated during a high-resolution tick */
		isLowResolution: boolean
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
const LOW_RESOLUTION_TIMING_DECIMATOR = 15 // the low-resolution events will be called every
// LOW_RESOLUTION_TIMING_DECIMATOR-th time of the high-resolution events

/**
 * RundownTimingProvider properties.
 * @interface IRundownTimingProviderProps
 */
interface IRundownTimingProviderProps {
	/** Rundown Playlist that is to be used for generating the timing information. */
	playlist?: RundownPlaylist

	/** Interval for high-resolution timing events. If undefined, it will fall back
	 * onto TIMING_DEFAULT_REFRESH_INTERVAL.
	 */
	refreshInterval?: number
	/** Fallback duration for Parts that have no as-played duration of their own. */
	defaultDuration?: number
}
interface IRundownTimingProviderChildContext {
	durations: RundownTiming.RundownTimingContext
}
interface IRundownTimingProviderState {}
interface IRundownTimingProviderTrackedProps {
	parts: Array<Part>
	partInstancesMap: { [partId: string]: PartInstance | undefined }
}

/**
 * RundownTimingProvider is a container component that provides a timing context to all child elements.
 * It allows calculating a single
 * @class RundownTimingProvider
 * @extends React.Component<IRundownTimingProviderProps>
 */
export const RundownTimingProvider = withTracker<
	IRundownTimingProviderProps,
	IRundownTimingProviderState,
	IRundownTimingProviderTrackedProps
>((props) => {
	let parts: Array<Part> = []
	let partInstancesMap: { [partId: string]: PartInstance | undefined } = {}
	if (props.playlist) {
		parts = props.playlist.getAllOrderedParts()
		partInstancesMap = props.playlist.getActivePartInstancesMap()
	}
	return {
		parts,
		partInstancesMap,
	}
})(
	class RundownTimingProvider
		extends MeteorReactComponent<
			IRundownTimingProviderProps & IRundownTimingProviderTrackedProps,
			IRundownTimingProviderState
		>
		implements React.ChildContextProvider<IRundownTimingProviderChildContext> {
		static childContextTypes = {
			durations: PropTypes.object.isRequired,
		}

		durations: RundownTiming.RundownTimingContext = {
			isLowResolution: false,
		}
		refreshTimer: number
		refreshTimerInterval: number
		refreshDecimator: number

		private temporaryPartInstances: {
			[key: string]: PartInstance
		} = {}

		private linearParts: Array<[PartId, number | null]> = []
		// look at the comments on RundownTimingContext to understand what these do
		private partDurations: {
			[key: string]: number
		} = {}
		private partExpectedDurations: {
			[key: string]: number
		} = {}
		private partPlayed: {
			[key: string]: number
		} = {}
		private partStartsAt: {
			[key: string]: number
		} = {}
		private partDisplayStartsAt: {
			[key: string]: number
		} = {}
		private partDisplayDurations: {
			[key: string]: number
		} = {}
		private partDisplayDurationsNoPlayback: {
			[key: string]: number
		} = {}
		private displayDurationGroups: _.Dictionary<number> = {}

		constructor(props: IRundownTimingProviderProps & IRundownTimingProviderTrackedProps) {
			super(props)

			this.refreshTimerInterval = props.refreshInterval || TIMING_DEFAULT_REFRESH_INTERVAL

			this.refreshDecimator = 0
		}

		getChildContext(): IRundownTimingProviderChildContext {
			return {
				durations: this.durations,
			}
		}

		onRefreshTimer = () => {
			const now = getCurrentTime()
			const isLowResolution = this.refreshDecimator % LOW_RESOLUTION_TIMING_DECIMATOR === 0
			this.updateDurations(now, isLowResolution)
			this.dispatchHREvent(now)

			this.refreshDecimator++
			if (isLowResolution) {
				this.dispatchEvent(now)
			}
		}

		componentDidMount() {
			this.refreshTimer = Meteor.setInterval(this.onRefreshTimer, this.refreshTimerInterval)
			this.onRefreshTimer()

			window['rundownTimingContext'] = this.durations
		}

		componentDidUpdate(prevProps: IRundownTimingProviderProps & IRundownTimingProviderTrackedProps) {
			// change refresh interval if needed
			if (this.refreshTimerInterval !== this.props.refreshInterval && this.refreshTimer) {
				this.refreshTimerInterval = this.props.refreshInterval || TIMING_DEFAULT_REFRESH_INTERVAL
				Meteor.clearInterval(this.refreshTimer)
				this.refreshTimer = Meteor.setInterval(this.onRefreshTimer, this.refreshTimerInterval)
			}
			if (prevProps.parts !== this.props.parts) {
				// empty the temporary Part Instances cache
				this.temporaryPartInstances = {}
			}
		}

		componentWillUnmount() {
			this._cleanUp()
			delete window['rundownTimingContext']
			Meteor.clearInterval(this.refreshTimer)
		}

		dispatchHREvent(now: number) {
			const event = new CustomEvent<TimeEventArgs>(RundownTiming.Events.timeupdateHR, {
				detail: {
					currentTime: now,
				},
				cancelable: false,
			})
			window.dispatchEvent(event)
		}

		dispatchEvent(now: number) {
			const event = new CustomEvent<TimeEventArgs>(RundownTiming.Events.timeupdate, {
				detail: {
					currentTime: now,
				},
				cancelable: false,
			})
			window.dispatchEvent(event)
		}

		private getPartInstanceOrGetCachedTemp(
			partInstancesMap: { [key: string]: PartInstance | undefined },
			part: Part
		): PartInstance {
			const origPartId = unprotectString(part._id)
			if (partInstancesMap[origPartId] !== undefined) {
				return partInstancesMap[origPartId]!
			} else {
				if (this.temporaryPartInstances[origPartId]) {
					return this.temporaryPartInstances[origPartId]
				} else {
					const partInstance = wrapPartToTemporaryInstance(part)
					this.temporaryPartInstances[origPartId] = partInstance
					return partInstance
				}
			}
		}

		updateDurations(now: number, isLowResolution: boolean) {
			let totalRundownDuration = 0
			let remainingRundownDuration = 0
			let asPlayedRundownDuration = 0
			let asDisplayedRundownDuration = 0
			let waitAccumulator = 0
			let currentRemaining = 0
			let startsAtAccumulator = 0
			let displayStartsAtAccumulator = 0

			Object.keys(this.displayDurationGroups).forEach((key) => delete this.displayDurationGroups[key])
			this.linearParts.length = 0

			let debugConsole = ''

			const { playlist, parts, partInstancesMap } = this.props

			let nextAIndex = -1
			let currentAIndex = -1

			if (playlist && parts) {
				parts.forEach((origPart, itIndex) => {
					const partInstance = this.getPartInstanceOrGetCachedTemp(partInstancesMap, origPart)

					// add piece to accumulator
					const aIndex = this.linearParts.push([partInstance.part._id, waitAccumulator]) - 1

					// if this is next segementLine, clear previous countdowns and clear accumulator
					if (playlist.nextPartInstanceId === partInstance._id) {
						nextAIndex = aIndex
					} else if (playlist.currentPartInstanceId === partInstance._id) {
						currentAIndex = aIndex
					}

					const partCounts =
						playlist.outOfOrderTiming ||
						!playlist.active ||
						(itIndex >= currentAIndex && currentAIndex >= 0) ||
						(itIndex >= nextAIndex && nextAIndex >= 0 && currentAIndex === -1)

					// expected is just a sum of expectedDurations
					totalRundownDuration += partInstance.part.expectedDuration || 0

					const lastStartedPlayback = partInstance.part.getLastStartedPlayback()
					const playOffset =
						(partInstance.part.timings &&
							partInstance.part.timings.playOffset &&
							_.last(partInstance.part.timings.playOffset)) ||
						0

					let partDuration = 0
					let partDisplayDuration = 0
					let partDisplayDurationNoPlayback = 0
					let displayDurationFromGroup = 0

					// Display Duration groups are groups of two or more Parts, where some of them have an
					// expectedDuration and some have 0.
					// Then, some of them will have a displayDuration. The expectedDurations are pooled together, the parts with
					// display durations will take up that much time in the Rundown. The left-over time from the display duration group
					// will be used by Parts without expectedDurations.
					let memberOfDisplayDurationGroup = false
					// using a separate displayDurationGroup processing flag simplifies implementation
					if (
						partInstance.part.displayDurationGroup &&
						// either this is not the first element of the displayDurationGroup
						(this.displayDurationGroups[partInstance.part.displayDurationGroup] !== undefined ||
							// or there is a following member of this displayDurationGroup
							(parts[itIndex + 1] &&
								parts[itIndex + 1].displayDurationGroup === partInstance.part.displayDurationGroup)) &&
						!partInstance.part.floated
					) {
						this.displayDurationGroups[partInstance.part.displayDurationGroup] =
							(this.displayDurationGroups[partInstance.part.displayDurationGroup] || 0) +
							(partInstance.part.expectedDuration || 0)
						displayDurationFromGroup =
							partInstance.part.displayDuration ||
							Math.max(
								0,
								this.displayDurationGroups[partInstance.part.displayDurationGroup],
								partInstance.part.gap
									? MINIMAL_NONZERO_DURATION
									: this.props.defaultDuration || Settings.defaultDisplayDuration
							)
						memberOfDisplayDurationGroup = true
					}

					// This is where we actually calculate all the various variants of duration of a part
					if (partInstance.part.startedPlayback && lastStartedPlayback && !partInstance.part.duration) {
						currentRemaining = Math.max(
							0,
							(partInstance.part.duration ||
								(memberOfDisplayDurationGroup ? displayDurationFromGroup : partInstance.part.expectedDuration) ||
								0) -
								(now - lastStartedPlayback)
						)
						partDuration =
							Math.max(
								partInstance.part.duration || partInstance.part.expectedDuration || 0,
								now - lastStartedPlayback
							) - playOffset
						// because displayDurationGroups have no actual timing on them, we need to have a copy of the
						// partDisplayDuration, but calculated as if it's not playing, so that the countdown can be
						// calculated
						partDisplayDurationNoPlayback =
							partInstance.part.duration ||
							(memberOfDisplayDurationGroup ? displayDurationFromGroup : partInstance.part.expectedDuration) ||
							this.props.defaultDuration ||
							Settings.defaultDisplayDuration
						partDisplayDuration = Math.max(partDisplayDurationNoPlayback, now - lastStartedPlayback)
						this.partPlayed[unprotectString(partInstance.part._id)] = now - lastStartedPlayback
					} else {
						partDuration = (partInstance.part.duration || partInstance.part.expectedDuration || 0) - playOffset
						partDisplayDuration = Math.max(
							0,
							(partInstance.part.duration && partInstance.part.duration + playOffset) ||
								displayDurationFromGroup ||
								partInstance.part.expectedDuration ||
								this.props.defaultDuration ||
								Settings.defaultDisplayDuration
						)
						partDisplayDurationNoPlayback = partDisplayDuration
						this.partPlayed[unprotectString(partInstance.part._id)] = (partInstance.part.duration || 0) - playOffset
					}

					// asPlayed is the actual duration so far and expected durations in unplayed lines.
					// If item is onAir right now, it's duration is counted as expected duration or current
					// playback duration whichever is larger.
					// Parts that don't count are ignored.
					if (partInstance.part.startedPlayback && lastStartedPlayback && !partInstance.part.duration) {
						asPlayedRundownDuration += Math.max(
							memberOfDisplayDurationGroup
								? Math.max(displayDurationFromGroup, partInstance.part.expectedDuration || 0)
								: partInstance.part.expectedDuration || 0,
							now - lastStartedPlayback
						)
					} else if (partInstance.part.duration) {
						asPlayedRundownDuration += partInstance.part.duration
					} else if (partCounts) {
						asPlayedRundownDuration += partInstance.part.expectedDuration || 0
					}

					// asDisplayed is the actual duration so far and expected durations in unplayed lines
					// If item is onAir right now, it's duration is counted as expected duration or current
					// playback duration whichever is larger.
					// All parts are counted.
					if (partInstance.part.startedPlayback && lastStartedPlayback && !partInstance.part.duration) {
						asDisplayedRundownDuration += Math.max(
							memberOfDisplayDurationGroup
								? Math.max(displayDurationFromGroup, partInstance.part.expectedDuration || 0)
								: partInstance.part.expectedDuration || 0,
							now - lastStartedPlayback
						)
					} else {
						asDisplayedRundownDuration += partInstance.part.duration || partInstance.part.expectedDuration || 0
					}

					// the part is the current part but has not yet started playback
					if (playlist.currentPartInstanceId === partInstance._id && !partInstance.part.startedPlayback) {
						currentRemaining = partDisplayDuration
					}

					// Handle invalid parts by overriding the values to preset values for Invalid parts
					if (partInstance.part.invalid && !partInstance.part.gap) {
						partDisplayDuration = this.props.defaultDuration || Settings.defaultDisplayDuration
						this.partPlayed[unprotectString(partInstance.part._id)] = 0
					}

					if (
						memberOfDisplayDurationGroup &&
						partInstance.part.displayDurationGroup &&
						!partInstance.part.floated &&
						!partInstance.part.invalid &&
						(partInstance.part.duration || partCounts)
					) {
						this.displayDurationGroups[partInstance.part.displayDurationGroup] =
							this.displayDurationGroups[partInstance.part.displayDurationGroup] - partDisplayDuration
					}
					const partInstancePartId = unprotectString(partInstance.part._id)
					this.partExpectedDurations[partInstancePartId] =
						partInstance.part.expectedDuration || partInstance.part.duration || 0
					this.partStartsAt[partInstancePartId] = startsAtAccumulator
					this.partDisplayStartsAt[partInstancePartId] = displayStartsAtAccumulator
					this.partDurations[partInstancePartId] = partDuration
					this.partDisplayDurations[partInstancePartId] = partDisplayDuration
					this.partDisplayDurationsNoPlayback[partInstancePartId] = partDisplayDurationNoPlayback
					startsAtAccumulator += this.partDurations[partInstancePartId]
					displayStartsAtAccumulator += this.partDisplayDurations[partInstancePartId] // || this.props.defaultDuration || 3000
					// waitAccumulator is used to calculate the countdowns for Parts relative to the current Part
					// always add the full duration, in case by some manual intervention this segment should play twice
					if (memberOfDisplayDurationGroup) {
						waitAccumulator +=
							partInstance.part.duration || partDisplayDuration || partInstance.part.expectedDuration || 0
					} else {
						waitAccumulator += partInstance.part.duration || partInstance.part.expectedDuration || 0
					}

					// remaining is the sum of unplayed lines + whatever is left of the current segment
					// if outOfOrderTiming is true, count parts before current part towards remaining rundown duration
					// if false (default), past unplayed parts will not count towards remaining time
					if (!partInstance.part.startedPlayback && !partInstance.part.floated && partCounts) {
						remainingRundownDuration += partInstance.part.expectedDuration || 0
						// item is onAir right now, and it's is currently shorter than expectedDuration
					} else if (
						partInstance.part.startedPlayback &&
						lastStartedPlayback &&
						!partInstance.part.duration &&
						playlist.currentPartInstanceId === partInstance._id &&
						lastStartedPlayback + (partInstance.part.expectedDuration || 0) > now
					) {
						remainingRundownDuration += (partInstance.part.expectedDuration || 0) - (now - lastStartedPlayback)
					}
				})

				// This is where the waitAccumulator-generated data in the linearSegLines is used to calculate the countdowns.
				let localAccum = 0
				for (let i = 0; i < this.linearParts.length; i++) {
					if (i < nextAIndex) {
						// this is a line before next line
						localAccum = this.linearParts[i][1] || 0
						// only null the values if not looping, if looping, these will be offset by the countdown for the last part
						if (!playlist.loop) {
							this.linearParts[i][1] = null // we use null to express 'will not probably be played out, if played in order'
						}
					} else if (i === nextAIndex) {
						// this is a calculation for the next line, which is basically how much there is left of the current line
						localAccum = this.linearParts[i][1] || 0 // if there is no current line, rebase following lines to the next line
						this.linearParts[i][1] = currentRemaining
					} else {
						// these are lines after next line
						// we take whatever value this line has, subtract the value as set on the Next Part
						// (note that the Next Part value will be using currentRemaining as the countdown)
						// and add the currentRemaining countdown, since we are currentRemaining + diff between next and
						// this away from this line.
						this.linearParts[i][1] = (this.linearParts[i][1] || 0) - localAccum + currentRemaining
					}
				}
				// contiunation of linearParts calculations for looping playlists
				if (playlist.loop) {
					for (let i = 0; i < nextAIndex; i++) {
						// offset the parts before the on air line by the countdown for the end of the rundown
						this.linearParts[i][1] = (this.linearParts[i][1] || 0) + waitAccumulator - localAccum + currentRemaining
					}
				}

				// if (this.refreshDecimator % LOW_RESOLUTION_TIMING_DECIMATOR === 0) {
				// 	const c = document.getElementById('debug-console')
				// 	if (c) c.innerHTML = debugConsole.replace(/\n/g, '<br>')
				// }
			}

			let remainingTimeOnCurrentPart: number | undefined = undefined
			let currentPartWillAutoNext = false
			if (currentAIndex >= 0) {
				const currentLivePart = parts[currentAIndex]

				const lastStartedPlayback = currentLivePart.getLastStartedPlayback()

				let onAirPartDuration = currentLivePart.duration || currentLivePart.expectedDuration || 0
				if (currentLivePart.displayDurationGroup && !currentLivePart.displayDuration) {
					onAirPartDuration =
						this.partDisplayDurationsNoPlayback[unprotectString(currentLivePart._id)] || onAirPartDuration
				}

				remainingTimeOnCurrentPart =
					currentLivePart.startedPlayback && lastStartedPlayback
						? now - (lastStartedPlayback + onAirPartDuration)
						: onAirPartDuration * -1

				currentPartWillAutoNext = !!(
					currentLivePart.autoNext &&
					(currentLivePart.expectedDuration !== undefined ? currentLivePart.expectedDuration !== 0 : false)
				)
			}

			this.durations = Object.assign(
				this.durations,
				literal<RundownTiming.RundownTimingContext>({
					totalRundownDuration,
					remainingRundownDuration,
					asDisplayedRundownDuration,
					asPlayedRundownDuration,
					partCountdown: _.object(this.linearParts),
					partDurations: this.partDurations,
					partPlayed: this.partPlayed,
					partStartsAt: this.partStartsAt,
					partDisplayStartsAt: this.partDisplayStartsAt,
					partExpectedDurations: this.partExpectedDurations,
					partDisplayDurations: this.partDisplayDurations,
					currentTime: now,
					remainingTimeOnCurrentPart,
					currentPartWillAutoNext,
					isLowResolution,
				})
			)
		}

		render() {
			return this.props.children
		}
	}
)

export type TimingFilterFunction = (durations: RundownTiming.RundownTimingContext) => any

export interface WithTimingOptions {
	isHighResolution?: boolean
	filter?: TimingFilterFunction | string | (string | number)[]
}
export type WithTiming<T> = T & RundownTiming.InjectedROTimingProps & { children?: React.ReactNode }
type IWrappedComponent<IProps, IState> = new (props: WithTiming<IProps>, state: IState) => React.Component<
	WithTiming<IProps>,
	IState
>

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
export function withTiming<IProps, IState>(
	options?: WithTimingOptions | ((props: IProps) => WithTimingOptions)
): (
	WrappedComponent: IWrappedComponent<IProps, IState>
) => new (props: IProps, context: any) => React.Component<IProps, IState> {
	let expandedOptions: WithTimingOptions = {
		isHighResolution: false,
		...(typeof options === 'function' ? {} : options),
	}

	return (WrappedComponent) => {
		return class WithTimingHOCComponent extends React.Component<IProps, IState> {
			static contextTypes = {
				durations: PropTypes.object.isRequired,
			}

			filterGetter: (o: any) => any
			previousValue: any = undefined
			isDirty: boolean = false

			constructor(props, context) {
				super(props, context)

				if (typeof options === 'function') {
					expandedOptions = {
						...expandedOptions,
						...options(this.props),
					}
				}

				if (typeof expandedOptions.filter === 'function') {
					this.filterGetter = expandedOptions.filter
				} else if (expandedOptions.filter) {
					this.filterGetter = _.property(expandedOptions.filter as string)
				}
			}

			componentDidMount() {
				window.addEventListener(
					expandedOptions.isHighResolution ? RundownTiming.Events.timeupdateHR : RundownTiming.Events.timeupdate,
					this.refreshComponent
				)
			}

			componentWillUnmount() {
				window.removeEventListener(
					expandedOptions.isHighResolution ? RundownTiming.Events.timeupdateHR : RundownTiming.Events.timeupdate,
					this.refreshComponent
				)
			}

			refreshComponent = () => {
				if (!this.filterGetter) {
					this.forceUpdate()
				} else {
					const buf = this.filterGetter(this.context.durations || {})
					if (this.isDirty || !_.isEqual(buf, this.previousValue)) {
						this.previousValue = buf
						this.isDirty = false
						this.forceUpdate()
					}
				}
			}

			render() {
				const durations: RundownTiming.RundownTimingContext = this.context.durations

				// If the timing HOC is supposed to be low resolution and we are rendering
				// during a high resolution tick, the WrappedComponent will render using
				// a RundownTimingContext that has not gone through the filter and thus
				// previousValue may go out of sync.
				// To bring it back to sync, we mark the component as dirty, which will
				// force an update on the next low resoluton tick, regardless of what
				// the filter says.
				if (this.filterGetter && durations.isLowResolution !== !expandedOptions.isHighResolution) {
					this.isDirty = true
				}

				return <WrappedComponent {...this.props} timingDurations={durations} />
			}
		}
	}
}

interface IPartCountdownProps {
	partId?: PartId
	hideOnZero?: boolean
}

/**
 * A presentational component that will render a countdown to a given Part
 * @class PartCountdown
 * @extends React.Component<WithTiming<IPartCountdownProps>>
 */
export const PartCountdown = withTiming<IPartCountdownProps, {}>()(
	class PartCountdown extends React.Component<WithTiming<IPartCountdownProps>> {
		render() {
			return (
				<span>
					{this.props.partId &&
						this.props.timingDurations &&
						this.props.timingDurations.partCountdown &&
						this.props.timingDurations.partCountdown[unprotectString(this.props.partId)] !== undefined &&
						(this.props.hideOnZero !== true ||
							this.props.timingDurations.partCountdown[unprotectString(this.props.partId)] > 0) &&
						RundownUtils.formatTimeToShortTime(
							this.props.timingDurations.partCountdown[unprotectString(this.props.partId)]
						)}
				</span>
			)
		}
	}
)

export const AutoNextStatus = withTiming<{}, {}>({
	filter: 'currentPartWillAutoNext',
	isHighResolution: true,
})(
	class AutoNextStatus extends React.Component<WithTiming<{}>> {
		render() {
			return this.props.timingDurations.currentPartWillAutoNext ? (
				<div className="rundown-view__part__icon rundown-view__part__icon--auto-next"></div>
			) : (
				<div className="rundown-view__part__icon rundown-view__part__icon--next"></div>
			)
		}
	}
)

const SPEAK_ADVANCE = 500

interface IPartRemainingProps {
	currentPartInstanceId: PartInstanceId | null
	hideOnZero?: boolean
	className?: string
	heavyClassName?: string
	speaking?: boolean
}

// global variable for remembering last uttered displayTime
let prevDisplayTime: number | undefined = undefined

/**
 * A presentational component that will render a countdown to the end of the current part
 * @class CurrentPartRemaining
 * @extends React.Component<WithTiming<{}>>
 */
export const CurrentPartRemaining = withTiming<IPartRemainingProps, {}>({
	isHighResolution: true,
})(
	class CurrentPartRemaining extends React.Component<WithTiming<IPartRemainingProps>> {
		render() {
			const displayTimecode = this.props.timingDurations.remainingTimeOnCurrentPart
			return (
				<span
					className={ClassNames(
						this.props.className,
						Math.floor((displayTimecode || 0) / 1000) > 0 ? this.props.heavyClassName : undefined
					)}>
					{RundownUtils.formatDiffToTimecode(displayTimecode || 0, true, false, true, false, true, '', false, true)}
				</span>
			)
		}

		speak(displayTime: number) {
			let text = '' // Say nothing

			navigator.vibrate([400, 300, 400, 300, 400])

			switch (displayTime) {
				case -1:
					text = 'One'
					break
				case -2:
					text = 'Two'
					break
				case -3:
					text = 'Three'
					break
				case -4:
					text = 'Four'
					break
				case -5:
					text = 'Five'
					break
				case -6:
					text = 'Six'
					break
				case -7:
					text = 'Seven'
					break
				case -8:
					text = 'Eight'
					break
				case -9:
					text = 'Nine'
					break
				case -10:
					text = 'Ten'
					break
			}
			// if (displayTime === 0 && prevDisplayTime !== undefined) {
			// 	text = 'Zero'
			// }

			if (text) {
				SpeechSynthesiser.speak(text, 'countdown')
			}
		}

		vibrate(displayTime: number) {
			navigator.vibrate([400, 300, 400, 300, 400])

			switch (displayTime) {
				case 0:
					navigator.vibrate([500])
				case -1:
				case -2:
				case -3:
					navigator.vibrate([250])
			}
		}

		act() {
			// Note that the displayTime is negative when counting down to 0.
			let displayTime = this.props.timingDurations.remainingTimeOnCurrentPart || 0

			if (displayTime === 0) {
				// do nothing
			} else {
				displayTime += SPEAK_ADVANCE
				displayTime = Math.floor(displayTime / 1000)
			}

			if (prevDisplayTime !== displayTime) {
				if (this.props.speaking) {
					this.speak(displayTime)
				}

				this.vibrate(displayTime)

				prevDisplayTime = displayTime
			}
		}

		componentDidUpdate(prevProps: WithTiming<IPartRemainingProps>) {
			if (this.props.currentPartInstanceId !== prevProps.currentPartInstanceId) {
				prevDisplayTime = undefined
			}
			this.act()
		}
	}
)

interface ISegmentDurationProps {
	partIds: PartId[]
}

/**
 * A presentational component that will render a counter that will show how much content
 * is left in a segment consisting of given parts
 * @class SegmentDuration
 * @extends React.Component<WithTiming<ISegmentDurationProps>>
 */
export const SegmentDuration = withTiming<ISegmentDurationProps, {}>()(
	class SegmentDuration extends React.Component<WithTiming<ISegmentDurationProps>> {
		render() {
			if (
				this.props.partIds &&
				this.props.timingDurations.partExpectedDurations &&
				this.props.timingDurations.partPlayed
			) {
				let partExpectedDurations = this.props.timingDurations.partExpectedDurations
				let partPlayed = this.props.timingDurations.partPlayed

				const duration = this.props.partIds.reduce((memo, partId) => {
					const pId = unprotectString(partId)
					return partExpectedDurations[pId] !== undefined
						? memo + Math.max(0, partExpectedDurations[pId] - (partPlayed[pId] || 0))
						: memo
				}, 0)

				return (
					<span className={duration < 0 ? 'negative' : undefined}>
						{RundownUtils.formatDiffToTimecode(duration, false, false, true, false, true, '+')}
					</span>
				)
			}

			return null
		}
	}
)

/**
 * Computes the actual (as-played fallbacking to expected) duration of a segment, consisting of given parts
 * @export
 * @param  {RundownTiming.RundownTimingContext} timingDurations The timing durations calculated for the Rundown
 * @param  {Array<string>} partIds The IDs of parts that are members of the segment
 * @return number
 */
export function computeSegmentDuration(
	timingDurations: RundownTiming.RundownTimingContext,
	partIds: PartId[],
	display?: boolean
): number {
	let partDurations = timingDurations.partDurations

	if (partDurations === undefined) return 0

	return partIds.reduce((memo, partId) => {
		const pId = unprotectString(partId)
		const partDuration =
			(partDurations ? (partDurations[pId] !== undefined ? partDurations[pId] : 0) : 0) ||
			(display ? Settings.defaultDisplayDuration : 0)
		return memo + partDuration
	}, 0)
}
