export class Agent {
	start(): undefined {
		return undefined
	}
	startSpan(): undefined {
		return undefined
	}
	startTransaction(): undefined {
		return undefined
	}
}

export function setup(): any {
	return {
		__esModule: true,
		default: new Agent(),
	}
}
