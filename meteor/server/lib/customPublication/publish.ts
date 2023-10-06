import { UserId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Meteor } from 'meteor/meteor'
import { CustomCollectionName, PubSubTypes } from '../../../lib/api/pubsub'
import { ProtectedString, unprotectString } from '../../../lib/lib'
import { SubscriptionContext, meteorPublishUnsafe } from '../../publications/lib'

export interface CustomPublishChanges<T extends { _id: ProtectedString<any> }> {
	added: Array<T>
	changed: Array<Pick<T, '_id'> & Partial<T>>
	removed: T['_id'][]
}

export class CustomPublish<DBObj extends { _id: ProtectedString<any> }> {
	#onStop: (() => void) | undefined
	#isReady = false

	constructor(private _meteorSubscription: SubscriptionContext, private _collectionName: CustomCollectionName) {
		this._meteorSubscription.onStop(() => {
			if (this.#onStop) this.#onStop()
		})
	}

	get isReady(): boolean {
		return this.#isReady
	}

	get userId(): UserId | null {
		return this._meteorSubscription.userId
	}

	/**
	 * Register a function to be called when the subscriber unsubscribes
	 */
	onStop(callback: () => void): void {
		this.#onStop = callback
	}

	/**
	 * Send the intial documents to the subscriber
	 */
	init(docs: DBObj[]): void {
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
	meteorPublishUnsafe(publicationName, async function (this: SubscriptionContext, ...args: any[]) {
		return cb.call(this, new CustomPublish(this, customCollectionName), ...(args as any))
	})
}
