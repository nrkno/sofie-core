import { TransformedCollection } from '../typings/meteor'
import { stringifyObjects } from '../lib'
import * as _ from 'underscore'

export function ObserveChangesForHash<Ta, Tb> (collection: TransformedCollection<Ta, Tb>, hashName: string, hashFields: string[], skipEnsureUpdatedOnStart?: boolean) {
	const doUpdate = (id: string, obj: any) => {
		const newHash = getHash(stringifyObjects(_.pick(obj, ...hashFields)))
		console.log('studio:', id, hashName + ':', newHash) // TODO - properly

		if (newHash !== obj[hashName]) {
			const update = {}
			update[hashName] = newHash
			collection.update(id, { $set: update })
		}
	}

	const { getHash } = require('../../server/lib') // TODO - nicer
	collection.find().observeChanges({
		changed: (id, changedFields) => {
			// Ignore the hash field, to stop an infinite loop
			delete changedFields[hashName]

			if (_.keys(changedFields).length > 0) {
				// TODO - buffer for 2 seconds
				const obj = collection.findOne(id)
				if (obj) {
					doUpdate(id, obj)
				}

			}
		}
	})

	if (!skipEnsureUpdatedOnStart) {
		const existing = collection.find().fetch()
		_.each(existing, entry => doUpdate(entry['_id'], entry))
	}
}
