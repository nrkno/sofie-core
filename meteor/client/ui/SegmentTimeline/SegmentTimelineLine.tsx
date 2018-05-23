import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import { translate, InjectedTranslateProps } from 'react-i18next'

import * as ClassNames from 'classnames'
import * as _ from 'underscore'
import * as $ from 'jquery'

import { RunningOrder } from '../../../lib/collections/RunningOrders'
import { Segment, Segments } from '../../../lib/collections/Segments'
import { SegmentLine, SegmentLines } from '../../../lib/collections/SegmentLines'
import { SegmentLineItem, SegmentLineItems } from '../../../lib/collections/SegmentLineItems'
import { StudioInstallation, StudioInstallations } from '../../../lib/collections/StudioInstallations'
import { SegmentUi, SegmentLineUi, IOutputLayerUi, ISourceLayerUi, SegmentLineItemUi } from './SegmentTimelineContainer'
import { TimelineGrid } from './TimelineGrid'
import { SourceLayerItemContainer } from './SourceLayerItemContainer'
import { RunningOrderTiming } from '../RunningOrderTiming'

import { ContextMenu, MenuItem, ContextMenuTrigger } from 'react-contextmenu'

import { RundownUtils } from '../../lib/rundown'
import { getCurrentTime } from '../../../lib/lib'
import { withTiming } from '../RunningOrderTiming'

interface ISourceLayerProps {
	key: string
	layer: ISourceLayerUi
	outputLayer: IOutputLayerUi
	segment: SegmentUi
	segmentLine: SegmentLineUi
	startsAt: number
	duration: number
	timeScale: number
	isLiveLine: boolean
	isNextLine: boolean
	outputGroupCollapsed: boolean
	onFollowLiveLine?: (state: boolean, event: any) => void
	relative?: boolean
	totalSegmentDuration?: number
	followLiveLine: boolean
	liveLineHistorySize: number
	livePosition: number | null
	scrollLeft: number
	scrollWidth: number
	liveLinePadding: number
	onContextMenu?: (contextMenuContext: any) => void
}
class SourceLayer extends React.Component<ISourceLayerProps> {

	getSegmentLineContext = (props) => {
		const ctx = {
			segment: this.props.segment,
			segmentLine: this.props.segmentLine
		}

		if (this.props.onContextMenu && typeof this.props.onContextMenu === 'function') {
			this.props.onContextMenu(ctx)
		}

		return ctx
	}

	renderInside () {
		if (this.props.layer.items !== undefined) {
			return this.props.layer.items
				.filter((segmentLineItem) => {
					// filter only segment line items belonging to this segment line
					return (segmentLineItem.segmentLineId === this.props.segmentLine._id) ?
						// filter only segment line items, that have not yet been linked to parent items
						((segmentLineItem as SegmentLineItemUi).linked !== true) ?
							true :
							//(this.props.scrollLeft >= ((this.props.segmentLine.startsAt || 0) + ((segmentLineItem as SegmentLineItemUi).renderedInPoint || 0)))
							true
					: false
				})
				.map((segmentLineItem) => {
					return (
						<SourceLayerItemContainer key={segmentLineItem._id}
							{...this.props}
							// The following code is fine, just withTracker HOC messing with available props
							// @ts-ignore
							segmentLineItem={segmentLineItem}
							layer={this.props.layer}
							outputLayer={this.props.outputLayer}
							segment={this.props.segment}
							segmentLine={this.props.segmentLine}
							segmentLineStartsAt={this.props.startsAt}
							segmentLineDuration={this.props.duration}
							timeScale={this.props.timeScale}
							relative={this.props.relative}
							lineStartsAt={this.props.segmentLine.startsAt}
							liveLinePadding={this.props.liveLinePadding}
							/>
					)
				})
		}
	}

	render () {
		return (
			<ContextMenuTrigger id='segment-timeline-context-menu' attributes={{
				className: 'segment-timeline__layer'
			}}
				collect={this.getSegmentLineContext}>
				{this.renderInside()}
			</ContextMenuTrigger>
		)
	}
}

