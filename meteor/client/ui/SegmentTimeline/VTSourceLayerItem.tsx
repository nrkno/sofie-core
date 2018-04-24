import * as React from 'react'
import * as ReactDOM from 'react-dom'

import { ISourceLayerUi, IOutputLayerUi, SegmentUi, SegmentLineUi, SegmentLineItemUi } from './SegmentTimelineContainer'

import { FloatingInspector } from '../FloatingInspector'

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
	showMiniInspector: boolean
	itemElement: HTMLDivElement
	elementPosition: JQueryCoordinates
	cursorPosition: JQueryCoordinates
}
export class VTSourceLayerItem extends React.Component<ISourceLayerItemProps> {
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
			<span className='segment-timeline__layer-item__label bold' key={this.props.segmentLineItem._id + '-start'}>
				{begin}
			</span>,
			<span className='segment-timeline__layer-item__label last-words bold' key={this.props.segmentLineItem._id + '-finish'}>
				{end}
			</span>,
			<FloatingInspector key={this.props.segmentLineItem._id + '-inspector'} shown={this.props.showMiniInspector && this.props.itemElement !== undefined}>
				<div className='segment-timeline__mini-inspector segment-timeline__mini-inspector--video' style={{
					'left': (this.props.elementPosition.left + this.props.cursorPosition.left).toString() + 'px',
					'top': this.props.elementPosition.top + 'px'
				}}>
					<video src='/segment0_vt_preview.mp4' ref={this.setVideoRef} />
				</div>
			</FloatingInspector>
		]
	}
}
