import * as React from 'react'
import ClassNames from 'classnames'
import { DBSegment, Segment } from '../../../lib/collections/Segments'
import { PartUi } from '../SegmentTimeline/SegmentTimelineContainer'
import {
	RundownPlaylistId,
	RundownPlaylist,
	RundownPlaylists,
	RundownPlaylistCollectionUtil,
} from '../../../lib/collections/RundownPlaylists'
import { ShowStyleBase, ShowStyleBaseId, ShowStyleBases } from '../../../lib/collections/ShowStyleBases'
import { Rundown, RundownId, Rundowns } from '../../../lib/collections/Rundowns'
import { withTranslation, WithTranslation } from 'react-i18next'
import { withTiming, WithTiming } from '../RundownView/RundownTiming/withTiming'
import { Translated, withTracker } from '../../lib/ReactMeteorData/ReactMeteorData'
import { extendMandadory, getCurrentTime, protectString, unprotectString } from '../../../lib/lib'
import { PartInstance } from '../../../lib/collections/PartInstances'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { PubSub } from '../../../lib/api/pubsub'
import { PieceIconContainer } from '../PieceIcons/PieceIcon'
import { PieceNameContainer } from '../PieceIcons/PieceName'
import { Timediff } from './Timediff'
import { RundownUtils } from '../../lib/rundown'
import { PieceInstances } from '../../../lib/collections/PieceInstances'
import { PieceLifespan } from '@sofie-automation/blueprints-integration'
import { Part } from '../../../lib/collections/Parts'
import { PieceCountdownContainer } from '../PieceIcons/PieceCountdown'
import { PlaylistTiming } from '@sofie-automation/corelib/dist/playout/rundownTiming'
import {
	DashboardLayout,
	RundownLayoutBase,
	RundownLayoutPresenterView,
	RundownLayouts,
} from '../../../lib/collections/RundownLayouts'
import { RundownLayoutId, ShowStyleVariantId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ShowStyleVariant, ShowStyleVariants } from '../../../lib/collections/ShowStyleVariants'
import { Studio, Studios } from '../../../lib/collections/Studios'
import { RundownLayoutsAPI } from '../../../lib/api/rundownLayouts'
import { ShelfDashboardLayout } from '../Shelf/ShelfDashboardLayout'
import { parse as queryStringParse } from 'query-string'
import { calculatePartInstanceExpectedDurationWithPreroll } from '@sofie-automation/corelib/dist/playout/timings'
import { getPlaylistTimingDiff } from '../../lib/rundownTiming'

interface SegmentUi extends DBSegment {
	items: Array<PartUi>
}

interface TimeMap {
	[key: string]: number
}

interface RundownOverviewProps {
	studioId: StudioId
	playlistId: RundownPlaylistId
	segmentLiveDurations?: TimeMap
}
interface RundownOverviewState {
	presenterLayout: RundownLayoutPresenterView | undefined
}
export interface RundownOverviewTrackedProps {
	studio: Studio | undefined
	playlist?: RundownPlaylist
	rundowns: Rundown[]
	segments: Array<SegmentUi>
	currentSegment: SegmentUi | undefined
	currentPartInstance: PartUi | undefined
	nextSegment: SegmentUi | undefined
	nextPartInstance: PartUi | undefined
	currentShowStyleBaseId: ShowStyleBaseId | undefined
	currentShowStyleBase: ShowStyleBase | undefined
	currentShowStyleVariantId: ShowStyleVariantId | undefined
	currentShowStyleVariant: ShowStyleVariant | undefined
	nextShowStyleBaseId: ShowStyleBaseId | undefined
	showStyleBaseIds: ShowStyleBaseId[]
	rundownIds: RundownId[]
	rundownLayouts?: Array<RundownLayoutBase>
	presenterLayoutId: RundownLayoutId | undefined
}

