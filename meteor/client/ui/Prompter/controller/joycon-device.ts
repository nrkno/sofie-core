import { ControllerAbstract } from './lib'
import { PrompterConfigMode, PrompterViewInner } from '../PrompterView'
import Spline from 'cubic-spline'

const LOCALSTORAGEMODE = 'prompter-controller-arrowkeys'

/**
 * This class handles control of the prompter using
 */
export class JoyConController extends ControllerAbstract {
	private prompterView: PrompterViewInner
	private joycons: Gamepad[] = []

	private readonly deadBand = 0.25 // ignore all input within this range. Used to separate out the active joycon when both are connected
	private rangeRevMin = -1 // pedal "all back" position, the max-reverse-position
	private rangeNeutralMin = -0.25 // pedal "back" position where reverse-range transistions to the neutral range
	private rangeNeutralMax = 0.25 // pedal "front" position where scrolling starts, the 0 speed origin
	private rangeFwdMax = 1 // pedal "all front" position where scrolling is maxed out
	private speedMap = [1, 2, 3, 4, 5, 8, 12, 30]
	private reverseSpeedMap = [1, 2, 3, 4, 5, 8, 12, 30]
	private speedSpline: Spline
	private reverseSpeedSpline: Spline

	private updateSpeedHandle: number | null = null
	private lastSpeed = 0
	private currentPosition = 0
	private lastInputValue = ''

	constructor(view: PrompterViewInner) {
		super(view)
		this.prompterView = view

		// assigns params from URL or falls back to the default
		this.speedMap = view.configOptions.speedMap || this.speedMap
		this.reverseSpeedMap = view.configOptions.reverseSpeedMap || this.reverseSpeedMap
		this.rangeRevMin = view.configOptions.rangeRevMin || this.rangeRevMin
		this.rangeNeutralMin = view.configOptions.rangeNeutralMin || this.rangeNeutralMin
		this.rangeNeutralMax = view.configOptions.rangeNeutralMax || this.rangeNeutralMax
		this.rangeFwdMax = view.configOptions.rangeFwdMax || this.rangeFwdMax


		// validate range settings, they need to be in sequence, or the logic will break
		if (this.rangeNeutralMin <= this.rangeRevMin) {
			console.error('rangeNeutralMin must be larger to rangeRevMin. Pedal control will not initialize.')
			return
		}
		if (this.rangeNeutralMax <= this.rangeNeutralMin) {
			console.error('rangeNeutralMax must be larger to rangeNeutralMin. Pedal control will not initialize')
			return
		}
		if (this.rangeFwdMax <= this.rangeNeutralMax) {
			console.error('rangeFwdMax must be larger to rangeNeutralMax. Pedal control will not initialize')
			return
		}

		// create splines, using the input speedMaps, for both the forward range, and the reverse range
		this.speedSpline = new Spline(
			this.speedMap.map(
				(y, index, array) =>
					((this.rangeFwdMax - this.rangeNeutralMax) / (array.length - 1)) * index + this.rangeNeutralMax
			),
			this.speedMap
		)
		this.reverseSpeedSpline = new Spline(
			this.reverseSpeedMap
				.reverse()
				.map(
					(y, index, array) =>
						((this.rangeNeutralMin - this.rangeRevMin) / (array.length - 1)) * index + this.rangeRevMin
				),
			this.reverseSpeedMap
		)

		window.addEventListener('gamepadconnected', this.updateScrollPosition.bind(this))
		window.addEventListener('gamepaddisconnected', this.updateScrollPosition.bind(this))
	}

	public destroy() {}
	public onKeyDown(e: KeyboardEvent) {
		// Nothing
	}
	public onKeyUp(e: KeyboardEvent) {
		// Nothing
	}
	public onMouseKeyDown(e: MouseEvent) {
		// Nothing
	}
	public onMouseKeyUp(e: MouseEvent) {
		// Nothing
	}
	public onWheel(e: WheelEvent) {
		// Nothing
	}

