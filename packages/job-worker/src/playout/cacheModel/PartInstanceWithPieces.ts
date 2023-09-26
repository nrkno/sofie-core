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

export interface PartInstanceWithPieces {
	readonly PartInstance: ReadonlyDeep<DBPartInstance>
	readonly PieceInstances: ReadonlyDeep<PieceInstance>[]

	clone(): PartInstanceWithPieces

	setPlaylistActivationId(id: RundownPlaylistActivationId): void

	// /** @deprecated HACK */
	// insertPieceInstance(instance: PieceInstance): void
	insertAdlibbedPiece(
		piece: Omit<PieceInstancePiece, 'startPartId'>,
		fromAdlibId: PieceId | undefined
	): ReadonlyDeep<PieceInstance>

	recalculateExpectedDurationWithPreroll(): void

	replaceInfinitesFromPreviousPlayhead(pieces: PieceInstance[]): void

	markAsReset(): void

	blockTakeUntil(timestamp: Time | null): void

	clearPlannedTimings(): void

	setRank(rank: number): void

	setOrphaned(orphaned: 'adlib-part' | 'deleted' | undefined): void

	setTaken(takeTime: number, playOffset: number): void

	// TODO - better name
	setTakeCache(partPlayoutTimings: PartCalculatedTimings, previousPartEndState: unknown): void

	appendNotes(notes: PartNote[]): void

	updatePartProps(props: Partial<IBlueprintMutatablePart>): void

	getPieceInstance(id: PieceInstanceId): ReadonlyDeep<PieceInstance> | undefined

	updatePieceProps(id: PieceInstanceId, props: Partial<PieceInstancePiece>): void

	/** @deprecated HACK */
	replacePieceInstance(doc: ReadonlyDeep<PieceInstance>): void

	/** @deprecated HACK */
	removePieceInstance(id: PieceInstanceId): boolean

	/** @deprecated HACK */
	insertInfinitePieces(pieceInstances: PieceInstance[]): void

	setPlannedStartedPlayback(time: Time | undefined): void
	setPlannedStoppedPlayback(time: Time): void
	setReportedStartedPlayback(time: Time): boolean
	setReportedStoppedPlayback(time: Time): boolean

	setPieceInstancedPlannedStartedPlayback(pieceInstanceId: PieceInstanceId, time: Time): boolean
	setPieceInstancedPlannedStoppedPlayback(pieceInstanceId: PieceInstanceId, time: Time | undefined): boolean
	setPieceInstancedReportedStartedPlayback(pieceInstanceId: PieceInstanceId, time: Time): boolean
	setPieceInstancedReportedStoppedPlayback(pieceInstanceId: PieceInstanceId, time: Time): boolean

	validateScratchpadSegmentProperties(): void

	preparePieceInstanceForHold(pieceInstanceId: PieceInstanceId): PieceInstanceInfiniteId

	addHoldPieceInstance(
		extendPieceInstance: ReadonlyDeep<PieceInstance>,
		infiniteInstanceId: PieceInstanceInfiniteId
	): PieceInstance

	setPieceInstanceDuration(pieceInstanceId: PieceInstanceId, duration: Required<PieceInstance>['userDuration']): void

	insertVirtualPiece(
		start: number,
		lifespan: PieceLifespan,
		sourceLayerId: string,
		outputLayerId: string
	): PieceInstance

	setPieceInstanceDisabled(pieceInstanceId: PieceInstanceId, disabled: boolean): void
}
