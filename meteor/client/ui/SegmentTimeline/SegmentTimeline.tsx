import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import * as ReactDOM from 'react-dom'

import * as ClassNames from 'classnames'
import Moment from 'react-moment'
import * as _ from 'underscore'
import * as $ from 'jquery'

import { RunningOrder } from '../../../lib/collections/RunningOrders'
import { Segment, Segments } from '../../../lib/collections/Segments'
import { SegmentLine, SegmentLines } from '../../../lib/collections/SegmentLines'
import { SegmentLineItem, SegmentLineItems } from '../../../lib/collections/SegmentLineItems'
import { StudioInstallation, StudioInstallations } from '../../../lib/collections/StudioInstallations'
import { SegmentUi, SegmentLineUi, IOutputLayerUi, ISourceLayerUi, SegmentLineItemUi } from './SegmentTimelineContainer'
import { TimelineGrid } from './TimelineGrid'
import { SegmentTimelineLine } from './SegmentTimelineLine'

import { RundownUtils } from '../../lib/rundown'

interface IPropsHeader {
	key: string
	segment: SegmentUi
	runningOrder: RunningOrder,
	studioInstallation: StudioInstallation
	segmentLines: Array<SegmentLineUi>
	timeScale: number
	onCollapseOutputToggle?: (layer: IOutputLayerUi, event: any) => void
	collapsedOutputs: {
		[key: string]: boolean
	},
	onCollapseSegmentToggle?: (event: any) => void,
	isCollapsed?: boolean,
	scrollLeft: number,
	isLiveSegment: boolean,
	isNextSegment: boolean,
	followLiveLine: boolean,
	liveLineHistorySize: number,
	livePosition: number,
	onScroll: (scrollLeft: number, event: any) => void
	onFollowLiveLine: (state: boolean, event: any) => void
}
export class SegmentTimeline extends React.Component<IPropsHeader> {
	timeline: HTMLDivElement

	setTimelineRef = (el: HTMLDivElement) => {
		this.timeline = el
	}

	setZoomTimelineRef = (el: HTMLDivElement) => {
		return
	}

	getSegmentDuration () {
		return (this.props.segmentLines && RundownUtils.getSegmentDuration(this.props.segmentLines)) || 0
	}

	timelineStyle () {
		return {
			'transform': 'translateX(-' + (this.props.scrollLeft * this.props.timeScale).toString() + 'px)'
		}
	}

	renderLiveLine () {
		if (this.props.isLiveSegment) {
			let pixelPostion = (this.props.livePosition * this.props.timeScale) - (!this.props.followLiveLine ? (this.props.scrollLeft * this.props.timeScale) : 0)
			let lineStyle = {
				'left': (this.props.followLiveLine ?
							Math.min(pixelPostion, this.props.liveLineHistorySize).toString() :
							pixelPostion
						) + 'px'
			}

			return (
				<div className='segment-timeline__liveline'
					 style={lineStyle}>
					<div className='segment-timeline__liveline__label'
						 onClick={(e) => this.props.onFollowLiveLine && this.props.onFollowLiveLine(true, e)}>
						Live
					</div>
					<div className='segment-timeline__liveline__timecode'>
						{RundownUtils.formatTimeToTimecode(this.props.livePosition)}
					</div>
				</div>
			)
		}
	}

	renderZoomTimeline () {
		return this.props.segmentLines.map((segmentLine) => {
			return (
				<SegmentTimelineLine key={segmentLine._id}
					segment={this.props.segment}
					runningOrder={this.props.runningOrder}
					studioInstallation={this.props.studioInstallation}
					collapsedOutputs={this.props.collapsedOutputs}
					isCollapsed={this.props.isCollapsed}
					scrollLeft={0}
					timeScale={1}
					relative={true}
					totalSegmentDuration={this.getSegmentDuration()}
					segmentLine={segmentLine} />
			)
		})
	}

	renderTimeline () {
		return this.props.segmentLines.map((segmentLine) => {
			return (
				<SegmentTimelineLine key={segmentLine._id}
									 {...this.props}
									 segmentLine={segmentLine} />
			)
		})
	}

	renderOutputLayerControls () {
		if (this.props.segment.outputLayers !== undefined) {
			return _.map(_.values(this.props.segment.outputLayers!).sort((a, b) => {
				return a._rank - b._rank
			}), (outputLayer) => {
				if (outputLayer.used) {
					return (
						<div key={outputLayer._id} className={ClassNames('segment-timeline__output-layer-control', {
							'collapsable': outputLayer.sourceLayers !== undefined && outputLayer.sourceLayers.length > 1,
							'collapsed': this.props.collapsedOutputs[outputLayer._id] === true
						})}>
							<div className='segment-timeline__output-layer-control__label'
								 data-output-id={outputLayer._id}
								 onClick={(e) => this.props.onCollapseOutputToggle && this.props.onCollapseOutputToggle(outputLayer, e)}>{outputLayer.name}
							</div>
							{(
								outputLayer.sourceLayers !== undefined &&
								outputLayer.sourceLayers.sort((a, b) => {
									return a._rank - b._rank
								}).map((sourceLayer) => {
									return (
										<div key={sourceLayer._id} className='segment-timeline__output-layer-control__layer' data-source-id={sourceLayer._id}>
											{sourceLayer.name}
										</div>
									)
								})
							)}
						</div>
					)
				}
			})
		}
	}

	render () {
		return (
			<div className={ClassNames('segment-timeline', {
				'collapsed': this.props.isCollapsed,
				'live': this.props.isLiveSegment,
				'next': this.props.isNextSegment
			})}
				data-mos-id={this.props.segment._id}>
				<h2 className='segment-timeline__title'>{this.props.segment.name}</h2>
				<div className='segment-timeline__duration'
					 onClick={(e) => this.props.onCollapseSegmentToggle && this.props.onCollapseSegmentToggle(e)}>
					 {RundownUtils.formatTimeToTimecode(this.getSegmentDuration())}
				</div>
				<div className='segment-timeline__mos-id'>{this.props.segment.mosId}</div>
				<div className='segment-timeline__output-layers'>
					{this.renderOutputLayerControls()}
				</div>
				<div className='segment-timeline__timeline-background'/>
				<TimelineGrid {...this.props} />
				<div className='segment-timeline__timeline-container'>
					<div className='segment-timeline__timeline' ref={this.setTimelineRef} style={this.timelineStyle()}>
						{this.renderTimeline()}
					</div>
					{this.renderLiveLine()}
				</div>
				<div className='segment-timeline__zoom-area'>
					<div className='segment-timeline__timeline' ref={this.setZoomTimelineRef}>
						{this.renderZoomTimeline()}
					</div>
					<div className='segment-timeline__zoom-area__controls'>
						<div className='segment-timeline__zoom-area__controls__left-mask'>
						</div>
						<div className='segment-timeline__zoom-area__controls__right-mask'>
						</div>
						<div className='segment-timeline__zoom-area__controls__selected-area'>
							<div className='segment-timeline__zoom-area__controls__selected-area__left-handle'>
							</div>
							<div className='segment-timeline__zoom-area__controls__selected-area__right-handle'>
							</div>
						</div>
					</div>
				</div>
			</div>
		)
	}
}
