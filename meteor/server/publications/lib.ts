import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { PubSub } from '../../lib/api/pubsub'
import { extractFunctionSignature } from '../lib'
import { Mongocursor, UserId } from '../../lib/typings/meteor'
import { ProtectedString } from '../../lib/lib'
import { Credentials, ResolvedCredentials, resolveCredentials } from '../security/lib/credentials'
import { Settings } from '../../lib/Settings'
import { PeripheralDevices } from '../../lib/collections/PeripheralDevices'
import { fetchShowStyleBasesLight } from '../../lib/collections/optimizations'

export const MeteorPublicationSignatures: { [key: string]: string[] } = {}
export const MeteorPublications: { [key: string]: Function } = {}

/**
 * Wrapper around Meteor.publish with stricter typings
 * @param name
 * @param callback
 */
export function meteorPublish<T extends { _id: ProtectedString<any> }>(
	name: PubSub,
	callback: (...args: any[]) => Mongocursor<T> | Mongocursor<T>[] | null
) {
	const signature = extractFunctionSignature(callback)
	if (signature) MeteorPublicationSignatures[name] = signature

	MeteorPublications[name] = callback

	Meteor.publish(name, function (...args: any[]) {
		return callback.apply(this, args) || []
	})
}

export namespace AutoFillSelector {
	/** Autofill an empty selector {} with organizationId of the current user */
	export function organizationId(userId: UserId, selector, token: string) {
		if (!selector) throw new Meteor.Error(400, 'selector argument missing')
		let cred: Credentials | ResolvedCredentials = { userId: userId, token }
		if (Settings.enableUserAccounts) {
			if (!selector.organizationId) {
				cred = resolveCredentials(cred)
				if (cred.organization) selector = { organizationId: cred.organization._id }
			}
		}
		return { cred, selector }
	}
	/** Autofill an empty selector {} with deviceId of the current user's peripheralDevices */
	export function deviceId(userId: UserId, selector, token: string) {
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
						deviceId: { $in: _.map(devices, (d) => d._id) },
					}
				}
			}
		}
		return { cred, selector }
	}
	/** Autofill an empty selector {} with showStyleBaseId of the current user's showStyleBases */
	export function showStyleBaseId(userId: UserId, selector, token: string) {
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
						showStyleBaseId: { $in: _.map(showStyleBases, (d) => d._id) },
					}
				}
			}
		}
		return { cred, selector }
	}
}
