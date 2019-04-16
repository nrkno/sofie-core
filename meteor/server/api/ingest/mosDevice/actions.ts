import * as MOS from 'mos-connection'
import { logger } from '../../../logging'
import { Rundown } from '../../../../lib/collections/Rundowns'
import { Meteor } from 'meteor/meteor'
import { PeripheralDevice, PeripheralDevices } from '../../../../lib/collections/PeripheralDevices'
import { PeripheralDeviceAPI } from '../../../../lib/api/peripheralDevice'
import { handleMosRundownData } from './ingest'
import { Piece } from '../../../../lib/collections/Pieces'
import { IngestPart } from 'tv-automation-sofie-blueprints-integration'

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

						handleMosRundownData(peripheralDevice, mosRunningOrder, false)
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

	export function setPieceInOutPoint (rundown: Rundown, piece: Piece, partCache: IngestPart, inPoint: number, duration: number) {
		return new Promise((resolve, reject) => {
			if (!partCache.payload) throw new Meteor.Error(500, `Part Cache for "${partCache.externalId}" missing payload!`)
			const mosPayload = partCache.payload as MOS.IMOSROFullStory
			if (!mosPayload.Body) throw new Meteor.Error(500, `Part Cache for "${partCache.externalId}" missing FullStory content!`)

			const story = mosPayload.Body.filter(item => item.Type === 'storyItem' && item.Content.ID === piece.externalId)[0].Content
			story.EditorialStart = inPoint
			story.EditorialDuration = duration

			const peripheralDevice = PeripheralDevices.findOne(rundown.peripheralDeviceId)
			if (!peripheralDevice) throw new Meteor.Error(404, 'PeripheralDevice "' + rundown.peripheralDeviceId + '" not found' )

			PeripheralDeviceAPI.executeFunction(peripheralDevice._id, (err?: any) => {
				if (err) reject(err)
				else resolve()
			}, 'replaceStoryItem', mosPayload.RunningOrderId, mosPayload.ID, story)
		})
	}
}
