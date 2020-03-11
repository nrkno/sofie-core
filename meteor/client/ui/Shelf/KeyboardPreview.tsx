import * as React from 'react'
import * as _ from 'underscore'
import * as classNames from 'classnames'
import { ISourceLayer } from 'tv-automation-sofie-blueprints-integration'
import { IHotkeyAssignment, RegisteredHotkeys } from '../../lib/hotkeyRegistry'
import { withTracker } from '../../lib/ReactMeteorData/ReactMeteorData';
import { MeteorReactComponent } from '../../lib/MeteorReactComponent';

declare global {
	type KeyboardLayoutMap = Map<string, string>

	type KeyboardLayoutEvents = 'layoutchange'

	interface Keyboard {
		getLayoutMap (): Promise<KeyboardLayoutMap>
		addEventListener (type: KeyboardLayoutEvents, listener: EventListener): void
		removeEventListener (type: KeyboardLayoutEvents, listener: EventListener): void
	}

	interface Navigator {
		keyboard: Keyboard
	}
}

export interface IParsedHotkeyAssignment extends IHotkeyAssignment {
	keys: Set<string>
}

export enum SpecialKeyPositions {
	BLANK_SPACE = '$space'
}

export interface KeyPositon {
	code: string
	width: number
	space?: true
}

/**
 * Order of keys is: Alphanum Row E...A, Function Section Row K, Control Pad E,
 * Control Pad D, Arrow Pad B, Arrow Pad A, Numpad Row E...A. Not all rows need to be specified.
 */
export type PhysicalLayout = KeyPositon[][]

export interface IProps {
	physicalLayout: PhysicalLayout
}

interface ITrackedProps {
	hotkeys: IHotkeyAssignment[]
}

interface IState {
	layout: KeyboardLayoutMap | undefined
}

/**
 * Convert an array of strings into a PhysicalLayout.
 * See https://w3c.github.io/uievents-code/#keyboard-sections for rows and sections
 *
 * @param {string[]} shortForm Order of keys is: Alphanum Row E...A, Function Section Row K, Control Pad E,
 * 							   Control Pad D, Arrow Pad B, Arrow Pad A, Numpad Row E...A.
 * @returns {PhysicalLayout}
 */
function createPhysicalLayout(shortForm: string[]): PhysicalLayout {
	return shortForm.map((row) => {
		return _.compact(row.split(',').map((keyPosition) => {
			const args = keyPosition.split(':')
			return args[0] ? {
				code: args[1] ? args[1] : args[0],
				width: args[1] ?
					args[0] === 'X' ?
						-1 :
						parseFloat(args[0]) :
					3
			} : undefined
		}))
	})
}

export enum GenericFuncionalKeyLabels {
	Backspace = '⌫',
	Tab = 'Tab ⭾',
	CapsLock = 'CapsLock',
	Enter = 'Enter',
	ShiftLeft = 'Shift',
	ShiftRight = 'Shift',
	ControlLeft = 'Ctrl',
	MetaLeft = '❖',
	AltLeft = 'Alt',
	Space = ' ',
	AltRight = 'Alt',
	MetaRight = '❖',
	ContextMenu = '☰',
	ControlRight = 'Ctrl',

	Escape = 'Esc',

	Insert = 'Insert',
	Delete = 'Delete',
	Home = 'Home',
	End = 'End',
	PageUp = 'PgUp',
	PageDown = 'PgDn',

	ArrowUp = '⯅',
	ArrowDown = '⯆',
	ArrowLeft = '⯇',
	ArrowRight = '⯈'
}