	private checkIfWeHaveConnectedJoyCons() {
		this.joycons = []
		if (navigator.getGamepads) {
			for (const o of navigator.getGamepads()) {
				if (o !== null && o.connected && o.id && typeof o.id === 'string' && o.id.match('Joy-Con')) {
					this.joycons.push(o)
				}
			}
		}
	}

	private getActiveAisOfJoycons() {
		const pad = this.joycons[0]

		if (pad.axes.length === 2) {
			// L or R mode
			if (Math.abs(pad.axes[0]) > this.deadBand) {
				if (pad.id && typeof pad.id === 'string') {
					if (pad.id.match('(L)')) {
						return pad.axes[0] * -1 // in this mode, L is "negative"
					} else if (pad.id.match('(R)')) {
						return pad.axes[0] // in this mode, R is "positive"
					}
				}
			}
		} else if (pad.axes.length === 4) {
			// L + R mode
			// get the first one that is moving outside of the deadband, priorotizing the L controller
			if (Math.abs(pad.axes[1]) > this.deadBand) {
				return pad.axes[1] * -1 // in this mode, we are "negative" on both sticks....
			}
			if (Math.abs(pad.axes[3]) > this.deadBand) {
				return pad.axes[3] * -1 // in this mode, we are "negative" on both sticks....
			}
		}

		// @todo: map out button presses

		return 0
	}

	private getSpeedFromJoycons() {
		const { rangeRevMin, rangeNeutralMin, rangeNeutralMax, rangeFwdMax } = this
		let inputValue = this.getActiveAisOfJoycons()

		// start by clamping value to the leagal range
		inputValue = Math.min(Math.max(inputValue, rangeRevMin), rangeFwdMax) // clamps in between rangeRevMin and rangeFwdMax
		// stores only for debugging
		this.lastInputValue = inputValue.toFixed(2)

		if (inputValue >= rangeRevMin && inputValue <= rangeNeutralMin) {
			// 1) Use the reverse speed spline for the expected speed. The reverse speed is specified using positive values,
			//    so the result needs to be inversed
			this.lastSpeed = Math.round(this.reverseSpeedSpline.at(inputValue)) * -1
		} else if (inputValue >= rangeNeutralMin && inputValue <= rangeNeutralMax) {
			// 2) we're in the neutral zone
			this.lastSpeed = 0
		} else if (inputValue >= rangeNeutralMax && inputValue <= rangeFwdMax) {
			// 3) Use the speed spline to find the expected speed at this point
			this.lastSpeed = Math.round(this.speedSpline.at(inputValue))
		} else {
			// 4) we should never be able to hit this due to validation above
			console.error(`Illegal input value ${inputValue}`)
			return
		}
	}

	private updateScrollPosition() {
		this.checkIfWeHaveConnectedJoyCons()
		if (this.updateSpeedHandle !== null) return
		if (!this.joycons.length) return
		this.updateSpeedHandle = null

		this.getSpeedFromJoycons()

		// update scroll position
		window.scrollBy(0, this.lastSpeed)

		const scrollPosition = window.scrollY
		// check for reached end-of-scroll:
		if (this.currentPosition !== undefined && scrollPosition !== undefined) {
			if (this.currentPosition === scrollPosition) {
				// We tried to move, but haven't
				this.lastSpeed = 0

				// @todo: haptic feedback
			}
		}
		this.currentPosition = scrollPosition

		// debug
		this.prompterView.DEBUG_controllerState({
			source: PrompterConfigMode.JOYCON,
			lastSpeed: this.lastSpeed,
			lastEvent: 'ControlChange: ' + this.lastInputValue,
		})

		// @todo strategy to clock down the rate once we have idled for some time
		this.updateSpeedHandle = window.requestAnimationFrame(() => {
			this.updateSpeedHandle = null
			this.updateScrollPosition()
		})
	}
}
