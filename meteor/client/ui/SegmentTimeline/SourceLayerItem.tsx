import * as React from 'react'
import * as ReactDOM from 'react-dom'
import * as _ from 'underscore'
import * as $ from 'jquery'
import { ISourceLayerUi,
		 IOutputLayerUi,
		 SegmentUi,
		 SegmentLineUi,
		 SegmentLineItemUi } from './SegmentTimelineContainer'

import { RundownAPI } from './../../../lib/api/rundown'
import { RundownUtils } from './../../lib/rundown'
import { Transition } from '../../../lib/constants/casparcg'

import { FloatingInspector } from '../FloatingInspector'

import * as ClassNames from 'classnames'
import { DefaultLayerItemRenderer } from './Renderers/DefaultLayerItemRenderer'
import { MicSourceRenderer } from './Renderers/MicSourceRenderer'
import { VTSourceRenderer } from './Renderers/VTSourceRenderer'
import { STKSourceRenderer } from './Renderers/STKSourceRenderer'
import { L3rdSourceRenderer } from './Renderers/L3rdSourceRenderer'
import { SplitsSourceRenderer } from './Renderers/SplitsSourceRenderer'

export interface ISourceLayerItemProps {
	layer: ISourceLayerUi
	outputLayer: IOutputLayerUi
	segment: SegmentUi
	segmentLine: SegmentLineUi
	segmentLineStartsAt: number
	segmentLineDuration: number
	segmentLineItem: SegmentLineItemUi
	timeScale: number
	isLiveLine: boolean
	isNextLine: boolean
	onFollowLiveLine?: (state: boolean, event: any) => void
	relative?: boolean
	followLiveLine: boolean
	liveLineHistorySize: number
	livePosition: number | null
	outputGroupCollapsed: boolean
	scrollLeft: number
	scrollWidth: number
}
interface ISourceLayerItemState {
	itemState: number
	showMiniInspector: boolean
	elementPosition: JQueryCoordinates
	cursorPosition: JQueryCoordinates
	cursorTimePostion: number
	elementWidth: number
	itemElement: HTMLDivElement | null
	leftAnchoredWidth: number
	rightAnchoredWidth: number
}
export class SourceLayerItem extends React.Component<ISourceLayerItemProps, ISourceLayerItemState> {
	private _forceSizingRecheck: boolean
	private _placeHolderElement: boolean

	constructor (props) {
		super(props)
		this.state = {
			itemState: 0,
			showMiniInspector: false,
			elementPosition: {
				top: 0,
				left: 0
			},
			cursorPosition: {
				top: 0,
				left: 0
			},
			cursorTimePostion: 0,
			elementWidth: 0,
			itemElement: null,
			leftAnchoredWidth: 0,
			rightAnchoredWidth: 0
		}

		this._forceSizingRecheck = false
	}

	setRef = (e: HTMLDivElement) => {
		this.setState({
			itemElement: e
		})
	}