export namespace KeyboardLayouts {
	export const STANDARD_102: PhysicalLayout = createPhysicalLayout([
		// Row E
		'Backquote,Digit1,Digit2,Digit3,Digit4,Digit5,Digit6,Digit7,Digit8,Digit9,Digit0,Minus,Equal,X:Backspace',
		// Row D
		'4:Tab,KeyQ,KeyW,KeyE,KeyR,KeyT,KeyY,KeyU,KeyI,KeyO,KeyP,BracketLeft,BracketRight',
		// Row C
		'5:CapsLock,KeyA,KeyS,KeyD,KeyF,KeyG,KeyH,KeyJ,KeyK,KeyL,Semicolon,Quote,Backslash,X:Enter',
		// Row B
		'3.5:ShiftLeft,IntlBackslash,KeyZ,KeyX,KeyC,KeyV,KeyB,KeyN,KeyM,Comma,Period,Slash,X:ShiftRight',
		// Row A
		'4:ControlLeft,MetaLeft,AltLeft,21:Space,AltRight,MetaRight,ContextMenu,X:ControlRight',

		// Row K
		'Escape,-1:$space,F1,F2,F3,F4,-1:$space,F5,F6,F7,F8,-1:$space,F9,F10,F11,F12',

		// Control Pad E
		'Insert,Home,PageUp',
		// Control Pad D
		'Delete,End,PageDown',

		// Arrow Pad B
		'$space,ArrowUp,$space',
		// Arrow Pad A
		'ArrowLeft,ArrowDown,ArrowRight',
	])
}

export const KeyboardPreview = withTracker<IProps, IState, ITrackedProps>((props: IProps) => {
	return {
		hotkeys: RegisteredHotkeys.find().fetch()
	}
})(class KeyboardPreview extends MeteorReactComponent<IProps & ITrackedProps, IState> {
	constructor(props: IProps) {
		super(props)

		this.state = {
			layout: undefined
		}
	}

	onLayoutChange = () => {
		if (navigator.keyboard) {
			navigator.keyboard.getLayoutMap().then(layout => this.setState({ layout }))
		}
	}

	componentDidMount() {
		if (navigator.keyboard) {
			navigator.keyboard.getLayoutMap().then(layout => this.setState({ layout }))
			if (navigator.keyboard.addEventListener) {
				navigator.keyboard.addEventListener('layoutchange', this.onLayoutChange)
			}
		}
	}

	componentWillUnmount() {
		if (navigator.keyboard && navigator.keyboard.removeEventListener) {
			navigator.keyboard.removeEventListener('layoutchange', this.onLayoutChange)
		}
	}

	private renderBlock(block) {
		return block.map((row) => <div className='keyboard-preview__key-row'>
			{ row.map((key, index) => {
				if (key.code === SpecialKeyPositions.BLANK_SPACE) {
					return <div key={'idx' + index} className={classNames('keyboard-preview__blank-space', {
						'keyboard-preview__blank-space--spring': (key.width < 0)
					})} style={{fontSize: key.width >= 0 ? (key.width || 1) + 'em' : undefined }}></div>
				} else {
					return <div key={key.code} className={classNames('keyboard-preview__key', {
						'keyboard-preview__key--fill': (key.width < 0)
					})} style={{fontSize: key.width >= 0 ? (key.width || 1) + 'em' : undefined }}>
							<div className='keyboard-preview__key__label'>
								{this.state.layout ?
									this.state.layout.get(key.code) || GenericFuncionalKeyLabels[key.code] || key.code :
									GenericFuncionalKeyLabels[key.code] || key.code
								}
							</div>
						</div>
				}
			}) }
		</div>)
	}

	render() {
		const { physicalLayout: keys } = this.props
		const alphanumericBlock = keys.slice(0, 5)
		const functionBlock = keys.slice(5, 6)
		const controlPad = keys.slice(6, 8)
		const arrowPad = keys.slice(8, 10)
		const numPad = keys.slice(11, 15)

		return <div className='keyboard-preview'>
			{functionBlock.length > 0 && <div className='keyboard-preview__function'>
				{this.renderBlock(functionBlock)}
			</div>}
			{alphanumericBlock.length > 0 && <div className='keyboard-preview__alphanumeric'>
				{this.renderBlock(alphanumericBlock)}
			</div>}
			{controlPad.length > 0 && <div className='keyboard-preview__control-pad'>
				{this.renderBlock(controlPad)}
			</div>}
			{arrowPad.length > 0 && <div className='keyboard-preview__arrow-pad'>
				{this.renderBlock(arrowPad)}
			</div>}
			{numPad.length > 0 && <div className='keyboard-preview__num-pad'>
				{this.renderBlock(numPad)}
			</div>}
		</div>
	}
})
