import { registerClassToMeteorMethods } from '../methods'
import { StatusResponse, NewSystemStatusAPI, SystemStatusAPIMethods } from '../../lib/api/systemStatus'
import { getDebugStates, getSystemStatus } from './systemStatus'
import { ServerResponse, IncomingMessage } from 'http'
import { PickerGET } from '../api/http'
import { protectString } from '../../lib/lib'
import { Settings } from '../../lib/Settings'
import { MethodContextAPI } from '../../lib/api/methods'
import { profiler } from '../api/profiler'
import { PeripheralDeviceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PrometheusHTTPContentType, getPrometheusMetricsString } from '@sofie-automation/corelib/dist/prometheus'
import { collectWorkerPrometheusMetrics } from '../worker/worker'

const apmNamespace = 'http'

if (!Settings.enableUserAccounts) {
	// For backwards compatibility:

	PickerGET.route('/metrics', async (_params, _req: IncomingMessage, res: ServerResponse) => {
		const transaction = profiler.startTransaction('metrics', apmNamespace)
		try {
			res.setHeader('Content-Type', PrometheusHTTPContentType)

			const [meteorMetrics, workerMetrics] = await Promise.all([
				getPrometheusMetricsString(),
				collectWorkerPrometheusMetrics(),
			])

			res.end([meteorMetrics, ...workerMetrics].join('\n\n'))
		} catch (ex) {
			res.statusCode = 500
			res.end(ex)
		}
		transaction?.end()
	})

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

	async getDebugStates(peripheralDeviceId: PeripheralDeviceId) {
		return getDebugStates(this, peripheralDeviceId)
	}
}
registerClassToMeteorMethods(SystemStatusAPIMethods, ServerSystemStatusAPI, false)
