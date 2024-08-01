import * as _ from 'underscore'
import { Meteor } from 'meteor/meteor'
import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { logger } from '../client/lib/logging'

import { Time, TimeDuration } from '@sofie-automation/shared-lib/dist/lib/lib'
export type { Time, TimeDuration }

// Legacy compatability
export * from '@sofie-automation/shared-lib/dist/lib/protectedString'
export * from '@sofie-automation/corelib/dist/lib'
export * from '@sofie-automation/meteor-lib/dist/lib'

export type PromisifyCallbacks<T> = {
	[K in keyof T]: PromisifyFunction<T[K]>
}
type PromisifyFunction<T> = T extends (...args: any) => any
	? (...args: Parameters<T>) => Promise<ReturnType<T>> | ReturnType<T>
	: T

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
		// if (Meteor.isClient) {
		f1()?.catch((e) => {
			throw new Error(e)
		})
		// } else {
		// 	waitForPromise(f1())
		// }
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

export type Awaited<T> = T extends PromiseLike<infer U> ? Awaited<U> : T

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
