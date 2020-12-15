import React from 'react'
import Moment from 'react-moment'
import { DBSegment } from '../../../lib/collections/Segments'
import { PartUi } from '../SegmentTimeline/SegmentTimelineContainer'
import { RundownPlaylistId, RundownPlaylist, RundownPlaylists } from '../../../lib/collections/RundownPlaylists'
import { ShowStyleBaseId } from '../../../lib/collections/ShowStyleBases'
import { RundownId } from '../../../lib/collections/Rundowns'
import { withTranslation, WithTranslation } from 'react-i18next'
import { withTiming, WithTiming } from '../RundownView/RundownTiming/withTiming'
import { withTracker } from '../../lib/ReactMeteorData/ReactMeteorData'
import { getCurrentTime } from '../../../lib/lib'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { PubSub } from '../../../lib/api/pubsub'
import { PieceIconContainer } from '../PieceIcons/PieceIcon'
import { PieceNameContainer } from '../PieceIcons/PieceName'
import { Timediff } from './Timediff'
import { getPresenterScreenReactive } from './PresenterScreen'

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
export const OverlayScreen = withTranslation()(
	withTracker<RundownOverviewProps & WithTranslation, RundownOverviewState, RundownOverviewTrackedProps>(
		getPresenterScreenReactive
	)(
		withTiming<RundownOverviewProps & RundownOverviewTrackedProps & WithTranslation, RundownOverviewState>()(
			class OverlayScreen extends MeteorReactComponent<
				WithTiming<RundownOverviewProps & RundownOverviewTrackedProps & WithTranslation>,
				RundownOverviewState
			> {
				componentDidMount() {
					document.body.classList.add('transparent')
					this.autorun(() => {
						let playlist = RundownPlaylists.findOne(this.props.playlistId, {
							fields: {
								_id: 1,
							},
						}) as Pick<RundownPlaylist, '_id' | 'getRundownIDs'> | undefined
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
									}) as
										| Pick<
												RundownPlaylist,
												| '_id'
												| 'currentPartInstanceId'
												| 'nextPartInstanceId'
												| 'previousPartInstanceId'
												| 'getSelectedPartInstances'
										  >
										| undefined
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

				componentWillUnmount() {
					super.componentWillUnmount()
					document.body.classList.remove('transparent')
				}

				render() {
					const { playlist, segments, showStyleBaseId, t } = this.props

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
						let currentPartDuration: number | null = null
						if (currentPart) {
							currentPartDuration = currentPart.renderedDuration || currentPart.instance.part.expectedDuration || 0
							currentPartDuration += -1 * (currentPart.instance.timings?.duration || 0)
							if (!currentPart.instance.timings?.duration && currentPart.instance.timings?.startedPlayback) {
								currentPartDuration += -1 * (getCurrentTime() - currentPart.instance.timings.startedPlayback)
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

						// const overUnderClock = playlist.expectedDuration
						// 	? (this.props.timingDurations.asPlayedRundownDuration || 0) - playlist.expectedDuration
						// 	: (this.props.timingDurations.asPlayedRundownDuration || 0) -
						// 	  (this.props.timingDurations.totalRundownDuration || 0)

						const currentTime = this.props.timingDurations.currentTime || 0

						return (
							<div className="clocks-overlay">
								<div className="clocks-half clocks-bottom">
									<div className="clocks-current-segment-countdown clocks-segment-countdown">
										{currentPartDuration !== null ? (
											<Timediff time={currentPartDuration} />
										) : (
											<span className="clock-segment-countdown-next">{t('Next')}</span>
										)}
									</div>
									{/* {currentPart && currentPart.instance.part.autoNext ? (
										<div style={{ display: 'inline-block', height: '0.5em' }}>
											<img style={{ height: '0.5em', verticalAlign: 'top' }} src="/icons/auto-presenter-screen.svg" />
										</div>
									) : null} */}
									<div className="clocks-part-icon">
										{nextPart ? (
											<PieceIconContainer
												partInstanceId={nextPart.instance._id}
												showStyleBaseId={showStyleBaseId}
												rundownIds={this.props.rundownIds}
											/>
										) : null}
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
									<span className="clocks-time-now">
										<Moment interval={0} format="HH:mm:ss" date={currentTime} />
									</span>
								</div>
							</div>
						)
					}
					return (
						<div className="clocks-overlay">
							<div className="clocks-half clocks-bottom"></div>
						</div>
					)
				}
			}
		)
	)
)
