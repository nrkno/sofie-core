import * as React from 'react'
import * as PropTypes from 'prop-types'
import { translate } from 'react-i18next'

import * as ClassNames from 'classnames'
import * as _ from 'underscore'
import { ContextMenuTrigger } from 'react-contextmenu'

import { Rundown, RundownHoldState } from '../../../lib/collections/Rundowns'
import { Studio } from '../../../lib/collections/Studios'
import { SegmentUi, PartUi, IOutputLayerUi, PieceUi } from './SegmentTimelineContainer'
import { TimelineGrid } from './TimelineGrid'
import { SegmentTimelinePart } from './SegmentTimelinePart'
import { SegmentTimelineZoomControls } from './SegmentTimelineZoomControls'
import {
	SegmentDuration,
	PartCountdown,
	RundownTiming,
	CurrentPartRemaining
} from '../RundownView/RundownTiming'

import { RundownUtils } from '../../lib/rundown'
import { Translated } from '../../lib/ReactMeteorData/ReactMeteorData'
import { ErrorBoundary } from '../../lib/ErrorBoundary'
import { scrollToSegment } from '../../lib/viewPort'

// @ts-ignore Not recognized by Typescript
import * as Zoom_In_MouseOut from './Zoom_In_MouseOut.json'
// @ts-ignore Not recognized by Typescript
import * as Zoom_In_MouseOver from './Zoom_In_MouseOver.json'
// @ts-ignore Not recognized by Typescript
import * as Zoom_Normal_MouseOut from './Zoom_Normal_MouseOut.json'
// @ts-ignore Not recognized by Typescript
import * as Zoom_Normal_MouseOver from './Zoom_Normal_MouseOver.json'
// @ts-ignore Not recognized by Typescript
import * as Zoom_Out_MouseOut from './Zoom_Out_MouseOut.json'
// @ts-ignore Not recognized by Typescript
import * as Zoom_Out_MouseOver from './Zoom_Out_MouseOver.json'
import { LottieButton } from '../../lib/LottieButton'
import { PartNote, NoteType } from '../../../lib/api/notes'
import { getAllowSpeaking } from '../../lib/localStorage';