function getShowStyleBaseIdSegmentPartUi(
	partInstance: PartInstance,
	playlist: RundownPlaylist,
	orderedSegmentsAndParts: {
		segments: Segment[]
		parts: Part[]
	},
	rundownsToShowstyles: Map<RundownId, ShowStyleBaseId>,
	currentPartInstance: PartInstance | undefined,
	nextPartInstance: PartInstance | undefined
): {
	showStyleBaseId: ShowStyleBaseId | undefined
	showStyleBase: ShowStyleBase | undefined
	showStyleVariantId: ShowStyleVariantId | undefined
	showStyleVariant: ShowStyleVariant | undefined
	segment: SegmentUi | undefined
	partInstance: PartUi | undefined
} {
	let showStyleBaseId: ShowStyleBaseId | undefined = undefined
	let showStyleBase: ShowStyleBase | undefined = undefined
	let showStyleVariantId: ShowStyleVariantId | undefined = undefined
	let showStyleVariant: ShowStyleVariant | undefined = undefined
	let segment: SegmentUi | undefined = undefined
	let partInstanceUi: PartUi | undefined = undefined

	const currentRundown = Rundowns.findOne(partInstance.rundownId, {
		fields: {
			_id: 1,
			showStyleBaseId: 1,
			showStyleVariantId: 1,
			name: 1,
			timing: 1,
		},
	})
	showStyleBaseId = currentRundown?.showStyleBaseId
	showStyleVariantId = currentRundown?.showStyleVariantId

	const segmentIndex = orderedSegmentsAndParts.segments.findIndex((s) => s._id === partInstance.segmentId)
	if (currentRundown && segmentIndex >= 0) {
		const rundownOrder = RundownPlaylistCollectionUtil.getRundownOrderedIDs(playlist)
		const rundownIndex = rundownOrder.indexOf(partInstance.rundownId)
		showStyleBase = ShowStyleBases.findOne(showStyleBaseId)
		showStyleVariant = ShowStyleVariants.findOne(showStyleVariantId)

		if (showStyleBase) {
			// This registers a reactive dependency on infinites-capping pieces, so that the segment can be
			// re-evaluated when a piece like that appears.

			const o = RundownUtils.getResolvedSegment(
				showStyleBase,
				playlist,
				currentRundown,
				orderedSegmentsAndParts.segments[segmentIndex],
				new Set(orderedSegmentsAndParts.segments.map((s) => s._id).slice(0, segmentIndex)),
				rundownOrder.slice(0, rundownIndex),
				rundownsToShowstyles,
				orderedSegmentsAndParts.parts.map((part) => part._id),
				currentPartInstance,
				nextPartInstance,
				true,
				true
			)

			segment = extendMandadory<DBSegment, SegmentUi>(o.segmentExtended, {
				items: o.parts,
			})

			partInstanceUi = o.parts.find((part) => part.instance._id === partInstance._id)
		}
	}

	return {
		showStyleBaseId: showStyleBaseId,
		showStyleBase,
		showStyleVariantId,
		showStyleVariant,
		segment: segment,
		partInstance: partInstanceUi,
	}
}

