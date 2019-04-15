import * as React from 'react'
import * as ClassNames from 'classnames'
import { withTracker } from '../lib/ReactMeteorData/react-meteor-data'
import { translate, InjectedTranslateProps } from 'react-i18next'
import * as $ from 'jquery'
import * as _ from 'underscore'

import { Rundown, Rundowns } from '../../lib/collections/Rundowns'
import { Segment, Segments } from '../../lib/collections/Segments'

import { RundownTimingProvider, withTiming, WithTiming } from './RundownView/RundownTiming'
import { Parts, Part } from '../../lib/collections/Parts'
import { PartUi } from './SegmentTimeline/SegmentTimelineContainer'

import { RundownUtils } from '../lib/rundown'
import { getCurrentTime, objectPathGet, extendMandadory } from '../../lib/lib'
import { SegmentItemIconContainer, SegmentItemNameContainer } from './SegmentItemIcons/SegmentItemIcon'
import { MeteorReactComponent } from '../lib/MeteorReactComponent'
import { meteorSubscribe, PubSub } from '../../lib/api/pubsub'

interface SegmentUi extends Segment {
	items: Array<PartUi>
}

interface TimeMap {
	[key: string]: number
}

interface RundownOverviewProps {
	rundownId: string
	segmentLiveDurations?: TimeMap
}
interface RundownOverviewState {
}
interface RundownOverviewTrackedProps {
	rundown?: Rundown
	segments: Array<SegmentUi>
}

const Timediff = class extends React.Component<{ time: number}> {
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

		let rundown: Rundown | undefined
		if (props.rundownId) rundown = Rundowns.findOne(props.rundownId)
		let segments: Array<SegmentUi> = []
		if (rundown) {
			segments = _.map(rundown.getSegments(), (segment) => {
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
							items: [],
							renderedDuration: part.expectedDuration ? 0 : displayDuration,
							startsAt: 0,
							willProbablyAutoNext: false
						})
					})
				})
			})

		}
		return {
			segments,
			rundown: rundown
		}
	})(
	class extends MeteorReactComponent<WithTiming<RundownOverviewProps & RundownOverviewTrackedProps & InjectedTranslateProps>, RundownOverviewState> {
		componentWillMount () {
			this.subscribe('rundowns', {
				_id: this.props.rundownId
			})
			this.subscribe('segments', {
				rundownId: this.props.rundownId
			})
			this.subscribe('parts', {
				rundownId: this.props.rundownId
			})
		}

		render () {
			const { rundown, segments } = this.props

			if (rundown && this.props.rundownId && this.props.segments) {
				let currentPart: PartUi | undefined
				for (const segment of segments) {
					if (segment.items) {
						for (const item of segment.items) {
							if (item._id === rundown.currentPartId) {
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
							if (item._id === rundown.nextPartId) {
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

				const overUnderClock = rundown.expectedDuration ?
					(this.props.timingDurations.asPlayedRundownDuration || 0) - rundown.expectedDuration
					: (this.props.timingDurations.asPlayedRundownDuration || 0) - (this.props.timingDurations.totalRundownDuration || 0)

				return (
					<div className='clocks-full-screen'>
						<div className='clocks-half clocks-top'>
							{currentPart ?
								<React.Fragment>
									<div className='clocks-segment-icon clocks-current-segment-icon'>
										<SegmentItemIconContainer segmentItemId={currentPart._id} showStyleBaseId={rundown.showStyleBaseId} rundownId={rundown._id} />
									</div>
									<div className='clocks-segment-title clocks-current-segment-title'>
										{currentPart.title.split(';')[0]}
									</div>
									<div className='clocks-part-title clocks-segment-title clocks-current-segment-title'>
										<SegmentItemNameContainer partSlug={currentPart.title} segmentItemId={currentPart._id} showStyleBaseId={rundown.showStyleBaseId} rundownId={rundown._id} />
									</div>
									<div className='clocks-current-segment-countdown clocks-segment-countdown'>
										<Timediff time={currentSegmentDuration} />
									</div>
								</React.Fragment> :
								rundown.expectedStart && <div className='clocks-rundown-countdown clocks-segment-countdown'>
									<Timediff time={rundown.expectedStart - getCurrentTime()} />
								</div>
							}
						</div>
						<div className='clocks-half clocks-bottom clocks-top-bar'>
							<div className='clocks-segment-icon'>
								{nextPart ?
									<SegmentItemIconContainer segmentItemId={nextPart._id} showStyleBaseId={rundown.showStyleBaseId} rundownId={rundown._id} />
								: ''}
							</div>
							<div className='clocks-bottom-top'>
								<div className='clocks-segment-title'>
									{currentPart && currentPart.autoNext ?
									<div style={{display: 'inline-block', height: '18vh'}}>
										<img style={{height: '12vh', paddingTop: '2vh'}} src='/icons/auto-presenter-screen.svg' />
									</div> : ''}
									{nextPart ? nextPart.slug.split(';')[0] : '_'}
								</div>
								<div className='clocks-segment-title clocks-part-title'>
									{nextPart ?
										<SegmentItemNameContainer partSlug={nextPart.slug} segmentItemId={nextPart._id} showStyleBaseId={rundown.showStyleBaseId} rundownId={rundown._id} />
									: '_'}
								</div>
							</div>
							<div className='clocks-rundown-bottom-bar'>
								<div className='clocks-rundown-title'>
									{rundown ? rundown.name : 'UNKNOWN'}
								</div>
								<div className={ClassNames('clocks-rundown-total', {
									'over': (Math.floor(overUnderClock / 1000) >= 0)
								})}>
									{ RundownUtils.formatDiffToTimecode(overUnderClock, true, false, true, true, true, undefined, true) }
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
	rundown: Rundown
	segments: Array<Segment>
	parts: Array<Part>
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
	let rundown = (
		Rundowns.findOne({
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
	let segments = rundown ? Segments.find({ rundownId: rundown._id }, {
		sort: {
			'_rank': 1
		}
	}).fetch() : undefined
	let parts = rundown ? Parts.find({ rundownId: rundown._id }).fetch() : undefined
	// let rundownDurations = calculateDurations(rundown, parts)
	return {
		rundown,
		segments,
		parts
	}
})(
class extends MeteorReactComponent<WithTiming<IPropsHeader>, IStateHeader> {
	componentDidMount () {
		$(document.body).addClass('dark xdark')
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
		if (rundown) {
			this.subscribe('segments', {
				rundownId: rundown._id
			})
			this.subscribe('parts', {
				rundownId: rundown._id
			})
			this.subscribe('pieces', {
				rundownId: rundown._id
			})
			this.subscribe('showStyleBases', {
				_id: rundown.showStyleBaseId
			})
			this.subscribe('adLibPieces', {
				rundownId: rundown._id
			})
		}
	}

	componentWillUnmount () {
		this._cleanUp()
		$(document.body).removeClass('dark xdark')
	}

	render () {
		const { t } = this.props

		if (this.props.rundown) {
			return (
				<RundownTimingProvider rundown={this.props.rundown} >
					<ClockComponent rundownId={this.props.rundown._id} />
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
