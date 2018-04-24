import * as React from 'react'
import * as ReactDOM from 'react-dom'

import { ISourceLayerUi, IOutputLayerUi, SegmentUi, SegmentLineUi, SegmentLineItemUi } from './SegmentTimelineContainer'

import { FloatingInspector } from '../../FloatingInspector'

import * as ClassNames from 'classnames'
import { CustomLayerItemRenderer } from './CustomLayerItemRenderer'

export class VTSourceRenderer extends CustomLayerItemRenderer {
	vPreview: HTMLVideoElement

	setVideoRef = (e: HTMLVideoElement) => {
		if (e) {
			this.vPreview = e
		}
	}

	updateTime = () => {
		if (this.vPreview) {
			let targetTime = Math.max(this.props.cursorPosition.left, 0) / this.props.timeScale
			let segmentLineItem = this.props.segmentLineItem
			let itemDuration = (segmentLineItem.duration || segmentLineItem.renderedDuration || segmentLineItem.expectedDuration)
			if (!Number.isFinite(itemDuration) && this.vPreview.duration > 0) {
				targetTime = targetTime % this.vPreview.duration
			}
			this.vPreview.currentTime = targetTime
		}
	}

	componentDidUpdate () {
		this.updateTime()
	}

	render () {
		let labelItems = this.props.segmentLineItem.name.split('||')
		let begin = labelItems[0] || ''
		let end = labelItems[1] || ''

		return [
			<span className='segment-timeline__layer-item__label' key={this.props.segmentLineItem._id + '-start'}>
				{begin}
			</span>,
			<span className='segment-timeline__layer-item__label last-words' key={this.props.segmentLineItem._id + '-finish'}>
				{end}
			</span>,
			<FloatingInspector key={this.props.segmentLineItem._id + '-inspector'} shown={this.props.showMiniInspector && this.props.itemElement !== undefined}>
				<div className='segment-timeline__mini-inspector segment-timeline__mini-inspector--video' style={this.getFloatingInspectorStyle()}>
					<video src='/segment0_vt_preview.mp4' ref={this.setVideoRef} />
				</div>
			</FloatingInspector>
		]
	}
}
