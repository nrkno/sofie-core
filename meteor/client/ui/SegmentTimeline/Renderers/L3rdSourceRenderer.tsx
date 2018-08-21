import * as React from 'react'
import * as $ from 'jquery'
import * as _ from 'underscore'

import { FloatingInspector } from '../../FloatingInspector'

import { CustomLayerItemRenderer, ISourceLayerItemProps } from './CustomLayerItemRenderer'

type KeyValue = { key: string, value: string }

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
		const { t } = this.props

		let properties: Array<KeyValue> = []
		if (this.props.segmentLineItem.content && this.props.segmentLineItem.content.payload && this.props.segmentLineItem.content.payload.content) {
			// @ts-ignore
			properties = _.map(this.props.segmentLineItem.content.payload.content, (value: string, key: string): {
				key: string,
				value: string
			} => {
				return {
					key: key,
					value: value
				}
			}) as Array<KeyValue>
		}

		return <React.Fragment>
					<span className='segment-timeline__layer-item__label' ref={this.setLeftLabelRef} style={this.getItemLabelOffsetLeft()}>
						<span className='segment-timeline__layer-item__label'>
							{this.props.segmentLineItem.name}
						</span>
					</span>
					<span className='segment-timeline__layer-item__label right-side' ref={this.setRightLabelRef} style={this.getItemLabelOffsetRight()}>
						{this.renderInfiniteIcon()}
						{this.renderOverflowTimeLabel()}
					</span>
					<FloatingInspector key={this.props.segmentLineItem._id + '-inspector'} shown={this.props.showMiniInspector && this.props.itemElement !== undefined}>
						<div className='segment-timeline__mini-inspector' style={this.getFloatingInspectorStyle()}>
							{properties.length > 0 ? properties.map((item) => (
								<div>
									<span className='mini-inspector__label'>{item.key}: </span>
									<span className='mini-inspector__value'>{item.value}</span>
								</div>
						)) : <div><span className='mini-inspector__system'>{t('Item has no properties')}</span></div>}
						</div>
					</FloatingInspector>
				</React.Fragment>
	}
}
