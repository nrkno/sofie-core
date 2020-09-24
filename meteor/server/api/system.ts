import * as _ from 'underscore'
import { makePromise, ProtectedString, getCurrentTime } from '../../lib/lib'
import { registerClassToMeteorMethods } from '../methods'
import { MethodContextAPI, MethodContext } from '../../lib/api/methods'
import { NewSystemAPI, SystemAPIMethods, CollectionCleanupResult } from '../../lib/api/system'
import { getAllIndexes } from '../../lib/database'
import { Meteor } from 'meteor/meteor'
import { IndexSpecification } from 'mongodb'
import { TransformedCollection, MongoQuery } from '../../lib/typings/meteor'
import { logger } from '../logging'
import { MeteorWrapAsync, isAnySyncFunctionsRunning } from '../codeControl'
import { SystemWriteAccess } from '../security/system'
import { check } from '../../lib/check'
import { AdLibActions } from '../../lib/collections/AdLibActions'
import { AdLibPieces } from '../../lib/collections/AdLibPieces'
import { AsRunLog } from '../../lib/collections/AsRunLog'
import { Blueprints } from '../../lib/collections/Blueprints'
import { BucketAdLibs } from '../../lib/collections/BucketAdlibs'
import { Buckets } from '../../lib/collections/Buckets'
import { Evaluations } from '../../lib/collections/Evaluations'
import { ExpectedMediaItems } from '../../lib/collections/ExpectedMediaItems'
import { ExpectedPlayoutItems } from '../../lib/collections/ExpectedPlayoutItems'
import { ExternalMessageQueue } from '../../lib/collections/ExternalMessageQueue'
import { IngestDataCache } from '../../lib/collections/IngestDataCache'
import { MediaObjects } from '../../lib/collections/MediaObjects'
import { MediaWorkFlows } from '../../lib/collections/MediaWorkFlows'
import { MediaWorkFlowSteps } from '../../lib/collections/MediaWorkFlowSteps'
import { Organizations, OrganizationId } from '../../lib/collections/Organization'
import { PartInstances } from '../../lib/collections/PartInstances'
import { Parts } from '../../lib/collections/Parts'
import { PeripheralDeviceCommands } from '../../lib/collections/PeripheralDeviceCommands'
import { PeripheralDevices, PeripheralDeviceId } from '../../lib/collections/PeripheralDevices'
import { Pieces } from '../../lib/collections/Pieces'
import { RundownBaselineAdLibActions } from '../../lib/collections/RundownBaselineAdLibActions'
import { RundownBaselineAdLibPieces } from '../../lib/collections/RundownBaselineAdLibPieces'
import { RundownBaselineObjs } from '../../lib/collections/RundownBaselineObjs'
import { RundownLayouts } from '../../lib/collections/RundownLayouts'
import { RundownPlaylists, RundownPlaylist, RundownPlaylistId } from '../../lib/collections/RundownPlaylists'
import { Rundowns, RundownId } from '../../lib/collections/Rundowns'
import { Segments } from '../../lib/collections/Segments'
import { ShowStyleBases } from '../../lib/collections/ShowStyleBases'
import { ShowStyleVariants } from '../../lib/collections/ShowStyleVariants'
import { Snapshots } from '../../lib/collections/Snapshots'
import { Studios, StudioId } from '../../lib/collections/Studios'
import { Timeline } from '../../lib/collections/Timeline'
import { UserActionsLog } from '../../lib/collections/UserActionsLog'
import { getActiveRundownPlaylistsInStudio } from './playout/studio'
import { PieceInstances } from '../../lib/collections/PieceInstances'

