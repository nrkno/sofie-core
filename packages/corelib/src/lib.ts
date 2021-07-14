import * as _ from 'underscore'
import { ITranslatableMessage as IBlueprintTranslatableMessage } from '@sofie-automation/blueprints-integration'
import { ReadonlyDeep } from 'type-fest'
import fastClone = require('fast-clone')
import { Random } from './random'
import { ProtectedString, protectString } from './protectedString'
import * as objectPath from 'object-path'
import * as crypto from 'crypto'

export type TimeDuration = number

export type ArrayElement<A> = A extends readonly (infer T)[] ? T : never

export function getHash(str: string): string {
	const hash = crypto.createHash('sha1')
	return hash.update(str).digest('base64').replace(/[+/=]/g, '_') // remove +/= from strings, because they cause troubles
}

/**
 * @enum - A translatable message (i18next)
 */
export interface ITranslatableMessage extends IBlueprintTranslatableMessage {
	/** namespace used */
	namespaces?: Array<string>
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
