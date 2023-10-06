import * as React from 'react'
import { getElementWidth } from '../../utils/dimensions'
import { getElementDocumentOffset } from '../../utils/positions'
import { onElementResize, offElementResize } from '../../lib/resizeObserver'
import { LeftArrow, RightArrow } from '../../lib/ui/icons/segment'
import { LIVELINE_HISTORY_SIZE } from './SegmentTimelineContainer'

interface IPropsHeader {
	scrollLeft: number
	scrollWidth: number
	segmentDuration: number
	liveLineHistorySize: number
	timeScale: number
	maxTimeScale: number
	onScroll: (scrollLeft: number, event: Event) => void
	onZoomChange: (newScale: number, event: Event) => void
}

interface IStateHeader {
	zoomAreaMoving: boolean
	zoomAreaResizeEnd: boolean
	zoomAreaResizeBegin: boolean
	smallMode: boolean
	width: number
}

export const SegmentTimelineZoomControls = class SegmentTimelineZoomControls extends React.Component<
	IPropsHeader,
	IStateHeader
> {
	parentElement: HTMLDivElement
	selAreaElement: HTMLDivElement
	parentOffsetX: number
	parentOffsetY: number
	clickOffsetX: number
	clickOffsetY: number

	private _isTouch: boolean = false
	private resizeObserver: ResizeObserver

	SMALL_WIDTH_BREAKPOINT = 25

	constructor(props: IPropsHeader) {
		super(props)

		this.state = {
			zoomAreaMoving: false,
			zoomAreaResizeEnd: false,
			zoomAreaResizeBegin: false,
			smallMode: false,
			width: 1,
		}
	}

	private checkSmallMode = () => {
		const selAreaElementWidth = getElementWidth(this.selAreaElement)

		if (selAreaElementWidth && selAreaElementWidth < this.SMALL_WIDTH_BREAKPOINT) {
			this.setState({
				smallMode: true,
			})
		} else {
			this.setState({
				smallMode: false,
			})
		}
	}

	private onElementResize = (entries: ResizeObserverEntry[]) => {
		let width: number
		if (entries && entries[0] && entries[0].contentRect) {
			width = entries[0].contentRect!.width
		} else {
			width = getElementWidth(this.parentElement)
		}

		this.setState({
			width: width || 1,
		})
		this.checkSmallMode()
	}

	private zoomAreaMove = (e: MouseEvent | TouchEvent) => {
		let delta = 0

		const maxScrollLeft = this.props.segmentDuration - LIVELINE_HISTORY_SIZE / this.props.timeScale

		if (this._isTouch) {
			const et = e as TouchEvent
			if (et.touches.length === 1) {
				delta = (et.touches[0].clientX - this.clickOffsetX) / this.state.width
				this.clickOffsetX = et.touches[0].clientX
			} else {
				this.zoomAreaEndMove() // cancel move if more touches than one
				return
			}
		} else {
			const em = e as MouseEvent
			delta = (em.clientX - this.clickOffsetX) / this.state.width
			this.clickOffsetX = em.clientX
		}
		if (this.props.onScroll) {
			this.props.onScroll(Math.max(0, this.props.scrollLeft + delta * maxScrollLeft), e)
		}
	}

	private zoomAreaEndMove() {
		if (!this._isTouch) {
			document.removeEventListener('mousemove', this.zoomAreaMove)
		} else {
			document.removeEventListener('touchmove', this.zoomAreaMove)
		}

		this.setState({
			zoomAreaMoving: false,
		})
		this.checkSmallMode()
	}

	private zoomAreaBeginMove(e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>, isTouch?: boolean) {
		this._isTouch = !!isTouch
		let clientX = 0
		let clientY = 0

		if (!this._isTouch) {
			document.addEventListener('mousemove', this.zoomAreaMove)
			document.addEventListener(
				'mouseup',
				() => {
					this.zoomAreaEndMove()
				},
				{ once: true }
			)

			clientX = (e as React.MouseEvent<HTMLDivElement>).clientX
			clientY = (e as React.MouseEvent<HTMLDivElement>).clientY
		} else {
			const et = e as React.TouchEvent<HTMLDivElement>
			if (et.touches.length === 1) {
				document.addEventListener('touchmove', this.zoomAreaMove)
				document.addEventListener('touchend', () => {
					this.zoomAreaEndMove()
				})

				clientX = et.touches[0].clientX
				clientY = et.touches[0].clientY
			} else {
				return
			}
		}

		const offset = getElementDocumentOffset(this.parentElement)
		const selAreaOffset = getElementDocumentOffset(this.selAreaElement)

		if (offset && selAreaOffset) {
			this.parentOffsetX = offset.left
			this.parentOffsetY = offset.top
			this.clickOffsetX = clientX
			this.clickOffsetY = clientY
		}
		this.setState({
			zoomAreaMoving: true,
		})
	}

	private setParentRef = (element: HTMLDivElement) => {
		this.parentElement = element
	}

	private setSelAreaRef = (element: HTMLDivElement) => {
		this.selAreaElement = element
	}

	componentDidMount(): void {
		this.resizeObserver = onElementResize(this.parentElement, this.onElementResize)
		this.setState({
			width: getElementWidth(this.parentElement) || 1,
		})
	}

	componentWillUnmount(): void {
		offElementResize(this.resizeObserver, this.parentElement)
	}

	render(): JSX.Element {
		const maxScrollLeft = this.props.segmentDuration - LIVELINE_HISTORY_SIZE / this.props.timeScale
		return (
			<div className="segment-timeline__zoom-area__controls" ref={this.setParentRef}>
				<div
					className="segment-timeline__zoom-area__controls__selected-area"
					style={{
						left: Math.max((this.props.scrollLeft / maxScrollLeft) * 100, 0).toString() + '%',
					}}
					ref={this.setSelAreaRef}
					onMouseDown={(e) => this.zoomAreaBeginMove(e)}
					onTouchStart={(e) => this.zoomAreaBeginMove(e, true)}
				>
					<LeftArrow className="segment-timeline__zoom-area__controls__selected-area__left-arrow" />
					<div className="segment-timeline__zoom-area__controls__selected-area__center-handle"></div>
					<RightArrow className="segment-timeline__zoom-area__controls__selected-area__right-arrow" />
				</div>
			</div>
		)
	}
}