export const getPresenterScreenReactive = (props: RundownOverviewProps): RundownOverviewTrackedProps => {
	const studio = Studios.findOne(props.studioId)
	let playlist: RundownPlaylist | undefined

	if (props.playlistId)
		playlist = RundownPlaylists.findOne(props.playlistId, {
			fields: {
				lastIncorrectPartPlaybackReported: 0,
				modified: 0,
				nextPartManual: 0,
				previousPersistentState: 0,
				rundownRanksAreSetInSofie: 0,
				trackedAbSessions: 0,
				restoredFromSnapshotId: 0,
			},
		})
	const segments: Array<SegmentUi> = []
	let showStyleBaseIds: ShowStyleBaseId[] = []
	let rundowns: Rundown[] = []
	let rundownIds: RundownId[] = []

	let currentSegment: SegmentUi | undefined = undefined
	let currentPartInstanceUi: PartUi | undefined = undefined
	let currentShowStyleBaseId: ShowStyleBaseId | undefined = undefined
	let currentShowStyleBase: ShowStyleBase | undefined = undefined
	let currentShowStyleVariantId: ShowStyleVariantId | undefined = undefined
	let currentShowStyleVariant: ShowStyleVariant | undefined = undefined

	let nextSegment: SegmentUi | undefined = undefined
	let nextPartInstanceUi: PartUi | undefined = undefined
	let nextShowStyleBaseId: ShowStyleBaseId | undefined = undefined

	const params = queryStringParse(location.search)
	const presenterLayoutId = protectString((params['presenterLayout'] as string) || '')

	if (playlist) {
		rundowns = RundownPlaylistCollectionUtil.getRundownsOrdered(playlist)
		const orderedSegmentsAndParts = RundownPlaylistCollectionUtil.getSegmentsAndPartsSync(playlist)
		rundownIds = rundowns.map((rundown) => rundown._id)
		const rundownsToShowstyles: Map<RundownId, ShowStyleBaseId> = new Map()
		for (const rundown of rundowns) {
			rundownsToShowstyles.set(rundown._id, rundown.showStyleBaseId)
		}
		showStyleBaseIds = rundowns.map((rundown) => rundown.showStyleBaseId)
		const { currentPartInstance, nextPartInstance } = RundownPlaylistCollectionUtil.getSelectedPartInstances(playlist)
		const partInstance = currentPartInstance || nextPartInstance
		if (partInstance) {
			// This is to register a reactive dependency on Rundown-spanning PieceInstances, that we may miss otherwise.
			PieceInstances.find({
				rundownId: {
					$in: rundownIds,
				},
				dynamicallyInserted: {
					$exists: true,
				},
				'infinite.fromPreviousPart': false,
				'piece.lifespan': {
					$in: [PieceLifespan.OutOnRundownEnd, PieceLifespan.OutOnRundownChange, PieceLifespan.OutOnShowStyleEnd],
				},
				reset: {
					$ne: true,
				},
			}).fetch()

			if (currentPartInstance) {
				const current = getShowStyleBaseIdSegmentPartUi(
					currentPartInstance,
					playlist,
					orderedSegmentsAndParts,
					rundownsToShowstyles,
					currentPartInstance,
					nextPartInstance
				)
				currentSegment = current.segment
				currentPartInstanceUi = current.partInstance
				currentShowStyleBaseId = current.showStyleBaseId
				currentShowStyleBase = current.showStyleBase
				currentShowStyleVariantId = current.showStyleVariantId
				currentShowStyleVariant = current.showStyleVariant
			}

			if (nextPartInstance) {
				const next = getShowStyleBaseIdSegmentPartUi(
					nextPartInstance,
					playlist,
					orderedSegmentsAndParts,
					rundownsToShowstyles,
					currentPartInstance,
					nextPartInstance
				)
				nextSegment = next.segment
				nextPartInstanceUi = next.partInstance
				nextShowStyleBaseId = next.showStyleBaseId
			}
		}
	}
	return {
		studio,
		segments,
		playlist,
		rundowns,
		showStyleBaseIds,
		rundownIds,
		currentSegment,
		currentPartInstance: currentPartInstanceUi,
		currentShowStyleBaseId,
		currentShowStyleBase,
		currentShowStyleVariantId,
		currentShowStyleVariant,
		nextSegment,
		nextPartInstance: nextPartInstanceUi,
		nextShowStyleBaseId,
		rundownLayouts:
			rundowns.length > 0 ? RundownLayouts.find({ showStyleBaseId: rundowns[0].showStyleBaseId }).fetch() : undefined,
		presenterLayoutId,
	}
}

export class PresenterScreenBase extends MeteorReactComponent<
	WithTiming<RundownOverviewProps & RundownOverviewTrackedProps & WithTranslation>,
	RundownOverviewState
