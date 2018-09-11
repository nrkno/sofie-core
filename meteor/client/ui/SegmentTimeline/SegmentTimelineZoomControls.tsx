import * as elementResizeEvent from 'element-resize-event'
import * as React from 'react'
import * as ClassNames from 'classnames'
import * as $ from 'jquery'

interface IPropsHeader {
	scrollLeft: number
	scrollWidth: number
	segmentDuration: number
	liveLineHistorySize: number
	timeScale: number
	onScroll: (scrollLeft: number, event: MouseEvent) => void
	onZoomChange: (newScale: number, event: MouseEvent) => void
}

interface IStateHeader {
	zoomAreaMoving: boolean
	zoomAreaResizeEnd: boolean
	zoomAreaResizeBegin: boolean
	smallMode: boolean
	width: number
}

export const SegmentTimelineZoomControls = class extends React.Component<IPropsHeader, IStateHeader> {
	parentElement: HTMLDivElement
	selAreaElement: HTMLDivElement
	offsetX: number
	offsetY: number
	clickOffsetX: number
	clickOffsetY: number

	_isTouch: boolean = false

	SMALL_WIDTH_BREAKPOINT = 25

	constructor (props) {
		super(props)

		this.state = {
			zoomAreaMoving: false,
			zoomAreaResizeEnd: false,
			zoomAreaResizeBegin: false,
			smallMode: false,
			width: 1
		}
	}

	checkSmallMode = () => {
		let selAreaElementWidth = $(this.selAreaElement).width()
		// console.log(selAreaElementWidth)
		if (selAreaElementWidth && selAreaElementWidth < this.SMALL_WIDTH_BREAKPOINT) {
			this.setState({
				smallMode: true
			})
		} else {
			this.setState({
				smallMode: false
			})
		}
	}

	outsideZoomAreaClick = (e: JQueryMouseEventObject & any) => {
		let offset = $(this.parentElement).offset()
		if (offset) {
			this.offsetX = offset.left
			this.offsetY = offset.top
			// - (this.props.liveLineHistorySize * (this.props.segmentDuration / this.state.width))
			let seconds = (((e.clientX - this.offsetX) / this.state.width) * this.props.segmentDuration)
			seconds -= (this.props.liveLineHistorySize) / this.props.timeScale
			if (this.props.onScroll) {
				this.props.onScroll(Math.min(Math.max(0, seconds), this.props.segmentDuration), e)
			}

			e.preventDefault()
			e.stopPropagation()
		}
	}

	onElementResize = () => {
		this.setState({
			width: $(this.parentElement).width() || 1
		})
		this.checkSmallMode()
	}

	zoomAreaMove = (e: JQueryMouseEventObject | TouchEvent & any) => {
		let percent = 0

		if (this._isTouch) {
			const et = e as TouchEvent
			if (et.touches.length === 1) {
				percent = Math.max(0, Math.min(1, (et.touches[0].clientX - this.offsetX - this.clickOffsetX) / this.state.width))
			} else {
				this.zoomAreaEndMove(e) // cancel move if more touches than one
				return
			}
		} else {
			percent = Math.max(0, Math.min(1, (e.clientX - this.offsetX - this.clickOffsetX) / this.state.width))
		}
		// console.log(percent)
		if (this.props.onScroll) {
			this.props.onScroll(percent * this.props.segmentDuration, e)
		}
	}

	zoomAreaEndMove (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) {
		if (!this._isTouch) {
			$(document).off('mousemove', '', this.zoomAreaMove)
		} else {
			$(document).off('touchmove', '', this.zoomAreaMove)
		}

		this.setState({
			zoomAreaMoving: false
		})
		this.checkSmallMode()
	}

	zoomAreaBeginMove (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>, isTouch?: boolean) {
		this._isTouch = !!isTouch
		let clientX = 0
		let clientY = 0

		if (!this._isTouch) {
			$(document).on('mousemove', this.zoomAreaMove)
			$(document).one('mouseup', () => {
				this.zoomAreaEndMove(e)
			})

			clientX = (e as React.MouseEvent<HTMLDivElement>).clientX
			clientY = (e as React.MouseEvent<HTMLDivElement>).clientY
		} else {
			const et = e as React.TouchEvent<HTMLDivElement>
			if (et.touches.length === 1) {
				$(document).on('touchmove', this.zoomAreaMove)
				$(document).on('touchend', () => {
					this.zoomAreaEndMove(e)
				})

				clientX = et.touches[0].clientX
				clientY = et.touches[0].clientY
			} else {
				return
			}
		}

		let offset = $(this.parentElement).offset()
		let selAreaOffset = $(this.selAreaElement).offset()
		if (offset && selAreaOffset) {
			this.offsetX = offset.left
			this.offsetY = offset.top
			this.clickOffsetX = clientX - selAreaOffset.left
			this.clickOffsetY = clientY - selAreaOffset.top
		}
		this.setState({
			zoomAreaMoving: true
		})
	}

	zoomAreaLeftMove = (e: JQueryMouseEventObject & any) => {
		let begin = Math.max(0, Math.min(1, (e.clientX - this.offsetX) / this.state.width))
		let end = (this.props.scrollLeft + this.props.scrollWidth) / this.props.segmentDuration
		let newScale = this.props.scrollWidth / ((end - begin) * this.props.segmentDuration) * this.props.timeScale
		// console.log(this.props.scrollWidth, newScale)
		if (this.props.onZoomChange) {
			this.props.onScroll(begin * this.props.segmentDuration, e)
			this.props.onZoomChange(newScale, e)
		}
	}

	zoomAreaEndLeftMove (e: React.SyntheticEvent<HTMLDivElement>) {
		$(document).off('mousemove', '', this.zoomAreaLeftMove)
		this.setState({
			zoomAreaResizeBegin: false
		})
		this.checkSmallMode()
	}

	zoomAreaLeftBeginMove (e: JQueryMouseEventObject & any) {
		// console.log('Left handle')
		e.preventDefault()
		e.stopPropagation()

		$(document).on('mousemove', this.zoomAreaLeftMove)
		$(document).one('mouseup', () => {
			this.zoomAreaEndLeftMove(e)
		})
		let offset = $(this.parentElement).offset()
		if (offset) {
			this.offsetX = offset.left
			this.offsetY = offset.top
		}
		this.setState({
			zoomAreaResizeBegin: true
		})
	}

	zoomAreaEndRightMove (e: React.SyntheticEvent<HTMLDivElement>) {
		$(document).off('mousemove', '', this.zoomAreaRightMove)
		this.setState({
			zoomAreaResizeEnd: false
		})
		this.checkSmallMode()
	}

	zoomAreaRightMove = (e: JQueryMouseEventObject & any) => {
		let end = Math.max(0, Math.min(1, (e.clientX - this.offsetX) / this.state.width))
		let begin = this.props.scrollLeft / this.props.segmentDuration
		let newScale = this.props.scrollWidth / ((end - begin) * this.props.segmentDuration) * this.props.timeScale
		// console.log(this.props.scrollWidth, newScale)
		if (this.props.onZoomChange) {
			this.props.onZoomChange(newScale, e)
		}
	}

	zoomAreaRightBeginMove (e: JQueryMouseEventObject & any) {
		// console.log('Right handle')
		e.preventDefault()
		e.stopPropagation()

		$(document).on('mousemove', this.zoomAreaRightMove)
		$(document).one('mouseup', () => {
			this.zoomAreaEndRightMove(e)
		})
		let offset = $(this.parentElement).offset()
		if (offset) {
			this.offsetX = offset.left
			this.offsetY = offset.top
		}
		this.setState({
			zoomAreaResizeEnd: true
		})
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
						width: (Math.min(100, Math.max(0, this.props.scrollLeft / this.props.segmentDuration * 100))).toString() + '%'
					}}
					onDoubleClick={(e) => this.outsideZoomAreaClick(e)}>
				</div>
				<div className='segment-timeline__zoom-area__controls__right-mask'
					style={{
						width: (Math.min(100, Math.max(0, (1 - (this.props.scrollLeft + this.props.scrollWidth) / this.props.segmentDuration) * 100))).toString() + '%'
					}}
					onDoubleClick={(e) => this.outsideZoomAreaClick(e)}>
				</div>
				<div className={
						ClassNames('segment-timeline__zoom-area__controls__selected-area',
							{
								'small-mode': this.state.smallMode
							})
						}
					style={{
						left: (Math.max(this.props.scrollLeft / this.props.segmentDuration * 100, 0)).toString() + '%',
						width: (Math.min(this.props.scrollWidth / this.props.segmentDuration * 100, 100)).toString() + '%'
					}}
					ref={this.setSelAreaRef}
					onMouseDown={(e) => this.zoomAreaBeginMove(e)}
					onTouchStart={(e) => this.zoomAreaBeginMove(e, true)}
				>
					<div className='segment-timeline__zoom-area__controls__selected-area__left-handle'
						onMouseDown={(e) => this.zoomAreaLeftBeginMove(e)}>
					</div>
					<div className='segment-timeline__zoom-area__controls__selected-area__right-handle'
						onMouseDown={(e) => this.zoomAreaRightBeginMove(e)}>
					</div>
					<div className='segment-timeline__zoom-area__controls__selected-area__center-handle'>
					</div>
				</div>
			</div>
		)
	}
}