function setupIndexes(removeOldIndexes: boolean = false): IndexSpecification[] {
	// Note: This function should NOT run on Meteor.startup, due to getCollectionIndexes failing if run before indexes have been created.
	const indexes = getAllIndexes()
	if (!Meteor.isServer) throw new Meteor.Error(500, `setupIndexes() can only be run server-side`)

	const removeIndexes: IndexSpecification[] = []
	_.each(indexes, (i, collectionName) => {
		const existingIndexes = getCollectionIndexes(i.collection)

		// Check if there are old indexes in the database that should be removed:
		_.each(existingIndexes, (existingIndex) => {
			// don't touch the users collection, as Metoer adds a few indexes of it's own
			if (collectionName === 'users') return
			if (!existingIndex.name) return // ?

			// Check if the existing index should be kept:
			let found = _.find([...i.indexes, { _id: 1 }], (newIndex) => {
				return _.isEqual(newIndex, existingIndex.key)
			})

			if (!found) {
				removeIndexes.push(existingIndex)
				// The existing index does not exist in our specified list of indexes, and should be removed.
				if (removeOldIndexes) {
					logger.info(`Removing index: ${JSON.stringify(existingIndex.key)}`)
					i.collection.rawCollection().dropIndex(existingIndex.name)
				}
			}
		})

		// Ensure new indexes (add if not existing):
		_.each(i.indexes, (index) => {
			i.collection._ensureIndex(index)
		})
	})
	return removeIndexes
}
function ensureIndexes(): void {
	const indexes = getAllIndexes()
	if (!Meteor.isServer) throw new Meteor.Error(500, `setupIndexes() can only be run server-side`)

	// Ensure new indexes:
	_.each(indexes, (i) => {
		_.each(i.indexes, (index) => {
			i.collection._ensureIndex(index)
		})
	})
}

