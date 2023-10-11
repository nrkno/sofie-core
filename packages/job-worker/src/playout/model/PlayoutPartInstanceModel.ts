import {
	PieceId,
	PieceInstanceId,
	PieceInstanceInfiniteId,
	RundownPlaylistActivationId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReadonlyDeep } from 'type-fest'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { PieceInstance, PieceInstancePiece } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { PartNote } from '@sofie-automation/corelib/dist/dataModel/Notes'
import { IBlueprintMutatablePart, PieceLifespan, Time } from '@sofie-automation/blueprints-integration'
import { PartCalculatedTimings } from '@sofie-automation/corelib/dist/playout/timings'
import { PlayoutPieceInstanceModel } from './PlayoutPieceInstanceModel'

/**
 * Token returned when making a backup copy of a PlayoutPartInstanceModel
 * The contents of this type is opaque and will vary fully across implementations
 */
export interface PlayoutPartInstanceModelSnapshot {
	__isPlayoutPartInstanceModelBackup: true
}

export interface PlayoutPartInstanceModel {
	readonly PartInstance: ReadonlyDeep<DBPartInstance>
	readonly PieceInstances: PlayoutPieceInstanceModel[]

	/**
	 * Take a snapshot of the current state of this PlayoutPartInstanceModel
	 * This can be restored with `snapshotRestore` to rollback to a previous state of the model
	 */
	snapshotMakeCopy(): PlayoutPartInstanceModelSnapshot

	/**
	 * Restore a snapshot of this PlayoutPartInstanceModel, to rollback to a previous state
	 * Note: It is only possible to restore each snapshot once.
	 * Note: Any references to child `PlayoutPieceInstanceModel` or `DBPartInstance` may no longer be valid after this operation
	 * @param snapshot Snapshot to restore
	 */
	snapshotRestore(snapshot: PlayoutPartInstanceModelSnapshot): void

	appendNotes(notes: PartNote[]): void

	blockTakeUntil(timestamp: Time | null): void

	clearPlannedTimings(): void

	getPieceInstance(id: PieceInstanceId): PlayoutPieceInstanceModel | undefined

	insertAdlibbedPiece(
		piece: Omit<PieceInstancePiece, 'startPartId'>,
		fromAdlibId: PieceId | undefined
	): PlayoutPieceInstanceModel

	insertHoldPieceInstance(
		extendPieceInstance: PlayoutPieceInstanceModel,
		infiniteInstanceId: PieceInstanceInfiniteId
	): PlayoutPieceInstanceModel

	/**
	 * Insert a Piece as if it were originally planned at the time of ingest
	 * This is a weird operation to have for playout, but it is a needed part of the SyncIngestChanges flow
	 * @param piece Piece to insert into this PartInstance
	 * @returns The inserted PlayoutPieceInstanceModel
	 */
	insertPlannedPiece(piece: Omit<PieceInstancePiece, 'startPartId'>): PlayoutPieceInstanceModel

	insertVirtualPiece(
		start: number,
		lifespan: PieceLifespan,
		sourceLayerId: string,
		outputLayerId: string
	): PlayoutPieceInstanceModel

	markAsReset(): void

	recalculateExpectedDurationWithPreroll(): void

	/**
	 * Remove a PieceInstance from the model.
	 * This is a slightly dangerous operation to have, as it could remove a PieceInstance which will be readded by the ingest or SyncIngestChanges logic
	 * @param id Piece to remove from this PartInstance
	 * @returns Whether the PieceInstance was found and removed
	 */
	removePieceInstance(id: PieceInstanceId): boolean

	replaceInfinitesFromPreviousPlayhead(pieceInstances: PieceInstance[]): void

	/**
	 * Merge a PieceInstance with a new version, or insert as a new PieceInstance.
	 * If there is an existing PieceInstance with the same id, it will be merged onto that
	 * Note: this can replace any playout owned properties too
	 * @param pieceInstance Replacement PieceInstance to use
	 * @returns The inserted PlayoutPieceInstanceModel
	 */
	mergeOrInsertPieceInstance(pieceInstance: ReadonlyDeep<PieceInstance>): PlayoutPieceInstanceModel

	setOrphaned(orphaned: 'adlib-part' | 'deleted' | undefined): void

	setPlaylistActivationId(id: RundownPlaylistActivationId): void

	setPlannedStartedPlayback(time: Time | undefined): void
	setPlannedStoppedPlayback(time: Time): void
	setReportedStartedPlayback(time: Time): boolean
	setReportedStoppedPlayback(time: Time): boolean

	setRank(rank: number): void

	setTaken(takeTime: number, playOffset: number): void

	storePlayoutTimingsAndPreviousEndState(
		partPlayoutTimings: PartCalculatedTimings,
		previousPartEndState: unknown
	): void

	/**
	 *
	 * @param props
	 * @returns True if any valid properties were provided
	 */
	updatePartProps(props: Partial<IBlueprintMutatablePart>): boolean

	validateScratchpadSegmentProperties(): void
}
