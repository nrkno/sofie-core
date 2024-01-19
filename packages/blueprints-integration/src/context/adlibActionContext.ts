import type { DatastorePersistenceMode, Time } from '../common'
import type { IEventContext } from '.'
import type { IShowStyleUserContext } from './showStyleContext'
import type {
	IBlueprintMutatablePart,
	IBlueprintPart,
	IBlueprintPartInstance,
	IBlueprintPiece,
	IBlueprintPieceDB,
	IBlueprintPieceInstance,
	IBlueprintResolvedPieceInstance,
} from '../documents'
import type { PeripheralDeviceId } from '@sofie-automation/shared-lib/dist/core/model/Ids'
import type { TSR } from '../timeline'
import type { IBlueprintPlayoutDevice } from '..'

/** Actions */
export interface IDataStoreActionExecutionContext extends IShowStyleUserContext, IEventContext {
	/**
	 * Setting a value in the datastore allows us to overwrite parts of a timeline content object with that value
	 * @param key Key to use when referencing from the timeline object
	 * @param value Value to overwrite the timeline object's content with
	 * @param mode In temporary mode the value may be removed when the key is no longer on the timeline
	 */
	setTimelineDatastoreValue(key: string, value: any, mode: DatastorePersistenceMode): Promise<void>
	/** Deletes a previously set value from the datastore */
	removeTimelineDatastoreValue(key: string): Promise<void>
}

export interface IActionExecutionContext
	extends IShowStyleUserContext,
		IEventContext,
		IDataStoreActionExecutionContext {
	/** Data fetching */
	// getIngestRundown(): IngestRundown // TODO - for which part?
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
			piecePrivateDataFilter?: any // Mongo query against properties inside of piece.metaData
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
	/** Fetch the showstyle config for the specified part */
	// getNextShowStyleConfig(): Readonly<{ [key: string]: ConfigItemValue }>

	/** Creative actions */
	/** Insert a pieceInstance. Returns id of new PieceInstance. Any timelineObjects will have their ids changed, so are not safe to reference from another piece */
	insertPiece(part: 'current' | 'next', piece: IBlueprintPiece): Promise<IBlueprintPieceInstance>
	/** Update a piecesInstance */
	updatePieceInstance(pieceInstanceId: string, piece: Partial<IBlueprintPiece>): Promise<IBlueprintPieceInstance>
	/** Insert a queued part to follow the current part */
	queuePart(part: IBlueprintPart, pieces: IBlueprintPiece[]): Promise<IBlueprintPartInstance>
	/** Update a partInstance */
	updatePartInstance(
		part: 'current' | 'next',
		props: Partial<IBlueprintMutatablePart>
	): Promise<IBlueprintPartInstance>

	/** Destructive actions */
	/** Stop any piecesInstances on the specified sourceLayers. Returns ids of piecesInstances that were affected */
	stopPiecesOnLayers(sourceLayerIds: string[], timeOffset?: number): Promise<string[]>
	/** Stop piecesInstances by id. Returns ids of piecesInstances that were removed */
	stopPieceInstances(pieceInstanceIds: string[], timeOffset?: number): Promise<string[]>
	/** Remove piecesInstances by id. Returns ids of piecesInstances that were removed. Note: For now we only allow removing from the next, but this might change to include current if there is justification */
	removePieceInstances(part: 'next', pieceInstanceIds: string[]): Promise<string[]>

	/** Move the next part through the rundown. Can move by either a number of parts, or segments in either direction. */
	moveNextPart(partDelta: number, segmentDelta: number): Promise<void>
	/** Set flag to perform take after executing the current action. Returns state of the flag after each call. */
	takeAfterExecuteAction(take: boolean): Promise<boolean>
	/** Inform core that a take out of the current partinstance should be blocked until the specified time */
	blockTakeUntil(time: Time | null): Promise<void>

	/** Misc actions */
	// updateAction(newManifest: Pick<IBlueprintAdLibActionManifest, 'description' | 'payload'>): void // only updates itself. to allow for the next one to do something different
	// executePeripheralDeviceAction(deviceId: string, functionName: string, args: any[]): Promise<any>
	// openUIDialogue(message: string) // ?????
	/** Returns a list of the PeripheralDevices */
	listPlayoutDevices(): Promise<IBlueprintPlayoutDevice[]>
	/** Execute an action on a certain PeripheralDevice */
	executeTSRAction(
		deviceId: PeripheralDeviceId,
		actionId: string,
		payload: Record<string, any>
	): Promise<TSR.ActionExecutionResult>
}
