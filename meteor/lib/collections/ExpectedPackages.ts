import { ExpectedPackage } from '@sofie-automation/blueprints-integration'
import { TransformedCollection } from '../typings/meteor'
import { registerCollection, Time, ProtectedString } from '../lib'
import { createMongoCollection } from './lib'
import { RundownId } from './Rundowns'
import { ResultingMappingRoutes, StudioId } from './Studios'
import { PieceId } from './Pieces'
import { registerIndex } from '../database'
import { AdLibActionId } from './AdLibActions'

export type ExpectedPackageId = ProtectedString<'ExpectedPackageId'>

export type ExpectedPackageDB =
	| ExpectedPackageDBFromPiece
	// | ExpectedPackageDBFromAdlibPiece
	| ExpectedPackageDBFromAdLibAction

export enum ExpectedPackageDBType {
	PIECE = 'piece',
	// ADLIB_PIECE = 'adlib_piece',
	ADLIB_ACTION = 'adlib_action',
}
export interface ExpectedPackageDBBase extends ExpectedPackage.Base {
	_id: ExpectedPackageId

	/** The studio of the Rundown of the Piece this package belongs to */
	studioId: StudioId
	/** The rundown of the Piece this package belongs to */
	rundownId: RundownId

	pieceId: ProtectedString<any>
	fromPieceType: ExpectedPackageDBType
}
export interface ExpectedPackageDBFromPiece extends ExpectedPackageDBBase {
	/** The Piece this package belongs to */
	pieceId: PieceId
	fromPieceType: ExpectedPackageDBType.PIECE
}
// export interface ExpectedPackageDBFromAdlibPiece extends ExpectedPackageDBBase {
// 	/** The Piece this package belongs to */
// 	pieceId: AdlibPieceId
// 	fromPieceType: ExpectedPackageDBType.ADLIB_PIECE
// }
export interface ExpectedPackageDBFromAdLibAction extends ExpectedPackageDBBase {
	/** The Piece this package belongs to */
	pieceId: AdLibActionId
	fromPieceType: ExpectedPackageDBType.ADLIB_ACTION
}
export const ExpectedPackages: TransformedCollection<ExpectedPackageDB, ExpectedPackageDB> = createMongoCollection<
	ExpectedPackageDB
>('expectedPackages')
registerCollection('ExpectedPackages', ExpectedPackages)

registerIndex(ExpectedPackages, {
	rundownId: 1,
	pieceId: 1,
})

export function getRoutedExpectedPackages(
	expectedPackages: ExpectedPackageDBBase[],
	mappingRoutes: ResultingMappingRoutes
) {
	// const outputTimelineObjs: TimelineObjGeneric[] = []

	expectedPackages[0].layer

	// for (let obj of inputTimelineObjs) {
	// 	let inputLayer = obj.layer + ''
	// 	if (obj.isLookahead && obj.lookaheadForLayer) {
	// 		// For lookahead objects, .layer doesn't point to any real layer
	// 		inputLayer = obj.lookaheadForLayer + ''
	// 	}
	// 	const routes = mappingRoutes.existing[inputLayer]
	// 	if (routes) {
	// 		for (let i = 0; i < routes.length; i++) {
	// 			const route = routes[i]
	// 			const routedObj: TimelineObjGeneric = {
	// 				...obj,
	// 				layer: route.outputMappedLayer,
	// 			}
	// 			if (routedObj.isLookahead && routedObj.lookaheadForLayer) {
	// 				// Update lookaheadForLayer to reference the original routed layer:
	// 				updateLookaheadLayer(routedObj)
	// 			}
	// 			if (i > 0) {
	// 				// If there are multiple routes we must rename the ids, so that they stay unique.
	// 				routedObj.id = `_${i}_${routedObj.id}`
	// 			}
	// 			outputTimelineObjs.push(routedObj)
	// 		}
	// 	} else {
	// 		// If no route is found at all, pass it through (backwards compatibility)
	// 		outputTimelineObjs.push(obj)
	// 	}
	// }
	// return outputTimelineObjs
}
