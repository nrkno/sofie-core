import React, { useEffect, useRef, useState } from 'react'
import { Meteor } from 'meteor/meteor'
import _ from 'underscore'

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

type MutableRef<T> = ((instance: T | null) => void) | React.MutableRefObject<T | null> | null

export function useCombinedRefs<T>(initial, ...refs: MutableRef<T>[]) {
	const targetRef = useRef<T>(initial)

	useEffect(() => {
		refs.forEach((ref) => {
			if (!ref) return

			if (typeof ref === 'function') {
				ref(targetRef.current)
			} else {
				ref.current = targetRef.current
			}
		})
	}, [refs])

	return targetRef
}

/**
 * A reactive hook that will turn the return value of `func` to a state and re-evaluate `func` on an interval `interval`.
 * `func` returns a Tuple: a value that is the state and the timespan until next re-validation.
 *
 * The initial value of the state is either set to `initialValue` or, if not provided, `func` will be ran synchronously once
 * to get the initial state.
 *
 * Like with any hook, dependencies need to be declared. If the dependencies change, the entire hook is invalidated and the
 * state will start from the initial value.
 *
 * @template K
 * @param {() => [K, number?]} func
 * @param {number} interval the interval at which `func` is to be re-evaluated
 * @param {any[]} [deps] external values `func` depends on. Uses same rules as `useEffect`.
 * @param {K} [initialValue] the initial value for the state
 * @return {K} the current value of the state
 */
export function useInvalidateTimeout<K>(func: () => [K, number?], interval: number, deps?: any[], initialValue?: K): K {
	const [value, setValue] = useState(initialValue ?? func()[0])
	const invalidateHandle = useRef<number | null>(null)

	useEffect(() => {
		const reevaluate = () => {
			const [newValue, revalidateIn] = func()
			if (!_.isEqual(newValue, value)) {
				setValue(newValue)
			}
			if (revalidateIn !== 0) {
				invalidateHandle.current = Meteor.setTimeout(reevaluate, revalidateIn ?? interval)
			} else {
				invalidateHandle.current = null
			}
		}

		invalidateHandle.current = Meteor.setTimeout(reevaluate, interval)

		return () => {
			if (invalidateHandle.current !== null) {
				Meteor.clearTimeout(invalidateHandle.current)
			}
		}
	}, [value, interval, ...(deps || [])])

	return value
}
