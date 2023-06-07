import { IncomingMessage, ServerResponse } from 'http'
import { PickerGET } from '../http'

import './v0/index'
import './v1/index'

const LATEST_REST_API = 'v1.0'

PickerGET.route('/api', redirectToLatest)
PickerGET.route('/api/latest', redirectToLatest)

async function redirectToLatest(_params, _req: IncomingMessage, res: ServerResponse): Promise<void> {
	res.statusCode = 307
	res.setHeader('Location', `/api/${LATEST_REST_API}`) // redirect to latest API version
	res.end()
}
