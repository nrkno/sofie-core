import * as React from 'react'
import * as _ from 'underscore'

import { RundownUtils } from '../../lib/rundown'

import { Settings } from '../../../lib/Settings'
import { getElementWidth, getElementHeight } from '../../utils/dimensions'
import { onElementResize, offElementResize } from '../../lib/resizeObserver'

// We're cheating a little: Fontface
declare class FontFace {
	loaded: Promise<FontFace>
	constructor (font: string, url: string, options: object)

	load (): void
}

const GRID_FONT_URL = 'url("/fonts/roboto-gh-pages/fonts/Light/Roboto-Light.woff")'
const TIMELINE_GRID_LABEL_COLOR = 'rgb(175,175,175)'
const INNER_STEP_GRID_COLOR = 'rgb(112,112,112)'
const LARGE_STEP_GRID_COLOR = 'rgb(112,112,112)'

interface ITimelineGridProps {
	timeScale: number
	scrollLeft: number
	onResize: (size: number[]) => void
}

let gridFont: any | undefined = undefined
let gridFontAvailable: boolean = false

export class TimelineGrid extends React.Component<ITimelineGridProps> {
	canvasElement: HTMLCanvasElement
	parentElement: HTMLDivElement
	ctx: CanvasRenderingContext2D | null

	width: number
	height: number
	pixelRatio: number
	scheduledRepaint?: number | null

	private _resizeObserver: ResizeObserver

	contextResize = _.throttle((parentElementWidth: number, parentElementHeight: number) => {
		if (this.ctx) {
			let devicePixelRatio = window.devicePixelRatio || 1

			let backingStoreRatio = (this.ctx as any).webkitBackingStorePixelRatio ||
				(this.ctx as any).mozBackingStorePixelRatio ||
				(this.ctx as any).msBackingStorePixelRatio ||
				(this.ctx as any).oBackingStorePixelRatio ||
				(this.ctx as any).backingStorePixelRatio || 1

			this.pixelRatio = devicePixelRatio / backingStoreRatio

			this.width = (parentElementWidth || 0) * this.pixelRatio
			this.height = (parentElementHeight || 0) * this.pixelRatio
			this.canvasElement.width = this.width
			this.canvasElement.height = this.height

			this.repaint()
		}
		if (this.props.onResize) {
			this.props.onResize([parentElementWidth || 1, parentElementHeight || 1])
		}
	}, Math.ceil(1000 / 15)) // don't repaint faster than 15 fps

	setParentRef = (element: HTMLDivElement) => {
		this.parentElement = element
	}

	setCanvasRef = (element: HTMLCanvasElement) => {
		this.canvasElement = element
	}

	onCanvasResize = (entries: ResizeObserverEntry[]) => {
		if (entries && entries[0] && entries[0].contentBoxSize && entries[0].contentBoxSize.width !== undefined) {
			this.contextResize(entries[0].contentBoxSize!.width, entries[0].contentBoxSize!.height)
		} else if (entries && entries[0] && entries[0].contentRect && entries[0].contentRect.width !== undefined) {
			this.contextResize(entries[0].contentRect!.width, entries[0].contentRect!.height)
		} else {
			this.contextResize(getElementWidth(this.parentElement), getElementHeight(this.parentElement))
		}
	}

	ring (value, ringMax) {
		return (value < 0) ? (ringMax + (value % ringMax)) : value % ringMax
	}

	requestRepaint = () => {
		if (this.scheduledRepaint) {
			window.cancelAnimationFrame(this.scheduledRepaint)
		}
		this.scheduledRepaint = window.requestAnimationFrame(() => {
			this.scheduledRepaint = null
			this.repaint()
		})
	}

	clearRound = (a: number) => {
		return (Math.floor(a * 1000) / 1000)
	}

