import {
	AdLibActionId,
	BlueprintId,
	PieceId,
	PieceInstanceId,
	RundownBaselineAdLibActionId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReadonlyDeep } from 'type-fest'
import { UIPieceContentStatus } from '../../../../lib/api/rundownNotifications'
import { literal, protectString } from '../../../../lib/lib'
import { CustomPublishCollection } from '../../../lib/customPublication'
import { ContentCache } from './reactiveContentCache'
import { wrapTranslatableMessageFromBlueprintsIfNotString } from '@sofie-automation/corelib/dist/TranslatableMessage'
import {
	checkPieceContentStatusAndDependencies,
	PieceContentStatusPiece,
	PieceContentStatusStudio,
} from '../checkPieceContentStatus'
import { PieceDependencies } from '../common'

async function regenerateGenericPiece(
	contentCache: ReadonlyDeep<ContentCache>,
	uiStudio: PieceContentStatusStudio,
	pieceDoc: PieceContentStatusPiece,
	sourceLayerId: string | undefined,
	doc: Pick<Required<UIPieceContentStatus>, '_id' | 'partId' | 'pieceId' | 'rundownId' | 'name'>
): Promise<{
	dependencies: PieceDependencies
	doc: UIPieceContentStatus
	blueprintId: BlueprintId
} | null> {
	// Regenerate piece
	const rundown = contentCache.Rundowns.findOne(doc.rundownId)
	const sourceLayersForRundown = rundown
		? contentCache.ShowStyleSourceLayers.findOne(rundown.showStyleBaseId)
		: undefined

	const part = doc.partId ? contentCache.Parts.findOne(doc.partId) : undefined
	const segment = part ? contentCache.Segments.findOne(part.segmentId) : undefined
	const sourceLayer = sourceLayerId && sourceLayersForRundown?.sourceLayers?.[sourceLayerId]

	if (part && segment && sourceLayer) {
		const [status, dependencies] = await checkPieceContentStatusAndDependencies(uiStudio, pieceDoc, sourceLayer)

		return {
			dependencies,
			blueprintId: sourceLayersForRundown.blueprintId,
			doc: {
				...doc,

				segmentId: segment._id,

				segmentRank: segment._rank,
				partRank: part._rank,

				segmentName: segment.name,
				name: wrapTranslatableMessageFromBlueprintsIfNotString(doc.name, [sourceLayersForRundown.blueprintId]),

				isPieceInstance: false,

				status,
			},
		}
	} else {
		return null
	}
}

/**
 * Regenerating the status for the provided PieceIds
 * Note: This will do many calls to the database
 */
export async function regenerateForPieceIds(
	contentCache: ReadonlyDeep<ContentCache>,
	uiStudio: PieceContentStatusStudio,
	dependenciesState: Map<PieceId, PieceDependencies>,
	collection: CustomPublishCollection<UIPieceContentStatus>,
	regeneratePieceIds: Set<PieceId>
): Promise<void> {
	const deletedPieceIds = new Set<PieceId>()

	// Apply the updates to the Pieces
	// Future: this could be done with some limited concurrency. It will need to balance performance of the updates and not interfering with other tasks
	for (const pieceId of regeneratePieceIds) {
		dependenciesState.delete(pieceId)

		const pieceDoc = contentCache.Pieces.findOne(pieceId)
		if (!pieceDoc) {
			// Piece has been deleted, queue it for batching
			deletedPieceIds.add(pieceId)
		} else {
			const res = await regenerateGenericPiece(contentCache, uiStudio, pieceDoc, pieceDoc.sourceLayerId, {
				_id: protectString(`piece_${pieceId}`),

				partId: pieceDoc.startPartId,
				rundownId: pieceDoc.startRundownId,
				pieceId: pieceId,

				name: pieceDoc.name,
			})

			if (res) {
				dependenciesState.set(pieceId, res.dependencies)

				collection.replace(res.doc)
			} else {
				deletedPieceIds.add(pieceId)
			}
		}
	}

	// Process any piece deletions
	collection.remove((doc) => deletedPieceIds.has(doc.pieceId as PieceId))
}

