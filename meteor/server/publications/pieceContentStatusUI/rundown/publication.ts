import { PackageInfo } from '@sofie-automation/blueprints-integration'
import {
	AdLibActionId,
	ExpectedPackageId,
	PackageContainerPackageId,
	PartId,
	PieceId,
	PieceInstanceId,
	RundownBaselineAdLibActionId,
	RundownPlaylistId,
	SegmentId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { IncludeAllMongoFieldSpecifier } from '@sofie-automation/corelib/dist/mongo'
import { ReadonlyDeep } from 'type-fest'
import { CustomCollectionName, PubSub } from '../../../../lib/api/pubsub'
import { UIPieceContentStatus } from '../../../../lib/api/rundownNotifications'
import { RundownPlaylist } from '../../../../lib/collections/RundownPlaylists'
import {
	MediaObjects,
	PackageContainerPackageStatuses,
	PackageInfos,
	RundownPlaylists,
	Studios,
} from '../../../collections'
import { literal, protectString } from '../../../../lib/lib'
import {
	CustomPublishCollection,
	meteorCustomPublish,
	setUpCollectionOptimizedObserver,
	TriggerUpdate,
} from '../../../lib/customPublication'
import { logger } from '../../../logging'
import { resolveCredentials } from '../../../security/lib/credentials'
import { NoSecurityReadAccess } from '../../../security/noSecurity'
import { RundownPlaylistReadAccess } from '../../../security/rundownPlaylist'
import { ContentCache } from './reactiveContentCache'
import { RundownContentObserver } from './rundownContentObserver'
import { RundownsObserver } from '../../lib/rundownsObserver'
import { LiveQueryHandle } from '../../../lib/lib'
import {
	addItemsWithDependenciesChangesToChangedSet,
	fetchStudio,
	IContentStatusesUpdatePropsBase,
	PieceDependencies,
	studioFieldSpecifier,
} from '../common'
import {
	regenerateForAdLibActionIds,
	regenerateForAdLibPieceIds,
	regenerateForBaselineAdLibActionIds,
	regenerateForBaselineAdLibPieceIds,
	regenerateForPieceIds,
	regenerateForPieceInstanceIds,
} from './regenerateItems'
import { PieceContentStatusStudio } from '../checkPieceContentStatus'
import { check, Match } from 'meteor/check'

interface UIPieceContentStatusesArgs {
	readonly rundownPlaylistId: RundownPlaylistId
}

interface UIPieceContentStatusesState {
	contentCache: ReadonlyDeep<ContentCache>

	studio: PieceContentStatusStudio

	pieceDependencies: Map<PieceId, PieceDependencies>
	pieceInstanceDependencies: Map<PieceInstanceId, PieceDependencies>
	adlibPieceDependencies: Map<PieceId, PieceDependencies>
	adlibActionDependencies: Map<AdLibActionId, PieceDependencies>
	baselineAdlibDependencies: Map<PieceId, PieceDependencies>
	baselineActionDependencies: Map<RundownBaselineAdLibActionId, PieceDependencies>
}

interface UIPieceContentStatusesUpdateProps extends IContentStatusesUpdatePropsBase {
	newCache: ContentCache

	updatedSegmentIds: SegmentId[]
	updatedPartIds: PartId[]

	updatedPieceIds: PieceId[]
	updatedPieceInstanceIds: PieceInstanceId[]

	updatedAdlibPieceIds: PieceId[]
	updatedAdlibActionIds: AdLibActionId[]
	updatedBaselineAdlibPieceIds: PieceId[]
	updatedBaselineAdlibActionIds: RundownBaselineAdLibActionId[]
}

type RundownPlaylistFields = '_id' | 'studioId'
const rundownPlaylistFieldSpecifier = literal<IncludeAllMongoFieldSpecifier<RundownPlaylistFields>>({
	_id: 1,
	studioId: 1,
})

async function setupUIPieceContentStatusesPublicationObservers(
	args: ReadonlyDeep<UIPieceContentStatusesArgs>,
	triggerUpdate: TriggerUpdate<UIPieceContentStatusesUpdateProps>
): Promise<LiveQueryHandle[]> {
	const trackMediaObjectChange = (mediaId: string): Partial<UIPieceContentStatusesUpdateProps> => ({
		invalidateMediaObjectMediaId: [mediaId],
	})
	const trackPackageInfoChange = (id: ExpectedPackageId): Partial<UIPieceContentStatusesUpdateProps> => ({
		invalidateExpectedPackageId: [id],
	})
	const trackPackageContainerPackageStatusChange = (
		id: PackageContainerPackageId
	): Partial<UIPieceContentStatusesUpdateProps> => ({
		invalidatePackageContainerPackageStatusesId: [id],
	})

	const playlist = (await RundownPlaylists.findOneAsync(args.rundownPlaylistId, {
		projection: rundownPlaylistFieldSpecifier,
	})) as Pick<RundownPlaylist, RundownPlaylistFields> | undefined
	if (!playlist) throw new Error(`RundownPlaylist "${args.rundownPlaylistId}" not found!`)

	const rundownsObserver = new RundownsObserver(playlist.studioId, playlist._id, (rundownIds) => {
		logger.silly(`Creating new RundownContentObserver`)
		const obs1 = new RundownContentObserver(rundownIds, (cache) => {
			// Push update
			triggerUpdate({ newCache: cache })

			const innerQueries = [
				cache.Segments.find({}).observeChanges({
					added: (id) => triggerUpdate({ updatedSegmentIds: [protectString(id)] }),
					changed: (id) => triggerUpdate({ updatedSegmentIds: [protectString(id)] }),
					removed: (id) => triggerUpdate({ updatedSegmentIds: [protectString(id)] }),
				}),
				cache.Parts.find({}).observeChanges({
					added: (id) => triggerUpdate({ updatedPartIds: [protectString(id)] }),
					changed: (id) => triggerUpdate({ updatedPartIds: [protectString(id)] }),
					removed: (id) => triggerUpdate({ updatedSegmentIds: [protectString(id)] }),
				}),
				cache.Pieces.find({}).observeChanges({
					added: (id) => triggerUpdate({ updatedPieceIds: [protectString(id)] }),
					changed: (id) => triggerUpdate({ updatedPieceIds: [protectString(id)] }),
					removed: (id) => triggerUpdate({ updatedPieceIds: [protectString(id)] }),
				}),
				cache.PieceInstances.find({}).observeChanges({
					added: (id) => triggerUpdate({ updatedPieceInstanceIds: [protectString(id)] }),
					changed: (id) => triggerUpdate({ updatedPieceInstanceIds: [protectString(id)] }),
					removed: (id) => triggerUpdate({ updatedPieceInstanceIds: [protectString(id)] }),
				}),
				cache.AdLibPieces.find({}).observeChanges({
					added: (id) => triggerUpdate({ updatedAdlibPieceIds: [protectString(id)] }),
					changed: (id) => triggerUpdate({ updatedAdlibPieceIds: [protectString(id)] }),
					removed: (id) => triggerUpdate({ updatedAdlibPieceIds: [protectString(id)] }),
				}),
				cache.AdLibActions.find({}).observeChanges({
					added: (id) => triggerUpdate({ updatedAdlibActionIds: [protectString(id)] }),
					changed: (id) => triggerUpdate({ updatedAdlibActionIds: [protectString(id)] }),
					removed: (id) => triggerUpdate({ updatedAdlibActionIds: [protectString(id)] }),
				}),
				cache.BaselineAdLibPieces.find({}).observeChanges({
					added: (id) => triggerUpdate({ updatedBaselineAdlibPieceIds: [protectString(id)] }),
					changed: (id) => triggerUpdate({ updatedBaselineAdlibPieceIds: [protectString(id)] }),
					removed: (id) => triggerUpdate({ updatedBaselineAdlibPieceIds: [protectString(id)] }),
				}),
				cache.BaselineAdLibActions.find({}).observeChanges({
					added: (id) => triggerUpdate({ updatedBaselineAdlibActionIds: [protectString(id)] }),
					changed: (id) => triggerUpdate({ updatedBaselineAdlibActionIds: [protectString(id)] }),
					removed: (id) => triggerUpdate({ updatedBaselineAdlibActionIds: [protectString(id)] }),
				}),
				cache.Rundowns.find({}).observeChanges({
					added: () => triggerUpdate({ invalidateAll: true }),
					changed: () => triggerUpdate({ invalidateAll: true }),
					removed: () => triggerUpdate({ invalidateAll: true }),
				}),
				cache.ShowStyleSourceLayers.find({}).observeChanges({
					added: () => triggerUpdate({ invalidateAll: true }),
					changed: () => triggerUpdate({ invalidateAll: true }),
					removed: () => triggerUpdate({ invalidateAll: true }),
				}),
			]

			return () => {
				for (const query of innerQueries) {
					query.stop()
				}
			}
		})

		return () => {
			obs1.dispose()
		}
	})

	// Set up observers:
	return [
		rundownsObserver,

		Studios.observeChanges(
			{ _id: playlist.studioId },
			{
				added: (id) => triggerUpdate({ invalidateStudio: id }),
				changed: (id) => triggerUpdate({ invalidateStudio: id }),
				removed: (id) => triggerUpdate({ invalidateStudio: id }),
			},
			{ projection: studioFieldSpecifier }
		),

		// Watch for affecting objects
		MediaObjects.observe(
			{ studioId: playlist.studioId },
			{
				added: (obj) => triggerUpdate(trackMediaObjectChange(obj.mediaId)),
				changed: (obj) => triggerUpdate(trackMediaObjectChange(obj.mediaId)),
				removed: (obj) => triggerUpdate(trackMediaObjectChange(obj.mediaId)),
			}
		),
		PackageInfos.observe(
			{
				studioId: playlist.studioId,
				type: {
					$in: [PackageInfo.Type.SCAN, PackageInfo.Type.DEEPSCAN],
				},
			},
			{
				added: (obj) => triggerUpdate(trackPackageInfoChange(obj.packageId)),
				changed: (obj) => triggerUpdate(trackPackageInfoChange(obj.packageId)),
				removed: (obj) => triggerUpdate(trackPackageInfoChange(obj.packageId)),
			}
		),
		PackageContainerPackageStatuses.observeChanges(
			{ studioId: playlist.studioId },
			{
				added: (id) => triggerUpdate(trackPackageContainerPackageStatusChange(id)),
				changed: (id) => triggerUpdate(trackPackageContainerPackageStatusChange(id)),
				removed: (id) => triggerUpdate(trackPackageContainerPackageStatusChange(id)),
			}
		),
	]
}

async function manipulateUIPieceContentStatusesPublicationData(
	_args: UIPieceContentStatusesArgs,
	state: Partial<UIPieceContentStatusesState>,
	collection: CustomPublishCollection<UIPieceContentStatus>,
	updateProps: Partial<ReadonlyDeep<UIPieceContentStatusesUpdateProps>> | undefined
): Promise<void> {
	// Prepare data for publication:

	// Ensure the cached studio/showstyle id are updated
	const invalidateAllStatuses =
		!updateProps || updateProps.newCache || updateProps.invalidateStudio || updateProps.invalidateAll

	if (invalidateAllStatuses) {
		// Everything is invalid, reset everything
		delete state.pieceDependencies
		delete state.pieceInstanceDependencies
		delete state.adlibPieceDependencies
		delete state.adlibActionDependencies
		delete state.baselineAdlibDependencies
		delete state.baselineActionDependencies

		collection.remove(null)
	}

	if (updateProps?.invalidateStudio) {
		state.studio = await fetchStudio(updateProps.invalidateStudio)
	}

	if (updateProps?.newCache !== undefined) {
		state.contentCache = updateProps.newCache
	}

	// If there is no studio, then none of the objects should have been found, so delete anything that is known
	if (!state.studio || !state.contentCache) {
		delete state.pieceDependencies
		delete state.pieceInstanceDependencies
		delete state.adlibPieceDependencies
		delete state.adlibActionDependencies
		delete state.baselineAdlibDependencies
		delete state.baselineActionDependencies

		// None are valid anymore
		collection.remove(null)

		return
	}

	// Apply some final updates that don't require re-running the inner checks
	updatePartAndSegmentInfoForExistingDocs(
		state.contentCache,
		collection,
		new Set(updateProps?.updatedSegmentIds),
		new Set(updateProps?.updatedPartIds)
	)

	let regeneratePieceIds: Set<PieceId>
	let regeneratePieceInstanceIds: Set<PieceInstanceId>
	let regenerateAdlibPieceIds: Set<PieceId>
	let regenerateAdlibActionIds: Set<AdLibActionId>
	let regenerateBaselineAdlibPieceIds: Set<PieceId>
	let regenerateBaselineAdlibActionIds: Set<RundownBaselineAdLibActionId>
	if (
		!state.pieceDependencies ||
		!state.pieceInstanceDependencies ||
		!state.adlibPieceDependencies ||
		!state.adlibActionDependencies ||
		!state.baselineAdlibDependencies ||
		!state.baselineActionDependencies ||
		invalidateAllStatuses
	) {
		state.pieceDependencies = new Map()
		state.pieceInstanceDependencies = new Map()
		state.adlibPieceDependencies = new Map()
		state.adlibActionDependencies = new Map()
		state.baselineAdlibDependencies = new Map()
		state.baselineActionDependencies = new Map()

		// force every piece to be regenerated
		collection.remove(null)
		regeneratePieceIds = new Set(state.contentCache.Pieces.find({}).map((p) => p._id))
		regeneratePieceInstanceIds = new Set(state.contentCache.PieceInstances.find({}).map((p) => p._id))
		regenerateAdlibPieceIds = new Set(state.contentCache.AdLibPieces.find({}).map((p) => p._id))
		regenerateAdlibActionIds = new Set(state.contentCache.AdLibActions.find({}).map((p) => p._id))
		regenerateBaselineAdlibPieceIds = new Set(state.contentCache.BaselineAdLibPieces.find({}).map((p) => p._id))
		regenerateBaselineAdlibActionIds = new Set(state.contentCache.BaselineAdLibActions.find({}).map((p) => p._id))
	} else {
		regeneratePieceIds = new Set(updateProps.updatedPieceIds)
		regeneratePieceInstanceIds = new Set(updateProps.updatedPieceInstanceIds)
		regenerateAdlibPieceIds = new Set(updateProps.updatedAdlibPieceIds)
		regenerateAdlibActionIds = new Set(updateProps.updatedAdlibActionIds)
		regenerateBaselineAdlibPieceIds = new Set(updateProps.updatedBaselineAdlibPieceIds)
		regenerateBaselineAdlibActionIds = new Set(updateProps.updatedBaselineAdlibActionIds)

		// Look for which docs should be updated based on the media objects/packages
		addItemsWithDependenciesChangesToChangedSet<PieceId>(updateProps, regeneratePieceIds, state.pieceDependencies)
		addItemsWithDependenciesChangesToChangedSet<PieceInstanceId>(
			updateProps,
			regeneratePieceInstanceIds,
			state.pieceInstanceDependencies
		)
		addItemsWithDependenciesChangesToChangedSet<PieceId>(
			updateProps,
			regenerateAdlibPieceIds,
			state.adlibPieceDependencies
		)
		addItemsWithDependenciesChangesToChangedSet<AdLibActionId>(
			updateProps,
			regenerateAdlibActionIds,
			state.adlibActionDependencies
		)
		addItemsWithDependenciesChangesToChangedSet<PieceId>(
			updateProps,
			regenerateBaselineAdlibPieceIds,
			state.baselineAdlibDependencies
		)
		addItemsWithDependenciesChangesToChangedSet<RundownBaselineAdLibActionId>(
			updateProps,
			regenerateBaselineAdlibActionIds,
			state.baselineActionDependencies
		)
	}

	await regenerateForPieceIds(
		state.contentCache,
		state.studio,
		state.pieceDependencies,
		collection,
		regeneratePieceIds
	)
	await regenerateForPieceInstanceIds(
		state.contentCache,
		state.studio,
		state.pieceInstanceDependencies,
		collection,
		regeneratePieceInstanceIds
	)
	await regenerateForAdLibPieceIds(
		state.contentCache,
		state.studio,
		state.adlibPieceDependencies,
		collection,
		regenerateAdlibPieceIds
	)
	await regenerateForAdLibActionIds(
		state.contentCache,
		state.studio,
		state.adlibActionDependencies,
		collection,
		regenerateAdlibActionIds
	)
	await regenerateForBaselineAdLibPieceIds(
		state.contentCache,
		state.studio,
		state.baselineAdlibDependencies,
		collection,
		regenerateBaselineAdlibPieceIds
	)
	await regenerateForBaselineAdLibActionIds(
		state.contentCache,
		state.studio,
		state.baselineActionDependencies,
		collection,
		regenerateBaselineAdlibActionIds
	)
}

/**
 * To avoid regenerating every piece whenever its segment or part changes, we can selectively apply the relevant updates.
 * Regenerating a piece is costly as it requires querying the database
 */
function updatePartAndSegmentInfoForExistingDocs(
	contentCache: ReadonlyDeep<ContentCache>,
	collection: CustomPublishCollection<UIPieceContentStatus>,
	updatedSegmentIds: Set<SegmentId>,
	updatedPartIds: Set<PartId>
) {
	collection.updateAll((doc) => {
		let changed = false

		// If the part for this doc changed, update its part.
		// Note: if the segment of the doc's part changes that will only be noticed here
		if (doc.partId && updatedPartIds.has(doc.partId)) {
			const part = contentCache.Parts.findOne(doc.partId)
			if (part && (part.segmentId !== doc.segmentId || part._rank !== doc.partRank)) {
				doc.segmentId = part.segmentId
				doc.partRank = part._rank
				changed = true
			}
		}

		// If the segment for this doc changed, update its rank
		if (doc.segmentId && updatedSegmentIds.has(doc.segmentId)) {
			const segment = contentCache.Segments.findOne(doc.segmentId)
			if (segment && (doc.segmentRank !== segment._rank || doc.segmentName !== segment.name)) {
				doc.segmentRank = segment._rank
				doc.segmentName = segment.name
				changed = true
			}
		}

		return changed ? doc : false
	})
}

meteorCustomPublish(
	PubSub.uiPieceContentStatuses,
	CustomCollectionName.UIPieceContentStatuses,
	async function (pub, rundownPlaylistId: RundownPlaylistId | null) {
		check(rundownPlaylistId, Match.Maybe(String))

		const cred = await resolveCredentials({ userId: this.userId, token: undefined })

		if (
			rundownPlaylistId &&
			(!cred ||
				NoSecurityReadAccess.any() ||
				(await RundownPlaylistReadAccess.rundownPlaylistContent(rundownPlaylistId, cred)))
		) {
			await setUpCollectionOptimizedObserver<
				UIPieceContentStatus,
				UIPieceContentStatusesArgs,
				UIPieceContentStatusesState,
				UIPieceContentStatusesUpdateProps
			>(
				`pub_${PubSub.uiPieceContentStatuses}_${rundownPlaylistId}`,
				{ rundownPlaylistId },
				setupUIPieceContentStatusesPublicationObservers,
				manipulateUIPieceContentStatusesPublicationData,
				pub,
				100
			)
		} else {
			logger.warn(`Pub.${CustomCollectionName.UIPieceContentStatuses}: Not allowed: "${rundownPlaylistId}"`)
		}
	}
)
