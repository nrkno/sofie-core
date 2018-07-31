import { RunningOrderDataCache } from '../lib/collections/RunningOrderDataCache'
import { RunningOrders } from '../lib/collections/RunningOrders'
import { PeripheralDeviceAPI } from '../lib/api/peripheralDevice'
import { PeripheralDevices } from '../lib/collections/PeripheralDevices'
import * as _ from 'underscore'
import { getCurrentTime } from '../lib/lib'
import { logger } from './logging'

let lowPrioFcn = (fcn: (...args) => any, ...args: any[]) => {
	// Do it at a random time in the future:
	setTimeout(() => {
		fcn(...args)
	}, Math.random() * 10 * 1000)
}

Meteor.startup(() => {

	Meteor.setInterval(() => {
		let d = new Date(getCurrentTime())
		if (d.getHours() > 0 && d.getHours() < 5) { // Nighttime
			logger.info('Starting nightly cronjob')

			// remove old Running orders:
			let roCount = 0
			RunningOrders.find({
				created: {$lt: getCurrentTime() - 60 * 24 * 3600 * 1000} // older than 60 days
			}).forEach(ro => {
				ro.remove()
				roCount++
			})
			if (roCount) logger.info('Cronjob: Removed ' + roCount + ' old running orders')

			// Clean up RunningOrder data cache:
			// Remove caches not related to running orders:
			let roCacheCount = 0
			let roIds = _.pluck(RunningOrders.find().fetch(), '_id')
			RunningOrderDataCache.find({
				roId: {$nin: roIds}
			}).forEach((roc) => {
				lowPrioFcn(RunningOrderDataCache.remove, roc._id)
				roCacheCount++
			})
			if (roCacheCount) logger.info('Cronjob: Will remove cached data from ' + roCacheCount + ' running orders')

			// restart casparcg
			PeripheralDevices.find({ type: PeripheralDeviceAPI.DeviceType.PLAYOUT }).forEach(device => {
				logger.info('Cronjob: Trying to restart CasparCG on device "' + device._id + '"')
				PeripheralDeviceAPI.executeFunction(device._id, (err) => {
					if (err) {
						logger.error('Cronjob: "' + device._id + '": CasparCG restart error', err)
					} else {
						logger.info('Cronjob: "' + device._id + '": CasparCG restart done')
					}
				}, 'restartCasparCGProcess')
			})

			// last:
			logger.info('Nightly cronjob done')
		}

	}, 3 * 3600 * 1000)

})
