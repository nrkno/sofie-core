import { BucketAdLibActionId, BucketAdLibId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReadonlyDeep } from 'type-fest'
import { UIBucketContentStatus } from '../../../../lib/api/rundownNotifications'
import { literal, protectString } from '../../../../lib/lib'
import { CustomPublishCollection } from '../../../lib/customPublication'
import { BucketContentCache } from './bucketContentCache'
import { checkPieceContentStatusAndDependencies, PieceDependencies, StudioMini } from '../common'
import { PieceContentStatusPiece } from '../../../../lib/mediaObjects'
import { interpollateTranslation, translateMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'

/**
 * Regenerating the status for the provided AdLibActionId
 * Note: This will do many calls to the database
 */
export async function regenerateForBucketAdLibIds(
	contentCache: ReadonlyDeep<BucketContentCache>,
	uiStudio: ReadonlyDeep<StudioMini>,
	dependenciesState: Map<BucketAdLibId, PieceDependencies>,
	collection: CustomPublishCollection<UIBucketContentStatus>,
	regenerateIds: Set<BucketAdLibId>
): Promise<void> {
	const deletedActionIds = new Set<BucketAdLibId>()

	// Apply the updates to the Pieces
	// Future: this could be done with some limited concurrency. It will need to balance performance of the updates and not interfering with other tasks
	for (const adlibId of regenerateIds) {
		dependenciesState.delete(adlibId)

		const actionDoc = contentCache.BucketAdLibs.findOne(adlibId)
		if (!actionDoc) {
			// Piece has been deleted, queue it for batching
			deletedActionIds.add(adlibId)
		} else {
			// Regenerate piece

			const sourceLayer = contentCache.ShowStyleSourceLayers.findOne(actionDoc.showStyleBaseId)?.sourceLayers?.[
				actionDoc.sourceLayerId
			]

			// Only if this piece is valid
			if (sourceLayer) {
				const [status, itemDependencies] = await checkPieceContentStatusAndDependencies(
					uiStudio,
					actionDoc,
					sourceLayer
				)

				dependenciesState.set(adlibId, itemDependencies)

				collection.replace({
					_id: protectString(`bucket_adlib_${adlibId}`),

					bucketId: actionDoc.bucketId,
					docId: adlibId,

					name: actionDoc.name,

					status: status,
				})
			} else {
				deletedActionIds.add(adlibId)
			}
		}
	}

	// Process any piece deletions
	collection.remove((doc) => deletedActionIds.has(doc.docId as BucketAdLibId))
}

/**
 * Regenerating the status for the provided AdLibActionId
 * Note: This will do many calls to the database
 */
export async function regenerateForBucketActionIds(
	contentCache: ReadonlyDeep<BucketContentCache>,
	uiStudio: ReadonlyDeep<StudioMini>,
	dependenciesState: Map<BucketAdLibActionId, PieceDependencies>,
	collection: CustomPublishCollection<UIBucketContentStatus>,
	regenerateIds: Set<BucketAdLibActionId>
): Promise<void> {
	const deletedActionIds = new Set<BucketAdLibActionId>()

	// Apply the updates to the Pieces
	// Future: this could be done with some limited concurrency. It will need to balance performance of the updates and not interfering with other tasks
	for (const actionId of regenerateIds) {
		dependenciesState.delete(actionId)

		const actionDoc = contentCache.BucketAdLibActions.findOne(actionId)
		if (!actionDoc) {
			// Piece has been deleted, queue it for batching
			deletedActionIds.add(actionId)
		} else {
			// Regenerate piece

			const sourceLayer =
				'sourceLayerId' in actionDoc.display
					? contentCache.ShowStyleSourceLayers.findOne(actionDoc.showStyleBaseId)?.sourceLayers?.[
							actionDoc.display.sourceLayerId
					  ]
					: undefined

			// Only if this piece is valid
			if (sourceLayer) {
				const pieceName = translateMessage(actionDoc.display.label, interpollateTranslation) // TODO-HACK

				const fakedPiece = literal<PieceContentStatusPiece>({
					_id: protectString(`${actionDoc._id}`),
					name: pieceName,
					content: 'content' in actionDoc.display ? actionDoc.display.content : {},
					expectedPackages: actionDoc.expectedPackages,
				})

				const [status, itemDependencies] = await checkPieceContentStatusAndDependencies(
					uiStudio,
					fakedPiece,
					sourceLayer
				)

				dependenciesState.set(actionId, itemDependencies)

				collection.replace({
					_id: protectString(`bucket_action_${actionId}`),

					bucketId: actionDoc.bucketId,
					docId: actionId,

					name: pieceName,

					status: status,
				})
			} else {
				deletedActionIds.add(actionId)
			}
		}
	}

	// Process any piece deletions
	collection.remove((doc) => deletedActionIds.has(doc.docId as BucketAdLibActionId))
}
