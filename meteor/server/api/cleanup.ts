import { ProtectedString, getCurrentTime } from '../../lib/lib'
import { CollectionCleanupResult } from '../../lib/api/system'
import { MongoQuery } from '../../lib/typings/meteor'
import { RundownPlaylist } from '../../lib/collections/RundownPlaylists'
import { getActiveRundownPlaylistsInStudioFromDb, getRemovedPackageInfos } from './studio/lib'
import { Settings } from '../../lib/Settings'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import {
	OrganizationId,
	PeripheralDeviceId,
	RundownId,
	RundownPlaylistId,
	StudioId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import {
	AdLibActions,
	AdLibPieces,
	Blueprints,
	BucketAdLibActions,
	BucketAdLibs,
	Buckets,
	Evaluations,
	ExpectedMediaItems,
	ExpectedPackages,
	ExpectedPackageWorkStatuses,
	ExpectedPlayoutItems,
	ExternalMessageQueue,
	IngestDataCache,
	MediaObjects,
	MediaWorkFlows,
	MediaWorkFlowSteps,
	Organizations,
	PackageContainerPackageStatuses,
	PackageContainerStatuses,
	PackageInfos,
	PartInstances,
	Parts,
	PeripheralDeviceCommands,
	PeripheralDevices,
	PieceInstances,
	Pieces,
	RundownBaselineAdLibActions,
	RundownBaselineAdLibPieces,
	RundownBaselineObjs,
	RundownLayouts,
	RundownPlaylists,
	Rundowns,
	Segments,
	ShowStyleBases,
	ShowStyleVariants,
	Snapshots,
	Studios,
	Timeline,
	TimelineDatastore,
	TranslationsBundles,
	TriggeredActions,
	UserActionsLog,
	Workers,
	WorkerThreadStatuses,
} from '../collections'
import { AsyncMongoCollection } from '../collections/collection'
import { getCollectionKey } from '../collections/lib'

export async function cleanupOldDataInner(actuallyCleanup: boolean = false): Promise<CollectionCleanupResult | string> {
	if (actuallyCleanup) {
		const notAllowedReason = await isAllowedToRunCleanup()
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
	// PackageContainerStatuses
	{
		ownedByStudioId(PackageContainerStatuses)
		ownedByDeviceId(PackageContainerStatuses)
	}
	// PackageInfos
	{
		ownedByStudioId(PackageInfos)
		ownedByDeviceId(PackageInfos)

		const removedPackageInfoIds = await getRemovedPackageInfos()
		addToResult(CollectionName.PackageInfos, removedPackageInfoIds.length)
		if (actuallyCleanup) {
			PackageInfos.remove({
				_id: { $in: removedPackageInfoIds },
			})
		}
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
	// TimelineDatastore
	{
		removeByQuery(TimelineDatastore, {
			studioId: { $nin: studioIds },
		})
	}
	// TranslationsBundles
	{
		// Not supported
		addToResult(getCollectionKey(TranslationsBundles), 0)
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
	// Workers
	{
		// Not supported
		addToResult(getCollectionKey(Workers), 0)
	}
	// WorkerThreadStatuses
	{
		// Not supported
		addToResult(getCollectionKey(WorkerThreadStatuses), 0)
	}

	return result
}
async function isAllowedToRunCleanup(): Promise<string | void> {
	// HACK: TODO - should we check this?
	// if (isAnyQueuedWorkRunning()) return `Another sync-function is running, try again later`

	const studios = await Studios.findFetchAsync({}, { fields: { _id: 1 } })
	for (const studio of studios) {
		const activePlaylist: RundownPlaylist | undefined = await getActiveRundownPlaylistsInStudioFromDb(studio._id)[0]
		if (activePlaylist) {
			return `There is an active RundownPlaylist: "${activePlaylist.name}" in studio "${studio.name}" (${activePlaylist._id}, ${studio._id})`
		}
	}
}