function cleanupOldDataInner(actuallyCleanup: boolean = false): CollectionCleanupResult[] | string {
	if (actuallyCleanup) {
		const notAllowedReason = isAllowedToRunCleanup()
		if (notAllowedReason) return `Could not run the cleanup function due to: ${notAllowedReason}`
	}

	/** Clean up stuff that are older than this: */
	const MAXIMUM_AGE = 1000 * 60 * 60 * 24 * 100 // 100 days

	const results: CollectionCleanupResult[] = []

	// Preparations: ------------------------------------------------------------------------------
	const getAllIdsInCollection = <Class extends DBInterface, DBInterface extends { _id: ProtectedString<any> }>(
		collection: TransformedCollection<Class, DBInterface>
	): DBInterface['_id'][] => {
		return collection
			.find(
				{},
				{
					fields: {
						_id: 1,
					},
				}
			)
			.map((o) => o._id)
	}
	const studioIds = getAllIdsInCollection(Studios)
	const organizationIds = getAllIdsInCollection(Organizations)
	const deviceIds = getAllIdsInCollection(PeripheralDevices)
	const rundownIds = getAllIdsInCollection(Rundowns)
	const playlistIds = getAllIdsInCollection(RundownPlaylists)

	const removeByQuery = <Class extends DBInterface, DBInterface extends { _id: ProtectedString<any> }>(
		collectionName,
		collection: TransformedCollection<Class, DBInterface>,
		query: MongoQuery<DBInterface>
	): CollectionCleanupResult => {
		const count = collection.find(query).count()
		if (actuallyCleanup) {
			collection.remove(query)
		}
		return {
			collectionName: collectionName,
			docsToRemove: count,
		}
	}

	const ownedByRundownId = <
		Class extends DBInterface,
		DBInterface extends { _id: ProtectedString<any>; rundownId: RundownId }
	>(
		collectionName,
		collection: TransformedCollection<Class, DBInterface>
	): CollectionCleanupResult => {
		return removeByQuery(collectionName, collection as TransformedCollection<any, any>, {
			rundownId: { $nin: rundownIds },
		})
	}
	const ownedByRundownPlaylistId = <
		Class extends DBInterface,
		DBInterface extends { _id: ProtectedString<any>; playlistId: RundownPlaylistId }
	>(
		collectionName,
		collection: TransformedCollection<Class, DBInterface>
	): CollectionCleanupResult => {
		return removeByQuery(collectionName, collection as TransformedCollection<any, any>, {
			playlistId: { $nin: playlistIds },
		})
	}
	const ownedByStudioId = <
		Class extends DBInterface,
		DBInterface extends { _id: ProtectedString<any>; studioId: StudioId }
	>(
		collectionName,
		collection: TransformedCollection<Class, DBInterface>
	): CollectionCleanupResult => {
		return removeByQuery(collectionName, collection as TransformedCollection<any, any>, {
			studioId: { $nin: studioIds },
		})
	}
	const ownedByOrganizationId = <
		Class extends DBInterface,
		DBInterface extends { _id: ProtectedString<any>; organizationId: OrganizationId | null | undefined }
	>(
		collectionName,
		collection: TransformedCollection<Class, DBInterface>
	): CollectionCleanupResult => {
		return removeByQuery(collectionName, collection as TransformedCollection<any, any>, {
			$and: [
				{
					organizationId: { $nin: [organizationIds] },
				},
				{
					organizationId: { $exists: true },
				},
				{
					organizationId: { $ne: null },
				},
			],
		})
	}
	const ownedByDeviceId = <
		Class extends DBInterface,
		DBInterface extends { _id: ProtectedString<any>; deviceId: PeripheralDeviceId }
	>(
		collectionName,
		collection: TransformedCollection<Class, DBInterface>
	): CollectionCleanupResult => {
		return removeByQuery(collectionName, collection as TransformedCollection<any, any>, {
			deviceId: { $nin: deviceIds },
		})
	}

	// Going Through data and removing old data: --------------------------------------------------
	// AdLibActions
	{
		results.push(ownedByRundownId('AdLibActions', AdLibActions))
	}
	// AdLibPieces
	{
		results.push(ownedByRundownId('AdLibPieces', AdLibPieces))
	}
	// AsRunLog
	{
		results.push(
			removeByQuery('AsRunLog', AsRunLog, {
				timestamp: { $lt: getCurrentTime() - MAXIMUM_AGE },
			})
		)
	}
	// Blueprints
	{
		results.push(ownedByOrganizationId('Blueprints', Blueprints))
	}
	// BucketAdLibs
	{
		results.push(ownedByStudioId('BucketAdLibs', BucketAdLibs))
	}
	// Buckets
	{
		results.push(ownedByStudioId('Buckets', Buckets))
	}
	// CoreSystem
	{
		// nothing to clean up (?)
	}
	// Evaluations
	{
		results.push(
			removeByQuery('Evaluations', Evaluations, {
				timestamp: { $lt: getCurrentTime() - MAXIMUM_AGE },
			})
		)
	}
	// ExpectedMediaItems
	{
		const emiFromBuckets = ExpectedMediaItems.find(
			{
				$and: [
					{
						bucketId: { $exists: true },
						rundownId: { $exists: false },
					},
					{
						bucketId: { $nin: getAllIdsInCollection(Buckets) },
					},
				],
			},
			{ fields: { _id: 1 } }
		).fetch()
		const emiFromRundowns = ExpectedMediaItems.find(
			{
				$and: [
					{
						bucketId: { $exists: false },
						rundownId: { $exists: true },
					},
					{
						bucketId: { $nin: rundownIds },
					},
				],
			},
			{ fields: { _id: 1 } }
		).fetch()
		results.push({
			collectionName: 'ExpectedMediaItems',
			docsToRemove: emiFromBuckets.length + emiFromRundowns.length,
		})
		if (actuallyCleanup) {
			ExpectedMediaItems.remove({
				_id: { $in: [...emiFromBuckets, ...emiFromRundowns].map((o) => o._id) },
			})
		}
	}
	// ExpectedPlayoutItems
	{
		results.push(ownedByRundownId('ExpectedPlayoutItems', ExpectedPlayoutItems))
	}
	// ExternalMessageQueue
	{
		results.push(
			removeByQuery('ExternalMessageQueue', ExternalMessageQueue, {
				created: { $lt: getCurrentTime() - MAXIMUM_AGE },
			})
		)
	}
	// IngestDataCache
	{
		results.push(ownedByRundownId('IngestDataCache', IngestDataCache))
	}
	// MediaObjects
	{
		// TODO: Shouldn't this be owned by a device?
		results.push(ownedByStudioId('MediaObjects', MediaObjects))
	}
	// MediaWorkFlows
	{
		results.push(ownedByDeviceId('MediaWorkFlows', MediaWorkFlows))
	}
	// MediaWorkFlowSteps
	{
		results.push(
			removeByQuery('MediaWorkFlowSteps', MediaWorkFlowSteps, {
				workFlowId: { $nin: getAllIdsInCollection(MediaWorkFlows) },
			})
		)
	}
	// Organizations
	{
		// Nothing
	}
	// Parts
	{
		results.push(ownedByRundownId('Parts', Parts))
	}
	// PartInstances
	{
		results.push(ownedByRundownId('PartInstances', PartInstances))
	}
	// PeripheralDeviceCommands
	{
		results.push(ownedByDeviceId('PeripheralDeviceCommands', PeripheralDeviceCommands))
	}
	// PeripheralDevices
	{
		results.push(ownedByOrganizationId('PeripheralDevices', PeripheralDevices))
	}
	// Pieces
	{
		removeByQuery('Pieces', Pieces, {
			startRundownId: { $nin: rundownIds },
		})
	}
	// PieceInstances
	{
		removeByQuery('PieceInstances', PieceInstances, {
			rundownId: { $nin: rundownIds },
		})
	}
	// RundownBaselineAdLibActions
	{
		results.push(ownedByRundownId('RundownBaselineAdLibActions', RundownBaselineAdLibActions))
	}
	// RundownBaselineAdLibPieces
	{
		results.push(ownedByRundownId('RundownBaselineAdLibPieces', RundownBaselineAdLibPieces))
	}
	// RundownBaselineObjs
	{
		results.push(ownedByRundownId('RundownBaselineObjs', RundownBaselineObjs))
	}
	// RundownLayouts
	{
		results.push(
			removeByQuery('RundownLayouts', RundownLayouts, {
				showStyleBaseId: { $nin: getAllIdsInCollection(ShowStyleBases) },
			})
		)
	}
	// RundownPlaylists
	{
		results.push(ownedByStudioId('RundownPlaylists', RundownPlaylists))
	}
	// Rundowns
	{
		results.push(ownedByRundownPlaylistId('Rundowns', Rundowns))
	}
	// Segments
	{
		results.push(ownedByRundownId('Segments', Segments))
	}
	// ShowStyleBases
	{
		results.push(ownedByOrganizationId('ShowStyleBases', ShowStyleBases))
	}
	// ShowStyleVariants
	{
		results.push(
			removeByQuery('ShowStyleVariants', ShowStyleVariants, {
				showStyleBaseId: { $nin: getAllIdsInCollection(ShowStyleBases) },
			})
		)
	}
	// Snapshots
	{
		results.push(
			removeByQuery('Snapshots', Snapshots, {
				created: { $lt: getCurrentTime() - MAXIMUM_AGE },
			})
		)
	}
	// Studios
	{
		results.push(ownedByOrganizationId('Studios', Studios))
	}
	// Timeline
	{
		results.push(
			removeByQuery('Timeline', Timeline, {
				_id: { $nin: studioIds },
			})
		)
	}
	// UserActionsLog
	{
		results.push(
			removeByQuery('UserActionsLog', UserActionsLog, {
				timestamp: { $lt: getCurrentTime() - MAXIMUM_AGE },
			})
		)
	}
	// Users
	{
		// nothing?
	}

	return results
}

