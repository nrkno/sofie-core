import { Meteor } from 'meteor/meteor'
import { PeripheralDevice } from '../../../../lib/collections/PeripheralDevices'
import { Rundown } from '../../../../lib/collections/Rundowns'
import { WrapAsyncCallback } from '../../../../lib/lib'
import { logger } from '../../../logging'
import { PeripheralDeviceAPI } from '../../../../lib/api/peripheralDevice'
import * as _ from 'underscore'
import { ReloadRundownResponse } from '../../../../lib/api/userActions'

export namespace INewsDeviceActions {
	export const reloadRundown: (peripheralDevice: PeripheralDevice, rundown: Rundown) => ReloadRundownResponse = Meteor.wrapAsync(
		function reloadRundown (peripheralDevice: PeripheralDevice, rundown: Rundown, cb: WrapAsyncCallback<ReloadRundownResponse>): void {
			logger.info('reloadRundown ' + rundown._id)

			PeripheralDeviceAPI.executeFunction(peripheralDevice._id, (err: Error, iNewsRunningOrder: any) => {
				if (err) {
					if (_.isString(err) && err.match(/rundown does not exist/i)) {
						// Don't throw an error, instead return MISSING value
						cb(null, ReloadRundownResponse.MISSING)
					} else {
						logger.error('Error in MOSDeviceActions.reloadRundown', err)
						cb(err)
					}
				} else {
					try {
						logger.info('triggerGetRunningOrder reply ' + iNewsRunningOrder.externalId)
						logger.debug(iNewsRunningOrder)

						if (!iNewsRunningOrder.length) {
							throw new Meteor.Error(401, iNewsRunningOrder)
						}

						// Since the Reload reply is asynchronously followed by ROFullStories, the reload is technically not completed at this point
						cb(null, ReloadRundownResponse.WORKING)
					} catch (e) {
						cb(e)
					}
				}
			}, 'triggerGetRunningOrder', rundown.externalId)
		}
	)
}
