import { IncomingMessage, ServerResponse } from 'http'
import { MethodContextAPI } from '../../lib/api/methods'
import { NewSystemStatusAPI, StatusResponse, SystemStatusAPIMethods } from '../../lib/api/systemStatus'
import { makePromise, protectString } from '../../lib/lib'
import { Settings } from '../../lib/Settings'
import { PickerGET } from '../api/http'
import { registerClassToMeteorMethods } from '../methods'
import { getSystemStatus } from './systemStatus'

if (!Settings.enableUserAccounts) {
	// For backwards compatibility:

	PickerGET.route('/health', (params, req: IncomingMessage, res: ServerResponse) => {
		let status = getSystemStatus({ userId: null })
		health(status, res)
	})
	PickerGET.route('/health/:studioId', (params, req: IncomingMessage, res: ServerResponse) => {
		let status = getSystemStatus({ userId: null }, protectString(params.studioId))
		health(status, res)
	})
}
PickerGET.route('/health/:token', (params, req: IncomingMessage, res: ServerResponse) => {
	let status = getSystemStatus({ userId: null, token: params.token })
	health(status, res)
})
PickerGET.route('/health/:token/:studioId', (params, req: IncomingMessage, res: ServerResponse) => {
	let status = getSystemStatus({ userId: null, token: params.token }, protectString(params.studioId))
	health(status, res)
})
function health(status: StatusResponse, res: ServerResponse) {
	res.setHeader('Content-Type', 'application/json')
	let content = ''

	res.statusCode = status.status === 'OK' || status.status === 'WARNING' ? 200 : 500

	content = JSON.stringify(status)
	res.end(content)
}

class ServerSystemStatusAPI extends MethodContextAPI implements NewSystemStatusAPI {
	getSystemStatus() {
		return makePromise(() => getSystemStatus(this))
	}
}
registerClassToMeteorMethods(SystemStatusAPIMethods, ServerSystemStatusAPI, false)
