import * as _ from 'underscore'

export function eventContextForLog (e: any): string {
	if (e.currentTarget && e.currentTarget.localName && !e.key && !e.code) {
		return e.type + ': ' + e.currentTarget.localName! + (e.currentTarget.id ? '#' + e.currentTarget.id : '') + (e.currentTarget.innerText ? ` "${e.currentTarget.innerText}"` : '')
	} else if (e.key && e.code) {
		return e.type + ': ' + keyboardEventToShortcut(e as ExtendedKeyboardEvent)
	} else {
		return e.type
	}
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
