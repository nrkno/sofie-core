import * as React from 'react'
import { translate } from 'react-i18next'

import * as ClassNames from 'classnames'
import * as _ from 'underscore'
import { Rundown } from '../../../lib/collections/Rundowns'
import { Studio } from '../../../lib/collections/Studios'
import {
	SegmentUi,
	PartUi,
	IOutputLayerUi,
	ISourceLayerUi,
	PieceUi
} from './SegmentTimelineContainer'
import { SourceLayerItemContainer } from './SourceLayerItemContainer'
import { RundownTiming, WithTiming, withTiming } from '../RundownView/RundownTiming'

import { ContextMenuTrigger } from 'react-contextmenu'

import { RundownUtils } from '../../lib/rundown'
import { getCurrentTime } from '../../../lib/lib'
import { ensureHasTrailingSlash } from '../../lib/lib'

import { DEBUG_MODE } from './SegmentTimelineDebugMode'
import { Translated } from '../../lib/ReactMeteorData/ReactMeteorData'
import { ConfigItemValue } from 'tv-automation-sofie-blueprints-integration'

import { getElementDocumentOffset } from '../../utils/positions'

export const SegmentTimelineLineElementId = 'rundown__segment__line__'
export const SegmentTimelinePartElementId = 'rundown__segment__part__'

interface ISourceLayerProps {
	key: string
	layer: ISourceLayerUi
	outputLayer: IOutputLayerUi
	rundown: Rundown
	segment: SegmentUi
	part: PartUi
	mediaPreviewUrl: string
	startsAt: number
	duration: number
	timeScale: number
	isLiveLine: boolean
	isNextLine: boolean
	outputGroupCollapsed: boolean
	onFollowLiveLine?: (state: boolean, event: any) => void
	onPieceClick?: (piece: PieceUi, e: React.MouseEvent<HTMLDivElement>) => void
	onPieceDoubleClick?: (item: PieceUi, e: React.MouseEvent<HTMLDivElement>) => void
	relative?: boolean
	totalSegmentDuration?: number
	followLiveLine: boolean
	liveLineHistorySize: number
	livePosition: number | null
	scrollLeft: number
	scrollWidth: number
	liveLinePadding: number
	autoNextPart: boolean
	onContextMenu?: (contextMenuContext: any) => void
}
class SourceLayer extends React.Component<ISourceLayerProps> {
	private mousePosition = {}

	getPartContext = (props) => {
		const partElement = document.querySelector('#' + SegmentTimelinePartElementId + this.props.part._id)
		const partDocumentOffset = getElementDocumentOffset(partElement)

		const ctx = {
			segment: this.props.segment,
			part: this.props.part,
			partDocumentOffset,
			timeScale: this.props.timeScale,
			mousePosition: this.mousePosition,
			partStartsAt: this.props.startsAt
		}

		if (this.props.onContextMenu && typeof this.props.onContextMenu === 'function') {
			this.props.onContextMenu(ctx)
		}

		return ctx
	}

	onMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
		this.mousePosition = { left: e.pageX, top: e.pageY }
	}

	renderInside () {
		if (this.props.layer.pieces !== undefined) {
			return _.chain(this.props.layer.pieces.filter((piece) => {
				// filter only pieces belonging to this part
				return (piece.partId === this.props.part._id) ?
					// filter only pieces, that have not been hidden from the UI
					(piece.hidden !== true) &&
					(piece.virtual !== true)
					: false
			}))
			.sortBy((it) => it.renderedInPoint)
			.sortBy((it) => it.infiniteMode)
			.sortBy((it) => it.cropped)
			.map((piece) => {
				return (
					<SourceLayerItemContainer key={piece._id}
						{...this.props}
						// The following code is fine, just withTracker HOC messing with available props
						onClick={this.props.onPieceClick}
						onDoubleClick={this.props.onPieceDoubleClick}
						mediaPreviewUrl={this.props.mediaPreviewUrl}
						piece={piece}
						layer={this.props.layer}
						outputLayer={this.props.outputLayer}
						part={this.props.part}
						partStartsAt={this.props.startsAt}
						partDuration={this.props.duration}
						timeScale={this.props.timeScale}
						relative={this.props.relative}
						autoNextPart={this.props.autoNextPart}
						liveLinePadding={this.props.liveLinePadding}
						scrollLeft={this.props.scrollLeft}
						scrollWidth={this.props.scrollWidth}
						/>
				)
			}).value()
		}
	}

	render () {
		return (
			<ContextMenuTrigger id='segment-timeline-context-menu' attributes={{
				className: 'segment-timeline__layer',
				onMouseUpCapture: (e) => this.onMouseUp(e)
			}}
				collect={this.getPartContext}>
				{this.renderInside()}
			</ContextMenuTrigger>
		)
	}
}

