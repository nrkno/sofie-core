import * as React from 'react'
import * as _ from 'underscore'

import { withTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import * as ClassNames from 'classnames'
import { Rundown, Rundowns } from '../../../lib/collections/Rundowns'
import { getCurrentTime, extendMandadory } from '../../../lib/lib'
import { PartUi } from '../SegmentTimeline/SegmentTimelineContainer'
import { Segment } from '../../../lib/collections/Segments'
import { withTiming, WithTiming } from './RundownTiming'
import { ErrorBoundary } from '../../lib/ErrorBoundary'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { RundownUtils } from '../../lib/rundown'
import { PartExtended } from '../../../lib/Rundown'
import { Part } from '../../../lib/collections/Parts'

interface SegmentUi extends Segment {
	items: Array<PartUi>
}

interface ISegmentPropsHeader {
	segment: SegmentUi
	rundown: Rundown
	totalDuration: number
	segmentLiveDurations: TimeMap
	segmentStartsAt?: TimeMap
}

interface IPartPropsHeader {
	part: PartUi
	totalDuration: number
	segmentLiveDurations?: TimeMap
	segmentStartsAt?: TimeMap
	isLive: boolean
	isNext: boolean
	segmentDuration: number | undefined
}

interface TimeMap {
	[key: string]: number
}

const PartOverview: React.SFC<IPartPropsHeader> = (props: IPartPropsHeader) => {
	return (
		<ErrorBoundary>
			<div className={ClassNames('rundown__overview__segment__part', {
				'live': props.isLive,
				'next': props.isNext,

				'has-played': (props.part.startedPlayback && (props.part.getLastStartedPlayback() || 0) > 0 && (props.part.duration || 0) > 0)
			})}
				style={{
					'width': (((Math.max(props.segmentLiveDurations && props.segmentLiveDurations[props.part._id] || 0, props.part.duration || props.part.expectedDuration || 0)) / (props.segmentDuration || 0)) * 100) + '%'
				}}
			>
				{ props.isNext &&
					<div className='rundown__overview__segment__part__next-line'>
					</div>
				}
				{ props.isLive &&
					<div className='rundown__overview__segment__part__live-line'
						style={{
							'left': (((getCurrentTime() - (props.part.getLastStartedPlayback() || 0)) /
								(Math.max(props.segmentLiveDurations && props.segmentLiveDurations[props.part._id] || 0, props.part.duration || props.part.expectedDuration || 0))) * 100) + '%'
						}}>
					</div>
				}
			</div>
		</ErrorBoundary>
	)
}

const SegmentOverview: React.SFC<ISegmentPropsHeader> = (props: ISegmentPropsHeader) => {
	const segmentDuration = props.segmentLiveDurations ? props.segment.items.map((i) => props.segmentLiveDurations[i._id]).reduce((memo, item) => (memo || 0) + (item || 0), 0) : undefined

	return props.segment.items && (
		<div className={ClassNames('rundown__overview__segment', {
			'next': props.segment.items.find((i) => i._id === props.rundown.nextPartId) ? true : false,
			'live': props.segment.items.find((i) => i._id === props.rundown.currentPartId) ? true : false
		})} style={{
			'width': ((segmentDuration || 0) / props.totalDuration * 100) + '%'
		}}>
			{ props.segment.items.map((item, index) => {
				return (
					<PartOverview part={item}
						key={item._id}
						totalDuration={props.totalDuration}
						segmentLiveDurations={props.segmentLiveDurations}
						segmentStartsAt={props.segmentStartsAt}
						isLive={props.rundown.currentPartId === item._id}
						isNext={props.rundown.nextPartId === item._id}
						segmentDuration={segmentDuration}
						 />
				)
			}) }
			{ props.segment.name &&
				<div className='rundown__overview__segment__part__label' style={{
					'maxWidth': '100%'
				}}>
					{props.segment.name}
					{segmentDuration && _.isNumber(segmentDuration) &&
						<span className='rundown__overview__segment__part__label__duration'>{RundownUtils.formatDiffToTimecode(segmentDuration, false, false, false, false, true)}</span>
					}
				</div>
			}
		</div>
	) || null
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

export const RundownOverview = withTiming<RundownOverviewProps, RundownOverviewState>()(
withTracker<WithTiming<RundownOverviewProps>, RundownOverviewState, RundownOverviewTrackedProps>((props: RundownOverviewProps) => {

	let rundown: Rundown | undefined
	if (props.rundownId) rundown = Rundowns.findOne(props.rundownId)
	let segments: Array<SegmentUi> = []
	if (rundown) {
		const segmentMap = new Map<string, SegmentUi>()
		segments = rundown.getSegments({
			isHidden: {
				$ne: true
			}
		}).map((segment) => {
			const segmentUi = extendMandadory<Segment, SegmentUi>(segment, {
				items: []
			}) 
			segmentMap.set(segment._id, segmentUi)
			return segmentUi
		})

		rundown.getParts({
			segmentId: {
				$in: Array.from(segmentMap.keys())
			}
		}).map((part) => {
			const partUi = extendMandadory<Part, PartExtended>(part, {
				pieces: [],
				renderedDuration: 0,
				startsAt: 0,
				willProbablyAutoNext: false
			}) as PartUi
			const segment = segmentMap.get(part.segmentId)
			if (segment) segment.items.push(partUi)
		})
	}
	return {
		segments,
		rundown: rundown
	}
})(
class extends MeteorReactComponent<WithTiming<RundownOverviewProps & RundownOverviewTrackedProps>, RundownOverviewState> {
	render () {
		if (this.props.rundown && this.props.rundownId && this.props.segments) {

			return (<ErrorBoundary>
				<div className='rundown__overview'>
				{
					this.props.segments.map((item) => {
						if (this.props.rundown) {
							return <SegmentOverview
								segment={item}
								key={item._id}
								totalDuration={Math.max((this.props.timingDurations && this.props.timingDurations.asPlayedRundownDuration) || 1, this.props.rundown.expectedDuration || 1)}
								segmentLiveDurations={(this.props.timingDurations && this.props.timingDurations.partDurations) || {}}
								rundown={this.props.rundown}
								segmentStartsAt={(this.props.timingDurations && this.props.timingDurations.partStartsAt) || {}}
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
