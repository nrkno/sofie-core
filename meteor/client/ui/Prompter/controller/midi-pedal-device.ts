import { ControllerAbstract, LONGPRESS_TIME } from './lib'
import { PrompterViewInner } from '../PrompterView'

const LOCALSTORAGE_MODE = 'prompter-controller-arrowkeys'

/**
 * This class handles control of the prompter using
 */
export class MidiPedalController extends ControllerAbstract {
	private _destroyed: boolean = false
	private _prompterView: PrompterViewInner

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

		this._setupMidiListeners()
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

	private _setupMidiListeners() {
		console.error('afasasf')
		if (navigator.requestMIDIAccess) {
			navigator.requestMIDIAccess().then((e) => {

			})
			.catch((e) => {
				console.error('Webmidi error')
				console.error(e)
			})
		} else {
			console.error('WebMIDI not supported by browser')
		}
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
