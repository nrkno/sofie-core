import { Meteor } from 'meteor/meteor'
import { check } from '../../lib/check'
import { PeripheralDeviceId, PeripheralDevice, PeripheralDevices } from '../../lib/collections/PeripheralDevices'
import { isProtectedString } from '../../lib/lib'
import { logNotAllowed } from './lib/lib'
import { MediaWorkFlows, MediaWorkFlow, MediaWorkFlowId } from '../../lib/collections/MediaWorkFlows'
import { MongoQuery, UserId } from '../../lib/typings/meteor'
import { Credentials, ResolvedCredentials, resolveCredentials } from './lib/credentials'
import { allowAccessToPeripheralDevice, allowAccessToPeripheralDeviceContent } from './lib/security'
import { OrganizationId } from '../../lib/collections/Organization'
import { Settings } from '../../lib/Settings'
import { triggerWriteAccess } from './lib/securityVerify'
import { profiler } from '../api/profiler'

type PeripheralDeviceContent = { deviceId: PeripheralDeviceId }
export namespace PeripheralDeviceReadAccess {
	export function peripheralDevice(
		selector: MongoQuery<{ _id: PeripheralDeviceId }>,
		cred: Credentials | ResolvedCredentials
	): boolean {
		return peripheralDeviceContent({ deviceId: selector._id }, cred)
	}
	/** Handles read access for all peripheraldevice content (commands, mediaWorkFlows, etc..) */
	export function peripheralDeviceContent(
		selector: MongoQuery<PeripheralDeviceContent>,
		cred: Credentials | ResolvedCredentials
	): boolean {
		check(selector, Object)
		if (!Settings.enableUserAccounts) return true
		if (!selector.deviceId) throw new Meteor.Error(400, 'selector must contain deviceId')

		const access = allowAccessToPeripheralDevice(cred, selector.deviceId)
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

	export function executeFunction(cred0: Credentials, deviceId: PeripheralDeviceId) {
		backwardsCompatibilityfix(cred0, deviceId)
		return anyContent(cred0, deviceId)
	}
	export function peripheralDevice(cred0: Credentials, deviceId: PeripheralDeviceId) {
		backwardsCompatibilityfix(cred0, deviceId)
		return anyContent(cred0, deviceId)
	}
	export function mediaWorkFlow(
		cred0: Credentials,
		existingWorkFlow: MediaWorkFlow | MediaWorkFlowId
	): MediaWorkFlowContentAccess {
		triggerWriteAccess()
		if (existingWorkFlow && isProtectedString(existingWorkFlow)) {
			const workFlowId = existingWorkFlow
			const m = MediaWorkFlows.findOne(workFlowId)
			if (!m) throw new Meteor.Error(404, `MediaWorkFlow "${workFlowId}" not found!`)
			existingWorkFlow = m
		}
		backwardsCompatibilityfix(cred0, existingWorkFlow.deviceId)
		return { ...anyContent(cred0, existingWorkFlow.deviceId), mediaWorkFlow: existingWorkFlow }
	}
	/** Return credentials if writing is allowed, throw otherwise */
	export function anyContent(cred0: Credentials, deviceId: PeripheralDeviceId): ContentAccess {
		const span = profiler.startSpan('PeripheralDeviceContentWriteAccess.anyContent')
		triggerWriteAccess()
		check(deviceId, String)
		const device = PeripheralDevices.findOne(deviceId)
		if (!device) throw new Meteor.Error(404, `PeripheralDevice "${deviceId}" not found`)

		// If the device has a parent, use that for access control:
		const parentDevice = device.parentDeviceId ? PeripheralDevices.findOne(device.parentDeviceId) : device
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
			const cred = resolveCredentials(cred0)
			const access = allowAccessToPeripheralDeviceContent(cred, parentDevice._id)
			if (!access.update) throw new Meteor.Error(403, `Not allowed: ${access.reason}`)
			if (!access.document) throw new Meteor.Error(500, `Internal error: access.document not set`)

			span?.end()
			return {
				userId: cred.user ? cred.user._id : null,
				organizationId: cred.organization ? cred.organization._id : null,
				deviceId: deviceId,
				device: device,
				cred: cred,
			}
		}
	}
}
function backwardsCompatibilityfix(cred0, deviceId) {
	if (!Settings.enableUserAccounts) {
		// Note: This is a temporary hack to keep backwards compatibility:
		const device = PeripheralDevices.findOne(deviceId)
		if (device) cred0.token = device.token
	}
}
