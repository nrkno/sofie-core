import * as React from 'react'
import * as $ from 'jquery'

import { FloatingInspector } from '../../FloatingInspector'

import * as ClassNames from 'classnames'
import { CustomLayerItemRenderer, ISourceLayerItemProps } from './CustomLayerItemRenderer'

import { RunningOrderAPI } from '../../../../lib/api/runningOrder'
import { literal } from '../../../../lib/lib'
import { SplitsContent } from '../../../../lib/collections/SegmentLineItems'
import * as _ from 'underscore'
import { RundownUtils } from '../../../lib/rundown'

export enum SplitRole {
	ART = 0,
	BOX = 1
}

interface SplitSubItem {
	_id: string
	type: RunningOrderAPI.SourceLayerType
	label: string
	// TODO: To be replaced with the structure used by the Core
	role: SplitRole
	content?: any
}

export class SplitsSourceRenderer extends CustomLayerItemRenderer {
	subItems: Array<SplitSubItem>
	leftLabel: HTMLSpanElement
	rightLabel: HTMLSpanElement

	constructor (props) {
		super(props)

		this.subItems = this.rebuildSubItems()
	}

	componentWillUpdate () {
		this.subItems = this.rebuildSubItems()
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

	updateAnchoredElsWidths = () => {
		let leftLabelWidth = $(this.leftLabel).width() || 0
		let rightLabelWidth = $(this.rightLabel).width() || 0

		this.setAnchoredElsWidths(leftLabelWidth, rightLabelWidth)
	}

	componentDidUpdate (prevProps: Readonly<ISourceLayerItemProps>, prevState: Readonly<any>) {
		if (super.componentDidUpdate && typeof super.componentDidUpdate === 'function') {
			super.componentDidUpdate(prevProps, prevState)
		}

		if (this.props.segmentLineItem.name !== prevProps.segmentLineItem.name) {
			this.updateAnchoredElsWidths()
		}
	}

	rebuildSubItems = () => {
		const positions = [
			{
				x: 0.25,
				y: 0.5,
				scale: 0.5
			},
			{
				x: 0.75,
				y: 0.5,
				scale: 0.5
			}
		]

		if (this.props.segmentLineItem.content) {
			const splitContent = this.props.segmentLineItem.content as SplitsContent
			return _.map(splitContent.boxSourceConfiguration, (item, index) => {
				return literal<SplitSubItem>({
					_id: item.studioLabel + '_' + index,
					type: item.type,
					label: item.studioLabel,
					role: SplitRole.BOX,
					content: positions[index]
				})
			})
		}

		return []
	}

	renderSubItems () {
		return this.subItems.filter(i => i.role !== SplitRole.ART).reverse().map((item, index, array) => {
			return (
				<div key={'item-' + item._id}
					className={ClassNames(
						'segment-timeline__layer-item__preview__item',
						RundownUtils.getSourceLayerClassName(item.type),
						{
							'second': array.length > 1 && index > 0 && item.type === array[index - 1].type
						}
					)}>
				</div>
			)
		})
	}

	renderSplitPreview () {
		return (
			<div className='video-preview'>
				{
					this.subItems.map((item, index, array) => {
						return (
							<div className={ClassNames(
								'video-preview',
								RundownUtils.getSourceLayerClassName(item.type),
								{
									'background': item.role === SplitRole.ART,
									'box': item.role === SplitRole.BOX
								}, {
									'second': array.length > 1 && index > 0 && item.type === array[index - 1].type
								}
							)}
							key={item._id + '-preview'}
							style={{
								'left': ((item.content && item.content.x) * 100).toString() + '%',
								'top': ((item.content && item.content.y) * 100).toString() + '%',
								'width': ((item.content && item.content.scale) * 100).toString() + '%',
								'height': ((item.content && item.content.scale) * 100).toString() + '%'
							}}>
								{item.role === SplitRole.BOX && (
									<div className='video-preview__label'>{item.label}</div>
								)}
							</div>
						)
					})
				}
			</div>
		)
	}

	render () {
		let labelItems = this.props.segmentLineItem.name.split('||')
		let begin = labelItems[0] || ''
		let end = labelItems[1] || ''

		return <React.Fragment>
			<div className='segment-timeline__layer-item__preview'>
				{this.renderSubItems()}
			</div>
			<span className='segment-timeline__layer-item__label first-words overflow-label' ref={this.setLeftLabelRef} style={this.getItemLabelOffsetLeft()}>
				{begin}
			</span>
			<span className='segment-timeline__layer-item__label right-side' ref={this.setRightLabelRef} style={this.getItemLabelOffsetRight()}>
				<span className='segment-timeline__layer-item__label last-words'>{end}</span>
				{this.renderInfiniteIcon()}
				{this.renderOverflowTimeLabel()}
			</span>
			<FloatingInspector shown={this.props.showMiniInspector && this.props.itemElement !== undefined}>
				<div className='segment-timeline__mini-inspector segment-timeline__mini-inspector--video' style={this.getFloatingInspectorStyle()}>
					{this.renderSplitPreview()}
				</div>
			</FloatingInspector>
		</React.Fragment>
	}
}
