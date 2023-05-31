import { PackageInfo } from '@sofie-automation/blueprints-integration'
import {
	ExpectedPackageId,
	PackageContainerPackageId,
	PartId,
	PieceId,
	RundownPlaylistId,
	SegmentId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
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
import { ContentCache, PieceFields } from './reactiveContentCache'
import { RundownContentObserver } from './rundownContentObserver'
import { RundownsObserver } from '../../lib/rundownsObserver'
import { LiveQueryHandle } from '../../../lib/lib'
import {
	addItemsWithDependenciesChangesToChangedSet,
	fetchStudio,
	IContentStatusesUpdatePropsBase,
	PieceDependencies,
	studioFieldSpecifier,
	StudioMini,
} from '../common'
import { regenerateForPieceIds } from './regenerateItems'

interface UIPieceContentStatusesArgs {
	readonly rundownPlaylistId: RundownPlaylistId
}

interface UIPieceContentStatusesState {
	contentCache: ReadonlyDeep<ContentCache>

	studio: ReadonlyDeep<StudioMini>

	pieceDependencies: Map<PieceId, PieceDependencies>
	// TODO:
	// pieceInstance?
	// adlibPiece
	// adlibAction
	// baselineAdlibPiece
	// baselineAdlibAction
}

interface UIPieceContentStatusesUpdateProps extends IContentStatusesUpdatePropsBase {
	newCache: ContentCache

	updatedSegmentIds: SegmentId[]

	updatedPartIds: PartId[]

	updatedPieceIds: PieceId[]
	removedPieces: Pick<Piece, PieceFields>[]
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
				cache.Pieces.find({}).observe({
					added: (doc) => triggerUpdate({ updatedPieceIds: [doc._id] }),
					changed: (doc) => triggerUpdate({ updatedPieceIds: [doc._id] }),
					removed: (doc) => triggerUpdate({ removedPieces: [doc] }),
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
	const invalidateAllPieces =
		!updateProps || updateProps.newCache || updateProps.invalidateStudio || updateProps.invalidateAll

	if (invalidateAllPieces) {
		// Everything is invalid, reset everything
		delete state.pieceDependencies
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
	if (!state.pieceDependencies || invalidateAllPieces) {
		state.pieceDependencies = new Map()

		// force every piece to be regenerated
		collection.remove(null)
		regeneratePieceIds = new Set(state.contentCache.Pieces.find({}).map((p) => p._id))
	} else {
		regeneratePieceIds = new Set(updateProps.updatedPieceIds)
		// Remove any docs where the piece has been deleted
		if (updateProps.removedPieces && updateProps.removedPieces.length > 0) {
			const removePieceIds = new Set(updateProps.removedPieces.map((p) => p._id))
			collection.remove((doc) => removePieceIds.has(doc.pieceId))
		}

		// Look for which docs should be updated based on the media objects/packages
		addItemsWithDependenciesChangesToChangedSet<PieceId>(updateProps, regeneratePieceIds, state.pieceDependencies)
	}

	await regenerateForPieceIds(
		state.contentCache,
		state.studio,
		state.pieceDependencies,
		collection,
		regeneratePieceIds
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
		if (updatedPartIds.has(doc.partId)) {
			const part = contentCache.Parts.findOne(doc.partId)
			if (part && (part.segmentId !== doc.segmentId || part._rank !== doc.partRank)) {
				doc.segmentId = part.segmentId
				doc.partRank = part._rank
				changed = true
			}
		}

		// If the segment for this doc changed, update its rank
		if (updatedSegmentIds.has(doc.segmentId)) {
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
