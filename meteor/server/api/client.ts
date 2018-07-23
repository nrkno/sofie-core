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
		let retPromise = new Promise((resolve, reject) => {
			try {
				Meteor.call(methodName, ...args, (err, res) => {
					if (err) reject(err)
					else resolve(res)
				})
			} catch (e) {
				// allow the exception to be handled by the Client code
				logger.error(e.message || e.reason || (e.toString ? e.toString() : null) || e)
				reject(e)
			}
		})

		UserActionsLog.insert(literal<UserActionsLogItem>({
			_id: Random.id(),
			clientAddress: this.connection.clientAddress,
			userId: this.userId,
			method: methodName,
			args: JSON.stringify(args),
			timestamp: getCurrentTime()
		}))

		return retPromise
	}
}

let methods = {}
methods[ClientAPI.methods.execMethod] = function (...args) {
	return ServerClientAPI.execMethod.apply(this, args)
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
