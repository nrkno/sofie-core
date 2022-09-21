import { registerClassToMeteorMethods } from '../methods'
import { StatusResponse, NewSystemStatusAPI, SystemStatusAPIMethods } from '../../lib/api/systemStatus'
import { getSystemStatus } from './systemStatus'
import { ServerResponse, IncomingMessage } from 'http'
import { PickerGET } from '../api/http'
import { protectString } from '../../lib/lib'

import { Settings } from '../../lib/Settings'
import { MethodContextAPI } from '../../lib/api/methods'
import { profiler } from '../api/profiler'

const apmNamespace = 'http'

if (!Settings.enableUserAccounts) {
	// For backwards compatibility:

	PickerGET.route('/health', async (_params, _req: IncomingMessage, res: ServerResponse) => {
		const transaction = profiler.startTransaction('health', apmNamespace)
		const status = await getSystemStatus({ userId: null })
		health(status, res)
		transaction?.end()
	})
	PickerGET.route('/health/:studioId', async (params, _req: IncomingMessage, res: ServerResponse) => {
		const transaction = profiler.startTransaction(`health/${params.studioId}`, apmNamespace)
		const status = await getSystemStatus({ userId: null }, protectString(params.studioId))
		health(status, res)
		transaction?.end()
	})
}
PickerGET.route('/health/:token', async (params, _req: IncomingMessage, res: ServerResponse) => {
	const status = await getSystemStatus({ userId: null, token: params.token })
	health(status, res)
})
PickerGET.route('/health/:token/:studioId', async (params, _req: IncomingMessage, res: ServerResponse) => {
	const status = await getSystemStatus({ userId: null, token: params.token }, protectString(params.studioId))
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
	async getSystemStatus() {
		return getSystemStatus(this)
	}
}
registerClassToMeteorMethods(SystemStatusAPIMethods, ServerSystemStatusAPI, false)
