
let store: {[key: string]: any} = {}
class Store {
	private _store: any
	constructor (name: string, _options: any) {
		if (!store[name]) {
			store[name] = {}
		}
		this._store = store[name]
	}
	set (key: string, value: any) {
		this._store[key] = value
		return this
	}
	get (key: string) {
		return this._store[key]
	}
}
export = Store
