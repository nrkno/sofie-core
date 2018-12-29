import { ControllerAbstract, LONGPRESS_TIME } from './lib'
import { PrompterViewInner } from '../PrompterView'
import * as $ from 'jquery'

const LOCALSTORAGE_MODE = 'prompter-controller-mouseish'
/**
 * This class handles control of the prompter using a mouse-ish (or similar) device.
 * Definition of a Mouse-ish device:
 * It has a scroll-wheel and mouse-buttons
 * (and perhaps other custom-buttons / keyboard-keys as well)
 *
 * Switch Modes by pressing left & right mouse button simultaneously.
 * Mode 1 (normal scrolling):
 *    Use the scroll-wheel as you normally do to scroll the page
 * Mode 2: (speed control):
 *    Use the scroll-wheel to control the speed of scrolling
 *    Press (or hold) left mouse button to pause / continue scrolling
 *    Press and hold right mouse button to rewind
 */
export class MouseIshController extends ControllerAbstract {

	private _mode: Mode = Mode.NORMAL
	private _destroyed: boolean = false

	private _mouseKeyDown: {[button: string]: number} = {}

	/** scroll speed, in pixels per frame */
	private _scrollSpeedTarget: number = 0
	private _scrollSpeedCurrent: number = 0
	private _scrollingDown: boolean = false
	private _scrollingUp: boolean = false
	private _updateSpeedHandle: number | null = null
	private _scrollPosition: number = 0
	private _scrollRest: number = 0
	private _noMovement: number = 0

	constructor (view: PrompterViewInner) {
		super (view)

		// Recall mode:
		const recalledMode: string | null = localStorage.getItem(LOCALSTORAGE_MODE)
		this._mode = (
			recalledMode as Mode || Mode.NORMAL
		)
	}
	public destroy () {
		this._destroyed = true
	}
	public onKeyDown (e: KeyboardEvent) {
		// Nothing
		if (
			e.keyCode === 80 && // p
			e.ctrlKey
		) {
			e.preventDefault() // Prevent print-dialogue
		}
	}
	public onKeyUp (e: KeyboardEvent) {
		// Nothing
	}
	public onMouseKeyDown (e: MouseEvent) {

		if (this._mode === Mode.SPEED) {
			if (e.button === 0 || // left mouse button
				e.button === 1	// middle mouse button
			) {
				e.preventDefault()
				// this._scrollingPaused = !this._scrollingPaused
				this._scrollingDown = !this._scrollingDown
				this._scrollingUp = false
				this._updateScrollPosition()
			} else if (
				e.button === 2 // right mouse button
			) {
				e.preventDefault()
				this._scrollingUp = true
				// this._scrollingReverse = true
				this._updateScrollPosition()
			}
		}

		this._mouseKeyDown[e.button + ''] = Date.now()
	}
	public onMouseKeyUp (e: MouseEvent) {
		const timeSincePress = Date.now() - this._mouseKeyDown[e.button + '']

		if (this._mode === Mode.SPEED) {
			if (
				e.button === 0 || // left mouse button
				e.button === 1	// middle mouse button
			) {
				e.preventDefault()
				if (timeSincePress > LONGPRESS_TIME) {
					// Long-press release => toggle
					this._scrollingDown = !this._scrollingDown
					this._updateScrollPosition()
				}
			} else if (
				e.button === 2 // right mouse button
			) {
				e.preventDefault()
				this._scrollingUp = false
				// this._scrollingReverse = false
				this._updateScrollPosition()
			}
		}
		if (
			this._mouseKeyDown['0'] && // Left mouse button
			this._mouseKeyDown['2']	// Right mouse button
		) {
			// Switch mode
			this._toggleMode()
			e.preventDefault()
		}
		this._mouseKeyDown[e.button + ''] = 0
	}
	public onWheel (e: WheelEvent) {
		if (this._mode === Mode.NORMAL) {
			// Do nothing
		} else if (this._mode === Mode.SPEED) {
			e.preventDefault()

			const delta: number = e.deltaY || 0
			let delta2: number = Math.sign(delta) * Math.sqrt(Math.abs(delta) / 150)
			if (Math.sign(this._scrollSpeedTarget) < 0) {
				// Make scrolling up faster than down
				delta2 *= 2
			}
			this._scrollSpeedTarget += delta2

			this._scrollingDown = true

			this._updateScrollPosition()

		}
	}

