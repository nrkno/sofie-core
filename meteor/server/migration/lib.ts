import { Mongo } from 'meteor/mongo'
import * as _ from 'underscore'
import { MigrationStepCore } from '@sofie-automation/blueprints-integration'
import { objectPathGet, ProtectedString } from '../../lib/lib'
import { Meteor } from 'meteor/meteor'
import { logger } from '../logging'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { AsyncOnlyMongoCollection } from '../collections/collection'
import { Collections } from '../collections/lib'

/**
 * Returns a migration step that ensures the provided property is set in the collection
 */
export function ensureCollectionProperty<T = any>(
	collectionName: CollectionName,
	selector: Mongo.Selector<T>,
	property: string,
	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	defaultValue: any,
	dependOnResultFrom?: string
): Omit<MigrationStepCore, 'version'> {
	const collection = Collections.get(collectionName)
	if (!collection) throw new Meteor.Error(404, `Collection ${collectionName} not found`)

	return {
		id: `${collectionName}.${property}`,
		canBeRunAutomatically: true,
		validate: async () => {
			const objects = await collection.findFetchAsync(selector)

			for (const obj of objects) {
				const objValue = objectPathGet(obj, property)
				if (!objValue && objValue !== defaultValue) {
					return `${property} is missing on ${obj._id}`
				}
			}

			return false
		},
		migrate: async () => {
			const objects = await collection.findFetchAsync(selector)
			for (const obj of objects) {
				if (obj && objectPathGet(obj, property) !== defaultValue) {
					const m = {}
					m[property] = defaultValue
					logger.info(
						`Migration: Setting ${collectionName} object "${obj._id}".${property} to ${defaultValue}`
					)
					await collection.mutableCollection.updateAsync(obj._id, { $set: m })
				}
			}
		},
		dependOnResultFrom: dependOnResultFrom,
	}
}

export function removeCollectionProperty<T = any>(
	collectionName: CollectionName,
	selector: Mongo.Selector<T>,
	property: string,
	dependOnResultFrom?: string
): Omit<MigrationStepCore, 'version'> {
	const collection = Collections.get(collectionName)
	if (!collection) throw new Meteor.Error(404, `Collection ${collectionName} not found`)

	return {
		id: `${collectionName}.${property}`,
		canBeRunAutomatically: true,
		validate: async () => {
			const objects = await collection.findFetchAsync(selector)

			for (const obj of objects) {
				const objValue = objectPathGet(obj, property)
				if (objValue !== undefined) {
					return `${property} is set ${obj._id}`
				}
			}

			return false
		},
		migrate: async () => {
			const objects = await collection.findFetchAsync(selector)
			for (const obj of objects) {
				if (obj && objectPathGet(obj, property) !== undefined) {
					const m = {}
					m[property] = 1
					logger.info(`Migration: Removing property ${collectionName}."${obj._id}".${property}`)
					await collection.mutableCollection.updateAsync(obj._id, { $unset: m })
				}
			}
		},
		dependOnResultFrom: dependOnResultFrom,
	}
}

interface RenameContent {
	content: { [newValue: string]: string }
}
export function renamePropertiesInCollection<DBInterface extends { _id: ProtectedString<any> }>(
	id: string,
	collection: AsyncOnlyMongoCollection<DBInterface>,
	collectionName: string,
	renames: Partial<{ [newAttr in keyof DBInterface]: string | RenameContent }>,
	dependOnResultFrom?: string
): Omit<MigrationStepCore, 'version'> {
	const m: any = {
		$or: [],
	}
	const oldNames: { [oldAttr: string]: string } = {}
	_.each(_.keys(renames), (newAttr) => {
		const oldAttr = renames[newAttr]
		if (_.isString(oldAttr)) {
			oldNames[oldAttr] = newAttr
		}
	})

	_.each(_.keys(renames), (newAttr) => {
		const oldAttr: string | RenameContent | undefined = renames[newAttr]
		if (oldAttr) {
			if (_.isString(oldAttr)) {
				const o = {}
				o[oldAttr] = { $exists: true }
				m.$or.push(o)
			} else {
				const oldAttrRenameContent: RenameContent = oldAttr // for some reason, tsc complains otherwise

				const oldAttrActual = oldNames[newAttr] || newAttr // If the attribute has been renamed, rename it here as well

				// Select where a value is of the old, to-be-replaced value:
				const o = {}
				o[oldAttrActual] = { $in: Object.values<string>(oldAttrRenameContent.content) }
				m.$or.push(o)
			}
		}
	})
	return {
		id: id,
		canBeRunAutomatically: true,
		dependOnResultFrom: dependOnResultFrom,
		validate: async () => {
			const objCount = await collection.countDocuments(m)
			if (objCount > 0) return `${objCount} documents in ${collectionName} needs to be updated`
			return false
		},
		migrate: async () => {
			const docs = await collection.findFetchAsync(m)

			for (const doc of docs) {
				// Rename properties:
				_.each(_.keys(renames), (newAttr) => {
					const oldAttr: string | RenameContent | undefined = renames[newAttr]
					if (newAttr && oldAttr && newAttr !== oldAttr) {
						if (_.isString(oldAttr)) {
							if (_.has(doc, oldAttr) && !_.has(doc, newAttr)) {
								doc[newAttr] = doc[oldAttr]
							}
							delete doc[oldAttr]
						}
					}
				})
				// Translate property contents:
				_.each(_.keys(renames), (newAttr) => {
					const oldAttr: string | RenameContent | undefined = renames[newAttr]
					if (newAttr && oldAttr && newAttr !== oldAttr) {
						if (!_.isString(oldAttr)) {
							const oldAttrRenameContent: RenameContent = oldAttr // for some reason, tsc complains otherwise

							_.each(oldAttrRenameContent.content, (oldValue, newValue) => {
								if (doc[newAttr] === oldValue) {
									doc[newAttr] = newValue
								}
							})
						}
					}
				})
				await collection.updateAsync(doc._id, doc)
			}
		},
	}
}
