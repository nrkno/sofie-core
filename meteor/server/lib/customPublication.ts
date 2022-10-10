import { Meteor, Subscription } from 'meteor/meteor'
import { CustomCollectionName, PubSubTypes } from '../../lib/api/pubsub'
import { clone, ProtectedString, protectStringObject, unprotectString, waitForPromise } from '../../lib/lib'
import _ from 'underscore'
import { SubscriptionContext } from '../publications/lib'

export class CustomPublish<DBObj extends { _id: ProtectedString<any> }> {
	private _onStop: () => void
	constructor(private _meteorPublication: Subscription, private _collectionName: CustomCollectionName) {
		this._meteorPublication.onStop(() => {
			if (this._onStop) this._onStop()
		})
	}
	onStop(callback: () => void) {
		this._onStop = callback
	}
	/** Indicate to the client that the initial document(s) have been sent */
	ready() {
		this._meteorPublication.ready()
	}
	/** Added document */
	added(id: DBObj['_id'], doc: DBObj) {
		this._meteorPublication.added(this._collectionName, unprotectString(id), doc)
	}
	/** Changed document */
	changed(id: DBObj['_id'], doc: DBObj) {
		this._meteorPublication.changed(this._collectionName, unprotectString(id), doc)
	}
	/** Removed document */
	removed(id: DBObj['_id']) {
		this._meteorPublication.removed(this._collectionName, unprotectString(id))
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

export class CustomPublishArray<DBObj extends { _id: ProtectedString<any> }> {
	private _docs = new Map<DBObj['_id'], DBObj>()
	private _firstRun: boolean = true
	constructor(private _publication: CustomPublish<DBObj>) {}
	onStop(callback: () => void): void {
		this._publication.onStop(callback)
	}

	public get isFirstRun(): boolean {
		return this._firstRun
	}

	updatedDocs(newDocs: DBObj[]): void {
		const newIds = new Set<DBObj['_id']>()
		// figure out which documents have changed

		const oldIds = Array.from(this._docs.keys())

		for (const newDoc of newDocs) {
			const id = newDoc._id
			if (newIds.has(id)) {
				throw new Meteor.Error(`Error in custom publication: _id "${id}" is not unique!`)
			}
			newIds.add(id)

			const oldDoc = this._docs.get(id)
			if (!oldDoc) {
				// added
				this._docs.set(id, clone(newDoc))

				this._publication.added(id, newDoc)
			} else if (
				oldDoc['mappingsHash'] !== newDoc['mappingsHash'] || // Fast-track for the timeline publications
				oldDoc['timelineHash'] !== newDoc['timelineHash'] ||
				!_.isEqual(oldDoc, newDoc)
			) {
				// changed

				this._publication.changed(id, newDoc)
				this._docs.set(id, clone(newDoc))
			}
		}

		for (const id of oldIds) {
			if (!newIds.has(id)) {
				// Removed
				this._docs.delete(id)
				this._publication.removed(id)
			}
		}

		if (this._firstRun) {
			this._publication.ready()
			this._firstRun = false
		}
	}
}

/** Convenience function for making custom publications of array-data */
export function meteorCustomPublishArray<K extends keyof PubSubTypes>(
	publicationName: K,
	customCollectionName: CustomCollectionName,
	cb: (
		this: SubscriptionContext,
		publication: CustomPublishArray<ReturnType<PubSubTypes[K]>>,
		...args: Parameters<PubSubTypes[K]>
	) => Promise<void>
): void {
	genericMeteorCustomPublish(publicationName, customCollectionName, function (pub, ...args) {
		waitForPromise(cb.call(this, new CustomPublishArray(pub), ...args))
	})
}
