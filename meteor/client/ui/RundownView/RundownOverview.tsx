import * as React from 'react'
import * as _ from 'underscore'

import { withTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import * as ClassNames from 'classnames'
import { Rundown, Rundowns } from '../../../lib/collections/Rundowns'
import { getCurrentTime, extendMandadory, normalizeArray } from '../../../lib/lib'
import { PartUi } from '../SegmentTimeline/SegmentTimelineContainer'
import { Segment } from '../../../lib/collections/Segments'
import { withTiming, WithTiming } from './RundownTiming'
import { ErrorBoundary } from '../../lib/ErrorBoundary'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { RundownUtils } from '../../lib/rundown'
import { PartExtended } from '../../../lib/Rundown'
import { Part } from '../../../lib/collections/Parts'
import { RundownPlaylists, RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { findPartInstanceOrWrapToTemporary } from '../../../lib/collections/PartInstances'

interface SegmentUi extends Segment {
	items: Array<PartUi>
}

interface ISegmentPropsHeader {
	segment: SegmentUi
	playlist: RundownPlaylist
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
	const innerPart = props.part.instance.part
	return (
		<ErrorBoundary>
			<div className={ClassNames('rundown__overview__segment__part', {
				'live': props.isLive,
				'next': props.isNext,

				'has-played': (innerPart.startedPlayback && (innerPart.getLastStartedPlayback() || 0) > 0 && (innerPart.duration || 0) > 0)
			})}
				style={{
					'width': (((Math.max(props.segmentLiveDurations && props.segmentLiveDurations[innerPart._id] || 0, innerPart.duration || innerPart.expectedDuration || 0)) / (props.segmentDuration || 0)) * 100) + '%'
				}}
			>
				{ props.isNext &&
					<div className='rundown__overview__segment__part__next-line'>
					</div>
				}
				{ props.isLive &&
					<div className='rundown__overview__segment__part__live-line'
						style={{
							'left': (((getCurrentTime() - (innerPart.getLastStartedPlayback() || 0)) /
								(Math.max(props.segmentLiveDurations && props.segmentLiveDurations[innerPart._id] || 0, innerPart.duration || innerPart.expectedDuration || 0))) * 100) + '%'
						}}>
					</div>
				}
			</div>
		</ErrorBoundary>
	)
}

const SegmentOverview: React.SFC<ISegmentPropsHeader> = (props: ISegmentPropsHeader) => {
	const segmentDuration = props.segmentLiveDurations ? props.segment.items.map((i) => props.segmentLiveDurations[i.instance.part._id]).reduce((memo, item) => (memo || 0) + (item || 0), 0) : undefined

	return props.segment.items && (
		<div className={ClassNames('rundown__overview__segment', {
			'next': props.segment.items.find((i) => i.instance._id === props.playlist.nextPartInstanceId) ? true : false,
			'live': props.segment.items.find((i) => i.instance._id === props.playlist.currentPartInstanceId) ? true : false
		})} style={{
			'width': ((segmentDuration || 0) / props.totalDuration * 100) + '%'
		}}>
			{ props.segment.items.map((item, index) => {
				return (
					<PartOverview part={item}
						key={item.instance._id}
						totalDuration={props.totalDuration}
						segmentLiveDurations={props.segmentLiveDurations}
						segmentStartsAt={props.segmentStartsAt}
						isLive={props.playlist.currentPartInstanceId === item.instance._id}
						isNext={props.playlist.nextPartInstanceId === item.instance._id}
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
	rundownPlaylistId: string
	segmentLiveDurations?: TimeMap
}
interface RundownOverviewState {
}
interface RundownOverviewTrackedProps {
	playlist?: RundownPlaylist
	segments: Array<SegmentUi>
}

export const RundownOverview = withTiming<RundownOverviewProps, RundownOverviewState>()(
withTracker<WithTiming<RundownOverviewProps>, RundownOverviewState, RundownOverviewTrackedProps>((props: RundownOverviewProps) => {

	let playlist: RundownPlaylist | undefined
	if (props.rundownPlaylistId) playlist = RundownPlaylists.findOne(props.rundownPlaylistId)
	let segments: Array<SegmentUi> = []
	if (playlist) {
		segments = playlist.getSegments().map((s) => extendMandadory<Segment, SegmentUi>(s, {
			items: []
		}))
		const segmentsMap = normalizeArray(segments, '_id')
		const parts = playlist.getParts()
		const partInstances = playlist.getActivePartInstances()

		parts.forEach(p => {
			const instance = findPartInstanceOrWrapToTemporary(partInstances, p)
			segmentsMap[p.segmentId].items.push({
				instance,
				pieces: [],
				renderedDuration: 0,
				startsAt: 0,
				willProbablyAutoNext: false
			})
		})

		// segments = _.map(playlist.getSegments(), (segment) => {
		// 	return extendMandadory<Segment, SegmentUi>(segment, {
		// 		items: _.map(segment.getParts(), (part) => {
		// 			let sle = extendMandadory<Part, PartExtended>(part, {
		// 				pieces: [],
		// 				renderedDuration: 0,
		// 				startsAt: 0,
		// 				willProbablyAutoNext: false
		// 			})

		// 			return extendMandadory<PartExtended, PartUi>(sle, {})
		// 		})
		// 	})
		// })
	}
	return {
		segments,
		playlist
	}
})(
class extends MeteorReactComponent<WithTiming<RundownOverviewProps & RundownOverviewTrackedProps>, RundownOverviewState> {
	render () {
		if (this.props.playlist && this.props.rundownPlaylistId && this.props.segments) {
			return (<ErrorBoundary>
				<div className='rundown__overview'>
				{
					this.props.segments.map((item) => {
						return <SegmentOverview
							segment={item}
							key={item._id}
							totalDuration={Math.max((this.props.timingDurations && this.props.timingDurations.asPlayedRundownDuration) || 1, this.props.playlist!.expectedDuration || 1)}
							segmentLiveDurations={(this.props.timingDurations && this.props.timingDurations.partDurations) || {}}
							playlist={this.props.playlist!}
							segmentStartsAt={(this.props.timingDurations && this.props.timingDurations.partStartsAt) || {}}
							/>
					})
				}
				</div>
			</ErrorBoundary>)
		}
		return null
	}
}))