interface IOutputGroupProps {
	layer: IOutputLayerUi
	rundown: Rundown
	segment: SegmentUi
	part: PartUi
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
	onPieceClick?: (piece: PieceUi, e: React.MouseEvent<HTMLDivElement>) => void
	onPieceDoubleClick?: (item: PieceUi, e: React.MouseEvent<HTMLDivElement>) => void
	followLiveLine: boolean
	liveLineHistorySize: number
	livePosition: number | null
	scrollLeft: number
	scrollWidth: number
	liveLinePadding: number
	autoNextPart: boolean
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
						rundown={this.props.rundown}
						outputLayer={this.props.layer}
						outputGroupCollapsed={this.props.collapsedOutputs[this.props.layer._id] === true}
						segment={this.props.segment}
						part={this.props.part}
						startsAt={this.props.startsAt}
						duration={this.props.duration}
						timeScale={this.props.timeScale}
						autoNextPart={this.props.autoNextPart}
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
				{DEBUG_MODE &&
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
	rundown: Rundown,
	studio: Studio
	part: PartUi
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
	onPieceClick?: (piece: PieceUi, e: React.MouseEvent<HTMLDivElement>) => void
	onPieceDoubleClick?: (item: PieceUi, e: React.MouseEvent<HTMLDivElement>) => void
	followLiveLine: boolean
	autoNextPart: boolean
	liveLineHistorySize: number
	livePosition: number | null
	relative?: boolean
	totalSegmentDuration?: number
	firstPartInSegment?: PartUi
	onContextMenu?: (contextMenuContext: any) => void
	isLastInSegment: boolean
	isLastSegment: boolean
}

interface IState {
	isLive: boolean
	isNext: boolean
	isDurationSettling: boolean
	liveDuration: number
}

const LIVE_LINE_TIME_PADDING = 150

export const SegmentTimelinePart = translate()(withTiming<IProps, IState>((props: IProps) => {
	return {
		isHighResolution: false,
		filter: (durations: RundownTiming.RundownTimingContext) => {
			return [
				((durations || {})['partDurations'] || {})[props.part._id],
				((durations || {})['partDisplayStartsAt'] || {})[props.part._id],
				((durations || {})['partDisplayDurations'] || {})[props.part._id],
				props.firstPartInSegment ? ((durations || {})['partDisplayStartsAt'] || {})[props.firstPartInSegment._id] : undefined,
				props.firstPartInSegment ? ((durations || {})['partDisplayDurations'] || {})[props.firstPartInSegment._id] : undefined
			]
		}
	}
})(class SegmentTimelinePart0 extends React.Component<Translated<WithTiming<IProps>>, IState> {
	private _configValueMemo: { [key: string]: ConfigItemValue } = {}

	constructor (props: Translated<WithTiming<IProps>>) {
		super(props)

		const isLive = (this.props.rundown.currentPartId === this.props.part._id)
		const isNext = (this.props.rundown.nextPartId === this.props.part._id)
		const startedPlayback = this.props.part.startedPlayback

		this.state = {
			isLive,
			isNext,
			isDurationSettling: false,
			liveDuration: isLive ?
				Math.max(
				(
					(startedPlayback && props.timingDurations.partDurations &&
						(SegmentTimelinePart0.getCurrentLiveLinePosition(props.part, props.timingDurations.currentTime || getCurrentTime()) +
							SegmentTimelinePart0.getLiveLineTimePadding(props.timeScale))
					) || 0),
					props.timingDurations.partDurations ?
						(props.part.displayDuration || props.timingDurations.partDurations[props.part._id]) :
						0
				)
				: 0
		}
	}

	static getDerivedStateFromProps (nextProps: IProps & RundownTiming.InjectedROTimingProps) {
		const isLive = (nextProps.rundown.currentPartId === nextProps.part._id)
		const isNext = (nextProps.rundown.nextPartId === nextProps.part._id)

		const startedPlayback = nextProps.part.startedPlayback

		const isDurationSettling = !!nextProps.rundown.active && !isLive && !!startedPlayback && !nextProps.part.duration

		const liveDuration =
			((isLive || isDurationSettling) && !nextProps.autoNextPart && !nextProps.part.autoNext) ?
				Math.max(
					(
						(startedPlayback && nextProps.timingDurations.partDurations &&
							(nextProps.relative ?
								SegmentTimelinePart0.getCurrentLiveLinePosition(nextProps.part, nextProps.timingDurations.currentTime || getCurrentTime()) :
								SegmentTimelinePart0.getCurrentLiveLinePosition(nextProps.part, nextProps.timingDurations.currentTime || getCurrentTime()) +
									SegmentTimelinePart0.getLiveLineTimePadding(nextProps.timeScale))
						) || 0),
					nextProps.timingDurations.partDurations ?
						(nextProps.part.displayDuration || nextProps.timingDurations.partDurations[nextProps.part._id]) :
						0
				)
				: 0

		return ({
			isLive,
			isNext,
			isDurationSettling,
			liveDuration
		})
	}

	static getLiveLineTimePadding (timeScale) {
		return LIVE_LINE_TIME_PADDING / timeScale
	}

	static getCurrentLiveLinePosition (part: PartUi, currentTime: number) {
		if (part.startedPlayback && part.getLastStartedPlayback()) {
			if (part.duration) {
				return part.duration
			} else {
				return currentTime - (part.getLastStartedPlayback() || 0) + (part.getLastPlayOffset() || 0)
			}
		} else {
			return 0
		}
	}

	getLayerStyle () {
		// this.props.part.expectedDuration ||
		if (this.props.relative) {
			return {
				width: (this.getPartDuration() / (this.props.totalSegmentDuration || 1) * 100).toString() + '%',
				// width: (Math.max(this.state.liveDuration, this.props.part.duration || this.props.part.expectedDuration || 3000) / (this.props.totalSegmentDuration || 1) * 100).toString() + '%',
				willChange: this.state.isLive ? 'width' : undefined
			}
		} else {
			return {
				minWidth: Math.floor(this.getPartDuration() * this.props.timeScale).toString() + 'px',
				// minWidth: (Math.max(this.state.liveDuration, this.props.part.duration || this.props.part.expectedDuration || 3000) * this.props.timeScale).toString() + 'px',
				willChange: this.state.isLive ? 'minWidth' : undefined
			}
		}
	}

	getPartDuration (): number {
		// const part = this.props.part

		return Math.max(
			this.state.liveDuration,
			(this.props.part.duration ||
				this.props.timingDurations.partDisplayDurations && this.props.timingDurations.partDisplayDurations[this.props.part._id] ||
				this.props.part.renderedDuration || 0)
		)

		/* return part.duration !== undefined ? part.duration : Math.max(
			((this.props.timingDurations.partDurations && this.props.timingDurations.partDurations[part._id]) || 0),
			this.props.part.renderedDuration || 0, this.state.liveDuration, 0) */
	}

	getPartStartsAt (): number {
		return Math.max(0, (this.props.firstPartInSegment &&
			this.props.timingDurations.partDisplayStartsAt &&
			(
				this.props.timingDurations.partDisplayStartsAt[this.props.part._id] -
				this.props.timingDurations.partDisplayStartsAt[this.props.firstPartInSegment._id]
			)
		) || 0)
	}

	isInsideViewport () {
		if (this.props.relative || this.state.isLive) {
			return true
		} else {
			return RundownUtils.isInsideViewport(
				this.props.scrollLeft,
				this.props.scrollWidth,
				this.props.part,
				this.getPartStartsAt(),
				this.getPartDuration()
			)
		}
	}

	renderTimelineOutputGroups (part: PartUi) {
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
							mediaPreviewUrl={ensureHasTrailingSlash(this.props.studio.settings.mediaPreviewsUrl + '' || '') || ''}
							layer={layer}
							segment={this.props.segment}
							part={part}
							rundown={this.props.rundown}
							startsAt={this.getPartStartsAt() || this.props.part.startsAt || 0}
							duration={this.getPartDuration()}
							isLiveLine={this.props.rundown.currentPartId === part._id ? true : false}
							isNextLine={this.props.rundown.nextPartId === part._id ? true : false}
							timeScale={this.props.timeScale}
							autoNextPart={this.props.autoNextPart}
							liveLinePadding={SegmentTimelinePart0.getLiveLineTimePadding(this.props.timeScale)} />
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
							(this.props.livePosition || 0) + SegmentTimelinePart0.getLiveLineTimePadding(this.props.timeScale) - (this.props.part.expectedDuration || this.props.part.renderedDuration || 0)),
				SegmentTimelinePart0.getLiveLineTimePadding(this.props.timeScale)
					) * this.props.timeScale) + 'px'
		}
	}

	render () {
		const { t } = this.props

		const isEndOfShow = this.props.isLastSegment && this.props.isLastInSegment && (!this.state.isLive || (this.state.isLive && !this.props.rundown.nextPartId))

		if (this.isInsideViewport()) {
			return (
				<div className={ClassNames('segment-timeline__part', {
					'live': this.state.isLive,
					'next': this.state.isNext,
					'invalid': this.props.part.invalid,

					'duration-settling': this.state.isDurationSettling
				})} data-obj-id={this.props.part._id}
					id={SegmentTimelinePartElementId + this.props.part._id}
					style={this.getLayerStyle()}
				>
					{this.props.part.invalid ? <div className='segment-timeline__part__invalid-cover'></div> : null}

					<div className={ClassNames('segment-timeline__part__nextline', { // This is the base, basic line
						'auto-next': ((this.state.isNext && this.props.autoNextPart) || (!this.state.isNext && this.props.part.willProbablyAutoNext)),
						'invalid': this.props.part.invalid,
						'offset': !!this.props.rundown.nextTimeOffset
					})}>
						<div className={ClassNames('segment-timeline__part__nextline__label', {
							'segment-timeline__part__nextline__label--thin': (this.props.autoNextPart || this.props.part.willProbablyAutoNext) && !this.state.isNext
						})}>
							{(
								this.props.part.invalid ?
									t('Invalid') :
									<React.Fragment>
										{((this.state.isNext && this.props.autoNextPart) || (!this.state.isNext && this.props.part.willProbablyAutoNext)) && t('Auto') + ' '}
										{this.state.isNext && t('Next')}
									</React.Fragment>
							)}
						</div>
					</div>
					{this.props.rundown.nextTimeOffset && this.state.isNext && // This is the off-set line
						<div className={ClassNames('segment-timeline__part__nextline', {
							'auto-next': this.props.part.willProbablyAutoNext,
							'invalid': this.props.part.invalid
						})} style={{
							'left': (this.props.relative ?
								((this.props.rundown.nextTimeOffset / (this.getPartDuration() || 1) * 100) + '%') :
								((this.props.rundown.nextTimeOffset * this.props.timeScale) + 'px')),
						}}>
							<div className={ClassNames('segment-timeline__part__nextline__label', {
								'segment-timeline__part__nextline__label--thin': (this.props.autoNextPart || this.props.part.willProbablyAutoNext) && !this.state.isNext
							})}>
								{(
									this.props.part.invalid ?
										t('Invalid') :
									[
										(this.props.autoNextPart || this.props.part.willProbablyAutoNext) && t('Auto') + ' ',
										this.state.isNext && t('Next')
									]
								)}
							</div>
						</div>
					}
					{DEBUG_MODE &&
						<div className='segment-timeline__debug-info'>
							{this.props.livePosition} / {this.props.part.startsAt} / {((this.props.timingDurations || { partStartsAt: {} }).partStartsAt || {})[this.props.part._id]}
						</div>
					}
					{this.state.isLive && !this.props.relative && !this.props.autoNextPart && !this.props.part.autoNext &&
						<div className='segment-timeline__part__future-shade' style={this.getFutureShadeStyle()}>
						</div>
					}
					{this.renderTimelineOutputGroups(this.props.part)}
					{this.props.isLastInSegment && <div className={ClassNames('segment-timeline__part__nextline', 'segment-timeline__part__nextline--endline', {
						'auto-next': this.props.part.autoNext,
						'is-next': this.state.isLive && (!this.props.isLastSegment && !this.props.isLastInSegment || !!this.props.rundown.nextPartId),
						'show-end': isEndOfShow
					})}>
						<div className={ClassNames('segment-timeline__part__nextline__label', {
							'segment-timeline__part__nextline__label--thin': (this.props.part.autoNext) && !this.state.isLive
						})}>
							{this.props.part.autoNext && t('Auto') + ' '}
							{this.state.isLive && t('Next')}
							{!isEndOfShow && <div className='segment-timeline__part__nextline__label__carriage-return'>
								<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 11.36 7.92'>
									<g>
										<path d='M10.36,0V2.2A3.06,3.06,0,0,1,7.3,5.25H3.81V3.51L0,5.71,3.81,7.92V6.25H7.3a4.06,4.06,0,0,0,4.06-4V0Z' />
									</g>
								</svg>
							</div>}
						</div>
					</div>}
					{isEndOfShow && <div className='segment-timeline__part__show-end'>
						<div className='segment-timeline__part__show-end__label'>
							{t('Show End')}
						</div>
					</div>}
				</div>
			)
		} else { // render placeholders
			return (
				<div className={ClassNames('segment-timeline__part', {
					'live': this.state.isLive,
					'next': this.state.isNext
				})} data-obj-id={this.props.part._id}
					style={this.getLayerStyle()}
				>
					{ /* render it empty, just to take up space */}
				</div>
			)
		}

	}
}))
