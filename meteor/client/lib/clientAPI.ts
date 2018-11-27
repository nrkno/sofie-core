import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { ClientAPI } from '../../lib/api/client'
import { logger } from '../../lib/logging'

export function callMethod (e: any, methodName: string, ...params: any[]) {
	Meteor.call(ClientAPI.methods.execMethod, eventContextForLog(e), methodName, ...params)
}
export function callPeripheralDeviceFunction (e: any, methodName: string, ...params: any[]) {
	Meteor.call(ClientAPI.methods.callPeripheralDeviceFunction, eventContextForLog(e), methodName, ...params)
}

function eventContextForLog (e: any): string {
	if (!e) return ''
	let str: string = ''
	if (_.isString(e)) {
		return e
	} else if (e.currentTarget && e.currentTarget.localName && !e.key && !e.code) {
		str = e.type + ': ' + e.currentTarget.localName + (e.currentTarget.id ? '#' + e.currentTarget.id : '') + (e.currentTarget.innerText ? ` "${e.currentTarget.innerText}"` : '')
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
