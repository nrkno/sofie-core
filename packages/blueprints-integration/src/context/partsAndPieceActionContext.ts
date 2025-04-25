import {
	IBlueprintMutatablePart,
	IBlueprintPart,
	IBlueprintPartInstance,
	IBlueprintPiece,
	IBlueprintPieceDB,
	IBlueprintPieceInstance,
	IBlueprintResolvedPieceInstance,
	Time,
} from '..'
import { BlueprintQuickLookInfo } from './quickLoopInfo'

export interface IPartAndPieceActionContext {
	/** Information about the current loop, if there is one */
	readonly quickLoopInfo: BlueprintQuickLookInfo | null

	/**
	 * Data fetching
	 */
	/** Get a PartInstance which can be modified */
	getPartInstance(part: 'current' | 'next'): Promise<IBlueprintPartInstance | undefined>
	/** Get the PieceInstances for a modifiable PartInstance */
	getPieceInstances(part: 'current' | 'next'): Promise<IBlueprintPieceInstance[]>
	/** Get the resolved PieceInstances for a modifiable PartInstance */
	getResolvedPieceInstances(part: 'current' | 'next'): Promise<IBlueprintResolvedPieceInstance[]>
	/** Get the last active piece on given layer */
	findLastPieceOnLayer(
		sourceLayerId: string | string[],
		options?: {
			excludeCurrentPart?: boolean
			originalOnly?: boolean
			piecePrivateDataFilter?: any // Mongo query against properties inside of piece.privateData
		}
	): Promise<IBlueprintPieceInstance | undefined>
	/** Get the previous scripted piece on a given layer, looking backwards from the current part. */
	findLastScriptedPieceOnLayer(
		sourceLayerId: string | string[],
		options?: {
			excludeCurrentPart?: boolean
			piecePrivateDataFilter?: any
		}
	): Promise<IBlueprintPiece | undefined>
	/** Gets the PartInstance for a PieceInstance retrieved from findLastPieceOnLayer. This primarily allows for accessing metadata of the PartInstance */
	getPartInstanceForPreviousPiece(piece: IBlueprintPieceInstance): Promise<IBlueprintPartInstance>
	/** Gets the Part for a Piece retrieved from findLastScriptedPieceOnLayer. This primarily allows for accessing metadata of the Part */
	getPartForPreviousPiece(piece: IBlueprintPieceDB): Promise<IBlueprintPart | undefined>

	/**
	 * Creative actions
	 */
	/** Insert a pieceInstance. Returns id of new PieceInstance. Any timelineObjects will have their ids changed, so are not safe to reference from another piece */
	insertPiece(part: 'current' | 'next', piece: IBlueprintPiece): Promise<IBlueprintPieceInstance>
	/** Update a piecesInstance */
	updatePieceInstance(pieceInstanceId: string, piece: Partial<IBlueprintPiece>): Promise<IBlueprintPieceInstance>

	/** Update a partInstance */
	updatePartInstance(
		part: 'current' | 'next',
		props: Partial<IBlueprintMutatablePart>
	): Promise<IBlueprintPartInstance>
	/** Inform core that a take out of the partinstance should be blocked until the specified time */
	blockTakeUntil(time: Time | null): Promise<void>

	/**
	 * Destructive actions
	 */
	/** Stop any piecesInstances on the specified sourceLayers. Returns ids of piecesInstances that were affected */
	stopPiecesOnLayers(sourceLayerIds: string[], timeOffset?: number): Promise<string[]>
	/** Stop piecesInstances by id. Returns ids of piecesInstances that were removed */
	stopPieceInstances(pieceInstanceIds: string[], timeOffset?: number): Promise<string[]>
	/** Remove piecesInstances by id. Returns ids of piecesInstances that were removed. */
	removePieceInstances(part: 'current' | 'next', pieceInstanceIds: string[]): Promise<string[]>
}
