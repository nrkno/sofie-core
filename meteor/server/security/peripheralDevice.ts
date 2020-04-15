import { Meteor } from 'meteor/meteor'
import { check } from '../../lib/check'
import { Mongo } from 'meteor/mongo'
import { PeripheralDeviceId, PeripheralDevice, PeripheralDevices } from '../../lib/collections/PeripheralDevices'
import { protectString, isProtectedString } from '../../lib/lib'
import { rejectFields, logNotAllowed } from './lib/lib'
import { PeripheralDeviceCommands, PeripheralDeviceCommand } from '../../lib/collections/PeripheralDeviceCommands'
import { MediaWorkFlowSteps, MediaWorkFlowStep } from '../../lib/collections/MediaWorkFlowSteps'
import { MediaWorkFlows, MediaWorkFlow, MediaWorkFlowId } from '../../lib/collections/MediaWorkFlows'
import { MongoQuery, UserId } from '../../lib/typings/meteor'
import { Credentials, ResolvedCredentials, resolveCredentials } from './lib/credentials'
import { allowAccessToPeripheralDevice, allowAccessToStudio, allowAccessToPeripheralDeviceContent } from './lib/security'
import { MethodContext } from '../../lib/api/methods'
import { OrganizationId } from '../../lib/collections/Organization'
import { Settings } from '../../lib/Settings'
import { triggerWriteAccess } from './lib/securityVerify'
import { noAccess } from './lib/access'

type PeripheralDeviceContent = { deviceId: PeripheralDeviceId }
export namespace PeripheralDeviceReadAccess {
	export function peripheralDevice (selector: MongoQuery<{_id: PeripheralDeviceId}>, cred: Credentials | ResolvedCredentials): boolean {
		return peripheralDeviceContent({ deviceId: selector._id }, cred)
	}
	/** Handles read access for all peripheraldevice content (commands, mediaWorkFlows, etc..) */
	export function peripheralDeviceContent (selector: MongoQuery<PeripheralDeviceContent>, cred: Credentials | ResolvedCredentials): boolean {
		check(selector, Object)
		if (!Settings.enableUserAccounts) return true
		if (!selector.deviceId) throw new Meteor.Error(400, 'selector must contain deviceId')

		const access = allowAccessToPeripheralDevice(cred, selector.deviceId)
		if (!access.read) return logNotAllowed('PeripheralDevice content', access.reason)

		return true
	}
}
export namespace PeripheralDeviceContentWriteAccess {
	// These functions throws if access is not allowed.

	export function executeFunction (cred0: Credentials, deviceId: PeripheralDeviceId) {
		return anyContent(cred0, deviceId)
	}
	export function peripheralDevice (cred0: Credentials, deviceId: PeripheralDeviceId) {
		return anyContent(cred0, deviceId)
	}
	export function mediaWorkFlow (cred0: Credentials, existingWorkFlow: MediaWorkFlow | MediaWorkFlowId) {
		triggerWriteAccess()
		if (existingWorkFlow && isProtectedString(existingWorkFlow)) {
			const workFlowId = existingWorkFlow
			const m = MediaWorkFlows.findOne(workFlowId)
			if (!m) throw new Meteor.Error(404, `MediaWorkFlow "${workFlowId}" not found!`)
			existingWorkFlow = m
		}
		return { ...anyContent(cred0, existingWorkFlow.deviceId), mediaWorkFlow: existingWorkFlow }
	}
	/** Return credentials if writing is allowed, throw otherwise */
	export function anyContent (
		cred0: Credentials | MethodContext,
		deviceId: PeripheralDeviceId
	): {
		userId: UserId | null,
		organizationId: OrganizationId | null,
		deviceId: PeripheralDeviceId,
		device: PeripheralDevice | null,
		cred: ResolvedCredentials | Credentials
	} {
		triggerWriteAccess()
		check(deviceId, String)
		if (!Settings.enableUserAccounts) {
			return {
				userId: null,
				organizationId: null,
				deviceId: deviceId,
				device: PeripheralDevices.findOne(deviceId) || null,
				cred: cred0
			}
		}
		const cred = resolveCredentials(cred0)
		if (!cred.user) throw new Meteor.Error(403, `Not logged in`)
		if (!cred.organization) throw new Meteor.Error(500, `User has no organization`)
		const access = allowAccessToPeripheralDeviceContent(
			cred,
			deviceId
		)
		if (!access.update) throw new Meteor.Error(403, `Not allowed: ${access.reason}`)
		if (!access.document) throw new Meteor.Error(500, `Internal error: access.document not set`)

		return {
			userId: cred.user._id,
			organizationId: cred.organization._id,
			deviceId: deviceId,
			device: access.document,
			cred: cred
		}
	}
}

PeripheralDevices.allow({
	insert (userId, doc: PeripheralDevice): boolean {
		return true
	},
	update (userId, doc, fields, modifier) {
		return rejectFields(doc, fields, [
			'type',
			'parentDeviceId',
			'versions',
			'expectedVersions',
			'created',
			'status',
			'lastSeen',
			'lastConnected',
			'connected',
			'connectionId',
			'token',
			// 'settings' is allowed
		])
	},

	remove (userId, doc) {
		return false
	}
})

PeripheralDeviceCommands.allow({
	insert (userId, doc: PeripheralDeviceCommand): boolean {
		return true // TODO
	},
	update (userId, doc, fields, modifier) {
		return false
	},
	remove (userId, doc) {
		return true // TODO
	}
})

// Media work flows:
MediaWorkFlowSteps.allow({
	insert (userId, doc: MediaWorkFlowStep): boolean {
		return false
	},
	update (userId, doc, fields, modifier) {
		return false
	},
	remove (userId, doc) {
		return false
	}
})
MediaWorkFlows.allow({
	insert (userId, doc: MediaWorkFlow): boolean {
		return false
	},
	update (userId, doc, fields, modifier) {
		return false
	},
	remove (userId, doc) {
		return false
	}
})
