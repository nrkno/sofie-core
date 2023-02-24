// eslint-disable-next-line node/no-missing-import
import { Configuration, DevicesApi } from '../../client/ts'
import { checkServer } from '../checkServer'
import Logging from '../httpLogging'

const httpLogging = false
const testServer = process.env.SERVER_TYPE === 'TEST'

describe('Network client', () => {
	const config = new Configuration({
		basePath: process.env.ACTIONS_URL,
		middleware: [new Logging(httpLogging)],
	})

	beforeAll(async () => await checkServer(config))

	const devicesApi = new DevicesApi(config)
	const deviceIds: string[] = []
	test('can request all peripheral devices attached to Sofie', async () => {
		const devices = await devicesApi.devices()
		expect(devices.success).toBe(200)
		expect(devices).toHaveProperty('result')
		devices.result.forEach((id) => deviceIds.push(id))
	})

	test('can request details of a specified peripheral device attached to Sofie', async () => {
		const device = await devicesApi.device({ deviceId: deviceIds[0] })
		expect(device.success).toBe(200)
		expect(device).toHaveProperty('result')
		expect(device.result).toHaveProperty('id')
		expect(device.result).toHaveProperty('name')
		expect(device.result).toHaveProperty('status')
		expect(device.result).toHaveProperty('messages')
		expect(device.result).toHaveProperty('deviceType')
		expect(device.result).toHaveProperty('connected')
	})

	if (testServer) {
		test('can send a command to a specified peripheral device', async () => {
			const action = await devicesApi.action({
				deviceId: deviceIds[0],
				actionRequest: { action: 'restart' },
			})
			expect(action.success).toBe(202)
		})
	} else {
		test.todo(`Add an action that doesn't kill the peripheral device!`)
	}
})
