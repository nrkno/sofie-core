import { Meteor } from 'meteor/meteor'
import { MeteorMock } from '../../../__mocks__/meteor'
import { UserActionsLog } from '../../../lib/collections/UserActionsLog'
import { ClientAPIMethods } from '../../../lib/api/client'
import { protectString, makePromise } from '../../../lib/lib'
import { PeripheralDeviceCommands } from '../../../lib/collections/PeripheralDeviceCommands'
import { setLoggerLevel } from '../logger'
import { testInFiber } from '../../../__mocks__/helpers/jest'
import { runInFiber } from '../../../__mocks__/Fibers'
import { PeripheralDeviceId } from '../../../lib/collections/PeripheralDevices'

require('../client') // include in order to create the Meteor methods needed

setLoggerLevel('info')

const orgSetTimeout = setTimeout

describe('ClientAPI', () => {
	describe('clientErrorReport', () => {
		testInFiber('Exports a Meteor method to the client', () => {
			expect(MeteorMock.mockMethods[ClientAPIMethods.clientErrorReport]).toBeTruthy()
		})
		testInFiber('Returns a success response to the client', () => {
			// should not throw:
			Meteor.call(ClientAPIMethods.clientErrorReport, 1000, { error: 'Some Error' }, 'MockLocation')
		})
	})

	describe('callPeripheralDeviceFunction', () => {
		const mockDeviceId: PeripheralDeviceId = protectString('mockDeviceId')
		const mockFunctionName = 'mockFunction'
		const mockFailingFunctionName = 'mockFailFunction'
		const mockContext = 'Context description'
		const mockArgs = ['mockArg1', 'mockArg2']

		testInFiber('Exports a Meteor method to the client', () => {
			expect(MeteorMock.mockMethods[ClientAPIMethods.callPeripheralDeviceFunction]).toBeTruthy()
		})

		describe('Call a method on the peripheralDevice', () => {
			const logMethodName = `${mockDeviceId}: ${mockFunctionName}`
			let promise: Promise<any>
			beforeAll(async () => {
				promise = makePromise(() =>
					Meteor.call(
						ClientAPIMethods.callPeripheralDeviceFunction,
						mockContext,
						mockDeviceId,
						mockFunctionName,
						...mockArgs
					)
				)
				await new Promise((resolve) => orgSetTimeout(resolve, 100))
			})
			it('Logs the call in UserActionsLog', () => {
				const log = UserActionsLog.findOne({
					method: logMethodName,
				})
				if (!log) {
					fail('Log entry not found')
					return
				}

				expect(log.method).toBe(logMethodName)
				expect(log.userId).toBeDefined()
			})
			testInFiber('Sends a call to the peripheralDevice', () => {
				const pdc = PeripheralDeviceCommands.findOne({
					deviceId: mockDeviceId,
					functionName: mockFunctionName,
				})
				if (!pdc) {
					fail('Peripheral device command request not found')
					return
				}

				expect(pdc.deviceId).toBe(mockDeviceId)
				expect(pdc.functionName).toBe(mockFunctionName)
				expect(pdc.args).toMatchObject(mockArgs)
			})
			testInFiber('Resolves the returned promise once a response from the peripheralDevice is received', () => {
				return runInFiber(() => {
					PeripheralDeviceCommands.update(
						{
							deviceId: mockDeviceId,
							functionName: mockFunctionName,
						},
						{
							$set: {
								hasReply: true,
								reply: 'OK',
							},
						}
					)
					return promise.then((value) => {
						const log = UserActionsLog.findOne({
							method: logMethodName,
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

		describe('Call a failing method on the peripheralDevice', () => {
			const logMethodName = `${mockDeviceId}: ${mockFailingFunctionName}`
			const promise = makePromise(() => {
				return Meteor.call(
					ClientAPIMethods.callPeripheralDeviceFunction,
					mockContext,
					mockDeviceId,
					mockFailingFunctionName,
					...mockArgs
				)
			})
			testInFiber('Logs the call in UserActionsLog', () => {
				const log = UserActionsLog.findOne({
					method: logMethodName,
				})
				if (!log) {
					fail('Log entry not found')
					return
				}

				expect(log.method).toBe(logMethodName)
				expect(log.userId).toBeDefined()
			})
			testInFiber('Sends a call to the peripheralDevice', () => {
				const pdc = PeripheralDeviceCommands.findOne({
					deviceId: mockDeviceId,
					functionName: mockFailingFunctionName,
				})
				if (!pdc) {
					fail('Peripheral device command request not found')
					return
				}

				expect(pdc.deviceId).toBe(mockDeviceId)
				expect(pdc.functionName).toBe(mockFailingFunctionName)
				expect(pdc.args).toMatchObject(mockArgs)
			})
			testInFiber('Resolves the returned promise once a response from the peripheralDevice is received', () => {
				return runInFiber(() => {
					PeripheralDeviceCommands.update(
						{
							deviceId: mockDeviceId,
							functionName: mockFailingFunctionName,
						},
						{
							$set: {
								hasReply: true,
								replyError: 'Failed',
							},
						}
					)
					// This will probably resolve after around 3s, since that is the timeout time
					// of checkReply and the observeChanges is not implemented in the mock
					return promise.catch((value) => {
						const log = UserActionsLog.findOne({
							method: logMethodName,
						})
						if (!log) {
							fail('Log entry not found')
							return
						}

						expect(log.success).toBe(false)
						expect(log.doneTime).toBeDefined()
						expect(value).toBe('Failed')
					})
				})
			})
		})
	})

	return
})
