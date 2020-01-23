declare module 'meteor/meteorhacks:picker' {
	import { ServerResponse, IncomingMessage } from 'http'
	import { NextHandleFunction } from 'connect'
	interface Params {
		[key: string]: string
	}
	type Route = (route: string, cb: (params: Params, req: IncomingMessage, res: ServerResponse, next: () => void) => void) => void
	class PickerClass {
		route: Route
		filter (cb: (req: IncomingMessage, res: ServerResponse) => boolean) : Router
	}
	class Router {
		middleware (middleware: NextHandleFunction) : void
		route: Route
	}
	var Picker: PickerClass
}


declare module 'http' {
	interface IncomingMessage {
		body?: object | string
	}
}