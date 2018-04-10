import * as React from 'react'
import * as ReactDOM from 'react-dom'
import * as _ from 'underscore'
import { ISourceLayerUi,
		 IOutputLayerUi,
		 SegmentUi,
		 SegmentLineUi,
		 SegmentLineItemUi } from './SegmentTimelineContainer'

interface ISourceLayerItemProps {
	layer: ISourceLayerUi
	outputLayer: IOutputLayerUi
	segment: SegmentUi
	segmentLine: SegmentLineUi
	segmentLineItem: SegmentLineItemUi
	timeScale: number
}
export class SourceLayerItem extends React.Component<ISourceLayerItemProps> {
	getItemStyle (): { [key: string]: string } {
		let segmentLineItem = this.props.segmentLineItem

		return {
			'width': ((segmentLineItem.duration || segmentLineItem.expectedDuration) * this.props.timeScale).toString() + 'px'
		}
	}

	render () {
		return (
			<div className='segment-timeline__layer-item' style={this.getItemStyle()}>
				<span className='segment-timeline__layer-item__label'>{this.props.segmentLineItem.name}</span>
			</div>
		)
	}
}
