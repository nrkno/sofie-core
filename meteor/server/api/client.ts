import { check } from '../../lib/check'

import {
	literal,
	getCurrentTime,
	Time,
	getRandomId,
	makePromise,
	waitForPromise,
	Awaited,
	stringifyError,
} from '../../lib/lib'

import { logger } from '../logging'
import { ClientAPI, NewClientAPI, ClientAPIMethods } from '../../lib/api/client'
import { UserActionsLog, UserActionsLogItem, UserActionsLogItemId } from '../../lib/collections/UserActionsLog'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import { registerClassToMeteorMethods } from '../methods'
import { PeripheralDeviceId, PeripheralDevices } from '../../lib/collections/PeripheralDevices'
import { MethodContext, MethodContextAPI } from '../../lib/api/methods'
import { UserId } from '../../lib/typings/meteor'
import { OrganizationId } from '../../lib/collections/Organization'
import { Settings } from '../../lib/Settings'
import { resolveCredentials } from '../security/lib/credentials'
import { triggerWriteAccessBecauseNoCheckNecessary } from '../security/lib/securityVerify'
import { PeripheralDeviceContentWriteAccess } from '../security/peripheralDevice'
import { endTrace, sendTrace, startTrace } from './integration/influx'
import { interpollateTranslation, translateMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { Meteor } from 'meteor/meteor'

export namespace ServerClientAPI {
	export function clientErrorReport(
		methodContext: MethodContext,
		timestamp: Time,
		errorObject: any,
		errorString: string,
		location: string
	): void {
		check(timestamp, Number)
		triggerWriteAccessBecauseNoCheckNecessary() // TODO: discuss if is this ok?
		logger.error(
			`Uncaught error happened in GUI\n  in "${location}"\n  on "${
				methodContext.connection ? methodContext.connection.clientAddress : 'N/A'
			}"\n  at ${new Date(timestamp).toISOString()}:\n"${errorString}"\n${JSON.stringify(errorObject)}`
		)
	}

	export function runInUserLog<Result>(
		methodContext: MethodContext,
		context: string,
		methodName: string,
		args: any[],
		fcn: () => Promise<Result>
	): Awaited<Result> {
		const startTime = Date.now()
		const influxTrace = startTrace('userFunction:' + methodName)
		// this is essentially the same as MeteorPromiseCall, but rejects the promise on exception to
		// allow handling it in the client code

		if (!methodContext.connection) {
			// Called internally from server-side.
			// Just run and return right away:
			return waitForPromise(Promise.resolve(fcn()))
		}

		const actionId: UserActionsLogItemId = getRandomId()

		const { userId, organizationId } = getLoggedInCredentials(methodContext)

		UserActionsLog.insert(
			literal<UserActionsLogItem>({
				_id: actionId,
				clientAddress: methodContext.connection ? methodContext.connection.clientAddress : '',
				organizationId: organizationId,
				userId: userId,
				context: context,
				method: methodName,
				args: JSON.stringify(args),
				timestamp: getCurrentTime(),
			})
		)
		try {
			// Executes the action:
			const result = waitForPromise(fcn())

			// At this point, the action has finished execution

			// Check the nature of the result:
			if (ClientAPI.isClientResponseError(result)) {
				UserActionsLog.update(actionId, {
					$set: {
						success: false,
						doneTime: getCurrentTime(),
						executionTime: Date.now() - startTime,
						// TODO: Worker - this could be better?
						errorMessage: `ClientResponseError: ${translateMessage(
							result.error.message,
							interpollateTranslation
						)}: ${stringifyError(result.error.rawError)}`,
					},
				})
			} else {
				UserActionsLog.update(actionId, {
					$set: {
						success: true,
						doneTime: getCurrentTime(),
						executionTime: Date.now() - startTime,
					},
				})
			}

			sendTrace(endTrace(influxTrace))

			return result
		} catch (e) {
			// allow the exception to be handled by the Client code
			logger.error(`Error in ${methodName}`)
			const errMsg = stringifyError(e)
			if ((e instanceof Error || e instanceof Meteor.Error) && e.stack) {
				logger.error(e.stack)
			}
			UserActionsLog.update(actionId, {
				$set: {
					success: false,
					doneTime: getCurrentTime(),
					executionTime: Date.now() - startTime,
					errorMessage: errMsg,
				},
			})
			throw e
		}
	}

	export async function callPeripheralDeviceFunction(
		methodContext: MethodContext,
		context: string,
		deviceId: PeripheralDeviceId,
		timeoutTime: number | undefined,
		functionName: string,
		...args: any[]
	): Promise<any> {
		check(deviceId, String)
		check(functionName, String)
		check(context, String)

		const actionId: UserActionsLogItemId = getRandomId()
		const startTime = Date.now()

		if (!methodContext.connection) {
			// In this case, it was called internally from server-side.
			// Just run and return right away:
			triggerWriteAccessBecauseNoCheckNecessary()
			return PeripheralDeviceAPI.executeFunctionWithCustomTimeout(
				deviceId,
				timeoutTime,
				functionName,
				...args
			).catch(async (e) => {
				const errMsg = e.message || e.reason || (e.toString ? e.toString() : null)
				logger.error(errMsg)
				// allow the exception to be handled by the Client code
				return Promise.reject(e)
			})
		}

		const access = PeripheralDeviceContentWriteAccess.executeFunction(methodContext, deviceId)

		await UserActionsLog.insertAsync(
			literal<UserActionsLogItem>({
				_id: actionId,
				clientAddress: methodContext.connection ? methodContext.connection.clientAddress : '',
				organizationId: access.organizationId,
				userId: access.userId,
				context: context,
				method: `${deviceId}: ${functionName}`,
				args: JSON.stringify(args),
				timestamp: getCurrentTime(),
			})
		)

		return PeripheralDeviceAPI.executeFunctionWithCustomTimeout(deviceId, timeoutTime, functionName, ...args)
			.then(async (result) => {
				await UserActionsLog.updateAsync(actionId, {
					$set: {
						success: true,
						doneTime: getCurrentTime(),
						executionTime: Date.now() - startTime,
					},
				})

				return result
			})
			.catch(async (err) => {
				const errMsg = err.message || err.reason || (err.toString ? err.toString() : null)
				logger.error(errMsg)
				await UserActionsLog.updateAsync(actionId, {
					$set: {
						success: false,
						doneTime: getCurrentTime(),
						executionTime: Date.now() - startTime,
						errorMessage: errMsg,
					},
				})

				// allow the exception to be handled by the Client code
				return Promise.reject(err)
			})
	}
	function getLoggedInCredentials(methodContext: MethodContext): {
		userId: UserId | null
		organizationId: OrganizationId | null
	} {
		let userId: UserId | null = null
		let organizationId: OrganizationId | null = null
		if (Settings.enableUserAccounts) {
			const cred = resolveCredentials({ userId: methodContext.userId })
			if (cred.user) userId = cred.user._id
			if (cred.organization) organizationId = cred.organization._id
		}
		return { userId, organizationId }
	}
}

class ServerClientAPIClass extends MethodContextAPI implements NewClientAPI {
	async clientErrorReport(timestamp: Time, errorObject: any, errorString: string, location: string) {
		return makePromise(() => ServerClientAPI.clientErrorReport(this, timestamp, errorObject, errorString, location))
	}
	async callPeripheralDeviceFunction(
		context: string,
		deviceId: PeripheralDeviceId,
		timeoutTime: number | undefined,
		functionName: string,
		...args: any[]
	) {
		return makePromise(async () => {
			const methodContext: MethodContext = this // eslint-disable-line @typescript-eslint/no-this-alias
			if (!Settings.enableUserAccounts) {
				// Note: This is a temporary hack to keep backwards compatibility.
				// in the case of not enableUserAccounts, a token is needed, but not provided when called from client
				const device = PeripheralDevices.findOne(deviceId)
				if (device) {
					// @ts-ignore hack
					methodContext.token = device.token
				}
			}
			return ServerClientAPI.callPeripheralDeviceFunction(
				methodContext,
				context,
				deviceId,
				timeoutTime,
				functionName,
				...args
			)
		})
	}
}
registerClassToMeteorMethods(ClientAPIMethods, ServerClientAPIClass, false)
