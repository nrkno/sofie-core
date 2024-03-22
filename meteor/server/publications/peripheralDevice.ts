import { Meteor } from 'meteor/meteor'
import { check, Match } from '../../lib/check'
import { meteorPublish, AutoFillSelector } from './lib'
import { MeteorPubSub } from '../../lib/api/pubsub'
import { PeripheralDeviceReadAccess } from '../security/peripheralDevice'
import { PeripheralDevice } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { OrganizationReadAccess } from '../security/organization'
import { StudioReadAccess } from '../security/studio'
import { MongoFieldSpecifierZeroes, MongoQuery } from '@sofie-automation/corelib/dist/mongo'
import { Credentials, ResolvedCredentials } from '../security/lib/credentials'
import { NoSecurityReadAccess } from '../security/noSecurity'
import { PeripheralDeviceId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { MediaWorkFlows, MediaWorkFlowSteps, PeripheralDeviceCommands, PeripheralDevices } from '../collections'
import { MediaWorkFlow } from '@sofie-automation/shared-lib/dist/core/model/MediaWorkFlows'
import { MediaWorkFlowStep } from '@sofie-automation/shared-lib/dist/core/model/MediaWorkFlowSteps'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { PeripheralDevicePubSub } from '@sofie-automation/shared-lib/dist/pubsub/peripheralDevice'
import { clone } from '@sofie-automation/corelib/dist/lib'

/*
 * This file contains publications for the peripheralDevices, such as playout-gateway, mos-gateway and package-manager
 */

async function checkAccess(cred: Credentials | ResolvedCredentials | null, selector: MongoQuery<PeripheralDevice>) {
	if (!selector) throw new Meteor.Error(400, 'selector argument missing')
	return (
		!cred ||
		NoSecurityReadAccess.any() ||
		(selector._id && (await PeripheralDeviceReadAccess.peripheralDevice(selector._id, cred))) ||
		(selector.organizationId &&
			(await OrganizationReadAccess.organizationContent(selector.organizationId, cred))) ||
		(selector.studioId && (await StudioReadAccess.studioContent(selector.studioId, cred)))
	)
}

const peripheralDeviceFields: MongoFieldSpecifierZeroes<PeripheralDevice> = {
	token: 0,
	secretSettings: 0,
}

meteorPublish(
	CorelibPubSub.peripheralDevices,
	async function (peripheralDeviceIds: PeripheralDeviceId[] | null, token: string | undefined) {
		check(peripheralDeviceIds, Match.Maybe(Array))

		// If values were provided, they must have values
		if (peripheralDeviceIds && peripheralDeviceIds.length === 0) return null

		const { cred, selector } = await AutoFillSelector.organizationId<PeripheralDevice>(this.userId, {}, token)

		// Add the requested filter
		if (peripheralDeviceIds) selector._id = { $in: peripheralDeviceIds }

		if (await checkAccess(cred, selector)) {
			const fields = clone(peripheralDeviceFields)
			if (selector._id && token) {
				// in this case, send the secretSettings:
				delete fields.secretSettings
			}
			return PeripheralDevices.findWithCursor(selector, {
				fields,
			})
		}
		return null
	}
)

meteorPublish(CorelibPubSub.peripheralDevicesAndSubDevices, async function (studioId: StudioId) {
	const { cred, selector } = await AutoFillSelector.organizationId<PeripheralDevice>(
		this.userId,
		{ studioId },
		undefined
	)
	if (await checkAccess(cred, selector)) {
		// TODO - this is not correctly reactive when changing the `studioId` property of a parent device
		const parents = (await PeripheralDevices.findFetchAsync(selector, { projection: { _id: 1 } })) as Array<
			Pick<PeripheralDevice, '_id'>
		>

		return PeripheralDevices.findWithCursor(
			{
				$or: [
					{
						parentDeviceId: { $in: parents.map((i) => i._id) },
					},
					selector,
				],
			},
			{
				fields: peripheralDeviceFields,
			}
		)
	}
	return null
})
meteorPublish(
	PeripheralDevicePubSub.peripheralDeviceCommands,
	async function (deviceId: PeripheralDeviceId, token: string | undefined) {
		if (!deviceId) throw new Meteor.Error(400, 'deviceId argument missing')
		check(deviceId, String)
		if (await PeripheralDeviceReadAccess.peripheralDeviceContent(deviceId, { userId: this.userId, token })) {
			return PeripheralDeviceCommands.findWithCursor({ deviceId: deviceId })
		}
		return null
	}
)
meteorPublish(MeteorPubSub.mediaWorkFlows, async function (token: string | undefined) {
	const { cred, selector } = await AutoFillSelector.deviceId<MediaWorkFlow>(this.userId, {}, token)
	if (!cred || (await PeripheralDeviceReadAccess.peripheralDeviceContent(selector.deviceId, cred))) {
		return MediaWorkFlows.findWithCursor(selector)
	}
	return null
})
meteorPublish(MeteorPubSub.mediaWorkFlowSteps, async function (token: string | undefined) {
	const { cred, selector } = await AutoFillSelector.deviceId<MediaWorkFlowStep>(this.userId, {}, token)
	if (!cred || (await PeripheralDeviceReadAccess.peripheralDeviceContent(selector.deviceId, cred))) {
		return MediaWorkFlowSteps.findWithCursor(selector)
	}
	return null
})
