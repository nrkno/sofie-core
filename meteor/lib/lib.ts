import * as _ from 'underscore'
import { ITranslatableMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { Meteor } from 'meteor/meteor'
import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { logger } from './logging'

import { Time, TimeDuration } from '@sofie-automation/shared-lib/dist/lib/lib'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { ReactiveVar } from 'meteor/reactive-var'
export { Time, TimeDuration }

// Legacy compatability
export * from '@sofie-automation/corelib/dist/protectedString'
export * from '@sofie-automation/corelib/dist/lib'

export type PromisifyCallbacks<T> = {
	[K in keyof T]: PromisifyFunction<T[K]>
}
type PromisifyFunction<T> = T extends (...args: any) => any
	? (...args: Parameters<T>) => Promise<ReturnType<T>> | ReturnType<T>
	: T

/**
 * Convenience method to convert a Meteor.apply() into a Promise
 * @param callName {string} Method name
 * @param args {Array<any>} An array of arguments for the method call
 * @param options (Optional) An object with options for the call. See Meteor documentation.
 * @returns {Promise<any>} A promise containing the result of the called method.
 */
export async function MeteorPromiseApply(
	callName: Parameters<typeof Meteor.apply>[0],
	args: Parameters<typeof Meteor.apply>[1],
	options?: Parameters<typeof Meteor.apply>[2]
): Promise<any> {
	return new Promise((resolve, reject) => {
		Meteor.apply(callName, args, options, (err, res) => {
			if (err) reject(err)
			else resolve(res)
		})
	})
}

// The diff is currently only used client-side
const systemTime = {
	hasBeenSet: false,
	diff: 0,
	stdDev: 9999,
	lastSync: 0,
	timeOriginDiff: 0,
}
/**
 * Returns the current (synced) time.
 * If NTP-syncing is enabled, it'll be unaffected of whether the client has a well-synced computer time or not.
 * @return {Time}
 */
export function getCurrentTime(): Time {
	return Math.floor(Date.now() - (Meteor.isServer ? 0 : systemTime.diff))
}
export { systemTime }

export interface DBObj {
	_id: ProtectedString<any>
	[key: string]: any
}

export type Partial<T> = {
	[P in keyof T]?: T[P]
}
export function partial<T>(o: Partial<T>): Partial<T> {
	return o
}

/**
 * Formats the time as human-readable time "YYYY-MM-DD hh:ii:ss"
 * @param time
 */
export function formatDateTime(time: Time): string {
	const d = new Date(time)

	const yyyy: any = d.getFullYear()
	let mm: any = d.getMonth() + 1
	let dd: any = d.getDate()

	let hh: any = d.getHours()
	let ii: any = d.getMinutes()
	let ss: any = d.getSeconds()

	if (mm < 10) mm = '0' + mm
	if (dd < 10) dd = '0' + dd
	if (hh < 10) hh = '0' + hh
	if (ii < 10) ii = '0' + ii
	if (ss < 10) ss = '0' + ss

	return `${yyyy}-${mm}-${dd} ${hh}:${ii}:${ss}`
}

export function formatTime(time: number): string {
	const ss = String(Math.ceil(time / 1000) % 60).padStart(2, '0')
	const mm = String(Math.floor(time / 60000) % 60).padStart(2, '0')
	const hh = String(Math.floor(time / 3600000)).padStart(2, '0')

	return `${hh}:${mm}:${ss}`
}

/**
 * Returns a string that can be used to compare objects for equality
 * @param objs
 */
export function stringifyObjects(objs: unknown): string {
	if (_.isArray(objs)) {
		return _.map(objs, (obj) => {
			if (obj !== undefined) {
				return stringifyObjects(obj)
			}
		}).join(',')
	} else if (_.isFunction(objs)) {
		return ''
	} else if (_.isObject(objs)) {
		const objs0 = objs as any
		const keys = _.sortBy(_.keys(objs), (k) => k)

		return _.compact(
			_.map(keys, (key) => {
				if (objs0[key] !== undefined) {
					return key + '=' + stringifyObjects(objs0[key])
				} else {
					return null
				}
			})
		).join(',')
	} else {
		return objs + ''
	}
}

/** Convenience function, to be used when length of array has previously been verified */
export function last<T>(values: T[]): T {
	return _.last(values) as T
}

export function objectFromEntries<Key extends ProtectedString<any>, Val>(
	entries: Array<[Key, Val]>
): Record<string, Val> {
	return Object.fromEntries(entries)
}

const cacheResultCache: {
	[name: string]: {
		ttl: number
		value: any
	}
} = {}
/** Cache the result of function for a limited time */
export function cacheResult<T>(name: string, fcn: () => T, limitTime = 1000): T {
	if (Math.random() < 0.01) {
		Meteor.setTimeout(cleanOldCacheResult, 10000)
	}
	const cache = cacheResultCache[name]
	if (!cache || cache.ttl < Date.now()) {
		const value: T = fcn()
		cacheResultCache[name] = {
			ttl: Date.now() + limitTime,
			value: value,
		}
		return value
	} else {
		return cache.value
	}
}
/** Cache the result of function for a limited time */
export async function cacheResultAsync<T>(name: string, fcn: () => Promise<T>, limitTime = 1000): Promise<T> {
	if (Math.random() < 0.01) {
		Meteor.setTimeout(cleanOldCacheResult, 10000)
	}
	const cache = cacheResultCache[name]
	if (!cache || cache.ttl < Date.now()) {
		const value: Promise<T> = fcn()
		cacheResultCache[name] = {
			ttl: Date.now() + limitTime,
			value: value,
		}
		return value
	} else {
		return cache.value
	}
}
export function clearCacheResult(name: string): void {
	delete cacheResultCache[name]
}
function cleanOldCacheResult() {
	_.each(cacheResultCache, (cache, name) => {
		if (cache.ttl < Date.now()) clearCacheResult(name)
	})
}
const lazyIgnoreCache: { [name: string]: number } = {}
export function lazyIgnore(name: string, f1: () => Promise<void> | void, t: number): void {
	// Don't execute the function f1 until the time t has passed.
	// Subsequent calls will extend the laziness and ignore the previous call

	if (lazyIgnoreCache[name]) {
		Meteor.clearTimeout(lazyIgnoreCache[name])
	}
	lazyIgnoreCache[name] = Meteor.setTimeout(() => {
		delete lazyIgnoreCache[name]
		if (Meteor.isClient) {
			f1()?.catch((e) => {
				throw new Error(e)
			})
		} else {
			waitForPromise(f1())
		}
	}, t)
}

const ticCache: Record<NamedCurve, number> = {}
/**
 * Performance debugging. tic() starts a timer, toc() traces the time since tic()
 * @param name
 */
export function tic(name = 'default'): void {
	ticCache[name] = Date.now()
}
export function toc(name = 'default', logStr?: string | Promise<any>[]): number | undefined {
	if (_.isArray(logStr)) {
		_.each(logStr, (promise, i) => {
			promise
				.then((result) => {
					toc(name, 'Promise ' + i)
					return result
				})
				.catch((e) => {
					throw e
				})
		})
	} else {
		const t: number = Date.now() - ticCache[name]
		if (logStr) logger.info('toc: ' + name + ': ' + logStr + ': ' + t)
		return t
	}
}

/**
 * Make Meteor.startup support async functions
 */
export function MeteorStartupAsync(fcn: () => Promise<void>): void {
	Meteor.startup(() => waitForPromise(fcn()))
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

export type Awaited<T> = T extends PromiseLike<infer U> ? Awaited<U> : T

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
 * Replaces all invalid characters in order to make the path a valid one
 * @param path
 */
export function fixValidPath(path: string): string {
	return path.replace(/([^a-z0-9_.@()-])/gi, '_')
}

/**
 * Thanks to https://github.com/Microsoft/TypeScript/issues/23126#issuecomment-395929162
 */
export type OptionalPropertyNames<T> = {
	[K in keyof T]-?: undefined extends T[K] ? K : never
}[keyof T]
export type RequiredPropertyNames<T> = {
	[K in keyof T]-?: undefined extends T[K] ? never : K
}[keyof T]
export type OptionalProperties<T> = Pick<T, OptionalPropertyNames<T>>
export type RequiredProperties<T> = Pick<T, RequiredPropertyNames<T>>

export type Diff<T, U> = T extends U ? never : T // Remove types from T that are assignable to U
export type KeysByType<TObj, TVal> = Diff<
	{
		[K in keyof TObj]: TObj[K] extends TVal ? K : never
	}[keyof TObj],
	undefined
>

/**
 * Returns the difference between object A and B
 */
type Difference<A, B extends A> = Pick<B, Exclude<keyof B, keyof RequiredProperties<A>>>
/**
 * Somewhat like _.extend, but with strong types & mandated additional properties
 * @param original Object to be extended
 * @param extendObj properties to add
 */
export function extendMandadory<A, B extends A>(original: A, extendObj: Difference<A, B> & Partial<A>): B {
	return _.extend(original, extendObj)
}

export function trimIfString<T>(value: T): T | string {
	if (_.isString(value)) return value.trim()
	return value
}

export function firstIfArray<T>(value: T | T[] | null | undefined): T | null | undefined
export function firstIfArray<T>(value: T | T[] | null): T | null
export function firstIfArray<T>(value: T | T[] | undefined): T | undefined
export function firstIfArray<T>(value: T | T[]): T
export function firstIfArray<T>(value: unknown): T {
	return _.isArray(value) ? _.first(value) : value
}

/**
 * Wait for specified time
 * @param time
 */
export async function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => Meteor.setTimeout(resolve, ms))
}

