import * as _ from 'underscore'

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
		return _.compact(
			row.split(',').map((keyPosition) => {
				const args = keyPosition.split(':')
				return args[0]
					? {
							code: args[1] ? args[1] : args[0],
							width: args[1] ? (args[0] === 'X' ? -1 : parseFloat(args[0])) : 3,
					  }
					: undefined
			})
		)
	})
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

const STANDARD_102_TKL_TEMPLATE = [
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
]

const STANDARD_102_EXTENDED_TEMPLATE = [
	...STANDARD_102_TKL_TEMPLATE,
	// Row E
	'NumLock,NumpadDivide,NumpadMultiply,NumpadSubtract',
	// Row D
	'Numpad7,Numpad8,Numpad9,NumpadAdd',
	// Row C
	'Numpad4,Numpad5,Numpad6',
	// Row B
	'Numpad1,Numpad2,Numpad3,NumpadEnter',
	// Row A
	'6.16:Numpad0,NumpadDecimal',
]

export namespace KeyboardLayouts {
	// This is a small keyboard layout: 102-Standard keybord, without the Numpad
	export const STANDARD_102_TKL: PhysicalLayout = createPhysicalLayout(STANDARD_102_TKL_TEMPLATE)
	export const STANDARD_102_EXTENDED: PhysicalLayout = createPhysicalLayout(STANDARD_102_EXTENDED_TEMPLATE)

	export function nameToPhysicalLayout(name: Names) {
		switch (name) {
			case Names.STANDARD_102_EXTENDED:
				return STANDARD_102_EXTENDED
			case Names.STANDARD_102_TKL:
			default:
				return STANDARD_102_TKL
		}
	}

	export enum Names {
		STANDARD_102_TKL = 'STANDARD_102_TKL',
		STANDARD_102_EXTENDED = 'STANDARD_102_EXTENDED',
	}
}
