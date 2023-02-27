import { Meteor, Subscription } from 'meteor/meteor'
import { PubSubTypes } from '../../lib/api/pubsub'
import { extractFunctionSignature } from '../lib'
import { MongoQuery } from '../../lib/typings/meteor'
import { ResolvedCredentials, resolveCredentials } from '../security/lib/credentials'
import { Settings } from '../../lib/Settings'
import { PeripheralDevice, PeripheralDevices } from '../../lib/collections/PeripheralDevices'
import { MongoCursor } from '../../lib/collections/lib'
import {
	OrganizationId,
	PeripheralDeviceId,
	ShowStyleBaseId,
	UserId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { protectStringObject, waitForPromise } from '../../lib/lib'
import { DBShowStyleBase, ShowStyleBases } from '../../lib/collections/ShowStyleBases'

export const MeteorPublicationSignatures: { [key: string]: string[] } = {}
export const MeteorPublications: { [key: string]: Function } = {}

export interface SubscriptionContext extends Omit<Subscription, 'userId'> {
	/**
	 * The id of the logged-in user, or `null` if no user is logged in.
	 * This is constant. However, if the logged-in user changes, the publish function
	 * is rerun with the new value, assuming it didn’t throw an error at the previous run.
	 */
	userId: UserId | null
}

/**
 * Wrapper around Meteor.publish with stricter typings
 * @param name
 * @param callback
 */
export function meteorPublish<K extends keyof PubSubTypes>(
	name: K,
	callback: (
		this: SubscriptionContext,
		...args: Parameters<PubSubTypes[K]>
	) => Promise<MongoCursor<ReturnType<PubSubTypes[K]>> | null>
): void {
	const signature = extractFunctionSignature(callback)
	if (signature) MeteorPublicationSignatures[name] = signature

	MeteorPublications[name] = callback

	Meteor.publish(name, function (...args: any[]) {
		return waitForPromise(callback.apply(protectStringObject<Subscription, 'userId'>(this), args as any)) || []
	})
}

export namespace AutoFillSelector {
	/** Autofill an empty selector {} with organizationId of the current user */
	export async function organizationId<T extends { organizationId?: OrganizationId | null | undefined }>(
		userId: UserId | null,
		selector: MongoQuery<T>,
		token: string | undefined
	): Promise<{
		cred: ResolvedCredentials | null
		selector: MongoQuery<T>
	}> {
		if (!selector) throw new Meteor.Error(400, 'selector argument missing')

		let cred: ResolvedCredentials | null = null
		if (Settings.enableUserAccounts) {
			if (!selector.organizationId) {
				cred = await resolveCredentials({ userId: userId, token })
				if (cred.organizationId) selector.organizationId = cred.organizationId as any
				// TODO - should this block all access if cred.organizationId is not set
			}
		}
		return { cred, selector }
	}
	/** Autofill an empty selector {} with deviceId of the current user's peripheralDevices */
	export async function deviceId<T extends { deviceId: PeripheralDeviceId }>(
		userId: UserId | null,
		selector: MongoQuery<T>,
		token: string | undefined
	): Promise<{
		cred: ResolvedCredentials | null
		selector: MongoQuery<T>
	}> {
		if (!selector) throw new Meteor.Error(400, 'selector argument missing')

		let cred: ResolvedCredentials | null = null
		if (Settings.enableUserAccounts) {
			if (!selector.deviceId) {
				cred = await resolveCredentials({ userId: userId, token })
				if (cred.organizationId) {
					const devices = (await PeripheralDevices.findFetchAsync(
						{
							organizationId: cred.organizationId,
						},
						{ projection: { _id: 1 } }
					)) as Array<Pick<PeripheralDevice, '_id'>>

					selector.deviceId = { $in: devices.map((d) => d._id) } as any
				}
				// TODO - should this block all access if cred.organizationId is not set
			}
		}
		return { cred, selector }
	}
	/** Autofill an empty selector {} with showStyleBaseId of the current user's showStyleBases */
	export async function showStyleBaseId<T extends { showStyleBaseId?: ShowStyleBaseId | null }>(
		userId: UserId | null,
		selector: MongoQuery<T>,
		token: string | undefined
	): Promise<{
		cred: ResolvedCredentials | null
		selector: MongoQuery<T>
	}> {
		if (!selector) throw new Meteor.Error(400, 'selector argument missing')

		let cred: ResolvedCredentials | null = null
		if (Settings.enableUserAccounts) {
			if (!selector.showStyleBaseId) {
				cred = await resolveCredentials({ userId: userId, token })
				if (cred.organizationId) {
					const showStyleBases = (await ShowStyleBases.findFetchAsync(
						{
							organizationId: cred.organizationId,
						},
						{ projection: { _id: 1 } }
					)) as Array<Pick<DBShowStyleBase, '_id'>>

					selector.showStyleBaseId = { $in: showStyleBases.map((d) => d._id) } as any
				}
				// TODO - should this block all access if cred.organizationId is not set
			}
		}
		return { cred, selector }
	}
}
