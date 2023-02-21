// eslint-disable-next-line node/no-missing-import
import { Configuration, DevicesApi } from '../../client/ts'
import { checkServer } from '../checkServer'
import Logging from '../httpLogging'

const httpLogging = false
const testServer = process.env.SERVER_TYPE === 'TEST'

describe('Network client', () => {
	const config = new Configuration({
		basePath: process.env.ACTIONS_URL,
		middleware: httpLogging ? [new Logging()] : [],
	})

	beforeAll(async () => await checkServer(config))

	const devicesApi = new DevicesApi(config)
	if (testServer) {
		test('can request all peripheral devices attached to Sofie', async () => {
			const devices = await devicesApi.devices()
			expect(devices.success).toBe(200)
		})
	} else {
		test.todo('Yet to be implemented')
	}

	if (testServer) {
		test('can request details of a specified peripheral device attached to Sofie', async () => {
			const device = await devicesApi.device({ deviceId: 'playoutgateway0' })
			expect(device.success).toBe(200)
		})
	} else {
		test.todo('Enumerate attached devices')
	}

	if (testServer) {
		test('can send a command to a specified peripheral device', async () => {
			const action = await devicesApi.action({
				deviceId: 'playoutgateway0',
				actionRequest: { action: 'restart' },
			})
			expect(action.success).toBe(202)
		})
	} else {
		test.todo('Setup mocks for Sofie')
	}
})
