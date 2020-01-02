import * as React from 'react'
import { getElementWidth } from '../../../utils/dimensions'

import { FloatingInspector } from '../../FloatingInspector'

import * as ClassNames from 'classnames'
import { CustomLayerItemRenderer, ICustomLayerItemProps } from './CustomLayerItemRenderer'

import { SourceLayerType, SplitsContent } from 'tv-automation-sofie-blueprints-integration'
import { literal } from '../../../../lib/lib'
import * as _ from 'underscore'
import { RundownUtils } from '../../../lib/rundown'

export enum SplitRole {
	ART = 0,
	BOX = 1
}

interface SplitSubItem {
	_id: string
	type: SourceLayerType
	label: string
	// TODO: To be replaced with the structure used by the Core
	role: SplitRole
	content?: any
}

interface IProps extends ICustomLayerItemProps {
}

interface IState {
	subItems: Array<SplitSubItem>
}

const DEFAULT_POSITIONS = [
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

export class SplitsSourceRenderer extends CustomLayerItemRenderer<IProps, IState> {
	leftLabel: HTMLSpanElement
	rightLabel: HTMLSpanElement

	constructor (props) {
		super(props)
		this.state = {
			subItems: _.map((props.piece.content as SplitsContent).boxSourceConfiguration, (item, index) => {
				return literal<SplitSubItem>({
					_id: item.studioLabel + '_' + index,
					type: item.type,
					label: item.studioLabel,
					role: SplitRole.BOX,
					content: item.geometry || DEFAULT_POSITIONS[index]
				})
			})
		}
	}

	static getDerivedStateFromProps (props: IProps): IState {


		let subItems: Array<SplitSubItem> = []
		if (props.piece.content) {
			const splitContent = props.piece.content as SplitsContent
			subItems = _.map(splitContent.boxSourceConfiguration, (item, index) => {
				return literal<SplitSubItem>({
					_id: item.studioLabel + '_' + index,
					type: item.type,
					label: item.studioLabel,
					role: SplitRole.BOX,
					content: item.geometry || DEFAULT_POSITIONS[index]
				})
			})
		}

		return {
			subItems: subItems
		}
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
		const leftLabelWidth = getElementWidth(this.leftLabel)
		const rightLabelWidth = getElementWidth(this.rightLabel)

		this.setAnchoredElsWidths(leftLabelWidth, rightLabelWidth)
	}

	componentDidUpdate (prevProps: Readonly<IProps>, prevState: Readonly<IState>) {
		if (super.componentDidUpdate && typeof super.componentDidUpdate === 'function') {
			super.componentDidUpdate(prevProps, prevState)
		}

		if (this.props.piece.name !== prevProps.piece.name) {
			this.updateAnchoredElsWidths()
		}
	}

	renderSubItems () {
		return this.state.subItems.filter(i => i.role !== SplitRole.ART).reverse().map((item, index, array) => {
			return (
				<div key={'item-' + item._id}
					className={ClassNames(
						'segment-timeline__piece__preview__item',
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
					this.state.subItems.reverse().map((item, index, array) => {
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
									'height': ((item.content && item.content.scale) * 100).toString() + '%',
									'clipPath': (item.content && item.content.crop) ? `inset(${item.content.crop.top * 100}% ${item.content.crop.right * 100}% ${item.content.crop.bottom * 100}% ${item.content.crop.left * 100}%)` : undefined
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
		let labelItems = this.props.piece.name.split('||')
		let begin = labelItems[0] || ''
		let end = labelItems[1] || ''

		return <React.Fragment>
			<div className='segment-timeline__piece__preview'>
				{this.renderSubItems()}
			</div>
			<span className='segment-timeline__piece__label first-words overflow-label' ref={this.setLeftLabelRef} style={this.getItemLabelOffsetLeft()}>
				{begin}
			</span>
			<span className='segment-timeline__piece__label right-side' ref={this.setRightLabelRef} style={this.getItemLabelOffsetRight()}>
				<span className='segment-timeline__piece__label last-words'>{end}</span>
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