/**
 * Regenerating the status for the provided PieceIds
 * Note: This will do many calls to the database
 */
export async function regenerateForPieceInstanceIds(
	contentCache: ReadonlyDeep<ContentCache>,
	uiStudio: PieceContentStatusStudio,
	dependenciesState: Map<PieceInstanceId, PieceDependencies>,
	collection: CustomPublishCollection<UIPieceContentStatus>,
	regeneratePieceIds: Set<PieceInstanceId>
): Promise<void> {
	const deletedPieceIds = new Set<PieceInstanceId>()

	// Apply the updates to the Pieces
	// Future: this could be done with some limited concurrency. It will need to balance performance of the updates and not interfering with other tasks
	for (const pieceId of regeneratePieceIds) {
		dependenciesState.delete(pieceId)

		const pieceDoc = contentCache.PieceInstances.findOne(pieceId)
		if (!pieceDoc) {
			// Piece has been deleted, queue it for batching
			deletedPieceIds.add(pieceId)
		} else {
			// Regenerate piece
			const rundown = contentCache.Rundowns.findOne(pieceDoc.rundownId)
			const sourceLayersForRundown = rundown
				? contentCache.ShowStyleSourceLayers.findOne(rundown.showStyleBaseId)
				: undefined

			const partInstance = pieceDoc.partInstanceId
				? contentCache.PartInstances.findOne(pieceDoc.partInstanceId)
				: undefined
			const segment = partInstance ? contentCache.Segments.findOne(partInstance.segmentId) : undefined
			const sourceLayer =
				pieceDoc.piece.sourceLayerId && sourceLayersForRundown?.sourceLayers?.[pieceDoc.piece.sourceLayerId]

			if (partInstance && segment && sourceLayer) {
				const [status, dependencies] = await checkPieceContentStatusAndDependencies(
					uiStudio,
					{
						...pieceDoc.piece,
						pieceInstanceId: pieceDoc._id,
					},
					sourceLayer
				)

				const res: UIPieceContentStatus = {
					_id: protectString(`piece_${pieceId}`),

					partId: pieceDoc.piece.startPartId,
					rundownId: pieceDoc.rundownId,
					pieceId: pieceId,

					segmentId: segment._id,

					segmentRank: segment._rank,
					partRank: partInstance.part._rank,

					segmentName: segment.name,
					name: wrapTranslatableMessageFromBlueprintsIfNotString(pieceDoc.piece.name, [
						sourceLayersForRundown.blueprintId,
					]),

					isPieceInstance: true,

					status,
				}

				dependenciesState.set(pieceId, dependencies)

				collection.replace(res)
			} else {
				deletedPieceIds.add(pieceId)
			}
		}
	}

	// Process any piece deletions
	collection.remove((doc) => deletedPieceIds.has(doc.pieceId as PieceInstanceId))
}

/**
 * Regenerating the status for the provided PieceIds
 * Note: This will do many calls to the database
 */
