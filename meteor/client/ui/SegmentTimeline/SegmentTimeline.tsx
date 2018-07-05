import * as React from 'react'
import * as PropTypes from 'prop-types'
import { translate } from 'react-i18next'

import * as ClassNames from 'classnames'
import * as _ from 'underscore'
import * as $ from 'jquery'
import { ContextMenuTrigger } from 'react-contextmenu'

import { RunningOrder } from '../../../lib/collections/RunningOrders'
import { StudioInstallation } from '../../../lib/collections/StudioInstallations'
import { SegmentUi, SegmentLineUi, IOutputLayerUi } from './SegmentTimelineContainer'
import { TimelineGrid } from './TimelineGrid'
import { SegmentTimelineLine } from './SegmentTimelineLine'
import { SegmentTimelineZoomControls } from './SegmentTimelineZoomControls'

import { SegmentDuration, SegmentLineCountdown, RunningOrderTiming } from './../RunningOrderTiming'

import { RundownUtils } from '../../lib/rundown'
import { Translated } from '../../lib/ReactMeteorData/ReactMeteorData'
import { ErrorBoundary } from '../ErrorBoundary'

interface IProps {
	key: string
	segment: SegmentUi
	runningOrder: RunningOrder,
	followLiveSegments: boolean,
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
	hasAlreadyPlayed: boolean,
	hasRemoteItems: boolean,
	isLiveSegment: boolean,
	isNextSegment: boolean,
	followLiveLine: boolean,
	liveLineHistorySize: number,
	livePosition: number,
	autoNextSegmentLine: boolean,
	onScroll: (scrollLeft: number, event: any) => void
	onZoomChange: (newScale: number, event: any) => void
	onFollowLiveLine: (state: boolean, event: any) => void
	onContextMenu?: (contextMenuContext: any) => void
}
interface IStateHeader {
	timelineWidth: number
}

interface IZoomPropsHeader {
	onZoomDblClick: (e) => void
	timelineWidth: number
}
interface IZoomStateHeader {
	totalSegmentDuration: number
}

const SegmentTimelineZoom = class extends React.Component<IProps & IZoomPropsHeader, IZoomStateHeader> {
	static contextTypes = {
		durations: PropTypes.object.isRequired
	}

	constructor (props, context) {
		super(props, context)
		this.state = {
			totalSegmentDuration: 10
		}
	}

	componentDidMount () {
		this.checkTimingChange()
		window.addEventListener(RunningOrderTiming.Events.timeupdateHR, this.onTimeupdate)
	}

	componentWillUnmount () {
		window.removeEventListener(RunningOrderTiming.Events.timeupdateHR, this.onTimeupdate)
	}

	onTimeupdate = () => {
		if (!this.props.isLiveSegment) {
			this.checkTimingChange()
		}
	}

	checkTimingChange = () => {
		const total = this.calculateSegmentDuration()
		if (total !== this.state.totalSegmentDuration) {
			this.setState({
				totalSegmentDuration: total
			})
		}
	}

	calculateSegmentDuration (): number {
		let total = 0
		if (this.context && this.context.durations) {
			const durations = this.context.durations as RunningOrderTiming.RunningOrderTimingContext
			this.props.segmentLines.forEach((item) => {
				// total += durations.segmentLineDurations ? durations.segmentLineDurations[item._id] : (item.duration || item.renderedDuration || 1)
				total += Math.max((item.duration || item.renderedDuration || item.expectedDuration || 1), durations.segmentLineDurations && durations.segmentLineDurations[item._id] || 0)
			})
		} else {
			total = RundownUtils.getSegmentDuration(this.props.segmentLines)
		}
		return total
	}

	getSegmentDuration (): number {
		return this.props.isLiveSegment ? this.calculateSegmentDuration() : this.state.totalSegmentDuration
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
					scrollWidth={1}
					timeScale={1}
					relative={true}
					totalSegmentDuration={this.getSegmentDuration()}
					segmentLine={segmentLine}
					followLiveLine={this.props.followLiveLine}
					autoNextSegmentLine={this.props.autoNextSegmentLine}
					liveLineHistorySize={this.props.liveLineHistorySize}
					livePosition={this.props.segment._id === this.props.runningOrder.currentSegmentLineId && segmentLine.startedPlayback ? this.props.livePosition - segmentLine.startedPlayback : null} />
			)
		})
	}

	renderMiniLiveLine () {
		if (this.props.isLiveSegment) {
			let lineStyle = {
				'left': (this.props.livePosition / this.getSegmentDuration() * 100).toString() + '%'
			}

			return (
				<div className='segment-timeline__zoom-area__liveline'
					style={lineStyle}>
				</div>
			)
		}
	}

	render () {
		return (
			<div className='segment-timeline__zoom-area'
				onDoubleClick={(e) => this.props.onZoomDblClick(e)}>
				<div className='segment-timeline__timeline'>
					{this.renderZoomTimeline()}
				</div>
				<SegmentTimelineZoomControls scrollLeft={this.props.scrollLeft}
					scrollWidth={this.props.timelineWidth / this.props.timeScale}
					onScroll={(left, e) => this.props.onScroll(left, e)}
					segmentDuration={this.getSegmentDuration()}
					liveLineHistorySize={this.props.liveLineHistorySize}
					timeScale={this.props.timeScale}
					onZoomChange={(newScale, e) => this.props.onZoomChange(newScale, e)} />
				{this.renderMiniLiveLine()}
			</div>
		)
	}
}

