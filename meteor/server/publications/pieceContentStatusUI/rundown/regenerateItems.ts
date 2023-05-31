import { PieceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReadonlyDeep } from 'type-fest'
import { UIPieceContentStatus } from '../../../../lib/api/rundownNotifications'
import { protectString } from '../../../../lib/lib'
import { CustomPublishCollection } from '../../../lib/customPublication'
import { ContentCache } from './reactiveContentCache'
import { checkPieceContentStatusAndDependencies, PieceDependencies, StudioMini } from '../common'
import { PieceContentStatusPiece } from '../../../../lib/mediaObjects'

async function regenerateGenericPiece(
	contentCache: ReadonlyDeep<ContentCache>,
	uiStudio: ReadonlyDeep<StudioMini>,
	pieceDoc: PieceContentStatusPiece,
	sourceLayerId: string,
	doc: Pick<Required<UIPieceContentStatus>, '_id' | 'partId' | 'pieceId' | 'rundownId' | 'name'>
): Promise<{
	dependencies: PieceDependencies
	doc: UIPieceContentStatus
} | null> {
	// Regenerate piece
	const rundown = contentCache.Rundowns.findOne(doc.rundownId)
	const sourceLayersForRundown = rundown
		? contentCache.ShowStyleSourceLayers.findOne(rundown.showStyleBaseId)
		: undefined

	const part = contentCache.Parts.findOne(doc.partId)
	const segment = part ? contentCache.Segments.findOne(part.segmentId) : undefined
	const sourceLayer = sourceLayersForRundown?.sourceLayers?.[sourceLayerId]

	if (part && segment && sourceLayer) {
		const [status, dependencies] = await checkPieceContentStatusAndDependencies(uiStudio, pieceDoc, sourceLayer)

		return {
			dependencies,
			doc: {
				...doc,

				segmentRank: segment._rank,
				partRank: part._rank,

				segmentName: segment.name,

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
	uiStudio: ReadonlyDeep<StudioMini>,
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
	collection.remove((doc) => !!doc.pieceId && deletedPieceIds.has(doc.pieceId))
}

/**
 * Regenerating the status for the provided PieceIds
 * Note: This will do many calls to the database
 */
export async function regenerateForAdLibPieceIds(
	contentCache: ReadonlyDeep<ContentCache>,
	uiStudio: ReadonlyDeep<StudioMini>,
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
	collection.remove((doc) => !!doc.pieceId && deletedPieceIds.has(doc.pieceId))
}

/**
 * Regenerating the status for the provided PieceIds
 * Note: This will do many calls to the database
 */
export async function regenerateForBaselineAdLibPieceIds(
	contentCache: ReadonlyDeep<ContentCache>,
	uiStudio: ReadonlyDeep<StudioMini>,
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
					rundownId: pieceDoc.rundownId,
					pieceId: pieceId,

					name: pieceDoc.name,
					segmentName: '', // TODO?

					segmentRank: -1,
					partRank: -1,

					status,
				})
			} else {
				deletedPieceIds.add(pieceId)
			}
		}
	}

	// Process any piece deletions
	collection.remove((doc) => !!doc.pieceId && deletedPieceIds.has(doc.pieceId))
}
