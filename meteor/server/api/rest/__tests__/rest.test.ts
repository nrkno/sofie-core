import * as _ from 'underscore'
import { testInFiber } from '../../../../__mocks__/helpers/jest'
import { MeteorMock } from '../../../../__mocks__/meteor'
import { Meteor } from 'meteor/meteor'
import { PickerMock, parseResponseBuffer, MockResponseDataString } from '../../../../__mocks__/meteorhacks-picker'
import { Response as MockResponse, Request as MockRequest } from 'mock-http'

import { UserActionAPIMethods } from '../../../../lib/api/userActions'
import { MeteorMethodSignatures } from '../../../methods'
import { ClientAPI } from '../../../../lib/api/client'
import '../../userActions.ts' // required to get the UserActionsAPI methods populated

// we don't want the deviceTriggers observer to start up at this time
jest.mock('../../deviceTriggers/observer')

import '../rest.ts'

describe('REST API', () => {
	describe('UNSTABLE v0', () => {
		async function callRoute(
			routeName: string,
			url: string,
			params: Record<string, any>
		): Promise<MockResponseDataString> {
			const route = PickerMock.mockRoutes[routeName]
			expect(route).toBeTruthy()
			const res = new MockResponse()
			const req = new MockRequest({
				method: 'POST',
				url,
			})

			await route.handler(params, req, res, jest.fn())

			return parseResponseBuffer(res)
		}

		testInFiber('registers endpoints for all UserActionAPI methods', () => {
			MeteorMock.mockRunMeteorStartup()

			Object.keys(UserActionAPIMethods).forEach((methodName) => {
				const methodValue = UserActionAPIMethods[methodName]
				const signature = MeteorMethodSignatures[methodValue]

				let resource = `/api/0/action/${methodName}`
				const params: Record<string, any> = {}
				_.each(signature || [], (paramName, i) => {
					resource += `/:param${i}`
					params[paramName] = ''
				})

				const route = PickerMock.mockRoutes[resource]
				expect(route).toBeTruthy()
			})
		})

		testInFiber('calls the UserActionAPI methods, when doing a POST to the endpoint', async () => {
			MeteorMock.mockRunMeteorStartup()

			await Promise.all(
				Object.keys(UserActionAPIMethods).map(async (methodName) => {
					const methodValue = UserActionAPIMethods[methodName]
					const signature = MeteorMethodSignatures[methodValue]

					let resource = `/api/0/action/${methodName}`
					let docString = resource
					const params: Record<string, any> = {}
					_.each(signature || [], (paramName, i) => {
						resource += `/:param${i}`
						docString += `/${paramName}`
						params[paramName] = ''
					})

					jest.spyOn(MeteorMock.mockMethods as any, methodValue).mockReturnValue(
						ClientAPI.responseSuccess(undefined)
					)

					const result = await callRoute(resource, docString, params)
					expect(result.statusCode).toBe(200)
					expect(result.headers).toMatchObject({
						'content-type': 'application/json',
					})
					expect(JSON.parse(result.bufferStr)).toMatchObject({
						success: 200,
					})
				})
			)
		})

		testInFiber('returns a matching HTTP error code when method throws a Meteor.Error', async () => {
			MeteorMock.mockRunMeteorStartup()

			const methodName = Object.keys(UserActionAPIMethods)[0]

			const methodValue = UserActionAPIMethods[methodName]
			const signature = MeteorMethodSignatures[methodValue]

			let resource = `/api/0/action/${methodName}`
			let docString = resource
			const params: Record<string, any> = {}
			_.each(signature || [], (paramName, i) => {
				resource += `/:param${i}`
				docString += `/${paramName}`
				params[paramName] = ''
			})

			jest.spyOn(MeteorMock.mockMethods as any, methodValue).mockImplementation(() => {
				throw new Meteor.Error(401, 'Mock error')
			})

			const result = await callRoute(resource, docString, params)
			expect(result.statusCode).toBe(401)
			expect(result.headers).toMatchObject({
				'content-type': 'text/plain',
			})
			expect(result.bufferStr).toMatch('Mock error')
		})

		testInFiber('returns a 500 HTTP error code when method throws a Node Exception', async () => {
			MeteorMock.mockRunMeteorStartup()

			const methodName = Object.keys(UserActionAPIMethods)[0]

			const methodValue = UserActionAPIMethods[methodName]
			const signature = MeteorMethodSignatures[methodValue]

			let resource = `/api/0/action/${methodName}`
			let docString = resource
			const params: Record<string, any> = {}
			_.each(signature || [], (paramName, i) => {
				resource += `/:param${i}`
				docString += `/${paramName}`
				params[paramName] = ''
			})

			jest.spyOn(MeteorMock.mockMethods as any, methodValue).mockImplementation(() => {
				throw new Error('Mock error')
			})

			const result = await callRoute(resource, docString, params)
			expect(result.statusCode).toBe(500)
			expect(result.headers).toMatchObject({
				'content-type': 'text/plain',
			})
			expect(result.bufferStr).toMatch('Mock error')
		})

		testInFiber('converts URL arguments from string to correct native types', async () => {
			MeteorMock.mockRunMeteorStartup()

			const methodName = Object.keys(UserActionAPIMethods)[0]

			const methodValue = UserActionAPIMethods[methodName]
			const signature = MeteorMethodSignatures[methodValue]

			let resource = `/api/0/action/${methodName}`
			let docString = resource
			_.each(signature || [], (paramName, i) => {
				resource += `/:param${i}`
				docString += `/${paramName}`
			})

			const params: Record<string, any> = {
				param0: 'one',
				param1: true,
				param2: false,
				param3: { one: 'two' },
				param4: null,
				param5: 1.323,
				param6: 30,
			}

			const stringified: Record<string, string> = {}
			Object.entries<any>(params).forEach(([key, value]) => {
				if (typeof value === 'string') {
					stringified[key] = value
				} else {
					stringified[key] = JSON.stringify(value)
				}
			})

			let resultingArgs: any[] = []

			jest.spyOn(MeteorMock.mockMethods as any, methodValue).mockImplementation((...args) => {
				resultingArgs = args
				return ClientAPI.responseSuccess(undefined)
			})

			const result = await callRoute(resource, docString, stringified)
			expect(result.statusCode).toBe(200)
			expect(resultingArgs).toMatchObject(Object.values<any>(params))
		})

		testInFiber('lists available endpoints on /api/0', async () => {
			MeteorMock.mockRunMeteorStartup()

			const rootResource = `/api/0`
			const rootDocString = rootResource

			const result = await callRoute(rootResource, rootDocString, {})
			expect(result.statusCode).toBe(200)
			expect(result.headers).toMatchObject({
				'content-type': 'application/json',
			})

			const index = JSON.parse(result.bufferStr)
			Object.keys(UserActionAPIMethods).forEach((methodName) => {
				const methodValue = UserActionAPIMethods[methodName]
				const signature = MeteorMethodSignatures[methodValue]

				let resource = `/api/0/action/${methodName}`
				let docString = resource
				const params: Record<string, any> = {}
				_.each(signature || [], (paramName, i) => {
					resource += `/:param${i}`
					docString += `/:${paramName}`
					params[paramName] = ''
				})

				const found = index.POST.indexOf(docString)
				if (found < 0) {
					console.error(docString, 'not found in REST index')
				}
				expect(found).toBeGreaterThanOrEqual(0)
			})
		})
	})
})
