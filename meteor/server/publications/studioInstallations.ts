import { Meteor } from 'meteor/meteor'

import { StudioInstallations } from '../../lib/collections/StudioInstallations'
import { StudioInstallationsSecurity } from '../security/studioInstallations'
import { PeripheralDeviceSecurity } from '../security/peripheralDevices'
import { PeripheralDevices } from '../../lib/collections/PeripheralDevices'

Meteor.publish('studioInstallations', (selector, token) => {
	if (!selector) throw new Meteor.Error(400, 'selector argument missing')
	const modifier = {
		fields: {
			token: 0
		}
	}
	if (StudioInstallationsSecurity.allowReadAccess(selector, token, this)) {
		return StudioInstallations.find(selector, modifier)
	}
	return this.ready()
})
Meteor.publish('studioInstallationOfDevice', (deviceId: string, token) => {

	if (PeripheralDeviceSecurity.allowReadAccess({_id: deviceId}, token, this)) {

		let peripheralDevice = PeripheralDevices.findOne(deviceId)

		if (!peripheralDevice) throw new Meteor.Error('PeripheralDevice "' + deviceId + '" not found')

		const modifier = {
			fields: {
				token: 0
			}
		}
		let selector = {
			_id: peripheralDevice.studioInstallationId
		}
		if (StudioInstallationsSecurity.allowReadAccess(selector, token, this)) {
			return StudioInstallations.find(selector, modifier)
		}
	}
	return this.ready()
})
