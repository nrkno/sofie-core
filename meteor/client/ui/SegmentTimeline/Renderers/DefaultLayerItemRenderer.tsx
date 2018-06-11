import * as React from 'react'
import * as $ from 'jquery'

import { FloatingInspector } from '../../FloatingInspector'

import * as ClassNames from 'classnames'
import { CustomLayerItemRenderer, ISourceLayerItemProps } from './CustomLayerItemRenderer'

export class DefaultLayerItemRenderer extends CustomLayerItemRenderer {
	leftLabel: HTMLSpanElement

	setLabelRef = (e: HTMLSpanElement) => {
		this.leftLabel = e
	}

	componentDidMount () {
		this.updateAnchoredElsWidths()
	}

	updateAnchoredElsWidths = () => {
		let leftLabelWidth = $(this.leftLabel).width() || 0

		this.setAnchoredElsWidths(leftLabelWidth, 0)
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
		return [
			<span key={this.props.segmentLineItem._id} className={
				ClassNames('segment-timeline__layer-item__label', {
					'bold': this.props.itemState === 0,
					'regular': this.props.itemState === 1,
					'light': this.props.itemState === 2,
					'light-file-missing': this.props.itemState === 3,
				})
			}
				ref={this.setLabelRef}
				style={this.getItemLabelOffsetLeft()}
			>{this.props.segmentLineItem.name}</span>,
			<FloatingInspector key={this.props.segmentLineItem._id + '-fi'} shown={this.props.showMiniInspector && this.props.itemElement !== null}>
				<div className='segment-timeline__mini-inspector' style={this.getFloatingInspectorStyle()}>
					Item properties
				</div>
			</FloatingInspector>
		]
	}
}
