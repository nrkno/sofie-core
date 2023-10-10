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

export interface PlayoutPartInstanceModel {
	readonly PartInstance: ReadonlyDeep<DBPartInstance>
	readonly PieceInstances: PlayoutPieceInstanceModel[]

	clone(): PlayoutPartInstanceModel

	setPlaylistActivationId(id: RundownPlaylistActivationId): void

	insertAdlibbedPiece(
		piece: Omit<PieceInstancePiece, 'startPartId'>,
		fromAdlibId: PieceId | undefined
	): PlayoutPieceInstanceModel

	recalculateExpectedDurationWithPreroll(): void

	replaceInfinitesFromPreviousPlayhead(pieces: PieceInstance[]): void

	markAsReset(): void

	blockTakeUntil(timestamp: Time | null): void

	clearPlannedTimings(): void

	setRank(rank: number): void

	setOrphaned(orphaned: 'adlib-part' | 'deleted' | undefined): void

	setTaken(takeTime: number, playOffset: number): void

	storePlayoutTimingsAndPreviousEndState(
		partPlayoutTimings: PartCalculatedTimings,
		previousPartEndState: unknown
	): void

	appendNotes(notes: PartNote[]): void

	updatePartProps(props: Partial<IBlueprintMutatablePart>): void

	getPieceInstance(id: PieceInstanceId): PlayoutPieceInstanceModel | undefined

	/**
	 * Replace a PieceInstance with a new version.
	 * If there is an existing PieceInstance with the same id, it will be merged onto that
	 * Note: this will replace any playout owned properties too
	 * @param doc
	 */
	replacePieceInstance(doc: ReadonlyDeep<PieceInstance>): PlayoutPieceInstanceModel

	/** @deprecated HACK */
	insertPlannedPiece(doc: Omit<PieceInstancePiece, 'startPartId'>): PlayoutPieceInstanceModel

	/** @deprecated HACK */
	removePieceInstance(id: PieceInstanceId): boolean

	/** @deprecated HACK  */
	insertInfinitePieces(pieceInstances: PieceInstance[]): void

	setPlannedStartedPlayback(time: Time | undefined): void
	setPlannedStoppedPlayback(time: Time): void
	setReportedStartedPlayback(time: Time): boolean
	setReportedStoppedPlayback(time: Time): boolean

	validateScratchpadSegmentProperties(): void

	addHoldPieceInstance(
		extendPieceInstance: PlayoutPieceInstanceModel,
		infiniteInstanceId: PieceInstanceInfiniteId
	): PlayoutPieceInstanceModel

	insertVirtualPiece(
		start: number,
		lifespan: PieceLifespan,
		sourceLayerId: string,
		outputLayerId: string
	): PlayoutPieceInstanceModel
}
