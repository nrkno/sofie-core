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

export function literal<T>(o: T) {
	return o
}
