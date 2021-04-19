import * as React from 'react'
import * as _ from 'underscore'
import { getElementWidth } from '../../../utils/dimensions'

import { CustomLayerItemRenderer, ICustomLayerItemProps } from './CustomLayerItemRenderer'
import { NoraContent } from '@sofie-automation/blueprints-integration'
import { L3rdFloatingInspector } from '../../FloatingInspectors/L3rdFloatingInspector'

interface IProps extends ICustomLayerItemProps {}
interface IState {}
export class L3rdSourceRenderer extends CustomLayerItemRenderer<IProps, IState> {
	leftLabel: HTMLElement
	rightLabel: HTMLElement
	lastOverflowTime: boolean

	updateAnchoredElsWidths = () => {
		const leftLabelWidth = getElementWidth(this.leftLabel)
		const rightLabelWidth = getElementWidth(this.rightLabel)

		this.setAnchoredElsWidths(leftLabelWidth, rightLabelWidth)
	}

	setLeftLabelRef = (e: HTMLSpanElement) => {
		this.leftLabel = e
	}

	setRightLabelRef = (e: HTMLSpanElement) => {
		this.rightLabel = e
	}

	componentDidMount() {
		this.updateAnchoredElsWidths()
	}

	componentDidUpdate(prevProps: Readonly<IProps>, prevState: Readonly<IState>) {
		if (super.componentDidUpdate && typeof super.componentDidUpdate === 'function') {
			super.componentDidUpdate(prevProps, prevState)
		}

		const newOverflowTime = this.doesOverflowTime() > 0 ? true : false
		if (
			this.props.piece.instance.piece.name !== prevProps.piece.instance.piece.name ||
			newOverflowTime !== this.lastOverflowTime
		) {
			this.lastOverflowTime = newOverflowTime
			this.updateAnchoredElsWidths()
		}
	}

	render() {
		const innerPiece = this.props.piece.instance.piece
		const noraContent = innerPiece.content as NoraContent | undefined

		return (
			<React.Fragment>
				<span
					className="segment-timeline__piece__label"
					ref={this.setLeftLabelRef}
					style={this.getItemLabelOffsetLeft()}
				>
					<span className="segment-timeline__piece__label">{innerPiece.name}</span>
				</span>
				<span
					className="segment-timeline__piece__label right-side"
					ref={this.setRightLabelRef}
					style={this.getItemLabelOffsetRight()}
				>
					{this.renderInfiniteIcon()}
					{this.renderOverflowTimeLabel()}
				</span>
				<L3rdFloatingInspector
					content={noraContent}
					itemElement={this.props.itemElement}
					piece={this.props.piece.instance.piece}
					showMiniInspector={this.props.showMiniInspector}
					floatingInspectorStyle={this.getFloatingInspectorStyle()}
					pieceRenderedDuration={this.props.piece.renderedDuration}
					pieceRenderedIn={this.props.piece.renderedInPoint}
				/>
			</React.Fragment>
		)
	}
}
