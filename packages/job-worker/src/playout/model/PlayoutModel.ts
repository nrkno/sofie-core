import {
	PartId,
	PartInstanceId,
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
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { PlaylistLock } from '../../jobs/lock'
import { PlayoutRundownModel } from './PlayoutRundownModel'
import { PlayoutSegmentModel } from './PlayoutSegmentModel'
import { PlayoutPartInstanceModel } from './PlayoutPartInstanceModel'
import { PeripheralDevice } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { PlayoutPieceInstanceModel } from './PlayoutPieceInstanceModel'

export type DeferredFunction = (cache: PlayoutModel) => void | Promise<void>
export type DeferredAfterSaveFunction = (cache: PlayoutModelReadonly) => void | Promise<void>

export interface PlayoutModelPreInit {
	readonly PlaylistId: RundownPlaylistId
	readonly PlaylistLock: PlaylistLock

	readonly PeripheralDevices: ReadonlyDeep<PeripheralDevice[]>

	readonly Playlist: ReadonlyDeep<DBRundownPlaylist>
	readonly Rundowns: ReadonlyDeep<DBRundown[]>

	getRundown(id: RundownId): DBRundown | undefined
}

export interface PlayoutModelReadonly extends StudioPlayoutModelBaseReadonly {
	readonly isPlayout: true
	readonly PlaylistId: RundownPlaylistId

	readonly PlaylistLock: PlaylistLock

	get Playlist(): ReadonlyDeep<DBRundownPlaylist>
	get Rundowns(): readonly PlayoutRundownModel[]

	get HackDeletedPartInstanceIds(): PartInstanceId[]

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
	createInstanceForPart(nextPart: ReadonlyDeep<DBPart>, pieceInstances: PieceInstance[]): PlayoutPartInstanceModel
	insertAdlibbedPartInstance(part: Omit<DBPart, 'segmentId' | 'rundownId'>): PlayoutPartInstanceModel
	insertScratchpadPartInstance(
		rundown: PlayoutRundownModel,
		part: Omit<DBPart, 'segmentId' | 'rundownId'>
	): PlayoutPartInstanceModel

	/**
	 * HACK: This allows for taking a copy of a `PartInstanceWithPieces` for use in `syncChangesToPartInstances`.
	 * This lets us discard the changes if the blueprint call throws.
	 * We should look at avoiding this messy/dangerous method, and find a better way to do this
	 */
	replacePartInstance(partInstance: PlayoutPartInstanceModel): void
	/** @deprecated HACK */
	removePartInstance(id: PartInstanceId): void

	setHoldState(newState: RundownHoldState): void
	setQueuedSegment(segment: PlayoutSegmentModel | null): void

	cycleSelectedPartInstances(): void
	setRundownStartedPlayback(rundownId: RundownId, timestamp: number): void
	setPartInstanceAsNext(
		partInstance: PlayoutPartInstanceModel | null,
		setManually: boolean,
		consumesQueuedSegmentId: boolean,
		nextTimeOffset?: number
	): void

	clearSelectedPartInstances(): void
	activatePlaylist(rehearsal: boolean): RundownPlaylistActivationId
	deactivatePlaylist(): void
	removeUntakenPartInstances(): void

	/**
	 * Reset the playlist for playout
	 */
	resetPlaylist(regenerateActivationId: boolean): void

	setOnTimelineGenerateResult(
		persistentState: unknown | undefined,
		assignedAbSessions: Record<string, ABSessionAssignments>,
		trackedAbSessions: ABSessionInfo[]
	): void

	queuePartInstanceTimingEvent(partInstanceId: PartInstanceId): void

	/** @deprecated */
	deferBeforeSave(fcn: DeferredFunction): void
	/** @deprecated */
	deferAfterSave(fcn: DeferredAfterSaveFunction): void

	/**
	 * Assert that no changes should have been made to the cache, will throw an Error otherwise. This can be used in
	 * place of `saveAllToDatabase()`, when the code controlling the cache expects no changes to have been made and any
	 * changes made are an error and will cause issues.
	 */
	assertNoChanges(): void

	saveAllToDatabase(): Promise<void>
}
