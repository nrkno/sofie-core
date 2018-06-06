import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import * as PropTypes from 'prop-types'
import { withTracker } from '../lib/ReactMeteorData/react-meteor-data'
import { translate, InjectedTranslateProps } from 'react-i18next'
import * as CoreIcon from '@nrk/core-icons/jsx'
import { Spinner } from '../lib/Spinner'
import * as ClassNames from 'classnames'

import { RunningOrder, RunningOrders } from '../../lib/collections/RunningOrders'

import { getCurrentTime } from '../../lib/lib'

import { SegmentLineUi } from './SegmentTimeline/SegmentTimelineContainer'
import { Segment } from '../../lib/collections/Segments'
import { RunningOrderTiming, withTiming } from './RunningOrderTiming'

interface IPropsHeader {
	runningOrderId: string
	runningOrder: RunningOrder
	segments: Array<SegmentUi>
	segmentLiveDurations?: TimeMap
}

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
		<React.Fragment>
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
		</React.Fragment>
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

export const RunningOrderOverview = withTracker((props: IPropsHeader, state) => {
	if (props.runningOrderId) {
		const ro = RunningOrders.findOne(props.runningOrderId)

		if (ro) {
			let segments: Array<SegmentUi> = ro.getSegments()
			segments.forEach((seg) => {
				seg.items = seg.getSegmentLines()
			})

			return {
				segments,
				runningOrder: ro
			}
		}
	}
})(withTiming()(class extends React.Component<IPropsHeader & RunningOrderTiming.InjectedROTimingProps> {
	render () {
		if (!this.props.runningOrderId || !this.props.segments) {
			return null
		} else {
			const totalDuration = 1

			return (
				<div className='running-order__overview'>
				{
					this.props.segments.map((item) => {
						return <SegmentOverview segment={item}
							key={item._id}
							totalDuration={Math.max((this.props.timingDurations && this.props.timingDurations.asPlayedRundownDuration) || 1, this.props.runningOrder.expectedDuration || 1)}
							segmentLiveDurations={(this.props.timingDurations && this.props.timingDurations.segmentLineDurations) || {}} runningOrder={this.props.runningOrder}
							segmentStartsAt={(this.props.timingDurations && this.props.timingDurations.segmentLineStartsAt) || {}}
							/>
					})
				}
				</div>
			)
		}
	}
}))
