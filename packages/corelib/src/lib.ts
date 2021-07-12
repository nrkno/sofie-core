import * as _ from 'underscore'
import { ITranslatableMessage as IBlueprintTranslatableMessage } from '@sofie-automation/blueprints-integration'
import { ReadonlyDeep } from 'type-fest'
import fastClone = require('fast-clone')
import { Random } from './random'
import { ProtectedString, protectString } from './protectedString'

export type TimeDuration = number

export type ArrayElement<A> = A extends readonly (infer T)[] ? T : never

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
