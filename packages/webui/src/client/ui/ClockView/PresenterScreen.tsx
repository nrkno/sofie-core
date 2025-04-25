import ClassNames from 'classnames'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { PartUi } from '../SegmentTimeline/SegmentTimelineContainer'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { withTiming, WithTiming } from '../RundownView/RundownTiming/withTiming'
import { useSubscription, useSubscriptions, useTracker, withTracker } from '../../lib/ReactMeteorData/ReactMeteorData'
import { protectString, unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { getCurrentTime } from '../../lib/systemTime'
import { PartInstance } from '@sofie-automation/meteor-lib/dist/collections/PartInstances'
import { MeteorPubSub } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { PieceIconContainer } from '../PieceIcons/PieceIcon'
import { PieceNameContainer } from '../PieceIcons/PieceName'
import { Timediff } from './Timediff'
import { RundownUtils } from '../../lib/rundown'
import { PieceLifespan } from '@sofie-automation/blueprints-integration'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { PieceCountdownContainer } from '../PieceIcons/PieceCountdown'
import { PlaylistTiming } from '@sofie-automation/corelib/dist/playout/rundownTiming'
import { DashboardLayout, RundownLayoutBase } from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import {
	RundownId,
	RundownLayoutId,
	RundownPlaylistId,
	ShowStyleBaseId,
	ShowStyleVariantId,
	StudioId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBShowStyleVariant } from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant'
import { RundownLayoutsAPI } from '../../lib/rundownLayouts'
import { ShelfDashboardLayout } from '../Shelf/ShelfDashboardLayout'
import { parse as queryStringParse } from 'query-string'
import { calculatePartInstanceExpectedDurationWithTransition } from '@sofie-automation/corelib/dist/playout/timings'
import { getPlaylistTimingDiff } from '../../lib/rundownTiming'
import { UIShowStyleBase } from '@sofie-automation/meteor-lib/dist/api/showStyles'
import { UIShowStyleBases, UIStudios } from '../Collections'
import { UIStudio } from '@sofie-automation/meteor-lib/dist/api/studios'
import { PieceInstances, RundownLayouts, RundownPlaylists, Rundowns, ShowStyleVariants } from '../../collections'
import { RundownPlaylistCollectionUtil } from '../../collections/rundownPlaylistUtil'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { useSetDocumentClass } from '../util/useSetDocumentClass'
import { useRundownAndShowStyleIdsForPlaylist } from '../util/useRundownAndShowStyleIdsForPlaylist'
import { RundownPlaylistClientUtil } from '../../lib/rundownPlaylistUtil'

interface SegmentUi extends DBSegment {
	items: Array<PartUi>
}

interface TimeMap {
	[key: string]: number
}

interface PresenterScreenProps {
	studioId: StudioId
	playlistId: RundownPlaylistId
	segmentLiveDurations?: TimeMap
}
export interface PresenterScreenTrackedProps {
	studio: UIStudio | undefined
	playlist: DBRundownPlaylist | undefined
	rundowns: Rundown[]
	segments: Array<SegmentUi>
	currentSegment: SegmentUi | undefined
	currentPartInstance: PartUi | undefined
	nextSegment: SegmentUi | undefined
	nextPartInstance: PartUi | undefined
	currentShowStyleBaseId: ShowStyleBaseId | undefined
	currentShowStyleBase: UIShowStyleBase | undefined
	currentShowStyleVariantId: ShowStyleVariantId | undefined
	currentShowStyleVariant: DBShowStyleVariant | undefined
	nextShowStyleBaseId: ShowStyleBaseId | undefined
	showStyleBaseIds: ShowStyleBaseId[]
	rundownIds: RundownId[]
	rundownLayouts?: Array<RundownLayoutBase>
	presenterLayoutId: RundownLayoutId | undefined
}

function getShowStyleBaseIdSegmentPartUi(
	partInstance: PartInstance,
	playlist: DBRundownPlaylist,
	orderedSegmentsAndParts: {
		segments: DBSegment[]
		parts: DBPart[]
	},
	rundownsToShowstyles: Map<RundownId, ShowStyleBaseId>,
	currentPartInstance: PartInstance | undefined,
	nextPartInstance: PartInstance | undefined
): {
	showStyleBaseId: ShowStyleBaseId | undefined
	showStyleBase: UIShowStyleBase | undefined
	showStyleVariantId: ShowStyleVariantId | undefined
	showStyleVariant: DBShowStyleVariant | undefined
	segment: SegmentUi | undefined
	partInstance: PartUi | undefined
} {
	let showStyleBaseId: ShowStyleBaseId | undefined = undefined
	let showStyleBase: UIShowStyleBase | undefined = undefined
	let showStyleVariantId: ShowStyleVariantId | undefined = undefined
	let showStyleVariant: DBShowStyleVariant | undefined = undefined
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
		showStyleBase = UIShowStyleBases.findOne(showStyleBaseId)
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

			segment = {
				...o.segmentExtended,
				items: o.parts,
			}

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

export const getPresenterScreenReactive = (props: PresenterScreenProps): PresenterScreenTrackedProps => {
	const studio = UIStudios.findOne(props.studioId)

	let playlist: DBRundownPlaylist | undefined

	if (props.playlistId)
		playlist = RundownPlaylists.findOne(props.playlistId, {
			fields: {
				lastIncorrectPartPlaybackReported: 0,
				modified: 0,
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
	let currentShowStyleBase: UIShowStyleBase | undefined = undefined
	let currentShowStyleVariantId: ShowStyleVariantId | undefined = undefined
	let currentShowStyleVariant: DBShowStyleVariant | undefined = undefined

	let nextSegment: SegmentUi | undefined = undefined
	let nextPartInstanceUi: PartUi | undefined = undefined
	let nextShowStyleBaseId: ShowStyleBaseId | undefined = undefined

	const params = queryStringParse(location.search)
	const presenterLayoutId = protectString((params['presenterLayout'] as string) || '')

	if (playlist) {
		rundowns = RundownPlaylistCollectionUtil.getRundownsOrdered(playlist)
		const orderedSegmentsAndParts = RundownPlaylistClientUtil.getSegmentsAndPartsSync(playlist)
		rundownIds = rundowns.map((rundown) => rundown._id)
		const rundownsToShowstyles: Map<RundownId, ShowStyleBaseId> = new Map()
		for (const rundown of rundowns) {
			rundownsToShowstyles.set(rundown._id, rundown.showStyleBaseId)
		}
		showStyleBaseIds = rundowns.map((rundown) => rundown.showStyleBaseId)
		const { currentPartInstance, nextPartInstance } = RundownPlaylistClientUtil.getSelectedPartInstances(playlist)
		const partInstance = currentPartInstance ?? nextPartInstance
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

function PresenterScreenContent(props: WithTiming<PresenterScreenProps & PresenterScreenTrackedProps>): JSX.Element {
	usePresenterScreenSubscriptions(props)

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

	const presenterLayout =
		selectedPresenterLayout && RundownLayoutsAPI.isLayoutForPresenterView(selectedPresenterLayout)
			? selectedPresenterLayout
			: undefined

	useSetDocumentClass('dark', 'xdark')

	if (presenterLayout && RundownLayoutsAPI.isDashboardLayout(presenterLayout)) {
		return (
			<PresenterScreenContentDashboardLayout
				studio={props.studio}
				playlist={props.playlist}
				currentShowStyleBase={props.currentShowStyleBase}
				currentShowStyleVariant={props.currentShowStyleVariant}
				layout={presenterLayout}
			/>
		)
	} else {
		return <PresenterScreenContentDefaultLayout {...props} />
	}
}

export function usePresenterScreenSubscriptions(props: PresenterScreenProps): void {
	useSubscription(MeteorPubSub.uiStudio, props.studioId)

	const playlist = useTracker(
		() =>
			RundownPlaylists.findOne(props.playlistId, {
				fields: {
					_id: 1,
					activationId: 1,
				},
			}) as Pick<DBRundownPlaylist, '_id' | 'activationId'> | undefined,
		[props.playlistId]
	)

	useSubscription(CorelibPubSub.rundownsInPlaylists, playlist ? [playlist._id] : [])

	const { rundownIds, showStyleBaseIds, showStyleVariantIds } = useRundownAndShowStyleIdsForPlaylist(playlist?._id)

	useSubscription(CorelibPubSub.segments, rundownIds, {})
	useSubscription(CorelibPubSub.parts, rundownIds, null)
	useSubscription(MeteorPubSub.uiPartInstances, playlist?.activationId ?? null)
	useSubscriptions(
		MeteorPubSub.uiShowStyleBase,
		showStyleBaseIds.map((id) => [id])
	)
	useSubscription(CorelibPubSub.showStyleVariants, null, showStyleVariantIds)
	useSubscription(MeteorPubSub.rundownLayouts, showStyleBaseIds)

	const { currentPartInstance, nextPartInstance } = useTracker(
		() => {
			const playlist = RundownPlaylists.findOne(props.playlistId, {
				fields: {
					_id: 1,
					currentPartInfo: 1,
					nextPartInfo: 1,
					previousPartInfo: 1,
				},
			}) as Pick<DBRundownPlaylist, '_id' | 'currentPartInfo' | 'nextPartInfo' | 'previousPartInfo'> | undefined

			if (playlist) {
				return RundownPlaylistClientUtil.getSelectedPartInstances(playlist)
			} else {
				return { currentPartInstance: undefined, nextPartInstance: undefined, previousPartInstance: undefined }
			}
		},
		[props.playlistId],
		{ currentPartInstance: undefined, nextPartInstance: undefined, previousPartInstance: undefined }
	)

	useSubscriptions(CorelibPubSub.pieceInstances, [
		currentPartInstance && [[currentPartInstance.rundownId], [currentPartInstance._id], {}],
		nextPartInstance && [[nextPartInstance.rundownId], [nextPartInstance._id], {}],
	])
}

interface PresenterScreenContentDashboardLayoutProps {
	studio: UIStudio | undefined
	playlist: DBRundownPlaylist | undefined
	currentShowStyleBase: UIShowStyleBase | undefined
	currentShowStyleVariant: DBShowStyleVariant | undefined

	layout: DashboardLayout
}
function PresenterScreenContentDashboardLayout({
	studio,
	playlist,
	currentShowStyleBase,
	currentShowStyleVariant,
	layout,
}: Readonly<PresenterScreenContentDashboardLayoutProps>) {
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

function PresenterScreenContentDefaultLayout({
	playlist,
	segments,
	currentShowStyleBaseId,
	nextShowStyleBaseId,
	playlistId,
	currentPartInstance,
	currentSegment,
	timingDurations,
	nextPartInstance,
	nextSegment,
	rundownIds,
}: Readonly<WithTiming<PresenterScreenProps & PresenterScreenTrackedProps>>) {
	if (playlist && playlistId && segments) {
		const currentPartOrSegmentCountdown =
			timingDurations.remainingBudgetOnCurrentSegment ?? timingDurations.remainingTimeOnCurrentPart ?? 0

		const expectedStart = PlaylistTiming.getExpectedStart(playlist.timing)
		const overUnderClock = getPlaylistTimingDiff(playlist, timingDurations) ?? 0

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
					{currentPartInstance && currentShowStyleBaseId ? (
						<>
							<div className="presenter-screen__part__piece-icon">
								<PieceIconContainer
									partInstanceId={currentPartInstance.instance._id}
									showStyleBaseId={currentShowStyleBaseId}
									rundownIds={rundownIds}
									playlistActivationId={playlist?.activationId}
								/>
							</div>
							<div className="presenter-screen__part__piece-name">
								<PieceNameContainer
									partName={currentPartInstance.instance.part.title}
									partInstanceId={currentPartInstance.instance._id}
									showStyleBaseId={currentShowStyleBaseId}
									rundownIds={rundownIds}
									playlistActivationId={playlist?.activationId}
								/>
							</div>
							<div className="presenter-screen__part__piece-countdown">
								<PieceCountdownContainer
									partInstanceId={currentPartInstance.instance._id}
									showStyleBaseId={currentShowStyleBaseId}
									rundownIds={rundownIds}
									partAutoNext={currentPartInstance.instance.part.autoNext || false}
									partExpectedDuration={calculatePartInstanceExpectedDurationWithTransition(
										currentPartInstance.instance
									)}
									partStartedPlayback={currentPartInstance.instance.timings?.plannedStartedPlayback}
									playlistActivationId={playlist?.activationId}
								/>
							</div>
							<div className="presenter-screen__part__part-countdown">
								<Timediff time={currentPartOrSegmentCountdown} />
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
					{nextPartInstance && nextShowStyleBaseId ? (
						<>
							<div className="presenter-screen__part__piece-icon">
								<PieceIconContainer
									partInstanceId={nextPartInstance.instance._id}
									showStyleBaseId={nextShowStyleBaseId}
									rundownIds={rundownIds}
									playlistActivationId={playlist?.activationId}
								/>
							</div>
							<div className="presenter-screen__part__piece-name">
								{currentPartInstance && currentPartInstance.instance.part.autoNext ? (
									<img
										className="presenter-screen__part__auto-next-icon"
										src="/icons/auto-presenter-screen.svg"
										alt="Autonext"
									/>
								) : null}
								{nextPartInstance && nextShowStyleBaseId && nextPartInstance.instance.part.title ? (
									<PieceNameContainer
										partName={nextPartInstance.instance.part.title}
										partInstanceId={nextPartInstance.instance._id}
										showStyleBaseId={nextShowStyleBaseId}
										rundownIds={rundownIds}
										playlistActivationId={playlist?.activationId}
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

/**
 * This component renders a Countdown screen for a given playlist
 */
export const PresenterScreen = withTracker<PresenterScreenProps, {}, PresenterScreenTrackedProps>(
	getPresenterScreenReactive
)(withTiming<PresenterScreenProps & PresenterScreenTrackedProps, {}>()(PresenterScreenContent))
