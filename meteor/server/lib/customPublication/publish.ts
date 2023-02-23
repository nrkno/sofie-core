import { UserId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Meteor, Subscription } from 'meteor/meteor'
import { CustomCollectionName, PubSubTypes } from '../../../lib/api/pubsub'
import { ProtectedString, protectString, protectStringObject, unprotectString, waitForPromise } from '../../../lib/lib'
import { SubscriptionContext } from '../../publications/lib'

export interface CustomPublishChanges<T extends { _id: ProtectedString<any> }> {
	added: Array<T>
	changed: Array<Pick<T, '_id'> & Partial<T>>
	removed: T['_id'][]
}

export class MeteorCustomPublish<DBObj extends { _id: ProtectedString<any> }> implements CustomPublish<DBObj> {
	#onStop: (() => void) | undefined
	#isReady = false

	constructor(private _meteorSubscription: Subscription, private _collectionName: CustomCollectionName) {
		this._meteorSubscription.onStop(() => {
			if (this.#onStop) this.#onStop()
		})
	}

	get isReady(): boolean {
		return this.#isReady
	}

	get userId(): UserId | null {
		return protectString(this._meteorSubscription.userId)
	}

	/**
	 * Register a function to be called when the subscriber unsubscribes
	 */
	onStop(callback: () => void) {
		this.#onStop = callback
	}

	/**
	 * Send the intial documents to the subscriber
	 */
	init(docs: DBObj[]) {
		if (this.#isReady) throw new Meteor.Error(500, 'CustomPublish has already been initialised')

		for (const doc of docs) {
			this._meteorSubscription.added(this._collectionName, unprotectString(doc._id), doc)
		}

		this._meteorSubscription.ready()
		this.#isReady = true
	}

	/**
	 * Send a batch of changes to the subscriber
	 */
	changed(changes: CustomPublishChanges<DBObj>): void {
		if (!this.#isReady) throw new Meteor.Error(500, 'CustomPublish has not been initialised')

		for (const doc of changes.added.values()) {
			this._meteorSubscription.added(this._collectionName, unprotectString(doc._id), doc)
		}

		for (const doc of changes.changed.values()) {
			this._meteorSubscription.changed(this._collectionName, unprotectString(doc._id), doc)
		}

		for (const id of changes.removed.values()) {
			this._meteorSubscription.removed(this._collectionName, unprotectString(id))
		}
	}
}

export interface CustomPublish<DBObj extends { _id: ProtectedString<any> }> {
	get isReady(): boolean

	get userId(): UserId | null

	/**
	 * Register a function to be called when the subscriber unsubscribes
	 */
	onStop(callback: () => void)

	/**
	 * Send the intial documents to the subscriber
	 */
	init(docs: DBObj[])

	/**
	 * Send a batch of changes to the subscriber
	 */
	changed(changes: CustomPublishChanges<DBObj>): void
}

function genericMeteorCustomPublish<K extends keyof PubSubTypes>(
	publicationName: K,
	customCollectionName: CustomCollectionName,
	cb: (
		this: SubscriptionContext,
		publication: CustomPublish<ReturnType<PubSubTypes[K]>>,
		...args: Parameters<PubSubTypes[K]>
	) => Promise<void>
) {
	Meteor.publish(publicationName, function (...args: any[]) {
		waitForPromise(
			cb.call(
				protectStringObject<Subscription, 'userId'>(this),
				new MeteorCustomPublish(this, customCollectionName),
				...(args as any)
			)
		)
	})
}

/** Wrapping of Meteor.publish to provide types for for custom publications */
export function meteorCustomPublish<K extends keyof PubSubTypes>(
	publicationName: K,
	customCollectionName: CustomCollectionName,
	cb: (
		this: SubscriptionContext,
		publication: CustomPublish<ReturnType<PubSubTypes[K]>>,
		...args: Parameters<PubSubTypes[K]>
	) => Promise<void>
): void {
	genericMeteorCustomPublish(publicationName, customCollectionName, async function (pub, ...args) {
		return cb.call(this, pub, ...args)
	})
}
