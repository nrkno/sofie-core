import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { logger } from './logging'
import { extractFunctionSignature } from './lib'
import { MethodContext } from '../lib/api/methods'

export interface Methods {
	[method: string]: Function
}
export interface MethodsInner {
	[method: string]: { wrapped: Function, original: Function}
}
export const MeteorMethodSignatures: {[key: string]: string[]} = {}

let runningMethods: {[methodId: string]: {
	method: string,
	startTime: number,
	i: number
}} = {}
let runningMethodstudio: number = 0

export function registerClassToMeteorMethods (methodEnum: any, orgClass: any, secret?: boolean, wrapper?: (methodContext: MethodContext, methodName: string, args: any[], fcn: Function) => any): void {
	const methods: MethodsInner = {}
	_.each(Object.getOwnPropertyNames(orgClass.prototype), classMethodName => {
		const enumValue = methodEnum[classMethodName]
		if (wrapper) {
			methods[enumValue] = {
				wrapped: function (...args: any[]) {
					return wrapper(this, enumValue, args, orgClass.prototype[classMethodName])
				},
				original: orgClass.prototype[classMethodName]
			}
		} else {
			methods[enumValue] = {
				wrapped: orgClass.prototype[classMethodName],
				original: orgClass.prototype[classMethodName]
			}
		}
	})
	setMeteorMethodsInner(methods, secret)
}
export function setMeteorMethods (orgMethods: Methods, secret?: boolean): void {
	const methods: MethodsInner = {}
	_.each(orgMethods, (fcn, key) => {
		methods[key] = {
			wrapped: fcn,
			original: fcn,
		}
	})
	return setMeteorMethodsInner(methods, secret)
}
/**
 * Wrapper for Meteor.methods(), keeps track of which methods are currently running
 * @param orgMethods The methods to add
 * @param secret Set to true to not expose methods to API
 */
export function setMeteorMethodsInner (orgMethods: MethodsInner, secret?: boolean): void {

	// Wrap methods
	let methods: Methods = {}
	_.each(orgMethods, (m, methodName: string) => {
		let method = m.wrapped
		if (method) {

			methods[methodName] = function (...args: any[]) {
				let i = runningMethodstudio++
				let methodId = 'm' + i

				runningMethods[methodId] = {
					method: methodName,
					startTime: Date.now(),
					i: i
				}
				try {
					let result = method.apply(this, args)

					if (typeof result === 'object' && result.then) {
						return Promise.resolve(result)
						.then((result) => {
							delete runningMethods[methodId]
							return result
						})
					} else {
						delete runningMethods[methodId]
						return result
					}

				} catch (err) {
					logger.error(err.message || err.reason || (err.toString ? err.toString() : null) || err)
					delete runningMethods[methodId]
					throw err
				}
			}
			if (!secret) {
				const signature = extractFunctionSignature(m.original)
				if (signature) MeteorMethodSignatures[methodName] = signature
			}
		}
	})
	Meteor.methods(methods)
}
export function getRunningMethods () {
	return runningMethods
}
export function resetRunningMethods () {
	runningMethods = {}
}
