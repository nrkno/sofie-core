import { unprotectString } from '@sofie-automation/server-core-integration'
import { ShowStyleBaseExt } from '../../collections/showStyleBaseHandler.js'
import { PieceInstanceMin } from '../../collections/pieceInstancesHandler.js'

export interface PieceStatus {
	id: string
	name: string
	sourceLayer: string
	outputLayer: string
	tags: readonly string[] | undefined
	publicData: unknown
}

export function toPieceStatus(
	pieceInstance: PieceInstanceMin,
	showStyleBaseExt: ShowStyleBaseExt | undefined
): PieceStatus {
	const sourceLayerName = showStyleBaseExt?.sourceLayerNamesById.get(pieceInstance.piece.sourceLayerId)
	const outputLayerName = showStyleBaseExt?.outputLayerNamesById.get(pieceInstance.piece.outputLayerId)
	return {
		id: unprotectString(pieceInstance._id),
		name: pieceInstance.piece.name,
		sourceLayer: sourceLayerName ?? 'invalid',
		outputLayer: outputLayerName ?? 'invalid',
		tags: pieceInstance.piece.tags,
		publicData: pieceInstance.piece.publicData,
	}
}
