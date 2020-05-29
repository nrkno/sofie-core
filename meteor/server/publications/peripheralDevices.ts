import { Meteor } from 'meteor/meteor'

import { PeripheralDevices, PeripheralDevice } from '../../lib/collections/PeripheralDevices'
import { PeripheralDeviceSecurity } from '../security/peripheralDevices'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'
import { FindOptions } from '../../lib/typings/meteor'

meteorPublish(PubSub.peripheralDevices, function (selector, token) {

	if (!selector) throw new Meteor.Error(400,'selector argument missing')

	if (PeripheralDeviceSecurity.allowReadAccess(selector, token, this)) {

		const modifier: FindOptions<PeripheralDevice> = {
			fields: {
				token: 0,
				secretSettings: 0
			}
		}
		if (selector._id && token) {
			// in this case, send the secretSettings:
			delete modifier.fields!.secretSettings
		}
		return PeripheralDevices.find(selector, modifier)

	}
	return null
})

meteorPublish(PubSub.peripheralDevicesAndSubDevices, function (selector) {

	if (!selector) throw new Meteor.Error(400, 'selector argument missing')

	const parents = PeripheralDevices.find(selector).fetch()

	const modifier: FindOptions<PeripheralDevice> = {
		fields: {
			token: 0,
			secretSettings: 0
		}
	}

	const cursor = PeripheralDevices.find({
		$or: [
			{
				parentDeviceId: { $in: parents.map(i => i._id) }
			},
			selector
		]
	}, modifier)

	return cursor
})