	getItemLabelOffsetLeft = (): { [key: string]: string } => {
		if (this.props.relative) {
			return {}
		} else {
			if (this.props.segmentLine && this.props.segmentLineStartsAt !== undefined && this.props.segmentLineItem.renderedInPoint !== undefined && this.props.segmentLineItem.renderedDuration !== undefined) {
				let segmentLineItem = this.props.segmentLineItem

				let inTransitionDuration = segmentLineItem.transitions && segmentLineItem.transitions.inTransition ? segmentLineItem.transitions.inTransition.duration : 0
				let outTransitionDuration = segmentLineItem.transitions && segmentLineItem.transitions.outTransition ? segmentLineItem.transitions.outTransition.duration : 0

				const inPoint = segmentLineItem.renderedInPoint || 0
				const duration = (Number.isFinite(segmentLineItem.renderedDuration || 0)) ?
					segmentLineItem.renderedDuration || this.props.segmentLineDuration || this.props.segmentLine.renderedDuration || 0 :
					this.props.segmentLineDuration || this.props.segmentLine.renderedDuration || 0

				const widthConstrictedMode = this.state.leftAnchoredWidth > 0 && this.state.rightAnchoredWidth > 0 && ((this.state.leftAnchoredWidth + this.state.rightAnchoredWidth) > this.state.elementWidth)

				if (this.props.followLiveLine && this.props.isLiveLine) {
					const liveLineHistoryWithMargin = this.props.liveLineHistorySize - 10
					if (this.props.scrollLeft + (liveLineHistoryWithMargin / this.props.timeScale) > (inPoint + this.props.segmentLineStartsAt + inTransitionDuration + (this.state.leftAnchoredWidth / this.props.timeScale)) &&
						this.props.scrollLeft + (liveLineHistoryWithMargin / this.props.timeScale) < (inPoint + duration + this.props.segmentLineStartsAt - outTransitionDuration)) {
						const targetPos = (this.props.scrollLeft - inPoint - this.props.segmentLineStartsAt - inTransitionDuration) * this.props.timeScale

						// console.log(this.state.itemElement)

						// || (this.state.leftAnchoredWidth === 0 || this.state.rightAnchoredWidth === 0)
						let styleObj = {
							'transform': 'translate3d(' + (widthConstrictedMode ? targetPos : Math.min(targetPos, (this.state.elementWidth - this.state.rightAnchoredWidth - liveLineHistoryWithMargin - 10))).toString() + 'px, 0, 0) ' +
								'translate3d(' + (liveLineHistoryWithMargin).toString() + 'px, 0, 0) ' +
								'translate3d(-100%, 0, 0)',
							'willChange': 'transform'
						}

						return styleObj
					} else if ((this.state.rightAnchoredWidth < this.state.elementWidth) &&
						(this.state.leftAnchoredWidth < this.state.elementWidth) &&
						(this.props.scrollLeft + (liveLineHistoryWithMargin / this.props.timeScale) >= (inPoint + duration + this.props.segmentLineStartsAt - outTransitionDuration))) {
						const targetPos = (this.props.scrollLeft - inPoint - this.props.segmentLineStartsAt - inTransitionDuration) * this.props.timeScale

						let styleObj = {
							'transform': 'translate3d(' + (Math.min(targetPos, (this.state.elementWidth - this.state.rightAnchoredWidth - liveLineHistoryWithMargin - 10))).toString() + 'px, 0, 0) ' +
								'translate3d(' + (liveLineHistoryWithMargin).toString() + 'px, 0, 0) ' +
								'translate3d(-100%, 0, 0)',
							'willChange': 'transform'
						}

						return styleObj
					}
				} else {
					if (this.props.scrollLeft > (inPoint + this.props.segmentLineStartsAt + inTransitionDuration) &&
						this.props.scrollLeft < (inPoint + duration + this.props.segmentLineStartsAt - outTransitionDuration)) {
						const targetPos = (this.props.scrollLeft - inPoint - this.props.segmentLineStartsAt - inTransitionDuration) * this.props.timeScale

						let styleObj = {
							'transform': 'translate3d(' + (widthConstrictedMode || (this.state.leftAnchoredWidth === 0 || this.state.rightAnchoredWidth === 0) ? targetPos : Math.min(targetPos, (this.state.elementWidth - this.state.leftAnchoredWidth - this.state.rightAnchoredWidth))).toString() + 'px,  0, 0)',
							'willChange': 'transform'
						}

						return styleObj
					}
				}
			}
			return {}
		}
	}

	getItemLabelOffsetRight = (): { [key: string]: string } => {
		if (this.props.relative) {
			return {}
		} else {
			if (this.props.segmentLine && this.props.segmentLine.startsAt !== undefined && this.props.segmentLineItem.renderedInPoint !== undefined && this.props.segmentLineItem.renderedDuration !== undefined) {
				let segmentLineItem = this.props.segmentLineItem

				let inTransitionDuration = segmentLineItem.transitions && segmentLineItem.transitions.inTransition ? segmentLineItem.transitions.inTransition.duration : 0
				let outTransitionDuration = segmentLineItem.transitions && segmentLineItem.transitions.outTransition ? segmentLineItem.transitions.outTransition.duration : 0

				const inPoint = segmentLineItem.renderedInPoint || 0
				const duration = (Number.isFinite(segmentLineItem.renderedDuration || 0)) ?
					segmentLineItem.renderedDuration || this.props.segmentLineDuration || this.props.segmentLine.renderedDuration || 0 :
					this.props.segmentLineDuration || this.props.segmentLine.renderedDuration || 0
				const outPoint = inPoint + duration

				const widthConstrictedMode = this.state.leftAnchoredWidth > 0 && this.state.rightAnchoredWidth > 0 && ((this.state.leftAnchoredWidth + this.state.rightAnchoredWidth) > this.state.elementWidth)

				if (this.props.scrollLeft + this.props.scrollWidth < (outPoint - outTransitionDuration + this.props.segmentLine.startsAt) &&
					this.props.scrollLeft + this.props.scrollWidth > (inPoint + this.props.segmentLine.startsAt)) {
					const targetPos = ((this.props.scrollLeft + this.props.scrollWidth) - outPoint - this.props.segmentLine.startsAt - outTransitionDuration) * this.props.timeScale

					return {
						'transform': 'translate3d(' + (widthConstrictedMode || (this.state.leftAnchoredWidth === 0 || this.state.rightAnchoredWidth === 0) ? targetPos : Math.max(targetPos, (this.state.elementWidth - this.state.leftAnchoredWidth - this.state.rightAnchoredWidth) * -1)).toString() + 'px,  0, 0)',
						'willChange': 'transform'
					}
				}
			}
			return {}
		}
	}

