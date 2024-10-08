import { Meteor, Subscription } from 'meteor/meteor'
import { AllPubSubCollections, AllPubSubTypes } from '../../lib/api/pubsub'
import { extractFunctionSignature } from '../lib'
import { MongoQuery } from '@sofie-automation/corelib/dist/mongo'
import { ResolvedCredentials, resolveCredentials } from '../security/lib/credentials'
import { Settings } from '../../lib/Settings'
import { PeripheralDevice } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { MongoCursor } from '../../lib/collections/lib'
import {
	OrganizationId,
	PeripheralDeviceId,
	ShowStyleBaseId,
	UserId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { protectStringObject, waitForPromise } from '../../lib/lib'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { PeripheralDevices, ShowStyleBases } from '../collections'
import { MetricsGauge } from '@sofie-automation/corelib/dist/prometheus'

export const MeteorPublicationSignatures: { [key: string]: string[] } = {}
export const MeteorPublications: { [key: string]: Function } = {}

const MeteorPublicationsGauge = new MetricsGauge({
	name: `sofie_meteor_publication_subscribers_total`,
	help: 'Number of subscribers on a Meteor publication (ignoring arguments)',
	labelNames: ['publication'],
})

export interface SubscriptionContext extends Omit<Subscription, 'userId'> {
	/**
	 * The id of the logged-in user, or `null` if no user is logged in.
	 * This is constant. However, if the logged-in user changes, the publish function
	 * is rerun with the new value, assuming it didn’t throw an error at the previous run.
	 */
	userId: UserId | null
}

/**
 * Unsafe wrapper around Meteor.publish
 * @param name
 * @param callback
 */
export function meteorPublishUnsafe(
	name: string,
	callback: (this: SubscriptionContext, ...args: any) => Promise<any>
): void {
	const signature = extractFunctionSignature(callback)
	if (signature) MeteorPublicationSignatures[name] = signature

	MeteorPublications[name] = callback

	const publicationGauge = MeteorPublicationsGauge.labels({ publication: name })

	Meteor.publish(name, function (...args: any[]): any {
		publicationGauge.inc()
		this.onStop(() => publicationGauge.dec())

		return waitForPromise(callback.apply(protectStringObject<Subscription, 'userId'>(this), args)) || []
	})
}

export type PublishDocType<K extends keyof AllPubSubTypes> = ReturnType<
	AllPubSubTypes[K]
> extends keyof AllPubSubCollections
	? AllPubSubCollections[ReturnType<AllPubSubTypes[K]>]
	: never

/**
 * Wrapper around Meteor.publish with stricter typings
 * @param name
 * @param callback
 */
export function meteorPublish<K extends keyof AllPubSubTypes>(
	name: K,
	callback: (
		this: SubscriptionContext,
		...args: Parameters<AllPubSubTypes[K]>
	) => Promise<MongoCursor<PublishDocType<K>> | null>
): void {
	meteorPublishUnsafe(name, callback)
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
