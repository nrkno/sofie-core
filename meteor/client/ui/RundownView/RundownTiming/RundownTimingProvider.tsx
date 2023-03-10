import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import * as PropTypes from 'prop-types'
import { withTracker } from '../../../lib/ReactMeteorData/react-meteor-data'
import { Part } from '../../../../lib/collections/Parts'
import { getCurrentTime } from '../../../../lib/lib'
import { MeteorReactComponent } from '../../../lib/MeteorReactComponent'
import { RundownPlaylist } from '../../../../lib/collections/RundownPlaylists'
import { PartInstance } from '../../../../lib/collections/PartInstances'
import { RundownTiming, TimeEventArgs } from './RundownTiming'
import { Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { RundownTimingCalculator, RundownTimingContext } from '../../../lib/rundownTiming'
import { PartId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PartInstances } from '../../../collections'
import { RundownPlaylistCollectionUtil } from '../../../../lib/collections/rundownPlaylistUtil'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { CalculateTimingsPiece } from '@sofie-automation/corelib/dist/playout/timings'

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
	syncedDurations: RundownTimingContext
}
interface IRundownTimingProviderState {}
interface IRundownTimingProviderTrackedProps {
	rundowns: Array<Rundown>
	currentRundown: Rundown | undefined
	parts: Array<Part>
	partInstancesMap: Map<PartId, PartInstance>
	pieces: Map<PartId, CalculateTimingsPiece[]>
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
	let pieces: Map<PartId, Piece[]> = new Map()
	let currentRundown: Rundown | undefined
	const segmentEntryPartInstances: PartInstance[] = []
	if (props.playlist) {
		rundowns = RundownPlaylistCollectionUtil.getRundownsOrdered(props.playlist)
		const { parts: incomingParts, segments: incomingSegments } = RundownPlaylistCollectionUtil.getSegmentsAndPartsSync(
			props.playlist
		)
		parts = incomingParts
		segments = incomingSegments
		const partInstances = RundownPlaylistCollectionUtil.getActivePartInstances(props.playlist)

		const currentPartInstance = partInstances.find((p) => p._id === props.playlist?.currentPartInstanceId)
		const previousPartInstance = partInstances.find((p) => p._id === props.playlist?.previousPartInstanceId)

		currentRundown = currentPartInstance ? rundowns.find((r) => r._id === currentPartInstance.rundownId) : rundowns[0]
		// These are needed to retrieve the start time of a segment for calculating the remaining budget, in case the first partInstance was removed

		const firstPartInstanceInCurrentSegmentPlay =
			currentPartInstance &&
			PartInstances.findOne(
				{
					rundownId: currentPartInstance.rundownId,
					segmentPlayoutId: currentPartInstance.segmentPlayoutId,
				},
				{ sort: { takeCount: 1 } }
			)
		if (firstPartInstanceInCurrentSegmentPlay) segmentEntryPartInstances.push(firstPartInstanceInCurrentSegmentPlay)

		const firstPartInstanceInPreviousSegmentPlay =
			previousPartInstance &&
			previousPartInstance.segmentPlayoutId !== currentPartInstance?.segmentPlayoutId &&
			PartInstances.findOne(
				{
					rundownId: previousPartInstance.rundownId,
					segmentPlayoutId: previousPartInstance.segmentPlayoutId,
				},
				{ sort: { takeCount: 1 } }
			)
		if (firstPartInstanceInPreviousSegmentPlay) segmentEntryPartInstances.push(firstPartInstanceInPreviousSegmentPlay)

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
				} else if (foundSegment && partInstance.orphaned === 'adlib-part') {
					// Part is right at the end of the rundown
					parts.push(partInstance.part)
				}
			}
		})

		pieces = RundownPlaylistCollectionUtil.getPiecesForParts(parts.map((p) => p._id))
	}
	return {
		rundowns,
		currentRundown,
		parts,
		partInstancesMap,
		pieces,
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
			syncedDurations: PropTypes.object.isRequired,
		}

		durations: RundownTimingContext = {
			isLowResolution: false,
		}
		syncedDurations: RundownTimingContext = {
			isLowResolution: true,
		}
		refreshTimer: number
		refreshTimerInterval: number
		refreshDecimator: number

		private timingCalculator: RundownTimingCalculator = new RundownTimingCalculator()
		/** last time (ms rounded down to full seconds) for which the timeupdateSynced event was dispatched */
		private lastSyncedTime: number = 0

		constructor(props: IRundownTimingProviderProps & IRundownTimingProviderTrackedProps) {
			super(props)

			this.refreshTimerInterval = props.refreshInterval || TIMING_DEFAULT_REFRESH_INTERVAL

			this.refreshDecimator = 0
		}

		getChildContext(): IRundownTimingProviderChildContext {
			return {
				durations: this.durations,
				syncedDurations: this.syncedDurations,
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

			const dispatchLowResolution = this.refreshDecimator % LOW_RESOLUTION_TIMING_DECIMATOR === 0
			if (dispatchLowResolution) {
				this.dispatchLREvent(calmedDownNow)
			}

			const syncedEventTimeNow = Math.floor(now / 1000) * 1000
			const dispatchSynced = Math.abs(syncedEventTimeNow - this.lastSyncedTime) >= 1000
			if (dispatchSynced) {
				this.lastSyncedTime = syncedEventTimeNow
				this.updateDurations(syncedEventTimeNow, true)
				this.dispatchSyncedEvent(syncedEventTimeNow)
			}

			this.refreshDecimator++
		}

		componentDidMount(): void {
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

		componentWillUnmount(): void {
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

		updateDurations(now: number, isSynced: boolean) {
			const {
				playlist,
				rundowns,
				currentRundown,
				parts,
				partInstancesMap,
				pieces,
				segments,
				segmentEntryPartInstances,
			} = this.props
			const updatedDurations = this.timingCalculator.updateDurations(
				now,
				isSynced,
				playlist,
				rundowns,
				currentRundown,
				parts,
				partInstancesMap,
				pieces,
				segments,
				this.props.defaultDuration,
				segmentEntryPartInstances
			)
			if (!isSynced) {
				this.durations = Object.assign(this.durations, updatedDurations)
			} else {
				this.syncedDurations = Object.assign(this.syncedDurations, updatedDurations)
			}
		}

		render(): React.ReactNode {
			return this.props.children
		}
	}
)
