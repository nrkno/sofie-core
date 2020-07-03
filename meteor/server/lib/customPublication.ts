import { Meteor } from 'meteor/meteor'
import { reject } from 'underscore'
import { PubSub } from '../../lib/api/pubsub'
import { Studios, StudioId } from '../../lib/collections/Studios'
import { DBObj, unprotectString, protectString } from '../../lib/lib'
import _ from 'underscore'

class CustomPublish {
	private _onStop: () => void
	constructor(private _meteorPublication: any, private _collectionName: string) {
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
	added(_id: string, document: any) {
		this._meteorPublication.added(this._collectionName, _id, document)
	}
	/** Changed document */
	changed(_id: string, document: any) {
		this._meteorPublication.changed(this._collectionName, _id, document)
	}
	/** Removed document */
	removed(_id: string) {
		this._meteorPublication.added(this._collectionName, _id)
	}
}

function genericMeteorCustomPublish(
	publicationName: string,
	customCollectionName: string,
	cb: (publication: CustomPublish, ...args: any[]) => void
) {
	Meteor.publish(publicationName, function(...args: any[]) {
		cb(new CustomPublish(this, customCollectionName), ...args)
	})
}

/** Wrapping of Meteor.publish to provide types for for custom publications */
export function meteorCustomPublish(
	publicationName: PubSub,
	customCollectionName: string,
	cb: (publication: CustomPublish, ...args: any[]) => void
): void {
	genericMeteorCustomPublish(publicationName, customCollectionName, cb)
}

class CustomPublishArray {
	private _docs: { [id: string]: DBObj } = {}
	private _firstRun: boolean = true
	constructor(private _publication: CustomPublish) {}
	onStop(callback: () => void) {
		this._publication.onStop(callback)
	}
	updatedDocs(docs: DBObj[]) {
		const newIds: { [id: string]: true } = {}
		// figure out which documents have changed

		for (const doc of docs) {
			const id = unprotectString(doc._id)
			newIds[id] = true
			if (!this._docs[id]) {
				// added
				this._docs[id] = _.clone(doc)

				this._publication.added(id, doc)
			} else if (!_.isEqual(this._docs[id], doc)) {
				// changed
				this._docs[id] = _.clone(doc)

				this._publication.changed(id, doc)
			}
		}

		for (const id of Object.keys(this._docs)) {
			if (!newIds[id]) {
				// Removed
				delete this._docs[id]
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
export function meteorCustomPublishArray(
	publicationName: PubSub,
	customCollectionName: string,
	cb: (publication: CustomPublishArray, ...args: any[]) => void
): void {
	genericMeteorCustomPublish(publicationName, customCollectionName, (pub, ...args) => {
		cb(new CustomPublishArray(pub), ...args)
	})
}
