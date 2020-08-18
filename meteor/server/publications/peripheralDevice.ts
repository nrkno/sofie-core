import { Meteor } from 'meteor/meteor'
import { check } from '../../lib/check'
import { meteorPublish, AutoFillSelector } from './lib'
import { PubSub } from '../../lib/api/pubsub'
import { PeripheralDeviceReadAccess } from '../security/peripheralDevice'
import { PeripheralDevices, PeripheralDeviceId, PeripheralDevice } from '../../lib/collections/PeripheralDevices'
import { PeripheralDeviceCommands } from '../../lib/collections/PeripheralDeviceCommands'
import { MediaWorkFlowSteps } from '../../lib/collections/MediaWorkFlowSteps'
import { MediaWorkFlows } from '../../lib/collections/MediaWorkFlows'
import { OrganizationReadAccess } from '../security/organization'
import { StudioReadAccess } from '../security/studio'
import { FindOptions, UserId } from '../../lib/typings/meteor'
import { Credentials, ResolvedCredentials } from '../security/lib/credentials'
import { NoSecurityReadAccess } from '../security/noSecurity'

function checkAccess(cred: Credentials | ResolvedCredentials, selector) {
	if (!selector) throw new Meteor.Error(400, 'selector argument missing')
	return (
		NoSecurityReadAccess.any() ||
		(selector._id && PeripheralDeviceReadAccess.peripheralDevice(selector, cred)) ||
		(selector.organizationId && OrganizationReadAccess.organizationContent(selector, cred)) ||
		(selector.studioId && StudioReadAccess.studioContent(selector, cred))
	)
}
meteorPublish(PubSub.peripheralDevices, function(selector0, token) {
	const { cred, selector } = AutoFillSelector.organizationId(this.userId, selector0, token)
	if (checkAccess(cred, selector)) {
		const modifier: FindOptions<PeripheralDevice> = {
			fields: {
				token: 0,
				secretSettings: 0,
			},
		}
		if (selector._id && token && modifier.fields) {
			// in this case, send the secretSettings:
			delete modifier.fields.secretSettings
		}
		return PeripheralDevices.find(selector, modifier)
	}
	return null
})

meteorPublish(PubSub.peripheralDevicesAndSubDevices, function(selector0, token) {
	const { cred, selector } = AutoFillSelector.organizationId(this.userId, selector0, token)
	if (checkAccess(cred, selector)) {
		const parents = PeripheralDevices.find(selector).fetch()

		const modifier: FindOptions<PeripheralDevice> = {
			fields: {
				token: 0,
				secretSettings: 0,
			},
		}

		const cursor = PeripheralDevices.find(
			{
				$or: [
					{
						parentDeviceId: { $in: parents.map((i) => i._id) },
					},
					selector,
				],
			},
			modifier
		)

		return cursor
	}
	return null
})
meteorPublish(PubSub.peripheralDeviceCommands, function(deviceId: PeripheralDeviceId, token) {
	if (!deviceId) throw new Meteor.Error(400, 'deviceId argument missing')
	check(deviceId, String)
	if (PeripheralDeviceReadAccess.peripheralDeviceContent({ deviceId: deviceId }, { userId: this.userId, token })) {
		return PeripheralDeviceCommands.find({ deviceId: deviceId })
	}
	return null
})
meteorPublish(PubSub.mediaWorkFlows, function(selector0, token) {
	const { cred, selector } = AutoFillSelector.deviceId(this.userId, selector0, token)
	if (PeripheralDeviceReadAccess.peripheralDeviceContent(selector, cred)) {
		return MediaWorkFlows.find(selector)
	}
	return null
})
meteorPublish(PubSub.mediaWorkFlowSteps, function(selector0, token) {
	const { cred, selector } = AutoFillSelector.deviceId(this.userId, selector0, token)
	if (PeripheralDeviceReadAccess.peripheralDeviceContent(selector, cred)) {
		return MediaWorkFlowSteps.find(selector)
	}
	return null
})
