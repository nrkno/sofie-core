import { ProtectedString, getCurrentTime, waitForPromise, getCollectionKey } from '../../lib/lib'
import { CollectionCleanupResult } from '../../lib/api/system'
import { MongoQuery } from '../../lib/typings/meteor'
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
import { getActiveRundownPlaylistsInStudioFromDb } from './studio/lib'
import { ExpectedPackages } from '../../lib/collections/ExpectedPackages'
import { ExpectedPackageWorkStatuses } from '../../lib/collections/ExpectedPackageWorkStatuses'
import { PackageContainerPackageStatuses } from '../../lib/collections/PackageContainerPackageStatus'
import { PackageInfos } from '../../lib/collections/PackageInfos'
import { Settings } from '../../lib/Settings'
import { TriggeredActions } from '../../lib/collections/TriggeredActions'
import { AsyncMongoCollection } from '../../lib/collections/lib'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'

export function cleanupOldDataInner(actuallyCleanup: boolean = false): CollectionCleanupResult | string {
	if (actuallyCleanup) {
		const notAllowedReason = isAllowedToRunCleanup()
		if (notAllowedReason) return `Could not run the cleanup function due to: ${notAllowedReason}`
	}

	const result: CollectionCleanupResult = {}
	const addToResult = (collectionName: CollectionName, docsToRemove: number) => {
		if (!result[collectionName]) {
			result[collectionName] = {
				collectionName: collectionName,
				docsToRemove: 0,
			}
		}
		result[collectionName].docsToRemove += docsToRemove
	}

	// Preparations: ------------------------------------------------------------------------------
	const getAllIdsInCollection = <DBInterface extends { _id: ProtectedString<any> }>(
		collection: AsyncMongoCollection<DBInterface>
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

	const removeByQuery = <DBInterface extends { _id: ProtectedString<any> }>(
		// collectionName: string,
		collection: AsyncMongoCollection<DBInterface>,
		query: MongoQuery<DBInterface>
	): void => {
		const collectionName = getCollectionKey(collection)

		const count = collection.find(query).count()
		if (actuallyCleanup) {
			collection.remove(query)
		}
		addToResult(collectionName, count)
	}

	const ownedByRundownId = <DBInterface extends { _id: ProtectedString<any>; rundownId: RundownId }>(
		collection: AsyncMongoCollection<DBInterface>
	): void => {
		removeByQuery(collection as AsyncMongoCollection<any>, {
			rundownId: { $nin: rundownIds },
		})
	}
	const ownedByRundownPlaylistId = <DBInterface extends { _id: ProtectedString<any>; playlistId: RundownPlaylistId }>(
		collection: AsyncMongoCollection<DBInterface>
	): void => {
		removeByQuery(collection as AsyncMongoCollection<any>, {
			playlistId: { $nin: playlistIds },
		})
	}
	const ownedByStudioId = <DBInterface extends { _id: ProtectedString<any>; studioId: StudioId }>(
		collection: AsyncMongoCollection<DBInterface>
	): void => {
		removeByQuery(collection as AsyncMongoCollection<any>, {
			studioId: { $nin: studioIds },
		})
	}
	const ownedByRundownIdOrStudioId = <
		DBInterface extends { _id: ProtectedString<any>; rundownId?: RundownId; studioId: StudioId }
	>(
		collection: AsyncMongoCollection<DBInterface>
	): void => {
		removeByQuery(collection as AsyncMongoCollection<any>, {
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
		DBInterface extends { _id: ProtectedString<any>; organizationId: OrganizationId | null | undefined }
	>(
		collection: AsyncMongoCollection<DBInterface>
	): void => {
		removeByQuery(collection as AsyncMongoCollection<any>, {
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
	const ownedByDeviceId = <DBInterface extends { _id: ProtectedString<any>; deviceId: PeripheralDeviceId }>(
		collection: AsyncMongoCollection<DBInterface>
	): void => {
		removeByQuery(collection as AsyncMongoCollection<any>, {
			deviceId: { $nin: deviceIds },
		})
	}

	// Going Through data and removing old data: --------------------------------------------------
	// CoreSystem:
	{
		addToResult(CollectionName.CoreSystem, 0) // Do nothing
	}
	// AdLibActions
	{
		ownedByRundownId(AdLibActions)
	}
	// AdLibPieces
	{
		ownedByRundownId(AdLibPieces)
	}
	// Blueprints
	{
		ownedByOrganizationId(Blueprints)
	}
	// BucketAdLibs
	{
		ownedByStudioId(BucketAdLibs)
	}
	// BucketAdLibActions
	{
		ownedByStudioId(BucketAdLibActions)
	}
	// Buckets
	{
		ownedByStudioId(Buckets)
	}
	// Evaluations
	{
		removeByQuery(Evaluations, {
			timestamp: { $lt: getCurrentTime() - Settings.maximumDataAge },
		})
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
		addToResult(CollectionName.ExpectedMediaItems, emiFromBuckets.length)
		addToResult(CollectionName.ExpectedMediaItems, emiFromRundowns.length)
		if (actuallyCleanup) {
			ExpectedMediaItems.remove({
				_id: { $in: [...emiFromBuckets, ...emiFromRundowns].map((o) => o._id) },
			})
		}
	}
	// ExpectedPackages
	{
		ownedByStudioId(ExpectedPackages)
	}
	// ExpectedPackageWorkStatuses
	{
		ownedByStudioId(ExpectedPackageWorkStatuses)
		ownedByDeviceId(ExpectedPackageWorkStatuses)
	}
	// ExpectedPlayoutItems
	{
		ownedByRundownIdOrStudioId(ExpectedPlayoutItems)
	}
	// ExternalMessageQueue
	{
		removeByQuery(ExternalMessageQueue, {
			created: { $lt: getCurrentTime() - Settings.maximumDataAge },
		})
	}
	// IngestDataCache
	{
		ownedByRundownId(IngestDataCache)
	}
	// MediaObjects
	{
		// TODO: Shouldn't this be owned by a device?
		ownedByStudioId(MediaObjects)
	}
	// MediaWorkFlows
	{
		ownedByDeviceId(MediaWorkFlows)
	}
	// MediaWorkFlowSteps
	{
		removeByQuery(MediaWorkFlowSteps, {
			workFlowId: { $nin: getAllIdsInCollection(MediaWorkFlows) },
		})
	}
	// Organizations
	{
		addToResult(CollectionName.Organizations, 0) // Do nothing
	}
	// PackageContainerPackageStatuses
	{
		ownedByStudioId(PackageContainerPackageStatuses)
		ownedByDeviceId(PackageContainerPackageStatuses)
	}
	// PackageInfos
	{
		ownedByStudioId(PackageInfos)
		ownedByDeviceId(PackageInfos)
	}
	// Parts
	{
		ownedByRundownId(Parts)
	}
	// PartInstances
	{
		ownedByRundownId(PartInstances)
	}
	// PeripheralDeviceCommands
	{
		ownedByDeviceId(PeripheralDeviceCommands)
	}
	// PeripheralDevices
	{
		ownedByOrganizationId(PeripheralDevices)
	}
	// Pieces
	{
		removeByQuery(Pieces, {
			startRundownId: { $nin: rundownIds },
		})
	}
	// PieceInstances
	{
		removeByQuery(PieceInstances, {
			rundownId: { $nin: rundownIds },
		})
	}
	// RundownBaselineAdLibActions
	{
		ownedByRundownId(RundownBaselineAdLibActions)
	}
	// RundownBaselineAdLibPieces
	{
		ownedByRundownId(RundownBaselineAdLibPieces)
	}
	// RundownBaselineObjs
	{
		ownedByRundownId(RundownBaselineObjs)
	}
	// RundownLayouts
	{
		removeByQuery(RundownLayouts, {
			showStyleBaseId: { $nin: getAllIdsInCollection(ShowStyleBases) },
		})
	}
	// RundownPlaylists
	{
		ownedByStudioId(RundownPlaylists)
	}
	// Rundowns
	{
		ownedByRundownPlaylistId(Rundowns)
	}
	// Segments
	{
		ownedByRundownId(Segments)
	}
	// ShowStyleBases
	{
		ownedByOrganizationId(ShowStyleBases)
	}
	// ShowStyleVariants
	{
		removeByQuery(ShowStyleVariants, {
			showStyleBaseId: { $nin: getAllIdsInCollection(ShowStyleBases) },
		})
	}
	// Snapshots
	{
		removeByQuery(Snapshots, {
			created: { $lt: getCurrentTime() - Settings.maximumDataAge },
		})
	}
	// Studios
	{
		ownedByOrganizationId(Studios)
	}
	// Timeline
	{
		removeByQuery(Timeline, {
			_id: { $nin: studioIds },
		})
	}
	// TriggeredActions
	{
		removeByQuery(TriggeredActions, {
			showStyleBaseId: { $nin: [...getAllIdsInCollection(ShowStyleBases), null] },
		})
	}
	// UserActionsLog
	{
		removeByQuery(UserActionsLog, {
			timestamp: { $lt: getCurrentTime() - Settings.maximumDataAge },
		})
	}
	// Users
	{
		addToResult(CollectionName.Users, 0) // Do nothing
	}

	return result
}
function isAllowedToRunCleanup(): string | void {
	// HACK: TODO - should we check this?
	// if (isAnyQueuedWorkRunning()) return `Another sync-function is running, try again later`

	const studios = Studios.find({}, { fields: { _id: 1 } }).fetch()
	for (const studio of studios) {
		const activePlaylist: RundownPlaylist | undefined = waitForPromise(
			getActiveRundownPlaylistsInStudioFromDb(studio._id)
		)[0]
		if (activePlaylist) {
			return `There is an active RundownPlaylist: "${activePlaylist.name}" in studio "${studio.name}" (${activePlaylist._id}, ${studio._id})`
		}
	}
}
