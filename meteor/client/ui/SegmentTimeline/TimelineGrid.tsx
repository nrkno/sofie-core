import * as elementResizeEvent from 'element-resize-event'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import * as $ from 'jquery'
import * as _ from 'underscore'

import { RundownUtils } from '../../lib/rundown'

import { Settings } from '../../../lib/Settings'

const GRID_FONT_URL = 'url("/origo-ui/fonts/roboto-bold-webfont.woff")'

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

	ring (value, ringMax) {
		return (value < 0) ? (ringMax + (value % ringMax)) : value % ringMax
	}

	repaint = () => {
		if (this.ctx) {
			this.ctx.lineCap = 'butt'
			this.ctx.lineWidth = 1
			this.ctx.strokeStyle = 'rgb(200,200,200)'
			this.ctx.font = (10 * this.pixelRatio).toString() + 'px GridTimecodeFont, Roboto, Arial, sans-serif'
			this.ctx.fillStyle = 'rgb(0,0,0)'

			// timeScale is how many pixels does a second take
			// secondsStep - draw the big, labeled line very X seconds
			let secondsStep = 5 * 60
			// interStep - drax X lines between every big line
			let interStep = 5
			if ((this.props.timeScale > 0) && (this.props.timeScale < 1)) {
				secondsStep = 90
				interStep = 3
			} else if ((this.props.timeScale >= 1) && (this.props.timeScale < 3)) {
				secondsStep = 60
				interStep = 10
			} else if ((this.props.timeScale >= 3) && (this.props.timeScale < 7)) {
				secondsStep = 30
				interStep = 10
			} else if ((this.props.timeScale >= 7) && (this.props.timeScale < 13)) {
				secondsStep = 10
				interStep = 10
			} else if ((this.props.timeScale >= 13) && (this.props.timeScale < 33)) {
				secondsStep = 5
				interStep = 5
			} else if ((this.props.timeScale >= 33) && (this.props.timeScale < 120)) {
				secondsStep = 2
				interStep = 2
			} else if ((this.props.timeScale >= 120)) {
				secondsStep = 1
				interStep = Settings['frameRate'] || 25
			}

			let step = (secondsStep * this.props.timeScale * this.pixelRatio) / interStep
			let pixelOffset = this.props.scrollLeft * this.props.timeScale * this.pixelRatio

			this.ctx.clearRect(0, 0, this.width, this.height)

			// We want to ensure that we draw at least n+1 (where n is the amount of ticks fitting on the display)
			// "large" ticks (one's with label), so we divide the display width by the amount of large steps (step / interStep)
			// and then after getting the ceil of the value, multiply it back for all the inter-steps,
			// beacuse we do the paint iteration for every line
			let maxTicks = (Math.ceil(this.width / (step / interStep)) * interStep)

			// Go up to (width / step) + 1, to allow for the grid line + text, dissapearing on the left
			// in effect, we are rendering +1 grid lines than there should fit inside the area
			for (let i = 0; i < maxTicks; i++) {
				// we should offset the first step -1, as this is the one that will be dissaperaing as the
				// timeline is moving
				let xPosition = this.ring((i * step) - pixelOffset, maxTicks * step) - (pixelOffset > 0 ? (step * interStep) : 0)

				let isLabel = (i % interStep === 0)

				if (isLabel === true) {
					this.ctx.strokeStyle = 'rgb(120,120,120)'

					this.ctx.fillText(
						RundownUtils.formatTimeToTimecode((xPosition + pixelOffset) / (step * interStep / secondsStep)),
						xPosition, 10 * this.pixelRatio)
				} else {
					this.ctx.strokeStyle = 'rgb(220,220,220)'
				}

				this.ctx.beginPath()
				this.ctx.moveTo(xPosition, isLabel ? (10 * this.pixelRatio) : (15 * this.pixelRatio))
				this.ctx.lineTo(xPosition, this.height)
				this.ctx.stroke()
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

			if (typeof FontFace !== 'undefined') {
				console.log('Loading grid font')
				let ethicaFont = new FontFace('GridTimecodeFont', GRID_FONT_URL, {
					style: 'normal',
					weight: 400
				})
				ethicaFont.load()
				ethicaFont.loaded.then((fontFace) => {
					console.log('Grid font loaded: ' + fontFace.status)
					window.requestAnimationFrame(() => {
						this.repaint()
					})
				}, (fontFace) => {
					console.log('Grid font failed to load: ' + fontFace.status)
				})
				document.fonts.add(ethicaFont)
			}
		}
	}

	componentDidUpdate () {
		this.repaint()
	}

	componentWillUnmount () {
		console.log('Detach resize notifiers')

		// $(window).off('resize', this.onCanvasResize)
		elementResizeEvent.unbind(this.parentElement, this.onCanvasResize)
	}
}
