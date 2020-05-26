import { Meteor } from 'meteor/meteor'
import { check } from 'meteor/check'

import { PeripheralDeviceSecurity } from '../security/peripheralDevices'
import { PeripheralDeviceCommands } from '../../lib/collections/PeripheralDeviceCommands'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'
import { PeripheralDeviceId } from '../../lib/collections/PeripheralDevices'

meteorPublish(PubSub.peripheralDeviceCommands, function (deviceId: PeripheralDeviceId, token) {
	if (!deviceId) throw new Meteor.Error(400,'deviceId argument missing')
	check(deviceId, String)

	const modifier = {
		fields: {
			token: 0
		}
	}

	if (PeripheralDeviceSecurity.allowReadAccess({ _id: deviceId }, token, this)) {
		return PeripheralDeviceCommands.find({ deviceId: deviceId }, modifier)

	}
	return null
})
meteorPublish(PubSub.allPeripheralDeviceCommands, function () { // tmp: dev only, should be removed before release

	const modifier = {
		fields: {
			token: 0
		}
	}

	return PeripheralDeviceCommands.find({}, modifier)
})
