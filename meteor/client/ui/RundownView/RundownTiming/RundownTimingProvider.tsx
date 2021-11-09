import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import * as PropTypes from 'prop-types'
import { withTracker } from '../../../lib/ReactMeteorData/react-meteor-data'
import { Part, PartId } from '../../../../lib/collections/Parts'
import { getCurrentTime } from '../../../../lib/lib'
import { MeteorReactComponent } from '../../../lib/MeteorReactComponent'
import { RundownPlaylist } from '../../../../lib/collections/RundownPlaylists'
import { PartInstance } from '../../../../lib/collections/PartInstances'
import { RundownTiming, TimeEventArgs } from './RundownTiming'
import { RundownTimingCalculator, RundownTimingContext } from '../../../../lib/rundown/rundownTiming'
import { Rundown } from '../../../../lib/collections/Rundowns'
import _ from 'underscore'
import { DBSegment } from '../../../../lib/collections/Segments'

const TIMING_DEFAULT_REFRESH_INTERVAL = 1000 / 60 // the interval for high-resolution events (timeupdateHR)
const LOW_RESOLUTION_TIMING_DECIMATOR = 15

// LOW_RESOLUTION_TIMING_DECIMATOR-th time of the high-resolution events

const CURRENT_TIME_GRANULARITY = 1000 / 60

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
	durations: RundownTimingContext
	lowResDurations: RundownTimingContext
}
interface IRundownTimingProviderState {}
interface IRundownTimingProviderTrackedProps {
	rundowns: Array<Rundown>
	currentRundown: Rundown | undefined
	parts: Array<Part>
	partInstancesMap: Map<PartId, PartInstance>
	segmentEntryPartInstances: PartInstance[]
	segments: DBSegment[]
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
	let rundowns: Array<Rundown> = []
	let parts: Array<Part> = []
	let segments: Array<DBSegment> = []
	const partInstancesMap = new Map<PartId, PartInstance>()
	let currentRundown: Rundown | undefined
	const segmentEntryPartInstances: PartInstance[] = []
	if (props.playlist) {
		rundowns = props.playlist.getRundowns()
		const { parts: incomingParts, segments: incomingSegments } = props.playlist.getSegmentsAndPartsSync()
		parts = incomingParts
		segments = incomingSegments
		const partInstances = props.playlist.getActivePartInstances()

		const currentPartInstance = partInstances.find((p) => p._id === props.playlist!.currentPartInstanceId)
		const previousPartInstance = partInstances.find((p) => p._id === props.playlist!.previousPartInstanceId)
		currentRundown = currentPartInstance ? rundowns.find((r) => r._id === currentPartInstance.rundownId) : rundowns[0]
		segmentEntryPartInstances.push(
			..._.compact([
				currentPartInstance &&
					props.playlist.getPartInstancesForSegmentPlayout(
						currentPartInstance.rundownId,
						currentPartInstance.segmentPlayoutId
					)[0],
				previousPartInstance &&
					previousPartInstance.segmentPlayoutId !== currentPartInstance?.segmentPlayoutId &&
					props.playlist.getPartInstancesForSegmentPlayout(
						previousPartInstance.rundownId,
						previousPartInstance.segmentPlayoutId
					)[0],
			])
		)

		partInstances.forEach((partInstance) => {
			partInstancesMap.set(partInstance.part._id, partInstance)

			// if the part is orphaned, we need to inject it's part into the incoming parts in the correct position
			if (partInstance.orphaned) {
				let foundSegment = false
				let insertBefore: number | null = null
				for (let i = 0; i < parts.length; i++) {
					if (parts[i].segmentId === partInstance.segmentId) {
						// mark that we have found parts from the segment we're looking for
						foundSegment = true

						if (parts[i]._id === partInstance.part._id) {
							// the PartInstance is orphaned, but there's still the underlying part in the collection
							// let's skip for now.
							// this needs to be updated at some time since it should be treated as a different part at
							// this point.
							break
						} else if (parts[i]._rank > partInstance.part._rank) {
							// we have found a part with a rank greater than the rank of the orphaned PartInstance
							insertBefore = i
							break
						}
					} else if (foundSegment && parts[i].segmentId !== partInstance.segmentId) {
						// we have found parts from the segment we're looking for, but none of them had a rank
						// greater than the rank of the orphaned PartInstance. Lets insert the part before the first
						// part of the next segment
						insertBefore = i
						break
					}
				}

				if (insertBefore !== null) {
					parts.splice(insertBefore, 0, partInstance.part)
				}
			}
		})
	}
	return {
		rundowns,
		currentRundown,
		parts,
		partInstancesMap,
		segmentEntryPartInstances,
		segments,
	}
})(
	class RundownTimingProvider
		extends MeteorReactComponent<
			IRundownTimingProviderProps & IRundownTimingProviderTrackedProps,
			IRundownTimingProviderState
		>
		implements React.ChildContextProvider<IRundownTimingProviderChildContext>
	{
		static childContextTypes = {
			durations: PropTypes.object.isRequired,
			lowResDurations: PropTypes.object.isRequired,
		}

		durations: RundownTimingContext = {
			isLowResolution: false,
		}
		lowResDurations: RundownTimingContext = {
			isLowResolution: true,
		}
		refreshTimer: number
		refreshTimerInterval: number
		refreshDecimator: number

		private timingCalculator: RundownTimingCalculator = new RundownTimingCalculator()
		private lastSyncedTime: number = 0

		constructor(props: IRundownTimingProviderProps & IRundownTimingProviderTrackedProps) {
			super(props)

			this.refreshTimerInterval = props.refreshInterval || TIMING_DEFAULT_REFRESH_INTERVAL

			this.refreshDecimator = 0
		}

		getChildContext(): IRundownTimingProviderChildContext {
			return {
				durations: this.durations,
				lowResDurations: this.lowResDurations,
			}
		}

		calmDownTiming = (time: number) => {
			return Math.round(time / CURRENT_TIME_GRANULARITY) * CURRENT_TIME_GRANULARITY
		}

		onRefreshTimer = () => {
			const now = getCurrentTime()
			const calmedDownNow = this.calmDownTiming(now)
			this.updateDurations(calmedDownNow, false)
			this.dispatchHREvent(calmedDownNow)

			const isLowResolution = this.refreshDecimator % LOW_RESOLUTION_TIMING_DECIMATOR === 0
			if (isLowResolution) {
				this.dispatchLREvent(calmedDownNow)
			}

			const syncedEventTimeNow = Math.floor(now / 1000) * 1000
			const isSynced = Math.abs(syncedEventTimeNow - this.lastSyncedTime) >= 1000
			if (isSynced) {
				this.lastSyncedTime = syncedEventTimeNow
				this.updateDurations(syncedEventTimeNow, true)
				this.dispatchSyncedEvent(syncedEventTimeNow)
			}

			this.refreshDecimator++
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
			if (
				prevProps.parts !== this.props.parts ||
				prevProps.playlist?.nextPartInstanceId !== this.props.playlist?.nextPartInstanceId ||
				prevProps.playlist?.currentPartInstanceId !== this.props.playlist?.currentPartInstanceId
			) {
				// empty the temporary Part Instances cache
				this.timingCalculator.clearTempPartInstances()
				this.onRefreshTimer()
			}
		}

		componentWillUnmount() {
			this._cleanUp()
			delete window['rundownTimingContext']
			Meteor.clearInterval(this.refreshTimer)
		}

		dispatchHREvent(now: number) {
			const event = new CustomEvent<TimeEventArgs>(RundownTiming.Events.timeupdateHighResolution, {
				detail: {
					currentTime: now,
				},
				cancelable: false,
			})
			window.dispatchEvent(event)
		}

		dispatchLREvent(now: number) {
			const event = new CustomEvent<TimeEventArgs>(RundownTiming.Events.timeupdateLowResolution, {
				detail: {
					currentTime: now,
				},
				cancelable: false,
			})
			window.dispatchEvent(event)
		}

		dispatchSyncedEvent(now: number) {
			const event = new CustomEvent<TimeEventArgs>(RundownTiming.Events.timeupdateSynced, {
				detail: {
					currentTime: now,
				},
				cancelable: false,
			})
			window.dispatchEvent(event)
		}

		updateDurations(now: number, isLowResolution: boolean) {
			const { playlist, rundowns, currentRundown, parts, partInstancesMap, segmentEntryPartInstances, segments } =
				this.props
			const updatedDurations = this.timingCalculator.updateDurations(
				now,
				isLowResolution,
				playlist,
				rundowns,
				currentRundown,
				parts,
				partInstancesMap,
				segments,
				this.props.defaultDuration,
				segmentEntryPartInstances
			)
			if (!isLowResolution) {
				this.durations = Object.assign(this.durations, updatedDurations)
			} else {
				this.lowResDurations = Object.assign(this.lowResDurations, updatedDurations)
			}
		}

		render() {
			return this.props.children
		}
	}
)
