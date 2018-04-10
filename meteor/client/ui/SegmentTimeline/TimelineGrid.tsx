import * as elementResizeEvent from 'element-resize-event'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import * as $ from 'jquery'
import * as _ from 'underscore'

import { RundownUtils } from '../../lib/rundown'

interface ITimelineGridProps {
	timeScale: number
	scrollLeft: number
}
export class TimelineGrid extends React.Component<ITimelineGridProps> {
	canvasElement: HTMLCanvasElement
	parentElement: HTMLDivElement
	ctx: CanvasRenderingContext2D | null

	width: number
	height: number
	pixelRatio: number

	contextResize = _.throttle(() => {
		if (this.ctx) {
			let devicePixelRatio = window.devicePixelRatio || 1

			let backingStoreRatio = (this.ctx as any).webkitBackingStorePixelRatio ||
				(this.ctx as any).mozBackingStorePixelRatio ||
				(this.ctx as any).msBackingStorePixelRatio ||
				(this.ctx as any).oBackingStorePixelRatio ||
				(this.ctx as any).backingStorePixelRatio || 1

			this.pixelRatio = devicePixelRatio / backingStoreRatio

			this.width = ($(this.canvasElement).innerWidth() || 0) * this.pixelRatio
			this.height = ($(this.canvasElement).innerHeight() || 0) * this.pixelRatio
			this.canvasElement.width = this.width
			this.canvasElement.height = this.height

			this.repaint()
		}
	}, Math.ceil(1000 / 15)) // don't repaint faster than 15 fps

	setParentRef = (element: HTMLDivElement) => {
		this.parentElement = element
	}

	setCanvasRef = (element: HTMLCanvasElement) => {
		this.canvasElement = element
	}

	onCanvasResize = (event: JQuery.Event) => {
		console.log('Canvas possibly resized')

		this.contextResize()
	}

	repaint = () => {
		console.log('Repainting')

		if (this.ctx) {
			this.ctx.lineCap = 'butt'
			this.ctx.lineWidth = 1
			this.ctx.strokeStyle = 'rgb(200,200,200)'
			this.ctx.font = (10 * this.pixelRatio).toString() + 'px Ethica, Arial, sans-serif'
			this.ctx.fillStyle = 'rgb(0,0,0)'

			let secondsStep = 5 * 60
			if ((this.props.timeScale > 0) && (this.props.timeScale < 1)) {
				secondsStep = 90
			} else if ((this.props.timeScale >= 1) && (this.props.timeScale < 3)) {
				secondsStep = 60
			} else if ((this.props.timeScale >= 3) && (this.props.timeScale < 7)) {
				secondsStep = 30
			} else if ((this.props.timeScale >= 7) && (this.props.timeScale < 13)) {
				secondsStep = 10
			} else if ((this.props.timeScale >= 13) && (this.props.timeScale < 33)) {
				secondsStep = 5
			} else if ((this.props.timeScale >= 33)) {
				secondsStep = 2
			}

			let step = secondsStep * this.props.timeScale * this.pixelRatio

			this.ctx.clearRect(0, 0, this.width, this.height)

			for (let i = 0; i < this.width; i += step) {
				this.ctx.beginPath()
				this.ctx.moveTo(i, 0)
				this.ctx.lineTo(i, this.height)
				this.ctx.stroke()

				this.ctx.fillText(
					RundownUtils.formatTimeToTimecode(i / this.props.timeScale / this.pixelRatio)
					, i, 10 * this.pixelRatio)
			}
		}
	}

	render () {
		return (
			<div className='segment-timeline__timeline-grid' ref={this.setParentRef}>
				<canvas className='segment-timeline__timeline-grid__canvas' ref={this.setCanvasRef}></canvas>
			</div>
		)
	}

	componentDidMount () {
		console.log('TimelineGrid mounted, render the grid & attach resize notifiers')
		this.ctx = this.canvasElement.getContext('2d', {
			// alpha: false
		})
		if (this.ctx) {
			this.contextResize()

			// $(window).on('resize', this.onCanvasResize)
			elementResizeEvent(this.parentElement, this.onCanvasResize)
		}
	}

	componentDidUpdate () {
		console.log('TimelineGrid props changed, rerender the grid')

		this.repaint()
	}

	componentWillUnmount () {
		console.log('Detach resize notifiers')

		// $(window).off('resize', this.onCanvasResize)
		elementResizeEvent.unbind(this.parentElement, this.onCanvasResize)
	}
}
