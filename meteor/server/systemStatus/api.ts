import { registerClassToMeteorMethods } from '../methods'
import { StatusResponse, NewSystemStatusAPI, SystemStatusAPIMethods } from '../../lib/api/systemStatus'
import { getSystemStatus } from './systemStatus'
import { ServerResponse, IncomingMessage } from 'http'
import { Picker } from 'meteor/meteorhacks:picker'
import { protectString, makePromise } from '../../lib/lib'

// Server routes:
Picker.route('/health', (params, req: IncomingMessage, res: ServerResponse) => {
	let status = getSystemStatus()
	health(status, res)
})
Picker.route('/health/:studioId', (params, req: IncomingMessage, res: ServerResponse) => {
	let status = getSystemStatus(protectString(params.studioId))
	health(status, res)
})
function health (status: StatusResponse, res: ServerResponse) {
	res.setHeader('Content-Type', 'application/json')
	let content = ''

	res.statusCode = (
			(
			status.status === 'OK' ||
			status.status === 'WARNING'
		) ?
		200 :
		500
	)

	content = JSON.stringify(status)
	res.end(content)
}

class ServerSystemStatusAPI implements NewSystemStatusAPI {
	getSystemStatus () {
		return makePromise(() => getSystemStatus())
	}
}
registerClassToMeteorMethods(SystemStatusAPIMethods, ServerSystemStatusAPI, false)
