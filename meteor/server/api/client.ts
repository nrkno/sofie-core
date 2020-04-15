import { Meteor } from 'meteor/meteor'
import { check } from 'meteor/check'
import { Random } from 'meteor/random'
import * as _ from 'underscore'

import { literal, getCurrentTime, Time, getRandomId, makePromise, isPromise, waitForPromise } from '../../lib/lib'

import { logger } from '../logging'
import { ClientAPI, NewClientAPI, ClientAPIMethods } from '../../lib/api/client'
import { UserActionsLog, UserActionsLogItem, UserActionsLogItemId } from '../../lib/collections/UserActionsLog'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import { registerClassToMeteorMethods } from '../methods'
import { PeripheralDeviceId } from '../../lib/collections/PeripheralDevices'
import { MethodContext } from '../../lib/api/methods'

export namespace ServerClientAPI {
	export function clientErrorReport (methodContext: MethodContext, timestamp: Time, errorObject: any, location: string): void {
		check(timestamp, Number)
		logger.error(`Uncaught error happened in GUI\n  in "${location}"\n  on "${methodContext.connection.clientAddress}"\n  at ${(new Date(timestamp)).toISOString()}:\n${JSON.stringify(errorObject)}`)
	}

	export function runInUserLog<Result> (methodContext: MethodContext, context: string, methodName: string, args: any[], fcn: () => Result | Promise<Result>): Result {
		let startTime = Date.now()
		// this is essentially the same as MeteorPromiseCall, but rejects the promise on exception to
		// allow handling it in the client code

		let actionId: UserActionsLogItemId = getRandomId()

		UserActionsLog.insert(literal<UserActionsLogItem>({
			_id: actionId,
			clientAddress: methodContext.connection.clientAddress,
			userId: methodContext.userId,
			context: context,
			method: methodName,
			args: JSON.stringify(args),
			timestamp: getCurrentTime()
		}))
		try {
			let result = fcn()

			if (isPromise(result)) {
				result = waitForPromise(result) as Result
			}

			// check the nature of the result
			if (
				ClientAPI.isClientResponseError(result)
			) {
				UserActionsLog.update(actionId, {$set: {
					success: false,
					doneTime: getCurrentTime(),
					executionTime: Date.now() - startTime,
					errorMessage: `ClientResponseError: ${result.error}: ${result.message}`
				}})
			} else {
				UserActionsLog.update(actionId, {$set: {
					success: true,
					doneTime: getCurrentTime(),
					executionTime: Date.now() - startTime
				}})
			}

			return result
		} catch (e) {
			// console.log('eeeeeeeeeeeeeee')
			// allow the exception to be handled by the Client code
			logger.error(`Error in ${methodName}`)
			let errMsg = e.message || e.reason || (e.toString ? e.toString() : null)
			logger.error(errMsg + '\n' + (e.stack || ''))
			UserActionsLog.update(actionId, {$set: {
				success: false,
				doneTime: getCurrentTime(),
				executionTime: Date.now() - startTime,
				errorMessage: errMsg
			}})
			throw e
		}
	}

	export function callPeripheralDeviceFunction (methodContext: MethodContext, context: string, deviceId: PeripheralDeviceId, functionName: string, ...args: any[]): Promise<any> {
		check(deviceId, String)
		check(functionName, String)
		check(context, String)

		let actionId: UserActionsLogItemId = getRandomId()
		let startTime = Date.now()

		return new Promise((resolve, reject) => {
			UserActionsLog.insert(literal<UserActionsLogItem>({
				_id: actionId,
				clientAddress: methodContext.connection.clientAddress,
				userId: methodContext.userId,
				context: context,
				method: `${deviceId}: ${functionName}`,
				args: JSON.stringify(args),
				timestamp: getCurrentTime()
			}))
			try {
				PeripheralDeviceAPI.executeFunction(deviceId, (err, result) => {
					if (err) {
						let errMsg = err.message || err.reason || (err.toString ? err.toString() : null)
						logger.error(errMsg)
						UserActionsLog.update(actionId, {
							$set: {
								success: false,
								doneTime: getCurrentTime(),
								executionTime: Date.now() - startTime,
								errorMessage: errMsg
							}
						})

						reject(err)
						return
					}

					UserActionsLog.update(actionId, {
						$set: {
							success: true,
							doneTime: getCurrentTime(),
							executionTime: Date.now() - startTime
						}
					})

					resolve(result)
					return
				}, functionName, ...args)
			} catch (e) {
				// console.log('eeeeeeeeeeeeeee')
				// allow the exception to be handled by the Client code
				let errMsg = e.message || e.reason || (e.toString ? e.toString() : null)
				logger.error(errMsg)
				UserActionsLog.update(actionId, {
					$set: {
						success: false,
						doneTime: getCurrentTime(),
						executionTime: Date.now() - startTime,
						errorMessage: errMsg
					}
				})
				reject(e)
				return
			}
		})
	}
}

class ServerClientAPIClass implements NewClientAPI {
	clientErrorReport (timestamp: Time, errorObject: any, location: string) {
		return makePromise(() => ServerClientAPI.clientErrorReport(this as any, timestamp, errorObject, location))
	}
	callPeripheralDeviceFunction (context: string, deviceId: PeripheralDeviceId, functionName: string, ...args: any[]) {
		return makePromise(() => ServerClientAPI.callPeripheralDeviceFunction(this as any, context, deviceId, functionName, ...args))
	}
}
registerClassToMeteorMethods(ClientAPIMethods, ServerClientAPIClass, false)
