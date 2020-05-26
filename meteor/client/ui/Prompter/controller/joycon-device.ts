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
export class JoyconController extends ControllerAbstract {

	private _destroyed: boolean = false
	private _prompterView: PrompterViewInner


	private static readonly _speedMap = [1, 1, 1, 2, 2, 2, 3, 3, 4, 5, 5, 7, 8, 9, 10, 12, 15, 18, 30]
	private static readonly JOYCON_SLACK = .25

	private _updateSpeedHandle: number | null = null
	private _lastSpeed = 0
	private _currentPosition = 0
	private __hasReachedEnd: boolean = true
	private _joycon: Object | null = null
	private _haptic: Object | null = null

	constructor (view: PrompterViewInner) {
		super(view)
		window.addEventListener('gamepadconnected', e => {
			if(!this._joycon) {
				this._joycon = e.gamepad
				this._haptic = this._joycon.vibrationActuator
				this._updateScrollPosition()
			}
		})

		window.addEventListener('gamepaddisconnected', () => {
			this._joycon = null
		})

		this._prompterView = view
	}
	public destroy () {
		this._destroyed = true
	}
	public onKeyDown (e: KeyboardEvent) {
		// Nothing
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
		if (this._joycon === null) return
		if (this._updateSpeedHandle !== null) return
		this._updateSpeedHandle = null
		this._lastSpeed = 0
		
		
		
		const pad = navigator.getGamepads()[0]
		if(pad) {
			const direction = pad.axes[1] < 0 ? 1 : -1	// @todo: decide direction by the controllers mapping/being inversed
			const stickPos = Math.abs(pad.axes[1])		// @todo: decide direction by the controllers mapping/being inversed
			
			if (stickPos >= JoyconController.JOYCON_SLACK) { // filters out deadband
				const mappedInput = 0 + (1 - 0) * ((stickPos - JoyconController.JOYCON_SLACK) / (1 - JoyconController.JOYCON_SLACK))
				const i = Math.round(mappedInput * (JoyconController._speedMap.length - 1))
				this._lastSpeed = JoyconController._speedMap[i] * direction
			} else {
			}
		} 
		

		// update scroll position
		window.scrollBy(0, this._lastSpeed)

		let scrollPosition = window.scrollY
		// check for reached end-of-scroll:
		if (this._currentPosition !== undefined && scrollPosition !== undefined) {
			if (this._currentPosition === scrollPosition) {
				// We tried to move, but haven't
				if(!this._hasReachedEnd && this._lastSpeed !== 0) {
					this._hasReachedEnd = true
					this._haptic.playEffect('dual-rumble', {duration: .03, startDelay: 0, strongMagnitude: .08, weakMagnitude: 0})
					setTimeout(() => {
						this._haptic.playEffect('dual-rumble', {duration: .02, startDelay: 0, strongMagnitude: .04, weakMagnitude: 0})
					}, 70)
				}

				// we stopped moving, either by hitting the boundaries or by letting the joystick go
				this._lastSpeed = 0
			} else {
				this._hasReachedEnd = false
			}
			this._currentPosition = scrollPosition
		}

		// infinite recursive loop
		this._updateSpeedHandle = window.requestAnimationFrame(() => {
			this._updateSpeedHandle = null
			this._updateScrollPosition()
		})
	}
}
