import * as MOS from 'mos-connection'
import { logger } from '../../../logging'
import { Rundown, Rundowns } from '../../../../lib/collections/Rundowns'
import { Meteor } from 'meteor/meteor'
import { PeripheralDevice } from '../../../../lib/collections/PeripheralDevices'
import { check } from 'meteor/check'
import { PeripheralDeviceAPI } from '../../../../lib/api/peripheralDevice'
import { Part } from '../../../../lib/collections/Parts'
import { handleMosRundownData } from './ingest'

export namespace MOSDeviceActions {
	export const reloadRundown: (peripheralDevice: PeripheralDevice, rundown: Rundown) => void = Meteor.wrapAsync(
		function reloadRundown (peripheralDevice: PeripheralDevice, rundown: Rundown, cb: (err: Error | null) => void) {
			logger.info('reloadRundown ' + rundown._id)

			PeripheralDeviceAPI.executeFunction(peripheralDevice._id, (err: any, mosRunningOrder: MOS.IMOSRunningOrder) => {
				if (err) {
					logger.error(err)
					cb(err)
				} else {
					try {
						logger.info('triggerGetRundown reply ' + mosRunningOrder.ID)
						logger.debug(mosRunningOrder)

						handleMosRundownData(mosRunningOrder, peripheralDevice, false)
						cb(null)
					} catch (e) {
						cb(e)
					}
				}
			}, 'triggerGetRundown', rundown.externalId)
		}
	)
	export function notifyCurrentPlayingPart (
		peripheralDevice: PeripheralDevice,
		rundown: Rundown,
		oldPlayingPartExternalId: string | null,
		newPlayingPartExternalId: string | null
	) {

		if (oldPlayingPartExternalId) {
			setStoryStatus(peripheralDevice._id, rundown, oldPlayingPartExternalId, MOS.IMOSObjectStatus.STOP)
			.catch(e => logger.error(e))
		}
		if (newPlayingPartExternalId) {
			setStoryStatus(peripheralDevice._id, rundown, newPlayingPartExternalId, MOS.IMOSObjectStatus.PLAY)
			.catch(e => logger.error(e))
		}
	}
	function setStoryStatus (deviceId: string, rundown: Rundown, storyId: string, status: MOS.IMOSObjectStatus): Promise<any> {
		return new Promise((resolve, reject) => {
			logger.debug('setStoryStatus', deviceId, rundown.externalId, storyId, status)
			PeripheralDeviceAPI.executeFunction(deviceId, (err, result) => {
				logger.debug('reply', err, result)
				if (err) {
					reject(err)
				} else {
					resolve(result)
				}
			}, 'setStoryStatus', rundown.externalId, storyId, status)
		})
	}
}
