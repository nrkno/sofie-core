import * as React from 'react'
import * as $ from 'jquery'

import { FloatingInspector } from '../../FloatingInspector'

import * as ClassNames from 'classnames'
import { CustomLayerItemRenderer, ICustomLayerItemProps } from './CustomLayerItemRenderer'
interface IProps extends ICustomLayerItemProps {
	itemState: number
}
interface IState {
}
export class DefaultLayerItemRenderer extends CustomLayerItemRenderer<IProps, IState> {
	leftLabel: HTMLSpanElement
	rightLabel: HTMLSpanElement

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

	componentDidUpdate (prevProps: Readonly<IProps>, prevState: Readonly<IState>) {
		if (super.componentDidUpdate && typeof super.componentDidUpdate === 'function') {
			super.componentDidUpdate(prevProps, prevState)
		}

		if (this.props.segmentLineItem.name !== prevProps.segmentLineItem.name) {
			this.updateAnchoredElsWidths()
		}
	}

	render () {
		return <React.Fragment>
			<span className={
				ClassNames('segment-timeline__layer-item__label', {
					'bold': this.props.itemState === 0,
					'regular': this.props.itemState === 1,
					'light': this.props.itemState === 2,
					'light-file-missing': this.props.itemState === 3,
				})
			}
				ref={this.setLeftLabelRef}
				style={this.getItemLabelOffsetLeft()}
			>
				<span className='segment-timeline__layer-item__label'>
					{this.props.segmentLineItem.name}
				</span>
			</span>
			<span className='segment-timeline__layer-item__label right-side'
				ref={this.setRightLabelRef}
				style={this.getItemLabelOffsetRight()}
			>
				{this.renderInfiniteIcon()}
				{this.renderOverflowTimeLabel()}
			</span>
			{ /* <FloatingInspector shown={this.props.showMiniInspector && this.props.itemElement !== null}>
				<div className='segment-timeline__mini-inspector' style={this.getFloatingInspectorStyle()}>
					Item properties
				</div>
			</FloatingInspector> */ }
		</React.Fragment>
	}
}