	getItemStyle (): { [key: string]: string } {
		let segmentLineItem = this.props.segmentLineItem

		let inTransitionDuration = segmentLineItem.transitions && segmentLineItem.transitions.inTransition ? segmentLineItem.transitions.inTransition.duration : 0
		let outTransitionDuration = segmentLineItem.transitions && segmentLineItem.transitions.outTransition ? segmentLineItem.transitions.outTransition.duration : 0

		let itemDuration = segmentLineItem.renderedDuration || segmentLineItem.expectedDuration

		if (this.props.relative) {
			return {
				// as-run "duration" takes priority over renderdDuration which takes priority over MOS-import expectedDuration (editorial duration)
				// also: don't render transitions in relative mode
				'left': (((segmentLineItem.renderedInPoint || 0)) / (this.props.segmentLineDuration || 1) * 100).toString() + '%',
				'width': ((itemDuration) / (this.props.segmentLineDuration || 1) * 100).toString() + '%'
			}
		} else {
			return {
				// as-run "duration" takes priority over renderdDuration which takes priority over MOS-import expectedDuration (editorial duration)
				'left': (((segmentLineItem.renderedInPoint || 0) + inTransitionDuration) * this.props.timeScale).toString() + 'px',
				'width': ((itemDuration - inTransitionDuration - outTransitionDuration) * this.props.timeScale).toString() + 'px'
			}
		}
	}

	checkElementWidth = () => {
		if (this.state.itemElement && this._forceSizingRecheck) {
			this._forceSizingRecheck = false
			const width = $(this.state.itemElement).width() || 0
			if (this.state.elementWidth !== width) {
				this.setState({
					elementWidth: width
				})
			}
		}
	}

	componentDidMount () {
		this.checkElementWidth()
	}

	componentWillReceiveProps (nextProps: ISourceLayerItemProps) {
		if ((nextProps.segmentLineDuration !== this.props.segmentLineDuration) ||
			(nextProps.segmentLineItem.renderedInPoint !== this.props.segmentLineItem.renderedInPoint) ||
			(nextProps.segmentLineItem.renderedDuration !== this.props.segmentLineItem.renderedDuration) ||
			(nextProps.segmentLineItem.duration !== this.props.segmentLineItem.duration) ||
			(nextProps.segmentLineItem.expectedDuration !== this.props.segmentLineItem.expectedDuration) ||
			(nextProps.segmentLineItem.trigger !== this.props.segmentLineItem.trigger) ||
			(this.isInsideViewport() && this._placeHolderElement)) {
			this._forceSizingRecheck = true
		}

		if (nextProps.scrollLeft !== this.props.scrollLeft && this.state.showMiniInspector) {
			this.setState({
				cursorTimePostion: this.state.cursorTimePostion + (nextProps.scrollLeft - this.props.scrollLeft)
			})
		}
	}

	componentDidUpdate () {
		this._forceSizingRecheck = true
		this.checkElementWidth()
	}

	itemClick = (e: any) => {
		this.props.onFollowLiveLine && this.props.onFollowLiveLine(false, e)
	}

	itemMouseUp = (e: any) => {
		let eM = e as MouseEvent
		if (eM.ctrlKey === true) {
			this.setState({
				itemState: (this.state.itemState + 1) % 4
			})
			eM.preventDefault()
			eM.stopPropagation()
		}
		return
	}

