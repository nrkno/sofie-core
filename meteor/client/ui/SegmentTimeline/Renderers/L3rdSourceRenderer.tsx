import * as React from 'react'
import { getElementWidth } from '../../../utils/dimensions'

import { CustomLayerItemRenderer, ICustomLayerItemProps } from './CustomLayerItemRenderer'
import { NoraContent, SourceLayerType } from '@sofie-automation/blueprints-integration'
import { L3rdFloatingInspector } from '../../FloatingInspectors/L3rdFloatingInspector'
import { RundownUtils } from '../../../lib/rundown'
import classNames from 'classnames'
import { PieceMultistepChevron } from '../../SegmentContainer/PieceMultistepChevron'

type IProps = ICustomLayerItemProps
interface IState {}
export class L3rdSourceRenderer extends CustomLayerItemRenderer<IProps, IState> {
	leftLabel: HTMLElement | null
	rightLabel: HTMLElement | null
	lastOverflowTime: boolean

	private updateAnchoredElsWidths = () => {
		const leftLabelWidth = this.leftLabel ? getElementWidth(this.leftLabel) : 0
		const rightLabelWidth = this.rightLabel ? getElementWidth(this.rightLabel) : 0

		this.setAnchoredElsWidths(leftLabelWidth, rightLabelWidth)
	}

	private setLeftLabelRef = (e: HTMLSpanElement) => {
		this.leftLabel = e
	}

	private setRightLabelRef = (e: HTMLSpanElement) => {
		this.rightLabel = e
	}

	componentDidMount(): void {
		this.updateAnchoredElsWidths()
	}

	componentDidUpdate(prevProps: Readonly<IProps>, prevState: Readonly<IState>): void {
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

	render(): JSX.Element {
		const innerPiece = this.props.piece.instance.piece
		const noraContent = innerPiece.content as NoraContent | undefined

		const stepContent = noraContent?.payload?.step
		const isMultiStep = stepContent?.enabled === true

		const multistepChevron = PieceMultistepChevron({
			className: 'segment-timeline__piece__step-chevron',
			piece: this.props.piece,
		})

		return (
			<React.Fragment>
				{!this.props.isTooSmallForText && (
					<>
						{!this.props.piece.hasOriginInPreceedingPart || this.props.isLiveLine ? (
							<span
								className={classNames('segment-timeline__piece__label', {
									mln: !!multistepChevron,
								})}
								ref={this.setLeftLabelRef}
								style={this.getItemLabelOffsetLeft()}
							>
								{multistepChevron}
								<span className="segment-timeline__piece__label">{innerPiece.name}</span>
							</span>
						) : null}
						<span
							className="segment-timeline__piece__label right-side overflow-label"
							ref={this.setRightLabelRef}
							style={this.getItemLabelOffsetRight()}
						>
							{this.renderInfiniteIcon()}
							{this.renderOverflowTimeLabel()}
						</span>
						{isMultiStep ? (
							<>
								<span className="segment-timeline__piece--collapsed__step-chevron"></span>
								<span className="segment-timeline__piece--decoration__step-chevron"></span>
							</>
						) : null}
					</>
				)}
				<L3rdFloatingInspector
					content={noraContent}
					typeClass={this.props.typeClass || RundownUtils.getSourceLayerClassName(SourceLayerType.LOWER_THIRD)}
					itemElement={this.props.itemElement}
					piece={this.props.piece.instance.piece}
					showMiniInspector={this.props.showMiniInspector}
					position={this.getFloatingInspectorStyle()}
					pieceRenderedDuration={this.props.piece.renderedDuration}
					pieceRenderedIn={this.props.piece.renderedInPoint}
				/>
			</React.Fragment>
		)
	}
}
