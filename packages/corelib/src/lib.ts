import * as _ from 'underscore'
import { ReadonlyDeep } from 'type-fest'
import fastClone = require('fast-clone')
import { Random } from './random'
import { ProtectedString, protectString } from './protectedString'
import * as objectPath from 'object-path'
import * as crypto from 'crypto'
import { Timecode } from 'timecode'
import { Time } from '@sofie-automation/blueprints-integration'
import { ISettings } from './settings'
import { iterateDeeply, iterateDeeplyEnum } from '@sofie-automation/blueprints-integration'

export type TimeDuration = number

export type Subtract<T extends T1, T1 extends object> = Pick<T, Exclude<keyof T, keyof T1>>

export type ArrayElement<A> = A extends readonly (infer T)[] ? T : never

export function getHash(str: string): string {
	const hash = crypto.createHash('sha1')
	return hash.update(str).digest('base64').replace(/[+/=]/g, '_') // remove +/= from strings, because they cause troubles
}

/** Creates a hash based on the object properties (excluding ordering of properties) */
export function hashObj(obj: any): string {
	if (typeof obj === 'object') {
		const keys = Object.keys(obj).sort((a, b) => {
			if (a > b) return 1
			if (a < b) return -1
			return 0
		})

		const strs: string[] = []
		for (const key of keys) {
			strs.push(hashObj(obj[key]))
		}
		return getHash(strs.join('|'))
	}
	return obj + ''
}

export function omit<T, P extends keyof T>(obj: T, ...props: P[]): Omit<T, P> {
	return _.omit(obj, ...(props as string[])) as any
}

export function flatten<T>(vals: Array<T[] | undefined>): T[] {
	return _.flatten(
		vals.filter((v) => v !== undefined),
		true
	) as T[]
}

export function max<T>(vals: T[], iterator: _.ListIterator<T, any>): T | undefined {
	if (vals.length <= 1) {
		return vals[0]
	} else {
		return _.max(vals, iterator) as T
	}
}

export function assertNever(_never: never): void {
	// Do nothing. This is a type guard
}

export function clone<T>(o: ReadonlyDeep<T> | Readonly<T> | T): T {
	// Use this instead of fast-clone directly, as this retains the type
	return fastClone(o as any)
}

export function getRandomString(numberOfChars?: number): string {
	return Random.id(numberOfChars)
}
export function getRandomId<T>(numberOfChars?: number): ProtectedString<T> {
	return protectString(getRandomString(numberOfChars))
}

export function literal<T>(o: T): T {
	return o
}

export async function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

export function normalizeArrayFuncFilter<T>(
	array: Array<T>,
	getKey: (o: T) => string | undefined
): { [indexKey: string]: T } {
	const normalizedObject: { [indexKey: string]: T } = {}
	for (const obj of array) {
		const key = getKey(obj)
		if (key !== undefined) {
			normalizedObject[key] = obj
		}
	}
	return normalizedObject
}
export function normalizeArrayFunc<T>(array: Array<T>, getKey: (o: T) => string): { [indexKey: string]: T } {
	const normalizedObject: { [indexKey: string]: T } = {}
	for (const obj of array) {
		normalizedObject[getKey(obj)] = obj
	}
	return normalizedObject as { [key: string]: T }
}
export function normalizeArray<T>(array: Array<T>, indexKey: keyof T): { [indexKey: string]: T } {
	const normalizedObject: any = {}
	for (const obj of array) {
		normalizedObject[obj[indexKey]] = obj
	}
	return normalizedObject as { [key: string]: T }
}
export function normalizeArrayToMap<T, K extends keyof T>(array: T[], indexKey: K): Map<T[K], T> {
	const normalizedObject = new Map<T[K], T>()
	for (const item of array) {
		normalizedObject.set(item[indexKey], item)
	}
	return normalizedObject
}