export const SegmentTimeline = translate()(
class extends React.Component<Translated<IProps>, IStateHeader> {
	timeline: HTMLDivElement
	segmentBlock: HTMLDivElement

	constructor (props: Translated<IProps>) {
		super(props)
		this.state = {
			timelineWidth: 1
		}
	}

	setSegmentRef = (el: HTMLDivElement) => {
		this.segmentBlock = el
	}

	setTimelineRef = (el: HTMLDivElement) => {
		this.timeline = el
	}

	onTimelineResize = (size: number[]) => {
		this.setState({
			timelineWidth: size[0]
		})
	}

	onZoomDblClick = (e) => {
		if (this.props.onFollowLiveLine) {
			this.props.onFollowLiveLine(true, e)
		}
	}

	componentDidUpdate (prevProps: IProps) {
		if ((prevProps.isLiveSegment === false && this.props.isLiveSegment === true && this.props.followLiveSegments) ||
			(prevProps.followLiveSegments === false && this.props.followLiveSegments === true && this.props.isLiveSegment === true)) {
			const previousSegment = $(this.segmentBlock).prev()
			const segmentPosition = $(this.segmentBlock).offset()
			let scrollTop: number | null = null

			if (previousSegment.length > 0) {
				const segmentPosition = $(previousSegment).offset()
				if (segmentPosition) {
					scrollTop = segmentPosition.top
				}
			} else if (segmentPosition && (
				(segmentPosition.top > ($('html,body').scrollTop() || 0) + window.innerHeight) ||
				(segmentPosition.top < ($('html,body').scrollTop() || 0))
			)) {
				scrollTop = segmentPosition.top
			}

			if (scrollTop !== null) {
				this.props.onFollowLiveLine && this.props.onFollowLiveLine(true, {})

				$(document.body).addClass('auto-scrolling')
				$('html,body').animate({
					scrollTop: Math.max(0, scrollTop - 175)
				}, 400, () => {
					// delay until next frame, so that the scroll handler can fire
					setTimeout(function () {
						$(document.body).removeClass('auto-scrolling')
					})
				})
			}
		}
	}

	getSegmentContext = (props) => {
		const ctx = {
			segment: this.props.segment,
			segmentLine: this.props.segmentLines.length > 0 ? this.props.segmentLines[0] : null
		}

		if (this.props.onContextMenu && typeof this.props.onContextMenu === 'function') {
			this.props.onContextMenu(ctx)
		}

		return ctx
	}

	getSegmentDuration () {
		return (this.props.segmentLines && RundownUtils.getSegmentDuration(this.props.segmentLines)) || 0
	}

	timelineStyle () {
		return {
			'transform': 'translate3d(-' + (this.props.scrollLeft * this.props.timeScale).toString() + 'px, 0, 0)'
		}
	}

	renderLiveLine () {
		const { t } = this.props

		if (this.props.isLiveSegment) {
			let pixelPostion = (this.props.livePosition * this.props.timeScale) - (!this.props.followLiveLine ? (this.props.scrollLeft * this.props.timeScale) : 0)
			let lineStyle = {
				'left': (this.props.followLiveLine ?
							Math.min(pixelPostion, this.props.liveLineHistorySize).toString() :
							pixelPostion.toString()
						) + 'px'
			}

			return [
				<div className='segment-timeline__liveline-shade'
					key={this.props.segment._id + '-liveline-shade'}
					style={{
						'width': (this.props.followLiveLine ?
							Math.min(pixelPostion, this.props.liveLineHistorySize).toString() :
							pixelPostion.toString()
						) + 'px'
					}} />,
				<div className='segment-timeline__liveline'
					key={this.props.segment._id + '-liveline'}
					style={lineStyle}>
					<div className='segment-timeline__liveline__label'
						 onClick={(e) => this.props.onFollowLiveLine && this.props.onFollowLiveLine(true, e)}>
						{t('On Air')}
					</div>
					<div className='segment-timeline__liveline__timecode'>
						{RundownUtils.formatTimeToTimecode(this.props.livePosition)}
					</div>
				</div>
			]
		}
	}

	renderTimeline () {
		return this.props.segmentLines.map((segmentLine) => {
			return (
				<SegmentTimelineLine key={segmentLine._id}
									{...this.props}
									scrollWidth={this.state.timelineWidth / this.props.timeScale}
									firstSegmentLineInSegment={this.props.segmentLines[0]}
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
								 tabIndex={0}
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
		// console.log(this.props.hasRemoteItems && !this.props.hasAlreadyPlayed && !this.props.isLiveSegment && !this.props.isNextSegment)

		return (
			<div id={'running-order__segment__' + this.props.segment._id}
				className={ClassNames('segment-timeline', {
					'collapsed': this.props.isCollapsed,

					'live': this.props.isLiveSegment,
					'next': !this.props.isLiveSegment && this.props.isNextSegment,

					'has-played': this.props.hasAlreadyPlayed && !this.props.isLiveSegment && !this.props.isNextSegment,
					'has-remote-items': this.props.hasRemoteItems && !this.props.hasAlreadyPlayed && !this.props.isLiveSegment && !this.props.isNextSegment
				})}
			data-mos-id={this.props.segment._id} ref={this.setSegmentRef}>
				<ContextMenuTrigger id='segment-timeline-context-menu'
					collect={this.getSegmentContext}
					attributes={{
						className: 'segment-timeline__title'
					}}
					renderTag='h2'>
					{this.props.segment.name}
				</ContextMenuTrigger>
				<div className='segment-timeline__duration' tabIndex={0}
					onClick={(e) => this.props.onCollapseSegmentToggle && this.props.onCollapseSegmentToggle(e)}>
					{this.props.runningOrder && this.props.segmentLines && this.props.segmentLines.length > 0 &&
						<SegmentDuration
							segmentLineIds={this.props.segmentLines.map((item) => item._id)}
						/>
					}
				</div>
				<div className='segment-timeline__timeUntil'
					 onClick={(e) => this.props.onCollapseSegmentToggle && this.props.onCollapseSegmentToggle(e)}>
					 {this.props.runningOrder && this.props.segmentLines && this.props.segmentLines.length > 0 &&
						<SegmentLineCountdown
							segmentLineId={
								(
									this.props.isNextSegment ?
									this.props.runningOrder.nextSegmentLineId :
									this.props.segmentLines[0]._id
								) || undefined }
						/>
					 }
				</div>
				<div className='segment-timeline__mos-id'>{this.props.segment.mosId}</div>
				<div className='segment-timeline__output-layers'>
					{this.renderOutputLayerControls()}
				</div>
				<div className='segment-timeline__timeline-background'/>
				<TimelineGrid {...this.props}
							  onResize={this.onTimelineResize} />
				<div className='segment-timeline__timeline-container'>
					<div className='segment-timeline__timeline' key={this.props.segment._id + '-timeline'} ref={this.setTimelineRef} style={this.timelineStyle()}>
						<ErrorBoundary>
							{this.renderTimeline()}
						</ErrorBoundary>
					</div>
					{this.renderLiveLine()}
				</div>
				<ErrorBoundary>
					<SegmentTimelineZoom
						onZoomDblClick={this.onZoomDblClick}
						timelineWidth={this.state.timelineWidth}
						{...this.props}/>
				</ErrorBoundary>
			</div>
		)
	}
})