> {
	protected bodyClassList: string[] = ['dark', 'xdark']

	constructor(props) {
		super(props)
		this.state = {
			presenterLayout: undefined,
		}
	}

	componentDidMount() {
		document.body.classList.add(...this.bodyClassList)
		this.subscribeToData()
	}

	protected subscribeToData() {
		this.autorun(() => {
			this.subscribe(PubSub.studios, {
				_id: this.props.studioId,
			})
			const playlist = RundownPlaylists.findOne(this.props.playlistId, {
				fields: {
					_id: 1,
					activationId: 1,
				},
			}) as Pick<RundownPlaylist, '_id' | 'activationId'> | undefined
			if (playlist) {
				this.subscribe(PubSub.rundowns, [playlist._id], null)

				this.autorun(() => {
					const rundowns = RundownPlaylistCollectionUtil.getRundownsUnordered(playlist, undefined, {
						fields: {
							_id: 1,
							showStyleBaseId: 1,
							showStyleVariantId: 1,
						},
					}) as Array<Pick<Rundown, '_id' | 'showStyleBaseId' | 'showStyleVariantId'>>
					const rundownIds = rundowns.map((r) => r._id)
					const showStyleBaseIds = rundowns.map((r) => r.showStyleBaseId)
					const showStyleVariantIds = rundowns.map((r) => r.showStyleVariantId)

					this.subscribe(PubSub.segments, {
						rundownId: { $in: rundownIds },
					})
					this.subscribe(PubSub.parts, rundownIds)
					this.subscribe(PubSub.partInstances, rundownIds, playlist.activationId)
					this.subscribe(PubSub.showStyleBases, {
						_id: {
							$in: showStyleBaseIds,
						},
					})
					this.subscribe(PubSub.showStyleVariants, {
						_id: {
							$in: showStyleVariantIds,
						},
					})
					this.subscribe(PubSub.rundownLayouts, {
						showStyleBaseId: {
							$in: showStyleBaseIds,
						},
					})

					this.autorun(() => {
						const playlistR = RundownPlaylists.findOne(this.props.playlistId, {
							fields: {
								_id: 1,
								currentPartInstanceId: 1,
								nextPartInstanceId: 1,
								previousPartInstanceId: 1,
							},
						}) as
							| Pick<RundownPlaylist, '_id' | 'currentPartInstanceId' | 'nextPartInstanceId' | 'previousPartInstanceId'>
							| undefined
						if (playlistR) {
							const { nextPartInstance, currentPartInstance } =
								RundownPlaylistCollectionUtil.getSelectedPartInstances(playlistR)
							if (currentPartInstance) {
								this.subscribe(PubSub.pieceInstances, {
									rundownId: currentPartInstance.rundownId,
									partInstanceId: currentPartInstance._id,
								})
							}
							if (nextPartInstance) {
								this.subscribe(PubSub.pieceInstances, {
									rundownId: nextPartInstance.rundownId,
									partInstanceId: nextPartInstance._id,
								})
							}
						}
					})
				})
			}
		})
	}

	static getDerivedStateFromProps(
		props: Translated<RundownOverviewProps & RundownOverviewTrackedProps>
	): Partial<RundownOverviewState> {
		let selectedPresenterLayout: RundownLayoutBase | undefined = undefined

		if (props.rundownLayouts) {
			// first try to use the one selected by the user
			if (props.presenterLayoutId) {
				selectedPresenterLayout = props.rundownLayouts.find((i) => i._id === props.presenterLayoutId)
			}

			// if couldn't find based on id, try matching part of the name
			if (props.presenterLayoutId && !selectedPresenterLayout) {
				selectedPresenterLayout = props.rundownLayouts.find(
					(i) => i.name.indexOf(unprotectString(props.presenterLayoutId!)) >= 0
				)
			}

			// if still not found, use the first one
			if (!selectedPresenterLayout) {
				selectedPresenterLayout = props.rundownLayouts.find((i) => RundownLayoutsAPI.isLayoutForPresenterView(i))
			}
		}

		return {
			presenterLayout:
				selectedPresenterLayout && RundownLayoutsAPI.isLayoutForPresenterView(selectedPresenterLayout)
					? selectedPresenterLayout
					: undefined,
		}
	}

	componentWillUnmount() {
		super.componentWillUnmount()
		document.body.classList.remove(...this.bodyClassList)
	}

	render() {
		if (this.state.presenterLayout && RundownLayoutsAPI.isDashboardLayout(this.state.presenterLayout)) {
			return this.renderDashboardLayout(this.state.presenterLayout)
		}
		return this.renderDefaultLayout()
	}

	renderDefaultLayout() {
		const { playlist, segments, currentShowStyleBaseId, nextShowStyleBaseId, playlistId } = this.props

		if (playlist && playlistId && segments) {
			const currentPart = this.props.currentPartInstance
			const currentSegment = this.props.currentSegment

			let currentPartCountdown = 0
			if (currentPart) {
				currentPartCountdown = -1 * (this.props.timingDurations.remainingTimeOnCurrentPart || 0)
			}

			const nextPart = this.props.nextPartInstance
			const nextSegment = this.props.nextSegment

			const expectedStart = PlaylistTiming.getExpectedStart(playlist.timing)
			const overUnderClock = getPlaylistTimingDiff(playlist, this.props.timingDurations) ?? 0

			return (
				<div className="presenter-screen">
					<div className="presenter-screen__part presenter-screen__part--current-part">
						<div
							className={ClassNames('presenter-screen__segment-name', {
								live: currentSegment !== undefined,
							})}
						>
							{currentSegment?.name}
						</div>
						{currentPart && currentShowStyleBaseId ? (
							<>
								<div className="presenter-screen__part__piece-icon">
									<PieceIconContainer
										partInstanceId={currentPart.instance._id}
										showStyleBaseId={currentShowStyleBaseId}
										rundownIds={this.props.rundownIds}
										playlistActivationId={this.props.playlist?.activationId}
									/>
								</div>
								<div className="presenter-screen__part__piece-name">
									<PieceNameContainer
										partName={currentPart.instance.part.title}
										partInstanceId={currentPart.instance._id}
										showStyleBaseId={currentShowStyleBaseId}
										rundownIds={this.props.rundownIds}
										playlistActivationId={this.props.playlist?.activationId}
									/>
								</div>
								<div className="presenter-screen__part__piece-countdown">
									<PieceCountdownContainer
										partInstanceId={currentPart.instance._id}
										showStyleBaseId={currentShowStyleBaseId}
										rundownIds={this.props.rundownIds}
										partAutoNext={currentPart.instance.part.autoNext || false}
										partExpectedDuration={calculatePartInstanceExpectedDurationWithPreroll(currentPart.instance)}
										partStartedPlayback={currentPart.instance.timings?.startedPlayback}
										playlistActivationId={this.props.playlist?.activationId}
									/>
								</div>
								<div className="presenter-screen__part__part-countdown">
									<Timediff time={currentPartCountdown} />
								</div>
							</>
						) : expectedStart ? (
							<div className="presenter-screen__rundown-countdown">
								<Timediff time={expectedStart - getCurrentTime()} />
							</div>
						) : null}
					</div>
					<div className="presenter-screen__part presenter-screen__part--next-part">
						<div
							className={ClassNames('presenter-screen__segment-name', {
								next: nextSegment !== undefined && nextSegment?._id !== currentSegment?._id,
							})}
						>
							{nextSegment?._id !== currentSegment?._id ? nextSegment?.name : undefined}
						</div>
						{nextPart && nextShowStyleBaseId ? (
							<>
								<div className="presenter-screen__part__piece-icon">
									<PieceIconContainer
										partInstanceId={nextPart.instance._id}
										showStyleBaseId={nextShowStyleBaseId}
										rundownIds={this.props.rundownIds}
										playlistActivationId={this.props.playlist?.activationId}
									/>
								</div>
								<div className="presenter-screen__part__piece-name">
									{currentPart && currentPart.instance.part.autoNext ? (
										<img
											className="presenter-screen__part__auto-next-icon"
											src="/icons/auto-presenter-screen.svg"
											alt="Autonext"
										/>
									) : null}
									{nextPart && nextShowStyleBaseId && nextPart.instance.part.title ? (
										<PieceNameContainer
											partName={nextPart.instance.part.title}
											partInstanceId={nextPart.instance._id}
											showStyleBaseId={nextShowStyleBaseId}
											rundownIds={this.props.rundownIds}
											playlistActivationId={this.props.playlist?.activationId}
										/>
									) : (
										'_'
									)}
								</div>
							</>
						) : null}
					</div>
					<div className="presenter-screen__rundown-status-bar">
						<div className="presenter-screen__rundown-status-bar__rundown-name">
							{playlist ? playlist.name : 'UNKNOWN'}
						</div>
						<div
							className={ClassNames('presenter-screen__rundown-status-bar__countdown', {
								over: Math.floor(overUnderClock / 1000) >= 0,
							})}
						>
							{RundownUtils.formatDiffToTimecode(overUnderClock, true, false, true, true, true, undefined, true, true)}
						</div>
					</div>
				</div>
			)
		}
		return null
	}

	renderDashboardLayout(layout: DashboardLayout) {
		const { studio, playlist, currentShowStyleBase, currentShowStyleVariant } = this.props

		if (studio && playlist && currentShowStyleBase && currentShowStyleVariant) {
			return (
				<div className="presenter-screen">
					<ShelfDashboardLayout
						rundownLayout={layout}
						playlist={playlist}
						showStyleBase={currentShowStyleBase}
						showStyleVariant={currentShowStyleVariant}
						studio={studio}
						studioMode={false}
						shouldQueue={false}
						selectedPiece={undefined}
					/>
				</div>
			)
		}
		return null
	}
}

/**
 * This component renders a Countdown screen for a given playlist
 */
export const PresenterScreen = withTranslation()(
	withTracker<RundownOverviewProps & WithTranslation, RundownOverviewState, RundownOverviewTrackedProps>(
		getPresenterScreenReactive
	)(
		withTiming<RundownOverviewProps & RundownOverviewTrackedProps & WithTranslation, RundownOverviewState>()(
			PresenterScreenBase
		)
	)
)
