import { Meteor } from 'meteor/meteor'

import { Studios, DBStudio } from '../../lib/collections/Studios'
import { StudiosSecurity } from '../security/studios'
import { PeripheralDeviceSecurity } from '../security/peripheralDevices'
import { PeripheralDevices, PeripheralDeviceId } from '../../lib/collections/PeripheralDevices'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'
import { FindOptions } from '../../lib/typings/meteor'

meteorPublish(PubSub.studios, (selector, token) => {
	if (!selector) throw new Meteor.Error(400, 'selector argument missing')
	const modifier: FindOptions<DBStudio> = {
		fields: {}
	}
	if (StudiosSecurity.allowReadAccess(selector, token, this)) {
		return Studios.find(selector, modifier)
	}
	return null
})
meteorPublish(PubSub.studioOfDevice, (deviceId: PeripheralDeviceId, token) => {

	if (PeripheralDeviceSecurity.allowReadAccess({ _id: deviceId }, token, this)) {

		let peripheralDevice = PeripheralDevices.findOne(deviceId)

		if (!peripheralDevice) throw new Meteor.Error('PeripheralDevice "' + deviceId + '" not found')

		const modifier: FindOptions<DBStudio> = {
			fields: {}
		}
		let selector = {
			_id: peripheralDevice.studioId
		}
		if (StudiosSecurity.allowReadAccess(selector, token, this)) {
			return Studios.find(selector, modifier)
		}
	}
	return null
})