export async function regenerateForAdLibPieceIds(
	contentCache: ReadonlyDeep<ContentCache>,
	uiStudio: PieceContentStatusStudio,
	dependenciesState: Map<PieceId, PieceDependencies>,
	collection: CustomPublishCollection<UIPieceContentStatus>,
	regenerateAdLibPieceIds: Set<PieceId>
): Promise<void> {
	const deletedPieceIds = new Set<PieceId>()

	// Apply the updates to the Pieces
	// Future: this could be done with some limited concurrency. It will need to balance performance of the updates and not interfering with other tasks
	for (const pieceId of regenerateAdLibPieceIds) {
		dependenciesState.delete(pieceId)

		const pieceDoc = contentCache.AdLibPieces.findOne(pieceId)
		if (!pieceDoc || !pieceDoc.partId) {
			// Piece has been deleted, queue it for batching
			deletedPieceIds.add(pieceId)
		} else {
			const res = await regenerateGenericPiece(contentCache, uiStudio, pieceDoc, pieceDoc.sourceLayerId, {
				_id: protectString(`adlib_${pieceId}`),

				partId: pieceDoc.partId,
				rundownId: pieceDoc.rundownId,
				pieceId: pieceId,

				name: pieceDoc.name,
			})

			if (res) {
				dependenciesState.set(pieceId, res.dependencies)

				collection.replace(res.doc)
			} else {
				deletedPieceIds.add(pieceId)
			}
		}
	}

	// Process any piece deletions
	collection.remove((doc) => deletedPieceIds.has(doc.pieceId as PieceId))
}

/**
 * Regenerating the status for the provided PieceIds
 * Note: This will do many calls to the database
 */
export async function regenerateForAdLibActionIds(
	contentCache: ReadonlyDeep<ContentCache>,
	uiStudio: PieceContentStatusStudio,
	dependenciesState: Map<AdLibActionId, PieceDependencies>,
	collection: CustomPublishCollection<UIPieceContentStatus>,
	regenerateActionIds: Set<AdLibActionId>
): Promise<void> {
	const deletedPieceIds = new Set<AdLibActionId>()

	// Apply the updates to the Pieces
	// Future: this could be done with some limited concurrency. It will need to balance performance of the updates and not interfering with other tasks
	for (const pieceId of regenerateActionIds) {
		dependenciesState.delete(pieceId)

		const actionDoc = contentCache.AdLibActions.findOne(pieceId)
		if (!actionDoc || !actionDoc.partId) {
			// Piece has been deleted, queue it for batching
			deletedPieceIds.add(pieceId)
		} else {
			const fakedPiece = literal<PieceContentStatusPiece>({
				_id: protectString(`${actionDoc._id}`),
				content: 'content' in actionDoc.display ? actionDoc.display.content : {},
				expectedPackages: actionDoc.expectedPackages,
			})

			const sourceLayerId = 'sourceLayerId' in actionDoc.display ? actionDoc.display.sourceLayerId : undefined

			const res = await regenerateGenericPiece(contentCache, uiStudio, fakedPiece, sourceLayerId, {
				_id: protectString(`action_${pieceId}`),

				partId: actionDoc.partId,
				rundownId: actionDoc.rundownId,
				pieceId: pieceId,

				name: actionDoc.display.label,
			})

			if (res) {
				dependenciesState.set(pieceId, res.dependencies)

				collection.replace(res.doc)
			} else {
				deletedPieceIds.add(pieceId)
			}
		}
	}

	// Process any piece deletions
	collection.remove((doc) => deletedPieceIds.has(doc.pieceId as AdLibActionId))
}

/**
 * Regenerating the status for the provided PieceIds
 * Note: This will do many calls to the database
 */
