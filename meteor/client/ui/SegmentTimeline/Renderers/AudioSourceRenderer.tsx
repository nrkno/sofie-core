import * as React from 'react'
import ClassNames from 'classnames'
import { getElementWidth } from '../../../utils/dimensions'

import { CustomLayerItemRenderer, ICustomLayerItemProps } from './CustomLayerItemRenderer'
import { AudioFloatingInspector } from '../../FloatingInspectors/AudioFloatingInspector'
import { NoticeLevel, getNoticeLevelForPieceStatus } from '../../../../lib/notifications/notifications'
import { VTContent } from '@sofie-automation/blueprints-integration'
import { WithTranslation } from 'react-i18next'

type IProps = ICustomLayerItemProps
interface IState {
	noticeLevel: NoticeLevel | null
}

export class AudioSourceRenderer extends CustomLayerItemRenderer<IProps, IState> {
	leftLabel: HTMLSpanElement | null
	rightLabel: HTMLSpanElement | null

	constructor(props: IProps & WithTranslation) {
		super(props)
		this.state = {
			noticeLevel: getNoticeLevelForPieceStatus(props.piece.contentStatus?.status),
		}
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

	private updateAnchoredElsWidths = () => {
		const leftLabelWidth = this.leftLabel ? getElementWidth(this.leftLabel) : 0
		const rightLabelWidth = this.rightLabel ? getElementWidth(this.rightLabel) : 0

		this.setAnchoredElsWidths(leftLabelWidth, rightLabelWidth)
	}

	componentDidUpdate(prevProps: Readonly<IProps>, prevState: Readonly<IState>): void {
		if (super.componentDidUpdate && typeof super.componentDidUpdate === 'function') {
			super.componentDidUpdate(prevProps, prevState)
		}

		if (this.props.piece.instance.piece.name !== prevProps.piece.instance.piece.name) {
			this.updateAnchoredElsWidths()
		}

		const innerPiece = this.props.piece.instance.piece
		const newState: Partial<IState> = {}
		if (
			innerPiece.name !== prevProps.piece.instance.piece.name ||
			this.props.piece.contentStatus?.status !== prevProps.piece.contentStatus?.status
		) {
			newState.noticeLevel = getNoticeLevelForPieceStatus(this.props.piece.contentStatus?.status)
		}

		if (Object.keys(newState).length > 0) {
			this.setState(newState as IState, () => {
				if (newState.noticeLevel && newState.noticeLevel !== prevState.noticeLevel) {
					this.updateAnchoredElsWidths()
				}
			})
		}
	}

	render(): JSX.Element | false {
		const label = this.props.piece.instance.piece.name
		const duration = this.renderDuration()
		const vtContent = this.props.piece.instance.piece.content as VTContent | undefined

		return (
			!this.props.isTooSmallForText && (
				<>
					{!this.props.piece.hasOriginInPreceedingPart || this.props.isLiveLine ? (
						<span
							className="segment-timeline__piece__label"
							ref={this.setLeftLabelRef}
							style={this.getItemLabelOffsetLeft()}
						>
							<span
								className={ClassNames('segment-timeline__piece__label', {
									'with-duration': !!duration,
									[`with-duration--${this.getSourceDurationLabelAlignment()}`]: !!duration,
								})}
							>
								{duration ? (
									<>
										<span>{label}</span>
										{duration}
									</>
								) : (
									label
								)}
							</span>
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
					<AudioFloatingInspector
						status={this.props.piece.contentStatus?.status}
						position={this.getFloatingInspectorStyle()}
						content={vtContent}
						itemElement={this.props.itemElement}
						noticeLevel={this.state.noticeLevel}
						showMiniInspector={this.props.showMiniInspector}
						typeClass={this.props.typeClass}
						noticeMessages={this.props.piece.contentStatus?.messages || []}
						thumbnailUrl={this.props.piece.contentStatus?.thumbnailUrl}
					/>
				</>
			)
		)
	}
}
