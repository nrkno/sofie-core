const store: { [key: string]: any } = {}
class Store {
	private _store: any
	constructor(name: string, _options: unknown) {
		if (!store[name]) {
			store[name] = {}
		}
		this._store = store[name]
	}
	set(key: string, value: unknown): Store {
		this._store[key] = value
		return this
	}
	get(key: string): any {
		return this._store[key]
	}
}
export = Store
