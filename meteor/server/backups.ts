import * as _ from 'underscore'
import { PeripheralDeviceAPI } from '../lib/api/peripheralDevice'
import { PeripheralDevices, PeripheralDevice } from '../lib/collections/PeripheralDevices'
import { Meteor } from 'meteor/meteor'
import { MOS } from 'tv-automation-sofie-blueprints-integration'

export interface RundownCacheBackup {
	type: 'rundownCache'
	data: {
		type: 'rundownCreate' | 'fullStory'
		data: any
	}[]
}
export function restoreRundown (backup: RundownCacheBackup) {
	const rundownCreates = backup.data.filter(d => d.type === 'rundownCreate')
	const stories = backup.data.filter(d => d.type === 'fullStory')
	if (!rundownCreates || rundownCreates.length !== 1) {
		throw new Meteor.Error(500, 'bad number of rundownCreate entries')
	}
	if (rundownCreates[0].data.Stories && stories.length !== rundownCreates[0].data.Stories.length) {
		// logger.warning('bad number of fullStory entries in rundown data')
	}

	// TODO - this should choose one in a better way
	let pd = PeripheralDevices.findOne({
		type: PeripheralDeviceAPI.DeviceType.MOSDEVICE
	}) as PeripheralDevice
	if (!pd) {
		throw new Meteor.Error(404, 'MOS Device not found to be used for mock rundown!')
	}
	let id = pd._id
	let token = pd.token

	// Delete the existing copy, to ensure this is a clean import
	try {
		Meteor.call(PeripheralDeviceAPI.methods.mosRundownDelete, id, token, new MOS.MosString128(rundownCreates[0].data.ID))
	} catch (e) {
		// Ignore. likely doesnt exist
	}

	// Create the rundown
	Meteor.call(PeripheralDeviceAPI.methods.mosRundownCreate, id, token, rundownCreates[0].data)

	// // Import each story
	_.each(stories, (story) => {
		try {
			Meteor.call(PeripheralDeviceAPI.methods.mosRundownFullStory, id, token, story.data)
		} catch (e) {
			// Ignore.
		}
	})
}
