import * as _ from 'underscore'
import { Time } from '../lib'
import { PeripheralDeviceId } from '../collections/PeripheralDevices'
import { UserError } from '@sofie-automation/corelib/dist/error'
import { NoticeLevel } from '../../client/lib/notifications/notifications'

export interface NewClientAPI {
	clientErrorReport(timestamp: Time, errorObject: any, errorString: string, location: string): Promise<void>
	clientLogNotification(timestamp: Time, from: string, severity: NoticeLevel, message: string, source?: any)
	callPeripheralDeviceFunction(
		context: string,
		deviceId: PeripheralDeviceId,
		timeoutTime: number | undefined,
		functionName: string,
		...args: any[]
	): Promise<any>
}

export enum ClientAPIMethods {
	'clientErrorReport' = 'client.clientErrorReport',
	'clientLogNotification' = 'client.clientLogNotification',
	'callPeripheralDeviceFunction' = 'client.callPeripheralDeviceFunction',
}

export namespace ClientAPI {
	/** Response from a method that's called from the client */
	export interface ClientResponseError {
		/** On error, provide a human-readable error message */
		error: UserError
	}
	/**
	 * Used to reply to the user that the action didn't succeed (but it's not bad enough to log it as an error)
	 * @param errorMessage
	 */
	export function responseError(error: UserError): ClientResponseError {
		return { error }
	}
	export interface ClientResponseSuccess<Result> {
		/** On success, return success code (by default, use 200) */
		success: 200
		/** Optionally, provide method result */
		result?: Result
	}
	export function responseSuccess<Result>(result: Result): ClientResponseSuccess<Result> {
		if (isClientResponseSuccess(result)) result = result.result
		else if (isClientResponseError(result)) throw result.error

		return {
			success: 200,
			result,
		}
	}
	export type ClientResponse<Result> = ClientResponseError | ClientResponseSuccess<Result>
	export function isClientResponseError(res: any): res is ClientResponseError {
		return res && typeof res === 'object' && 'error' in res && UserError.isUserError(res.error)
	}
	export function isClientResponseSuccess(res: any): res is ClientResponseSuccess<any> {
		return !!(_.isObject(res) && !_.isArray(res) && res.error === undefined && res.success)
	}
}
