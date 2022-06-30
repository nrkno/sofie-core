import { Meteor } from 'meteor/meteor'
import { PubSubTypes } from '../../lib/api/pubsub'
import { extractFunctionSignature } from '../lib'
import { MongoQuery, UserId } from '../../lib/typings/meteor'
import { Credentials, ResolvedCredentials, resolveCredentials } from '../security/lib/credentials'
import { Settings } from '../../lib/Settings'
import { PeripheralDevices } from '../../lib/collections/PeripheralDevices'
import { fetchShowStyleBasesLight } from '../../lib/collections/optimizations'
import { MongoCursor } from '../../lib/collections/lib'
import { OrganizationId, PeripheralDeviceId, ShowStyleBaseId } from '@sofie-automation/corelib/dist/dataModel/Ids'

export const MeteorPublicationSignatures: { [key: string]: string[] } = {}
export const MeteorPublications: { [key: string]: Function } = {}

/**
 * Wrapper around Meteor.publish with stricter typings
 * @param name
 * @param callback
 */
export function meteorPublish<K extends keyof PubSubTypes>(
	name: K,
	callback: (
		...args: Parameters<PubSubTypes[K]>
	) => MongoCursor<ReturnType<PubSubTypes[K]>> | MongoCursor<ReturnType<PubSubTypes[K]>>[] | null
) {
	const signature = extractFunctionSignature(callback)
	if (signature) MeteorPublicationSignatures[name] = signature

	MeteorPublications[name] = callback

	Meteor.publish(name, function (...args: any[]) {
		return callback.apply(this, args as any) || []
	})
}

export namespace AutoFillSelector {
	/** Autofill an empty selector {} with organizationId of the current user */
	export function organizationId<T extends { organizationId?: OrganizationId | null | undefined }>(
		userId: UserId,
		selector: MongoQuery<T>,
		token: string | undefined
	) {
		if (!selector) throw new Meteor.Error(400, 'selector argument missing')
		let cred: Credentials | ResolvedCredentials = { userId: userId, token }
		if (Settings.enableUserAccounts) {
			if (!selector.organizationId) {
				cred = resolveCredentials(cred)
				if (cred.organization) selector = { organizationId: cred.organization._id } as any
			}
		}
		return { cred, selector }
	}
	/** Autofill an empty selector {} with deviceId of the current user's peripheralDevices */
	export function deviceId<T extends { deviceId: PeripheralDeviceId }>(
		userId: UserId,
		selector: MongoQuery<T>,
		token: string | undefined
	) {
		if (!selector) throw new Meteor.Error(400, 'selector argument missing')

		let cred: Credentials | ResolvedCredentials = { userId: userId, token }
		if (Settings.enableUserAccounts) {
			if (!selector.deviceId) {
				cred = resolveCredentials(cred)
				if (cred.organization) {
					const devices = PeripheralDevices.find({
						organizationId: cred.organization._id,
					}).fetch()

					selector = {
						deviceId: { $in: devices.map((d) => d._id) },
					} as any
				}
			}
		}
		return { cred, selector }
	}
	/** Autofill an empty selector {} with showStyleBaseId of the current user's showStyleBases */
	export function showStyleBaseId<T extends { showStyleBaseId?: ShowStyleBaseId | null }>(
		userId: UserId,
		selector: MongoQuery<T>,
		token: string | undefined
	) {
		if (!selector) throw new Meteor.Error(400, 'selector argument missing')

		let cred: Credentials | ResolvedCredentials = { userId: userId, token }
		if (Settings.enableUserAccounts) {
			if (!selector.showStyleBaseId) {
				cred = resolveCredentials(cred)
				if (cred.organization) {
					const showStyleBases = fetchShowStyleBasesLight({
						organizationId: cred.organization._id,
					})

					selector = {
						showStyleBaseId: { $in: showStyleBases.map((d) => d._id) },
					} as any
				}
			}
		}
		return { cred, selector }
	}
}