export function isPromise<T>(val: unknown): val is Promise<T> {
	const val0 = val as any
	return _.isObject(val0) && typeof val0.then === 'function' && typeof val0.catch === 'function'
}

/**
 * This is a fast, shallow compare of two Sets.
 *
 * **Note**: This is a shallow compare, so it will return false if the objects in the arrays are identical, but not the same.
 *
 * @param a
 * @param b
 */
export function equalSets<T>(a: Set<T>, b: Set<T>): boolean {
	if (a === b) return true
	if (a.size !== b.size) return false
	for (const val of a.values()) {
		if (!b.has(val)) return false
	}
	return true
}

/**
 * This is a fast, shallow compare of two arrays that are used as unsorted lists. The ordering of the elements is ignored.
 *
 * **Note**: This is a shallow compare, so it will return false if the objects in the arrays are identical, but not the same.
 *
 * @param a
 * @param b
 */
export function equivalentArrays<T>(a: T[], b: T[]): boolean {
	if (a === b) return true
	if (a.length !== b.length) return false
	for (let i = 0; i < a.length; i++) {
		if (!b.includes(a[i])) return false
	}
	return true
}

/**
 * This is a fast, shallow compare of two arrays of the same type.
 *
 * **Note**: This is a shallow compare, so it will return false if the objects in the arrays are identical, but not the same.
 * @param a
 * @param b
 */
