import * as _ from 'underscore'
import * as React from 'react'

export { multilineText, isEventInInputField, loadScript }

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
	if (window.matchMedia('(pointer: coarse)').matches) {
		touchDeviceCache = true
	}
	return touchDeviceCache
}

const loadScriptCache: {
	[url: string]: {
		status: 'loading' | 'ok'
		callbacks: Array<(err?: any) => void>
	}
} = {}

function doCallback(url: string, err?: any) {
	loadScriptCache[url].callbacks.forEach((cb) => {
		cb(err)
	})
	loadScriptCache[url].status = 'ok'
}

function loadScript(url: string, callback: (err?: any) => void) {
	if ((loadScriptCache[url] || {}).status === 'ok') {
		// already loaded
		callback()
		return
	}

	if ((loadScriptCache[url] || {}).status === 'loading') {
		loadScriptCache[url].callbacks.push(callback)
		return
	}

	loadScriptCache[url] = {
		status: 'loading',
		callbacks: [callback],
	}

	const script: HTMLScriptElement = document.createElement('script')
	script.onerror = (error) => {
		doCallback(url, error)
	}
	script.onload = () => {
		doCallback(url)
	}

	document.head.appendChild(script)
	script.src = url
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
