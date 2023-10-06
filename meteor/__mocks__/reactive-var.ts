class ReactiveVar<T> {
	val: T
	constructor(initVal) {
		this.val = initVal
	}
	get = () => {
		return this.val
	}
	set = (newVal: T) => {
		this.val = newVal
	}
}

export function setup(): any {
	return {
		ReactiveVar,
	}
}
