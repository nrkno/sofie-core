import { Meteor } from 'meteor/meteor'
import { TransformedCollection } from '../typings/meteor'
import { stringifyObjects, getHash } from '../lib'
import * as _ from 'underscore'
import { logger } from '../logging'

const ObserveChangeBufferTimeout = 2000

type Timeout = number

export function ObserveChangesForHash<Ta, Tb> (collection: TransformedCollection<Ta, Tb>, hashName: string, hashFields: string[], skipEnsureUpdatedOnStart?: boolean) {
	const doUpdate = (id: string, obj: any) => {
		const newHash = getHash(stringifyObjects(_.pick(obj, ...hashFields)))

		if (newHash !== obj[hashName]) {
			logger.debug('Updating hash:', id, hashName + ':', newHash)
			const update = {}
			update[hashName] = newHash
			collection.update(id, { $set: update })
		}
	}

	let observedChangesTimeouts: {
		[id: string]: Timeout
	} = {}

	collection.find().observeChanges({
		changed: (id, changedFields) => {
			// Ignore the hash field, to stop an infinite loop
			delete changedFields[hashName]

			if (_.keys(changedFields).length > 0) {
				let data: Timeout | undefined = observedChangesTimeouts[id]
				if (data !== undefined) {
					// Already queued, so do nothing
				} else {
					// Schedule update
					observedChangesTimeouts[id] = Meteor.setTimeout(() => {
						// This looks like a race condition, but is safe as the data for the 'lost' change will still be loaded below
						delete observedChangesTimeouts[id]

						// Perform hash update
						const obj = collection.findOne(id)
						if (obj) {
							doUpdate(id, obj)
						}
					}, ObserveChangeBufferTimeout)
				}
			}
		}
	})

	if (!skipEnsureUpdatedOnStart) {
		const existing = collection.find().fetch()
		_.each(existing, entry => doUpdate(entry['_id'], entry))
	}
}
