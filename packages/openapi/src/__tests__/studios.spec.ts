// eslint-disable-next-line node/no-missing-import
import { Configuration, StudiosApi } from '../../client/ts'
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

	const studiosApi = new StudiosApi(config)
	if (testServer) {
		test('can request all Studios', async () => {
			const studios = await studiosApi.getStudios()
			expect(studios.success).toBe(200)
		})
	} else {
		test.todo('Yet to be implemented')
	}

	if (testServer) {
		test('can add a new Studio', async () => {
			const studio = await studiosApi.addStudio({
				addStudioRequest: {
					studio: {
						name: '',
						blueprintId: '',
						config: {},
						settings: {
							frameRate: 25,
							mediaPreviewsUrl: 'http://127.0.0.1:8080',
						},
					},
				},
			})
			expect(studio.success).toBe(200)
		})

		test('can request a Studio by id', async () => {
			const studio = await studiosApi.getStudio({
				studioId: 'B0avqzSM41UJDpbyf3U28',
			})
			expect(studio.success).toBe(200)
		})

		test('can update a studio', async () => {
			const studio = await studiosApi.addOrUpdateStudio({
				studioId: 'B0avqzSM41UJDpbyf3U28',
				addStudioRequest: {
					studio: {
						name: '',
						blueprintId: '',
						config: {},
						settings: {
							frameRate: 25,
							mediaPreviewsUrl: 'http://127.0.0.1:8080',
						},
					},
				},
			})
			expect(studio.success).toBe(200)
		})

		test('can remove a Studio by id', async () => {
			const studio = await studiosApi.deleteStudio({
				studioId: 'B0avqzSM41UJDpbyf3U28',
			})
			expect(studio.success).toBe(200)
		})

		test('can activate a route set in a studio', async () => {
			const routeSet = await studiosApi.switchRouteSet({
				studioId: 'B0avqzSM41UJDpbyf3U28',
				switchRouteSetRequest: { routeSetId: 'Main', active: true },
			})
			expect(routeSet.success).toBe(200)
		})

		test('can deactivate a route set in a studio', async () => {
			const routeSet = await studiosApi.switchRouteSet({
				studioId: 'B0avqzSM41UJDpbyf3U28',
				switchRouteSetRequest: { routeSetId: 'Main', active: false },
			})
			expect(routeSet.success).toBe(200)
		})

		test('can request a list of devices for a studio', async () => {
			const devices = await studiosApi.devices({ studioId: 'B0avqzSM41UJDpbyf3U28' })
			expect(devices.success).toBe(200)
		})

		test('can attach a device to a studio', async () => {
			const attach = await studiosApi.attachDevice({
				studioId: 'B0avqzSM41UJDpbyf3U28',
				attachDeviceRequest: {
					deviceId: 'playoutgateway0',
				},
			})
			expect(attach.success).toBe(200)
		})

		test('can detach a device from a studio', async () => {
			const detach = await studiosApi.detachDevice({
				studioId: 'B0avqzSM41UJDpbyf3U28',
				deviceId: 'playoutgateway0',
			})
			expect(detach.success).toBe(200)
		})
	} else {
		test.todo('Setup mocks for Sofie')
	}
})
