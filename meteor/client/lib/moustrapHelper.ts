import * as mousetrap from 'mousetrap'
import * as _ from 'underscore'

export namespace mousetrapHelper {
	const _boundHotkeys: {
		[key: string]: ((e: Event) => void)[]
	} = {}

	function handleKey (keys: string, e: ExtendedKeyboardEvent) {
		if (_boundHotkeys[keys] === undefined) {
			return
		}
		// console.log(`Handling key combo "${keys}"`)
		_boundHotkeys[keys].forEach((i) => {
			i(e)
		})
	}

	export function bind (keys: string, callback: (e: Event) => void, action?: string) {
		let index = keys
		if (action) index = keys + '_' + action
		if (_boundHotkeys[index] === undefined) {
			_boundHotkeys[index] = []
			mousetrap.bind(keys, (e: ExtendedKeyboardEvent) => {
				handleKey(index, e)
			}, action)
		}
		// console.log(`Registering callback for key combo "${keys}"`)
		_boundHotkeys[index].push(callback)
	}

	export function unbind (keys: string | string[], action?: string) {
		if (_.isArray(keys)) {
			keys.forEach((key) => {
				unbind(key, action)
			})
		} else {
			let index = keys
			if (action) index = keys + '_' + action
			if (_boundHotkeys[index] === undefined) return
			delete _boundHotkeys[index]
			mousetrap.unbind(keys, action)
		}
	}

	export function shortcutLabel (hotkey: string): string {
		if (this._isMacLike) {
			hotkey = hotkey.replace(/mod/i, '\u2318')
		} else {
			hotkey = hotkey.replace(/mod/i, 'Ctrl')
		}
		// capitalize first letter of each combo key
		hotkey = hotkey.replace(/(\w)\w*/ig, (substring: string) => {
			return substring.substr(0, 1).toUpperCase() + substring.substr(1)
		})

		return hotkey
	}
}

// Add mousetrap keycodes for special keys
mousetrap.addKeycodes({
	220: '§', // on US-based (ANSI) keyboards (single-row, Enter key), this is the key above Enter, usually with a backslash and the vertical pipe character
	222: '\\', // on ANSI-based keyboards, this is the key with single quote
	223: '|', // this key is not present on ANSI-based keyboards

	96: 'num0',
	97: 'num1',
	98: 'num2',
	99: 'num3',
	100: 'num4',
	101: 'num5',
	102: 'num6',
	103: 'num7',
	104: 'num8',
	105: 'num9',
	106: 'numMul',
	107: 'numAdd',
	109: 'numSub',
	110: 'numDot',
	111: 'numDiv'
})
