import * as React from 'react'
import ClassNames from 'classnames'
import { withTracker } from '../lib/ReactMeteorData/react-meteor-data'
import { withTranslation, WithTranslation } from 'react-i18next'
import * as _ from 'underscore'

import { RundownPlaylist, RundownPlaylists, RundownPlaylistId } from '../../lib/collections/RundownPlaylists'
import { Rundown, Rundowns, RundownId } from '../../lib/collections/Rundowns'
import { Segment, Segments, DBSegment } from '../../lib/collections/Segments'

import { RundownTimingProvider, withTiming, WithTiming } from './RundownView/RundownTiming'
import { Parts, Part } from '../../lib/collections/Parts'
import { PartUi } from './SegmentTimeline/SegmentTimelineContainer'

import { RundownUtils } from '../lib/rundown'
import { getCurrentTime, objectPathGet, extendMandadory, literal } from '../../lib/lib'
import { PieceIconContainer, PieceNameContainer } from './PieceIcons/PieceIcon'
import { MeteorReactComponent } from '../lib/MeteorReactComponent'
import { meteorSubscribe, PubSub } from '../../lib/api/pubsub'
import { ShowStyle } from '../../server/migration/deprecatedDataTypes/0_18_0'
import { findPartInstanceOrWrapToTemporary } from '../../lib/collections/PartInstances'
import { ShowStyleBaseId } from '../../lib/collections/ShowStyleBases'
import { StudioId } from '../../lib/collections/Studios'

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

const Timediff = class Timediff extends React.Component<{ time: number }> {
	render() {
		const time = -this.props.time
		const isNegative = Math.floor(time / 1000) > 0
		const timeString = RundownUtils.formatDiffToTimecode(time, true, false, true, false, true, '', false, true) // @todo: something happened here with negative time
		// RundownUtils.formatDiffToTimecode(this.props.displayTimecode || 0, true, false, true, false, true, '', false, true)
		// const timeStringSegments = timeString.split(':')
		// const fontWeight = (no) => no === '00' || no === '+00'
		return (
			<span
				className={ClassNames({
					'clocks-segment-countdown-red': isNegative,
					'clocks-counter-heavy': time / 1000 > -30,
				})}>
				{timeString}
			</span>
		)
	}
}