	toggleMiniInspector = (e: MouseEvent | any, v: boolean) => {
		this.setState({
			showMiniInspector: v
		})
		// console.log($(this.itemElement).offset())
		const elementPos = this.state.itemElement && $(this.state.itemElement).offset() || {
			top: 0,
			left: 0
		}

		const cursorPosition = {
			left: e.clientX - elementPos.left,
			top: e.clientY - elementPos.top
		}

		const cursorTimePostion = Math.max(cursorPosition.left, 0) / this.props.timeScale

		this.setState({
			elementPosition: elementPos,
			cursorPosition,
			cursorTimePostion
		})
	}

	moveMiniInspector = (e: MouseEvent | any) => {
		const cursorPosition = {
			left: e.clientX - this.state.elementPosition.left,
			top: e.clientY - this.state.elementPosition.top
		}
		const cursorTimePostion = Math.max(cursorPosition.left, 0) / this.props.timeScale

		this.setState({
			cursorPosition: _.extend(this.state.cursorPosition, cursorPosition),
			cursorTimePostion
		})
	}

	setAnchoredElsWidths = (leftAnchoredWidth: number, rightAnchoredWidth: number) => {
		this.setState({
			leftAnchoredWidth: leftAnchoredWidth,
			rightAnchoredWidth: rightAnchoredWidth
		})
	}

	renderInsideItem () {
		switch (this.props.layer.type) {
			case RundownAPI.SourceLayerType.SCRIPT:
			case RundownAPI.SourceLayerType.MIC:
				return <MicSourceRenderer key={this.props.segmentLineItem._id}
						getItemLabelOffsetLeft={this.getItemLabelOffsetLeft}
						getItemLabelOffsetRight={this.getItemLabelOffsetRight}
						setAnchoredElsWidths={this.setAnchoredElsWidths}
						{...this.props} {...this.state} />
			case RundownAPI.SourceLayerType.VT:
				return <VTSourceRenderer key={this.props.segmentLineItem._id}
						getItemLabelOffsetLeft={this.getItemLabelOffsetLeft}
						getItemLabelOffsetRight={this.getItemLabelOffsetRight}
						setAnchoredElsWidths={this.setAnchoredElsWidths}
						{...this.props} {...this.state} />
			case RundownAPI.SourceLayerType.LOWER_THIRD:
				return <L3rdSourceRenderer key={this.props.segmentLineItem._id}
						getItemLabelOffsetLeft={this.getItemLabelOffsetLeft}
						getItemLabelOffsetRight={this.getItemLabelOffsetRight}
						setAnchoredElsWidths={this.setAnchoredElsWidths}
						{...this.props} {...this.state} />
			case RundownAPI.SourceLayerType.SPLITS:
				return <SplitsSourceRenderer key={this.props.segmentLineItem._id}
						getItemLabelOffsetLeft={this.getItemLabelOffsetLeft}
						getItemLabelOffsetRight={this.getItemLabelOffsetRight}
						setAnchoredElsWidths={this.setAnchoredElsWidths}
						{...this.props} {...this.state} />
			case RundownAPI.SourceLayerType.LIVE_SPEAK:
				return <STKSourceRenderer key={this.props.segmentLineItem._id}
						getItemLabelOffsetLeft={this.getItemLabelOffsetLeft}
						getItemLabelOffsetRight={this.getItemLabelOffsetRight}
						setAnchoredElsWidths={this.setAnchoredElsWidths}
						{...this.props} {...this.state} />
			default:
				return <DefaultLayerItemRenderer key={this.props.segmentLineItem._id}
						getItemLabelOffsetLeft={this.getItemLabelOffsetLeft}
						getItemLabelOffsetRight={this.getItemLabelOffsetRight}
						setAnchoredElsWidths={this.setAnchoredElsWidths}
						{...this.props} {...this.state} />
		}
	}

	isInsideViewport () {
		if (this.props.relative) {
			return true
		} else {
			return RundownUtils.isInsideViewport(this.props.scrollLeft, this.props.scrollWidth, this.props.segmentLine, this.props.segmentLineStartsAt, this.props.segmentLineItem)
		}
	}

