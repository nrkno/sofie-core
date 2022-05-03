import * as _ from 'underscore'
import { logger } from '../../lib/logging'
import { PeripheralDevice, PeripheralDeviceId } from '../../lib/collections/PeripheralDevices'
import { MeteorCall } from '../../lib/api/methods'
import { Time } from '../../lib/lib'
import { getEventTimestamp } from './lib'

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

export function eventContextForLog(e: any): [string, Time] {
	const timeStamp = getEventTimestamp(e)
	if (!e) return ['', timeStamp]
	let str: string = ''
	if (_.isString(e)) {
		return [e, timeStamp]
	} else if (e.currentTarget && e.currentTarget.localName && !e.key && !e.code) {
		let contents = ''
		if (e.currentTarget.localName !== 'body' && e.currentTarget.innerText) {
			contents = ` "${e.currentTarget.innerText}"`
		}
		str =
			e.type + ': ' + e.currentTarget.localName + (e.currentTarget.id ? '#' + e.currentTarget.id : '') + contents
	} else if (e.key && e.code) {
		str = e.type + ': ' + keyboardEventToShortcut(e as KeyboardEvent)
	} else {
		str = e.type
	}
	if (!str) {
		logger.error('Unknown event', e)
		console.error(e)
		str = 'N/A'
	}

	return [str, timeStamp]
}

function keyboardEventToShortcut(e: KeyboardEvent): string {
	const combo = _.compact([
		e.ctrlKey ? 'Control' : undefined,
		e.shiftKey ? 'Shift' : undefined,
		e.altKey ? 'Alt' : undefined,
		e.metaKey ? 'Meta' : undefined,
		e.code,
	])
	return combo.join('+')
}
