import * as React from 'react'
import * as ClassNames from 'classnames'
import { withTracker } from '../lib/ReactMeteorData/react-meteor-data'
import { translate, InjectedTranslateProps } from 'react-i18next'
import * as $ from 'jquery'
import * as _ from 'underscore'

import { RunningOrder, RunningOrders } from '../../lib/collections/RunningOrders'
import { Segment, Segments } from '../../lib/collections/Segments'

import { RunningOrderTimingProvider, withTiming, WithTiming } from './RunningOrderView/RunningOrderTiming'
import { SegmentLines, SegmentLine } from '../../lib/collections/SegmentLines'
import { SegmentLineUi } from './SegmentTimeline/SegmentTimelineContainer'

import { RundownUtils } from '../lib/rundown'
import { getCurrentTime, objectPathGet, extendMandadory } from '../../lib/lib'
import { SegmentItemIconContainer, SegmentItemNameContainer } from './SegmentItemIcons/SegmentItemIcon'
import { MeteorReactComponent } from '../lib/MeteorReactComponent'
import { meteorSubscribe, PubSub } from '../../lib/api/pubsub'

interface SegmentUi extends Segment {
	items: Array<SegmentLineUi>
}

interface TimeMap {
	[key: string]: number
}

interface RunningOrderOverviewProps {
	runningOrderId: string
	segmentLiveDurations?: TimeMap
}
interface RunningOrderOverviewState {
}
interface RunningOrderOverviewTrackedProps {
	runningOrder?: RunningOrder
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

const ClockComponent = translate()(withTiming<RunningOrderOverviewProps, RunningOrderOverviewState>()(
	withTracker<WithTiming<RunningOrderOverviewProps & InjectedTranslateProps>, RunningOrderOverviewState, RunningOrderOverviewTrackedProps>((props: RunningOrderOverviewProps) => {

		let ro: RunningOrder | undefined
		if (props.runningOrderId) ro = RunningOrders.findOne(props.runningOrderId)
		let segments: Array<SegmentUi> = []
		if (ro) {
			segments = _.map(ro.getSegments(), (segment) => {
				const displayDurationGroups: _.Dictionary<number> = {}
				const segmentLines = segment.getSegmentLines()
				let displayDuration = 0

				return extendMandadory<Segment, SegmentUi>(segment, {
					items: _.map(segmentLines, (sl, index) => {
						if (sl.displayDurationGroup && (
							(displayDurationGroups[sl.displayDurationGroup]) ||
							// or there is a following member of this displayDurationGroup
							(segmentLines[index + 1] && segmentLines[index + 1].displayDurationGroup === sl.displayDurationGroup))) {
							displayDurationGroups[sl.displayDurationGroup] = (displayDurationGroups[sl.displayDurationGroup] || 0) + ((sl.expectedDuration || 0) - (sl.duration || 0))
							displayDuration = Math.max(0, Math.min(sl.displayDuration || sl.expectedDuration || 0, sl.expectedDuration || 0) || displayDurationGroups[sl.displayDurationGroup])
						}
						return extendMandadory<SegmentLine, SegmentLineUi>(sl, {
							items: [],
							renderedDuration: sl.expectedDuration ? 0 : displayDuration,
							startsAt: 0,
							willProbablyAutoNext: false
						})
					})
				})
			})

		}
		return {
			segments,
			runningOrder: ro
		}
	})(
	class extends MeteorReactComponent<WithTiming<RunningOrderOverviewProps & RunningOrderOverviewTrackedProps & InjectedTranslateProps>, RunningOrderOverviewState> {
		componentWillMount () {
			this.subscribe('runningOrders', {
				_id: this.props.runningOrderId
			})
			this.subscribe('segments', {
				runningOrderId: this.props.runningOrderId
			})
			this.subscribe('segmentLines', {
				runningOrderId: this.props.runningOrderId
			})
		}

		render () {
			const { runningOrder, segments } = this.props

			if (runningOrder && this.props.runningOrderId && this.props.segments) {
				let currentSegmentLine: SegmentLineUi | undefined
				for (const segment of segments) {
					if (segment.items) {
						for (const item of segment.items) {
							if (item._id === runningOrder.currentSegmentLineId) {
								currentSegmentLine = item
							}
						}
					}
				}
				let currentSegmentDuration = 0
				if (currentSegmentLine) {
					currentSegmentDuration += currentSegmentLine.renderedDuration || currentSegmentLine.expectedDuration || 0
					currentSegmentDuration += -1 * (currentSegmentLine.duration || 0)
					if (!currentSegmentLine.duration && currentSegmentLine.startedPlayback) {
						currentSegmentDuration += -1 * (getCurrentTime() - (currentSegmentLine.getLastStartedPlayback() || 0))
					}
				}

				let nextSegmentLine
				for (const segment of segments) {
					if (segment.items) {
						for (const item of segment.items) {
							if (item._id === runningOrder.nextSegmentLineId) {
								nextSegmentLine = item
							}
						}
					}
				}
				// let nextSegmentDuration = 0
				// if (nextSegmentLine) {
				// 	nextSegmentDuration += nextSegmentLine.expectedDuration || 0
				// 	nextSegmentDuration += -1 * (nextSegmentLine.duration || 0)
				// 	if (!nextSegmentLine.duration && nextSegmentLine.startedPlayback) {
				// 		nextSegmentDuration += -1 * (getCurrentTime() - nextSegmentLine.startedPlayback)
				// 	}
				// }

				const overUnderClock = runningOrder.expectedDuration ?
					(this.props.timingDurations.asPlayedRundownDuration || 0) - runningOrder.expectedDuration
					: (this.props.timingDurations.asPlayedRundownDuration || 0) - (this.props.timingDurations.totalRundownDuration || 0)

				return (
					<div className='clocks-full-screen'>
						<div className='clocks-half clocks-top'>
							{currentSegmentLine ?
								<React.Fragment>
									<div className='clocks-segment-icon clocks-current-segment-icon'>
										<SegmentItemIconContainer segmentItemId={currentSegmentLine._id} showStyleBaseId={runningOrder.showStyleBaseId} runningOrderId={runningOrder._id} />
									</div>
									<div className='clocks-segment-title clocks-current-segment-title'>
										{currentSegmentLine.title.split(';')[0]}
									</div>
									<div className='clocks-segmentline-title clocks-segment-title clocks-current-segment-title'>
										<SegmentItemNameContainer segmentLineSlug={currentSegmentLine.title} segmentItemId={currentSegmentLine._id} showStyleBaseId={runningOrder.showStyleBaseId} runningOrderId={runningOrder._id} />
									</div>
									<div className='clocks-current-segment-countdown clocks-segment-countdown'>
										<Timediff time={currentSegmentDuration} />
									</div>
								</React.Fragment> :
								runningOrder.expectedStart && <div className='clocks-ro-countdown clocks-segment-countdown'>
									<Timediff time={runningOrder.expectedStart - getCurrentTime()} />
								</div>
							}
						</div>
						<div className='clocks-half clocks-bottom clocks-top-bar'>
							<div className='clocks-segment-icon'>
								{nextSegmentLine ?
									<SegmentItemIconContainer segmentItemId={nextSegmentLine._id} showStyleBaseId={runningOrder.showStyleBaseId} runningOrderId={runningOrder._id} />
								: ''}
							</div>
							<div className='clocks-bottom-top'>
								<div className='clocks-segment-title'>
									{currentSegmentLine && currentSegmentLine.autoNext ?
									<div style={{display: 'inline-block', height: '18vh'}}>
										<img style={{height: '12vh', paddingTop: '2vh'}} src='/icons/auto-presenter-screen.svg' />
									</div> : ''}
									{nextSegmentLine ? nextSegmentLine.slug.split(';')[0] : '_'}
								</div>
								<div className='clocks-segment-title clocks-segmentline-title'>
									{nextSegmentLine ?
										<SegmentItemNameContainer segmentLineSlug={nextSegmentLine.slug} segmentItemId={nextSegmentLine._id} showStyleBaseId={runningOrder.showStyleBaseId} runningOrderId={runningOrder._id} />
									: '_'}
								</div>
							</div>
							<div className='clocks-rundown-bottom-bar'>
								<div className='clocks-rundown-title'>
									{runningOrder ? runningOrder.name : 'UNKNOWN'}
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
	runningOrder: RunningOrder
	segments: Array<Segment>
	segmentLines: Array<SegmentLine>
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
	let runningOrder = (
		RunningOrders.findOne({
			active: true,
			studioInstallationId: studioId
		})
	)
	meteorSubscribe(PubSub.studioInstallations, {
		_id: studioId
	})

	// let dep = new Tracker.Dependency()
	// dep.depend()
	// Meteor.setTimeout(() => {
	// 	console.log('a')
	// 	dep.changed()
	// }, 3000)
	let segments = runningOrder ? Segments.find({ runningOrderId: runningOrder._id }, {
		sort: {
			'_rank': 1
		}
	}).fetch() : undefined
	let segmentLines = runningOrder ? SegmentLines.find({ runningOrderId: runningOrder._id }).fetch() : undefined
	// let roDurations = calculateDurations(runningOrder, segmentLines)
	return {
		runningOrder,
		segments,
		segmentLines
	}
})(
class extends MeteorReactComponent<WithTiming<IPropsHeader>, IStateHeader> {
	componentDidMount () {
		$(document.body).addClass('dark xdark')
		let studioId = objectPathGet(this.props, 'match.params.studioId')
		if (studioId) {
			this.subscribe('studioInstallations', {
				_id: studioId
			})
			this.subscribe('runningOrders', {
				active: true,
				studioInstallationId: studioId
			})
		}
		let runningOrder = (
			RunningOrders.findOne({
				active: true,
				studioInstallationId: studioId
			})
		)
		if (runningOrder) {
			this.subscribe('segments', {
				runningOrderId: runningOrder._id
			})
			this.subscribe('segmentLines', {
				runningOrderId: runningOrder._id
			})
			this.subscribe('segmentLineItems', {
				runningOrderId: runningOrder._id
			})
			this.subscribe('showStyleBases', {
				_id: runningOrder.showStyleBaseId
			})
			this.subscribe('segmentLineAdLibItems', {
				runningOrderId: runningOrder._id
			})
		}
	}

	componentWillUnmount () {
		this._cleanUp()
		$(document.body).removeClass('dark xdark')
	}

	render () {
		const { t } = this.props

		if (this.props.runningOrder) {
			return (
				<RunningOrderTimingProvider runningOrder={this.props.runningOrder} >
					<ClockComponent runningOrderId={this.props.runningOrder._id} />
				</RunningOrderTimingProvider>
			)
		} else {
			return (
				<div className='running-order-view running-order-view--unpublished'>
					<div className='running-order-view__label'>
						<p>
							{t('There is no running order active in this studio.')}
						</p>
					</div>
				</div>
			)
		}
	}
}
))
