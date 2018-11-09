import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { logger } from './logging'

export interface Methods {
	[method: string]: Function
}

let runningMethods: {[methodId: string]: {
	method: string,
	startTime: number,
	i: number
}} = {}
let runningMethodsI: number = 0
/**
 * Wrapper for Meteor.methods(), keeps track of which methods are currently running
 * @param orgMethods
 */
export function setMeteorMethods (orgMethods: Methods): void {

	// Wrap methods
	let methods: any = {}
	_.each(orgMethods, (method: Function, methodName: string) => {

		if (method) {

			methods[methodName] = function (...args: any[]) {
				let i = runningMethodsI++
				let methodId = 'm' + i

				runningMethods[methodId] = {
					method: methodName,
					startTime: Date.now(),
					i: i
				}
				let result: any
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
					delete runningMethods[methodId]
					throw err
				}
			}
		}
	})
	Meteor.methods(methods)
}
export function wrapMethods (methods: Methods): Methods {
	let methodsOut: Methods = {}
	_.each(methods, (fcn: Function, key) => {
		methodsOut[key] = (...args: any[]) => {
			// logger.info('------- Method call -------')
			// logger.info(key)
			// logger.info(args)
			// logger.info('---------------------------')
			try {
				return fcn.apply(null, args)
			} catch (e) {
				logger.error(e.message || e.reason || (e.toString ? e.toString() : null) || e)
				throw e
			}
		}
	})
	return methodsOut
}
export function getRunningMethods () {
	return runningMethods
}
export function resetRunningMethods () {
	runningMethods = {}
}
