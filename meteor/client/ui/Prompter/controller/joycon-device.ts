import { ControllerAbstract } from './lib'
import { PrompterViewInner } from '../PrompterView'

const LOCALSTORAGEMODE = 'prompter-controller-arrowkeys'

/**
 * This class handles control of the prompter using
 */
export class JoyConController extends ControllerAbstract {
	private prompterView: PrompterViewInner
	private joycons: Gamepad[] = []

	private readonly deadBand = 0.25 // ignore all input within this range. Used to separate out the active joycon when both are connected
	private readonly rangeRevMin = -1 // pedal "all back" position, the max-reverse-position
	private readonly rangeNeutralMin = -0.25 // pedal "back" position where reverse-range transistions to the neutral range
	private readonly rangeNeutralMax = 0.25 // pedal "front" position where scrolling starts, the 0 speed origin
	private readonly rangeFwdMax = 1 // pedal "all front" position where scrolling is maxed out
	private readonly speedMap = [1, 2, 3, 4, 5, 8, 12, 30]

	// private direction: 'backwards' | 'neutral' | 'forwards' = 'neutral'
	private updateSpeedHandle: number | null = null
	private lastSpeed = 0
	private currentPosition = 0

	constructor(view: PrompterViewInner) {
		super(view)
		const { rangeRevMin, rangeNeutralMin, rangeNeutralMax, rangeFwdMax } = this

		this.prompterView = view

		// validate range settings
		// they need to be in sequence, or the logic will break
		if (rangeNeutralMin <= rangeRevMin) {
			console.error('rangeNeutralMin must be larger to rangeRevMin. Pedal control will not initialize.')
			return
		}
		if (rangeNeutralMax <= rangeNeutralMin) {
			console.error('rangeNeutralMax must be larger to rangeNeutralMin. Pedal control will not initialize')
			return
		}
		if (rangeFwdMax <= rangeNeutralMax) {
			console.error('rangeFwdMax must be larger to rangeNeutralMax. Pedal control will not initialize')
			return
		}

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

		if (inputValue >= rangeRevMin && inputValue <= rangeNeutralMin) {
			// find the position within the backwards range
			const rangePosition = (rangeNeutralMin - inputValue) / (rangeNeutralMin - rangeRevMin) // how far, 0.0-1.0, within the range are we?
			const rangeIndex = Math.ceil(rangePosition * this.speedMap.length) - 1 // maps 0-1 to 0-n where n = .lenght of the array
			this.lastSpeed = this.speedMap[rangeIndex] * -1 // applies the speed as a negative value to reverse
		} else if (inputValue >= rangeNeutralMin && inputValue <= rangeNeutralMax) {
			// we're in the neutral zone
			this.lastSpeed = 0
		} else if (inputValue >= rangeNeutralMax && inputValue <= rangeFwdMax) {
			// find the position within the forward range
			const rangePosition = (inputValue - rangeNeutralMax) / (rangeFwdMax - rangeNeutralMax) // how far, 0.0-1.0, within the range are we?
			const rangeIndex = Math.ceil(rangePosition * this.speedMap.length) - 1 // maps 0-1 to 0-n where n = .lenght of the array
			this.lastSpeed = this.speedMap[rangeIndex] // applies the speed
		} else {
			// we should never be able to hit this due to validation above
			console.error(`Illegal input value ${inputValue}`)
			// this.direction = 'neutral'
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

		// @todo strategy to clock down the rate once we have idled for some time
		this.updateSpeedHandle = window.requestAnimationFrame(() => {
			this.updateSpeedHandle = null
			this.updateScrollPosition()
		})
	}
}
