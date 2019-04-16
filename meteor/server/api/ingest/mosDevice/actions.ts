import { logger } from '../../../logging'
import { Rundown } from '../../../../lib/collections/Rundowns'
import { Meteor } from 'meteor/meteor'
import { PeripheralDevices, PeripheralDevice } from '../../../../lib/collections/PeripheralDevices'
import { check } from 'meteor/check'
import { PeripheralDeviceAPI } from '../../../../lib/api/peripheralDevice'
import { Part } from '../../../../lib/collections/Parts'

export namespace MOSDeviceActions {
	export const reloadRundown: (peripheralDevice: PeripheralDevice, rundown: Rundown) => void = Meteor.wrapAsync(
		function reloadRundown (peripheralDevice: PeripheralDevice, rundown: Rundown, cb: (err: Error | null) => void) {
			logger.info('reloadRundown ' + rundown._id)

			if (!rundown.peripheralDeviceId) throw new Meteor.Error(400,'rundown.peripheralDeviceId missing!')
			check(rundown.peripheralDeviceId, String)

			// const peripheralDevice = PeripheralDevices.findOne(rundown.peripheralDeviceId)
			// if (!peripheralDevice) throw new Meteor.Error(404, 'PeripheralDevice "' + rundown.peripheralDeviceId + '" not found' )

			PeripheralDeviceAPI.executeFunction(peripheralDevice._id, (err: any, mosRunningOrder: MOS.IMOSRunningOrder) => {
				// console.log('Response!')
				if (err) {
					logger.error(err)
					cb(err)
				} else {
					try {
						logger.info('triggerGetRundown reply ' + rundown.ID)
						logger.debug(rundown)

						handleRundownData(mosRunningOrder, peripheralDevice, false)
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
		oldPlayingPart,
		newPlayingPart
	) {



		if (oldPlayingPart) {
			setStoryStatus(rundown.peripheralDeviceId, rundown, oldPlayingPart, MOS.IMOSObjectStatus.STOP)
			.catch(e => logger.error(e))
		}
		if (takePart) {
			setStoryStatus(rundown.peripheralDeviceId, rundown, takePart.externalId, MOS.IMOSObjectStatus.PLAY)
			.catch(e => logger.error(e))

			Rundowns.update(this._id, {$set: {
				currentPlayingStoryStatus: takePart.externalId
			}})
			rundown.notifiedCurrentPlayingPartExternalId = takePart.externalId
		} else {
			Rundowns.update(this._id, {$unset: {
				currentPlayingStoryStatus: 1
			}})
			delete rundown.notifiedCurrentPlayingPartExternalId
		}
	}
	function setStoryStatus (deviceId: string, rundown: Rundown, storyId: string, status: MOS.IMOSObjectStatus): Promise<any> {
		return new Promise((resolve, reject) => {
			if (!rundown.rehearsal) {
				logger.debug('setStoryStatus', deviceId, rundown.externalId, storyId, status)
				PeripheralDeviceAPI.executeFunction(deviceId, (err, result) => {
					logger.debug('reply', err, result)
					if (err) {
						reject(err)
					} else {
						resolve(result)
					}
				}, 'setStoryStatus', rundown.externalId, storyId, status)
			}
		})
	}
}
