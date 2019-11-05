import { Meteor } from 'meteor/meteor'
import { PeripheralDevice } from '../../../../lib/collections/PeripheralDevices'
import { Rundown } from '../../../../lib/collections/Rundowns'
import { UserActionAPI } from '../../../../lib/api/userActions'
import { WrapAsyncCallback } from '../../../../lib/lib'
import { logger } from '../../../logging'
import { PeripheralDeviceAPI } from '../../../../lib/api/peripheralDevice'
import * as _ from 'underscore'

export namespace INewsDeviceActions {
	export const reloadRundown: (peripheralDevice: PeripheralDevice, rundown: Rundown) => UserActionAPI.ReloadRundownResponse = Meteor.wrapAsync(
		function reloadRundown (peripheralDevice: PeripheralDevice, rundown: Rundown, cb: WrapAsyncCallback<UserActionAPI.ReloadRundownResponse>): void {
			logger.info('reloadRundown ' + rundown._id)

			PeripheralDeviceAPI.executeFunction(peripheralDevice._id, (err: Error, iNewsRunningOrder: any) => {
				if (err) {
					if (_.isString(err) && err.match(/rundown does not exist/i)) {
						// Don't throw an error, instead return MISSING value
						cb(null, UserActionAPI.ReloadRundownResponse.MISSING)
					} else {
						logger.error('Error in MOSDeviceActions.reloadRundown', err)
						cb(err)
					}
				} else {
					try {
						logger.info('triggerGetRunningOrder reply ' + iNewsRunningOrder.externalId)
						logger.debug(iNewsRunningOrder)

						if (iNewsRunningOrder.length !== 1) {
							throw new Meteor.Error(401, iNewsRunningOrder)
						}

						if (iNewsRunningOrder[0].externalId !== rundown.externalId) {
							throw new Meteor.Error(401, `Expected triggerGetRunningOrder reply for ${rundown.externalId} but got ${iNewsRunningOrder[0].externalId}`)
						}

						// Since the Reload reply is asynchronously followed by ROFullStories, the reload is technically not completed at this point
						cb(null, UserActionAPI.ReloadRundownResponse.WORKING)
					} catch (e) {
						cb(e)
					}
				}
			}, 'triggerGetRunningOrder', rundown.externalId)
		}
	)
}
