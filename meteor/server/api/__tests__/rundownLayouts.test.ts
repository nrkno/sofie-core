import '../../../__mocks__/_extendJest'
import { testInFiber } from '../../../__mocks__/helpers/jest'
import { setupDefaultStudioEnvironment, DefaultEnvironment } from '../../../__mocks__/helpers/database'
import { protectString, literal, unprotectString, getRandomString } from '../../../lib/lib'
import { PickerMock, parseResponseBuffer, MockResponseDataString } from '../../../__mocks__/meteorhacks-picker'
import { Response as MockResponse, Request as MockRequest } from 'mock-http'
import { RundownLayoutType, RundownLayout, CustomizableRegions } from '../../../lib/collections/RundownLayouts'
import { MeteorCall } from '../../../lib/api/methods'
import { RundownLayoutId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { RundownLayouts } from '../../collections'
import { SupressLogMessages } from '../../../__mocks__/suppressLogging'

require('../client') // include in order to create the Meteor methods needed
require('../rundownLayouts') // include in order to create the Meteor methods needed

describe('Rundown Layouts', () => {
	let env: DefaultEnvironment
	beforeAll(async () => {
		env = await setupDefaultStudioEnvironment()
	})
	let rundownLayoutId: RundownLayoutId
	testInFiber('Create rundown layout', async () => {
		const res = await MeteorCall.rundownLayout.createRundownLayout(
			'Test',
			RundownLayoutType.RUNDOWN_LAYOUT,
			env.showStyleBaseId,
			'shelf_layouts'
		)
		expect(typeof res).toBe('string') // this should contain the ID for the rundown layout
		rundownLayoutId = res

		const item = await RundownLayouts.findOneAsync(rundownLayoutId)
		expect(item).toMatchObject({
			_id: rundownLayoutId,
		})
	})
	testInFiber('Remove rundown layout', async () => {
		const item0 = await RundownLayouts.findOneAsync(rundownLayoutId)
		expect(item0).toMatchObject({
			_id: rundownLayoutId,
		})

		await MeteorCall.rundownLayout.removeRundownLayout(rundownLayoutId)

		const item1 = await RundownLayouts.findOneAsync(rundownLayoutId)
		expect(item1).toBeUndefined()
	})

	describe('HTTP API', () => {
		function makeMockLayout(env: DefaultEnvironment) {
			const rundownLayoutId = getRandomString()
			const mockLayout = literal<RundownLayout>({
				_id: protectString(rundownLayoutId),
				name: 'MOCK LAYOUT',
				filters: [],
				showStyleBaseId: env.showStyleBaseId,
				type: RundownLayoutType.RUNDOWN_LAYOUT,
				exposeAsStandalone: false,
				icon: '',
				iconColor: '',
				showInspector: true,
				openByDefault: false,
				disableContextMenu: true,
				hideDefaultStartExecute: false,
				regionId: CustomizableRegions.Shelf,
				isDefaultLayout: false,
			})
			return { rundownLayout: mockLayout, rundownLayoutId }
		}

		testInFiber('download shelf layout', async () => {
			const { rundownLayout: mockLayout, rundownLayoutId } = makeMockLayout(env)
			await RundownLayouts.insertAsync(mockLayout)

			const routeName = '/shelfLayouts/download/:id'
			const route = PickerMock.mockRoutes[routeName]
			expect(route).toBeTruthy()

			{
				const fakeId = 'FAKE_ID'
				const res = new MockResponse()
				const req = new MockRequest({
					method: 'GET',
					url: `/shelfLayouts/download/${fakeId}`,
				})

				await route.handler({ id: fakeId }, req, res, jest.fn())

				const resStr = parseResponseBuffer(res)
				expect(resStr).toMatchObject(
					literal<Partial<MockResponseDataString>>({
						statusCode: 404,
						timedout: false,
						ended: true,
					})
				)
				expect(resStr.bufferStr).toContain('not found')
			}

			{
				const res = new MockResponse()
				const req = new MockRequest({
					method: 'GET',
					url: `/shelfLayouts/download/${rundownLayoutId}`,
				})

				await route.handler({ id: rundownLayoutId }, req, res, jest.fn())

				const resStr = parseResponseBuffer(res)
				expect(resStr).toMatchObject(
					literal<Partial<MockResponseDataString>>({
						statusCode: 200,
						headers: {
							'content-type': 'application/json',
						},
						timedout: false,
						ended: true,
					})
				)

				const layout = JSON.parse(resStr.bufferStr)
				expect(layout).toMatchObject(mockLayout)
			}
		})

		testInFiber('upload shelf layout', async () => {
			const { rundownLayout: mockLayout } = makeMockLayout(env)
			const routeName = '/shelfLayouts/upload/:showStyleBaseId'
			const route = PickerMock.mockRoutes[routeName]
			expect(route).toBeTruthy()

			{
				// try to upload to a non-existent showStyleBase
				const fakeId = 'FAKE_ID'
				const res = new MockResponse()
				const req = new MockRequest({
					method: 'POST',
					url: `/shelfLayouts/upload/${fakeId}`,
				})
				req.body = JSON.stringify(mockLayout)

				SupressLogMessages.suppressLogMessage(/"FAKE_ID" not found/i)
				await route.handler({ showStyleBaseId: fakeId }, req, res, jest.fn())

				const resStr = parseResponseBuffer(res)
				expect(resStr).toMatchObject(
					literal<Partial<MockResponseDataString>>({
						statusCode: 500,
						timedout: false,
						ended: true,
					})
				)
				expect(resStr.bufferStr).toContain('not found')
			}

			{
				// try not to send a request body
				const res = new MockResponse()
				const req = new MockRequest({
					method: 'POST',
					url: `/shelfLayouts/upload/${env.showStyleBaseId}`,
				})

				SupressLogMessages.suppressLogMessage(/Missing request body/i)
				await route.handler({ showStyleBaseId: unprotectString(env.showStyleBaseId) }, req, res, jest.fn())

				const resStr = parseResponseBuffer(res)
				expect(resStr).toMatchObject(
					literal<Partial<MockResponseDataString>>({
						statusCode: 500,
						timedout: false,
						ended: true,
					})
				)
				expect(resStr.bufferStr).toContain('body')
			}

			{
				// try to send too short a body
				const res = new MockResponse()
				const req = new MockRequest({
					method: 'POST',
					url: `/shelfLayouts/upload/${env.showStyleBaseId}`,
				})
				req.body = 'sdf'

				SupressLogMessages.suppressLogMessage(/Invalid request body/i)
				await route.handler({ showStyleBaseId: unprotectString(env.showStyleBaseId) }, req, res, jest.fn())

				const resStr = parseResponseBuffer(res)
				expect(resStr).toMatchObject(
					literal<Partial<MockResponseDataString>>({
						statusCode: 500,
						timedout: false,
						ended: true,
					})
				)
				expect(resStr.bufferStr).toContain('body')
			}

			{
				// try to send a malformed body
				const res = new MockResponse()
				const req = new MockRequest({
					method: 'POST',
					url: `/shelfLayouts/upload/${env.showStyleBaseId}`,
				})
				req.body = '{ type: dsfgsdfgsdf gsdfgsdfg sdfgsdfg sdf gsdfgsdfg sdfg }'

				SupressLogMessages.suppressLogMessage(/SyntaxError/i)
				await route.handler({ showStyleBaseId: unprotectString(env.showStyleBaseId) }, req, res, jest.fn())

				const resStr = parseResponseBuffer(res)
				expect(resStr).toMatchObject(
					literal<Partial<MockResponseDataString>>({
						statusCode: 500,
						timedout: false,
						ended: true,
					})
				)
				expect(resStr.bufferStr).toContain('SyntaxError')
			}

			{
				const res = new MockResponse()
				const req = new MockRequest({
					method: 'POST',
					url: `/shelfLayouts/upload/${env.showStyleBaseId}`,
				})
				req.body = JSON.stringify(mockLayout)

				await route.handler({ showStyleBaseId: unprotectString(env.showStyleBaseId) }, req, res, jest.fn())

				const resStr = parseResponseBuffer(res)
				expect(resStr).toMatchObject(
					literal<Partial<MockResponseDataString>>({
						statusCode: 200,
						timedout: false,
						ended: true,
					})
				)

				expect(await RundownLayouts.findOneAsync(mockLayout._id)).toBeTruthy()
			}
		})
	})
})
