import { Methods, setMeteorMethods } from '../../lib/methods'
import { SystemStatusAPI, StatusResponse } from '../../lib/api/systemStatus'
import { getSystemStatus } from './systemStatus'
import { ServerResponse, IncomingMessage } from 'http'
import { Picker } from 'meteor/meteorhacks:picker'

let methods: Methods = {}

methods[SystemStatusAPI.getSystemStatus] = () => {
	return getSystemStatus()
}
setMeteorMethods(methods)

// Server routes:
Picker.route('/health', (params, req: IncomingMessage, res: ServerResponse, next) => {
	let status = getSystemStatus()
	health(status, res)
})
Picker.route('/health/:studioId', (params, req: IncomingMessage, res: ServerResponse, next) => {
	let status = getSystemStatus(params.studioId)
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
