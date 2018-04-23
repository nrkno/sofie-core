import * as React from 'react'
import * as ReactDOM from 'react-dom'
import * as _ from 'underscore'
import * as $ from 'jquery'
import { ISourceLayerUi,
		 IOutputLayerUi,
		 SegmentUi,
		 SegmentLineUi,
		 SegmentLineItemUi } from './SegmentTimelineContainer'

import * as FloatAffixed from 'react-float-affixed'

import { RundownAPI } from './../../../lib/api/rundown'
import { Transition } from '../../../lib/constants/casparcg'

import { FloatingInspector } from '../FloatingInspector'

import * as ClassNames from 'classnames'
import { MicSourceLayerItem } from './MicSourceLayerItem'
import { VTSourceLayerItem } from './VTSourceLayerItem'

interface ISourceLayerItemProps {
	layer: ISourceLayerUi
	outputLayer: IOutputLayerUi
	segment: SegmentUi
	segmentLine: SegmentLineUi
	segmentLineItem: SegmentLineItemUi
	timeScale: number
	onFollowLiveLine?: (state: boolean, event: any) => void
	relative?: boolean
	totalSegmentLineDuration?: number
	followLiveLine: boolean
	liveLineHistorySize: number
	livePosition: number | null
	outputGroupCollapsed: boolean
}
interface ISourceLayerItemState {
	itemState: number
	showMiniInspector: boolean
	elementPosition: JQueryCoordinates
	cursorPosition: JQueryCoordinates
}
export class SourceLayerItem extends React.Component<ISourceLayerItemProps, ISourceLayerItemState> {
	itemElement: HTMLDivElement

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
			}
		}
	}

	setRef = (e: HTMLDivElement) => {
		this.itemElement = e
	}

	getItemStyle (): { [key: string]: string } {
		let segmentLineItem = this.props.segmentLineItem

		let inTransitionDuration = segmentLineItem.transitions && segmentLineItem.transitions.inTransition ? segmentLineItem.transitions.inTransition.duration : 0
		let outTransitionDuration = segmentLineItem.transitions && segmentLineItem.transitions.outTransition ? segmentLineItem.transitions.outTransition.duration : 0

		let itemDuration = (segmentLineItem.duration || segmentLineItem.renderedDuration || segmentLineItem.expectedDuration)
		if (!Number.isFinite(itemDuration)) {
			itemDuration = (this.props.totalSegmentLineDuration || 0) - (segmentLineItem.renderedInPoint || 0)
		}

		if (this.props.relative) {
			return {
				// as-run "duration" takes priority over renderdDuration which takes priority over MOS-import expectedDuration (editorial duration)
				'left': (((segmentLineItem.renderedInPoint || 0) + inTransitionDuration) / (this.props.totalSegmentLineDuration || 1) * 100).toString() + '%',
				'width': ((itemDuration - inTransitionDuration - outTransitionDuration) / (this.props.totalSegmentLineDuration || 1) * 100).toString() + '%'
			}
		} else {
			return {
				// as-run "duration" takes priority over renderdDuration which takes priority over MOS-import expectedDuration (editorial duration)
				'left': (((segmentLineItem.renderedInPoint || 0) + inTransitionDuration) * this.props.timeScale).toString() + 'px',
				'width': ((itemDuration - inTransitionDuration - outTransitionDuration) * this.props.timeScale).toString() + 'px'
			}
		}
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

	toggleMiniInspector = (e: MouseEvent, v: boolean) => {
		this.setState({
			showMiniInspector: v
		})
		// console.log($(this.itemElement).offset())
		let elementPos = $(this.itemElement).offset() || {
			top: 0,
			left: 0
		}

		this.setState({
			elementPosition: elementPos,
			cursorPosition: {
				left: e.clientX - elementPos.left,
				top: e.clientY - elementPos.top
			}
		})
	}

	moveMiniInspector = (e: MouseEvent) => {
		this.setState({
			cursorPosition: _.extend(this.state.cursorPosition, {
				left: e.clientX - this.state.elementPosition.left,
				top: e.clientY - this.state.elementPosition.top
			})
		})
	}

	renderInsideItem () {
		switch (this.props.layer.type) {
			case RundownAPI.SourceLayerType.MIC:
				return <MicSourceLayerItem key={this.props.segmentLineItem._id} {...this.props} {...this.state} itemElement={this.itemElement} />
			case RundownAPI.SourceLayerType.VT:
				return <VTSourceLayerItem key={this.props.segmentLineItem._id} {...this.props} {...this.state} itemElement={this.itemElement} />
			default:
				return [
					<span key={this.props.segmentLineItem._id} className={
						ClassNames('segment-timeline__layer-item__label', {
							'bold': this.state.itemState === 0,
							'regular': this.state.itemState === 1,
							'light': this.state.itemState === 2,
							'light-file-missing': this.state.itemState === 3,
						})
					}
					>{this.props.segmentLineItem.name}</span>,
					<FloatingInspector key={this.props.segmentLineItem._id + '-fi'} shown={this.state.showMiniInspector && this.itemElement !== undefined}>
						<div className='segment-timeline__mini-inspector' style={{
							'left': (this.state.elementPosition.left + this.state.cursorPosition.left).toString() + 'px',
							'top': this.state.elementPosition.top.toString() + 'px'
						}}>
							Item properties
					</div>
					</FloatingInspector>
				]
		}
	}

	render () {
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

				'with-in-transition': this.props.segmentLineItem.transitions && this.props.segmentLineItem.transitions.inTransition && this.props.segmentLineItem.transitions.inTransition.duration > 0,
				'with-out-transition': this.props.segmentLineItem.transitions && this.props.segmentLineItem.transitions.outTransition && this.props.segmentLineItem.transitions.outTransition.duration > 0
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
	}
}
