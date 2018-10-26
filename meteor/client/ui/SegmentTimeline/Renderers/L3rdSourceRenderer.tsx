import * as React from 'react'
import * as $ from 'jquery'
import * as _ from 'underscore'
import { Time } from '../../../../lib/lib'
import { RundownUtils } from '../../../lib/rundown'
import Moment from 'react-moment'

import { SegmentLineItemLifespan, NoraContent } from '../../../../lib/collections/SegmentLineItems'

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

		const noraContent = this.props.segmentLineItem.content as NoraContent

		let properties: Array<KeyValue> = []
		if (noraContent && noraContent.payload && noraContent.payload.content) {
			// @ts-ignore
			properties = _.compact(_.map(noraContent.payload.content, (value, key: string): {
				key: string,
				value: string
			} | undefined => {
				let str: string
				if (key.startsWith('_')) {
					return
				} else {
					if (_.isObject(value)) {
						// @ts-ignore
						str = JSON.stringify(value, '', 2)
					} else {
						str = value + ''
					}
					return {
						key: key,
						value: str
					}
				}
			})) as Array<KeyValue>
		}

		let changed: Time | undefined = undefined
		if (noraContent && noraContent.payload && noraContent.payload.changed) {
			changed = noraContent.payload.changed
		}

		let templateName
		let templateVariant

		if (noraContent && noraContent.payload && noraContent.payload.metadata && noraContent.payload.metadata.templateName) {
			templateName = noraContent.payload.metadata.templateName
		}

		if (noraContent && noraContent.payload && noraContent.payload.metadata && noraContent.payload.metadata.templateVariant) {
			templateVariant = noraContent.payload.metadata.templateVariant
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
						<div className={'segment-timeline__mini-inspector ' + this.props.typeClass} style={this.getFloatingInspectorStyle()}>
							{ templateName && <div className='mini-inspector__header'>{templateName}{
								templateVariant && <span className='mini-inspector__sub-header'>{templateVariant}</span>
							}</div>}
							<table>
								<tbody>
									{properties.map((item) => (
										<tr key={item.key}>
											<td className='mini-inspector__label'>{item.key}</td>
											<td className='mini-inspector__value'>{item.value}</td>
										</tr>
									))}
									<tr>
										<td className='mini-inspector__row--timing'></td>
										<td className='mini-inspector__row--timing'>
											<span className='mini-inspector__in-point'>{RundownUtils.formatTimeToShortTime(this.props.segmentLineItem.renderedInPoint)}</span>
											{this.props.segmentLineItem.infiniteMode ?
												(
													(this.props.segmentLineItem.infiniteMode === SegmentLineItemLifespan.OutOnNextSegmentLine && <span className='mini-inspector__duration'>{t('Until next take')}</span>) ||
													(this.props.segmentLineItem.infiniteMode === SegmentLineItemLifespan.OutOnNextSegment && <span className='mini-inspector__duration'>{t('Until next segment')}</span>) ||
													(this.props.segmentLineItem.infiniteMode === SegmentLineItemLifespan.Infinite && <span className='mini-inspector__duration'>{t('Infinite')}</span>)
												)
												: <span className='mini-inspector__duration'>{RundownUtils.formatTimeToShortTime(this.props.segmentLineItem.renderedDuration || this.props.segmentLineItem.expectedDuration)}</span>
											}
											{changed && <span className='mini-inspector__changed'><Moment date={changed} calendar={true} /></span>}
										</td>
									</tr>
								</tbody>
							</table>
						</div>
					</FloatingInspector>
				</React.Fragment>
	}
}
