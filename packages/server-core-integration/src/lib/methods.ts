import { PeripheralDeviceId } from '@sofie-automation/shared-lib/dist/core/model/Ids'
import { NewPeripheralDeviceAPI } from '@sofie-automation/shared-lib/dist/peripheralDevice/methodsAPI'
import _ = require('underscore')
import { CoreConnection } from './coreConnection'

export function makeMethods(connection: CoreConnection, methods: object): any {
	const o: any = {}
	_.each(methods, (value: any, methodName: string) => {
		o[methodName] = async (...args: any[]) => connection.callMethodRaw(value, args)
	})
	return o
}
export function makeMethodsLowPrio(connection: CoreConnection, methods: object): any {
	const o: any = {}
	_.each(methods, (value: any, methodName: string) => {
		o[methodName] = async (...args: any[]) => connection.callMethodLowPrioRaw(value, args)
	})
	return o
}

type ParametersExceptDeviceIds<F> = F extends (
	deviceId: PeripheralDeviceId,
	deviceToken: string,
	...rest: infer R
) => any
	? R
	: never

type ExecutableFunction<T extends keyof NewPeripheralDeviceAPI> = (
	...args: ParametersExceptDeviceIds<NewPeripheralDeviceAPI[T]>
) => Promise<ReturnType<NewPeripheralDeviceAPI[T]>>

/**
 * Translate NewPeripheralDeviceAPI, to remove the deviceId and deviceToken parameters at the start, as they will be injected by the
 */
export type ExternalPeripheralDeviceAPI = {
	[T in keyof NewPeripheralDeviceAPI]: ExecutableFunction<T>
}
