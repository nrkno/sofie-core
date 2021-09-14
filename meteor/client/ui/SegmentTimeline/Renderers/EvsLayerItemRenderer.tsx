import * as React from 'react'
import { getElementWidth } from '../../../utils/dimensions'
import { EvsContent } from '@sofie-automation/blueprints-integration'

import { CustomLayerItemRenderer, ICustomLayerItemProps } from './CustomLayerItemRenderer'
type IProps = ICustomLayerItemProps
interface IState { }

export class LocalLayerItemRenderer extends CustomLayerItemRenderer<IProps, IState> {
	leftLabel: HTMLSpanElement | null
	rightLabel: HTMLSpanElement | null

	constructor(props) {
		super(props)
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

	updateAnchoredElsWidths = () => {
		const leftLabelWidth = this.leftLabel ? getElementWidth(this.leftLabel) : 0
		const rightLabelWidth = this.rightLabel ? getElementWidth(this.rightLabel) : 0

		this.setAnchoredElsWidths(leftLabelWidth, rightLabelWidth)
	}

	componentDidUpdate(prevProps: Readonly<IProps>, prevState: Readonly<IState>) {
		if (super.componentDidUpdate && typeof super.componentDidUpdate === 'function') {
			super.componentDidUpdate(prevProps, prevState)
		}

		if (this.props.piece.instance.piece.name !== prevProps.piece.instance.piece.name) {
			this.updateAnchoredElsWidths()
		}
	}

	render() {
		const innerPiece = this.props.piece.instance.piece
		const { uiColorCode } = innerPiece.content as EvsContent

		return (
			!this.props.isTooSmallForText && (
				<>
					<span
						className="segment-timeline__piece__label"
						ref={this.setLeftLabelRef}
						style={this.getItemLabelOffsetLeft()}
					>
						<span className="segment-timeline__piece__label">
							{uiColorCode && (
								<span
									style={{ color: uiColorCode }}
									className="segment-timeline__piece__label segment-timeline__piece__label__colored-mark"
								>
									·
								</span>
							)}
							<span className="segment-timeline__piece__label">{this.props.piece.instance.piece.name}</span>
						</span>
					</span>
					<span
						className="segment-timeline__piece__label right-side"
						ref={this.setRightLabelRef}
						style={this.getItemLabelOffsetRight()}
					>
						{this.renderInfiniteIcon()}
						{this.renderOverflowTimeLabel()}
					</span>
				</>
			)
		)
	}
}
