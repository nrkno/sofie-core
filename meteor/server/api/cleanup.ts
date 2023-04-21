import { ProtectedString, getCurrentTime, getCollectionKey, waitForPromise } from '../../lib/lib'
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
import { Organizations } from '../../lib/collections/Organization'
import { PartInstances } from '../../lib/collections/PartInstances'
import { Parts } from '../../lib/collections/Parts'
import { PeripheralDeviceCommands } from '../../lib/collections/PeripheralDeviceCommands'
import { PeripheralDevices } from '../../lib/collections/PeripheralDevices'
import { Pieces } from '../../lib/collections/Pieces'
import { RundownBaselineAdLibActions } from '../../lib/collections/RundownBaselineAdLibActions'
import { RundownBaselineAdLibPieces } from '../../lib/collections/RundownBaselineAdLibPieces'
import { RundownBaselineObjs } from '../../lib/collections/RundownBaselineObjs'
import { RundownLayouts } from '../../lib/collections/RundownLayouts'
import { RundownPlaylists, RundownPlaylist } from '../../lib/collections/RundownPlaylists'
import { Rundowns } from '../../lib/collections/Rundowns'
import { Segments } from '../../lib/collections/Segments'
import { ShowStyleBases } from '../../lib/collections/ShowStyleBases'
import { ShowStyleVariants } from '../../lib/collections/ShowStyleVariants'
import { Snapshots } from '../../lib/collections/Snapshots'
import { Studios } from '../../lib/collections/Studios'
import { Timeline } from '../../lib/collections/Timeline'
import { UserActionsLog } from '../../lib/collections/UserActionsLog'
import { PieceInstances } from '../../lib/collections/PieceInstances'
import { getActiveRundownPlaylistsInStudioFromDb, getRemovedOrOrphanedPackageInfos } from './studio/lib'
import { ExpectedPackages } from '../../lib/collections/ExpectedPackages'
import { ExpectedPackageWorkStatuses } from '../../lib/collections/ExpectedPackageWorkStatuses'
import { PackageContainerPackageStatuses } from '../../lib/collections/PackageContainerPackageStatus'
import { PackageInfos } from '../../lib/collections/PackageInfos'
import { Settings } from '../../lib/Settings'
import { TriggeredActions } from '../../lib/collections/TriggeredActions'
import { AsyncMongoCollection } from '../../lib/collections/lib'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import {
	BlueprintId,
	BucketId,
	MediaWorkFlowId,
	OrganizationId,
	PartId,
	PeripheralDeviceId,
	RundownId,
	RundownPlaylistId,
	ShowStyleBaseId,
	StudioId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Workers } from '../../lib/collections/Workers'
import { WorkerThreadStatuses } from '../../lib/collections/WorkerThreads'
import { TranslationsBundles } from '../../lib/collections/TranslationsBundles'

