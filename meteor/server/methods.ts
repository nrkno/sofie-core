import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { logger } from './logging'
import { extractFunctionSignature } from './lib'

export interface Methods {
	[method: string]: Function
}
export const MeteorMethodSignatures: {[key: string]: string[]} = {}

let runningMethods: {[methodId: string]: {
	method: string,
	startTime: number,
	i: number
}} = {}
let runningMethodstudio: number = 0
/**
 * Wrapper for Meteor.methods(), keeps track of which methods are currently running
 * @param orgMethods The methods to add
 * @param secret Set to true to not expose methods to API
 */
export function setMeteorMethods (orgMethods: Methods, secret?: boolean): void {

	// Wrap methods
	let methods: Methods = {}
	_.each(orgMethods, (method: Function, methodName: string) => {

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
				const signature = extractFunctionSignature(method)
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
