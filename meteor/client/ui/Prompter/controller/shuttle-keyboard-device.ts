import { ControllerAbstract, LONGPRESS_TIME } from './lib'
import { PrompterViewInner } from '../PrompterView'

const LOCALSTORAGE_MODE = 'prompter-controller-arrowkeys'

/**
 * This class handles control of the prompter using Keyboard keys sent from a contour shuttle
 * Up: shift + control + alt + [1-7]
 * Down: shift + control + alt + [1-7]
 * Supports Up / Down arrow keys
 * Supports Left / Right arrow keys
 * Supports Page-up / Page-down keys
 */
export class ShuttleKeyboardController extends ControllerAbstract {
	
	private _destroyed: boolean = false
	private _prompterView: PrompterViewInner

	private readonly _speedMap = [0, 1, 2, 3, 7, 9, 12, 30]
	
	private _updateSpeedHandle: number|null = null
	private _lastSpeed = 0
	private _currentPosition = 0

	constructor (view: PrompterViewInner) {
		super(view)

		this._prompterView = view
	}
	public destroy () {
		this._destroyed = true
	}
	public onKeyDown (e: KeyboardEvent) {
		let speed = -1
		let inverse = false

		// special case of filtering out missing center/stop-message
		// by looking for numlock and seeing if the last value was 10 or -10
		// if (e.key === 'NumLock' && Math.abs(this._lastSpeed) === this._speedMap[1]) {
		// 	console.log('numyo')
		// 	speed = 0
		// }

		// contour mode needs ctrl + alt + number to work
		// filter on ctrl and alt, fail early
		if (e.ctrlKey && e.altKey) {
			// pause if Digit9 (shuttle centred)
			if(e.shiftKey && e.code === 'Digit9') {
				speed = 0
			}
			switch (e.code) {
				case 'F1':
					speed = this._speedMap[1]
					break
				case 'F2':
					speed = this._speedMap[2]
					break
				case 'F3':
					speed = this._speedMap[3]
					break
				case 'F4':
					speed = this._speedMap[4]
					break
				case 'F5':
					speed = this._speedMap[5]
					break
				case 'F6':
					speed = this._speedMap[6]
					break
				case 'F7':
					speed = this._speedMap[7]
					break
				case 'F8':
					// jump to next segment
					speed = this._speedMap[0]
					// @todo jan find the next segment (if any) and jump there
					break
			}

			// buttons
			if (e.shiftKey) {
				switch (e.code) {
				case 'F9':
						// jump to previous segment
						speed = this._speedMap[0]
						// @todo jan find the previous segment (if any) and jump there
						break
					case 'F10':
						// jump to top
						this._lastSpeed = this._speedMap[0]
						window.scrollTo(0, 0)
						return
					case 'F11':
						// jump to live
						this._lastSpeed = this._speedMap[0]
						this._prompterView.scrollToCurrent()
						return
					case 'F12':
						// jump to next	
						this._lastSpeed = this._speedMap[0]
						this._prompterView.scrollToNext()
						return
				}
			}
		}

		// return on false key events
		if (speed === -1) {
			return
		} else {
			// handle valid key inputs
			e.preventDefault()
			
			// reverse direction if shiftkey is pressed
			if (e.shiftKey || inverse) {
				speed *= -1
			}
		}
		
		
		// update flag for comparison on next iteration
		this._lastSpeed = speed
		this._updateScrollPosition()
	}
	public onKeyUp (e: KeyboardEvent) {
		// Nothing
	}
	public onMouseKeyDown (e: MouseEvent) {
		// Nothing
	}
	public onMouseKeyUp (e: MouseEvent) {
		// Nothing
	}
	public onWheel (e: WheelEvent) {
		// Nothing
	}

	private _updateScrollPosition () {
		if (this._updateSpeedHandle !== null) return
		this._updateSpeedHandle = null
		
		// update scroll position
		window.scrollBy(0, this._lastSpeed)

		// check for reached end-of-scroll:
		const scrollPosition = window.scrollY
		if (scrollPosition !== undefined) {
			// We tried to move, but haven't
			if (this._currentPosition === scrollPosition) {
				this._lastSpeed = 0
			}
			this._currentPosition = scrollPosition
		}

		// create recursive loop
		if (this._lastSpeed !== 0) {
			this._updateSpeedHandle = window.requestAnimationFrame(() => {
				this._updateSpeedHandle = null
				this._updateScrollPosition()
			})
		}
	}
}