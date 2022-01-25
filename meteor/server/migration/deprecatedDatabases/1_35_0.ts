import { Mongo } from 'meteor/mongo'
import { waitForPromise } from '../../../lib/lib'

let packageContainerStatuses: Mongo.Collection<any> | null | undefined = undefined

let hasDroppedDeprecatedDatabases = false
export function getDeprecatedDatabase(): Mongo.Collection<any> | null {
	// This is a singleton
	// Only set up links to the deprecated databases when running migrations
	// because when running this, the collections will be created if not found.

	if (hasDroppedDeprecatedDatabases) return null

	if (packageContainerStatuses !== undefined) {
		return packageContainerStatuses
	} else {
		try {
			packageContainerStatuses = new Mongo.Collection('packageContainerStatuses')
		} catch (err) {
			if ((err + '').match(/There is already/i)) {
				// There is already a collection named ''
				// This means that there is a real PackageContainerStatuses collection,
				// (that hasn't been created yet, at the time of writing this.)

				// This likely means that the migration is not needed anymore:
				packageContainerStatuses = null
			} else throw err
		}
		return packageContainerStatuses
	}
}
export function dropDeprecatedDatabase(): void {
	const db = getDeprecatedDatabase()
	if (db) {
		const ps: Promise<any>[] = []

		ps.push(db.rawCollection().drop())

		waitForPromise(
			Promise.all(ps).catch((e) => {
				if (e.toString().match(/ns not found/i)) {
					// Ignore, this means that the collection is not found
					return
				} else {
					throw e
				}
			})
		)

		packageContainerStatuses = null
		hasDroppedDeprecatedDatabases = true
	}
}
