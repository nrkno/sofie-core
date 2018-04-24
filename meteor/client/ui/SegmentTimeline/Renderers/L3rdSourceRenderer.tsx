
import * as React from 'react'
import * as ReactDOM from 'react-dom'

import { ISourceLayerUi, IOutputLayerUi, SegmentUi, SegmentLineUi, SegmentLineItemUi } from './SegmentTimelineContainer'

import { FloatingInspector } from '../../FloatingInspector'

import * as ClassNames from 'classnames'
import { CustomLayerItemRenderer } from './CustomLayerItemRenderer'

export class L3rdSourceRenderer extends CustomLayerItemRenderer {
	render () {
		let labelItems = this.props.segmentLineItem.name.split('||')
		let begin = labelItems[0] || ''
		let end = labelItems[1] || ''

		return [
			<span className='segment-timeline__layer-item__label' key={this.props.segmentLineItem._id + '-start'}>
				{begin}
			</span>,
			<span className='segment-timeline__layer-item__label secondary' key={this.props.segmentLineItem._id + '-finish'}>
				{end}
			</span>,
			<FloatingInspector key={this.props.segmentLineItem._id + '-inspector'} shown={this.props.showMiniInspector && this.props.itemElement !== undefined}>
				<div className='segment-timeline__mini-inspector' style={this.getFloatingInspectorStyle()}>
					<div>Name: {begin}</div>
					<div>Title: {end}</div>
				</div>
			</FloatingInspector>
		]
	}
}
