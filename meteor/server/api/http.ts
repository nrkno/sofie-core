import { Params, Picker, Router } from 'meteor/meteorhacks:picker'
import * as bodyParser from 'body-parser'
import { IncomingMessage, ServerResponse } from 'http'
import { waitForPromise } from '../../lib/lib'

/** Wrap the meteorhacks:picker so that we can work in promises */
export class AsyncRouter {
	#router: Router

	constructor(router: Router) {
		this.#router = router
	}

	// middleware(middleware: (req: IncomingMessage, res: http.ServerResponse, next: NextFunction) => void): void

	route(
		route: string,
		cb: (params: Params, req: IncomingMessage, res: ServerResponse /*, next: () => void*/) => Promise<void>
	): void {
		this.#router.route(route, (params, req, res) => {
			waitForPromise(cb(params, req, res))
		})
	}
}

// Set up and expose server-side router:

const PickerPOSTInner = Picker.filter((req) => req.method === 'POST')
PickerPOSTInner.middleware(
	bodyParser.json({
		limit: '200mb', // Arbitrary limit
	})
)
PickerPOSTInner.middleware(
	bodyParser.text({
		type: 'application/json',
		limit: '200mb',
	})
)
PickerPOSTInner.middleware(
	bodyParser.text({
		type: 'text/javascript',
		limit: '200mb',
	})
)

export const PickerPOST = new AsyncRouter(PickerPOSTInner)

export const PickerGET = new AsyncRouter(Picker.filter((req, _res) => req.method === 'GET'))

export const PickerDELETE = new AsyncRouter(Picker.filter((req, _res) => req.method === 'DELETE'))
