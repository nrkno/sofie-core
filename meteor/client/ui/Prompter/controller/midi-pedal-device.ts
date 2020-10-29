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

	private _speedMap = [0, 1, 2, 3, 5, 7, 9, 30]
	private _speedStepMap = MidiPedalController.makeSpeedStepMap(this._speedMap)
	private static readonly SPEEDMAP_NEUTRAL_POSITION = 7

	private _updateSpeedHandle: number | null = null
	private _lastSpeed = 0
	private _lastSpeedMapPosition = MidiPedalController.SPEEDMAP_NEUTRAL_POSITION
	private _currentPosition = 0

	constructor(view: PrompterViewInner) {
		super(view)

		this._prompterView = view
		this._speedMap = view.configOptions.speedCurve || this._speedMap
		this._speedStepMap = MidiPedalController.makeSpeedStepMap(this._speedMap)

		webmidi.enable(this._setupMidiListeners.bind(this))
	}
	private static makeSpeedStepMap(speedMap): number[] {
		return [
			...speedMap
				.slice(1)
				.reverse()
				.map((i) => i * -1),
			...speedMap.slice(),
		]
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
			console.error('Error enabling WebMIDI')
			console.error(err)
			return
		}

		console.log('WebMIDI enabled')
		webmidi.addListener('connected', (e) => {
			if (e?.port?.type === 'input') {
				this._removeMidiInput()
				this._midiInput  = webmidi.inputs[0]
				this._midiInput.addListener('controlchange', 8, this._onMidiInputCC)	
				console.log('input added') // @todo: remove debugging
			}
		})
		webmidi.addListener('disconnected', () => {
			this._removeMidiInput()
		})
	}

	private _removeMidiInput() {
		if (this._midiInput) {
			this._midiInput.removeListener('controlchange', 8, this._onMidiInputCC)
			this._midiInput = undefined
			console.log('input removed') // @todo: remove debugging
		}
	}

	private _onMidiInputCC(e: InputEventControlchange) {
		console.log(e.value) // @todo: remove debugging
	}

	private _updateScrollPosition() {
		if (this._updateSpeedHandle !== null) return
		this._updateSpeedHandle = null

		// update scroll position
		window.scrollBy(0, this._lastSpeed)

		let scrollPosition = window.scrollY
		// check for reached end-of-scroll:
		if (this._currentPosition !== undefined && scrollPosition !== undefined) {
			if (this._currentPosition === scrollPosition) {
				// We tried to move, but haven't
				this._lastSpeed = 0
				this._lastSpeedMapPosition = MidiPedalController.SPEEDMAP_NEUTRAL_POSITION
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
