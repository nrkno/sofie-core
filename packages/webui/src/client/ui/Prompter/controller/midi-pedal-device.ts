import { ControllerAbstract } from './lib.js'
import { PrompterViewContent, PrompterConfigMode } from '../PrompterView.js'
import Spline from 'cubic-spline'

import webmidi, { Input, InputEventControlchange } from 'webmidi'
import { logger } from '../../../lib/logging.js'

/**
 * This class handles control of the prompter using
 */
export class MidiPedalController extends ControllerAbstract {
	private prompterView: PrompterViewContent
	private midiInputs: Input[] = []
	private idleMidiInputs: { [midiId: string]: boolean } = {}

	private rangeRevMin = 0 // pedal "all back" position, the max-reverse-position
	private rangeNeutralMin = 35 // pedal "back" position where reverse-range transistions to the neutral range
	private rangeNeutralMax = 80 // pedal "front" position where scrolling starts, the 0 speed origin
	private rangeFwdMax = 127 // pedal "all front" position where scrolling is maxed out
	private speedMap = [1, 2, 3, 4, 5, 7, 9, 12, 17, 19, 30]
	private reverseSpeedMap = [10, 30, 50]
	private speedSpline: Spline | undefined
	private reverseSpeedSpline: Spline | undefined

	private updateSpeedHandle: number | null = null
	private lastSpeed = 0
	private currentPosition = 0

	constructor(view: PrompterViewContent) {
		super()
		this.prompterView = view

		// assigns params from URL or falls back to the default
		this.speedMap = view.configOptions.pedal_speedMap || this.speedMap
		this.reverseSpeedMap = view.configOptions.pedal_reverseSpeedMap || this.reverseSpeedMap
		this.rangeRevMin = view.configOptions.pedal_rangeRevMin || this.rangeRevMin
		this.rangeNeutralMin = view.configOptions.pedal_rangeNeutralMin || this.rangeNeutralMin
		this.rangeNeutralMax = view.configOptions.pedal_rangeNeutralMax || this.rangeNeutralMax
		this.rangeFwdMax = view.configOptions.pedal_rangeFwdMax || this.rangeFwdMax

		// validate range settings, they need to be in sequence, or the logic will break
		if (this.rangeNeutralMin <= this.rangeRevMin) {
			logger.error(
				`MidiPedalController: rangeNeutralMin (${this.rangeNeutralMin}) must be larger to rangeRevMin (${this.rangeRevMin}). Pedal control will not initialize.`
			)
			return
		}
		if (this.rangeNeutralMax <= this.rangeNeutralMin) {
			logger.error(
				`MidiPedalController: rangeNeutralMax (${this.rangeNeutralMax}) must be larger to rangeNeutralMin (${this.rangeNeutralMin}). Pedal control will not initialize`
			)
			return
		}
		if (this.rangeFwdMax <= this.rangeNeutralMax) {
			logger.error(
				`MidiPedalController: rangeFwdMax (${this.rangeFwdMax}) must be larger to rangeNeutralMax (${this.rangeNeutralMax}). Pedal control will not initialize`
			)
			return
		}

		// create splines, using the input speedMaps, for both the forward range, and the reverse range
		this.speedSpline = new Spline(
			this.speedMap.map(
				(_y, index, array) =>
					((this.rangeFwdMax - this.rangeNeutralMax) / (array.length - 1)) * index + this.rangeNeutralMax
			),
			this.speedMap
		)
		this.reverseSpeedSpline = new Spline(
			this.reverseSpeedMap
				.reverse()
				.map(
					(_y, index, array) =>
						((this.rangeNeutralMin - this.rangeRevMin) / (array.length - 1)) * index + this.rangeRevMin
				),
			this.reverseSpeedMap
		)

		try {
			webmidi.enable(this.setupMidiListeners.bind(this))
		} catch (e: any) {
			logger.error('webmidi.enable', e)
			logger.info(
				'Are you accessing the page over HTTPS? If not, look at setting Chrome flag unsafely-treat-insecure-origin-as-secure'
			)
		}
	}

	public destroy(): void {
		webmidi.disable()
	}
	public onKeyDown(_e: KeyboardEvent): void {
		// Nothing
	}
	public onKeyUp(_e: KeyboardEvent): void {
		// Nothing
	}
	public onMouseKeyDown(_e: MouseEvent): void {
		// Nothing
	}
	public onMouseKeyUp(_e: MouseEvent): void {
		// Nothing
	}
	public onWheel(_e: WheelEvent): void {
		// Nothing
	}

	private setupMidiListeners(err: Error | undefined) {
		if (err) {
			logger.error(err)
			return
		}

		console.log('WebMIDI enabled')
		webmidi.addListener('connected', () => {
			this.updateMidiInputs()
		})
		webmidi.addListener('disconnected', () => {
			this.updateMidiInputs()
		})
	}

	private updateMidiInputs() {
		// reset all inputs
		this.midiInputs.forEach((i) => i.removeListener('controlchange', 8, this.onMidiInputCC))
		this.midiInputs = []
		this.lastSpeed = 0

		// re-adds all active inputs and sets up listeners
		this.midiInputs = webmidi.inputs.filter((i) => {
			return i.type === 'input' && i.connection === 'open' && i.state === 'connected'
		})

		this.midiInputs.forEach((i) => i.addListener('controlchange', 8, this.onMidiInputCC))
	}

	private onMidiInputCC = (e: InputEventControlchange) => {
		if (!this.reverseSpeedSpline || !this.speedSpline) return
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

			// check if the input is already idle, ignore successive idle commands
			if (this.idleMidiInputs[e?.target?.id] === true) {
				return
			}

			this.lastSpeed = 0
		} else if (inputValue >= rangeNeutralMax && inputValue <= rangeFwdMax) {
			// 3) Use the speed spline to find the expected speed at this point
			this.lastSpeed = Math.round(this.speedSpline.at(inputValue))
		} else {
			// 4) we should never be able to hit this due to validation above
			logger.error(`Midi-pedal: Illegal input value ${inputValue}`)
			return
		}

		// update idle status for this input
		if (this.lastSpeed === 0) {
			// add input as idle
			this.idleMidiInputs[e?.target?.id] = true
		} else if (this.idleMidiInputs[e?.target?.id]) {
			// reset the idle state

			// the logic fails if you have two non-idle inputs at the same time
			// we assume that only one pedal i sending non-idle data at the time
			delete this.idleMidiInputs[e?.target?.id]
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
		window.scrollBy({ top: this.lastSpeed, behavior: 'instant' })

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