function isAllowedToRunCleanup(): string | void {
	if (isAnySyncFunctionsRunning()) return `Another sync-function is running, try again later`

	const studios = Studios.find().fetch()
	for (const studio of studios) {
		const activePlaylist: RundownPlaylist | undefined = getActiveRundownPlaylistsInStudio(null, studio._id)[0]
		if (activePlaylist) {
			return `There is an active RundownPlaylist: "${activePlaylist.name}" in studio "${studio.name}" (${activePlaylist._id}, ${studio._id})`
		}
	}
}
const getCollectionIndexes: (collection: TransformedCollection<any, any>) => IndexSpecification[] = MeteorWrapAsync(
	function getCollectionIndexes(collection: TransformedCollection<any, any>, callback: (err, result) => void) {
		collection.rawCollection().indexes(callback)
	}
)

Meteor.startup(() => {
	// Ensure indexes are created on startup:
	ensureIndexes()
})

export function cleanupIndexes(context: MethodContext, actuallyRemoveOldIndexes: boolean): IndexSpecification[] {
	check(actuallyRemoveOldIndexes, Boolean)
	SystemWriteAccess.coreSystem(context)

	return setupIndexes(actuallyRemoveOldIndexes)
}
export function cleanupOldData(
	context: MethodContext,
	actuallyRemoveOldData: boolean
): string | CollectionCleanupResult[] {
	check(actuallyRemoveOldData, Boolean)
	SystemWriteAccess.coreSystem(context)

	return cleanupOldDataInner(actuallyRemoveOldData)
}
class SystemAPIClass extends MethodContextAPI implements NewSystemAPI {
	cleanupIndexes(actuallyRemoveOldIndexes: boolean) {
		return makePromise(() => cleanupIndexes(this, actuallyRemoveOldIndexes))
	}
	cleanupOldData(actuallyRemoveOldData: boolean) {
		return makePromise(() => cleanupOldData(this, actuallyRemoveOldData))
	}
}
registerClassToMeteorMethods(SystemAPIMethods, SystemAPIClass, false)
