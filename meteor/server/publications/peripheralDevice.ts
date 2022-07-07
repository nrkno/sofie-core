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
import { FindOptions, MongoQuery } from '../../lib/typings/meteor'
import { Credentials, ResolvedCredentials } from '../security/lib/credentials'
import { NoSecurityReadAccess } from '../security/noSecurity'

/*
 * This file contains publications for the peripheralDevices, such as playout-gateway, mos-gateway and package-manager
 */

function checkAccess(cred: Credentials | ResolvedCredentials, selector: MongoQuery<PeripheralDevice>) {
	if (!selector) throw new Meteor.Error(400, 'selector argument missing')
	return (
		NoSecurityReadAccess.any() ||
		(selector._id && PeripheralDeviceReadAccess.peripheralDevice(selector._id, cred)) ||
		(selector.organizationId && OrganizationReadAccess.organizationContent<PeripheralDevice>(selector, cred)) ||
		(selector.studioId && StudioReadAccess.studioContent<PeripheralDevice>(selector, cred))
	)
}
meteorPublish(PubSub.peripheralDevices, async function (selector0, token) {
	const { cred, selector } = await AutoFillSelector.organizationId<PeripheralDevice>(this.userId, selector0, token)
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

meteorPublish(PubSub.peripheralDevicesAndSubDevices, async function (selector0, token) {
	const { cred, selector } = await AutoFillSelector.organizationId<PeripheralDevice>(this.userId, selector0, token)
	if (checkAccess(cred, selector)) {
		const parents = PeripheralDevices.find(selector).fetch()

		const modifier: FindOptions<PeripheralDevice> = {
			fields: {
				token: 0,
				secretSettings: 0,
			},
		}

		return PeripheralDevices.find(
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
	}
	return null
})
meteorPublish(PubSub.peripheralDeviceCommands, async function (deviceId: PeripheralDeviceId, token) {
	if (!deviceId) throw new Meteor.Error(400, 'deviceId argument missing')
	check(deviceId, String)
	if (PeripheralDeviceReadAccess.peripheralDeviceContent({ deviceId: deviceId }, { userId: this.userId, token })) {
		return PeripheralDeviceCommands.find({ deviceId: deviceId })
	}
	return null
})
meteorPublish(PubSub.mediaWorkFlows, async function (selector0, token) {
	const { cred, selector } = await AutoFillSelector.deviceId(this.userId, selector0, token)
	if (PeripheralDeviceReadAccess.peripheralDeviceContent(selector, cred)) {
		return MediaWorkFlows.find(selector)
	}
	return null
})
meteorPublish(PubSub.mediaWorkFlowSteps, async function (selector0, token) {
	const { cred, selector } = await AutoFillSelector.deviceId(this.userId, selector0, token)
	if (PeripheralDeviceReadAccess.peripheralDeviceContent(selector, cred)) {
		return MediaWorkFlowSteps.find(selector)
	}
	return null
})
