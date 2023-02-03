import * as _ from 'underscore'
import { testInFiber } from '../../../../__mocks__/helpers/jest'
import { literal } from '../../../../lib/lib'
import { Meteor } from 'meteor/meteor'
import { PickerMock, parseResponseBuffer, MockResponseDataString } from '../../../../__mocks__/meteorhacks-picker'
import { Response as MockResponse, Request as MockRequest } from 'mock-http'

jest.mock('../../deviceTriggers/observer')
import * as api from '../api'
jest.mock('../api.ts')

const DEFAULT_CONTEXT = { userId: '' }

require('../http.ts') // include in order to create the Meteor methods needed

describe('Test blueprint http api', () => {
	describe('router restore single', () => {
		async function callRoute(
			blueprintId: string,
			body: any,
			name?: string,
			force?: boolean
		): Promise<MockResponseDataString> {
			const routeName = '/blueprints/restore/:blueprintId'
			const route = PickerMock.mockRoutes[routeName]
			expect(route).toBeTruthy()

			const queryParams = _.compact([name ? `name=${name}` : undefined, force ? 'force=1' : undefined])

			const res = new MockResponse()
			const req = new MockRequest({
				method: 'POST',
				url: `/blueprints/restore/${blueprintId}?` + queryParams.join('&'),
			})
			req.body = body

			await route.handler({ blueprintId }, req, res, jest.fn())

			const resStr = parseResponseBuffer(res)
			expect(resStr).toMatchObject(
				literal<Partial<MockResponseDataString>>({
					headers: {
						'content-type': 'text/plain',
					},
					timedout: false,
					ended: true,
				})
			)
			return resStr
		}

		function resetUploadMock() {
			const uploadBlueprint = api.uploadBlueprint as any as jest.MockInstance<any, any>
			uploadBlueprint.mockClear()
			return uploadBlueprint
		}

		beforeEach(() => {
			resetUploadMock()
		})

		testInFiber('missing body', async () => {
			const res = await callRoute('id1', undefined)
			expect(res.statusCode).toEqual(500)
			expect(res.bufferStr).toEqual('[400] Restore Blueprint: Missing request body')

			expect(api.uploadBlueprint).toHaveBeenCalledTimes(0)
		})
		testInFiber('empty body', async () => {
			const res = await callRoute('id1', '')
			expect(res.statusCode).toEqual(500)
			expect(res.bufferStr).toEqual('[400] Restore Blueprint: Missing request body')

			expect(api.uploadBlueprint).toHaveBeenCalledTimes(0)
		})
		testInFiber('non-string body', async () => {
			const id = 'id1'
			const body = 99

			const res = await callRoute(id, body)
			expect(res.statusCode).toEqual(500)
			expect(res.bufferStr).toEqual('[400] Restore Blueprint: Invalid request body')

			expect(api.uploadBlueprint).toHaveBeenCalledTimes(0)
		})
		testInFiber('with body', async () => {
			const id = 'id1'
			const body = '0123456789'

			const res = await callRoute(id, body)
			expect(res.statusCode).toEqual(200)
			expect(res.bufferStr).toEqual('')

			expect(api.uploadBlueprint).toHaveBeenCalledTimes(1)
			expect(api.uploadBlueprint).toHaveBeenCalledWith(DEFAULT_CONTEXT, id, body, undefined, false)
		})
		testInFiber('with body & force', async () => {
			const id = 'id1'
			const body = '0123456789'

			const res = await callRoute(id, body, undefined, true)
			expect(res.statusCode).toEqual(200)
			expect(res.bufferStr).toEqual('')

			expect(api.uploadBlueprint).toHaveBeenCalledTimes(1)
			expect(api.uploadBlueprint).toHaveBeenCalledWith(DEFAULT_CONTEXT, id, body, undefined, true)
		})
		testInFiber('internal error', async () => {
			const id = 'id1'
			const body = '0123456789'

			const uploadBlueprint = resetUploadMock()
			uploadBlueprint.mockImplementation(() => {
				throw new Meteor.Error(505, 'Some thrown error')
			})

			try {
				const res = await callRoute(id, body)

				expect(res.statusCode).toEqual(500)
				expect(res.bufferStr).toEqual('[505] Some thrown error')

				expect(api.uploadBlueprint).toHaveBeenCalledTimes(1)
				expect(api.uploadBlueprint).toHaveBeenCalledWith(DEFAULT_CONTEXT, id, body, undefined, false)
			} finally {
				uploadBlueprint.mockRestore()
			}
		})
		testInFiber('with name', async () => {
			const id = 'id1'
			const body = '0123456789'
			const name = 'custom_name'

			const res = await callRoute(id, body, name)
			// expect(res.statusCode).toEqual(200)
			expect(res.bufferStr).toEqual('')

			expect(api.uploadBlueprint).toHaveBeenCalledTimes(1)
			expect(api.uploadBlueprint).toHaveBeenCalledWith(DEFAULT_CONTEXT, id, body, name, false)
		})
	})

	describe('router restore bulk', () => {
		async function callRoute(body: any): Promise<MockResponseDataString> {
			const routeName = '/blueprints/restore'
			const route = PickerMock.mockRoutes[routeName]
			expect(route).toBeTruthy()

			const res = new MockResponse()
			const req = new MockRequest({
				method: 'POST',
				url: `${routeName}?force=1`,
			})
			req.body = body

			await route.handler({}, req, res, jest.fn())

			const resStr = parseResponseBuffer(res)
			expect(resStr).toMatchObject(
				literal<Partial<MockResponseDataString>>({
					headers: {
						'content-type': 'text/plain',
					},
					timedout: false,
					ended: true,
				})
			)
			return resStr
		}

		function resetUploadMock() {
			const uploadBlueprint = api.uploadBlueprint as any as jest.MockInstance<any, any>
			uploadBlueprint.mockClear()
			return uploadBlueprint
		}

		beforeEach(() => {
			resetUploadMock()
		})

		testInFiber('missing body', async () => {
			const res = await callRoute(undefined)
			expect(res.statusCode).toEqual(500)
			expect(res.bufferStr).toEqual('[400] Restore Blueprint: Missing request body')

			expect(api.uploadBlueprint).toHaveBeenCalledTimes(0)
		})
		testInFiber('empty body', async () => {
			const res = await callRoute('')
			expect(res.statusCode).toEqual(500)
			expect(res.bufferStr).toEqual('[400] Restore Blueprint: Missing request body')

			expect(api.uploadBlueprint).toHaveBeenCalledTimes(0)
		})
		testInFiber('non-string body', async () => {
			const body = 99

			const res = await callRoute(body)
			expect(res.statusCode).toEqual(500)
			expect(res.bufferStr).toEqual('[400] Restore Blueprint: Invalid request body')

			expect(api.uploadBlueprint).toHaveBeenCalledTimes(0)
		})
		testInFiber('invalid body', async () => {
			const body = '99'

			const res = await callRoute(body)
			expect(res.statusCode).toEqual(500)
			expect(res.bufferStr).toEqual('[400] Restore Blueprint: Invalid request body')

			expect(api.uploadBlueprint).toHaveBeenCalledTimes(0)
		})
		testInFiber('non-json body', async () => {
			const body = '0123456789012'

			const res = await callRoute(body)
			expect(res.statusCode).toEqual(500)
			expect(res.bufferStr).toEqual('[400] Restore Blueprint: Failed to parse request body')

			expect(api.uploadBlueprint).toHaveBeenCalledTimes(0)
		})
		testInFiber('with json body', async () => {
			const id = 'id1'
			const body = 'bodyStr1'

			const payload: any = {
				blueprints: {},
			}
			payload.blueprints[id] = body

			const res = await callRoute(JSON.stringify(payload))
			expect(res.statusCode).toEqual(200)
			expect(res.bufferStr).toEqual('')

			expect(api.uploadBlueprint).toHaveBeenCalledTimes(1)
			expect(api.uploadBlueprint).toHaveBeenCalledWith(DEFAULT_CONTEXT, id, body, id)
		})
		testInFiber('with json body as object', async () => {
			const id = 'id1'
			const body = 'bodyStr1'

			const payload: any = {
				blueprints: {},
			}
			payload.blueprints[id] = body

			const res = await callRoute(payload)
			expect(res.statusCode).toEqual(200)
			expect(res.bufferStr).toEqual('')

			expect(api.uploadBlueprint).toHaveBeenCalledTimes(1)
			expect(api.uploadBlueprint).toHaveBeenCalledWith(DEFAULT_CONTEXT, id, body, id)
		})
		testInFiber('with json body - multiple', async () => {
			const count = 10

			const payload: any = {
				blueprints: {},
			}
			for (let i = 0; i < count; i++) {
				payload.blueprints[`id${i}`] = `body${i}`
			}

			const res = await callRoute(JSON.stringify(payload))
			expect(res.statusCode).toEqual(200)
			expect(res.bufferStr).toEqual('')

			expect(api.uploadBlueprint).toHaveBeenCalledTimes(count)
			for (let i = 0; i < count; i++) {
				expect(api.uploadBlueprint).toHaveBeenCalledWith(DEFAULT_CONTEXT, `id${i}`, `body${i}`, `id${i}`)
			}
		})
		testInFiber('with errors', async () => {
			const count = 10

			const payload: any = {
				blueprints: {},
			}
			for (let i = 0; i < count; i++) {
				payload.blueprints[`id${i}`] = `body${i}`
			}

			const uploadBlueprint = resetUploadMock()
			let called = 0
			uploadBlueprint.mockImplementation(() => {
				called++
				if (called === 3 || called === 7) {
					throw new Meteor.Error(505, 'Some thrown error')
				}
			})

			try {
				const res = await callRoute(JSON.stringify(payload))
				expect(res.statusCode).toEqual(500)
				expect(res.bufferStr).toEqual(
					'Errors were encountered: \n[505] Some thrown error\n[505] Some thrown error\n'
				)

				expect(api.uploadBlueprint).toHaveBeenCalledTimes(count)
				for (let i = 0; i < count; i++) {
					expect(api.uploadBlueprint).toHaveBeenCalledWith(DEFAULT_CONTEXT, `id${i}`, `body${i}`, `id${i}`)
				}
			} finally {
				uploadBlueprint.mockRestore()
			}
		})
	})
})
