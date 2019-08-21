import * as React from 'react'
import * as ClassNames from 'classnames'
import { withTracker } from '../lib/ReactMeteorData/react-meteor-data'
import { translate, InjectedTranslateProps } from 'react-i18next'
import * as _ from 'underscore'

import { RundownPlaylist, RundownPlaylists } from '../../lib/collections/RundownPlaylists'
import { Rundown, Rundowns } from '../../lib/collections/Rundowns'
import { Segment, Segments } from '../../lib/collections/Segments'

import { RundownTimingProvider, withTiming, WithTiming } from './RundownView/RundownTiming'
import { Parts, Part } from '../../lib/collections/Parts'
import { PartUi } from './SegmentTimeline/SegmentTimelineContainer'

import { RundownUtils } from '../lib/rundown'
import { getCurrentTime, objectPathGet, extendMandadory } from '../../lib/lib'
import { PieceIconContainer, PieceNameContainer } from './PieceIcons/PieceIcon'
import { MeteorReactComponent } from '../lib/MeteorReactComponent'
import { meteorSubscribe, PubSub } from '../../lib/api/pubsub'
import { ShowStyle } from '../../server/migration/deprecatedDataTypes/0_18_0';

interface SegmentUi extends Segment {
	items: Array<PartUi>
}

interface TimeMap {
	[key: string]: number
}

interface RundownOverviewProps {
	playlistId: string
	segmentLiveDurations?: TimeMap
}
interface RundownOverviewState {
}
interface RundownOverviewTrackedProps {
	playlist?: RundownPlaylist
	segments: Array<SegmentUi>
	showStyleBaseId?: string
	rundownIds: string[]
}

const Timediff = class extends React.Component<{ time: number }> {
	render () {
		const time = -this.props.time
		const isNegative = (Math.floor(time / 1000) > 0)
		const timeString = RundownUtils.formatDiffToTimecode(time, true, false, true, false, true, '', false, true) // @todo: something happened here with negative time
		// RundownUtils.formatDiffToTimecode(this.props.displayTimecode || 0, true, false, true, false, true, '', false, true)
		// const timeStringSegments = timeString.split(':')
		// const fontWeight = (no) => no === '00' || no === '+00'
		return (
			<span className={ClassNames({
				'clocks-segment-countdown-red': isNegative,
				'clocks-counter-heavy': (time / 1000) > -30
			})}>
				{timeString}
			</span>
		)
	}
}