/**
 * If actuallyCleanup=true, cleans up old data. Otherwise just checks what old data there is
 * @returns A string if there is an issue preventing cleanup. CollectionCleanupResult otherwise
 */
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

	const removeByQuery = <DBInterface extends { _id: ID }, ID extends ProtectedString<any>>(
		// collectionName: string,
		collection: AsyncMongoCollection<DBInterface>,
		query: MongoQuery<DBInterface>
	): ID[] => {
		const collectionName = getCollectionKey(collection)

		const ids = collection
			.find(query, { fields: { _id: 1 } })
			.fetch()
			.map((doc) => doc._id)
		const count = ids.length
		if (actuallyCleanup) {
			collection.remove(query)
		}
		addToResult(collectionName, count)

		return ids
	}

	// Go through and removing old data: --------------------------------------------------

	// CoreSystem:
	{
		addToResult(CollectionName.CoreSystem, 0) // Do nothing
	}
	// Organizations
	{
		addToResult(CollectionName.Organizations, 0) // Do nothing
	}
	// Users
	{
		addToResult(CollectionName.Users, 0) // Do nothing
	}

	// Documents owned by Organizations:
	const organizationIds = getAllIdsInCollection(Organizations)
	const removedStudioIds = new Set<StudioId>()
	const removedShowStyleBases = new Set<ShowStyleBaseId>()
	const removedBlueprints = new Set<BlueprintId>()
	{
		const ownedByOrganizationId = <
			DBInterface extends { _id: ID; organizationId: OrganizationId | null | undefined },
			ID extends ProtectedString<any>
		>(
			collection: AsyncMongoCollection<DBInterface>
		): ID[] => {
			return removeByQuery(collection as AsyncMongoCollection<any>, {
				$and: [
					{
						organizationId: { $nin: organizationIds },
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
		ownedByOrganizationId(Studios).forEach((id) => removedStudioIds.add(id))
		ownedByOrganizationId(ShowStyleBases).forEach((id) => removedShowStyleBases.add(id))
		ownedByOrganizationId(Blueprints).forEach((id) => removedBlueprints.add(id))
		ownedByOrganizationId(PeripheralDevices)
	}

	// Documents owned by Studios:
	const studioIds = getAllIdsInCollection(Studios, removedStudioIds)
	const removedRundownPlaylists = new Set<RundownPlaylistId>()
	const removedBuckets = new Set<BucketId>()
	{
		const ownedByStudioId = <DBInterface extends { _id: ID; studioId: StudioId }, ID extends ProtectedString<any>>(
			collection: AsyncMongoCollection<DBInterface>
		): ID[] => {
			return removeByQuery(collection as AsyncMongoCollection<any>, {
				studioId: { $nin: studioIds },
			})
		}
		ownedByStudioId(RundownPlaylists).forEach((id) => removedRundownPlaylists.add(id))
		ownedByStudioId(BucketAdLibs)
		ownedByStudioId(BucketAdLibActions)
		ownedByStudioId(Buckets).forEach((id) => removedBuckets.add(id))
		ownedByStudioId(ExpectedPackages)
		ownedByStudioId(ExpectedPackageWorkStatuses)
		ownedByStudioId(MediaObjects)
		ownedByStudioId(PackageContainerPackageStatuses)
		ownedByStudioId(PackageInfos)
		removeByQuery(Timeline, {
			_id: { $nin: studioIds },
		})
	}
	// Documents owned by ShowStyleBases:
	const showStyleBaseIds = getAllIdsInCollection(ShowStyleBases, removedShowStyleBases)
	{
		removeByQuery(RundownLayouts, {
			showStyleBaseId: { $nin: showStyleBaseIds },
		})
		removeByQuery(ShowStyleVariants, {
			showStyleBaseId: { $nin: showStyleBaseIds },
		})
		removeByQuery(TriggeredActions, {
			showStyleBaseId: { $nin: [...showStyleBaseIds, null] },
		})
	}

	// Documents owned by Blueprints:
	const blueprintIds = getAllIdsInCollection(Blueprints, removedBlueprints)
	{
		removeByQuery(TranslationsBundles, {
			originBlueprintId: { $nin: blueprintIds },
		})
	}

	// Documents owned by RundownPlaylists:
	const playlistIds = getAllIdsInCollection(RundownPlaylists, removedRundownPlaylists)
	const removedRundowns = new Set<RundownId>()

	{
		const ownedByRundownPlaylistId = <
			DBInterface extends { _id: ID; playlistId: RundownPlaylistId },
			ID extends ProtectedString<any>
		>(
			collection: AsyncMongoCollection<DBInterface>
		): ID[] => {
			return removeByQuery(collection as AsyncMongoCollection<any>, {
				playlistId: { $nin: playlistIds },
			})
		}
		ownedByRundownPlaylistId(Rundowns).forEach((id) => removedRundowns.add(id))
	}

	// Documents owned by Rundowns:
	const rundownIds = getAllIdsInCollection(Rundowns, removedRundowns)
	const removedParts = new Set<PartId>()
	{
		const ownedByRundownId = <
			DBInterface extends { _id: ID; rundownId: RundownId },
			ID extends ProtectedString<any>
		>(
			collection: AsyncMongoCollection<DBInterface>
		): ID[] => {
			return removeByQuery(collection as AsyncMongoCollection<any>, {
				rundownId: { $nin: rundownIds },
			})
		}
		ownedByRundownId(AdLibActions)
		ownedByRundownId(AdLibPieces)
		ownedByRundownId(IngestDataCache)
		ownedByRundownId(Parts).forEach((id) => removedParts.add(id))
		ownedByRundownId(RundownBaselineAdLibActions)
		ownedByRundownId(RundownBaselineAdLibPieces)
		ownedByRundownId(RundownBaselineObjs)
		ownedByRundownId(Segments)
		// Owned by RundownId Or StudioId:
		{
			removeByQuery(ExpectedPlayoutItems, {
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
		removeByQuery(Pieces, {
			startRundownId: { $nin: rundownIds },
		})
		ownedByRundownId(PieceInstances)
	}
	// Documents owned by PeripheralDevices:
	const removedMediaWorkFlows = new Set<MediaWorkFlowId>()
	{
		const deviceIds = getAllIdsInCollection(PeripheralDevices)
		const ownedByDeviceId = <
			DBInterface extends { _id: ID; deviceId: PeripheralDeviceId },
			ID extends ProtectedString<any>
		>(
			collection: AsyncMongoCollection<DBInterface>
		): ID[] => {
			return removeByQuery(collection as AsyncMongoCollection<any>, {
				deviceId: { $nin: deviceIds },
			})
		}
		ownedByDeviceId(ExpectedPackageWorkStatuses)
		ownedByDeviceId(MediaWorkFlows).forEach((id) => removedMediaWorkFlows.add(id))
		ownedByDeviceId(PackageContainerPackageStatuses)
		ownedByDeviceId(PackageInfos)
		ownedByDeviceId(PeripheralDeviceCommands)
	}

	// Documents owned by Parts:
	{
		const partIds = getAllIdsInCollection(Parts, removedParts)
		removeByQuery(PartInstances, {
			$or: [{ rundownId: { $nin: rundownIds } }, { 'part._id': { $nin: partIds } }],
		})
	}

	// Other documents:

	// Evaluations
	{
		removeByQuery(Evaluations, {
			timestamp: { $lt: getCurrentTime() - Settings.maximumDataAge },
		})
	}
	// ExpectedMediaItems
	{
		const bucketIds = getAllIdsInCollection(Buckets, removedBuckets)
		const emiFromBuckets = ExpectedMediaItems.find(
			{
				$and: [
					{
						bucketId: { $exists: true },
						rundownId: { $exists: false },
					},
					{
						bucketId: { $nin: bucketIds },
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
	// ExternalMessageQueue
	{
		removeByQuery(ExternalMessageQueue, {
			$or: [
				{ created: { $lt: getCurrentTime() - Settings.maximumDataAge } },
				{ expires: { $lt: getCurrentTime() } },
			],
		})
	}
	// MediaWorkFlowSteps
	{
		const mediaWorkFlowIds = getAllIdsInCollection(MediaWorkFlows, removedMediaWorkFlows)
		removeByQuery(MediaWorkFlowSteps, {
			workFlowId: { $nin: mediaWorkFlowIds },
		})
	}
	// PackageInfos
	{
		const removedPackageInfoIds = waitForPromise(getRemovedOrOrphanedPackageInfos())
		addToResult(CollectionName.PackageInfos, removedPackageInfoIds.length)
		if (actuallyCleanup) {
			PackageInfos.remove({
				_id: { $in: removedPackageInfoIds },
			})
		}
	}
	// Snapshots
	{
		removeByQuery(Snapshots, {
			created: { $lt: getCurrentTime() - Settings.maximumDataAge },
		})
	}
	// UserActionsLog
	{
		removeByQuery(UserActionsLog, {
			timestamp: { $lt: getCurrentTime() - Settings.maximumDataAge },
		})
	}
	// Workers
	{
		addToResult(getCollectionKey(Workers), 0)
	}
	// WorkerThreadStatuses
	{
		const workerIds = getAllIdsInCollection(Workers)
		removeByQuery(WorkerThreadStatuses, {
			workerId: { $nin: workerIds },
		})
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
/** Returns a list of the ids of all documents in a collection */
function getAllIdsInCollection<DBInterface extends { _id: ID }, ID extends ProtectedString<any>>(
	collection: AsyncMongoCollection<DBInterface>,
	excludeIds?: Set<ID>
): DBInterface['_id'][] {
	let ids = collection
		.find(
			{},
			{
				fields: {
					_id: 1,
				},
			}
		)
		.map((o) => o._id)
	if (excludeIds) ids = ids.filter((id) => !excludeIds.has(id))
	return ids
}
