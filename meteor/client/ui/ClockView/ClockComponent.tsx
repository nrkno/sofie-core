import * as React from 'react'
import ClassNames from 'classnames'
import { DBSegment } from '../../../lib/collections/Segments'
import { PartUi } from '../SegmentTimeline/SegmentTimelineContainer'
import { RundownPlaylistId, RundownPlaylist, RundownPlaylists } from '../../../lib/collections/RundownPlaylists'
import { ShowStyleBaseId } from '../../../lib/collections/ShowStyleBases'
import { RundownId, Rundowns } from '../../../lib/collections/Rundowns'
import { withTranslation, WithTranslation } from 'react-i18next'
import { withTiming, WithTiming } from '../RundownView/RundownTiming/withTiming'
import { withTracker } from '../../lib/ReactMeteorData/ReactMeteorData'
import { extendMandadory, literal, getCurrentTime } from '../../../lib/lib'
import { findPartInstanceOrWrapToTemporary } from '../../../lib/collections/PartInstances'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { PubSub } from '../../../lib/api/pubsub'
import { PieceIconContainer } from '../PieceIcons/PieceIcon'
import { PieceNameContainer } from '../PieceIcons/PieceName'
import { Timediff } from './Timediff'
import { RundownUtils } from '../../lib/rundown'

interface SegmentUi extends DBSegment {
	items: Array<PartUi>
}

interface TimeMap {
	[key: string]: number
}

interface RundownOverviewProps {
	playlistId: RundownPlaylistId
	segmentLiveDurations?: TimeMap
}
interface RundownOverviewState {}
interface RundownOverviewTrackedProps {
	playlist?: RundownPlaylist
	segments: Array<SegmentUi>
	showStyleBaseId?: ShowStyleBaseId
	rundownIds: RundownId[]
}
/**
 * This component renders a Countdown screen for a given playlist
 */