interface IProps {
	id: string
	key: string
	segment: SegmentUi
	rundown: Rundown,
	followLiveSegments: boolean,
	studio: Studio
	parts: Array<PartUi>
	segmentNotes: Array<PartNote>
	timeScale: number
	onCollapseOutputToggle?: (layer: IOutputLayerUi, event: any) => void
	collapsedOutputs: {
		[key: string]: boolean
	},
	onCollapseSegmentToggle?: (event: any) => void,
	isCollapsed?: boolean,
	scrollLeft: number,
	hasAlreadyPlayed: boolean,
	hasGuestItems: boolean,
	hasRemoteItems: boolean,
	isLiveSegment: boolean,
	isNextSegment: boolean,
	followLiveLine: boolean,
	liveLineHistorySize: number,
	livePosition: number,
	autoNextPart: boolean,
	onScroll: (scrollLeft: number, event: any) => void
	onZoomChange: (newScale: number, event: any) => void
	onFollowLiveLine?: (state: boolean, event: any) => void
	onShowEntireSegment?: (event: any) => void
	onContextMenu?: (contextMenuContext: any) => void
	onItemClick?: (piece: PieceUi, e: React.MouseEvent<HTMLDivElement>) => void
	onItemDoubleClick?: (item: PieceUi, e: React.MouseEvent<HTMLDivElement>) => void
	onHeaderNoteClick?: (level: NoteType) => void
	segmentRef?: (el: SegmentTimelineClass, sId: string) => void
	followingPart: PartUi | undefined
	isLastSegment: boolean
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
		window.addEventListener(RundownTiming.Events.timeupdateHR, this.onTimeupdate)
	}

	componentWillUnmount () {
		window.removeEventListener(RundownTiming.Events.timeupdateHR, this.onTimeupdate)
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
			const durations = this.context.durations as RundownTiming.RundownTimingContext
			this.props.parts.forEach((item) => {
				// total += durations.partDurations ? durations.partDurations[item._id] : (item.duration || item.renderedDuration || 1)
				const duration = Math.max((item.duration || item.renderedDuration || 0), durations.partDisplayDurations && durations.partDisplayDurations[item._id] || 0)
				total += duration
			})
		} else {
			total = RundownUtils.getSegmentDuration(this.props.parts)
		}
		return total
	}

	getSegmentDuration (): number {
		return this.props.isLiveSegment ? this.calculateSegmentDuration() : this.state.totalSegmentDuration
	}

	renderZoomTimeline () {
		return this.props.parts.map((part, index, array) => {
			return (
				<SegmentTimelinePart key={part._id}
					segment={this.props.segment}
					rundown={this.props.rundown}
					studio={this.props.studio}
					collapsedOutputs={this.props.collapsedOutputs}
					isCollapsed={this.props.isCollapsed}
					scrollLeft={0}
					scrollWidth={1}
					timeScale={1}
					relative={true}
					totalSegmentDuration={this.getSegmentDuration()}
					part={part}
					followLiveLine={this.props.followLiveLine}
					autoNextPart={this.props.autoNextPart}
					liveLineHistorySize={this.props.liveLineHistorySize}
					livePosition={this.props.segment._id === this.props.rundown.currentPartId && part.startedPlayback && part.getLastStartedPlayback() ? this.props.livePosition - (part.getLastStartedPlayback() || 0) : null}
					isLastInSegment={false}
					isLastSegment={false} />
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
			<div className='segment-timeline__zoom-area-container'>
				<div className='segment-timeline__zoom-area'
					onDoubleClick={(e) => this.props.onZoomDblClick(e)}>
					<div className='segment-timeline__timeline'>
						{this.renderZoomTimeline()}
					</div>
					<SegmentTimelineZoomControls scrollLeft={this.props.scrollLeft}
						scrollWidth={this.props.timelineWidth / this.props.timeScale}
						onScroll={this.props.onScroll}
						segmentDuration={this.getSegmentDuration()}
						liveLineHistorySize={this.props.liveLineHistorySize}
						timeScale={this.props.timeScale}
						onZoomChange={this.props.onZoomChange} />
					{this.renderMiniLiveLine()}
				</div>
			</div>
		)
	}
}

class SegmentTimelineZoomButtons extends React.Component<IProps> {
	constructor (props: IProps) {
		super(props)
	}

	zoomIn = (e: React.MouseEvent<HTMLDivElement>) => {
		this.props.onZoomChange(this.props.timeScale * 2, e)
	}

	zoomOut = (e: React.MouseEvent<HTMLDivElement>) => {
		this.props.onZoomChange(this.props.timeScale * 0.5, e)
	}

	zoomNormalize = (e: React.MouseEvent<HTMLDivElement>) => {
		this.props.onZoomChange(0.03, e)
	}

	render () {
		return (
			<div className='segment-timeline__timeline-zoom-buttons'>
				<LottieButton className='segment-timeline__timeline-zoom-buttons__button'
					inAnimation={Zoom_In_MouseOver}
					outAnimation={Zoom_In_MouseOut}
					onClick={this.zoomIn} />
				<LottieButton className='segment-timeline__timeline-zoom-buttons__button'
					inAnimation={Zoom_Normal_MouseOver}
					outAnimation={Zoom_Normal_MouseOut}
					onClick={this.zoomNormalize} />
				<LottieButton className='segment-timeline__timeline-zoom-buttons__button'
					inAnimation={Zoom_Out_MouseOver}
					outAnimation={Zoom_Out_MouseOut}
					onClick={this.zoomOut} />
			</div>
		)
	}
}

export const SEGMENT_TIMELINE_ELEMENT_ID = 'rundown__segment__'
export class SegmentTimelineClass extends React.Component<Translated<IProps>, IStateHeader> {
	static whyDidYouRender = true
	
	timeline: HTMLDivElement
	segmentBlock: HTMLDivElement

	private _touchSize: number = 0
	private _touchAttached: boolean = false
	private _lastTouch: {
		clientX: number
		clientY: number
	} | undefined = undefined

	constructor (props: Translated<IProps>) {
		super(props)
		this.state = {
			timelineWidth: 1
		}
	}

	setSegmentRef = (el: HTMLDivElement) => {
		this.segmentBlock = el
		if (typeof this.props.segmentRef === 'function') this.props.segmentRef(this as any, this.props.segment._id)

		if (this.segmentBlock) {
			this.segmentBlock.addEventListener('wheel', this.onTimelineWheel, { passive: false, capture: true })
		}
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
		if (this.props.onShowEntireSegment) {
			this.props.onShowEntireSegment(e)
		}
	}

	onTimelineTouchEnd = (e: React.TouchEvent<HTMLDivElement> & any) => {
		if (e.touches.length === 0) {
			document.removeEventListener('touchmove', this.onTimelineTouchMove)
			document.removeEventListener('touchend', this.onTimelineTouchEnd)
			this._touchAttached = false
		}
	}

	onTimelineTouchMove = (e: React.TouchEvent<HTMLDivElement> & any) => {
		if (e.touches.length === 2) {
			let newSize = e.touches[1].clientX - e.touches[0].clientX
			let prop = newSize / this._touchSize
			this.props.onZoomChange(Math.min(500, this.props.timeScale * prop), e)
			this._touchSize = newSize
		} else if (e.touches.length === 1 && this._lastTouch) {
			let scrollAmount = this._lastTouch.clientX - e.touches[0].clientX
			this.props.onScroll(Math.max(0, this.props.scrollLeft + (scrollAmount / this.props.timeScale)), e)
			this._lastTouch = {
				clientX: e.touches[0].clientX,
				clientY: e.touches[0].clientY
			}
		}
	}

	onTimelineTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
		if (e.touches.length === 2) { // expect two touch points
			if (!this._touchAttached) {
				document.addEventListener('touchmove', this.onTimelineTouchMove)
				document.addEventListener('touchend', this.onTimelineTouchEnd)
				this._touchAttached = true
			}
			this._touchSize = e.touches[1].clientX - e.touches[0].clientX
		} else if (e.touches.length === 1) {
			if (!this._touchAttached) {
				document.addEventListener('touchmove', this.onTimelineTouchMove)
				document.addEventListener('touchend', this.onTimelineTouchEnd)
				this._touchAttached = true
			}
			this._lastTouch = {
				clientX: e.touches[0].clientX,
				clientY: e.touches[0].clientY
			}
		}
	}

	onTimelineWheel = (e: React.WheelEventHandler<HTMLDivElement> & any) => {
		if (e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey &&
			// @ts-ignore
			!window.keyboardModifiers.altRight) { // ctrl + Scroll
			this.props.onZoomChange(Math.min(500, this.props.timeScale * (1 + 0.001 * (e.deltaY * -1))), e)
			e.preventDefault()
			e.stopPropagation()
		} else if ((!e.ctrlKey && e.altKey && !e.metaKey && !e.shiftKey)
			// @ts-ignore
			|| (e.ctrlKey && !e.metaKey && !e.shiftKey && window.keyboardModifiers.altRight)) { // Alt + Scroll
			this.props.onScroll(Math.max(0, this.props.scrollLeft + ((e.deltaY) / this.props.timeScale)), e)
			e.preventDefault()
			e.stopPropagation()
		} else if (!e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) { // no modifier
			if (e.deltaX !== 0) {
				this.props.onScroll(Math.max(0, this.props.scrollLeft + ((e.deltaX) / this.props.timeScale)), e)
			}
		}
	}

	getSegmentContext = (props) => {
		const ctx = {
			segment: this.props.segment,
			part: this.props.parts.length > 0 ? this.props.parts[0] : null
		}

		if (this.props.onContextMenu && typeof this.props.onContextMenu === 'function') {
			this.props.onContextMenu(ctx)
		}

		return ctx
	}

	getSegmentDuration () {
		return (this.props.parts && RundownUtils.getSegmentDuration(this.props.parts)) || 0
	}

	timelineStyle () {
		return {
			'transform': 'translate3d(-' + Math.floor(this.props.scrollLeft * this.props.timeScale).toString() + 'px, 0, 0.1px)',
			'willChange': 'transform'
		}
	}

	renderLiveLine () {
		const { t } = this.props

		if (this.props.isLiveSegment) {
			let pixelPostion = Math.floor((this.props.livePosition * this.props.timeScale) - (!this.props.followLiveLine ? (this.props.scrollLeft * this.props.timeScale) : 0))
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
							Math.min(Math.max(0, pixelPostion), this.props.liveLineHistorySize).toString() :
							Math.max(0, pixelPostion).toString()
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
						<CurrentPartRemaining currentPartId={this.props.rundown.currentPartId} speaking={getAllowSpeaking()} heavyClassName='overtime' />
						{this.props.autoNextPart ?
							<div className='rundown-view__part__icon rundown-view__part__icon--auto-next'></div> :
							<div className='rundown-view__part__icon rundown-view__part__icon--next'></div>
						}
						{this.props.rundown.holdState && this.props.rundown.holdState !== RundownHoldState.COMPLETE ?
							<div className='segment-timeline__liveline__status segment-timeline__liveline__status--hold'>{t('Hold')}</div>
							: null
						}
					</div>
				</div>
			]
		}
	}

	renderTimeline () {
		return <React.Fragment>
			{this.props.parts.map((part, index) => {
				return (
					<SegmentTimelinePart key={part._id}
						segment={this.props.segment}
						rundown={this.props.rundown}
						studio={this.props.studio}
						collapsedOutputs={this.props.collapsedOutputs}
						isCollapsed={this.props.isCollapsed}
						scrollLeft={this.props.scrollLeft}
						timeScale={this.props.timeScale}
						autoNextPart={this.props.autoNextPart}
						followLiveLine={this.props.followLiveLine}
						liveLineHistorySize={this.props.liveLineHistorySize}
						livePosition={this.props.livePosition}
						onScroll={this.props.onScroll}
						onCollapseOutputToggle={this.props.onCollapseOutputToggle}
						onCollapseSegmentToggle={this.props.onCollapseSegmentToggle}
						onFollowLiveLine={this.props.onFollowLiveLine}
						onContextMenu={this.props.onContextMenu}
						relative={false}
						onPieceClick={this.props.onItemClick}
						onPieceDoubleClick={this.props.onItemDoubleClick}
						scrollWidth={this.state.timelineWidth / this.props.timeScale}
						firstPartInSegment={this.props.parts[0]}
						isLastSegment={this.props.isLastSegment}
						isLastInSegment={index === (this.props.parts.length - 1)}
						part={part} />
				)
			})}
		</React.Fragment>
	}

	renderEndOfSegment () {
		return <div className='segment-timeline__part segment-timeline__part--end-of-segment'></div>
	}

	renderOutputLayerControls () {
		if (this.props.segment.outputLayers !== undefined) {
			return _.map(_.values(this.props.segment.outputLayers).sort((a, b) => {
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
								onClick={(e) => this.props.onCollapseOutputToggle && this.props.onCollapseOutputToggle(outputLayer, e)}>
								{outputLayer.name}
							</div>
							{(
								outputLayer.sourceLayers !== undefined &&
								outputLayer.sourceLayers.filter(i => !i.isHidden).sort((a, b) => a._rank - b._rank)
									.map((sourceLayer, index, array) => {
										return (
											<div key={sourceLayer._id} className='segment-timeline__output-layer-control__layer' data-source-id={sourceLayer._id}>
												{(array.length === 1 || sourceLayer.name === outputLayer.name) ? ' ' : sourceLayer.name}
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
		let notes: Array<PartNote> = this.props.segmentNotes

		const { t } = this.props

		const criticalNotes = _.reduce(notes, (prev, item) => {
			if (item.type === NoteType.ERROR) return ++prev
			return prev
		}, 0)
		const warningNotes = _.reduce(notes, (prev, item) => {
			if (item.type === NoteType.WARNING) return ++prev
			return prev
		}, 0)

		return (
			<div id={this.props.id}
				className={ClassNames('segment-timeline', {
					'collapsed': this.props.isCollapsed,

					'live': this.props.isLiveSegment,
					'next': !this.props.isLiveSegment && this.props.isNextSegment,

					'has-played': this.props.hasAlreadyPlayed && !this.props.isLiveSegment && !this.props.isNextSegment && !this.props.hasGuestItems && !this.props.hasRemoteItems,

					'has-guest-items': this.props.hasGuestItems,
					'has-remote-items': this.props.hasRemoteItems
				})}
				data-obj-id={this.props.segment._id} ref={this.setSegmentRef}>
				<ContextMenuTrigger id='segment-timeline-context-menu'
					collect={this.getSegmentContext}
					attributes={{
						className: 'segment-timeline__title'
					}}
					renderTag='div'>
					<h2>
						{this.props.segment.name}
					</h2>
					{(criticalNotes > 0 || warningNotes > 0) && <div className='segment-timeline__title__notes'>
						{criticalNotes > 0 && <div className='segment-timeline__title__notes__note'
							onClick={(e) => this.props.onHeaderNoteClick && this.props.onHeaderNoteClick(NoteType.ERROR)}>
							<img className='icon' src='/icons/warning_icon.svg' />
							<div>
								{t('Critical Errors')}:&nbsp;
								<b>
									{criticalNotes}
								</b>
							</div>
						</div>}
						{warningNotes > 0 && <div className='segment-timeline__title__notes__note'
							onClick={(e) => this.props.onHeaderNoteClick && this.props.onHeaderNoteClick(NoteType.WARNING)}>
							<img className='icon' src='/icons/warning_icon.svg' />
							<div>
								{t('Warnings')}:&nbsp;
								<b>
									{warningNotes}
								</b>
							</div>
						</div>}
					</div>}
				</ContextMenuTrigger>
				<div className='segment-timeline__duration' tabIndex={0}
					onClick={(e) => this.props.onCollapseSegmentToggle && this.props.onCollapseSegmentToggle(e)}>
					{this.props.rundown && this.props.parts && this.props.parts.length > 0 && (!this.props.hasAlreadyPlayed || this.props.isNextSegment || this.props.isLiveSegment) &&
						<SegmentDuration
							partIds={this.props.parts.filter(item => item.duration === undefined).map(item => item._id)}
						/>
					}
				</div>
				<div className='segment-timeline__timeUntil'
					onClick={(e) => this.props.onCollapseSegmentToggle && this.props.onCollapseSegmentToggle(e)}>
					{this.props.rundown && this.props.parts && this.props.parts.length > 0 &&
						<PartCountdown
							partId={
								(
									!this.props.isLiveSegment &&
									(
										this.props.isNextSegment ?
											this.props.rundown.nextPartId :
											this.props.parts[0]._id
									)
								) || undefined}
							hideOnZero={true}
						/>
					}
				</div>
				<div className='segment-timeline__mos-id'>{this.props.segment.externalId}</div>
				<div className='segment-timeline__output-layers'>
					{this.renderOutputLayerControls()}
				</div>
				<div className='segment-timeline__timeline-background' />
				<TimelineGrid {...this.props}
					onResize={this.onTimelineResize} />
				<div className='segment-timeline__timeline-container'
					onTouchStartCapture={this.onTimelineTouchStart}>
					<div className='segment-timeline__timeline'
						key={this.props.segment._id + '-timeline'}
						ref={this.setTimelineRef}
						style={this.timelineStyle()}>
						<ErrorBoundary>
							{this.renderTimeline()}
							{this.renderEndOfSegment()}
						</ErrorBoundary>
					</div>
					{this.renderLiveLine()}
				</div>
				<ErrorBoundary>
					<SegmentTimelineZoomButtons {...this.props} />
				</ErrorBoundary>
				{/* <ErrorBoundary>
					<SegmentNextPreview
						rundown={this.props.rundown}
						collapsedOutputs={this.props.collapsedOutputs}
						isCollapsed={this.props.isCollapsed}
						outputGroups={this.props.segment.outputLayers}
						sourceLayers={this.props.segment.sourceLayers}
						part={this.props.followingPart} />
				</ErrorBoundary> */}
				<ErrorBoundary>
					<SegmentTimelineZoom
						onZoomDblClick={this.onZoomDblClick}
						timelineWidth={this.state.timelineWidth}
						{...this.props} />
				</ErrorBoundary>
			</div>
		)
	}
}

export const SegmentTimeline = translate()(SegmentTimelineClass)
