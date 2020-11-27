import * as _ from 'underscore'
import { Time } from '../lib'
import { PeripheralDeviceId } from '../collections/PeripheralDevices'

export interface NewClientAPI {
	clientErrorReport(timestamp: Time, errorObject: any, location: string): Promise<void>
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
	'callPeripheralDeviceFunction' = 'client.callPeripheralDeviceFunction',
}

export namespace ClientAPI {
	/** Response from a method that's called from the client */
	export interface ClientResponseError {
		/** On error, return error code (default: 500) */
		error: number
		/** On error, provide a human-readable error message */
		message?: string
		/** Any additional extra information about the error */
		details?: any
	}
	/**
	 * Used to reply to the user that the action didn't succeed (but it's not bad enough to log it as an error)
	 * @param errorMessage
	 */
	export function responseError(errorCode: number, errorMessage: string, details?: any): ClientResponseError
	export function responseError(errorMessage: string, details?: any): ClientResponseError
	export function responseError(arg1: string | number, arg2: any, details?: any): ClientResponseError {
		const hasCustomCode = _.isNumber(arg1)
		return {
			error: hasCustomCode ? Number(arg1) : 500,
			message: hasCustomCode ? arg2 : arg1,
			details,
		}
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
		return _.isObject(res) && !_.isArray(res) && res.error !== undefined
	}
	export function isClientResponseSuccess(res: any): res is ClientResponseSuccess<any> {
		return _.isObject(res) && !_.isArray(res) && res.error === undefined && res.success
	}
}
