import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import * as PropTypes from 'prop-types'
import * as _ from 'underscore'
import { withTracker } from '../../../lib/ReactMeteorData/react-meteor-data'
import { Part, PartId } from '../../../../lib/collections/Parts'
import { getCurrentTime, literal, unprotectString } from '../../../../lib/lib'
import { MeteorReactComponent } from '../../../lib/MeteorReactComponent'
import { RundownPlaylist } from '../../../../lib/collections/RundownPlaylists'
import {
	PartInstance,
	findPartInstanceOrWrapToTemporary,
	wrapPartToTemporaryInstance,
} from '../../../../lib/collections/PartInstances'
import { Settings } from '../../../../lib/Settings'
import { RundownTiming, TimeEventArgs } from './RundownTiming'
import { LIVE_LINE_TIME_PADDING } from '../../SegmentTimeline/SegmentTimelinePart'
import { SegmentId } from '../../../../lib/collections/Segments'

// Minimum duration that a part can be assigned. Used by gap parts to allow them to "compress" to indicate time running out.
const MINIMAL_NONZERO_DURATION = 1

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
	/** Time scale of the rundown, used to calculate partLiveDisplayDurations */
	timeScale?: number
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
		private partLiveDisplayDurations: _.Dictionary<number> = {}
		private segmentBudgetDurations: _.Dictionary<number> = {}

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
				this.onRefreshTimer()
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

		static getCurrentLiveLinePosition(partInstance: PartInstance, currentTime: number): number {
			if (partInstance.timings?.startedPlayback) {
				if (partInstance.timings?.duration) {
					return partInstance.timings.duration
				} else {
					return currentTime - partInstance.timings.startedPlayback
				}
			} else {
				return 0
			}
		}

		static getLiveLineTimePadding(timeScale: number): number {
			return LIVE_LINE_TIME_PADDING / timeScale
		}

		static getLiveDuration(
			partInstance: PartInstance,
			partDurations: any,
			currentTime: number,
			isDurationSettling: boolean,
			isLive: boolean,
			timeScale: number
		): number {
			const startedPlayback = partInstance.timings?.startedPlayback
			let liveDuration = 0
			if (!isDurationSettling) {
				// if the duration isn't settling, calculate the live line postion and add some liveLive time padding
				if (isLive && !partInstance.part.autoNext) {
					// TODO: !nextProps.autoNextPart
					liveDuration = Math.max(
						(startedPlayback &&
							RundownTimingProvider.getCurrentLiveLinePosition(partInstance, currentTime) +
								RundownTimingProvider.getLiveLineTimePadding(timeScale)) ||
							0,
						partInstance.part.displayDuration || partDurations[unprotectString(partInstance.part._id)]
					)
				}
			} else {
				// if the duration is settling, just calculate the current liveLine position and show without any padding
				if (!partInstance.part.autoNext) {
					// TODO: !nextProps.autoNextPart
					liveDuration = Math.max(
						(startedPlayback && RundownTimingProvider.getCurrentLiveLinePosition(partInstance, currentTime)) || 0,
						partInstance.part.displayDuration || partDurations[unprotectString(partInstance.part._id)]
					)
				}
			}
			return liveDuration
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
			let segmentDisplayDuration = 0

			Object.keys(this.partLiveDisplayDurations).forEach((key) => delete this.partLiveDisplayDurations[key])
			Object.keys(this.displayDurationGroups).forEach((key) => delete this.displayDurationGroups[key])
			Object.keys(this.segmentBudgetDurations).forEach((key) => delete this.segmentBudgetDurations[key])

			this.linearParts.length = 0

			let debugConsole = ''

			const { playlist, parts, partInstancesMap } = this.props

			let previousAIndex = -1
			let nextAIndex = -1
			let currentAIndex = -1

			let lastSegmentId: SegmentId | undefined = undefined

			parts.forEach((origPart) => {
				if (origPart.budgetDuration !== undefined) {
					const segmentId = unprotectString(origPart.segmentId)
					if (this.segmentBudgetDurations[segmentId] !== undefined) {
						this.segmentBudgetDurations[unprotectString(origPart.segmentId)] += origPart.budgetDuration
					} else {
						this.segmentBudgetDurations[unprotectString(origPart.segmentId)] = origPart.budgetDuration
					}
				}
			})

			if (playlist && parts) {
				parts.forEach((origPart, itIndex) => {
					const partInstance = this.getPartInstanceOrGetCachedTemp(partInstancesMap, origPart)

					if (partInstance.segmentId !== lastSegmentId) {
						if (lastSegmentId) {
							const lastSegmentBudgetDuration = this.segmentBudgetDurations[unprotectString(lastSegmentId)]
							if (lastSegmentBudgetDuration > segmentDisplayDuration) {
								waitAccumulator += lastSegmentBudgetDuration - segmentDisplayDuration
							}
						}
						lastSegmentId = partInstance.segmentId
						segmentDisplayDuration = 0
					}

					// add piece to accumulator
					const aIndex = this.linearParts.push([partInstance.part._id, waitAccumulator]) - 1

					// if this is next segementLine, clear previous countdowns and clear accumulator
					if (playlist.nextPartInstanceId === partInstance._id) {
						nextAIndex = aIndex
					} else if (playlist.currentPartInstanceId === partInstance._id) {
						currentAIndex = aIndex
					} else if (playlist.previousPartInstanceId === partInstance._id) {
						previousAIndex = aIndex
					}

					const partCounts =
						playlist.outOfOrderTiming ||
						!playlist.active ||
						(itIndex >= currentAIndex && currentAIndex >= 0) ||
						(itIndex >= nextAIndex && nextAIndex >= 0 && currentAIndex === -1)

					// expected is just a sum of expectedDurations
					totalRundownDuration += partInstance.part.expectedDuration || 0

					const lastStartedPlayback = partInstance.timings?.startedPlayback
					const playOffset = partInstance.timings?.playOffset || 0

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
					if (lastStartedPlayback && !partInstance.timings?.duration) {
						// because displayDurationGroups have no actual timing on them, we need to have a copy of the
						// partDisplayDuration, but calculated as if it's not playing, so that the countdown can be
						// calculated
						partDisplayDurationNoPlayback =
							partInstance.timings?.duration ||
							(memberOfDisplayDurationGroup ? displayDurationFromGroup : partInstance.part.expectedDuration) ||
							this.props.defaultDuration ||
							Settings.defaultDisplayDuration
						partDisplayDuration = Math.max(partDisplayDurationNoPlayback, now - lastStartedPlayback)
						this.partPlayed[unprotectString(partInstance.part._id)] = now - lastStartedPlayback
						currentRemaining = Math.max(
							0,
							(partInstance.timings?.duration ||
								(memberOfDisplayDurationGroup ? displayDurationFromGroup : partInstance.part.expectedDuration) ||
								0) -
								(now - lastStartedPlayback)
						)
						partDuration =
							Math.max(
								partInstance.timings?.duration || partInstance.part.expectedDuration || 0,
								now - lastStartedPlayback
							) - playOffset
					} else {
						partDuration = (partInstance.timings?.duration || partInstance.part.expectedDuration || 0) - playOffset
						partDisplayDuration = Math.max(
							0,
							(partInstance.timings?.duration && partInstance.timings?.duration + playOffset) ||
								displayDurationFromGroup ||
								partInstance.part.expectedDuration ||
								this.props.defaultDuration ||
								Settings.defaultDisplayDuration
						)
						partDisplayDurationNoPlayback = partDisplayDuration
						this.partPlayed[unprotectString(partInstance.part._id)] = (partInstance.timings?.duration || 0) - playOffset
					}

					// asPlayed is the actual duration so far and expected durations in unplayed lines.
					// If item is onAir right now, it's duration is counted as expected duration or current
					// playback duration whichever is larger.
					// Parts that don't count are ignored.
					if (lastStartedPlayback && !partInstance.timings?.duration) {
						asPlayedRundownDuration += Math.max(
							memberOfDisplayDurationGroup
								? Math.max(displayDurationFromGroup, partInstance.part.expectedDuration || 0)
								: partInstance.part.expectedDuration || 0,
							now - lastStartedPlayback
						)
					} else if (partInstance.timings?.duration) {
						asPlayedRundownDuration += partInstance.timings.duration
					} else if (partCounts) {
						asPlayedRundownDuration += partInstance.part.expectedDuration || 0
					}

					// asDisplayed is the actual duration so far and expected durations in unplayed lines
					// If item is onAir right now, it's duration is counted as expected duration or current
					// playback duration whichever is larger.
					// All parts are counted.
					if (lastStartedPlayback && !partInstance.timings?.duration) {
						asDisplayedRundownDuration += Math.max(
							memberOfDisplayDurationGroup
								? Math.max(displayDurationFromGroup, partInstance.part.expectedDuration || 0)
								: partInstance.part.expectedDuration || 0,
							now - lastStartedPlayback
						)
					} else {
						asDisplayedRundownDuration += partInstance.timings?.duration || partInstance.part.expectedDuration || 0
					}

					// the part is the current part but has not yet started playback
					if (playlist.currentPartInstanceId === partInstance._id && !lastStartedPlayback) {
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
						(partInstance.timings?.duration || partCounts)
					) {
						this.displayDurationGroups[partInstance.part.displayDurationGroup] =
							this.displayDurationGroups[partInstance.part.displayDurationGroup] - partDisplayDuration
					}
					const partInstancePartId = unprotectString(partInstance.part._id)
					this.partExpectedDurations[partInstancePartId] =
						partInstance.part.expectedDuration || partInstance.timings?.duration || 0
					this.partStartsAt[partInstancePartId] = startsAtAccumulator
					this.partDisplayStartsAt[partInstancePartId] = displayStartsAtAccumulator
					this.partDurations[partInstancePartId] = partDuration
					this.partDisplayDurations[partInstancePartId] = partDisplayDuration
					this.partDisplayDurationsNoPlayback[partInstancePartId] = partDisplayDurationNoPlayback
					startsAtAccumulator += this.partDurations[partInstancePartId]
					displayStartsAtAccumulator += this.partDisplayDurations[partInstancePartId] // || this.props.defaultDuration || 3000
					// waitAccumulator is used to calculate the countdowns for Parts relative to the current Part
					// always add the full duration, in case by some manual intervention this segment should play twice
					let waitDuration = 0
					if (memberOfDisplayDurationGroup) {
						waitDuration =
							partInstance.timings?.duration || partDisplayDuration || partInstance.part.expectedDuration || 0
					} else {
						waitDuration = partInstance.timings?.duration || partInstance.part.expectedDuration || 0
					}

					waitAccumulator += waitDuration

					// remaining is the sum of unplayed lines + whatever is left of the current segment
					// if outOfOrderTiming is true, count parts before current part towards remaining rundown duration
					// if false (default), past unplayed parts will not count towards remaining time
					if (!lastStartedPlayback && !partInstance.part.floated && partCounts) {
						remainingRundownDuration += partInstance.part.expectedDuration || 0
						// item is onAir right now, and it's is currently shorter than expectedDuration
					} else if (
						lastStartedPlayback &&
						!partInstance.timings?.duration &&
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
				const currentLivePartInstance = findPartInstanceOrWrapToTemporary(partInstancesMap, currentLivePart)

				const lastStartedPlayback = currentLivePartInstance.timings?.startedPlayback

				let onAirPartDuration = currentLivePartInstance.timings?.duration || currentLivePart.expectedDuration || 0
				if (currentLivePart.displayDurationGroup && !currentLivePart.displayDuration) {
					onAirPartDuration =
						this.partDisplayDurationsNoPlayback[unprotectString(currentLivePart._id)] || onAirPartDuration
				}

				remainingTimeOnCurrentPart = lastStartedPlayback
					? now - (lastStartedPlayback + onAirPartDuration)
					: onAirPartDuration * -1

				currentPartWillAutoNext = !!(
					currentLivePart.autoNext &&
					(currentLivePart.expectedDuration !== undefined ? currentLivePart.expectedDuration !== 0 : false)
				)
				if (this.props.timeScale !== undefined) {
					this.partLiveDisplayDurations[unprotectString(currentLivePart._id)] = RundownTimingProvider.getLiveDuration(
						currentLivePartInstance,
						this.partDurations,
						now,
						false,
						true,
						this.props.timeScale
					)
				}
			}

			if (this.props.timeScale !== undefined && previousAIndex >= 0) {
				const previousLivePart = parts[previousAIndex]
				const previousLivePartInstance = findPartInstanceOrWrapToTemporary(partInstancesMap, previousLivePart)
				const startedPlayback = previousLivePartInstance.timings?.startedPlayback
				const isDurationSettling = !!playlist?.active && currentAIndex !== previousAIndex
				!!startedPlayback && !previousLivePartInstance.timings?.duration
				this.partLiveDisplayDurations[unprotectString(previousLivePart._id)] = RundownTimingProvider.getLiveDuration(
					previousLivePartInstance,
					this.partDurations,
					now,
					isDurationSettling,
					false,
					this.props.timeScale
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
					partLiveDisplayDurations: this.partLiveDisplayDurations,
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
