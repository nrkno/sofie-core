export namespace CollapsedStateStorage {
	let _collapsedState: {
		[key: string]: boolean | BooleanMap
	} = {}
	const SCOPE = 'collapsedItems'

	type BooleanMap = {
		[key: string]: boolean
	}

	try {
		_collapsedState = JSON.parse(localStorage.getItem(SCOPE) || '') || {}
	} catch (e) {
		_collapsedState = {}
	}

	export function setItem (tag: string, value: boolean | BooleanMap) {
		_collapsedState[tag] = value
		_persist()
	}

	export function getItemBooleanMap (tag: string, defaultValue: BooleanMap): BooleanMap {
		return typeof _collapsedState[tag] === 'object' ? _collapsedState[tag] as BooleanMap : defaultValue
	}

	export function getItemBoolean (tag: string, defaultValue: boolean): boolean {
		return typeof _collapsedState[tag] === 'boolean' ? !!_collapsedState[tag] : defaultValue
	}

	export function getItem (tag: string, defaultValue: boolean | BooleanMap): boolean | BooleanMap {
		return _collapsedState[tag] !== undefined ? _collapsedState[tag] : defaultValue
	}

	function _persist () {
		localStorage.setItem(SCOPE, JSON.stringify(_collapsedState))
	}
}