const ClockComponent = translate()(withTiming<RundownOverviewProps, RundownOverviewState>()(
	withTracker<WithTiming<RundownOverviewProps & InjectedTranslateProps>, RundownOverviewState, RundownOverviewTrackedProps>((props: RundownOverviewProps) => {

		let playlist: RundownPlaylist | undefined
		if (props.playlistId) playlist = RundownPlaylists.findOne(props.playlistId)
		let segments: Array<SegmentUi> = []
		let showStyleBaseId: string | undefined = undefined
		let rundownIds: string[] = []

		if (playlist) {
			segments = _.map(playlist.getSegments(), (segment) => {
				const displayDurationGroups: _.Dictionary<number> = {}
				const parts = segment.getParts()
				let displayDuration = 0

				return extendMandadory<Segment, SegmentUi>(segment, {
					items: _.map(parts, (part, index) => {
						if (part.displayDurationGroup && (
							(displayDurationGroups[part.displayDurationGroup]) ||
							// or there is a following member of this displayDurationGroup
							(parts[index + 1] && parts[index + 1].displayDurationGroup === part.displayDurationGroup))) {
							displayDurationGroups[part.displayDurationGroup] = (displayDurationGroups[part.displayDurationGroup] || 0) + ((part.expectedDuration || 0) - (part.duration || 0))
							displayDuration = Math.max(0, Math.min(part.displayDuration || part.expectedDuration || 0, part.expectedDuration || 0) || displayDurationGroups[part.displayDurationGroup])
						}
						return extendMandadory<Part, PartUi>(part, {
							pieces: [],
							renderedDuration: part.expectedDuration ? 0 : displayDuration,
							startsAt: 0,
							willProbablyAutoNext: false
						})
					})
				})
			})

			if (playlist.currentPartId) {
				const currentPart = Parts.findOne(playlist.currentPartId)
				if (currentPart) {
					const currentRundown = currentPart.getRundown()
					if (currentRundown) {
						showStyleBaseId = currentRundown.showStyleBaseId
					}
				}
			}
			if (!showStyleBaseId) {
				showStyleBaseId = playlist.getRundowns()[0].showStyleBaseId
			}

			rundownIds = playlist.getRundownIDs()
		}
		return {
			segments,
			playlist,
			showStyleBaseId,
			rundownIds
		}
	})(
		class extends MeteorReactComponent<WithTiming<RundownOverviewProps & RundownOverviewTrackedProps & InjectedTranslateProps>, RundownOverviewState> {
			componentWillMount() {
				this.subscribe('rundownPlaylists', {
					_id: this.props.playlistId
				})
				this.subscribe('rundowns', {
					playlistId: this.props.playlistId
				})
				this.subscribe('segments', {
					rundownId: this.props.playlistId
				})
				this.subscribe('parts', {
					rundownId: this.props.playlistId
				})
			}

			render() {
				const { playlist, segments, showStyleBaseId } = this.props

				if (playlist && this.props.playlistId && this.props.segments && showStyleBaseId) {
					let currentPart: PartUi | undefined
					for (const segment of segments) {
						if (segment.items) {
							for (const item of segment.items) {
								if (item._id === playlist.currentPartId) {
									currentPart = item
								}
							}
						}
					}
					let currentSegmentDuration = 0
					if (currentPart) {
						currentSegmentDuration += currentPart.renderedDuration || currentPart.expectedDuration || 0
						currentSegmentDuration += -1 * (currentPart.duration || 0)
						if (!currentPart.duration && currentPart.startedPlayback) {
							currentSegmentDuration += -1 * (getCurrentTime() - (currentPart.getLastStartedPlayback() || 0))
						}
					}

					let nextPart
					for (const segment of segments) {
						if (segment.items) {
							for (const item of segment.items) {
								if (item._id === playlist.nextPartId) {
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

					const overUnderClock = playlist.expectedDuration ?
						(this.props.timingDurations.asPlayedRundownDuration || 0) - playlist.expectedDuration
						: (this.props.timingDurations.asPlayedRundownDuration || 0) - (this.props.timingDurations.totalRundownDuration || 0)

					return (
						<div className='clocks-full-screen'>
							<div className='clocks-half clocks-top'>
								{currentPart ?
									<React.Fragment>
										<div className='clocks-part-icon clocks-current-segment-icon'>
											<PieceIconContainer partId={currentPart._id} showStyleBaseId={showStyleBaseId} rundownIds={this.props.rundownIds} />
										</div>
										<div className='clocks-part-title clocks-current-segment-title'>
											{currentPart.title.split(';')[0]}
										</div>
										<div className='clocks-part-title clocks-part-title clocks-current-segment-title'>
											<PieceNameContainer partSlug={currentPart.title} partId={currentPart._id} showStyleBaseId={showStyleBaseId} rundownIds={this.props.rundownIds} />
										</div>
										<div className='clocks-current-segment-countdown clocks-segment-countdown'>
											<Timediff time={currentSegmentDuration} />
										</div>
									</React.Fragment> :
									playlist.expectedStart && <div className='clocks-rundown-countdown clocks-segment-countdown'>
										<Timediff time={playlist.expectedStart - getCurrentTime()} />
									</div>
								}
							</div>
							<div className='clocks-half clocks-bottom clocks-top-bar'>
								<div className='clocks-part-icon'>
									{nextPart ?
										<PieceIconContainer partId={nextPart._id} showStyleBaseId={showStyleBaseId} rundownIds={this.props.rundownIds} />
										: ''}
								</div>
								<div className='clocks-bottom-top'>
									<div className='clocks-part-title'>
										{currentPart && currentPart.autoNext ?
											<div style={{ display: 'inline-block', height: '18vh' }}>
												<img style={{ height: '12vh', paddingTop: '2vh' }} src='/icons/auto-presenter-screen.svg' />
											</div> : ''}
										{nextPart && nextPart.slug ? nextPart.slug.split(';')[0] : '_'}
									</div>
									<div className='clocks-part-title clocks-part-title'>
										{nextPart && nextPart.slug ?
											<PieceNameContainer partSlug={nextPart.slug} partId={nextPart._id} showStyleBaseId={showStyleBaseId} rundownIds={this.props.rundownIds} />
											: '_'}
									</div>
								</div>
								<div className='clocks-rundown-bottom-bar'>
									<div className='clocks-rundown-title'>
										{playlist ? playlist.name : 'UNKNOWN'}
									</div>
									<div className={ClassNames('clocks-rundown-total', {
										'over': (Math.floor(overUnderClock / 1000) >= 0)
									})}>
										{RundownUtils.formatDiffToTimecode(overUnderClock, true, false, true, true, true, undefined, true)}
									</div>
								</div>
							</div>
						</div>
					)
				}
				return null
			}
		})))

interface IPropsHeader extends InjectedTranslateProps {
	key: string
	playlist: RundownPlaylist
	rundowns: Array<Rundown> | undefined
	segments: Array<Segment> | undefined
	parts: Array<Part> | undefined
	match: {
		params: {
			studioId: string
		}
	}
}

interface IStateHeader {
}

export const ClockView = translate()(withTracker(function (props: IPropsHeader) {
	let studioId = objectPathGet(props, 'match.params.studioId')
	let playlist = (
		RundownPlaylists.findOne({
			active: true,
			studioId: studioId
		})
	)
	meteorSubscribe(PubSub.studios, {
		_id: studioId
	})

	// let dep = new Tracker.Dependency()
	// dep.depend()
	// Meteor.setTimeout(() => {
	// 	console.log('a')
	// 	dep.changed()
	// }, 3000)
	let rundowns = playlist ? playlist.getRundowns() : undefined
	let segments = playlist ? playlist.getSegments() : undefined
	let parts = segments ? _.flatten(segments.map(s => s.getParts())) : undefined
	// let rundownDurations = calculateDurations(rundown, parts)
	return {
		playlist,
		rundowns,
		segments,
		parts
	}
})(
	class extends MeteorReactComponent<WithTiming<IPropsHeader>, IStateHeader> {
		componentDidMount () {
			document.body.classList.add('dark', 'xdark')
			let studioId = objectPathGet(this.props, 'match.params.studioId')
			if (studioId) {
				this.subscribe('studios', {
					_id: studioId
				})
				this.subscribe('rundowns', {
					active: true,
					studioId: studioId
				})
			}
			let rundown = (
				Rundowns.findOne({
					active: true,
					studioId: studioId
				})
			)
			if (this.props.rundowns) {
				const rundownIDs = this.props.rundowns.map(i => i._id)
				this.subscribe('segments', {
					rundownId: { $in: rundownIDs }
				})
				this.subscribe('parts', {
					rundownId: { $in: rundownIDs }
				})
				this.subscribe('pieces', {
					rundownId: { $in: rundownIDs }
				})
				this.subscribe('showStyleBases', {
					_id: { $in: _.uniq(this.props.rundowns.map(i => i.showStyleBaseId)) }
				})
				this.subscribe('adLibPieces', {
					rundownId: { $in: rundownIDs }
				})
			}
		}

		componentWillUnmount () {
			this._cleanUp()
			document.body.classList.remove('dark', 'xdark')
		}

		render () {
			const { t } = this.props

			if (this.props.playlist) {
				return (
					<RundownTimingProvider playlist={this.props.playlist} >
						<ClockComponent playlistId={this.props.playlist._id} />
					</RundownTimingProvider>
				)
			} else {
				return (
					<div className='rundown-view rundown-view--unpublished'>
						<div className='rundown-view__label'>
							<p>
								{t('There is no rundown active in this studio.')}
							</p>
						</div>
					</div>
				)
			}
		}
	}
))
