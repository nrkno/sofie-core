import { PeripheralDevice } from '../../lib/collections/PeripheralDevices'
import { MeteorCall } from '../../lib/api/methods'
import { PeripheralDeviceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { eventContextForLog } from '../../lib/clientUserAction'

export async function callPeripheralDeviceFunction(
	e: any,
	deviceId: PeripheralDeviceId,
	timeoutTime: number | undefined,
	functionName: string,
	...params: any[]
): Promise<any> {
	const eventContext = eventContextForLog(e)
	return MeteorCall.client.callPeripheralDeviceFunction(
		eventContext[0],
		deviceId,
		timeoutTime,
		functionName,
		...params
	)
}
export async function callPeripheralDeviceAction(
	e: any,
	deviceId: PeripheralDeviceId,
	timeoutTime: number | undefined,
	actionId: string,
	payload?: Record<string, any>
): Promise<any> {
	const eventContext = eventContextForLog(e)
	return MeteorCall.client.callPeripheralDeviceAction(eventContext[0], deviceId, timeoutTime, actionId, payload)
}

export namespace PeripheralDevicesAPI {
	export async function restartDevice(
		dev: Pick<PeripheralDevice, '_id'>,
		e: Event | React.SyntheticEvent<object>
	): Promise<any> {
		return callPeripheralDeviceFunction(e, dev._id, undefined, 'killProcess', 1)
	}
	export async function troubleshootDevice(
		dev: Pick<PeripheralDevice, '_id'>,
		e: Event | React.SyntheticEvent<object>
	): Promise<any> {
		return callPeripheralDeviceFunction(e, dev._id, undefined, 'troubleshoot', 1)
	}
}
