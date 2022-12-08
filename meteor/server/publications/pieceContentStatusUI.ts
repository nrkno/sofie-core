import { ISourceLayer, PackageInfo } from '@sofie-automation/blueprints-integration'
import {
	ExpectedPackageId,
	PackageContainerPackageId,
	PartId,
	PieceId,
	RundownId,
	SegmentId,
	ShowStyleBaseId,
	StudioId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { getPackageContainerPackageId } from '@sofie-automation/corelib/dist/dataModel/PackageContainerPackageStatus'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { SourceLayers } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { IncludeAllMongoFieldSpecifier } from '@sofie-automation/corelib/dist/mongo'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { ReadonlyDeep } from 'type-fest'
import { CustomCollectionName, PubSub } from '../../lib/api/pubsub'
import { UIPieceContentStatus } from '../../lib/api/rundownNotifications'
import { UIStudio } from '../../lib/api/studios'
import { MediaObjects } from '../../lib/collections/MediaObjects'
import { PackageContainerPackageStatuses } from '../../lib/collections/PackageContainerPackageStatus'
import { PackageInfos } from '../../lib/collections/PackageInfos'
import { DBPart, Parts } from '../../lib/collections/Parts'
import { Pieces } from '../../lib/collections/Pieces'
import { Rundown, Rundowns } from '../../lib/collections/Rundowns'
import { DBSegment, Segments } from '../../lib/collections/Segments'
import { ShowStyleBase, ShowStyleBases } from '../../lib/collections/ShowStyleBases'
import { Studio, Studios } from '../../lib/collections/Studios'
import { clone, literal, protectString, waitForPromise } from '../../lib/lib'
import { checkPieceContentStatus, PieceContentStatusObj } from '../../lib/mediaObjects'
import {
	CustomPublishCollection,
	meteorCustomPublish,
	ReactiveMongoObserverGroup,
	setUpCollectionOptimizedObserver,
	TriggerUpdate,
} from '../lib/customPublication'
import { LiveQueryHandle } from '../lib/customPublication/optimizedObserverBase'
import { updateGenericCache } from '../lib/customPublication/updateHelper'
import { logger } from '../logging'
import { resolveCredentials } from '../security/lib/credentials'
import { NoSecurityReadAccess } from '../security/noSecurity'
import { RundownReadAccess } from '../security/rundown'

interface UIPieceContentStatusesArgs {
	readonly rundownId: RundownId
}

interface UIPieceContentStatusesState {
	showStyleBaseId: ShowStyleBaseId
	studioId: StudioId

	sourceLayers: SourceLayers
	uiStudio: Pick<UIStudio, '_id' | 'settings' | 'packageContainers' | 'mappings' | 'routeSets'>

	segmentCache: Map<SegmentId, Pick<DBSegment, SegmentFields>>
	partsCache: Map<PartId, Pick<DBPart, PartFields>>
	piecesCache: Map<PieceId, Pick<Piece, PieceFields>>

	pieceDependencies: Map<PieceId, PieceDependencies>
}

interface UIPieceContentStatusesUpdateProps {
	invalidateSourceLayers: boolean
	invalidateStudio: boolean
	invalidateRundown: boolean
	invalidateSegmentIds: SegmentId[]
	invalidatePartIds: PartId[]
	invalidatePieceIds: PieceId[]

	invalidateMediaObjectMediaId: string[]
	invalidateExpectedPackageId: ExpectedPackageId[]
	invalidatePackageContainerPackageStatusesId: PackageContainerPackageId[]
}

type RundownFields = '_id' | 'showStyleBaseId' | 'studioId'
const rundownFieldSpecifier = literal<IncludeAllMongoFieldSpecifier<RundownFields>>({
	_id: 1,
	showStyleBaseId: 1,
	studioId: 1,
})

type ShowStyleBaseFields = '_id' | 'sourceLayersWithOverrides'
const showStyleBaseFieldSpecifier = literal<IncludeAllMongoFieldSpecifier<ShowStyleBaseFields>>({
	_id: 1,
	sourceLayersWithOverrides: 1,
})

type StudioFields = '_id' | 'settings' | 'packageContainers' | 'mappingsWithOverrides' | 'routeSets'
const studioFieldSpecifier = literal<IncludeAllMongoFieldSpecifier<StudioFields>>({
	_id: 1,
	settings: 1,
	packageContainers: 1,
	mappingsWithOverrides: 1,
	routeSets: 1,
})

type SegmentFields = '_id' | '_rank' | 'name'
const segmentFieldSpecifier = literal<IncludeAllMongoFieldSpecifier<SegmentFields>>({
	_id: 1,
	_rank: 1,
	name: 1,
})

type PartFields = '_id' | '_rank' | 'segmentId' | 'rundownId'
const partFieldSpecifier = literal<IncludeAllMongoFieldSpecifier<PartFields>>({
	_id: 1,
	_rank: 1,
	segmentId: 1,
	rundownId: 1,
})

type PieceFields = '_id' | 'startPartId' | 'name' | 'sourceLayerId' | 'content' | 'expectedPackages'
const pieceFieldSpecifier = literal<IncludeAllMongoFieldSpecifier<PieceFields>>({
	_id: 1,
	startPartId: 1,
	name: 1,
	sourceLayerId: 1,
	content: 1,
	expectedPackages: 1,
})

async function setupUIPieceContentStatusesPublicationObservers(
	args: ReadonlyDeep<UIPieceContentStatusesArgs>,
	triggerUpdate: TriggerUpdate<UIPieceContentStatusesUpdateProps>
): Promise<LiveQueryHandle[]> {
	const trackSegmentChange = (id: SegmentId): Partial<UIPieceContentStatusesUpdateProps> => ({
		invalidateSegmentIds: [id],
	})
	const trackPartChange = (id: PartId): Partial<UIPieceContentStatusesUpdateProps> => ({
		invalidatePartIds: [id],
	})
	const trackPieceChange = (id: PieceId): Partial<UIPieceContentStatusesUpdateProps> => ({
		invalidatePieceIds: [id],
	})
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

	// Second level of reactivity
	const rundownContentsObserver = await ReactiveMongoObserverGroup(async () => {
		const rundown = (await Rundowns.findOneAsync(args.rundownId, { projection: rundownFieldSpecifier })) as
			| Pick<Rundown, RundownFields>
			| undefined

		if (rundown) {
			return [
				ShowStyleBases.find(rundown.showStyleBaseId, { fields: showStyleBaseFieldSpecifier }).observeChanges({
					added: () => triggerUpdate({ invalidateSourceLayers: true }),
					changed: () => triggerUpdate({ invalidateSourceLayers: true }),
					removed: () => triggerUpdate({ invalidateSourceLayers: true }),
				}),
				Studios.find(rundown.studioId, { fields: studioFieldSpecifier }).observeChanges({
					added: () => triggerUpdate({ invalidateStudio: true }),
					changed: () => triggerUpdate({ invalidateStudio: true }),
					removed: () => triggerUpdate({ invalidateStudio: true }),
				}),

				// Watch for affecting objects
				MediaObjects.find({ studioId: rundown.studioId }).observe({
					added: (obj) => triggerUpdate(trackMediaObjectChange(obj.mediaId)),
					changed: (obj) => triggerUpdate(trackMediaObjectChange(obj.mediaId)),
					removed: (obj) => triggerUpdate(trackMediaObjectChange(obj.mediaId)),
				}),
				PackageInfos.find({
					studioId: rundown.studioId,
					type: {
						$in: [PackageInfo.Type.SCAN, PackageInfo.Type.DEEPSCAN],
					},
				}).observe({
					added: (obj) => triggerUpdate(trackPackageInfoChange(obj.packageId)),
					changed: (obj) => triggerUpdate(trackPackageInfoChange(obj.packageId)),
					removed: (obj) => triggerUpdate(trackPackageInfoChange(obj.packageId)),
				}),
				PackageContainerPackageStatuses.find({ studioId: rundown.studioId }).observeChanges({
					added: (id) => triggerUpdate(trackPackageContainerPackageStatusChange(id)),
					changed: (id) => triggerUpdate(trackPackageContainerPackageStatusChange(id)),
					removed: (id) => triggerUpdate(trackPackageContainerPackageStatusChange(id)),
				}),
			]
		} else {
			// Ensure cached data is cleared
			triggerUpdate({ invalidateSourceLayers: true })
			triggerUpdate({ invalidateStudio: true })

			return []
		}
	})

	// Set up observers:
	return [
		Rundowns.find({ _id: args.rundownId }, { fields: rundownFieldSpecifier }).observeChanges({
			added: () => {
				waitForPromise(rundownContentsObserver.restart())
				// triggerUpdate(trackRundownChange(id))
				triggerUpdate({ invalidateRundown: true })
			},
			changed: () => {
				waitForPromise(rundownContentsObserver.restart())
				// triggerUpdate(trackRundownChange(id))
				triggerUpdate({ invalidateRundown: true })
			},
			removed: () => {
				waitForPromise(rundownContentsObserver.restart())
				// triggerUpdate(trackRundownChange(id))
				triggerUpdate({ invalidateRundown: true })
			},
		}),

		rundownContentsObserver,

		// Watch rundown contents
		Segments.find({ rundownId: args.rundownId }, { fields: segmentFieldSpecifier }).observeChanges({
			added: (id) => triggerUpdate(trackSegmentChange(id)),
			changed: (id) => triggerUpdate(trackSegmentChange(id)),
			removed: (id) => triggerUpdate(trackSegmentChange(id)),
		}),
		Parts.find({ rundownId: args.rundownId }, { fields: partFieldSpecifier }).observeChanges({
			added: (id) => triggerUpdate(trackPartChange(id)),
			changed: (id) => triggerUpdate(trackPartChange(id)),
			removed: (id) => triggerUpdate(trackPartChange(id)),
		}),
		Pieces.find({ startRundownId: args.rundownId }, { fields: pieceFieldSpecifier }).observeChanges({
			added: (id) => triggerUpdate(trackPieceChange(id)),
			changed: (id) => triggerUpdate(trackPieceChange(id)),
			removed: (id) => triggerUpdate(trackPieceChange(id)),
		}),
	]
}

async function manipulateUIPieceContentStatusesPublicationData(
	args: UIPieceContentStatusesArgs,
	state: Partial<UIPieceContentStatusesState>,
	collection: CustomPublishCollection<UIPieceContentStatus>,
	updateProps: Partial<ReadonlyDeep<UIPieceContentStatusesUpdateProps>> | undefined
): Promise<void> {
	// Prepare data for publication:

	const studioIdBefore = state.studioId

	// Ensure the cached studio/showstyle id are updated
	const updateIds = !updateProps || updateProps.invalidateRundown
	if (updateIds) {
		const newIds = await updateIdsFromRundown(args)
		if (newIds) {
			state.showStyleBaseId = newIds[0]
			state.studioId = newIds[1]
		} else {
			state.showStyleBaseId = undefined
			state.studioId = undefined
		}
	}

	if (studioIdBefore !== state.studioId) {
		// All of the media references are valid, so clear everything that is cached
		delete state.pieceDependencies
		collection.remove(null)
	}

	// Ensure the sourcelayers and studio are updated
	state.sourceLayers = await updateSourceLayers(
		state.showStyleBaseId,
		state.sourceLayers,
		updateIds || updateProps.invalidateSourceLayers
	)
	state.uiStudio = await updateStudio(state.studioId, state.uiStudio, updateIds || updateProps.invalidateStudio)

	// Update the Parts and Segments caches
	const [segmentUpdates, partsUpdates, piecesUpdates] = await Promise.all([
		updateGenericCache(
			Segments,
			state.segmentCache,
			{ rundownId: args.rundownId },
			segmentFieldSpecifier,
			clone<SegmentId[] | undefined>(updateProps?.invalidateSegmentIds)
		),
		updateGenericCache(
			Parts,
			state.partsCache,
			{ rundownId: args.rundownId },
			segmentFieldSpecifier,
			clone<PartId[] | undefined>(updateProps?.invalidatePartIds)
		),
		updateGenericCache(
			Pieces,
			state.piecesCache,
			{ rundownId: args.rundownId },
			segmentFieldSpecifier,
			clone<PieceId[] | undefined>(updateProps?.invalidatePieceIds)
		),
	])
	state.segmentCache = segmentUpdates.newCache
	state.partsCache = partsUpdates.newCache
	state.piecesCache = piecesUpdates.newCache

	// Apply some final updates that don't require re-running the inner checks
	updatePartAndSegmentInfoForExistingDocs(
		state.partsCache,
		state.segmentCache,
		collection,
		new Set(segmentUpdates.changedDocIds),
		new Set(partsUpdates.changedDocIds)
	)

	// If there is no studio, then none of the objects should have been found, so delete anything that is known
	if (!state.uiStudio || !state.sourceLayers) {
		delete state.pieceDependencies

		// None are valid anymore
		collection.remove(null)

		return
	}

	let regeneratePieceIds = new Set([...piecesUpdates.changedDocIds, ...piecesUpdates.addedDocIds])
	if (!state.pieceDependencies) {
		state.pieceDependencies = new Map()

		// force every piece to be regenerated
		collection.remove(null)
		regeneratePieceIds = new Set(state.piecesCache.keys())
	} else {
		// Remove any docs where the piece has been deleted
		if (piecesUpdates.removedDocIds.length > 0) {
			const removePieceIds = new Set(piecesUpdates.removedDocIds)
			collection.remove((doc) => removePieceIds.has(doc.pieceId))
		}

		// Look for which docs should be updated based on the media objects/packages
		addPiecesWithDependenciesChangesToChangedSet(updateProps, regeneratePieceIds, state.pieceDependencies)
	}

	regenerateForPieceIds(
		args.rundownId,
		{
			partsCache: state.partsCache,
			piecesCache: state.piecesCache,
			segmentCache: state.segmentCache,
			sourceLayers: state.sourceLayers,
			uiStudio: state.uiStudio,
			pieceDependencies: state.pieceDependencies,
		},
		collection,
		regeneratePieceIds
	)
}

function addPiecesWithDependenciesChangesToChangedSet(
	updateProps: Partial<ReadonlyDeep<UIPieceContentStatusesUpdateProps>> | undefined,
	regeneratePieceIds: Set<PieceId>,
	pieceDependenciesMap: UIPieceContentStatusesState['pieceDependencies']
) {
	if (
		updateProps &&
		(updateProps.invalidateExpectedPackageId?.length ||
			updateProps.invalidateMediaObjectMediaId?.length ||
			updateProps.invalidatePackageContainerPackageStatusesId?.length)
	) {
		const changedMediaObjects = new Set(updateProps.invalidateMediaObjectMediaId)
		const changedExpectedPackages = new Set(updateProps.invalidateExpectedPackageId)
		const changedPackageContainerPackages = new Set(updateProps.invalidatePackageContainerPackageStatusesId)

		for (const [pieceId, pieceDependencies] of pieceDependenciesMap.entries()) {
			if (regeneratePieceIds.has(pieceId)) continue // skip if we already know the piece has changed

			const pieceChanged =
				pieceDependencies.mediaObjects.find((mediaId) => changedMediaObjects.has(mediaId)) ||
				pieceDependencies.packageInfos.find((pkgId) => changedExpectedPackages.has(pkgId)) ||
				pieceDependencies.packageContainerPackageStatuses.find((pkgId) =>
					changedPackageContainerPackages.has(pkgId)
				)

			if (pieceChanged) regeneratePieceIds.add(pieceId)
		}
	}
}

function updatePartAndSegmentInfoForExistingDocs(
	partsCache: UIPieceContentStatusesState['partsCache'],
	segmentCache: UIPieceContentStatusesState['segmentCache'],
	collection: CustomPublishCollection<UIPieceContentStatus>,
	updatedSegmentIds: Set<SegmentId>,
	updatedPartIds: Set<PartId>
) {
	collection.updateAll((doc) => {
		let changed = false

		// If the part for this doc changed, update its part.
		// Note: if the segment of the doc's part changes that will only be noticed here
		if (updatedPartIds.has(doc.partId)) {
			const part = partsCache?.get(doc.partId)
			if (part && (part.segmentId !== doc.segmentId || part._rank !== doc.partRank)) {
				doc.segmentId = part.segmentId
				doc.partRank = part._rank
				changed = true
			}
		}

		// If the segment for this doc changed, update its rank
		if (updatedSegmentIds.has(doc.segmentId)) {
			const segment = segmentCache?.get(doc.segmentId)
			if (segment && (doc.segmentRank !== segment._rank || doc.segmentName !== segment.name)) {
				doc.segmentRank = segment._rank
				doc.segmentName = segment.name
				changed = true
			}
		}

		return changed ? doc : false
	})
}

function regenerateForPieceIds(
	rundownId: RundownId,
	state: Pick<
		UIPieceContentStatusesState,
		'partsCache' | 'piecesCache' | 'segmentCache' | 'sourceLayers' | 'uiStudio' | 'pieceDependencies'
	>,
	collection: CustomPublishCollection<UIPieceContentStatus>,
	regeneratePieceIds: Set<PieceId>
) {
	const deletedPieceIds = new Set<PieceId>()

	// Apply the updates to the Pieces
	// TODO - limit concurrency. This causes updating this publication to be slower, be will help ensure that other tasks have a chance to execute in parallel.
	for (const pieceId of regeneratePieceIds) {
		state.pieceDependencies.delete(pieceId)

		const pieceDoc = state.piecesCache.get(pieceId)
		if (!pieceDoc) {
			// Piece has been deleted, queue it for batching
			deletedPieceIds.add(pieceId)
		} else {
			// Regenerate piece

			const part = state.partsCache.get(pieceDoc.startPartId)
			const segment = part ? state.segmentCache.get(part.segmentId) : undefined
			const sourceLayer = state.sourceLayers?.[pieceDoc.sourceLayerId]

			// Only if this piece is valid
			if (part && segment && sourceLayer) {
				const [status, pieceDependencies] = checkPieceContentStatusAndDependencies(
					state.uiStudio,
					pieceDoc,
					sourceLayer
				)

				state.pieceDependencies.set(pieceId, pieceDependencies)

				collection.replace({
					_id: protectString(`piece_${pieceId}`),

					segmentRank: segment._rank,
					partRank: part._rank,

					partId: pieceDoc.startPartId,
					rundownId: rundownId,
					segmentId: part.segmentId,
					pieceId: pieceId,

					name: pieceDoc.name,
					segmentName: segment.name,

					status: status,
				})
			}
		}
	}

	// Process any piece deletions
	collection.remove((doc) => deletedPieceIds.has(doc.pieceId))
}

function checkPieceContentStatusAndDependencies(
	uiStudio: UIPieceContentStatusesState['uiStudio'],
	pieceDoc: Pick<Piece, PieceFields>,
	sourceLayer: ISourceLayer
): [status: PieceContentStatusObj, pieceDependencies: PieceDependencies] {
	// Track the media documents that this Piece searched for, so we can invalidate it whenever one of these changes
	const pieceDependencies: PieceDependencies = {
		mediaObjects: [],
		packageInfos: [],
		packageContainerPackageStatuses: [],
	}

	const getMediaObject = (mediaId: string) => {
		pieceDependencies.mediaObjects.push(mediaId)
		return MediaObjects.findOne({
			studioId: uiStudio._id,
			mediaId,
		})
	}

	const getPackageInfos = (packageId: ExpectedPackageId) => {
		pieceDependencies.packageInfos.push(packageId)
		return PackageInfos.find({
			studioId: uiStudio._id,
			packageId: packageId,
			type: {
				$in: [PackageInfo.Type.SCAN, PackageInfo.Type.DEEPSCAN],
			},
		}).fetch()
	}

	const getPackageContainerPackageStatus2 = (packageContainerId: string, expectedPackageId: ExpectedPackageId) => {
		const id = getPackageContainerPackageId(uiStudio._id, packageContainerId, expectedPackageId)
		pieceDependencies.packageContainerPackageStatuses.push(id)
		return PackageContainerPackageStatuses.findOne({
			_id: id,
			studioId: uiStudio._id,
		})
	}

	const status = checkPieceContentStatus(
		pieceDoc,
		sourceLayer,
		uiStudio,
		getMediaObject,
		getPackageInfos,
		getPackageContainerPackageStatus2
	)

	return [status, pieceDependencies]
}

interface PieceDependencies {
	mediaObjects: string[]
	packageInfos: ExpectedPackageId[]
	packageContainerPackageStatuses: PackageContainerPackageId[]
}

async function updateIdsFromRundown(
	args: UIPieceContentStatusesArgs
): Promise<[ShowStyleBaseId, StudioId] | undefined> {
	const rundown = (await Rundowns.findOneAsync(args.rundownId, { projection: rundownFieldSpecifier })) as
		| Pick<Rundown, RundownFields>
		| undefined

	if (!rundown) {
		return undefined
	}

	return [rundown.showStyleBaseId, rundown.studioId]
}

async function updateSourceLayers(
	showStyleBaseId: ShowStyleBaseId | undefined,
	existingSourceLayers: UIPieceContentStatusesState['sourceLayers'] | undefined,
	invalidated: boolean | undefined
): Promise<UIPieceContentStatusesState['sourceLayers'] | undefined> {
	if (!showStyleBaseId) return undefined

	if (!existingSourceLayers || invalidated) {
		const showStyleBase = (await ShowStyleBases.findOneAsync(showStyleBaseId, {
			projection: showStyleBaseFieldSpecifier,
		})) as Pick<ShowStyleBase, ShowStyleBaseFields> | undefined

		if (!showStyleBase) {
			return {}
		}

		return applyAndValidateOverrides(showStyleBase.sourceLayersWithOverrides).obj
	}

	return existingSourceLayers
}

async function updateStudio(
	studioId: StudioId | undefined,
	existingStudio: UIPieceContentStatusesState['uiStudio'] | undefined,
	invalidated: boolean | undefined
): Promise<UIPieceContentStatusesState['uiStudio'] | undefined> {
	if (!studioId) return undefined

	if (!existingStudio || invalidated) {
		const studio = (await Studios.findOneAsync(studioId, {
			projection: studioFieldSpecifier,
		})) as Pick<Studio, StudioFields> | undefined

		if (!studio) {
			return undefined
		}

		return {
			_id: studio._id,
			settings: studio.settings,
			packageContainers: studio.packageContainers,
			mappings: applyAndValidateOverrides(studio.mappingsWithOverrides).obj,
			routeSets: studio.routeSets,
		}
	}

	return existingStudio
}

meteorCustomPublish(
	PubSub.uiPieceContentStatuses,
	CustomCollectionName.UIPieceContentStatuses,
	async function (pub, rundownId: RundownId | null) {
		const cred = await resolveCredentials({ userId: this.userId, token: undefined })

		if (
			rundownId &&
			(!cred || NoSecurityReadAccess.any() || (await RundownReadAccess.rundownContent(rundownId, cred)))
		) {
			await setUpCollectionOptimizedObserver<
				UIPieceContentStatus,
				UIPieceContentStatusesArgs,
				UIPieceContentStatusesState,
				UIPieceContentStatusesUpdateProps
			>(
				`pub_${PubSub.uiPieceContentStatuses}_${rundownId}`,
				{ rundownId },
				setupUIPieceContentStatusesPublicationObservers,
				manipulateUIPieceContentStatusesPublicationData,
				pub,
				100
			)
		} else {
			logger.warn(`Pub.${CustomCollectionName.UIPieceContentStatuses}: Not allowed: "${rundownId}"`)
		}
	}
)
