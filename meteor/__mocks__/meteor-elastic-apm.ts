export class Agent {
	start() {
		return undefined
	}
	startSpan() {
		return undefined
	}
	startTransaction() {
		return undefined
	}
}

export function setup() {
	return {
		__esModule: true,
		default: new Agent(),
	}
}