const ClockComponent = withTranslation()(
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
								if (
									part.displayDurationGroup &&
									(displayDurationGroups[part.displayDurationGroup] ||
										// or there is a following member of this displayDurationGroup
										(parts[index + 1] && parts[index + 1].displayDurationGroup === part.displayDurationGroup))
								) {
									displayDurationGroups[part.displayDurationGroup] =
										(displayDurationGroups[part.displayDurationGroup] || 0) +
										((part.expectedDuration || 0) - (part.duration || 0))
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
						let playlist = RundownPlaylists.findOne(this.props.playlistId)
						if (this.props.playlist) {
							this.subscribe(PubSub.rundowns, {
								playlistId: this.props.playlistId,
							})
						}
					})
					this.autorun(() => {
						let playlist = RundownPlaylists.findOne(this.props.playlistId)
						if (playlist) {
							this.subscribe(PubSub.rundowns, {
								playlistId: this.props.playlistId,
							})

							const rundownIds = playlist.getRundownIDs()

							this.subscribe(PubSub.segments, {
								rundownId: { $in: this.props.rundownIds },
							})
							this.subscribe(PubSub.parts, {
								rundownId: { $in: this.props.rundownIds },
							})
							this.subscribe(PubSub.partInstances, {
								rundownId: { $in: this.props.rundownIds },
								reset: { $ne: true },
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
							currentSegmentDuration += -1 * (currentPart.instance.part.duration || 0)
							if (!currentPart.instance.part.duration && currentPart.instance.part.startedPlayback) {
								currentSegmentDuration +=
									-1 * (getCurrentTime() - (currentPart.instance.part.getLastStartedPlayback() || 0))
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
						// let nextSegmentDuration = 0
						// if (nextPart) {
						// 	nextSegmentDuration += nextPart.expectedDuration || 0
						// 	nextSegmentDuration += -1 * (nextPart.duration || 0)
						// 	if (!nextPart.duration && nextPart.startedPlayback) {
						// 		nextSegmentDuration += -1 * (getCurrentTime() - nextPart.startedPlayback)
						// 	}
						// }

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
									) : (
										playlist.expectedStart && (
											<div className="clocks-rundown-countdown clocks-segment-countdown">
												<Timediff time={playlist.expectedStart - getCurrentTime()} />
											</div>
										)
									)}
								</div>
								<div className="clocks-half clocks-bottom clocks-top-bar">
									<div className="clocks-part-icon">
										{nextPart ? (
											<PieceIconContainer
												partInstanceId={nextPart.instance._id}
												showStyleBaseId={showStyleBaseId}
												rundownIds={this.props.rundownIds}
											/>
										) : (
											''
										)}
									</div>
									<div className="clocks-bottom-top">
										<div className="clocks-part-title">
											{currentPart && currentPart.instance.part.autoNext ? (
												<div style={{ display: 'inline-block', height: '18vh' }}>
													<img style={{ height: '12vh', paddingTop: '2vh' }} src="/icons/auto-presenter-screen.svg" />
												</div>
											) : (
												''
											)}
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

interface IPropsHeader extends WithTranslation {
	key: string
	playlist: RundownPlaylist
	rundowns: Array<Rundown> | undefined
	segments: Array<Segment> | undefined
	parts: Array<Part> | undefined
	match: {
		params: {
			studioId: StudioId
		}
	}
}

interface IStateHeader {}

export const ClockView = withTranslation()(
	withTracker(function(props: IPropsHeader) {
		let studioId = objectPathGet(props, 'match.params.studioId')
		const playlist = RundownPlaylists.findOne({
			active: true,
			studioId: studioId,
		})

		const rundowns = playlist ? playlist.getRundowns() : undefined
		const segmentsAndParts = playlist && playlist.getSegmentsAndPartsSync()

		const segments = segmentsAndParts && segmentsAndParts.segments
		const parts = segmentsAndParts && segmentsAndParts.parts

		return {
			playlist,
			rundowns,
			segments,
			parts,
		}
	})(
		class ClockView extends MeteorReactComponent<WithTiming<IPropsHeader>, IStateHeader> {
			componentDidMount() {
				document.body.classList.add('dark', 'xdark')
				let studioId = objectPathGet(this.props, 'match.params.studioId')
				if (studioId) {
					this.subscribe(PubSub.rundownPlaylists, {
						active: true,
						studioId: studioId,
					})
				}

				const playlistId = (this.props.playlist || {})._id
				this.autorun(() => {
					let playlist = RundownPlaylists.findOne(playlistId)
					if (this.props.playlist) {
						this.subscribe(PubSub.rundowns, {
							playlistId: this.props.playlist._id,
						})
					}
				})
				this.autorun(() => {
					let playlist = RundownPlaylists.findOne(playlistId)
					if (playlist) {
						const rundownIDs = playlist.getRundownIDs()
						this.subscribe(PubSub.segments, {
							rundownId: { $in: rundownIDs },
						})
						this.subscribe(PubSub.parts, {
							rundownId: { $in: rundownIDs },
						})
					}
				})
			}

			componentWillUnmount() {
				this._cleanUp()
				document.body.classList.remove('dark', 'xdark')
			}

			render() {
				const { t } = this.props

				if (this.props.playlist) {
					return (
						<RundownTimingProvider playlist={this.props.playlist}>
							<ClockComponent playlistId={this.props.playlist._id} />
						</RundownTimingProvider>
					)
				} else {
					return (
						<div className="rundown-view rundown-view--unpublished">
							<div className="rundown-view__label">
								<p>{t('There is no rundown active in this studio.')}</p>
							</div>
						</div>
					)
				}
			}
		}
	)
)
