import React, { PropsWithChildren } from 'react'
import { Meteor } from 'meteor/meteor'
import * as PropTypes from 'prop-types'
import { withTracker } from '../../../lib/ReactMeteorData/react-meteor-data'
import { getCurrentTime, protectString } from '../../../../lib/lib'
import { DBRundownPlaylist, QuickLoopMarkerType } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { PartInstance, wrapPartToTemporaryInstance } from '../../../../lib/collections/PartInstances'
import { RundownTiming, TimeEventArgs } from './RundownTiming'
import { Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import {
	RundownTimingCalculator,
	RundownTimingContext,
	TimingId,
	getPartInstanceTimingId,
} from '../../../lib/rundownTiming'
import { PartId, PartInstanceId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { RundownPlaylistCollectionUtil } from '../../../../lib/collections/rundownPlaylistUtil'
import { sortPartInstancesInSortedSegments } from '@sofie-automation/corelib/dist/playout/playlist'
import { CalculateTimingsPiece } from '@sofie-automation/corelib/dist/playout/timings'
import { isLoopDefined, isLoopLocked } from '../../../../lib/Rundown'
import { RundownUtils } from '../../../lib/rundown'

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
	playlist?: DBRundownPlaylist

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
	partInstances: Array<MinimalPartInstance>
	partInstancesMap: Map<PartId, MinimalPartInstance>
	pieces: Map<PartId, CalculateTimingsPiece[]>
	segmentEntryPartInstances: MinimalPartInstance[]
	segments: DBSegment[]
	segmentsMap: Map<SegmentId, DBSegment>
	partsInQuickLoop: Record<TimingId, boolean>
}

type MinimalPartInstance = Pick<
	PartInstance,
	'_id' | 'isTemporary' | 'rundownId' | 'segmentId' | 'segmentPlayoutId' | 'takeCount' | 'part' | 'timings' | 'orphaned'
>

/**
 * RundownTimingProvider is a container component that provides a timing context to all child elements.
 * It allows calculating a single
 * @class RundownTimingProvider
 * @extends React.Component<PropsWithChildren<IRundownTimingProviderProps>>
 */
export const RundownTimingProvider = withTracker<
	PropsWithChildren<IRundownTimingProviderProps>,
	IRundownTimingProviderState,
	IRundownTimingProviderTrackedProps
>(({ playlist }) => {
	if (!playlist) {
		return {
			rundowns: [],
			currentRundown: undefined,
			partInstances: [],
			partInstancesMap: new Map(),
			pieces: new Map(),
			segmentEntryPartInstances: [],
			segments: [],
			segmentsMap: new Map(),
			partsInQuickLoop: {},
		}
	}

	const partInstancesMap = new Map<PartId, MinimalPartInstance>()
	const segmentEntryPartInstances: MinimalPartInstance[] = []

	const rundowns = RundownPlaylistCollectionUtil.getRundownsOrdered(playlist)
	const segments = RundownPlaylistCollectionUtil.getSegments(playlist)
	const segmentsMap = new Map<SegmentId, DBSegment>(segments.map((segment) => [segment._id, segment]))
	const unorderedParts = RundownPlaylistCollectionUtil.getUnorderedParts(playlist)
	const activePartInstances = RundownPlaylistCollectionUtil.getActivePartInstances(playlist, undefined, {
		projection: {
			_id: 1,
			rundownId: 1,
			segmentId: 1,
			isTemporary: 1,
			segmentPlayoutId: 1,
			takeCount: 1,
			part: 1,
			timings: 1,
			orphaned: 1,
		},
	}) as Array<
		Pick<
			PartInstance,
			| '_id'
			| 'rundownId'
			| 'segmentId'
			| 'isTemporary'
			| 'segmentPlayoutId'
			| 'takeCount'
			| 'part'
			| 'timings'
			| 'orphaned'
		>
	>

	const { currentPartInstance, previousPartInstance } = findCurrentAndPreviousPartInstance(
		activePartInstances,
		playlist.currentPartInfo?.partInstanceId,
		playlist.previousPartInfo?.partInstanceId
	)

	const currentRundown = currentPartInstance
		? rundowns.find((r) => r._id === currentPartInstance.rundownId)
		: rundowns[0]
	// These are needed to retrieve the start time of a segment for calculating the remaining budget, in case the first partInstance was removed

	let firstPartInstanceInCurrentSegmentPlay: MinimalPartInstance | undefined
	let firstPartInstanceInCurrentSegmentPlayPartInstanceTakeCount = Number.POSITIVE_INFINITY
	let firstPartInstanceInPreviousSegmentPlay: MinimalPartInstance | undefined
	let firstPartInstanceInPreviousSegmentPlayPartInstanceTakeCount = Number.POSITIVE_INFINITY

	let partInstances: MinimalPartInstance[] = []

	const allPartIds: Set<PartId> = new Set()

	for (const partInstance of activePartInstances) {
		if (
			currentPartInstance &&
			partInstance.segmentPlayoutId === currentPartInstance.segmentPlayoutId &&
			partInstance.takeCount < firstPartInstanceInCurrentSegmentPlayPartInstanceTakeCount
		) {
			firstPartInstanceInCurrentSegmentPlay = partInstance
			firstPartInstanceInCurrentSegmentPlayPartInstanceTakeCount = partInstance.takeCount
		}
		if (
			previousPartInstance &&
			partInstance.segmentPlayoutId === previousPartInstance.segmentPlayoutId &&
			partInstance.takeCount < firstPartInstanceInPreviousSegmentPlayPartInstanceTakeCount
		) {
			firstPartInstanceInPreviousSegmentPlay = partInstance
			firstPartInstanceInPreviousSegmentPlayPartInstanceTakeCount = partInstance.takeCount
		}

		allPartIds.add(partInstance.part._id)
	}

	partInstances = activePartInstances

	for (const part of unorderedParts) {
		if (allPartIds.has(part._id)) continue
		partInstances.push(wrapPartToTemporaryInstance(playlist.activationId ?? protectString(''), part))
	}

	partInstances = sortPartInstancesInSortedSegments(partInstances, segments)

	partInstances = RundownUtils.deduplicatePartInstancesForQuickLoop(playlist, partInstances, currentPartInstance)

	const partsInQuickLoop = findPartInstancesInQuickLoop(playlist, partInstances)

	if (firstPartInstanceInCurrentSegmentPlay) segmentEntryPartInstances.push(firstPartInstanceInCurrentSegmentPlay)
	if (firstPartInstanceInPreviousSegmentPlay) segmentEntryPartInstances.push(firstPartInstanceInPreviousSegmentPlay)

	const pieces = RundownPlaylistCollectionUtil.getPiecesForParts(Array.from(allPartIds.values()))

	return {
		rundowns,
		currentRundown,
		partInstances,
		partInstancesMap,
		pieces,
		segmentEntryPartInstances,
		segments,
		segmentsMap,
		partsInQuickLoop,
	}
})(
	class RundownTimingProvider
		extends React.Component<
			PropsWithChildren<IRundownTimingProviderProps> & IRundownTimingProviderTrackedProps,
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
		refreshTimer: number | undefined
		refreshTimerInterval: number
		refreshDecimator: number

		private timingCalculator: RundownTimingCalculator = new RundownTimingCalculator()
		/** last time (ms rounded down to full seconds) for which the timeupdateSynced event was dispatched */
		private lastSyncedTime = 0

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
			;(window as any)['rundownTimingContext'] = this.durations
		}

		componentDidUpdate(prevProps: IRundownTimingProviderProps & IRundownTimingProviderTrackedProps) {
			// change refresh interval if needed
			if (this.refreshTimerInterval !== this.props.refreshInterval && this.refreshTimer) {
				this.refreshTimerInterval = this.props.refreshInterval || TIMING_DEFAULT_REFRESH_INTERVAL
				Meteor.clearInterval(this.refreshTimer)
				this.refreshTimer = Meteor.setInterval(this.onRefreshTimer, this.refreshTimerInterval)
			}
			if (
				prevProps.partInstances !== this.props.partInstances ||
				prevProps.playlist?.nextPartInfo?.partInstanceId !== this.props.playlist?.nextPartInfo?.partInstanceId ||
				prevProps.playlist?.currentPartInfo?.partInstanceId !== this.props.playlist?.currentPartInfo?.partInstanceId
			) {
				this.refreshDecimator = 0 // Force LR update
				this.lastSyncedTime = 0 // Force synced update
				this.onRefreshTimer()
			}
		}

		componentWillUnmount(): void {
			delete (window as any)['rundownTimingContext']
			if (this.refreshTimer !== undefined) Meteor.clearInterval(this.refreshTimer)
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
				partInstances,
				partInstancesMap,
				pieces,
				segmentsMap,
				segmentEntryPartInstances,
			} = this.props
			const updatedDurations = this.timingCalculator.updateDurations(
				now,
				isSynced,
				playlist,
				rundowns,
				currentRundown,
				partInstances,
				partInstancesMap,
				pieces,
				segmentsMap,
				this.props.defaultDuration,
				segmentEntryPartInstances,
				this.props.partsInQuickLoop
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

function findPartInstancesInQuickLoop(
	playlist: DBRundownPlaylist,
	sortedPartInstances: MinimalPartInstance[]
): Record<TimingId, boolean> {
	const partsInQuickLoop: Record<TimingId, boolean> = {}
	if (
		!isLoopDefined(playlist) ||
		isLoopLocked(playlist) // a crude way of disabling the dots when looping the entire playlist
	) {
		return partsInQuickLoop
	}

	let isInQuickLoop = playlist.quickLoop?.start?.type === QuickLoopMarkerType.PLAYLIST
	let previousPartInstance: MinimalPartInstance | undefined = undefined
	for (const partInstance of sortedPartInstances) {
		if (
			previousPartInstance &&
			((playlist.quickLoop?.end?.type === QuickLoopMarkerType.PART &&
				playlist.quickLoop.end.id === previousPartInstance.part._id) ||
				(playlist.quickLoop?.end?.type === QuickLoopMarkerType.SEGMENT &&
					playlist.quickLoop.end.id === previousPartInstance.segmentId) ||
				(playlist.quickLoop?.end?.type === QuickLoopMarkerType.RUNDOWN &&
					playlist.quickLoop.end.id === previousPartInstance.rundownId))
		) {
			isInQuickLoop = false
			if (
				playlist.quickLoop.start?.type !== QuickLoopMarkerType.PART ||
				playlist.quickLoop.start?.id !== playlist.quickLoop.end?.id
			) {
				// when looping over a single part we need to include the three instances of that part shown at once, otherwise, we can break
				break
			}
		}
		if (
			!isInQuickLoop &&
			((playlist.quickLoop?.start?.type === QuickLoopMarkerType.PART &&
				playlist.quickLoop.start.id === partInstance.part._id) ||
				(playlist.quickLoop?.start?.type === QuickLoopMarkerType.SEGMENT &&
					playlist.quickLoop.start.id === partInstance.segmentId) ||
				(playlist.quickLoop?.start?.type === QuickLoopMarkerType.RUNDOWN &&
					playlist.quickLoop.start.id === partInstance.rundownId))
		) {
			isInQuickLoop = true
		}
		if (isInQuickLoop) {
			partsInQuickLoop[getPartInstanceTimingId(partInstance)] = true
		}
		previousPartInstance = partInstance
	}
	return partsInQuickLoop
}

function findCurrentAndPreviousPartInstance(
	activePartInstances: MinimalPartInstance[],
	currentPartInstanceId: PartInstanceId | undefined,
	previousPartInstanceId: PartInstanceId | undefined
) {
	let currentPartInstance: MinimalPartInstance | undefined
	let previousPartInstance: MinimalPartInstance | undefined
	// the activePartInstances are usually sorted ascending by takeCount, so it makes sense to start
	// at the end of the array, since that's where the latest PartInstances generally will be
	for (let i = activePartInstances.length - 1; i >= 0; i--) {
		const partInstance = activePartInstances[i]
		if (partInstance._id === currentPartInstanceId) currentPartInstance = partInstance
		if (partInstance._id === previousPartInstanceId) previousPartInstance = partInstance
		// we've found what we were looking for, we can stop
		if (
			(currentPartInstance || currentPartInstanceId === undefined) &&
			(previousPartInstance || previousPartInstanceId === undefined)
		)
			break
	}

	return {
		currentPartInstance,
		previousPartInstance,
	}
}
