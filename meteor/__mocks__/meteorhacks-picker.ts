import { IncomingMessage, ServerResponse } from 'http'

export class PickerMock {

	static mockRoutes: {[name: string]: Function} = {}
	static route (routeName: string, fcn: (params, req: IncomingMessage, response: ServerResponse, next) => void) {
		this.mockRoutes[routeName] = fcn
	}

	static filter (fcn: Function) {
		return new Router()
	}
}
export class Router {
	middleware () {
		// todo
	}
	route (routeName: string, fcn: (params, req: IncomingMessage, response: ServerResponse, next) => void) {
		// todo
	}
}
export function setup () {
	return {
		Picker: PickerMock
	}
}
