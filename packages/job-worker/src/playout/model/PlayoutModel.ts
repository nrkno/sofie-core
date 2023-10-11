import {
	PartId,
	PartInstanceId,
	PieceId,
	PieceInstanceId,
	RundownId,
	RundownPlaylistActivationId,
	RundownPlaylistId,
	SegmentId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ICacheBase2 } from '../../cache/CacheBase'
import {
	ABSessionAssignments,
	ABSessionInfo,
	DBRundownPlaylist,
	RundownHoldState,
} from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { ReadonlyDeep } from 'type-fest'
import { StudioPlayoutModelBase, StudioPlayoutModelBaseReadonly } from '../../studio/StudioPlayoutModel'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { PieceInstance, PieceInstancePiece } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { PlaylistLock } from '../../jobs/lock'
import { PlayoutRundownModel } from './PlayoutRundownModel'
import { PlayoutSegmentModel } from './PlayoutSegmentModel'
import { PlayoutPartInstanceModel } from './PlayoutPartInstanceModel'
import { PeripheralDevice } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { PlayoutPieceInstanceModel } from './PlayoutPieceInstanceModel'

export type DeferredFunction = (playoutModel: PlayoutModel) => void | Promise<void>
export type DeferredAfterSaveFunction = (playoutModel: PlayoutModelReadonly) => void | Promise<void>

export interface PlayoutModelPreInit {
	readonly PlaylistId: RundownPlaylistId
	readonly PlaylistLock: PlaylistLock

	readonly PeripheralDevices: ReadonlyDeep<PeripheralDevice[]>

	readonly Playlist: ReadonlyDeep<DBRundownPlaylist>
	readonly Rundowns: ReadonlyDeep<DBRundown[]>

	getRundown(id: RundownId): DBRundown | undefined
}

export interface PlayoutModelReadonly extends StudioPlayoutModelBaseReadonly {
	readonly PlaylistId: RundownPlaylistId

	readonly PlaylistLock: PlaylistLock

	get Playlist(): ReadonlyDeep<DBRundownPlaylist>
	get Rundowns(): readonly PlayoutRundownModel[]

	get OlderPartInstances(): PlayoutPartInstanceModel[]
	get PreviousPartInstance(): PlayoutPartInstanceModel | null
	get CurrentPartInstance(): PlayoutPartInstanceModel | null
	get NextPartInstance(): PlayoutPartInstanceModel | null
	get SelectedPartInstanceIds(): PartInstanceId[]
	get SelectedPartInstances(): PlayoutPartInstanceModel[]
	get LoadedPartInstances(): PlayoutPartInstanceModel[]
	get SortedLoadedPartInstances(): PlayoutPartInstanceModel[]
	getPartInstance(partInstanceId: PartInstanceId): PlayoutPartInstanceModel | undefined

	/**
	 * Search for a Part through the whole Playlist
	 * @param id
	 */
	findPart(id: PartId): ReadonlyDeep<DBPart> | undefined
	getAllOrderedParts(): ReadonlyDeep<DBPart>[]

	findSegment(id: SegmentId): ReadonlyDeep<PlayoutSegmentModel> | undefined
	getAllOrderedSegments(): ReadonlyDeep<PlayoutSegmentModel>[]

	getRundown(id: RundownId): PlayoutRundownModel | undefined
	getRundownIds(): RundownId[]

	findPieceInstance(
		id: PieceInstanceId
	): { partInstance: PlayoutPartInstanceModel; pieceInstance: PlayoutPieceInstanceModel } | undefined
}

export interface PlayoutModel extends PlayoutModelReadonly, StudioPlayoutModelBase, ICacheBase2 {
	/**
	 * Temporary hack for debug logging
	 */
	get HackDeletedPartInstanceIds(): PartInstanceId[]

	activatePlaylist(rehearsal: boolean): RundownPlaylistActivationId

	clearSelectedPartInstances(): void

	createAdlibbedPartInstance(
		part: Omit<DBPart, 'segmentId' | 'rundownId'>,
		pieces: Omit<PieceInstancePiece, 'startPartId'>[],
		fromAdlibId: PieceId | undefined,
		infinitePieceInstances: PieceInstance[]
	): PlayoutPartInstanceModel

	createInstanceForPart(nextPart: ReadonlyDeep<DBPart>, pieceInstances: PieceInstance[]): PlayoutPartInstanceModel

	createScratchpadPartInstance(
		rundown: PlayoutRundownModel,
		part: Omit<DBPart, 'segmentId' | 'rundownId'>
	): PlayoutPartInstanceModel

	cycleSelectedPartInstances(): void

	deactivatePlaylist(): void

	queuePartInstanceTimingEvent(partInstanceId: PartInstanceId): void

	removeAllRehearsalPartInstances(): void

	removeUntakenPartInstances(): void

	/**
	 * Reset the playlist for playout
	 */
	resetPlaylist(regenerateActivationId: boolean): void

	setHoldState(newState: RundownHoldState): void

	setOnTimelineGenerateResult(
		persistentState: unknown | undefined,
		assignedAbSessions: Record<string, ABSessionAssignments>,
		trackedAbSessions: ABSessionInfo[]
	): void

	setPartInstanceAsNext(
		partInstance: PlayoutPartInstanceModel | null,
		setManually: boolean,
		consumesQueuedSegmentId: boolean,
		nextTimeOffset?: number
	): void

	setQueuedSegment(segment: PlayoutSegmentModel | null): void

	setRundownStartedPlayback(rundownId: RundownId, timestamp: number): void

	/** Lifecycle */

	/** @deprecated */
	deferBeforeSave(fcn: DeferredFunction): void
	/** @deprecated */
	deferAfterSave(fcn: DeferredAfterSaveFunction): void

	saveAllToDatabase(): Promise<void>
}
