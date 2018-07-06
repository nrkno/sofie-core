import * as React from 'react'
import * as $ from 'jquery'

import { SegmentLineItemUi } from '../SegmentTimelineContainer'

import { FloatingInspector } from '../../FloatingInspector'

import * as ClassNames from 'classnames'
import { CustomLayerItemRenderer, ISourceLayerItemProps } from './CustomLayerItemRenderer'

import Lottie from 'react-lottie'
import { faPlay } from '@fortawesome/fontawesome-free-solid'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'
// @ts-ignore Not recognized by Typescript
import * as loopAnimation from './icon-loop.json'

export class VTSourceRenderer extends CustomLayerItemRenderer {
	vPreview: HTMLVideoElement
	leftLabel: HTMLSpanElement
	rightLabel: HTMLSpanElement
	begin: string
	end: string

	setVideoRef = (e: HTMLVideoElement) => {
		this.vPreview = e
	}

	setLeftLabelRef = (e: HTMLSpanElement) => {
		this.leftLabel = e
	}

	setRightLabelRef = (e: HTMLSpanElement) => {
		this.rightLabel = e
	}

	updateTime = () => {
		if (this.vPreview) {
			let targetTime = this.props.cursorTimePostion
			const segmentLineItem = this.props.segmentLineItem
			const itemDuration = (segmentLineItem.duration || segmentLineItem.renderedDuration || segmentLineItem.expectedDuration)
			if (!Number.isFinite(itemDuration) && this.vPreview.duration > 0) {
				targetTime = targetTime % (this.vPreview.duration * 1000)
			} else {
				targetTime = Math.min(targetTime, itemDuration)
			}
			this.vPreview.currentTime = targetTime / 1000
		}
	}

	componentDidMount () {
		this.updateAnchoredElsWidths()
	}

	updateAnchoredElsWidths = () => {
		let leftLabelWidth = $(this.leftLabel).width() || 0
		let rightLabelWidth = $(this.rightLabel).width() || 0

		this.setAnchoredElsWidths(leftLabelWidth, rightLabelWidth)
	}

	componentDidUpdate (prevProps: Readonly<ISourceLayerItemProps>, prevState: Readonly<any>) {
		if (super.componentDidUpdate && typeof super.componentDidUpdate === 'function') {
			super.componentDidUpdate(prevProps, prevState)
		}
		this.updateTime()

		if (this.props.segmentLineItem.name !== prevProps.segmentLineItem.name) {
			this.updateAnchoredElsWidths()
		}
	}

	render () {
		let labelItems = this.props.segmentLineItem.name.split('||')
		this.begin = labelItems[0] || ''
		this.end = labelItems[1] || ''

		const defaultOptions = {
			loop: true,
			autoplay: false,
			animationData: loopAnimation,
			rendererSettings: {
				preserveAspectRatio: 'xMidYMid slice'
			}
		}

		return <React.Fragment>
					<span className='segment-timeline__layer-item__label' ref={this.setLeftLabelRef} style={this.getItemLabelOffsetLeft()}>
						<span className={ClassNames('segment-timeline__layer-item__label', {
							'overflow-label': this.end !== ''
						})}>
							{this.begin}
						</span>
						{(this.begin && this.end === '' && (this.props.segmentLineItem as SegmentLineItemUi).content && (this.props.segmentLineItem as SegmentLineItemUi).content!.loop) &&
							(<div className='segment-timeline__layer-item__label label-icon'>
								<Lottie options={defaultOptions} width={24} height={16} isStopped={!this.props.showMiniInspector} isPaused={false} />
							</div>)
						}
					</span>
					<span className='segment-timeline__layer-item__label last-words' ref={this.setRightLabelRef} style={this.getItemLabelOffsetRight()}>
						{(this.end && (this.props.segmentLineItem as SegmentLineItemUi).content && (this.props.segmentLineItem as SegmentLineItemUi).content!.loop) &&
							(<div className='segment-timeline__layer-item__label label-icon'>
								<Lottie options={defaultOptions} width={24} height={16} isStopped={!this.props.showMiniInspector} isPaused={false} />
							</div>)
						}
						<span className='segment-timeline__layer-item__label last-words'>
							{this.end}
						</span>
						{(this.props.segmentLineItem.expectedDuration === 0) &&
							(<div className='segment-timeline__layer-item__label label-icon label-infinite-icon'>
								<FontAwesomeIcon icon={faPlay} />
							</div>)
						}
					</span>
					<FloatingInspector shown={this.props.showMiniInspector && this.props.itemElement !== undefined}>
						<div className='segment-timeline__mini-inspector segment-timeline__mini-inspector--video' style={this.getFloatingInspectorStyle()}>
							<video src='/segment0_vt_preview.mp4' ref={this.setVideoRef} />
						</div>
					</FloatingInspector>
				</React.Fragment>
	}
}
