import * as _ from 'underscore'
import * as React from 'react'

export function multilineText (txt: string) {
	return _.map((txt + '').split('\n'), (line: string, i) => {
		return <p key={i}>{line}</p>
	})
}
export function isEventInInputField (e: Event) {
	// @ts-ignore localName
	return (e && e.target && ['textarea', 'input'].indexOf(e.target.localName + '') !== -1)
}
const loadScriptCache: {[url: string]: {
	status: 'loading' | 'ok',
	callbacks: Array<(err?: any) => void>
}} = {}
export function loadScript (url: string, callback: (err?: any) => void) {

	if ((loadScriptCache[url] || {}).status === 'ok') {
		// already loaded
		callback()
	} else if ((loadScriptCache[url] || {}).status === 'loading') {
		loadScriptCache[url].callbacks.push(callback)
	} else {
		loadScriptCache[url] = {
			status: 'loading',
			callbacks: [callback]
		}
		const doCallback = (err?: any) => {
			loadScriptCache[url].callbacks.forEach((cb) => {
				cb(err)
			})
			loadScriptCache[url].status = 'ok'
		}
		$.ajax({
			url: url,
			dataType: 'script',
			success: () => {
				doCallback()
			},
			error: (err) => {
				doCallback(err)
			}
		})
	}
}
/**
 * Wrapper around fetch(), which doesn't rejects the promise if the result is an error
 */
export function fetchFrom (input: RequestInfo, init?: RequestInit) {

	return fetch(input, init)
	.then((response) => {
		// Read the body:
		return response.text()
		.then((bodyText: string) => {
			if (response.status !== 200) {
				// If the response is bad, throw the error:
				throw new Error(`${response.status}: ${bodyText || response.statusText || 'Unknown error'}`)
			} else {
				return {
					...response,
					bodyText: bodyText
				}
			}
		})
	})
}
