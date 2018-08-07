import { Meteor } from 'meteor/meteor'
import { check, Match } from 'meteor/check'
import { Random } from 'meteor/random'
import * as _ from 'underscore'

import { literal, getCurrentTime, MeteorPromiseCall } from '../../lib/lib'

import { logger } from '../logging'
import { ClientAPI } from '../../lib/api/client'
import { UserActionsLog, UserActionsLogItem } from '../../lib/collections/UserActionsLog'

export namespace ServerClientAPI {
	export function execMethod (methodName, ...args: any[]): Promise<any> {
		check(methodName, String)
		// this is essentially the same as MeteorPromiseCall, but rejects the promise on exception to
		// allow handling it in the client code

		let actionId = Random.id()

		UserActionsLog.insert(literal<UserActionsLogItem>({
			_id: actionId,
			clientAddress: this.connection.clientAddress,
			userId: this.userId,
			method: methodName,
			args: JSON.stringify(args),
			timestamp: getCurrentTime()
		}))

		let retPromise = new Promise((resolve, reject) => {
			try {
				Meteor.call(methodName, ...args, (err, res) => {
					if (err) reject(err)
					else resolve(res)
				})
				UserActionsLog.update(actionId, {$set: {
					success: true,
					doneTime: getCurrentTime()
				}})
			} catch (e) {
				// allow the exception to be handled by the Client code
				let errMsg = e.message || e.reason || (e.toString ? e.toString() : null)
				logger.error(errMsg)
				UserActionsLog.update(actionId, {$set: {
					success: false,
					doneTime: getCurrentTime(),
					errorMessage: errMsg
				}})
				reject(e)
			}
		})
		return retPromise
	}
}

let methods = {}
methods[ClientAPI.methods.execMethod] = function (...args) {
	let fcn = Meteor.wrapAsync((cb) => {
		ServerClientAPI.execMethod.apply(this, args)
		.then((result) => {
			cb(null, result)
		})
		.catch((err) => {
			cb(err, null)
		})
	})

	return fcn()
}

_.each(methods, (fcn: Function, key) => {
	methods[key] = function (...args: any[]) {
		// logger.info('------- Method call -------')
		// logger.info(key)
		// logger.info(args)
		// logger.info('---------------------------')
		try {
			return fcn.apply(this, args)
		} catch (e) {
			logger.error(e.message || e.reason || (e.toString ? e.toString() : null) || e)
			throw e
		}
	}
})

// Apply methods:
Meteor.methods(methods)
