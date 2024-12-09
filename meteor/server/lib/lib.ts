import { Meteor } from 'meteor/meteor'
import { logger } from '../logging'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { Time } from '@sofie-automation/shared-lib/dist/lib/lib'

export function getCurrentTime(): Time {
	// We assume the os does NTP syncing, at a frequent interval.
	return Date.now()
}

/**
 * Async version of Meteor.LiveQueryHandle
 */
export interface LiveQueryHandle {
	stop(): void | Promise<void>
}

/**
 * Replaces all invalid characters in order to make the path a valid one
 * @param path
 */
export function fixValidPath(path: string): string {
	return path.replace(/([^a-z0-9_.@()-])/gi, '_')
}

/**
 * Make Meteor.wrapAsync a bit more type safe
 * The original version makes the callback be after the last non-undefined parameter, rather than after or replacing the last parameter.
 * Which makes it incredibly hard to find without iterating over all the parameters. This does that for you, so you dont need to check as many places
 */
export function MeteorWrapAsync(func: Function, context?: Object): any {
	// A variant of Meteor.wrapAsync to fix the bug
	// https://github.com/meteor/meteor/issues/11120

	return Meteor.wrapAsync((...args: any[]) => {
		// Find the callback-function:
		for (let i = args.length - 1; i >= 0; i--) {
			if (typeof args[i] === 'function') {
				if (i < args.length - 1) {
					// The callback is not the last argument, make it so then:
					const callback = args[i]
					const fixedArgs = args
					fixedArgs[i] = undefined
					fixedArgs.push(callback)

					func.apply(context, fixedArgs)
					return
				} else {
					// The callback is the last argument, that's okay
					func.apply(context, args)
					return
				}
			}
		}
		throw new Meteor.Error(500, `Error in MeteorWrapAsync: No callback found!`)
	})
}

const lazyIgnoreCache: { [name: string]: number } = {}
export function lazyIgnore(name: string, f1: () => void, t: number): void {
	// Don't execute the function f1 until the time t has passed.
	// Subsequent calls will extend the laziness and ignore the previous call

	if (lazyIgnoreCache[name]) {
		Meteor.clearTimeout(lazyIgnoreCache[name])
	}
	lazyIgnoreCache[name] = Meteor.setTimeout(() => {
		delete lazyIgnoreCache[name]

		try {
			f1()
		} catch (e) {
			logger.error(`Unhandled error in lazyIgnore "${name}": ${stringifyError(e)}`)
		}
	}, t)
}

/**
 * Make Meteor.startup support async functions
 */
export function MeteorStartupAsync(fcn: () => Promise<void>): void {
	Meteor.startup(() => waitForPromise(fcn()))
}

/**
 * Convert a promise to a "synchronous" Fiber function
 * Makes the Fiber wait for the promise to resolve, then return the value of the promise.
 * If the fiber rejects, the function in the Fiber will "throw"
 */
export const waitForPromise: <T>(p: Promise<T> | T) => Awaited<T> = Meteor.wrapAsync(function waitForPromise<T>(
	p: Promise<T> | T,
	cb: (err: any | null, result?: any) => Awaited<T>
) {
	if (Meteor.isClient) throw new Meteor.Error(500, `waitForPromise can't be used client-side`)
	if (cb === undefined && typeof p === 'function') {
		cb = p as any
		p = undefined as any
	}

	Promise.resolve(p)
		.then((result) => {
			cb(null, result)
		})
		.catch((e) => {
			cb(e)
		})
}) as <T>(p: Promise<T> | T) => Awaited<T> // `wrapAsync` has opaque `Function` type
/**
 * Convert a Fiber function into a promise
 * Makes the Fiber function to run in its own fiber and return a promise
 */
export async function makePromise<T>(fcn: () => T): Promise<T> {
	const p = new Promise<T>((resolve, reject) => {
		Meteor.defer(() => {
			try {
				resolve(fcn())
			} catch (e) {
				reject(e)
			}
		})
	})

	return (
		await Promise.all([
			p,
			// Pause the current Fiber briefly, in order to allow for the deferred Fiber to start executing:
			sleep(0),
		])
	)[0]
}

export function deferAsync(fcn: () => Promise<void>): void {
	Meteor.defer(() => {
		fcn().catch((e) => logger.error(stringifyError(e)))
	})
}

/**
 * Wait for specified time
 * @param time
 */
export async function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => Meteor.setTimeout(resolve, ms))
}
