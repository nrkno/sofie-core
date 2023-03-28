import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { getHash } from '@sofie-automation/corelib/dist/hash'
import { MongoFieldSpecifierOnes } from '@sofie-automation/corelib/dist/mongo'
import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { Meteor } from 'meteor/meteor'
import _ from 'underscore'
import { stringifyObjects, waitForPromise } from '../../lib/lib'
import { logger } from '../logging'
import { AsyncMongoCollection, AsyncOnlyMongoCollection } from './collection'

type Timeout = number

const ObserveChangeBufferTimeout = 2000

export const Collections = new Map<CollectionName, AsyncMongoCollection<any>>()
export function registerCollection(name: CollectionName, collection: AsyncMongoCollection<any>): void {
	if (Collections.has(name)) throw new Meteor.Error(`Cannot re-register collection "${name}"`)
	Collections.set(name, collection)
}
export function getCollectionKey(collection: AsyncOnlyMongoCollection<any>): CollectionName {
	const o = Array.from(Collections.entries()).find(([_key, col]) => col === collection)
	if (!o) throw new Meteor.Error(500, `Collection "${collection.name}" not found in Collections!`)
	return o[0] // collectionName
}

export async function ObserveChangesForHash<DBInterface extends { _id: ProtectedString<any> }>(
	collection: AsyncMongoCollection<DBInterface>,
	hashName: keyof DBInterface,
	hashFields: (keyof DBInterface)[],
	skipEnsureUpdatedOnStart?: boolean
): Promise<void> {
	const doUpdate = async (obj: DBInterface): Promise<void> => {
		const newHash = getHash(stringifyObjects(_.pick(obj, ...(hashFields as string[]))))

		if (newHash !== String(obj[hashName])) {
			logger.debug(`Updating hash: ${obj._id} ${String(hashName)}:${newHash}`)
			const update: Partial<DBInterface> = {}
			update[String(hashName)] = newHash
			await collection.updateAsync(obj._id, { $set: update })
		}
	}

	await ObserveChangesHelper(collection, hashFields, doUpdate, ObserveChangeBufferTimeout, skipEnsureUpdatedOnStart)
}

export async function ObserveChangesHelper<DBInterface extends { _id: ProtectedString<any> }>(
	collection: AsyncMongoCollection<DBInterface>,
	watchFields: (keyof DBInterface)[],
	doUpdate: (doc: DBInterface) => Promise<void>,
	changeDebounce: number,
	skipEnsureUpdatedOnStart?: boolean
): Promise<void> {
	const observedChangesTimeouts = new Map<DBInterface['_id'], Timeout>()

	const projection: MongoFieldSpecifierOnes<DBInterface> = {}
	for (const field of watchFields) {
		projection[field] = 1
	}

	collection.find({}, { fields: projection }).observeChanges({
		changed: (id: DBInterface['_id'], changedFields) => {
			if (Object.keys(changedFields).length > 0) {
				const data: Timeout | undefined = observedChangesTimeouts.get(id)
				if (data !== undefined) {
					// Already queued, so do nothing
				} else {
					// Schedule update
					observedChangesTimeouts.set(
						id,
						Meteor.setTimeout(() => {
							// This looks like a race condition, but is safe as the data for the 'lost' change will still be loaded below
							observedChangesTimeouts.delete(id)

							// Perform hash update
							const obj = collection.findOne(id)
							if (obj) {
								waitForPromise(doUpdate(obj))
							}
						}, changeDebounce)
					)
				}
			}
		},
	})

	if (!skipEnsureUpdatedOnStart) {
		const existing = collection.find().fetch()
		await Promise.all(existing.map(async (doc) => doUpdate(doc)))
	}
}
