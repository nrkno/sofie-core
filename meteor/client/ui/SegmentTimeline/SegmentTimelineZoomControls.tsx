import { Meteor } from 'meteor/meteor'
import * as elementResizeEvent from 'element-resize-event'
import * as React from 'react'
import * as ReactDOM from 'react-dom'

import * as _ from 'underscore'
import * as $ from 'jquery'

interface IPropsHeader {
	scrollLeft: number
	scrollWidth: number
	segmentDuration: number
	onScroll: (scrollLeft: number, event: MouseEvent) => void
}

interface IStateHeader {
	zoomAreaMoving: boolean
	width: number
}

export const SegmentTimelineZoomControls = class extends React.Component<IPropsHeader, IStateHeader> {
	parentElement: HTMLDivElement
	selAreaElement: HTMLDivElement
	offsetX: number
	offsetY: number
	clickOffsetX: number
	clickOffsetY: number

	constructor (props) {
		super(props)

		this.state = {
			zoomAreaMoving: false,
			width: 1
		}
	}

	zoomAreaMove = (e: JQueryMouseEventObject & any) => {
		let percent = Math.max(0, Math.min(1, (e.clientX - this.offsetX - this.clickOffsetX) / this.state.width))
		console.log(percent)
		if (this.props.onScroll) {
			this.props.onScroll(percent * this.props.segmentDuration, e)
		}
	}

	onElementResize = () => {
		this.setState({
			width: $(this.parentElement).width() || 1
		})
	}

	zoomAreaEndMove (e: React.SyntheticEvent<HTMLDivElement>) {
		$(document.body).off('mousemove', '', this.zoomAreaMove)
		this.setState({
			zoomAreaMoving: false
		})
	}

	zoomAreaBeginMove (e: React.SyntheticEvent<HTMLDivElement> & JQueryMouseEventObject | any) {
		// console.log(e.clientX)
		$(document.body).on('mousemove', this.zoomAreaMove)
		$(document.body).one('mouseup', () => {
			this.zoomAreaEndMove(e)
		})
		let offset = $(this.parentElement).offset()
		let selAreaOffset = $(this.selAreaElement).offset()
		if (offset && selAreaOffset) {
			this.offsetX = offset.left
			this.offsetY = offset.top
			this.clickOffsetX = e.clientX - selAreaOffset.left
			this.clickOffsetY = e.clientY - selAreaOffset.top
		}
		this.setState({
			zoomAreaMoving: true
		})
	}

	zoomAreaLeftBeginMove (e: any) {
		console.log('Left handle')
	}

	zoomAreaRightBeginMove (e: any) {
		console.log('Right handle')
	}

	setParentRef = (element: HTMLDivElement) => {
		this.parentElement = element
	}

	setSelAreaRef = (element: HTMLDivElement) => {
		this.selAreaElement = element
	}

	componentDidMount () {
		elementResizeEvent(this.parentElement, this.onElementResize)
		this.setState({
			width: $(this.parentElement).width() || 1
		})
	}

	componentWillUnmount () {
		elementResizeEvent.unbind(this.parentElement, this.onElementResize)
	}

	render () {
		return (
			<div className='segment-timeline__zoom-area__controls' ref={this.setParentRef}>
				<div className='segment-timeline__zoom-area__controls__left-mask'
					style={{
						width: (this.props.scrollLeft / this.props.segmentDuration * 100).toString() + '%'
					}}>
				</div>
				<div className='segment-timeline__zoom-area__controls__right-mask'
					style={{
						width: ((1 - (this.props.scrollLeft + this.props.scrollWidth) / this.props.segmentDuration) * 100).toString() + '%'
					}}>
				</div>
				<div className='segment-timeline__zoom-area__controls__selected-area'
					style={{
						left: (this.props.scrollLeft / this.props.segmentDuration * 100).toString() + '%',
						width: (this.props.scrollWidth / this.props.segmentDuration * 100).toString() + '%'
					}}
					ref={this.setSelAreaRef}
					onMouseDown={(e) => this.zoomAreaBeginMove(e)}
				>
					<div className='segment-timeline__zoom-area__controls__selected-area__left-handle'
						onMouseDown={(e) => this.zoomAreaLeftBeginMove(e)}
					>
					</div>
					<div className='segment-timeline__zoom-area__controls__selected-area__right-handle'
						onMouseDown={(e) => this.zoomAreaRightBeginMove(e)}>
					</div>
				</div>
			</div>
		)
	}
}
