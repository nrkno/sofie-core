import * as _ from 'underscore'
import { logger } from '../../lib/logging'

export function eventContextForLog (e: any): string {
	let str: string = ''
	if (e.currentTarget && e.currentTarget.localName && !e.key && !e.code) {
		str = e.type + ': ' + e.currentTarget.localName! + (e.currentTarget.id ? '#' + e.currentTarget.id : '') + (e.currentTarget.innerText ? ` "${e.currentTarget.innerText}"` : '')
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

export function keyboardEventToShortcut (e: ExtendedKeyboardEvent): string {
	const combo = _.compact([
		e.ctrlKey ? 'ctrl' : undefined,
		e.shiftKey ? 'shift' : undefined,
		e.altKey ? 'alt' : undefined,
		e.metaKey ? 'meta' : undefined,
		e.key
	])
	return combo.join('+')
}
