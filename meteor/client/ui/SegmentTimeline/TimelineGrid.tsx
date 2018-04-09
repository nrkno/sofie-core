import * as React from 'react'
import * as ReactDOM from 'react-dom'
import * as $ from 'jquery'
import * as _ from 'underscore'

interface ITimelineGridProps {
	timeScale: number
	scrollLeft: number
}
export class TimelineGrid extends React.Component<ITimelineGridProps> {
	canvasElement: HTMLCanvasElement
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

			let step = 30 * this.props.timeScale * this.pixelRatio

			this.ctx.clearRect(0, 0, this.width, this.height)

			for (let i = 0; i < this.width; i += step) {
				this.ctx.beginPath()
				this.ctx.moveTo(i, 0)
				this.ctx.lineTo(i, this.height)
				this.ctx.stroke()

				this.ctx.fillText((i / this.props.timeScale / this.pixelRatio).toString(), i, 10 * this.pixelRatio)
			}
		}
	}

	render () {
		return (
			<div className='segment-timeline__timeline-grid'>
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

			$(window).on('resize', this.onCanvasResize)
		}
	}

	componentDidUpdate () {
		console.log('TimelineGrid props changed, rerender the grid')

		this.repaint()
	}

	componentWillUnmount () {
		console.log('Detach resize notifiers')

		$(window).off('resize', this.onCanvasResize)
	}
}
