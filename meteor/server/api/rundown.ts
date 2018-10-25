import { Meteor } from 'meteor/meteor'
import { RundownAPI } from '../../lib/api/rundown'
import { RunningOrders } from '../../lib/collections/RunningOrders'
import { PlayoutAPI } from '../../lib/api/playout'
import { logger } from '../../lib/logging'

export namespace ServerRundownAPI {
	export function roDelete (runningOrderId: string) {
		logger.info('roDelete ' + runningOrderId)

		logger.info('Removing RO ' + runningOrderId)
		let ro = RunningOrders.findOne(runningOrderId)
		if (ro) {
			ro.remove()
		}
	}
	export function roResync (runningOrderId: string) {
		logger.info('roResync ' + runningOrderId)

		logger.info('Re-syncing RO ' + runningOrderId)
		let ro = RunningOrders.findOne(runningOrderId)
		if (ro) {
			RunningOrders.update(ro._id, {
				$set: {
					unsynced: false
				}
			})

			Meteor.call(PlayoutAPI.methods.reloadData, runningOrderId, false, (err, result) => {
				if (err) {
					console.error(err)
					return
				}
			})
		}
	}
}

let methods = {}
methods[RundownAPI.methods.roDelete] = (roId: string) => {
	return ServerRundownAPI.roDelete(roId)
}
methods[RundownAPI.methods.roResync] = (roId: string) => {
	return ServerRundownAPI.roResync(roId)
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