	repaint = () => {
		if (this.ctx) {
			this.ctx.lineCap = 'butt'
			this.ctx.lineWidth = 1
			this.ctx.font = (15 * this.pixelRatio).toString() + 'px GridTimecodeFont, Roboto, Arial, sans-serif'
			this.ctx.fillStyle = TIMELINE_GRID_LABEL_COLOR

			const fps = Settings.frameRate

			const secondTimeScale = this.props.timeScale * 1000

			// timeScale is how many pixels does a second take
			// secondsStep - draw the big, labeled line very X seconds
			let secondsStep = 5 * 60
			// interStep - draw X lines between every big line
			let interStep = 5
			if ((secondTimeScale > 0) && (secondTimeScale < 1)) {
				secondsStep = 600
				interStep = 60
			} else if ((secondTimeScale >= 1) && (secondTimeScale < 3)) {
				secondsStep = 300
				interStep = 10
			} else if ((secondTimeScale >= 3) && (secondTimeScale < 10)) {
				secondsStep = 30
				interStep = 10
			} else if ((secondTimeScale >= 10) && (secondTimeScale < 20)) {
				secondsStep = 10
				interStep = 10
			} else if ((secondTimeScale >= 20) && (secondTimeScale < 45)) {
				secondsStep = 5
				interStep = 5
			} else if ((secondTimeScale >= 45) && (secondTimeScale < 90)) {
				secondsStep = 2
				interStep = 2
			} else if ((secondTimeScale >= 90) && (secondTimeScale < 120)) {
				secondsStep = 2
				interStep = 1
			} else if ((secondTimeScale >= 120) && (secondTimeScale < 250)) {
				secondsStep = 1
				interStep = 1
			} else if ((secondTimeScale >= 250)) {
				secondsStep = 1
				interStep = fps || 25
			}

			let step = (secondsStep * secondTimeScale * this.pixelRatio) / interStep
			let pixelOffset = this.props.scrollLeft * this.props.timeScale * this.pixelRatio

			this.ctx.clearRect(0, 0, this.width, this.height)

			// We want to ensure that we draw at least n+1 (where n is the amount of ticks fitting on the display)
			// "large" ticks (one's with label), so we divide the display width by the amount of large steps (step / interStep)
			// and then after getting the ceil of the value, multiply it back for all the inter-steps,
			// beacuse we do the paint iteration for every line
			let maxTicks = Math.ceil(this.width / (step * interStep)) * interStep + (interStep)
			const scrollLeftSec = (this.props.scrollLeft / 1000)
			let base = Math.floor(scrollLeftSec / maxTicks) * maxTicks
			const baseN = (Math.floor(scrollLeftSec / maxTicks) + 1) * maxTicks

			// We store the x-position of the 0-th line to know if a particular section is N or N+1
			// and switch between base and baseN
			let breakX = 0

			// Go up to (width / step) + 1, to allow for the grid line + text, dissapearing on the left
			// in effect, we are rendering +1 grid lines than there should fit inside the area
			let i = 0
			for (i = 0; i < maxTicks; i++) {
				// we should offset the first step -1, as this is the one that will be dissaperaing as the
				// timeline is moving
				let xPosition = this.ring((i * step) - pixelOffset, maxTicks * step) - (step * interStep)
				if (i === 0) breakX = xPosition

				let isLabel = (i % interStep === 0)

				if (isLabel === true) {
					this.ctx.strokeStyle = LARGE_STEP_GRID_COLOR
					let t = ((xPosition > breakX) && (this.props.scrollLeft > 0) ? baseN : base) + (this.ring((i - interStep), maxTicks) * (secondsStep / interStep))

					this.ctx.fillText(
						RundownUtils.formatDiffToTimecode(t * 1000, false, false, true, false, true),
						xPosition, 18 * this.pixelRatio)
				} else {
					this.ctx.strokeStyle = INNER_STEP_GRID_COLOR
				}

				this.ctx.beginPath()
				this.ctx.moveTo(xPosition, isLabel ? (25 * this.pixelRatio) : (30 * this.pixelRatio))
				this.ctx.lineTo(xPosition, isLabel ? (this.height) : (36 * this.pixelRatio))
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
		// console.log('TimelineGrid mounted, render the grid & attach resize notifiers')
		this.ctx = this.canvasElement.getContext('2d', {
			// alpha: false
		})
		if (this.ctx) {
			const parentWidth = getElementWidth(this.parentElement)
			const parentHeight = getElementHeight(this.parentElement)
			this.contextResize(parentWidth, parentHeight)

			// $(window).on('resize', this.onCanvasResize)
			this._resizeObserver = onElementResize(this.parentElement, this.onCanvasResize)

			if (!gridFont && typeof FontFace !== 'undefined') {

				gridFont = new FontFace('GridTimecodeFont', GRID_FONT_URL, {
					style: 'normal',
					weight: 100
				})
				gridFont.load()
				gridFont.loaded.then((fontFace) => {
					// console.log('Grid font loaded: ' + fontFace.status)
					gridFontAvailable = true
					window.requestAnimationFrame(() => {
						this.repaint()
					})
				}).catch(err => console.log(err))
				document['fonts'].add(gridFont)
			} else if (gridFont && !gridFontAvailable) {
				gridFont.loaded.then((fontFace) => {
					window.requestAnimationFrame(() => {
						this.repaint()
					})
				})
			}

			if (this.props.onResize) {
				this.props.onResize([parentWidth || 1, parentHeight || 1])
			}
		}
	}

	shouldComponentUpdate (nextProps, nextState) {
		if ((nextProps.timeScale !== this.props.timeScale) || (nextProps.scrollLeft !== this.props.scrollLeft)) {
			return true
		}
		return false
	}

	componentDidUpdate () {
		this.requestRepaint()
	}

	componentWillUnmount () {
		// console.log('Detach resize notifiers')

		// $(window).off('resize', this.onCanvasResize)
		this._resizeObserver.disconnect()
	}
}
