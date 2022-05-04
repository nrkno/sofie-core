/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
const store: { [key: string]: any } = {}
class Store {
	private _store: any
	constructor(name: string, _options: any) {
		if (!store[name]) {
			store[name] = {}
		}
		this._store = store[name]
	}
	set(key: string, value: any): Store {
		this._store[key] = value
		return this
	}
	get(key: string): Store {
		return this._store[key]
	}
}
export = Store
