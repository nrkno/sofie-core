import { Meteor } from 'meteor/meteor'
import { check } from '../../lib/check'
import { PeripheralDevice, PeripheralDevices } from '../../lib/collections/PeripheralDevices'
import { isProtectedString } from '../../lib/lib'
import { logNotAllowed } from './lib/lib'
import { MediaWorkFlows, MediaWorkFlow } from '../../lib/collections/MediaWorkFlows'
import { MongoQueryKey } from '../../lib/typings/meteor'
import { Credentials, ResolvedCredentials, resolveCredentials } from './lib/credentials'
import { allowAccessToPeripheralDevice, allowAccessToPeripheralDeviceContent } from './lib/security'
import { Settings } from '../../lib/Settings'
import { triggerWriteAccess } from './lib/securityVerify'
import { profiler } from '../api/profiler'
import { StudioContentWriteAccess } from './studio'
import {
	MediaWorkFlowId,
	OrganizationId,
	PeripheralDeviceId,
	UserId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'

export namespace PeripheralDeviceReadAccess {
	/** Check for read access for a peripheral device */
	export async function peripheralDevice(
		deviceId: MongoQueryKey<PeripheralDeviceId>,
		cred: Credentials | ResolvedCredentials
	): Promise<boolean> {
		return peripheralDeviceContent(deviceId, cred)
	}
	/** Check for read access for all peripheraldevice content (commands, mediaWorkFlows, etc..) */
	export async function peripheralDeviceContent(
		deviceId: MongoQueryKey<PeripheralDeviceId> | undefined,
		cred: Credentials | ResolvedCredentials
	): Promise<boolean> {
		if (!Settings.enableUserAccounts) return true
		if (!deviceId || !isProtectedString(deviceId)) throw new Meteor.Error(400, 'selector must contain deviceId')

		const access = await allowAccessToPeripheralDevice(cred, deviceId)
		if (!access.read) return logNotAllowed('PeripheralDevice content', access.reason)

		return true
	}
}
export interface MediaWorkFlowContentAccess extends PeripheralDeviceContentWriteAccess.ContentAccess {
	mediaWorkFlow: MediaWorkFlow
}

export namespace PeripheralDeviceContentWriteAccess {
	export interface ContentAccess {
		userId: UserId | null
		organizationId: OrganizationId | null
		deviceId: PeripheralDeviceId
		device: PeripheralDevice
		cred: ResolvedCredentials | Credentials
	}

	// These functions throws if access is not allowed.

	/**
	 * Check if a user is allowed to execute a PeripheralDevice function in a Studio
	 */
	export async function executeFunction(cred0: Credentials, deviceId: PeripheralDeviceId): Promise<ContentAccess> {
		const device = await PeripheralDevices.findOneAsync(deviceId)
		if (!device) throw new Meteor.Error(404, `PeripheralDevice "${deviceId}" not found`)

		let studioId: StudioId
		if (device.studioId) {
			studioId = device.studioId
		} else if (device.parentDeviceId) {
			// Child devices aren't assigned to the studio themselves, instead look up the parent device and use it's studioId:
			const parentDevice = await PeripheralDevices.findOneAsync(device.parentDeviceId)
			if (!parentDevice)
				throw new Meteor.Error(
					404,
					`Parent PeripheralDevice "${device.parentDeviceId}" of "${deviceId}" not found!`
				)
			if (!parentDevice.studioId)
				throw new Meteor.Error(
					404,
					`Parent PeripheralDevice "${device.parentDeviceId}" of "${deviceId}" doesn't have any studioId set`
				)
			studioId = parentDevice.studioId
		} else {
			throw new Meteor.Error(404, `PeripheralDevice "${deviceId}" doesn't have any studioId set`)
		}

		const access = await StudioContentWriteAccess.executeFunction(cred0, studioId)

		const access2 = await allowAccessToPeripheralDeviceContent(access.cred, device)
		if (!access2.playout) throw new Meteor.Error(403, `Not allowed: ${access2.reason}`)

		return {
			...access,
			deviceId: device._id,
			device,
		}
	}

	/** Check for permission to modify a peripheralDevice */
	export async function peripheralDevice(cred0: Credentials, deviceId: PeripheralDeviceId): Promise<ContentAccess> {
		await backwardsCompatibilityfix(cred0, deviceId)
		return anyContent(cred0, deviceId)
	}

	/** Check for permission to modify a mediaWorkFlow */
	export async function mediaWorkFlow(
		cred0: Credentials,
		existingWorkFlow: MediaWorkFlow | MediaWorkFlowId
	): Promise<MediaWorkFlowContentAccess> {
		triggerWriteAccess()
		if (existingWorkFlow && isProtectedString(existingWorkFlow)) {
			const workFlowId = existingWorkFlow
			const m = await MediaWorkFlows.findOneAsync(workFlowId)
			if (!m) throw new Meteor.Error(404, `MediaWorkFlow "${workFlowId}" not found!`)
			existingWorkFlow = m
		}
		await backwardsCompatibilityfix(cred0, existingWorkFlow.deviceId)
		return { ...(await anyContent(cred0, existingWorkFlow.deviceId)), mediaWorkFlow: existingWorkFlow }
	}

	/** Return credentials if writing is allowed, throw otherwise */
	async function anyContent(cred0: Credentials, deviceId: PeripheralDeviceId): Promise<ContentAccess> {
		const span = profiler.startSpan('PeripheralDeviceContentWriteAccess.anyContent')
		triggerWriteAccess()
		check(deviceId, String)
		const device = await PeripheralDevices.findOneAsync(deviceId)
		if (!device) throw new Meteor.Error(404, `PeripheralDevice "${deviceId}" not found`)

		// If the device has a parent, use that for access control:
		const parentDevice = device.parentDeviceId
			? await PeripheralDevices.findOneAsync(device.parentDeviceId)
			: device
		if (!parentDevice)
			throw new Meteor.Error(404, `PeripheralDevice parentDevice "${device.parentDeviceId}" not found`)

		if (!Settings.enableUserAccounts) {
			// Note: this is kind of a hack to keep backwards compatibility..
			if (!device.parentDeviceId && parentDevice.token !== cred0.token) {
				throw new Meteor.Error(401, `Not allowed access to peripheralDevice`)
			}

			span?.end()
			return {
				userId: null,
				organizationId: null,
				deviceId: deviceId,
				device: device,
				cred: cred0,
			}
		} else {
			if (!cred0.userId && parentDevice.token !== cred0.token) {
				throw new Meteor.Error(401, `Not allowed access to peripheralDevice`)
			}
			const cred = await resolveCredentials(cred0)
			const access = await allowAccessToPeripheralDeviceContent(cred, parentDevice)
			if (!access.update) throw new Meteor.Error(403, `Not allowed: ${access.reason}`)
			if (!access.document) throw new Meteor.Error(500, `Internal error: access.document not set`)

			span?.end()
			return {
				userId: cred.user ? cred.user._id : null,
				organizationId: cred.organizationId,
				deviceId: deviceId,
				device: device,
				cred: cred,
			}
		}
	}
}
async function backwardsCompatibilityfix(cred0: Credentials, deviceId: PeripheralDeviceId) {
	if (!Settings.enableUserAccounts) {
		// Note: This is a temporary hack to keep backwards compatibility:
		const device = (await PeripheralDevices.findOneAsync(deviceId, { fields: { token: 1 } })) as
			| Pick<PeripheralDevice, '_id' | 'token'>
			| undefined
		if (device) cred0.token = device.token
	}
}
