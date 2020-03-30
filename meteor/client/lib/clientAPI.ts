import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { ClientAPI } from '../../lib/api/client'
import { logger } from '../../lib/logging'
import { PeripheralDevice } from '../../lib/collections/PeripheralDevices'

export function callMethod (e: any, methodName: string, ...params: any[]) {
	Meteor.call(ClientAPI.methods.execMethod, eventContextForLog(e), methodName, ...params)
}
export function callPeripheralDeviceFunction (e: any, deviceFunctionName: string, ...params: any[]) {
	Meteor.call(ClientAPI.methods.callPeripheralDeviceFunction, eventContextForLog(e), deviceFunctionName, ...params)
}

export namespace PeripheralDevicesAPI {
	export function restartDevice (dev: PeripheralDevice, e: Event | React.SyntheticEvent<object>): Promise<any> {
		return new Promise((resolve, reject) => {
			callPeripheralDeviceFunction(e, dev._id, 'killProcess', 1, (err, result) => {
				if (err) {
					reject(err)
				} else {
					resolve(result)
				}
			})
		})
	}
}

function eventContextForLog (e: any): string {
	if (!e) return ''
	let str: string = ''
	if (_.isString(e)) {
		return e
	} else if (e.currentTarget && e.currentTarget.localName && !e.key && !e.code) {
		let contents = ''
		if (e.currentTarget.localName !== 'body' && e.currentTarget.innerText) {
			contents = ` "${e.currentTarget.innerText}"`
		}
		str = e.type + ': ' + e.currentTarget.localName + (e.currentTarget.id ? '#' + e.currentTarget.id : '') + contents
	} else if (e.key && e.code) {
		str = e.type + ': ' + keyboardEventToShortcut(e as ExtendedKeyboardEvent)
	} else {
		str = e.type
	}
	if (!str) {
		logger.error('Unknown event', e)
		console.log(e)
		str = 'N/A'
	}

	return str
}

function keyboardEventToShortcut (e: ExtendedKeyboardEvent): string {
	const combo = _.compact([
		e.ctrlKey ? 'ctrl' : undefined,
		e.shiftKey ? 'shift' : undefined,
		e.altKey ? 'alt' : undefined,
		e.metaKey ? 'meta' : undefined,
		e.key
	])
	return combo.join('+')
}
