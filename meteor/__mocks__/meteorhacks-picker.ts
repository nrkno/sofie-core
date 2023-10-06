import { IncomingMessage, ServerResponse } from 'http'
import { Response as MockResponse, MockResponseData } from 'mock-http'

export interface Params {
	[key: string]: string
}

export type FilterFunction = (req: IncomingMessage, res: ServerResponse) => boolean
export type HandlerFunction = (
	params: Params,
	req: IncomingMessage,
	response: ServerResponse,
	next: () => void
) => Promise<void>

export interface PickerMockRoute {
	filter?: FilterFunction
	handler: HandlerFunction
}

export class PickerMock {
	static mockRoutes: { [name: string]: PickerMockRoute } = {}
	static route(routeName: string, fcn: HandlerFunction): void {
		this.mockRoutes[routeName] = { handler: fcn }
	}

	static filter(fcn: FilterFunction): Router {
		return new Router(fcn)
	}
}
export class Router {
	private filter: FilterFunction

	constructor(filter: FilterFunction) {
		this.filter = filter
	}

	middleware(): void {
		// todo
	}
	route(routeName: string, fcn: HandlerFunction): void {
		PickerMock.mockRoutes[routeName] = {
			filter: this.filter,
			handler: fcn,
		}
	}
}
export function setup(): any {
	return {
		Picker: PickerMock,
	}
}

export interface MockResponseDataString extends MockResponseData {
	bufferStr: string
	statusCode: number
}

export function parseResponseBuffer(res: MockResponse, encoding?: BufferEncoding): MockResponseDataString {
	const internal = res._internal
	const bufferStr = internal.buffer.toString(encoding)
	return {
		...internal,
		bufferStr,
		statusCode: res.statusCode,
	}
}
