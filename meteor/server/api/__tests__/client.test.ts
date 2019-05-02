import { Meteor } from 'meteor/meteor'
import { MeteorMock } from '../../../__mocks__/meteor'
import { ServerClientAPI } from '../client'
import { UserActionAPI } from '../../../lib/api/userActions'
import { UserActionsLog, UserActionsLogItem } from '../../../lib/collections/UserActionsLog'
import { ClientAPI } from '../../../lib/api/client'
import { getCurrentTime } from '../../../lib/lib'
import { PeripheralDeviceCommands } from '../../../lib/collections/PeripheralDeviceCommands'
import { setLoggerLevel } from '../logger'

require('../client') // include in order to create the Meteor methods needed

setLoggerLevel('info')

describe('ClientAPI', () => {
	const mockThis = {
		userId: -1,
		connection: {
			clientAddress: '8.8.8.8'
		}
	}

	describe('execMethod', () => {
		const mockRdId = 'mockRdId'
		const mockArgs = [mockRdId, true]
		const mockContext = 'Context description'
		const mockMethods = {}

		mockMethods[UserActionAPI.methods.activate] = jest.fn()
		mockMethods[UserActionAPI.methods.take] = jest.fn(() => {
			return ClientAPI.responseError('Mock error')
		})
		mockMethods[UserActionAPI.methods.setNext] = jest.fn(() => {
			throw new Meteor.Error(502, 'Mock exception')
		})
		MeteorMock.methods(mockMethods)

		it('Exports a Meteor method to the client', () => {
			expect(MeteorMock.mockMethods[ClientAPI.methods.execMethod]).toBeTruthy()
		})

		describe('Execute and log Meteor method calls', () => {
			ServerClientAPI.execMethod.apply(mockThis, [mockContext, UserActionAPI.methods.activate, ...mockArgs])

			it('Allows executing Meteor methods', () => {
				// make sure that it's only called once
				expect(mockMethods[UserActionAPI.methods.activate]).toBeCalledTimes(1)
				// make sure that the arguments are passed in correctly
				expect(mockMethods[UserActionAPI.methods.activate]).toBeCalledWith(...mockArgs)
			})

			it('Logs each call', () => {
				const logItem = UserActionsLog.findOne({
					method: UserActionAPI.methods.activate
				})
				if (!logItem) {
					fail('Log entry not found')
					return
				}
				expect(logItem.method).toBe(UserActionAPI.methods.activate)
				expect(logItem.success).toBe(true)
				expect(logItem.args).toBe(JSON.stringify(mockArgs))
				expect(logItem.context).toBe(mockContext)
			})
		})

		it('Logs error messages when responseError is returned', () => {
			ServerClientAPI.execMethod.apply(mockThis, [mockContext, UserActionAPI.methods.take, ...mockArgs])

			expect(mockMethods[UserActionAPI.methods.take]).toBeCalledTimes(1)

			const logItem = UserActionsLog.findOne({
				method: UserActionAPI.methods.take
			})
			if (!logItem) {
				fail('Log entry not found')
				return
			}
			expect(logItem.method).toBe(UserActionAPI.methods.take)
			expect(logItem.success).toBe(false)
			expect(logItem.errorMessage).toMatch(/^ClientResponseError: /)
		})

		it('Logs exception messages if an exception is thrown by a method', () => {
			const f = () => {
				ServerClientAPI.execMethod.apply(mockThis, [mockContext, UserActionAPI.methods.setNext, ...mockArgs])
			}

			expect(f).toThrow()
			expect(mockMethods[UserActionAPI.methods.setNext]).toBeCalledTimes(1)

			const logItem = UserActionsLog.findOne({
				method: UserActionAPI.methods.setNext
			})
			if (!logItem) {
				fail('Log entry not found')
				return
			}
			expect(logItem.method).toBe(UserActionAPI.methods.setNext)
			expect(logItem.success).toBe(false)
			expect(logItem.errorMessage).toBe('[502] Mock exception')
		})
	})

	describe('clientErrorReport', () => {
		it('Exports a Meteor method to the client', () => {
			expect(MeteorMock.mockMethods[ClientAPI.methods.clientErrorReport]).toBeTruthy()
		})
		it('Returns a success response to the client', () => {
			const result = ServerClientAPI.clientErrorReport.apply(mockThis, [getCurrentTime(), { error: 'Some Error' }, 'MockLocation'])

			expect(result).toMatchObject({
				success: 200
			})
		})
	})

	describe('callPeripheralDeviceFunction', () => {
		const mockDeviceId = 'mockDeviceId'
		const mockFunctionName = 'mockFunction'
		const mockContext = 'Context description'
		const mockArgs = ['mockArg1', 'mockArg2']
		const mockMethods = {}

		it('Exports a Meteor method to the client', () => {
			expect(MeteorMock.mockMethods[ClientAPI.methods.callPeripheralDeviceFunction]).toBeTruthy()
		})

		describe('Call a method on the peripheralDevice', () => {
			const logMethodName = `${mockDeviceId}: ${mockFunctionName}`
			const promise = ServerClientAPI.callPeripheralDeviceFunction.apply(mockThis, [mockContext, mockDeviceId, mockFunctionName, ...mockArgs]) as Promise<any>
			it('Logs the call in UserActionsLog', () => {
				const log = UserActionsLog.findOne({
					method: logMethodName
				})
				if (!log) {
					fail('Log entry not found')
					return
				}

				expect(log.method).toBe(logMethodName)
				expect(log.userId).toBe(mockThis.userId)
			})
			it('Sends a call to the peripheralDevice', () => {
				const pdc = PeripheralDeviceCommands.findOne({
					deviceId: mockDeviceId,
					functionName: mockFunctionName
				})
				PeripheralDeviceCommands.find({})
				if (!pdc) {
					fail('Peripheral device command request not found')
					return
				}

				expect(pdc.deviceId).toBe(mockDeviceId)
				expect(pdc.functionName).toBe(mockFunctionName)
				expect(pdc.args).toMatchObject(mockArgs)
			})
			it('Resolves the returned promise once a response from the peripheralDevice is received', () => {
				PeripheralDeviceCommands.update({
					deviceId: mockDeviceId,
					functionName: mockFunctionName
				}, {
					$set: {
						hasReply: true,
						reply: 'OK'
					}
				})
				// This will probably resolve after around 3s, since that is the timeout time
				// of checkReply and the observeChanges is not implemented in the mock
				return promise.then((value) => {
					const log = UserActionsLog.findOne({
						method: logMethodName
					})
					if (!log) {
						fail('Log entry not found')
						return
					}

					expect(log.success).toBe(true)
					expect(log.doneTime).toBeDefined()
					expect(value).toBe('OK')
				})
			})
		})
	})

	return
})
