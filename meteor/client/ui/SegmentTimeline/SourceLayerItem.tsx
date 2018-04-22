import * as React from 'react'
import * as ReactDOM from 'react-dom'
import * as _ from 'underscore'
import { ISourceLayerUi,
		 IOutputLayerUi,
		 SegmentUi,
		 SegmentLineUi,
		 SegmentLineItemUi } from './SegmentTimelineContainer'

import { RundownAPI } from './../../../lib/api/rundown'
import { Transition } from '../../../lib/constants/casparcg'

import * as ClassNames from 'classnames'

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
}
interface ISourceLayerItemState {
	itemState: number
}
export class SourceLayerItem extends React.Component<ISourceLayerItemProps, ISourceLayerItemState> {
	constructor (props) {
		super(props)
		this.state = {
			itemState: 0
		}
	}

	getItemStyle (): { [key: string]: string } {
		let segmentLineItem = this.props.segmentLineItem

		let inTransitionDuration = segmentLineItem.transitions && segmentLineItem.transitions.inTransition ? segmentLineItem.transitions.inTransition.duration : 0
		let outTransitionDuration = segmentLineItem.transitions && segmentLineItem.transitions.outTransition ? segmentLineItem.transitions.outTransition.duration : 0

		if (this.props.relative) {
			return {
				// as-run "duration" takes priority over renderdDuration which takes priority over MOS-import expectedDuration (editorial duration)
				'left': (((segmentLineItem.renderedInPoint || 0) + inTransitionDuration) / (this.props.totalSegmentLineDuration || 1) * 100).toString() + '%',
				'width': (((segmentLineItem.duration || segmentLineItem.renderedDuration || segmentLineItem.expectedDuration) - inTransitionDuration - outTransitionDuration) / (this.props.totalSegmentLineDuration || 1) * 100).toString() + '%'
			}
		} else {
			return {
				// as-run "duration" takes priority over renderdDuration which takes priority over MOS-import expectedDuration (editorial duration)
				'left': (((segmentLineItem.renderedInPoint || 0) + inTransitionDuration) * this.props.timeScale).toString() + 'px',
				'width': (((segmentLineItem.duration || segmentLineItem.renderedDuration || segmentLineItem.expectedDuration) - inTransitionDuration - outTransitionDuration) * this.props.timeScale).toString() + 'px'
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
				onClick={this.itemClick}
				onMouseUp={this.itemMouseUp}
				style={this.getItemStyle()}>
				<span className={
					ClassNames('segment-timeline__layer-item__label', {
						'bold': this.state.itemState === 0,
						'regular': this.state.itemState === 1,
						'light': this.state.itemState === 2,
						'light-file-missing': this.state.itemState === 3,
					})
				}
				>{this.props.segmentLineItem.name}</span>
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
