import { ControllerAbstract } from './lib'
import { PrompterViewInner, PrompterConfigMode } from '../PrompterView'
import Spline from 'cubic-spline'

import webmidi, { Input, InputEventControlchange, WebMidi } from 'webmidi'

const LOCALSTORAGEMODE = 'prompter-controller-arrowkeys'

/**
 * This class handles control of the prompter using
 */
export class MidiPedalController extends ControllerAbstract {
	private prompterView: PrompterViewInner
	private midiInput: Input | undefined

	private rangeRevMin = 0 // pedal "all back" position, the max-reverse-position
	private rangeNeutralMin = 35 // pedal "back" position where reverse-range transistions to the neutral range
	private rangeNeutralMax = 80 // pedal "front" position where scrolling starts, the 0 speed origin
	private rangeFwdMax = 127 // pedal "all front" position where scrolling is maxed out
	private speedMap = [1, 2, 3, 4, 5, 7, 9, 12, 17, 19, 30]
	private reverseSpeedMap = [10, 30, 50]
	private speedSpline: Spline
	private reverseSpeedSpline: Spline

	private updateSpeedHandle: number | null = null
	private lastSpeed = 0
	private currentPosition = 0

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

		webmidi.enable(this.setupMidiListeners.bind(this))
	}

	public destroy() {
		webmidi.disable()
	}
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

	private setupMidiListeners(err: Error) {
		if (err) {
			console.error('Error enabling WebMIDI', err)
			return
		}

		console.log('WebMIDI enabled')
		webmidi.addListener('connected', (e) => {
			if (e?.port?.type === 'input') {
				this.removeMidiInput()
				this.midiInput = webmidi.inputs[0]
				this.midiInput.addListener('controlchange', 8, this.onMidiInputCC.bind(this))
			}
		})
		webmidi.addListener('disconnected', () => {
			this.removeMidiInput()
		})
	}

	private removeMidiInput() {
		this.lastSpeed = 0
		if (this.midiInput) {
			this.midiInput.removeListener('controlchange', 8, this.onMidiInputCC)
			this.midiInput = undefined
		}
	}

	private onMidiInputCC(e: InputEventControlchange) {
		const { rangeRevMin, rangeNeutralMin, rangeNeutralMax, rangeFwdMax } = this
		let inputValue = e.value || 0

		// start by clamping value to the leagal range
		inputValue = Math.min(Math.max(inputValue, rangeRevMin), rangeFwdMax) // clamps in between rangeRevMin and rangeFwdMax

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

		this.updateScrollPosition()

		this.prompterView.DEBUG_controllerState({
			source: PrompterConfigMode.PEDAL,
			lastSpeed: this.lastSpeed,
			lastEvent: 'ControlChange: ' + e.value,
		})
	}

	private updateScrollPosition() {
		if (this.updateSpeedHandle !== null) return

		// update scroll position
		window.scrollBy(0, this.lastSpeed)

		const scrollPosition = window.scrollY
		// check for reached end-of-scroll:
		if (this.currentPosition !== undefined && scrollPosition !== undefined) {
			if (this.currentPosition === scrollPosition) {
				// We tried to move, but haven't
				this.lastSpeed = 0
			}
		}
		this.currentPosition = scrollPosition

		// create recursive loop
		if (this.lastSpeed !== 0) {
			this.updateSpeedHandle = window.requestAnimationFrame(() => {
				this.updateSpeedHandle = null
				this.updateScrollPosition()
			})
		}
	}
}
