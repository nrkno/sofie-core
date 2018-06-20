import { Meteor } from 'meteor/meteor'
import { check } from 'meteor/check'

import { PeripheralDeviceSecurity } from '../security/peripheralDevices'
import { PeripheralDeviceCommands } from '../../lib/collections/PeripheralDeviceCommands'
import { logger } from '../logging'

Meteor.publish('peripheralDeviceCommands', function (deviceId: string, token) {
	if (!deviceId) throw new Meteor.Error(400,'deviceId argument missing')
	check(deviceId, String)

	const modifier = {
		fields: {
			token: 0
		}
	}

	logger.debug('pub peripheralDeviceCommands')

	if (PeripheralDeviceSecurity.allowReadAccess({_id: deviceId}, token, this)) {
		logger.debug('pub peripheralDeviceCommands OK ' + deviceId)
		return PeripheralDeviceCommands.find({deviceId: deviceId}, modifier)

	}
	return this.ready()
})
Meteor.publish('allPeripheralDeviceCommands', function () { // tmp: dev only, should be removed before release

	const modifier = {
		fields: {
			token: 0
		}
	}

	logger.debug('pub peripheralDeviceCommands')

	return PeripheralDeviceCommands.find({}, modifier)

	// return this.ready()
})
