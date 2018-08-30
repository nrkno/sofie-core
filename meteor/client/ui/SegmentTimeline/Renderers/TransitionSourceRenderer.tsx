import * as React from 'react'
import * as $ from 'jquery'
import * as _ from 'underscore'

import { TransitionContent } from '../../../../lib/collections/SegmentLineItems'

import { CustomLayerItemRenderer, ISourceLayerItemProps } from './CustomLayerItemRenderer'

type KeyValue = { key: string, value: string }

export class TransitionSourceRenderer extends CustomLayerItemRenderer<ISourceLayerItemProps> {
	leftLabel: HTMLElement
	rightLabel: HTMLElement

	updateAnchoredElsWidths = () => {
		let leftLabelWidth = $(this.leftLabel).width() || 0

		this.setAnchoredElsWidths(leftLabelWidth, 0)
	}

	setLeftLabelRef = (e: HTMLSpanElement) => {
		this.leftLabel = e
	}

	componentDidMount () {
		this.updateAnchoredElsWidths()
	}

	iconFailed = () => {
		this.setState({
			iconFailed: true
		})
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
		const content = this.props.segmentLineItem.content as TransitionContent
		return <React.Fragment>
					<span className='segment-timeline__layer-item__label' ref={this.setLeftLabelRef} style={this.getItemLabelOffsetLeft()}>
						<span className='segment-timeline__layer-item__label'>
							{this.props.segmentLineItem.name}
							{content && content.icon && !this.state.iconFailed &&
								<img src={'/transition-icons/' + content.icon + '.svg'} className='segment-timeline__layer-item__label__transition-icon' onError={this.iconFailed} />
							}
						</span>
					</span>
				</React.Fragment>
	}
}
