import * as React from 'react'
import * as $ from 'jquery'

import { ISourceLayerItemProps } from './../SourceLayerItem'

import { FloatingInspector } from '../../FloatingInspector'

import { faPlay } from '@fortawesome/fontawesome-free-solid'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'

import { CustomLayerItemRenderer } from './CustomLayerItemRenderer'

export class MicSourceRenderer extends CustomLayerItemRenderer {

	itemPosition: number
	itemWidth: number
	itemElement: HTMLDivElement
	lineItem: JQuery<HTMLDivElement>
	linePosition: number
	leftLabel: HTMLSpanElement
	rightLabel: HTMLSpanElement

	private _forceSizingRecheck: boolean

	constructor (props) {
		super(props)
	}

	repositionLine = () => {
		this.lineItem.css('left', this.linePosition + 'px')
	}

	refreshLine = () => {
		if (this.itemElement) {
			this.itemPosition = $(this.itemElement).position().left || 0
			this.itemWidth = $(this.itemElement).outerWidth() || 0

			if (this.itemPosition + this.itemWidth !== this.linePosition) {
				this.linePosition = this.itemPosition + this.itemWidth
				this.repositionLine()
			}
		}
	}

	setLeftLabelRef = (e: HTMLSpanElement) => {
		this.leftLabel = e
	}

	setRightLabelRef = (e: HTMLSpanElement) => {
		this.rightLabel = e
	}

	componentWillReceiveProps (nextProps: ISourceLayerItemProps, nextContext: any) {
		if (super.componentWillReceiveProps && typeof super.componentWillReceiveProps === 'function') {
			super.componentWillReceiveProps(nextProps, nextContext)
		}

		if ((nextProps.segmentLineDuration !== this.props.segmentLineDuration) ||
			(nextProps.segmentLineItem.renderedInPoint !== this.props.segmentLineItem.renderedInPoint) ||
			(nextProps.segmentLineItem.renderedDuration !== this.props.segmentLineItem.renderedDuration) ||
			(nextProps.segmentLineItem.duration !== this.props.segmentLineItem.duration) ||
			(nextProps.segmentLineItem.expectedDuration !== this.props.segmentLineItem.expectedDuration) ||
			(nextProps.segmentLineItem.trigger !== this.props.segmentLineItem.trigger)) {
			this._forceSizingRecheck = true
		}
	}

	componentDidMount () {
		// Create line element
		this.lineItem = $('<div class="segment-timeline__layer-item-appendage script-line"></div>') as JQuery<HTMLDivElement>
		this.updateAnchoredElsWidths()
		if (this.props.itemElement) {
			this.itemElement = this.props.itemElement
			$(this.itemElement).parent().parent().append(this.lineItem)
			this.refreshLine()
		}
	}

	updateAnchoredElsWidths = () => {
		let leftLabelWidth = $(this.leftLabel).width() || 0
		let rightLabelWidth = $(this.rightLabel).width() || 0

		this.setAnchoredElsWidths(leftLabelWidth, rightLabelWidth)
	}

	componentDidUpdate (prevProps: Readonly<any>, prevState: Readonly<any>) {
		if (super.componentDidUpdate && typeof super.componentDidUpdate === 'function') {
			super.componentDidUpdate(prevProps, prevState)
		}

		// Move the line element
		if (this.itemElement !== this.props.itemElement) {
			if (this.itemElement) {
				this.lineItem.remove()
			}
			this.itemElement = this.props.itemElement
			$(this.itemElement).parent().parent().append(this.lineItem)
			this._forceSizingRecheck = true
		}
		if (this._forceSizingRecheck) {
			// Update sizing information
			this._forceSizingRecheck = false

			this.refreshLine()
		}

		if (this.props.segmentLineItem.name !== prevProps.segmentLineItem.name) {
			this.updateAnchoredElsWidths()
		}
	}

	componentWillUnmount () {
		// Remove the line element
		this.lineItem.remove()
	}

	render () {
		let labelItems = this.props.segmentLineItem.name.split('||')
		let begin = labelItems[0] || ''
		let end = labelItems[1] || ''

		return [
			<span className='segment-timeline__layer-item__label first-words overflow-label' ref={this.setLeftLabelRef} key={this.props.segmentLineItem._id + '-start'} style={this.getItemLabelOffsetLeft()}>
				{begin}
			</span>,
			<span className='segment-timeline__layer-item__label last-words' ref={this.setRightLabelRef} key={this.props.segmentLineItem._id + '-finish'} style={this.getItemLabelOffsetRight()}>
				<span className='segment-timeline__layer-item__label'>{end}</span>
				{(this.props.segmentLineItem.expectedDuration === 0) &&
					(<div className='segment-timeline__layer-item__label label-icon label-infinite-icon'>
						<FontAwesomeIcon icon={faPlay} />
					</div>)
				}
			</span>,
			<FloatingInspector key={this.props.segmentLineItem._id + '-inspector'}
				shown={this.props.showMiniInspector && this.props.itemElement !== undefined}>
				<div className='segment-timeline__mini-inspector' style={this.getFloatingInspectorStyle()}>
					Manus
				</div>
			</FloatingInspector>
		]
	}
}
