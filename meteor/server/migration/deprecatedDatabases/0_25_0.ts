import { Mongo } from 'meteor/mongo'
import { waitForPromise } from '../../../lib/lib'

interface DeprecatedDatabases {
	RunningOrderBaselineAdLibItems: Mongo.Collection<any>
	RunningOrderBaselineItems: Mongo.Collection<any>
	RunningOrderDataCache: Mongo.Collection<any>
	// RunningOrders: Mongo.Collection<any>,
	SegmentLineAdLibItems: Mongo.Collection<any>
	SegmentLineItems: Mongo.Collection<any>
	SegmentLines: Mongo.Collection<any>
	StudioInstallations: Mongo.Collection<any>
	// RundownBaselineObjs: Mongo.Collection<any>,
}

let deprecatedDatabases: DeprecatedDatabases | null
let hasDroppedDeprecatedDatabases = false
export function getDeprecatedDatabases(): DeprecatedDatabases | null {
	// This is a singleton
	// Only set up links to the deprecated databases when running migrations
	// because when running this, the collections will be created if not found.

	if (hasDroppedDeprecatedDatabases) return null

	if (deprecatedDatabases) {
		return deprecatedDatabases
	} else {
		deprecatedDatabases = {
			RunningOrderBaselineAdLibItems: new Mongo.Collection('runningOrderBaselineAdLibItems'),
			RunningOrderBaselineItems: new Mongo.Collection('runningOrderBaselineItems'),
			RunningOrderDataCache: new Mongo.Collection('runningorderdatacache'),
			// RunningOrders: new Mongo.Collection('rundowns'),
			SegmentLineAdLibItems: new Mongo.Collection('segmentLineAdLibItems'),
			SegmentLineItems: new Mongo.Collection('segmentLineItems'),
			SegmentLines: new Mongo.Collection('segmentLines'),
			StudioInstallations: new Mongo.Collection('studioInstallation'),
			// RundownBaselineObjs: new Mongo.Collection('rundownBaselineObjs')
		}
		return deprecatedDatabases
	}
}
export function dropDeprecatedDatabases(): void {
	const dbs = getDeprecatedDatabases()
	if (dbs) {
		const ps: Promise<any>[] = []

		ps.push(dbs.SegmentLines.rawCollection().drop())
		ps.push(dbs.SegmentLineItems.rawCollection().drop())
		ps.push(dbs.SegmentLineAdLibItems.rawCollection().drop())
		ps.push(dbs.RunningOrderBaselineItems.rawCollection().drop())
		ps.push(dbs.RunningOrderBaselineAdLibItems.rawCollection().drop())
		ps.push(dbs.StudioInstallations.rawCollection().drop())
		// ps.push(dbs.RundownBaselineObjs.rawCollection().drop())

		waitForPromise(
			Promise.all(ps).catch((e) => {
				if (e.toString().match(/ns not found/i)) {
					// Ignore, this means that the database is not found
					return
				} else {
					throw e
				}
			})
		)

		deprecatedDatabases = null
		hasDroppedDeprecatedDatabases = true
	}
}
