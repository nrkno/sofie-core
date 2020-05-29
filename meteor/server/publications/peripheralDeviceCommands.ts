import { Meteor } from 'meteor/meteor'

import { PeripheralDeviceSecurity } from '../security/peripheralDevices'
import { PeripheralDeviceCommands, PeripheralDeviceCommand } from '../../lib/collections/PeripheralDeviceCommands'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'
import { PeripheralDeviceId } from '../../lib/collections/PeripheralDevices'
import { check } from '../../lib/lib'
import { FindOptions } from '../../lib/typings/meteor'

meteorPublish(PubSub.peripheralDeviceCommands, function (deviceId: PeripheralDeviceId, token) {
	if (!deviceId) throw new Meteor.Error(400,'deviceId argument missing')
	check(deviceId, String)

	const modifier: FindOptions<PeripheralDeviceCommand> = {
		fields: {}
	}

	if (PeripheralDeviceSecurity.allowReadAccess({ _id: deviceId }, token, this)) {
		return PeripheralDeviceCommands.find({ deviceId: deviceId }, modifier)

	}
	return null
})
meteorPublish(PubSub.allPeripheralDeviceCommands, function () { // tmp: dev only, should be removed before release

	const modifier: FindOptions<PeripheralDeviceCommand> = {
		fields: {}
	}

	return PeripheralDeviceCommands.find({}, modifier)
})
