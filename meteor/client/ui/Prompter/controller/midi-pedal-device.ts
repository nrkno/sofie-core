import { ControllerAbstract, LONGPRESS_TIME } from './lib'
import { PrompterViewInner } from '../PrompterView'

import webmidi, { Input, InputEventControlchange, WebMidi } from 'webmidi'

const LOCALSTORAGE_MODE = 'prompter-controller-arrowkeys'

/**
 * This class handles control of the prompter using
 */
export class MidiPedalController extends ControllerAbstract {
	private _destroyed: boolean = false
	private _prompterView: PrompterViewInner
	private _midiInput: Input | undefined

	private rangeRevMin = 0 // pedal "all back" position, the max-reverse-position
	private rangeNeutralMin = 35 // pedal "back" position where reverse-range transistions to the neutral range
	private rangeNeutralMax = 80 // pedal "front" position where scrolling starts, the 0 speed origin
	private rangeFwdMax = 127 // pedal "all front" position where scrolling is maxed out
	private _speedMap = [1, 2, 3, 4, 5, 7, 9, 12, 17, 19, 30]
	private _reverseSpeedMap = [10, 30, 50]

	// private _direction: 'backwards' | 'neutral' | 'forwards' = 'neutral'
	private _updateSpeedHandle: number | null = null
	private _lastSpeed = 0
	private _currentPosition = 0

	constructor(view: PrompterViewInner) {
		super(view)
		this._prompterView = view

		// validate range settings
		// they need to be in sequence, or the logic will break
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

		webmidi.enable(this._setupMidiListeners.bind(this))
	}

	public destroy() {
		this._destroyed = true
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

	private _setupMidiListeners(err: Error) {
		if (err) {
			console.error('Error enabling WebMIDI', err)
			return
		}

		console.log('WebMIDI enabled')
		webmidi.addListener('connected', (e) => {
			if (e?.port?.type === 'input') {
				this._removeMidiInput()
				this._midiInput = webmidi.inputs[0]
				this._midiInput.addListener('controlchange', 8, this._onMidiInputCC.bind(this))
			}
		})
		webmidi.addListener('disconnected', () => {
			this._removeMidiInput()
		})
	}

	private _removeMidiInput() {
		this._lastSpeed = 0
		if (this._midiInput) {
			this._midiInput.removeListener('controlchange', 8, this._onMidiInputCC)
			this._midiInput = undefined
		}
	}

	private _onMidiInputCC(e: InputEventControlchange) {
		const { rangeRevMin, rangeNeutralMin, rangeNeutralMax, rangeFwdMax } = this
		let inputValue = e.value || 0

		// start by clamping value to the leagal range
		inputValue = Math.min(Math.max(inputValue, rangeRevMin), rangeFwdMax) // clamps in between rangeRevMin and rangeFwdMax

		if (inputValue >= rangeRevMin && inputValue <= rangeNeutralMin) {
			// find the position within the backwards range
			const rangePosition = (rangeNeutralMin - inputValue) / (rangeNeutralMin - rangeRevMin) // how far, 0.0-1.0, within the range are we?
			const rangeIndex = Math.ceil(rangePosition * this._reverseSpeedMap.length) - 1 // maps 0-1 to 0-n where n = .lenght of the array
			this._lastSpeed = this._reverseSpeedMap[rangeIndex] * -1 // applies the speed as a negative value to reverse
		} else if (inputValue >= rangeNeutralMin && inputValue <= rangeNeutralMax) {
			// we're in the neutral zone
			this._lastSpeed = 0
		} else if (inputValue >= rangeNeutralMax && inputValue <= rangeFwdMax) {
			// find the position within the forward range
			const rangePosition = (inputValue - rangeNeutralMax) / (rangeFwdMax - rangeNeutralMax) // how far, 0.0-1.0, within the range are we?
			const rangeIndex = Math.ceil(rangePosition * this._speedMap.length) - 1 // maps 0-1 to 0-n where n = .lenght of the array
			this._lastSpeed = this._speedMap[rangeIndex] // applies the speed
		} else {
			// we should never be able to hit this due to validation above
			console.error(`Illegal input value ${inputValue}`)
			// this._direction = 'neutral'
			return
		}

		this._updateScrollPosition()
	}

	private _updateScrollPosition() {
		if (this._updateSpeedHandle !== null) return
		this._updateSpeedHandle = null

		// update scroll position
		window.scrollBy(0, this._lastSpeed)

		const scrollPosition = window.scrollY
		// check for reached end-of-scroll:
		if (this._currentPosition !== undefined && scrollPosition !== undefined) {
			if (this._currentPosition === scrollPosition) {
				// We tried to move, but haven't
				this._lastSpeed = 0
			}
		}
		this._currentPosition = scrollPosition

		// create recursive loop
		if (this._lastSpeed !== 0) {
			this._updateSpeedHandle = window.requestAnimationFrame(() => {
				this._updateSpeedHandle = null
				this._updateScrollPosition()
			})
		}
	}
}