export const ClockComponent = withTranslation()(
	withTiming<RundownOverviewProps & WithTranslation, RundownOverviewState>()(
		withTracker<WithTiming<RundownOverviewProps & WithTranslation>, RundownOverviewState, RundownOverviewTrackedProps>(
			(props: RundownOverviewProps) => {
				let playlist: RundownPlaylist | undefined
				if (props.playlistId) playlist = RundownPlaylists.findOne(props.playlistId)
				let segments: Array<SegmentUi> = []
				let showStyleBaseId: ShowStyleBaseId | undefined = undefined
				let rundownIds: RundownId[] = []

				if (playlist) {
					const allPartInstancesMap = playlist.getActivePartInstancesMap()
					segments = playlist.getSegments().map((segment) => {
						const displayDurationGroups: _.Dictionary<number> = {}
						const parts = segment.getParts()
						let displayDuration = 0

						return extendMandadory<DBSegment, SegmentUi>(segment, {
							items: parts.map((part, index) => {
								const instance = findPartInstanceOrWrapToTemporary(allPartInstancesMap, part)
								// take the displayDurationGroups into account
								if (
									part.displayDurationGroup &&
									(displayDurationGroups[part.displayDurationGroup] ||
										// or there is a following member of this displayDurationGroup
										(parts[index + 1] && parts[index + 1].displayDurationGroup === part.displayDurationGroup))
								) {
									displayDurationGroups[part.displayDurationGroup] =
										(displayDurationGroups[part.displayDurationGroup] || 0) +
										((part.expectedDuration || 0) - (instance.timings?.duration || 0))
									displayDuration = Math.max(
										0,
										Math.min(part.displayDuration || part.expectedDuration || 0, part.expectedDuration || 0) ||
											displayDurationGroups[part.displayDurationGroup]
									)
								}
								return literal<PartUi>({
									instance,
									partId: part._id,
									pieces: [],
									renderedDuration: part.expectedDuration ? 0 : displayDuration,
									startsAt: 0,
									willProbablyAutoNext: false,
								})
							}),
						})
					})

					if (playlist.currentPartInstanceId) {
						const { currentPartInstance, nextPartInstance } = playlist.getSelectedPartInstances()
						const partInstance = currentPartInstance || nextPartInstance
						if (partInstance) {
							const currentRundown = Rundowns.findOne(partInstance.rundownId)
							if (currentRundown) {
								showStyleBaseId = currentRundown.showStyleBaseId
							}
						}
					}

					if (!showStyleBaseId) {
						const rundowns = playlist.getRundowns()
						if (rundowns.length > 0) {
							showStyleBaseId = rundowns[0].showStyleBaseId
						}
					}

					rundownIds = playlist.getRundownIDs()
				}
				return {
					segments,
					playlist,
					showStyleBaseId,
					rundownIds,
				}
			}
		)(
			class ClockComponent extends MeteorReactComponent<
				WithTiming<RundownOverviewProps & RundownOverviewTrackedProps & WithTranslation>,
				RundownOverviewState
			> {
				componentDidMount() {
					this.autorun(() => {
						let playlist = RundownPlaylists.findOne(this.props.playlistId, {
							fields: {
								_id: 1,
							},
						})
						if (playlist) {
							this.subscribe(PubSub.rundowns, {
								playlistId: playlist._id,
							})

							this.autorun(() => {
								const rundownIds = playlist!.getRundownIDs()

								this.subscribe(PubSub.segments, {
									rundownId: { $in: rundownIds },
								})
								this.subscribe(PubSub.parts, {
									rundownId: { $in: rundownIds },
								})
								this.subscribe(PubSub.partInstances, {
									rundownId: { $in: rundownIds },
									reset: { $ne: true },
								})

								this.autorun(() => {
									let playlist = RundownPlaylists.findOne(this.props.playlistId, {
										fields: {
											_id: 1,
											currentPartInstanceId: 1,
											nextPartInstanceId: 1,
											previousPartInstanceId: 1,
										},
									})
									const { nextPartInstance, currentPartInstance } = playlist!.getSelectedPartInstances()
									this.subscribe(PubSub.pieceInstances, {
										partInstanceId: {
											$in: [currentPartInstance?._id, nextPartInstance?._id],
										},
									})
								})
							})
						}
					})
				}

				render() {
					const { playlist, segments, showStyleBaseId } = this.props

					if (playlist && this.props.playlistId && this.props.segments && showStyleBaseId) {
						let currentPart: PartUi | undefined
						let currentSegment: SegmentUi | undefined
						for (const segment of segments) {
							if (segment.items) {
								for (const item of segment.items) {
									if (item.instance._id === playlist.currentPartInstanceId) {
										currentSegment = segment
										currentPart = item
									}
								}
							}
						}
						let currentSegmentDuration = 0
						if (currentPart) {
							currentSegmentDuration += currentPart.renderedDuration || currentPart.instance.part.expectedDuration || 0
							currentSegmentDuration += -1 * (currentPart.instance.timings?.duration || 0)
							if (!currentPart.instance.timings?.duration && currentPart.instance.timings?.startedPlayback) {
								currentSegmentDuration += -1 * (getCurrentTime() - currentPart.instance.timings.startedPlayback)
							}
						}

						let nextPart: PartUi | undefined
						let nextSegment: SegmentUi | undefined
						for (const segment of segments) {
							if (segment.items) {
								for (const item of segment.items) {
									if (item.instance._id === playlist.nextPartInstanceId) {
										nextSegment = segment
										nextPart = item
									}
								}
							}
						}

						const overUnderClock = playlist.expectedDuration
							? (this.props.timingDurations.asPlayedRundownDuration || 0) - playlist.expectedDuration
							: (this.props.timingDurations.asPlayedRundownDuration || 0) -
							  (this.props.timingDurations.totalRundownDuration || 0)

						return (
							<div className="clocks-full-screen">
								<div className="clocks-half clocks-top">
									{currentPart ? (
										<React.Fragment>
											<div className="clocks-part-icon clocks-current-segment-icon">
												<PieceIconContainer
													partInstanceId={currentPart.instance._id}
													showStyleBaseId={showStyleBaseId}
													rundownIds={this.props.rundownIds}
												/>
											</div>
											<div className="clocks-part-title clocks-current-segment-title">{currentSegment!.name}</div>
											<div className="clocks-part-title clocks-part-title clocks-current-segment-title">
												<PieceNameContainer
													partName={currentPart.instance.part.title}
													partInstanceId={currentPart.instance._id}
													showStyleBaseId={showStyleBaseId}
													rundownIds={this.props.rundownIds}
												/>
											</div>
											<div className="clocks-current-segment-countdown clocks-segment-countdown">
												<Timediff time={currentSegmentDuration} />
											</div>
										</React.Fragment>
									) : playlist.expectedStart ? (
										<div className="clocks-rundown-countdown clocks-segment-countdown">
											<Timediff time={playlist.expectedStart - getCurrentTime()} />
										</div>
									) : null}
								</div>
								<div className="clocks-half clocks-bottom clocks-top-bar">
									<div className="clocks-part-icon">
										{nextPart ? (
											<PieceIconContainer
												partInstanceId={nextPart.instance._id}
												showStyleBaseId={showStyleBaseId}
												rundownIds={this.props.rundownIds}
											/>
										) : null}
									</div>
									<div className="clocks-bottom-top">
										<div className="clocks-part-title">
											{currentPart && currentPart.instance.part.autoNext ? (
												<div style={{ display: 'inline-block', height: '18vh' }}>
													<img style={{ height: '12vh', paddingTop: '2vh' }} src="/icons/auto-presenter-screen.svg" />
												</div>
											) : null}
											{nextSegment && nextSegment.name ? nextSegment.name.split(';')[0] : '_'}
										</div>
										<div className="clocks-part-title clocks-part-title">
											{nextPart && nextPart.instance.part.title ? (
												<PieceNameContainer
													partName={nextPart.instance.part.title}
													partInstanceId={nextPart.instance._id}
													showStyleBaseId={showStyleBaseId}
													rundownIds={this.props.rundownIds}
												/>
											) : (
												'_'
											)}
										</div>
									</div>
									<div className="clocks-rundown-bottom-bar">
										<div className="clocks-rundown-title">{playlist ? playlist.name : 'UNKNOWN'}</div>
										<div
											className={ClassNames('clocks-rundown-total', {
												over: Math.floor(overUnderClock / 1000) >= 0,
											})}>
											{RundownUtils.formatDiffToTimecode(
												overUnderClock,
												true,
												false,
												true,
												true,
												true,
												undefined,
												true
											)}
										</div>
									</div>
								</div>
							</div>
						)
					}
					return null
				}
			}
		)
	)
)
