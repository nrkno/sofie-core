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
}
