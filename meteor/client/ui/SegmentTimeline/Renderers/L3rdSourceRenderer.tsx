import * as React from 'react'
import * as _ from 'underscore'
import { getElementWidth } from '../../../utils/dimensions'
import { Time } from '../../../../lib/lib'
import { RundownUtils } from '../../../lib/rundown'
import Moment from 'react-moment'

import { PieceLifespan, NoraContent } from 'tv-automation-sofie-blueprints-integration'

import { FloatingInspector } from '../../FloatingInspector'

import { CustomLayerItemRenderer, ICustomLayerItemProps } from './CustomLayerItemRenderer'
import { withTranslation, WithTranslation } from 'react-i18next'
import { NoraPreviewController } from './NoraPreviewRenderer'

type KeyValue = { key: string; value: string }
interface IProps extends ICustomLayerItemProps {}
interface IState {}
export const L3rdSourceRenderer = withTranslation()(
	class L3rdSourceRenderer extends CustomLayerItemRenderer<IProps & WithTranslation, IState> {
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

		componentDidUpdate(prevProps: Readonly<IProps & WithTranslation>, prevState: Readonly<IState>) {
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
			const { t } = this.props

			const innerPiece = this.props.piece.instance.piece
			const noraContent = innerPiece.content as NoraContent | undefined

			let properties: Array<KeyValue> = []
			if (noraContent && noraContent.payload && noraContent.payload.content) {
				// @ts-ignore
				properties = _.compact(
					_.map(noraContent.payload.content, (value, key: string):
						| {
								key: string
								value: string
						  }
						| undefined => {
						let str: string
						if (key.startsWith('_') || key.startsWith('@') || value === '') {
							return undefined
						} else {
							if (_.isObject(value)) {
								// @ts-ignore
								str = JSON.stringify(value, '', 2)
							} else {
								str = value + ''
							}
							return {
								key: key,
								value: str,
							}
						}
					})
				) as Array<KeyValue>
			}

			let changed: Time | undefined = undefined
			if (noraContent && noraContent.payload && noraContent.payload.changed) {
				changed = noraContent.payload.changed
			}

			let templateName
			let templateVariant

			if (
				noraContent &&
				noraContent.payload &&
				noraContent.payload.metadata &&
				noraContent.payload.metadata.templateName
			) {
				templateName = noraContent.payload.metadata.templateName
			}

			if (
				noraContent &&
				noraContent.payload &&
				noraContent.payload.metadata &&
				noraContent.payload.metadata.templateVariant
			) {
				templateVariant = noraContent.payload.metadata.templateVariant
			}

			return (
				<React.Fragment>
					<span
						className="segment-timeline__piece__label"
						ref={this.setLeftLabelRef}
						style={this.getItemLabelOffsetLeft()}>
						<span className="segment-timeline__piece__label">{innerPiece.name}</span>
					</span>
					<span
						className="segment-timeline__piece__label right-side"
						ref={this.setRightLabelRef}
						style={this.getItemLabelOffsetRight()}>
						{this.renderInfiniteIcon()}
						{this.renderOverflowTimeLabel()}
					</span>
					<FloatingInspector
						key={this.props.piece.instance._id + '-inspector'}
						shown={this.props.showMiniInspector && this.props.itemElement !== undefined}>
						{noraContent && noraContent.payload && noraContent.previewRenderer ? (
							<NoraPreviewController noraContent={noraContent} style={this.getFloatingInspectorStyle()} />
						) : (
							<div
								className={'segment-timeline__mini-inspector ' + this.props.typeClass}
								style={this.getFloatingInspectorStyle()}>
								{templateName && (
									<div className="mini-inspector__header">
										{templateName}
										{templateVariant && <span className="mini-inspector__sub-header">{templateVariant}</span>}
									</div>
								)}
								<table>
									<tbody>
										{properties.map((item) => (
											<tr key={item.key}>
												<td className="mini-inspector__label">{item.key}</td>
												<td className="mini-inspector__value">{item.value}</td>
											</tr>
										))}
										<tr>
											<td className="mini-inspector__row--timing"></td>
											<td className="mini-inspector__row--timing">
												<span className="mini-inspector__in-point">
													{RundownUtils.formatTimeToShortTime(this.props.piece.renderedInPoint || 0)}
												</span>
												{innerPiece.lifespan ? (
													(innerPiece.lifespan === PieceLifespan.WithinPart && (
														<span className="mini-inspector__duration">{t('Until next take')}</span>
													)) ||
													(innerPiece.lifespan === PieceLifespan.OutOnSegmentChange && (
														<span className="mini-inspector__duration">{t('Until next segment')}</span>
													)) ||
													(innerPiece.lifespan === PieceLifespan.OutOnSegmentEnd && (
														<span className="mini-inspector__duration">{t('Until end of segment')}</span>
													)) ||
													(innerPiece.lifespan === PieceLifespan.OutOnRundownChange && (
														<span className="mini-inspector__duration">{t('Until next rundown')}</span>
													)) ||
													(innerPiece.lifespan === PieceLifespan.OutOnRundownEnd && (
														<span className="mini-inspector__duration">{t('Until end of rundown')}</span>
													))
												) : (
													<span className="mini-inspector__duration">
														{RundownUtils.formatTimeToShortTime(
															this.props.piece.renderedDuration ||
																(_.isNumber(innerPiece.enable.duration)
																	? parseFloat((innerPiece.enable.duration as any) as string)
																	: 0)
														)}
													</span>
												)}
												{changed && (
													<span className="mini-inspector__changed">
														<Moment date={changed} calendar={true} />
													</span>
												)}
											</td>
										</tr>
									</tbody>
								</table>
							</div>
						)}
					</FloatingInspector>
				</React.Fragment>
			)
		}
	}
)