/**
 * Recursively delete all undefined properties from the supplied object.
 * This is necessary as _.isEqual({ a: 1 }, { a: 1, b: undefined }) === false
 */
export function deleteAllUndefinedProperties<T>(obj: T): void {
	if (Array.isArray(obj)) {
		for (const v of obj) {
			deleteAllUndefinedProperties(v)
		}
	} else if (obj && typeof obj === 'object') {
		for (const key in obj) {
			if (obj[key] === undefined) {
				delete obj[key]
			} else {
				deleteAllUndefinedProperties(obj[key])
			}
		}
	}
}

export function applyToArray<T>(arr: T | T[], func: (val: T) => void): void {
	if (Array.isArray(arr)) {
		for (const val of arr) {
			func(val)
		}
	} else {
		func(arr)
	}
}

export function objectPathGet(obj: any, path: string, defaultValue?: any) {
	const v = objectPath.get(obj, path)
	if (v === undefined && defaultValue !== undefined) return defaultValue
	return v
}
export function objectPathSet(obj: any, path: string, value: any) {
	objectPath.set(obj, path, value)
	return obj
}

/**
 * Returns a rank number, to be used to insert new objects in a ranked list
 * @param before   The element before the one-to-be-inserted, null/undefined if inserted first
 * @param after	   The element after the one-to-be-inserted, null/undefined if inserted last
 * @param i        If inserting multiple elements; the internal rank of the to-be-inserted element
 * @param count    If inserting multiple elements, this is total count of inserted elements
 */
export function getRank<T extends { _rank: number }>(
	before: T | null | undefined,
	after: T | null | undefined,
	i = 0,
	count = 1
): number {
	let newRankMax: number
	let newRankMin: number

	if (after) {
		if (before) {
			newRankMin = before._rank
			newRankMax = after._rank
		} else {
			// First
			newRankMin = after._rank - 1
			newRankMax = after._rank
		}
	} else {
		if (before) {
			// Last
			newRankMin = before._rank
			newRankMax = before._rank + 1
		} else {
			// Empty list
			newRankMin = 0
			newRankMax = 1
		}
	}
	return newRankMin + ((i + 1) / (count + 1)) * (newRankMax - newRankMin)
}

export interface ManualPromise<T> extends Promise<T> {
	manualResolve(res: T): void
	manualReject(e: Error): void
}
export function createManualPromise<T>(): ManualPromise<T> {
	let resolve: (val: T) => void = () => null
	let reject: (err: Error) => void = () => null
	const promise = new Promise<T>((resolve0, reject0) => {
		resolve = resolve0
		reject = reject0
	})

	const manualPromise: ManualPromise<T> = promise as any
	manualPromise.manualReject = reject
	manualPromise.manualResolve = resolve

	return manualPromise
}

export function formatDateAsTimecode(settings: ISettings, date: Date): string {
	const tc = Timecode.init({
		framerate: settings.frameRate + '',
		timecode: date,
		drop_frame: !Number.isInteger(settings.frameRate),
	})
	return tc.toString()
}
/**
 * @param duration time in milliseconds
 */
export function formatDurationAsTimecode(settings: ISettings, duration: Time): string {
	const tc = Timecode.init({
		framerate: settings.frameRate + '',
		timecode: (duration * settings.frameRate) / 1000,
		drop_frame: !Number.isInteger(settings.frameRate),
	})
	return tc.toString()
}

/**
 * Deeply iterates through the object and removes propertys whose value equals null
 * @param obj
 */
export function removeNullyProperties<T>(obj: T): T {
	iterateDeeply(obj, (val, _key) => {
		if (_.isArray(val)) {
			return iterateDeeplyEnum.CONTINUE
		} else if (_.isObject(val)) {
			_.each(_.keys(val), (k) => {
				if (_.isNull(val[k])) {
					delete val[k]
				}
			})
			return iterateDeeplyEnum.CONTINUE
		} else {
			return val
		}
	})
	return obj
}