export function equalArrays<T>(a: T[], b: T[]): boolean {
	if (a === b) return true
	if (a.length !== b.length) return false
	for (let i = 0; i < a.length; i++) {
		if (b[i] !== a[i]) return false
	}
	return true
}

/** Generate the translation for a string, to be applied later when it gets rendered */
export function generateTranslation(
	key: string,
	args?: { [k: string]: any },
	namespaces?: string[]
): ITranslatableMessage {
	return {
		key,
		args,
		namespaces,
	}
}

export enum LogLevel {
	SILLY = 'silly',
	DEBUG = 'debug',
	VERBOSE = 'verbose',
	INFO = 'info',
	WARN = 'warn',
	ERROR = 'error',
	NONE = 'crit',
}

export enum LocalStorageProperty {
	STUDIO = 'studioMode',
	CONFIGURE = 'configureMode',
	DEVELOPER = 'developerMode',
	TESTING = 'testingMode',
	SPEAKING = 'speakingMode',
	VIBRATING = 'vibratingMode',
	SERVICE = 'serviceMode',
	SHELF_FOLLOWS_ON_AIR = 'shelfFollowsOnAir',
	SHOW_HIDDEN_SOURCE_LAYERS = 'showHiddenSourceLayers',
	IGNORE_PIECE_CONTENT_STATUS = 'ignorePieceContentStatus',
	UI_ZOOM_LEVEL = 'uiZoomLevel',
	HELP_MODE = 'helpMode',
	LOG_NOTIFICATIONS = 'logNotifications',
	PROTO_ONE_PART_PER_LINE = 'proto:onePartPerLine',
}

/**
 * This just looks like a ReactiveVar, but is not reactive.
 * It's used to use the same interface/typings, but when code is run on both client and server side.
 * */
export class DummyReactiveVar<T> implements ReactiveVar<T> {
	constructor(private value: T) {}
	public get(): T {
		return this.value
	}
	public set(newValue: T): void {
		this.value = newValue
	}
}

export function ensureHasTrailingSlash(input: string | null): string | undefined {
	if (input) {
		return input.endsWith('/') ? input : input + '/'
	} else {
		return undefined
	}
}
