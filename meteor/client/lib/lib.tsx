import * as _ from 'underscore'
import * as React from 'react'

export { multilineText, isEventInInputField }

function multilineText(txt: string) {
	return _.map((txt + '').split('\n'), (line: string, i) => {
		return <p key={i}>{line}</p>
	})
}

function isEventInInputField(e: Event) {
	// @ts-ignore localName
	return e && e.target && ['textarea', 'input'].indexOf(e.target.localName + '') !== -1
}

export function contextMenuHoldToDisplayTime(): number {
	return isTouchDevice() ? 1000 : -1
}

let touchDeviceCache: undefined | boolean = undefined
export function isTouchDevice(): boolean {
	if (touchDeviceCache !== undefined) return touchDeviceCache

	touchDeviceCache = false
	if (window.matchMedia('(any-pointer: coarse)').matches) {
		touchDeviceCache = true
	}
	return touchDeviceCache
}

/**
 * Wrapper around fetch(), which doesn't rejects the promise if the result is an error
 */
export function fetchFrom(input: RequestInfo, init?: RequestInit) {
	return fetch(input, init).then((response) => {
		// Read the body:
		return response.text().then((bodyText: string) => {
			if (response.status !== 200) {
				// If the response is bad, throw the error:
				throw new Error(`${response.status}: ${bodyText || response.statusText || 'Unknown error'}`)
			} else {
				return {
					...response,
					bodyText: bodyText,
				}
			}
		})
	})
}

export function ensureHasTrailingSlash(input: string | null): string | null {
	if (input) {
		return input.substr(-1) === '/' ? input : input + '/'
	} else {
		return input
	}
}

/**
 * This CSS Variable is used to indicate to the UI that it's being run on a Browser without ordinary pointers
 * but one that emulates mouse-clicks using some other input method (like a Stream Deck).
 */
export const USER_AGENT_POINTER_PROPERTY = '--pointer'
export enum UserAgentPointer {
	NO_POINTER = 'no-pointer',
}
