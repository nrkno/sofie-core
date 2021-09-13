import { ProtectedString, getCurrentTime, waitForPromise } from '../../lib/lib'
import { CollectionCleanupResult } from '../../lib/api/system'
import { TransformedCollection, MongoQuery } from '../../lib/typings/meteor'
import { AdLibActions } from '../../lib/collections/AdLibActions'
import { AdLibPieces } from '../../lib/collections/AdLibPieces'
import { Blueprints } from '../../lib/collections/Blueprints'
import { BucketAdLibs } from '../../lib/collections/BucketAdlibs'
import { BucketAdLibActions } from '../../lib/collections/BucketAdlibActions'
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
import { RundownPlaylists, RundownPlaylistId, RundownPlaylist } from '../../lib/collections/RundownPlaylists'
import { Rundowns, RundownId } from '../../lib/collections/Rundowns'
import { Segments } from '../../lib/collections/Segments'
import { ShowStyleBases } from '../../lib/collections/ShowStyleBases'
import { ShowStyleVariants } from '../../lib/collections/ShowStyleVariants'
import { Snapshots } from '../../lib/collections/Snapshots'
import { Studios, StudioId } from '../../lib/collections/Studios'
import { Timeline } from '../../lib/collections/Timeline'
import { UserActionsLog } from '../../lib/collections/UserActionsLog'
import { PieceInstances } from '../../lib/collections/PieceInstances'
import { isAnyQueuedWorkRunning } from '../codeControl'
import { getActiveRundownPlaylistsInStudioFromDb } from './studio/lib'

export function cleanupOldDataInner(actuallyCleanup: boolean = false): CollectionCleanupResult[] | string {
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
	const ownedByRundownIdOrStudioId = <
		Class extends DBInterface,
		DBInterface extends { _id: ProtectedString<any>; rundownId?: RundownId; studioId: StudioId }
	>(
		collectionName,
		collection: TransformedCollection<Class, DBInterface>
	): CollectionCleanupResult => {
		return removeByQuery(collectionName, collection as TransformedCollection<any, any>, {
			$or: [
				{
					rundownId: { $exists: true, $nin: rundownIds },
				},
				{
					rundownId: { $exists: false },
					studioId: { $nin: studioIds },
				},
			],
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
	// Blueprints
	{
		results.push(ownedByOrganizationId('Blueprints', Blueprints))
	}
	// BucketAdLibs
	{
		results.push(ownedByStudioId('BucketAdLibs', BucketAdLibs))
	}
	// BucketAdLibActions
	{
		results.push(ownedByStudioId('BucketAdLibActions', BucketAdLibActions))
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
						rundownId: { $nin: rundownIds },
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
		results.push(ownedByRundownIdOrStudioId('ExpectedPlayoutItems', ExpectedPlayoutItems))
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
	if (isAnyQueuedWorkRunning()) return `Another sync-function is running, try again later`

	const studios = Studios.find().fetch()
	for (const studio of studios) {
		const activePlaylist: RundownPlaylist | undefined = waitForPromise(
			getActiveRundownPlaylistsInStudioFromDb(studio._id)
		)[0]
		if (activePlaylist) {
			return `There is an active RundownPlaylist: "${activePlaylist.name}" in studio "${studio.name}" (${activePlaylist._id}, ${studio._id})`
		}
	}
}