interface IOutputGroupProps {
	layer: IOutputLayerUi
	segment: SegmentUi
	segmentLine: SegmentLineUi
	startsAt: number
	duration: number
	timeScale: number
	collapsedOutputs: {
		[key: string]: boolean
	}
	isLiveLine: boolean
	isNextLine: boolean
	onFollowLiveLine?: (state: boolean, event: any) => void
	followLiveLine: boolean
	liveLineHistorySize: number
	livePosition: number | null
	scrollLeft: number
	scrollWidth: number
	liveLinePadding: number
	onContextMenu?: (contextMenuContext: any) => void
}
class OutputGroup extends React.Component<IOutputGroupProps> {
	renderInside () {
		if (this.props.layer.sourceLayers !== undefined) {
			return this.props.layer.sourceLayers.map((sourceLayer) => {
				return <SourceLayer key={sourceLayer._id}
					{...this.props}
					layer={sourceLayer}
					outputLayer={this.props.layer}
					outputGroupCollapsed={this.props.collapsedOutputs[this.props.layer._id] === true}
					segment={this.props.segment}
					segmentLine={this.props.segmentLine}
					startsAt={this.props.startsAt}
					duration={this.props.duration}
					timeScale={this.props.timeScale}
					liveLinePadding={this.props.liveLinePadding} />
			})
		}
	}

	render () {
		return (
			<div className={ClassNames('segment-timeline__output-group', {
				'collapsable': this.props.layer.sourceLayers && this.props.layer.sourceLayers.length > 1,
				'collapsed': this.props.collapsedOutputs[this.props.layer._id] === true
			})}>
				{this.renderInside()}
			</div>
		)
	}
}

interface IPropsHeader {
	segment: SegmentUi
	runningOrder: RunningOrder,
	studioInstallation: StudioInstallation
	segmentLine: SegmentLineUi
	timeScale: number
	onCollapseOutputToggle?: (layer: IOutputLayerUi, event: any) => void
	collapsedOutputs: {
		[key: string]: boolean
	},
	onCollapseSegmentToggle?: (event: any) => void,
	isCollapsed?: boolean,
	scrollLeft: number,
	scrollWidth: number
	onScroll?: (scrollLeft: number, event: any) => void
	onFollowLiveLine?: (state: boolean, event: any) => void
	followLiveLine: boolean
	liveLineHistorySize: number
	livePosition: number | null
	relative?: boolean
	totalSegmentDuration?: number
	firstSegmentLineInSegment?: SegmentLineUi
	onContextMenu?: (contextMenuContext: any) => void
}

interface IStateHader {
	isLive: boolean
	isNext: boolean
	liveDuration: number
}

const LIVE_LINE_TIME_PADDING = 150

