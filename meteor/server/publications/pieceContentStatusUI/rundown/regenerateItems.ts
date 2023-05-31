import { PieceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReadonlyDeep } from 'type-fest'
import { UIPieceContentStatus } from '../../../../lib/api/rundownNotifications'
import { protectString } from '../../../../lib/lib'
import { CustomPublishCollection } from '../../../lib/customPublication'
import { ContentCache } from './reactiveContentCache'
import { checkPieceContentStatusAndDependencies, PieceDependencies, StudioMini } from '../common'

/**
 * Regenerating the status for the provided PieceIds
 * Note: This will do many calls to the database
 */
export async function regenerateForPieceIds(
	contentCache: ReadonlyDeep<ContentCache>,
	uiStudio: ReadonlyDeep<StudioMini>,
	pieceDependenciesState: Map<PieceId, PieceDependencies>,
	collection: CustomPublishCollection<UIPieceContentStatus>,
	regeneratePieceIds: Set<PieceId>
): Promise<void> {
	const deletedPieceIds = new Set<PieceId>()

	// Apply the updates to the Pieces
	// Future: this could be done with some limited concurrency. It will need to balance performance of the updates and not interfering with other tasks
	for (const pieceId of regeneratePieceIds) {
		pieceDependenciesState.delete(pieceId)

		const pieceDoc = contentCache.Pieces.findOne(pieceId)
		if (!pieceDoc) {
			// Piece has been deleted, queue it for batching
			deletedPieceIds.add(pieceId)
		} else {
			// Regenerate piece
			const rundown = contentCache.Rundowns.findOne(pieceDoc.startRundownId)
			const sourceLayersForRundown = rundown
				? contentCache.ShowStyleSourceLayers.findOne(rundown.showStyleBaseId)
				: undefined

			const part = contentCache.Parts.findOne(pieceDoc.startPartId)
			const segment = part ? contentCache.Segments.findOne(part.segmentId) : undefined
			const sourceLayer = sourceLayersForRundown?.sourceLayers?.[pieceDoc.sourceLayerId]

			// Only if this piece is valid
			if (part && segment && sourceLayer) {
				const [status, pieceDependencies] = await checkPieceContentStatusAndDependencies(
					uiStudio,
					pieceDoc,
					sourceLayer
				)

				pieceDependenciesState.set(pieceId, pieceDependencies)

				collection.replace({
					_id: protectString(`piece_${pieceId}`),

					segmentRank: segment._rank,
					partRank: part._rank,

					partId: pieceDoc.startPartId,
					rundownId: pieceDoc.startRundownId,
					segmentId: part.segmentId,
					pieceId: pieceId,

					name: pieceDoc.name,
					segmentName: segment.name,

					status: status,
				})
			} else {
				deletedPieceIds.add(pieceId)
			}
		}
	}

	// Process any piece deletions
	collection.remove((doc) => deletedPieceIds.has(doc.pieceId))
}
