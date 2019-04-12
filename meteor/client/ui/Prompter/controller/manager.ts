import { PrompterViewInner } from '../PrompterView'
import { MouseIshController } from './mouse-ish-device'
import { ControllerAbstract } from './lib'
import { KeyboardController } from './keyboard-device'
import * as _ from 'underscore'

export class PrompterControlManager {
	private _view: PrompterViewInner
	private _controllers: Array<ControllerAbstract> = []

	constructor (view: PrompterViewInner) {
		this._view = view

		window.addEventListener('keydown', this._onKeyDown)
		window.addEventListener('keyup', this._onKeyUp)
		window.addEventListener('wheel', this._onWheel, { passive: false })
		window.addEventListener('mousedown', this._onMouseKeyDown)
		window.addEventListener('mouseup', this._onMouseKeyUp)

		// tmp, activate some default controllers:
		this._controllers.push(new MouseIshController(this._view))
		this._controllers.push(new KeyboardController(this._view))
	}
	destroy () {
		window.removeEventListener('keydown', this._onKeyDown)
		window.removeEventListener('keyup', this._onKeyUp)
		window.removeEventListener('wheel', this._onWheel)
		window.removeEventListener('mousedown', this._onMouseKeyDown)
		window.removeEventListener('mouseup', this._onMouseKeyUp)

		_.each(this._controllers, c => c.destroy() )
		this._controllers = []
	}
	private _onKeyDown = (e: KeyboardEvent) => {
		_.each(this._controllers, c => c.onKeyDown(e))
	}
	private _onKeyUp = (e: KeyboardEvent) => {
		_.each(this._controllers, c => c.onKeyUp(e))
	}
	private _onMouseKeyDown = (e: MouseEvent) => {
		_.each(this._controllers, c => c.onMouseKeyDown(e))
	}
	private _onMouseKeyUp = (e: MouseEvent) => {
		_.each(this._controllers, c => c.onMouseKeyUp(e))
	}
	private _onWheel = (e: WheelEvent) => {
		_.each(this._controllers, c => c.onWheel(e))
	}
}
