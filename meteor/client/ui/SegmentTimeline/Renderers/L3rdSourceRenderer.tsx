import * as React from 'react'
import * as ReactDOM from 'react-dom'
import * as $ from 'jquery'

import { ISourceLayerUi, IOutputLayerUi, SegmentUi, SegmentLineUi, SegmentLineItemUi } from '../SegmentTimelineContainer'

import { FloatingInspector } from '../../FloatingInspector'

import * as ClassNames from 'classnames'
import { CustomLayerItemRenderer, ISourceLayerItemProps } from './CustomLayerItemRenderer'

export class L3rdSourceRenderer extends CustomLayerItemRenderer {
	label: HTMLElement

	updateAnchoredElsWidths = () => {
		let leftLabelWidth = $(this.label).width() || 0

		this.setAnchoredElsWidths(leftLabelWidth, 0)
	}

	setLabelRef = (e: HTMLSpanElement) => {
		this.label = e
	}

	componentDidMount () {
		this.updateAnchoredElsWidths()
	}

	componentDidUpdate (prevProps: Readonly<ISourceLayerItemProps>, prevState: Readonly<any>) {
		if (super.componentDidUpdate && typeof super.componentDidUpdate === 'function') {
			super.componentDidUpdate(prevProps, prevState)
		}

		if (this.props.segmentLineItem.name !== prevProps.segmentLineItem.name) {
			this.updateAnchoredElsWidths()
		}
	}

	render () {
		let labelItems = this.props.segmentLineItem.name.split('||')
		let begin = labelItems[0] || ''
		let end = labelItems[1] || ''

		return [
			<span className='segment-timeline__layer-item__label' key={this.props.segmentLineItem._id} ref={this.setLabelRef} style={this.getItemLabelOffsetLeft()}>
				<span className='segment-timeline__layer-item__label'>
					{begin}
				</span>
				<span className='segment-timeline__layer-item__label secondary'>
					{end}
				</span>
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
