import * as React from 'react'
import { withTracker } from '../lib/ReactMeteorData/react-meteor-data'
import * as ClassNames from 'classnames'
import { RunningOrder, RunningOrders } from '../../lib/collections/RunningOrders'
import { getCurrentTime } from '../../lib/lib'
import { SegmentLineUi } from './SegmentTimeline/SegmentTimelineContainer'
import { Segment } from '../../lib/collections/Segments'
import { withTiming, WithTiming } from './RunningOrderTiming'
import { ErrorBoundary } from './ErrorBoundary'

interface SegmentUi extends Segment {
	items?: Array<SegmentLineUi>
}

interface ISegmentPropsHeader {
	segment: SegmentUi
	runningOrder: RunningOrder
	totalDuration: number
	segmentLiveDurations?: TimeMap
	segmentStartsAt?: TimeMap
}

interface ISegmentLinePropsHeader {
	segmentLine: SegmentLineUi
	totalDuration: number
	segmentLiveDurations?: TimeMap
	segmentStartsAt?: TimeMap
	isLive: boolean
	isNext: boolean
}

interface TimeMap {
	[key: string]: number
}

const SegmentLineOverview: React.SFC<ISegmentLinePropsHeader> = (props: ISegmentLinePropsHeader) => {
	return (
		<ErrorBoundary>
			<div className={ClassNames('running-order__overview__segment__segment-line', {
				'live': props.isLive,
				'next': props.isNext,

				'has-played': ((props.segmentLine.startedPlayback || 0) > 0 && (props.segmentLine.duration || 0) > 0)
			})}
				style={{
					'width': (((Math.max(props.segmentLiveDurations && props.segmentLiveDurations[props.segmentLine._id] || 0, props.segmentLine.duration || props.segmentLine.expectedDuration || 0)) / props.totalDuration) * 100) + '%'
				}}
			>
				{ props.isNext &&
					<div className={'running-order__overview__segment__segment-line__next-line'}>
					</div>
				}
				{ props.isLive &&
					<div className={'running-order__overview__segment__segment-line__live-line'}
						style={{
							'left': (((getCurrentTime() - (props.segmentLine.startedPlayback || 0)) /
								(Math.max(props.segmentLiveDurations && props.segmentLiveDurations[props.segmentLine._id] || 0, props.segmentLine.duration || props.segmentLine.expectedDuration || 0))) * 100) + '%'
						}}>
					</div>
				}
				<div className='running-order__overview__segment__segment-line__label'>
					{props.segmentLine.slug}
				</div>
			</div>
			{props.isLive && ((((getCurrentTime() - (props.segmentLine.startedPlayback || 0)) + ((props.segmentStartsAt && props.segmentStartsAt[props.segmentLine._id]) || 0)) / props.totalDuration * 100) > 0) &&
				<div className='running-order__overview__segment__segment-line__live-shade'
					style={{
						'width': (((getCurrentTime() - (props.segmentLine.startedPlayback || 0)) + ((props.segmentStartsAt && props.segmentStartsAt[props.segmentLine._id]) || 0)) / props.totalDuration * 100) + '%'
					}}>
				</div>
			}
		</ErrorBoundary>
	)
}

const SegmentOverview: React.SFC<ISegmentPropsHeader> = (props: ISegmentPropsHeader) => {
	return props.segment.items && (
		<React.Fragment>
			{ props.segment.items.map((item) => {
				return (
					<SegmentLineOverview segmentLine={item}
						key={item._id}
						totalDuration={props.totalDuration}
						segmentLiveDurations={props.segmentLiveDurations}
						segmentStartsAt={props.segmentStartsAt}
						isLive={props.runningOrder.currentSegmentLineId === item._id}
						isNext={props.runningOrder.nextSegmentLineId === item._id}
						 />
				)
			}) }
		</React.Fragment>
	) || null
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

export const RunningOrderOverview = withTiming<RunningOrderOverviewProps, RunningOrderOverviewState>()(
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
		if (this.props.runningOrder && this.props.runningOrderId && this.props.segments) {
			const totalDuration = 1

			return (<ErrorBoundary>
				<div className='running-order__overview'>
				{
					this.props.segments.map((item) => {
						if (this.props.runningOrder) {
							return <SegmentOverview
								segment={item}
								key={item._id}
								totalDuration={Math.max((this.props.timingDurations && this.props.timingDurations.asPlayedRundownDuration) || 1, this.props.runningOrder.expectedDuration || 1)}
								segmentLiveDurations={(this.props.timingDurations && this.props.timingDurations.segmentLineDurations) || {}} runningOrder={this.props.runningOrder}
								segmentStartsAt={(this.props.timingDurations && this.props.timingDurations.segmentLineStartsAt) || {}}
								/>
						}
					})
				}
				</div>
			</ErrorBoundary>)
		}
		return null
	}
}))
