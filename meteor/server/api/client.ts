import { Meteor } from 'meteor/meteor'
import { check, Match } from 'meteor/check'
import { Random } from 'meteor/random'
import * as _ from 'underscore'

import { literal, getCurrentTime, MeteorPromiseCall } from '../../lib/lib'

import { logger } from '../logging'
import { ClientAPI } from '../../lib/api/client'
import { UserActionsLog, UserActionsLogItem } from '../../lib/collections/UserActionsLog'

export namespace ServerClientAPI {
	export function execMethod (methodName, ...args: any[]) {
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
		try {
			let result = Meteor.call(methodName, ...args)

			UserActionsLog.update(actionId, {$set: {
				success: true,
				doneTime: getCurrentTime()
			}})
			return result
		} catch (e) {
			// console.log('eeeeeeeeeeeeeee')
			// allow the exception to be handled by the Client code
			let errMsg = e.message || e.reason || (e.toString ? e.toString() : null)
			logger.error(errMsg)
			UserActionsLog.update(actionId, {$set: {
				success: false,
				doneTime: getCurrentTime(),
				errorMessage: errMsg
			}})
			throw e
		}
	}
}
let methods = {}
methods[ClientAPI.methods.execMethod] = function (...args) {
	ServerClientAPI.execMethod.apply(this, args)
}

// Apply methods:
Meteor.methods(methods)
