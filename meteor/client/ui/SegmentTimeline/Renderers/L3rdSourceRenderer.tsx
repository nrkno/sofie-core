import * as React from 'react'
import * as $ from 'jquery'

import { FloatingInspector } from '../../FloatingInspector'

import { CustomLayerItemRenderer, ISourceLayerItemProps } from './CustomLayerItemRenderer'

export class L3rdSourceRenderer extends CustomLayerItemRenderer {
	leftLabel: HTMLElement
	rightLabel: HTMLElement

	updateAnchoredElsWidths = () => {
		let leftLabelWidth = $(this.leftLabel).width() || 0
		let rightLabelWidth = $(this.rightLabel).width() || 0

		this.setAnchoredElsWidths(leftLabelWidth, rightLabelWidth)
	}

	setLeftLabelRef = (e: HTMLSpanElement) => {
		this.leftLabel = e
	}

	setRightLabelRef = (e: HTMLSpanElement) => {
		this.rightLabel = e
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

		return <React.Fragment>
					<span className='segment-timeline__layer-item__label' ref={this.setLeftLabelRef} style={this.getItemLabelOffsetLeft()}>
						<span className='segment-timeline__layer-item__label'>
							{begin}
						</span>
					</span>
					<span className='segment-timeline__layer-item__label right-side' ref={this.setRightLabelRef} style={this.getItemLabelOffsetRight()}>
						{this.renderInfiniteIcon()}
						{this.renderOverflowTimeLabel()}
					</span>
					<FloatingInspector key={this.props.segmentLineItem._id + '-inspector'} shown={this.props.showMiniInspector && this.props.itemElement !== undefined}>
						<div className='segment-timeline__mini-inspector' style={this.getFloatingInspectorStyle()}>
							<div>Name: {begin}</div>
							<div>Title: {end}</div>
						</div>
					</FloatingInspector>
				</React.Fragment>
	}
}
