import { Meteor, Subscription } from 'meteor/meteor'
import { CustomCollectionName, PubSubTypes } from '../../lib/api/pubsub'
import { ProtectedString, protectStringObject, unprotectString, waitForPromise } from '../../lib/lib'
import { SubscriptionContext } from '../publications/lib'

export interface CustomPublishChanges<T extends { _id: ProtectedString<any> }> {
	added: T[]
	changed: T[]
	removed: T['_id'][]
}

export class CustomPublish<DBObj extends { _id: ProtectedString<any> }> {
	#onStop: (() => void) | undefined
	#isReady = false

	constructor(private _meteorPublication: Subscription, private _collectionName: CustomCollectionName) {
		this._meteorPublication.onStop(() => {
			if (this.#onStop) this.#onStop()
		})
	}

	get isReady(): boolean {
		return this.#isReady
	}

	onStop(callback: () => void) {
		this.#onStop = callback
	}
	/** Indicate to the client that the initial document(s) have been sent */
	init(docs: DBObj[]) {
		if (!this.#isReady) throw new Meteor.Error(500, 'CustomPublish has already been initialised')

		for (const doc of docs) {
			this._meteorPublication.added(this._collectionName, unprotectString(doc._id), doc)
		}

		this._meteorPublication.ready()
		this.#isReady = true
	}
	changed(changes: CustomPublishChanges<DBObj>): void {
		if (this.#isReady) throw new Meteor.Error(500, 'CustomPublish has not been initialised')

		for (const doc of changes.added) {
			this._meteorPublication.added(this._collectionName, unprotectString(doc._id), doc)
		}

		for (const doc of changes.changed) {
			this._meteorPublication.changed(this._collectionName, unprotectString(doc._id), doc)
		}

		for (const id of changes.removed) {
			this._meteorPublication.removed(this._collectionName, unprotectString(id))
		}
	}
}

function genericMeteorCustomPublish<K extends keyof PubSubTypes>(
	publicationName: K,
	customCollectionName: CustomCollectionName,
	cb: (
		this: SubscriptionContext,
		publication: CustomPublish<ReturnType<PubSubTypes[K]>>,
		...args: Parameters<PubSubTypes[K]>
	) => void
) {
	Meteor.publish(publicationName, function (...args: any[]) {
		cb.call(
			protectStringObject<Subscription, 'userId'>(this),
			new CustomPublish(this, customCollectionName),
			...(args as any)
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
	genericMeteorCustomPublish(publicationName, customCollectionName, function (pub, ...args) {
		waitForPromise(cb.call(this, pub, ...args))
	})
}