export const SegmentTimelineLine = translate()(withTiming({
	isHighResolution: false
})(class extends React.Component<IPropsHeader & InjectedTranslateProps & RunningOrderTiming.InjectedROTimingProps, IStateHader> {
	_refreshTimer: number | undefined

	constructor (props) {
		super(props)

		const isLive = (this.props.runningOrder.currentSegmentLineId === this.props.segmentLine._id)
		const isNext = (this.props.runningOrder.nextSegmentLineId === this.props.segmentLine._id)
		const startedPlayback = this.props.segmentLine.startedPlayback

		this.state = {
			isLive,
			isNext,
			liveDuration: isLive ?
				Math.max(
				(
					(startedPlayback && props.timingDurations.segmentLineDurations &&
						(this.getCurrentLiveLinePosition() + this.getLiveLineTimePadding(props.timeScale))
					) || 0),
					props.timingDurations.segmentLineDurations ?
						props.timingDurations.segmentLineDurations[props.segmentLine._id] :
						0
				)
				: 0
		}
	}

	getCurrentLiveLinePosition () {
		if (this.props.segmentLine.startedPlayback) {
			if (this.props.segmentLine.duration) {
				return this.props.segmentLine.duration
			} else {
				return getCurrentTime() - this.props.segmentLine.startedPlayback
			}
		} else {
			return 0
		}
	}

	getLiveLineTimePadding (timeScale) {
		return LIVE_LINE_TIME_PADDING / timeScale
	}

	componentWillReceiveProps (nextProps: IPropsHeader) {
		const isLive = (nextProps.runningOrder.currentSegmentLineId === nextProps.segmentLine._id)
		const isNext = (nextProps.runningOrder.nextSegmentLineId === nextProps.segmentLine._id)

		const startedPlayback = this.props.segmentLine.startedPlayback
		this.setState({
			isLive,
			isNext,
			liveDuration: isLive ?
				Math.max(
				(
					(startedPlayback && this.props.timingDurations.segmentLineDurations &&
						(this.props.relative ?
							this.getCurrentLiveLinePosition() :
							this.getCurrentLiveLinePosition() + this.getLiveLineTimePadding(this.props.timeScale))
					) || 0),
					this.props.timingDurations.segmentLineDurations ?
						this.props.timingDurations.segmentLineDurations[this.props.segmentLine._id] :
						0
				)
				: 0
		})
	}

	getLayerStyle () {
		if (this.props.relative) {
			return {
				width: (Math.max(this.state.liveDuration, this.props.segmentLine.expectedDuration || this.props.segmentLine.renderedDuration || 0) / (this.props.totalSegmentDuration || 1) * 100).toString() + '%',
				willChange: this.state.isLive ? 'width' : undefined
			}
		} else {
			return {
				minWidth: (Math.max(this.state.liveDuration, this.props.segmentLine.expectedDuration || this.props.segmentLine.renderedDuration || 0) * this.props.timeScale).toString() + 'px',
				willChange: this.state.isLive ? 'minWidth' : undefined
			}
		}
	}

	getSegmentLineStartsAt (): number {
		return Math.max(0, (this.props.firstSegmentLineInSegment && this.props.timingDurations.segmentLineStartsAt && (this.props.timingDurations.segmentLineStartsAt[this.props.segmentLine._id] - this.props.timingDurations.segmentLineStartsAt[this.props.firstSegmentLineInSegment._id])) || 0)
	}

	isInsideViewport () {
		if (this.props.relative || this.state.isLive) {
			return true
		} else {
			return RundownUtils.isInsideViewport(this.props.scrollLeft, this.props.scrollWidth, this.props.segmentLine, this.getSegmentLineStartsAt())
		}
	}

	renderTimelineOutputGroups (segmentLine: SegmentLineUi) {
		if (this.props.segment.outputLayers !== undefined) {
			return _.map(_.filter(this.props.segment.outputLayers, (layer) => {
				return (layer.used) ? true : false
			}).sort((a, b) => {
				return a._rank - b._rank
			}), (layer, id) => {
				// Only render output layers used by the segment
				if (layer.used) {
					return (
						<OutputGroup key={layer._id}
							{...this.props}
							layer={layer}
							segment={this.props.segment}
							segmentLine={segmentLine}
							startsAt={this.getSegmentLineStartsAt() || this.props.segmentLine.startsAt || 0}
							duration={(this.props.timingDurations.segmentLineDurations && this.props.timingDurations.segmentLineDurations[segmentLine._id]) || this.props.segmentLine.renderedDuration || 0}
							isLiveLine={this.props.runningOrder.currentSegmentLineId === segmentLine._id ? true : false}
							isNextLine={this.props.runningOrder.nextSegmentLineId === segmentLine._id ? true : false}
							timeScale={this.props.timeScale}
							liveLinePadding={this.getLiveLineTimePadding(this.props.timeScale)} />
					)
				}
			})
		}
	}

	getFutureShadeStyle = () => {
		return {
			'width': (Math.min(
						Math.max(
							0,
							(this.props.livePosition || 0) + this.getLiveLineTimePadding(this.props.timeScale) - (this.props.segmentLine.expectedDuration || this.props.segmentLine.renderedDuration || 0)),
						this.getLiveLineTimePadding(this.props.timeScale)
					) * this.props.timeScale) + 'px'
		}
	}

	render () {
		const { t } = this.props

		if (this.isInsideViewport()) {
			return (
				<div className={ClassNames('segment-timeline__segment-line', {
					'live': this.state.isLive,
					'next': this.state.isNext
				})} data-mos-id={this.props.segmentLine._id}
					style={this.getLayerStyle()}
					>
					<div className='segment-timeline__segment-line__nextline'>
						<div className='segment-timeline__segment-line__nextline__label'>
							{t('Next')}
						</div>
					</div>
					{this.renderTimelineOutputGroups(this.props.segmentLine)}
					{this.state.isLive && !this.props.relative &&
						<div className='segment-timeline__segment-line__future-shade' style={this.getFutureShadeStyle()}>
						</div>
					}
				</div>
			)
		} else { // render placeholder
			return (
				<div className={ClassNames('segment-timeline__segment-line', {
					'live': this.state.isLive,
					'next': this.state.isNext
				})} data-mos-id={this.props.segmentLine._id}
					style={this.getLayerStyle()}
				>
					{ /* render it empty, just to take up space */ }
				</div>
			)
		}

	}
}))