	render () {
		if (this.isInsideViewport()) {

			this._placeHolderElement = false

			return (
				<div className={ClassNames('segment-timeline__layer-item', {
					'audio': this.props.layer.type === RundownAPI.SourceLayerType.AUDIO,
					'camera': this.props.layer.type === RundownAPI.SourceLayerType.CAMERA,
					'camera-movement': this.props.layer.type === RundownAPI.SourceLayerType.CAMERA_MOVEMENT,
					'graphics': this.props.layer.type === RundownAPI.SourceLayerType.GRAPHICS,
					'lower-third': this.props.layer.type === RundownAPI.SourceLayerType.LOWER_THIRD,
					'live-speak': this.props.layer.type === RundownAPI.SourceLayerType.LIVE_SPEAK,
					'mic': this.props.layer.type === RundownAPI.SourceLayerType.MIC,
					'metadata': this.props.layer.type === RundownAPI.SourceLayerType.METADATA,
					'remote': this.props.layer.type === RundownAPI.SourceLayerType.REMOTE,
					'script': this.props.layer.type === RundownAPI.SourceLayerType.SCRIPT,
					'splits': this.props.layer.type === RundownAPI.SourceLayerType.SPLITS,
					'vt': this.props.layer.type === RundownAPI.SourceLayerType.VT,

					'with-in-transition': !this.props.relative && this.props.segmentLineItem.transitions && this.props.segmentLineItem.transitions.inTransition && this.props.segmentLineItem.transitions.inTransition.duration > 0,
					'with-out-transition': !this.props.relative && this.props.segmentLineItem.transitions && this.props.segmentLineItem.transitions.outTransition && this.props.segmentLineItem.transitions.outTransition.duration > 0,

					'hide-overflow-labels': this.state.leftAnchoredWidth > 0 && this.state.rightAnchoredWidth > 0 && ((this.state.leftAnchoredWidth + this.state.rightAnchoredWidth) > this.state.elementWidth),

					'infinite': this.props.segmentLineItem.expectedDuration === Number.POSITIVE_INFINITY,

					'source-missing': this.props.segmentLineItem.status === RundownAPI.LineItemStatusCode.SOURCE_MISSING,
					'source-broken': this.props.segmentLineItem.status === RundownAPI.LineItemStatusCode.SOURCE_BROKEN,
					'unknown-state': this.props.segmentLineItem.status === RundownAPI.LineItemStatusCode.UNKNOWN
				})}
					data-mos-id={this.props.segmentLineItem._id}
					ref={this.setRef}
					onClick={this.itemClick}
					onMouseUp={this.itemMouseUp}
					onMouseMove={(e) => this.moveMiniInspector(e)}
					onMouseOver={(e) => !this.props.outputGroupCollapsed && this.toggleMiniInspector(e, true)}
					onMouseLeave={(e) => this.toggleMiniInspector(e, false)}
					style={this.getItemStyle()}>
					{this.renderInsideItem()}
					{
						this.props.segmentLineItem.transitions && this.props.segmentLineItem.transitions.inTransition && this.props.segmentLineItem.transitions.inTransition.duration > 0 ? (
							<div className={ClassNames('segment-timeline__layer-item__transition', 'in', {
								'mix': this.props.segmentLineItem.transitions.inTransition.type === Transition.MIX,
								'wipe': this.props.segmentLineItem.transitions.inTransition.type === Transition.WIPE
							})}
								style={{
									'width': (this.props.segmentLineItem.transitions.inTransition.duration * this.props.timeScale).toString() + 'px'
								}} />
						) : null
					}
					{
						this.props.segmentLineItem.transitions && this.props.segmentLineItem.transitions.outTransition && this.props.segmentLineItem.transitions.outTransition.duration > 0 ? (
							<div className={ClassNames('segment-timeline__layer-item__transition', 'out', {
								'mix': this.props.segmentLineItem.transitions.outTransition.type === Transition.MIX,
								'wipe': this.props.segmentLineItem.transitions.outTransition.type === Transition.WIPE
							})}
								style={{
									'width': (this.props.segmentLineItem.transitions.outTransition.duration * this.props.timeScale).toString() + 'px'
								}} />
						) : null
					}
				</div>
			)

		} else { // render a placeholder

			this._placeHolderElement = true

			return (
				<div className='segment-timeline__layer-item'
					data-mos-id={this.props.segmentLineItem._id}
					ref={this.setRef}
					style={this.getItemStyle()}>
				</div>
			)

		}
	}
}
