import { Meteor } from 'meteor/meteor'
import { check, Match } from 'meteor/check'
import { Random } from 'meteor/random'
import * as _ from 'underscore'

import { literal, getCurrentTime, MeteorPromiseCall } from '../../lib/lib'

import { logger } from '../logging'
import { ClientAPI } from '../../lib/api/client'
import { UserActionsLog, UserActionsLogItem } from '../../lib/collections/UserActionsLog'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'

export namespace ServerClientAPI {
	export function execMethod (context: string, methodName: string, ...args: any[]) {
		check(methodName, String)
		check(context, String)
		let startTime = Date.now()
		// this is essentially the same as MeteorPromiseCall, but rejects the promise on exception to
		// allow handling it in the client code

		let actionId = Random.id()

		UserActionsLog.insert(literal<UserActionsLogItem>({
			_id: actionId,
			clientAddress: this.connection.clientAddress,
			userId: this.userId,
			context: context,
			method: methodName,
			args: JSON.stringify(args),
			timestamp: getCurrentTime()
		}))
		try {
			let result = Meteor.call(methodName, ...args)

			UserActionsLog.update(actionId, {$set: {
				success: true,
				doneTime: getCurrentTime(),
				executionTime: Date.now() - startTime
			}})
			return result
		} catch (e) {
			// console.log('eeeeeeeeeeeeeee')
			// allow the exception to be handled by the Client code
			let errMsg = e.message || e.reason || (e.toString ? e.toString() : null)
			logger.error(errMsg)
			UserActionsLog.update(actionId, {$set: {
				success: false,
				doneTime: getCurrentTime(),
				executionTime: Date.now() - startTime,
				errorMessage: errMsg
			}})
			throw e
		}
	}

	export function callPeripheralDeviceFunction (context: string, deviceId: string, functionName: string, ...args: any[]): Promise<any> {
		check(deviceId, String)
		check(functionName, String)
		check(context, String)

		let actionId = Random.id()
		let startTime = Date.now()

		return new Promise((resolve, reject) => {
			UserActionsLog.insert(literal<UserActionsLogItem>({
				_id: actionId,
				clientAddress: this.connection.clientAddress,
				userId: this.userId,
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
let methods = {}
methods[ClientAPI.methods.execMethod] = function (...args) {
	return ServerClientAPI.execMethod.apply(this, args)
}
methods[ClientAPI.methods.callPeripheralDeviceFunction] = function (...args) {
	return ServerClientAPI.callPeripheralDeviceFunction.apply(this, args)
}

// Apply methods:
Meteor.methods(methods)
