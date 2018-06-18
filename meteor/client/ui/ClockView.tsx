import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import { withTracker } from '../lib/ReactMeteorData/react-meteor-data'
import { translate, InjectedTranslateProps } from 'react-i18next'
import * as $ from 'jquery'

import { RunningOrder, RunningOrders } from '../../lib/collections/RunningOrders'
import { Segment, Segments } from '../../lib/collections/Segments'

import { RunningOrderTimingProvider, withTiming, WithTiming } from './RunningOrderTiming'
import { SegmentLines, SegmentLine } from '../../lib/collections/SegmentLines'
// import { SegmentLineUi } from './SegmentTimeline/SegmentTimelineContainer'

import { RundownUtils } from '../lib/rundown'
import * as TimecodeString from 'smpte-timecode'
import { Settings } from '../../lib/Settings'
import { duration } from 'moment';
import { getCurrentTime } from '../../lib/lib';

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
				{time >= 0 ? <span>+</span> : <span>\u2013</span>}
				<span className={fontWeight(timecodeSegments[0]) ? 'fontweight-normal' : ''}>{timecodeSegments[0]}</span>:
				<span className={fontWeight(timecodeSegments[1]) ? 'fontweight-normal' : ''}>{timecodeSegments[1]}</span>:
				<span className={fontWeight(timecodeSegments[2]) ? 'fontweight-normal' : ''}>{timecodeSegments[2]}</span>:
				<span className={fontWeight(timecodeSegments[3]) ? 'fontweight-normal' : ''}>{timecodeSegments[3]}</span>
			</span>
		)
	}
}

const ClockComponent = withTiming<RunningOrderOverviewProps, RunningOrderOverviewState>()(
	withTracker<WithTiming<RunningOrderOverviewProps>, RunningOrderOverviewState, RunningOrderOverviewTrackedProps>((props: RunningOrderOverviewProps, state) => {

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
	class extends React.Component<WithTiming<RunningOrderOverviewProps & RunningOrderOverviewTrackedProps>, RunningOrderOverviewState> {
		render () {
			const { runningOrder, segments } = this.props

			if (runningOrder && this.props.runningOrderId && this.props.segments) {
				const currentSegment = this.props.segments.find((segment) =>
						segment.items ? segment.items.find((item) =>
							item._id === runningOrder.currentSegmentLineId
						) : false
					)
				let currentSegmentDuration = 0
				if (currentSegment) {
					if (currentSegment.items) {
						for (const item of currentSegment.items) {
							currentSegmentDuration += item.expectedDuration || 0
							currentSegmentDuration += -1 * (item.duration || 0)
							if (!item.duration && item.startedPlayback) {
								currentSegmentDuration += -1 * (getCurrentTime() - item.startedPlayback)
							}
						}
					}
				}

				const nextSegment = this.props.segments.find((segment) =>
						segment.items ? segment.items.find((item) =>
							item._id === runningOrder.nextSegmentLineId
						) : false
					)
				let nextSegmentDuration = 0
				if (nextSegment) {
					if (nextSegment.items) {
						const durations = nextSegment.items.map((item) => this.props.timingDurations.segmentLineDurations ? this.props.timingDurations.segmentLineDurations[item._id] : 0)
						for (const segmentLineDuration of durations) {
							nextSegmentDuration += segmentLineDuration
						}
					}
				}

				return (
					<div className='clocks-full-screen'>
						<div className='clocks-half'>
							<div className='clocks-segment-title clocks-current-segment-title'>
								{currentSegment ? currentSegment.name : '_'}
							</div>
							<div className='clocks-segment-countdown clocks-current-segment-countdown'>
								<Timecode time={currentSegmentDuration} />
								{/* <span>–</span>
								<span>00</span>:
								<span>00</span>:
								<span className='fontweight-normal'>12</span>:
								<span className='fontweight-normal'>24</span> */}
							</div>
						</div>
						<div className='clocks-half clocks-top-bar'>
							<div>
								<div className='clocks-segment-title'>
									{nextSegment ? nextSegment.name : '_'}
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
}

interface IStateHeader {
}

export const ClockView = translate()(withTracker((props, state) => {
	let subRunningOrders = Meteor.subscribe('runningOrders', {})
	let subSegments = Meteor.subscribe('segments', {})
	let subSegmentLines = Meteor.subscribe('segmentLines', {})
	let subSegmentLineItems = Meteor.subscribe('segmentLineItems', {})
	let subStudioInstallations = Meteor.subscribe('studioInstallations', {})
	let subShowStyles = Meteor.subscribe('showStyles', {})
	let subSegmentLineAdLibItems = Meteor.subscribe('segmentLineAdLibItems', {})

	let runningOrder = RunningOrders.findOne({ active: true })
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
class extends React.Component<WithTiming<IPropsHeader>, IStateHeader> {
	componentDidMount () {
		$(document.body).addClass('dark xdark')
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
