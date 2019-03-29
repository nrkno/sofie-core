import * as _ from 'underscore'
import { PeripheralDeviceAPI } from '../lib/api/peripheralDevice'
import { PeripheralDevices, PeripheralDevice } from '../lib/collections/PeripheralDevices'
import { Meteor } from 'meteor/meteor'
import { MOS } from 'tv-automation-sofie-blueprints-integration'

export interface RunningOrderCacheBackup {
	type: 'runningOrderCache'
	data: {
		type: 'roCreate' | 'fullStory'
		data: any
	}[]
}
export function restoreRunningOrder (backup: RunningOrderCacheBackup) {
	const roCreates = backup.data.filter(d => d.type === 'roCreate')
	const stories = backup.data.filter(d => d.type === 'fullStory')
	if (!roCreates || roCreates.length !== 1) {
		throw new Meteor.Error(500, 'bad number of roCreate entries')
	}
	if (roCreates[0].data.Stories && stories.length !== roCreates[0].data.Stories.length) {
		// logger.warning('bad number of fullStory entries in running order data')
	}

	// TODO - this should choose one in a better way
	let pd = PeripheralDevices.findOne({
		type: PeripheralDeviceAPI.DeviceType.MOSDEVICE
	}) as PeripheralDevice
	if (!pd) {
		throw new Meteor.Error(404, 'MOS Device not found to be used for mock running order!')
	}
	let id = pd._id
	let token = pd.token

	// Delete the existing copy, to ensure this is a clean import
	try {
		Meteor.call(PeripheralDeviceAPI.methods.mosRoDelete, id, token, new MOS.MosString128(roCreates[0].data.ID))
	} catch (e) {
		// Ignore. likely doesnt exist
	}

	// Create the RO
	Meteor.call(PeripheralDeviceAPI.methods.mosRoCreate, id, token, roCreates[0].data)

	// // Import each story
	_.each(stories, (story) => {
		try {
			Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token, story.data)
		} catch (e) {
			// Ignore.
		}
	})
}
