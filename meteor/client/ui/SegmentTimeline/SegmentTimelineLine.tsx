import * as React from 'react'
import { translate } from 'react-i18next'

import * as ClassNames from 'classnames'
import * as _ from 'underscore'
import { RunningOrder } from '../../../lib/collections/RunningOrders'
import { StudioInstallation } from '../../../lib/collections/StudioInstallations'
import { SegmentUi, SegmentLineUi, IOutputLayerUi, ISourceLayerUi, SegmentLineItemUi } from './SegmentTimelineContainer'
import { SourceLayerItemContainer } from './SourceLayerItemContainer'
import { RunningOrderTiming, WithTiming } from '../RunningOrderView/RunningOrderTiming'

import { ContextMenuTrigger } from 'react-contextmenu'

import { RundownUtils } from '../../lib/rundown'
import { getCurrentTime } from '../../../lib/lib'
import { withTiming } from '../RunningOrderView/RunningOrderTiming'

import * as faFastForward from '@fortawesome/fontawesome-free-solid/faFastForward'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'

import { DEBUG_MODE } from './SegmentTimelineDebugMode'
import { Translated } from '../../lib/ReactMeteorData/ReactMeteorData'

export const MEDIA_PREVIEWS_URL = 'media_previews_url'

interface ISourceLayerProps {
	key: string
	layer: ISourceLayerUi
	outputLayer: IOutputLayerUi
	runningOrder: RunningOrder
	segment: SegmentUi
	segmentLine: SegmentLineUi
	mediaPreviewUrl: string
	startsAt: number
	duration: number
	timeScale: number
	isLiveLine: boolean
	isNextLine: boolean
	outputGroupCollapsed: boolean
	onFollowLiveLine?: (state: boolean, event: any) => void
	onItemDoubleClick?: (item: SegmentLineItemUi, e: React.MouseEvent<HTMLDivElement>) => void
	relative?: boolean
	totalSegmentDuration?: number
	followLiveLine: boolean
	liveLineHistorySize: number
	livePosition: number | null
	scrollLeft: number
	scrollWidth: number
	liveLinePadding: number
	autoNextSegmentLine: boolean
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
						// filter only segment line items, that have not been hidden from the UI
						((segmentLineItem as SegmentLineItemUi).hidden !== true)
					: false
				})
				.sort((a: SegmentLineItemUi, b: SegmentLineItemUi): number => {
					if ((a.renderedInPoint !== undefined) && (b.renderedInPoint !== undefined)) {
						return (a.renderedInPoint as number) - (b.renderedInPoint as number)
					} else if (a.renderedInPoint !== undefined) {
						return -1
					} else if (b.renderedInPoint !== undefined) {
						return 1
					} else {
						return 1
					}
				})
				.map((segmentLineItem) => {
					return (
						<SourceLayerItemContainer key={segmentLineItem._id}
							{...this.props}
							// The following code is fine, just withTracker HOC messing with available props
							onDoubleClick={this.props.onItemDoubleClick}
							mediaPreviewUrl={this.props.mediaPreviewUrl}
							segmentLineItem={segmentLineItem}
							layer={this.props.layer}
							outputLayer={this.props.outputLayer}
							segmentLine={this.props.segmentLine}
							segmentLineStartsAt={this.props.startsAt}
							segmentLineDuration={this.props.duration}
							timeScale={this.props.timeScale}
							relative={this.props.relative}
							autoNextSegmentLine={this.props.autoNextSegmentLine}
							liveLinePadding={this.props.liveLinePadding}
							scrollLeft={this.props.scrollLeft}
							scrollWidth={this.props.scrollWidth}
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
	runningOrder: RunningOrder
	segment: SegmentUi
	segmentLine: SegmentLineUi
	mediaPreviewUrl: string
	startsAt: number
	duration: number
	timeScale: number
	collapsedOutputs: {
		[key: string]: boolean
	}
	isLiveLine: boolean
	isNextLine: boolean
	onFollowLiveLine?: (state: boolean, event: any) => void
	onItemDoubleClick?: (item: SegmentLineItemUi, e: React.MouseEvent<HTMLDivElement>) => void
	followLiveLine: boolean
	liveLineHistorySize: number
	livePosition: number | null
	scrollLeft: number
	scrollWidth: number
	liveLinePadding: number
	autoNextSegmentLine: boolean
	onContextMenu?: (contextMenuContext: any) => void
}
class OutputGroup extends React.Component<IOutputGroupProps> {
	renderInside () {
		if (this.props.layer.sourceLayers !== undefined) {
			return this.props.layer.sourceLayers.filter(i => !i.isHidden).sort((a, b) => a._rank - b._rank)
			.map((sourceLayer) => {
				return <SourceLayer key={sourceLayer._id}
					{...this.props}
					layer={sourceLayer}
					runningOrder={this.props.runningOrder}
					outputLayer={this.props.layer}
					outputGroupCollapsed={this.props.collapsedOutputs[this.props.layer._id] === true}
					segment={this.props.segment}
					segmentLine={this.props.segmentLine}
					startsAt={this.props.startsAt}
					duration={this.props.duration}
					timeScale={this.props.timeScale}
					autoNextSegmentLine={this.props.autoNextSegmentLine}
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
				{ DEBUG_MODE &&
					<div className='segment-timeline__debug-info red'>
						{RundownUtils.formatTimeToTimecode(this.props.startsAt)}
					</div>
				}
				{this.renderInside()}
			</div>
		)
	}
}

interface IProps {
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
	onItemDoubleClick?: (item: SegmentLineItemUi, e: React.MouseEvent<HTMLDivElement>) => void
	followLiveLine: boolean
	autoNextSegmentLine: boolean
	liveLineHistorySize: number
	livePosition: number | null
	relative?: boolean
	totalSegmentDuration?: number
	firstSegmentLineInSegment?: SegmentLineUi
	onContextMenu?: (contextMenuContext: any) => void
	isLastInSegment: boolean
	isLastSegment: boolean
}

interface IState {
	isLive: boolean
	isNext: boolean
	liveDuration: number
}

const LIVE_LINE_TIME_PADDING = 150

export const SegmentTimelineLine = translate()(withTiming<IProps, IState>((props: IProps) => {
	return {
		isHighResolution: false,
		filter: ['segmentLineDurations', props.segmentLine._id]
	}
})(class extends React.Component<Translated<WithTiming<IProps>>, IState> {
	private _configValueMemo: { [key: string]: string } = {}

	constructor (props: Translated<WithTiming<IProps>>) {
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
		if (this.props.segmentLine.startedPlayback && this.props.segmentLine.getLastStartedPlayback()) {
			if (this.props.segmentLine.duration) {
				return this.props.segmentLine.duration
			} else {
				return getCurrentTime() - (this.props.segmentLine.getLastStartedPlayback() || 0)
			}
		} else {
			return 0
		}
	}

	getLiveLineTimePadding (timeScale) {
		return LIVE_LINE_TIME_PADDING / timeScale
	}

	componentWillReceiveProps (nextProps: IProps & RunningOrderTiming.InjectedROTimingProps) {
		const isLive = (nextProps.runningOrder.currentSegmentLineId === nextProps.segmentLine._id)
		const isNext = (nextProps.runningOrder.nextSegmentLineId === nextProps.segmentLine._id)

		const startedPlayback = nextProps.segmentLine.startedPlayback
		this.setState({
			isLive,
			isNext,
			liveDuration: (isLive && !nextProps.autoNextSegmentLine && !nextProps.segmentLine.autoNext) ?
				Math.max(
				(
					(startedPlayback && nextProps.timingDurations.segmentLineDurations &&
							(nextProps.relative ?
							this.getCurrentLiveLinePosition() :
							this.getCurrentLiveLinePosition() + this.getLiveLineTimePadding(nextProps.timeScale))
					) || 0),
					nextProps.timingDurations.segmentLineDurations ?
						nextProps.timingDurations.segmentLineDurations[nextProps.segmentLine._id] :
						0
				)
				: 0
		})
	}

	getLayerStyle () {
		// this.props.segmentLine.expectedDuration ||
		if (this.props.relative) {
			return {
				width: (Math.max(this.state.liveDuration, this.props.segmentLine.duration || this.props.segmentLine.renderedDuration || 0) / (this.props.totalSegmentDuration || 1) * 100).toString() + '%',
				// width: (Math.max(this.state.liveDuration, this.props.segmentLine.duration || this.props.segmentLine.expectedDuration || 3000) / (this.props.totalSegmentDuration || 1) * 100).toString() + '%',
				willChange: this.state.isLive ? 'width' : undefined
			}
		} else {
			return {
				minWidth: Math.round(Math.max(this.state.liveDuration, this.props.segmentLine.duration || this.props.segmentLine.renderedDuration || 0) * this.props.timeScale).toString() + 'px',
				// minWidth: (Math.max(this.state.liveDuration, this.props.segmentLine.duration || this.props.segmentLine.expectedDuration || 3000) * this.props.timeScale).toString() + 'px',
				willChange: this.state.isLive ? 'minWidth' : undefined
			}
		}
	}

	getSegmentLineStartsAt (): number {
		return Math.max(0, (this.props.firstSegmentLineInSegment && this.props.timingDurations.segmentLineDisplayStartsAt && (this.props.timingDurations.segmentLineDisplayStartsAt[this.props.segmentLine._id] - this.props.timingDurations.segmentLineDisplayStartsAt[this.props.firstSegmentLineInSegment._id])) || 0)
	}

	isInsideViewport () {
		if (this.props.relative || this.state.isLive) {
			return true
		} else {
			return RundownUtils.isInsideViewport(this.props.scrollLeft, this.props.scrollWidth, this.props.segmentLine, this.getSegmentLineStartsAt(), Math.max(this.state.liveDuration, this.props.segmentLine.duration || this.props.segmentLine.expectedDuration || this.props.segmentLine.renderedDuration || 0))
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
							mediaPreviewUrl={this.ensureHasTrailingSlash(this.getConfigValue(MEDIA_PREVIEWS_URL)) || ''}
							layer={layer}
							segment={this.props.segment}
							segmentLine={segmentLine}
							runningOrder={this.props.runningOrder}
							startsAt={this.getSegmentLineStartsAt() || this.props.segmentLine.startsAt || 0}
							duration={segmentLine.duration !== undefined ? segmentLine.duration : Math.max(
								((this.props.timingDurations.segmentLineDurations && this.props.timingDurations.segmentLineDurations[segmentLine._id]) || 0),
								this.props.segmentLine.renderedDuration || 0, this.state.liveDuration, 0)}
							isLiveLine={this.props.runningOrder.currentSegmentLineId === segmentLine._id ? true : false}
							isNextLine={this.props.runningOrder.nextSegmentLineId === segmentLine._id ? true : false}
							timeScale={this.props.timeScale}
							autoNextSegmentLine={this.props.autoNextSegmentLine}
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

		const isEndOfShow = this.props.isLastSegment && this.props.isLastInSegment && (!this.state.isLive || (this.state.isLive && !this.props.runningOrder.nextSegmentLineId))

		if (this.isInsideViewport()) {
			return (
				<div className={ClassNames('segment-timeline__segment-line', {
					'live': this.state.isLive,
					'next': this.state.isNext
				})} data-mos-id={this.props.segmentLine._id}
					style={this.getLayerStyle()}
					>
					<div className={ClassNames('segment-timeline__segment-line__nextline', {
						'auto-next': this.props.segmentLine.willProbablyAutoNext
					})}>
						<div className='segment-timeline__segment-line__nextline__label'>
							{ (this.props.autoNextSegmentLine || this.props.segmentLine.willProbablyAutoNext) && t('Auto') + ' '}
							{ this.state.isNext && t('Next') }
						</div>
					</div>
					{ DEBUG_MODE &&
						<div className='segment-timeline__debug-info'>
						{this.props.livePosition} / {this.props.segmentLine.startsAt} / {(this.props.timingDurations || {segmentLineStartsAt: {}}).segmentLineStartsAt![this.props.segmentLine._id]}
						</div>
					}
					{this.state.isLive && !this.props.relative && !this.props.autoNextSegmentLine && !this.props.segmentLine.autoNext &&
						<div className='segment-timeline__segment-line__future-shade' style={this.getFutureShadeStyle()}>
						</div>
					}
					{this.renderTimelineOutputGroups(this.props.segmentLine)}
					{this.props.isLastInSegment && <div className={ClassNames('segment-timeline__segment-line__nextline', 'segment-timeline__segment-line__nextline--endline', {
						'auto-next': this.props.segmentLine.autoNext,
						'is-next': this.state.isLive && (!this.props.isLastSegment && !this.props.isLastInSegment || !!this.props.runningOrder.nextSegmentLineId),
						'show-end': isEndOfShow
					})}>
						<div className='segment-timeline__segment-line__nextline__label'>
							{ this.props.segmentLine.autoNext && t('Auto') + ' ' }
							{ this.state.isLive && t('Next') }
							{!isEndOfShow && <div className='segment-timeline__segment-line__nextline__label__carriage-return'>
								<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 11.36 7.92'>
									<g>
										<path d='M10.36,0V2.2A3.06,3.06,0,0,1,7.3,5.25H3.81V3.51L0,5.71,3.81,7.92V6.25H7.3a4.06,4.06,0,0,0,4.06-4V0Z' />
									</g>
								</svg>
							</div>}
						</div>
					</div>}
					{isEndOfShow && <div className='segment-timeline__segment-line__show-end'>
						<div className='segment-timeline__segment-line__show-end__label'>
							{t('Show End')}
						</div>
					</div>}
				</div>
			)
		} else { // render placeholders
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

	private ensureHasTrailingSlash (input: string | null): string | null {
		if (input) {
			return (input.substr(-1) === '/') ? input : input + '/'
		} else {
			return input
		}
	}

	private getConfigValue (name: string): string | null {
		if (this.props.studioInstallation && this._configValueMemo[name] === undefined) {
			const value = this.props.studioInstallation.getConfigValue(name)
			if (value !== null) {
				this._configValueMemo[name] = value
			}
			return value
		} else if (this._configValueMemo[name] !== undefined) {
			return this._configValueMemo[name]
		} else {
			return null
		}
	}
}))