	private _toggleMode () {
		if (this._mode === Mode.NORMAL) {
			this._setMode(Mode.SPEED)
			this._scrollSpeedTarget = 0
			this._scrollSpeedCurrent = 0
			this._scrollingDown = false
			this._scrollingUp = false

		// } else if (this._mode === Mode.SPEED) {
		// 	this._setMode(Mode.FLICK)

		} else {
			this._setMode(Mode.NORMAL)
		}
	}
	private _setMode (mode: Mode) {
		this._mode = mode
		console.log('Mouse-control: Switching mode to ' + mode)
		localStorage.setItem(LOCALSTORAGE_MODE, mode)
	}
	private _updateScrollPosition () {
		if (this._destroyed) return
		if (this._updateSpeedHandle !== null) return
		this._updateSpeedHandle = null
		if (this._mode !== Mode.SPEED) return

		let targetSpeed = this._scrollSpeedTarget

		if (this._scrollingUp) {
			targetSpeed = -Math.sign(targetSpeed) * Math.max(10, Math.abs(targetSpeed) * 4)
		} else if (this._scrollingDown) {
			targetSpeed = targetSpeed * 1
		} else {
			targetSpeed = 0
		}

		let ds: number = (targetSpeed - this._scrollSpeedCurrent)
		if (Math.abs(this._scrollSpeedCurrent) < Math.abs(targetSpeed)) {
			// Do it quicker when accelerating, to increate perceived latency:
			ds *= 0.2
		} else {
			ds *= 0.1
		}

		if (Math.abs(ds) > 0.1) {
			this._scrollSpeedCurrent += ds
		} else {
			this._scrollSpeedCurrent = targetSpeed
		}

		let speed = Math.round(this._scrollSpeedCurrent) // round because the scrolling is only done in full pizels anyway
		if (speed < 4) {
			// save the rest, in order to scroll veeery slowly (sub-pixels)
			this._scrollRest += Math.round((this._scrollSpeedCurrent - speed) * 6) / 6 // put the rest to use later
			const speedFromRest = Math.round(this._scrollRest)
			if (speedFromRest !== 0) {
				speed += speedFromRest
				this._scrollRest -= speedFromRest
			}
		} else {
			this._scrollRest = 0
		}

		window.scrollBy(0, speed)

		const scrollPosition = window.scrollY || window.pageYOffset || (document.documentElement || {scrollTop: undefined}).scrollTop

		if (scrollPosition !== undefined) {
			// Reached end-of-scroll:
			if (
				!this._scrollingUp // don't check if we're scrolling up
			) {
				if (
					(
						scrollPosition < 10 && // positioned at the top
						speed < -10 // only check if we have a significant speed
					) && (
						scrollPosition >= 10 && // positioned not at the top
						speed > 10 // only check if we have a significant speed
					) &&
					this._scrollPosition === scrollPosition
				) {
					// We tried to move, but haven't
					// Reset speeds:
					this._scrollSpeedCurrent = 0
					this._scrollSpeedTarget = 0
				}
				this._scrollPosition = scrollPosition
			}
		}
		if (speed === 0) {
			this._noMovement++
		} else {
			this._noMovement = 0
		}
		if (this._noMovement < 5) {
			this._updateSpeedHandle = window.requestAnimationFrame(() => {
				this._updateSpeedHandle = null
				this._updateScrollPosition()
			})
		}
	}

}
enum Mode {
	/** Normal scrolling */
	NORMAL = 'normal',
	/** Control the speed with the mouse wheel */
	SPEED = 'speed',
	/** Scroll a page up/down when flicking the wheel */
	// FLICK = 'flick',
}
