import { Meteor } from 'meteor/meteor'

import { PeripheralDevices } from '../../lib/collections/PeripheralDevices'
import { PeripheralDeviceSecurity } from '../security/peripheralDevices'

Meteor.publish('peripheralDevices', function (selector, token) {

	if (!selector) throw new Meteor.Error(400,'selector argument missing')

	const modifier = {
		fields: {
			token: 0
		}
	}

	console.log('pub peripheralDevices')

	if (PeripheralDeviceSecurity.allowReadAccess(selector, token, this)) {

		return PeripheralDevices.find(selector, modifier)

	}
	return this.ready()
})