export async function regenerateForBaselineAdLibPieceIds(
	contentCache: ReadonlyDeep<ContentCache>,
	uiStudio: PieceContentStatusStudio,
	dependenciesState: Map<PieceId, PieceDependencies>,
	collection: CustomPublishCollection<UIPieceContentStatus>,
	regenerateAdLibPieceIds: Set<PieceId>
): Promise<void> {
	const deletedPieceIds = new Set<PieceId>()

	// Apply the updates to the Pieces
	// Future: this could be done with some limited concurrency. It will need to balance performance of the updates and not interfering with other tasks
	for (const pieceId of regenerateAdLibPieceIds) {
		dependenciesState.delete(pieceId)

		const pieceDoc = contentCache.BaselineAdLibPieces.findOne(pieceId)
		if (!pieceDoc) {
			// Piece has been deleted, queue it for batching
			deletedPieceIds.add(pieceId)
		} else {
			// Regenerate piece
			const rundown = contentCache.Rundowns.findOne(pieceDoc.rundownId)
			const sourceLayersForRundown = rundown
				? contentCache.ShowStyleSourceLayers.findOne(rundown.showStyleBaseId)
				: undefined

			const sourceLayer = sourceLayersForRundown?.sourceLayers?.[pieceDoc.sourceLayerId]

			if (sourceLayer) {
				const [status, dependencies] = await checkPieceContentStatusAndDependencies(
					uiStudio,
					pieceDoc,
					sourceLayer
				)

				dependenciesState.set(pieceId, dependencies)

				collection.replace({
					_id: protectString(`baseline_adlib_${pieceId}`),

					partId: undefined,
					segmentId: undefined,
					rundownId: pieceDoc.rundownId,
					pieceId: pieceId,

					name: pieceDoc.name,
					segmentName: undefined,

					segmentRank: -1,
					partRank: -1,

					isPieceInstance: false,

					status,
				})
			} else {
				deletedPieceIds.add(pieceId)
			}
		}
	}

	// Process any piece deletions
	collection.remove((doc) => deletedPieceIds.has(doc.pieceId as PieceId))
}

/**
 * Regenerating the status for the provided PieceIds
 * Note: This will do many calls to the database
 */
export async function regenerateForBaselineAdLibActionIds(
	contentCache: ReadonlyDeep<ContentCache>,
	uiStudio: PieceContentStatusStudio,
	dependenciesState: Map<RundownBaselineAdLibActionId, PieceDependencies>,
	collection: CustomPublishCollection<UIPieceContentStatus>,
	regenerateActionIds: Set<RundownBaselineAdLibActionId>
): Promise<void> {
	const deletedPieceIds = new Set<RundownBaselineAdLibActionId>()

	// Apply the updates to the Pieces
	// Future: this could be done with some limited concurrency. It will need to balance performance of the updates and not interfering with other tasks
	for (const pieceId of regenerateActionIds) {
		dependenciesState.delete(pieceId)

		const actionDoc = contentCache.BaselineAdLibActions.findOne(pieceId)
		if (!actionDoc || !actionDoc.partId) {
			// Piece has been deleted, queue it for batching
			deletedPieceIds.add(pieceId)
		} else {
			const fakedPiece = literal<PieceContentStatusPiece>({
				_id: protectString(`${actionDoc._id}`),
				content: 'content' in actionDoc.display ? actionDoc.display.content : {},
				expectedPackages: actionDoc.expectedPackages,
			})

			const sourceLayerId = 'sourceLayerId' in actionDoc.display ? actionDoc.display.sourceLayerId : undefined

			// Regenerate piece
			const rundown = contentCache.Rundowns.findOne(actionDoc.rundownId)
			const sourceLayersForRundown = rundown
				? contentCache.ShowStyleSourceLayers.findOne(rundown.showStyleBaseId)
				: undefined

			const sourceLayer = sourceLayerId && sourceLayersForRundown?.sourceLayers?.[sourceLayerId]

			if (sourceLayer) {
				const [status, dependencies] = await checkPieceContentStatusAndDependencies(
					uiStudio,
					fakedPiece,
					sourceLayer
				)

				dependenciesState.set(pieceId, dependencies)

				collection.replace({
					_id: protectString(`baseline_adlib_${pieceId}`),

					partId: undefined,
					segmentId: undefined,
					rundownId: actionDoc.rundownId,
					pieceId: pieceId,

					name: wrapTranslatableMessageFromBlueprintsIfNotString(actionDoc.display.label, [
						sourceLayersForRundown.blueprintId,
					]),
					segmentName: undefined,

					segmentRank: -1,
					partRank: -1,

					isPieceInstance: false,

					status,
				})
			} else {
				deletedPieceIds.add(pieceId)
			}
		}
	}

	// Process any piece deletions
	collection.remove((doc) => deletedPieceIds.has(doc.pieceId as RundownBaselineAdLibActionId))
}
