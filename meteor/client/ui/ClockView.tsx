import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import { withTracker } from '../lib/ReactMeteorData/react-meteor-data'
import { translate, InjectedTranslateProps } from 'react-i18next'
import * as $ from 'jquery'
import * as _ from 'underscore'

import { RunningOrder, RunningOrders } from '../../lib/collections/RunningOrders'
import { Segment, Segments } from '../../lib/collections/Segments'

import { RunningOrderTimingProvider, withTiming, WithTiming } from './RunningOrderTiming'
import { SegmentLines, SegmentLine } from '../../lib/collections/SegmentLines'
import { SegmentLineUi } from './SegmentTimeline/SegmentTimelineContainer'

import { RundownUtils } from '../lib/rundown'
import * as TimecodeString from 'smpte-timecode'
import { Settings } from '../../lib/Settings'
import { getCurrentTime, objectPathGet } from '../../lib/lib'
import { SegmentItemIconContainer } from './SegmentItemIcons/SegmentItemIcon'
import CamInputICon from './SegmentItemIcons/Renderers/CamInput'
import { MeteorReactComponent } from '../lib/MeteorReactComponent'

interface SegmentUi extends Segment {
	items?: Array<SegmentLineUi>
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
		const time = this.props.time
		const timeString = RundownUtils.formatDiffToTimecode(time) // @todo: something happened here with negative time
		const timeStringSegments = timeString.split(':')
		const fontWeight = (no) => true
		return (
			<span>
				{time < 0 ? <span>+</span> : <span>&ndash;</span>}
				<span className={fontWeight(timeStringSegments[0]) ? 'fontweight-300' : ''}>{timeStringSegments[0]}</span>:
				<span className={fontWeight(timeStringSegments[1]) ? 'fontweight-300' : ''}>{timeStringSegments[1]}</span>{timeStringSegments.length > 2 ? ':' +
				<span className={fontWeight(timeStringSegments[2]) ? 'fontweight-300' : ''}>{timeStringSegments[2]}</span> : null}
			</span>
		)
	}
}

const Timecode = class extends React.Component<{ time: number }> {
	render () {
		const time = this.props.time
		const timecode = new TimecodeString(time * Settings['frameRate'] / 1000, Settings['frameRate'], false).toString() as string
		const timecodeSegments = timecode.split(':')
		let fontNormal = false

		const fontWeight = (timecodeSegment) => {
			if (timecodeSegment !== '00') {
				fontNormal = true
			}
			return fontNormal
		}

		return (
			<span>
				{time < 0 ? <span>+</span> : <span></span>}
				<span className={fontWeight(timecodeSegments[0]) ? 'fontweight-300' : ''}>{timecodeSegments[0]}</span>:
				<span className={fontWeight(timecodeSegments[1]) ? 'fontweight-300' : ''}>{timecodeSegments[1]}</span>:
				<span className={fontWeight(timecodeSegments[2]) ? 'fontweight-300' : ''}>{timecodeSegments[2]}</span>:
				<span className={fontWeight(timecodeSegments[3]) ? 'fontweight-normal' : ''}>{timecodeSegments[3]}</span>
			</span>
		)
	}
}

const ClockComponent = withTiming<RunningOrderOverviewProps, RunningOrderOverviewState>()(
	withTracker<WithTiming<RunningOrderOverviewProps>, RunningOrderOverviewState, RunningOrderOverviewTrackedProps>((props: RunningOrderOverviewProps) => {

		let ro: RunningOrder | undefined
		if (props.runningOrderId) ro = RunningOrders.findOne(props.runningOrderId)
		let segments: Array<SegmentUi> = []
		if (ro) {
			segments = ro.getSegments()
			segments.forEach((seg) => {
				seg.items = seg.getSegmentLines()
			})

		}
		return {
			segments,
			runningOrder: ro
		}
	})(
	class extends MeteorReactComponent<WithTiming<RunningOrderOverviewProps & RunningOrderOverviewTrackedProps>, RunningOrderOverviewState> {
		render () {
			const { runningOrder, segments } = this.props

			if (runningOrder && this.props.runningOrderId && this.props.segments) {
				let currentSegmentLine
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
					currentSegmentDuration += currentSegmentLine.expectedDuration || 0
					currentSegmentDuration += -1 * (currentSegmentLine.duration || 0)
					if (!currentSegmentLine.duration && currentSegmentLine.startedPlayback) {
						currentSegmentDuration += -1 * (getCurrentTime() - currentSegmentLine.startedPlayback)
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
				let nextSegmentDuration = 0
				if (nextSegmentLine) {
					nextSegmentDuration += nextSegmentLine.expectedDuration || 0
					nextSegmentDuration += -1 * (nextSegmentLine.duration || 0)
					if (!nextSegmentLine.duration && nextSegmentLine.startedPlayback) {
						nextSegmentDuration += -1 * (getCurrentTime() - nextSegmentLine.startedPlayback)
					}
				}

				return (
					<div className='clocks-full-screen'>
						<div className='clocks-half clocks-top'>
							<div className='clocks-segment-icon'>
								{currentSegmentLine ?
									<SegmentItemIconContainer segmentItemId={currentSegmentLine._id} studioInstallationId={runningOrder.studioInstallationId} />
								: ''}
							</div>
							<div className='clocks-segment-title clocks-current-segment-title'>
								{currentSegmentLine ? currentSegmentLine.slug : '_'}
							</div>
							<div className='clocks-segment-countdown clocks-current-segment-countdown'>
								<Timediff time={currentSegmentDuration} />
							</div>
						</div>
						<div className='clocks-half clocks-bottom clocks-top-bar'>
							<div className='clocks-segment-icon'>
								{nextSegmentLine ?
									<SegmentItemIconContainer segmentItemId={nextSegmentLine._id} studioInstallationId={runningOrder.studioInstallationId} />
								: ''}
							</div>
							<div className='clocks-bottom-top'>
								<div className='clocks-segment-title'>
									{nextSegmentLine ? nextSegmentLine.slug : '_'}
								</div>
								<div className='clocks-segment-countdown'>
									<Timecode time={nextSegmentDuration} />
								</div>
							</div>
							<div className='clocks-rundown-title clocks-top-bar'>
								<span className='fontweight-light'>{('Rundown')}</span>: {runningOrder ? runningOrder.name : 'UNKNOWN'}
							</div>
						</div>
					</div>
				)
			}
			return null
		}
	}))

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
	console.log('inWithTracker', this)
	let aa = this.subscribe('studioInstallations', {
		_id: studioId
	})

	console.log(aa.ready())

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
		console.log('componentDidMount', this)
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
			this.subscribe('showStyles', {
				_id: runningOrder.showStyleId
			})
			this.subscribe('segmentLineAdLibItems', {
				runningOrderId: runningOrder._id
			})
		}
	}

	componentWillUnmount () {
		$(document.body).removeClass('dark xdark')
	}

	render () {
		const { t, runningOrder, segmentLines, segments } = this.props

		if (runningOrder) {
			return (
				<RunningOrderTimingProvider runningOrder={runningOrder} >
					<ClockComponent runningOrderId={runningOrder._id} />
				</RunningOrderTimingProvider>
			)
		} else {
			return null
		}
	}
}
))
