import {
	PartId,
	PartInstanceId,
	PieceId,
	PieceInstanceId,
	RundownId,
	RundownPlaylistActivationId,
	RundownPlaylistId,
	SegmentId,
	SegmentPlayoutId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PeripheralDevice, PeripheralDeviceType } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import {
	ABSessionAssignments,
	ABSessionInfo,
	DBRundownPlaylist,
	ForceQuickLoopAutoNext,
	QuickLoopMarker,
	QuickLoopMarkerType,
	RundownHoldState,
	SelectedPartInstance,
} from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { ReadonlyDeep } from 'type-fest'
import { JobContext } from '../../../jobs'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import {
	getPieceInstanceIdForPiece,
	PieceInstance,
	PieceInstancePiece,
} from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import {
	serializeTimelineBlob,
	TimelineComplete,
	TimelineCompleteGenerationVersions,
	TimelineObjGeneric,
} from '@sofie-automation/corelib/dist/dataModel/Timeline'
import _ = require('underscore')
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { PlaylistLock } from '../../../jobs/lock'
import { logger } from '../../../logging'
import { clone, getRandomId, literal, normalizeArrayToMapFunc, sleep } from '@sofie-automation/corelib/dist/lib'
import { sortRundownIDsInPlaylist } from '@sofie-automation/corelib/dist/playout/playlist'
import { PlayoutRundownModel } from '../PlayoutRundownModel'
import { PlayoutRundownModelImpl } from './PlayoutRundownModelImpl'
import { PlayoutSegmentModel } from '../PlayoutSegmentModel'
import { PlayoutPartInstanceModelImpl } from './PlayoutPartInstanceModelImpl'
import { PlayoutPartInstanceModel } from '../PlayoutPartInstanceModel'
import { getCurrentTime } from '../../../lib'
import { protectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { queuePartInstanceTimingEvent } from '../../timings/events'
import { IS_PRODUCTION } from '../../../environment'
import { DeferredAfterSaveFunction, DeferredFunction, PlayoutModel, PlayoutModelReadonly } from '../PlayoutModel'
import { writePartInstancesAndPieceInstances, writeScratchpadSegments } from './SavePlayoutModel'
import { PlayoutPieceInstanceModel } from '../PlayoutPieceInstanceModel'
import { DatabasePersistedModel } from '../../../modelBase'
import { ExpectedPackageDBFromStudioBaselineObjects } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { ExpectedPlayoutItemStudio } from '@sofie-automation/corelib/dist/dataModel/ExpectedPlayoutItem'
import { StudioBaselineHelper } from '../../../studio/model/StudioBaselineHelper'
import { EventsJobs } from '@sofie-automation/corelib/dist/worker/events'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { ReadonlyObjectDeep } from 'type-fest/source/readonly-deep'
import { IBlueprintMutatablePart } from '@sofie-automation/blueprints-integration'

export class PlayoutModelReadonlyImpl implements PlayoutModelReadonly {
	public readonly playlistId: RundownPlaylistId

	public readonly playlistLock: PlaylistLock

	public readonly peripheralDevices: ReadonlyDeep<PeripheralDevice[]>

	protected readonly playlistImpl: DBRundownPlaylist
	public get playlist(): ReadonlyDeep<DBRundownPlaylist> {
		return this.playlistImpl
	}

	protected readonly rundownsImpl: readonly PlayoutRundownModelImpl[]
	public get rundowns(): readonly PlayoutRundownModel[] {
		return this.rundownsImpl
	}

	protected timelineImpl: TimelineComplete | null
	public get timeline(): TimelineComplete | null {
		return this.timelineImpl
	}

	protected allPartInstances: Map<PartInstanceId, PlayoutPartInstanceModelImpl | null>

	public constructor(
		protected readonly context: JobContext,
		playlistLock: PlaylistLock,
		playlistId: RundownPlaylistId,
		peripheralDevices: ReadonlyDeep<PeripheralDevice[]>,
		playlist: DBRundownPlaylist,
		partInstances: PlayoutPartInstanceModelImpl[],
		rundowns: PlayoutRundownModelImpl[],
		timeline: TimelineComplete | undefined
	) {
		this.playlistId = playlistId
		this.playlistLock = playlistLock

		this.peripheralDevices = peripheralDevices
		this.playlistImpl = playlist

		this.rundownsImpl = rundowns

		this.timelineImpl = timeline ?? null

		this.allPartInstances = normalizeArrayToMapFunc(partInstances, (p) => p.partInstance._id)
	}

	public get olderPartInstances(): PlayoutPartInstanceModel[] {
		const allPartInstances = this.loadedPartInstances

		const ignoreIds = new Set(this.selectedPartInstanceIds)

		return allPartInstances.filter((partInstance) => !ignoreIds.has(partInstance.partInstance._id))
	}
	public get previousPartInstance(): PlayoutPartInstanceModel | null {
		if (!this.playlist.previousPartInfo?.partInstanceId) return null
		const partInstance = this.allPartInstances.get(this.playlist.previousPartInfo.partInstanceId)
		if (!partInstance) return null // throw new Error('PreviousPartInstance is missing')
		return partInstance
	}
	public get currentPartInstance(): PlayoutPartInstanceModel | null {
		if (!this.playlist.currentPartInfo?.partInstanceId) return null
		const partInstance = this.allPartInstances.get(this.playlist.currentPartInfo.partInstanceId)
		if (!partInstance) return null // throw new Error('CurrentPartInstance is missing')
		return partInstance
	}
	public get nextPartInstance(): PlayoutPartInstanceModel | null {
		if (!this.playlist.nextPartInfo?.partInstanceId) return null
		const partInstance = this.allPartInstances.get(this.playlist.nextPartInfo.partInstanceId)
		if (!partInstance) return null // throw new Error('NextPartInstance is missing')
		return partInstance
	}

	public get selectedPartInstanceIds(): PartInstanceId[] {
		return _.compact([
			this.playlist.previousPartInfo?.partInstanceId,
			this.playlist.currentPartInfo?.partInstanceId,
			this.playlist.nextPartInfo?.partInstanceId,
		])
	}

	public get selectedPartInstances(): PlayoutPartInstanceModel[] {
		return _.compact([this.currentPartInstance, this.previousPartInstance, this.nextPartInstance])
	}

	public get loadedPartInstances(): PlayoutPartInstanceModel[] {
		return Array.from(this.allPartInstances.values()).filter((v): v is PlayoutPartInstanceModelImpl => v !== null)
	}

	public get sortedLoadedPartInstances(): PlayoutPartInstanceModel[] {
		const allInstances = this.loadedPartInstances
		allInstances.sort((a, b) => a.partInstance.takeCount - b.partInstance.takeCount)

		return allInstances
	}

	public getPartInstance(partInstanceId: PartInstanceId): PlayoutPartInstanceModel | undefined {
		return this.allPartInstances.get(partInstanceId) ?? undefined
	}

	/**
	 * Search for a Part through the whole Playlist
	 * @param id
	 */
	findPart(id: PartId): ReadonlyDeep<DBPart> | undefined {
		for (const rundown of this.rundowns) {
			for (const segment of rundown.segments) {
				const part = segment.getPart(id)
				if (part) return part
			}
		}

		return undefined
	}
	getAllOrderedParts(): ReadonlyDeep<DBPart>[] {
		return this.rundowns.flatMap((rundown) => rundown.getAllOrderedParts())
	}

	findSegment(id: SegmentId): ReadonlyDeep<PlayoutSegmentModel> | undefined {
		for (const rundown of this.rundowns) {
			const segment = rundown.getSegment(id)
			if (segment) return segment
		}

		return undefined
	}
	getAllOrderedSegments(): ReadonlyDeep<PlayoutSegmentModel>[] {
		return this.rundowns.flatMap((rundown) => rundown.segments)
	}

	getRundown(id: RundownId): PlayoutRundownModel | undefined {
		return this.rundowns.find((rundown) => rundown.rundown._id === id)
	}
	getRundownIds(): RundownId[] {
		return sortRundownIDsInPlaylist(
			this.playlist.rundownIdsInOrder,
			this.rundowns.map((rd) => rd.rundown._id)
		)
	}

	findPieceInstance(
		id: PieceInstanceId
	): { partInstance: PlayoutPartInstanceModel; pieceInstance: PlayoutPieceInstanceModel } | undefined {
		for (const partInstance of this.loadedPartInstances) {
			const pieceInstance = partInstance.getPieceInstance(id)
			if (pieceInstance) return { partInstance, pieceInstance }
		}

		return undefined
	}

	#isMultiGatewayMode: boolean | undefined = undefined
	public get isMultiGatewayMode(): boolean {
		if (this.#isMultiGatewayMode === undefined) {
			if (this.context.studio.settings.forceMultiGatewayMode) {
				this.#isMultiGatewayMode = true
			} else {
				const playoutDevices = this.peripheralDevices.filter(
					(device) => device.type === PeripheralDeviceType.PLAYOUT
				)
				this.#isMultiGatewayMode = playoutDevices.length > 1
			}
		}
		return this.#isMultiGatewayMode
	}
}

/**
 * This is a model used for playout operations.
 * It contains everything that is needed to generate the timeline, and everything except for pieces needed to update the partinstances.
 * Anything not in this model should not be needed often, and only for specific operations (eg, AdlibActions needed to run one).
 */
export class PlayoutModelImpl extends PlayoutModelReadonlyImpl implements PlayoutModel, DatabasePersistedModel {
	readonly #baselineHelper: StudioBaselineHelper

	#deferredBeforeSaveFunctions: DeferredFunction[] = []
	#deferredAfterSaveFunctions: DeferredAfterSaveFunction[] = []
	#disposed = false

	#playlistHasChanged = false
	#timelineHasChanged = false

	#pendingPartInstanceTimingEvents = new Set<PartInstanceId>()
	#pendingNotifyCurrentlyPlayingPartEvent = new Map<RundownId, string | null>()

	get hackDeletedPartInstanceIds(): PartInstanceId[] {
		const result: PartInstanceId[] = []
		for (const [id, doc] of this.allPartInstances) {
			if (!doc) result.push(id)
		}
		return result
	}

	public constructor(
		context: JobContext,
		playlistLock: PlaylistLock,
		playlistId: RundownPlaylistId,
		peripheralDevices: ReadonlyDeep<PeripheralDevice[]>,
		playlist: DBRundownPlaylist,
		partInstances: PlayoutPartInstanceModelImpl[],
		rundowns: PlayoutRundownModelImpl[],
		timeline: TimelineComplete | undefined
	) {
		super(context, playlistLock, playlistId, peripheralDevices, playlist, partInstances, rundowns, timeline)
		context.trackCache(this)

		this.#baselineHelper = new StudioBaselineHelper(context)
	}

	public get displayName(): string {
		return `PlayoutModel "${this.playlistId}"`
	}

	activatePlaylist(rehearsal: boolean): RundownPlaylistActivationId {
		this.playlistImpl.activationId = getRandomId()
		this.playlistImpl.rehearsal = rehearsal

		this.#playlistHasChanged = true

		return this.playlistImpl.activationId
	}

	clearSelectedPartInstances(): void {
		this.playlistImpl.currentPartInfo = null
		this.playlistImpl.nextPartInfo = null
		this.playlistImpl.previousPartInfo = null
		this.playlistImpl.holdState = RundownHoldState.NONE

		delete this.playlistImpl.lastTakeTime
		delete this.playlistImpl.queuedSegmentId

		this.#playlistHasChanged = true
	}

	clearQuickLoopMarkers(): void {
		if (!this.playlistImpl.quickLoop || this.playlistImpl.quickLoop.locked) return

		this.playlistImpl.quickLoop.start = undefined
		this.playlistImpl.quickLoop.end = undefined
		this.playlistImpl.quickLoop.running = false

		this.#playlistHasChanged = true
	}

	#fixupPieceInstancesForPartInstance(partInstance: DBPartInstance, pieceInstances: PieceInstance[]): void {
		for (const pieceInstance of pieceInstances) {
			// Future: should these be PieceInstance already, or should that be handled here?
			pieceInstance._id = getPieceInstanceIdForPiece(partInstance._id, pieceInstance.piece._id)
			pieceInstance.partInstanceId = partInstance._id
		}
	}

	createAdlibbedPartInstance(
		part: Omit<DBPart, 'segmentId' | 'rundownId'>,
		pieces: Omit<PieceInstancePiece, 'startPartId'>[],
		fromAdlibId: PieceId | undefined,
		infinitePieceInstances: PieceInstance[]
	): PlayoutPartInstanceModel {
		const currentPartInstance = this.currentPartInstance
		if (!currentPartInstance) throw new Error('No currentPartInstance')

		const newPartInstance: DBPartInstance = {
			_id: getRandomId(),
			rundownId: currentPartInstance.partInstance.rundownId,
			segmentId: currentPartInstance.partInstance.segmentId,
			playlistActivationId: currentPartInstance.partInstance.playlistActivationId,
			segmentPlayoutId: currentPartInstance.partInstance.segmentPlayoutId,
			takeCount: currentPartInstance.partInstance.takeCount + 1,
			rehearsal: currentPartInstance.partInstance.rehearsal,
			orphaned: 'adlib-part',
			part: {
				...part,
				rundownId: currentPartInstance.partInstance.rundownId,
				segmentId: currentPartInstance.partInstance.segmentId,
			},
		}

		this.#fixupPieceInstancesForPartInstance(newPartInstance, infinitePieceInstances)

		const partInstance = new PlayoutPartInstanceModelImpl(newPartInstance, infinitePieceInstances, true)

		for (const piece of pieces) {
			partInstance.insertAdlibbedPiece(piece, fromAdlibId)
		}

		partInstance.recalculateExpectedDurationWithPreroll()

		this.allPartInstances.set(newPartInstance._id, partInstance)

		return partInstance
	}

	createInstanceForPart(nextPart: ReadonlyDeep<DBPart>, pieceInstances: PieceInstance[]): PlayoutPartInstanceModel {
		const playlistActivationId = this.playlist.activationId
		if (!playlistActivationId) throw new Error(`Playlist is not active`)

		const currentPartInstance = this.currentPartInstance

		const newTakeCount = currentPartInstance ? currentPartInstance.partInstance.takeCount + 1 : 0 // Increment
		const segmentPlayoutId: SegmentPlayoutId =
			currentPartInstance && nextPart.segmentId === currentPartInstance.partInstance.segmentId
				? currentPartInstance.partInstance.segmentPlayoutId
				: getRandomId()

		const newPartInstance: DBPartInstance = {
			_id: protectString<PartInstanceId>(`${nextPart._id}_${getRandomId()}`),
			rundownId: nextPart.rundownId,
			segmentId: nextPart.segmentId,
			playlistActivationId: playlistActivationId,
			segmentPlayoutId,
			takeCount: newTakeCount,
			rehearsal: !!this.playlist.rehearsal,
			part: clone<DBPart>(nextPart),
			timings: {
				setAsNext: getCurrentTime(),
			},
		}

		this.#fixupPieceInstancesForPartInstance(newPartInstance, pieceInstances)

		const partInstance = new PlayoutPartInstanceModelImpl(newPartInstance, pieceInstances, true)
		partInstance.recalculateExpectedDurationWithPreroll()

		this.allPartInstances.set(newPartInstance._id, partInstance)

		return partInstance
	}

	createScratchpadPartInstance(
		rundown: PlayoutRundownModel,
		part: Omit<DBPart, 'segmentId' | 'rundownId'>
	): PlayoutPartInstanceModel {
		const currentPartInstance = this.currentPartInstance
		if (currentPartInstance) throw new Error('Scratchpad can only be used before the first take')

		const scratchpadSegment = rundown.getScratchpadSegment()
		if (!scratchpadSegment) throw new Error('No scratchpad segment')
		if (this.loadedPartInstances.find((p) => p.partInstance.segmentId === scratchpadSegment.segment._id))
			throw new Error('Scratchpad segment already has content')

		const activationId = this.playlist.activationId
		if (!activationId) throw new Error('Playlist is not active')

		const newPartInstance: DBPartInstance = {
			_id: getRandomId(),
			rundownId: rundown.rundown._id,
			segmentId: scratchpadSegment.segment._id,
			playlistActivationId: activationId,
			segmentPlayoutId: getRandomId(),
			takeCount: 1,
			rehearsal: !!this.playlist.rehearsal,
			orphaned: 'adlib-part',
			part: {
				...part,
				rundownId: rundown.rundown._id,
				segmentId: scratchpadSegment.segment._id,
			},
		}

		const partInstance = new PlayoutPartInstanceModelImpl(newPartInstance, [], true)
		partInstance.recalculateExpectedDurationWithPreroll()

		this.allPartInstances.set(newPartInstance._id, partInstance)

		return partInstance
	}

	cycleSelectedPartInstances(): void {
		this.playlistImpl.previousPartInfo = this.playlistImpl.currentPartInfo
		this.playlistImpl.currentPartInfo = this.playlistImpl.nextPartInfo
		this.playlistImpl.nextPartInfo = null
		this.playlistImpl.lastTakeTime = getCurrentTime()

		if (!this.playlistImpl.holdState || this.playlistImpl.holdState === RundownHoldState.COMPLETE) {
			this.playlistImpl.holdState = RundownHoldState.NONE
		} else {
			this.playlistImpl.holdState = this.playlistImpl.holdState + 1
		}

		this.#playlistHasChanged = true
	}

	updateQuickLoopState(): void {
		if (this.playlistImpl.quickLoop == null) return
		const wasLoopRunning = this.playlistImpl.quickLoop.running

		if (
			this.playlistImpl.quickLoop.end?.type === QuickLoopMarkerType.PART &&
			this.playlistImpl.quickLoop.end?.overridenId &&
			this.playlistImpl.quickLoop.end?.id !== this.currentPartInstance?.partInstance.part._id &&
			this.playlistImpl.quickLoop.end?.id !== this.nextPartInstance?.partInstance.part._id
		) {
			this.playlistImpl.quickLoop.end.id = this.playlistImpl.quickLoop.end.overridenId
			delete this.playlistImpl.quickLoop.end.overridenId
		}

		let isNextBetweenMarkers = false
		if (this.playlistImpl.quickLoop.start == null || this.playlistImpl.quickLoop.end == null) {
			this.playlistImpl.quickLoop.running = false
		} else {
			const orderedParts = this.getAllOrderedParts()

			const rundownIds = this.getRundownIds()
			type Positions = {
				partRank: number
				segmentRank: number
				rundownRank: number
			}
			const findMarkerPosition = (marker: QuickLoopMarker, type: 'start' | 'end'): Positions => {
				let part: ReadonlyObjectDeep<DBPart> | undefined
				let segment: ReadonlyObjectDeep<DBSegment> | undefined
				let rundownRank
				if (marker.type === QuickLoopMarkerType.PART) {
					const partId = marker.id
					const partIndex = orderedParts.findIndex((part) => part._id === partId)
					part = orderedParts[partIndex]
				}
				if (marker.type === QuickLoopMarkerType.SEGMENT) {
					segment = this.findSegment(marker.id)?.segment
				} else if (part != null) {
					segment = this.findSegment(part.segmentId)?.segment
				}
				if (marker.type === QuickLoopMarkerType.RUNDOWN) {
					rundownRank = rundownIds.findIndex((id) => id === marker.id)
				} else if (part ?? segment != null) {
					rundownRank = rundownIds.findIndex((id) => id === (part ?? segment)?.rundownId)
				}
				const fallback = type === 'start' ? -Infinity : Infinity
				return {
					partRank: part?._rank ?? fallback,
					segmentRank: segment?._rank ?? fallback,
					rundownRank: rundownRank ?? fallback,
				}
			}

			const startPosition = findMarkerPosition(this.playlistImpl.quickLoop.start, 'start')
			const endPosition = findMarkerPosition(this.playlistImpl.quickLoop.end, 'end')

			const comparePositions = (a: Positions, b: Positions): number => {
				if (a.rundownRank > b.rundownRank) return -1
				if (a.rundownRank < b.rundownRank) return 1
				if (a.segmentRank > b.segmentRank) return -1
				if (a.segmentRank < b.segmentRank) return 1
				if (a.partRank > b.partRank) return -1
				if (a.partRank < b.partRank) return 1
				return 0
			}

			const extractPartPosition = (partInstance: PlayoutPartInstanceModel) => {
				const currentSegment = this.findSegment(partInstance.partInstance.segmentId)?.segment
				const currentRundownIndex = rundownIds.findIndex((id) => id === partInstance.partInstance.rundownId)

				return {
					partRank: partInstance.partInstance.part._rank,
					segmentRank: currentSegment?._rank ?? 0,
					rundownRank: currentRundownIndex ?? 0,
				}
			}

			const currentPartPosition: Positions | undefined = this.currentPartInstance
				? extractPartPosition(this.currentPartInstance)
				: undefined
			const nextPartPosition: Positions | undefined = this.nextPartInstance
				? extractPartPosition(this.nextPartInstance)
				: undefined

			const isCurrentBetweenMarkers = currentPartPosition
				? comparePositions(startPosition, currentPartPosition) >= 0 &&
				  comparePositions(currentPartPosition, endPosition) >= 0
				: false
			isNextBetweenMarkers = nextPartPosition
				? comparePositions(startPosition, nextPartPosition) >= 0 &&
				  comparePositions(nextPartPosition, endPosition) >= 0
				: false

			if (this.nextPartInstance && isNextBetweenMarkers) {
				updatePartOverrides(this.nextPartInstance, this.playlistImpl.quickLoop.forceAutoNext)
			}

			this.playlistImpl.quickLoop.running =
				this.playlistImpl.quickLoop.start != null &&
				this.playlistImpl.quickLoop.end != null &&
				isCurrentBetweenMarkers
		}

		if (this.currentPartInstance && this.playlistImpl.quickLoop.running) {
			updatePartOverrides(this.currentPartInstance, this.playlistImpl.quickLoop.forceAutoNext)
		} else if (this.currentPartInstance && wasLoopRunning) {
			revertPartOverrides(this.currentPartInstance)
		}

		if (this.nextPartInstance && !isNextBetweenMarkers) {
			revertPartOverrides(this.nextPartInstance)
		}

		if (wasLoopRunning && !this.playlistImpl.quickLoop.running) {
			// clears the loop markers after leaving the loop, as per the requirements, but perhaps it should be optional
			delete this.playlistImpl.quickLoop
		}
		this.#playlistHasChanged = true

		function updatePartOverrides(partInstance: PlayoutPartInstanceModel, forceAutoNext: ForceQuickLoopAutoNext) {
			const partPropsToUpdate: Partial<IBlueprintMutatablePart> = {}
			if (
				!partInstance.partInstance.part.expectedDuration &&
				forceAutoNext === ForceQuickLoopAutoNext.ENABLED_FORCING_MIN_DURATION
			) {
				partPropsToUpdate.expectedDuration = 3000 // TODO: where to take the default duration from?
			}
			if (
				(partInstance.partInstance.part.expectedDuration || partPropsToUpdate.expectedDuration) &&
				forceAutoNext !== ForceQuickLoopAutoNext.DISABLED &&
				!partInstance.partInstance.part.autoNext
			) {
				partPropsToUpdate.autoNext = true
			}
			if (Object.keys(partPropsToUpdate).length) {
				partInstance.overridePartProps(partPropsToUpdate)
				if (partPropsToUpdate.expectedDuration) partInstance.recalculateExpectedDurationWithPreroll()
			}
		}

		function revertPartOverrides(partInstance: PlayoutPartInstanceModel) {
			const overridenProperties = partInstance.partInstance.part.overridenProperties
			if (overridenProperties) {
				partInstance.revertOverridenPartProps()
				if (overridenProperties.expectedDuration) {
					partInstance.recalculateExpectedDurationWithPreroll()
				}
			}
		}
	}

	deactivatePlaylist(): void {
		delete this.playlistImpl.activationId

		this.clearSelectedPartInstances()
		this.clearQuickLoopMarkers()

		this.#playlistHasChanged = true
	}

	queuePartInstanceTimingEvent(partInstanceId: PartInstanceId): void {
		this.#pendingPartInstanceTimingEvents.add(partInstanceId)
	}

	queueNotifyCurrentlyPlayingPartEvent(rundownId: RundownId, partInstance: PlayoutPartInstanceModel | null): void {
		if (partInstance && partInstance.partInstance.part.shouldNotifyCurrentPlayingPart) {
			this.#pendingNotifyCurrentlyPlayingPartEvent.set(rundownId, partInstance.partInstance.part.externalId)
		} else if (!partInstance) {
			this.#pendingNotifyCurrentlyPlayingPartEvent.set(rundownId, null)
		}
	}

	removeAllRehearsalPartInstances(): void {
		const partInstancesToRemove: PartInstanceId[] = []

		for (const [id, partInstance] of this.allPartInstances.entries()) {
			if (partInstance?.partInstance.rehearsal) {
				this.allPartInstances.set(id, null)
				partInstancesToRemove.push(id)
			}
		}

		// Defer ones which arent loaded
		this.deferAfterSave(async (playoutModel) => {
			const rundownIds = playoutModel.getRundownIds()
			// We need to keep any for PartInstances which are still existent in the model (as they werent removed)
			const partInstanceIdsInModel = playoutModel.loadedPartInstances.map((p) => p.partInstance._id)

			// Find all the partInstances which are not loaded, but should be removed
			const removeFromDb = await this.context.directCollections.PartInstances.findFetch(
				{
					// Not any which are in the model, as they have already been done if needed
					_id: { $nin: partInstanceIdsInModel },
					rundownId: { $in: rundownIds },
					rehearsal: true,
				},
				{ projection: { _id: 1 } }
			).then((ps) => ps.map((p) => p._id))

			// Do the remove
			const allToRemove = [...removeFromDb, ...partInstancesToRemove]
			await Promise.all([
				removeFromDb.length > 0
					? this.context.directCollections.PartInstances.remove({
							_id: { $in: removeFromDb },
							rundownId: { $in: rundownIds },
					  })
					: undefined,
				allToRemove.length > 0
					? this.context.directCollections.PieceInstances.remove({
							partInstanceId: { $in: allToRemove },
							rundownId: { $in: rundownIds },
					  })
					: undefined,
			])
		})
	}

	removeUntakenPartInstances(): void {
		for (const partInstance of this.olderPartInstances) {
			if (!partInstance.partInstance.isTaken) {
				this.allPartInstances.set(partInstance.partInstance._id, null)
			}
		}
	}

	/**
	 * Reset the playlist for playout
	 */
	resetPlaylist(regenerateActivationId: boolean): void {
		this.playlistImpl.previousPartInfo = null
		this.playlistImpl.currentPartInfo = null
		this.playlistImpl.nextPartInfo = null
		this.playlistImpl.holdState = RundownHoldState.NONE
		this.playlistImpl.resetTime = getCurrentTime()

		delete this.playlistImpl.lastTakeTime
		delete this.playlistImpl.startedPlayback
		delete this.playlistImpl.rundownsStartedPlayback
		delete this.playlistImpl.previousPersistentState
		delete this.playlistImpl.trackedAbSessions
		delete this.playlistImpl.queuedSegmentId

		if (regenerateActivationId) this.playlistImpl.activationId = getRandomId()

		this.#playlistHasChanged = true
	}

	async saveAllToDatabase(): Promise<void> {
		if (this.#disposed) {
			throw new Error('Cannot save disposed PlayoutModel')
		}

		// TODO - ideally we should make sure to preserve the lock during this operation
		if (!this.playlistLock.isLocked) {
			throw new Error('Cannot save changes with released playlist lock')
		}

		const span = this.context.startSpan('PlayoutModelImpl.saveAllToDatabase')

		// Execute deferBeforeSave()'s
		for (const fn of this.#deferredBeforeSaveFunctions) {
			await fn(this as any)
		}
		this.#deferredBeforeSaveFunctions.length = 0 // clear the array

		// Prioritise the timeline for publication reasons
		if (this.#timelineHasChanged && this.timelineImpl) {
			await this.context.directCollections.Timelines.replace(this.timelineImpl)
			if (!process.env.JEST_WORKER_ID) {
				// Wait a little bit before saving the rest.
				// The idea is that this allows for the high priority publications to update (such as the Timeline),
				// sending the updated timeline to Playout-gateway
				await sleep(2)
			}
		}
		this.#timelineHasChanged = false

		await Promise.all([
			this.#playlistHasChanged
				? this.context.directCollections.RundownPlaylists.replace(this.playlistImpl)
				: undefined,
			...writePartInstancesAndPieceInstances(this.context, this.allPartInstances),
			writeScratchpadSegments(this.context, this.rundownsImpl),
			this.#baselineHelper.saveAllToDatabase(),
		])

		this.#playlistHasChanged = false

		// Execute deferAfterSave()'s
		for (const fn of this.#deferredAfterSaveFunctions) {
			await fn(this as any)
		}
		this.#deferredAfterSaveFunctions.length = 0 // clear the array

		for (const partInstanceId of this.#pendingPartInstanceTimingEvents) {
			// Run in the background, we don't want to hold onto the lock to do this
			queuePartInstanceTimingEvent(this.context, this.playlistId, partInstanceId)
		}
		this.#pendingPartInstanceTimingEvents.clear()

		for (const [rundownId, partExternalId] of this.#pendingNotifyCurrentlyPlayingPartEvent) {
			// This is low-prio, defer so that it's executed well after publications has been updated,
			// so that the playout gateway has had the chance to learn about the timeline changes
			this.context
				.queueEventJob(EventsJobs.NotifyCurrentlyPlayingPart, {
					rundownId: rundownId,
					isRehearsal: !!this.playlist.rehearsal,
					partExternalId: partExternalId,
				})
				.catch((e) => {
					logger.warn(`Failed to queue NotifyCurrentlyPlayingPart job: ${e}`)
				})
		}
		this.#pendingNotifyCurrentlyPlayingPartEvent.clear()

		if (span) span.end()
	}

	setHoldState(newState: RundownHoldState): void {
		this.playlistImpl.holdState = newState

		this.#playlistHasChanged = true
	}

	setOnTimelineGenerateResult(
		persistentState: unknown | undefined,
		assignedAbSessions: Record<string, ABSessionAssignments>,
		trackedAbSessions: ABSessionInfo[]
	): void {
		this.playlistImpl.previousPersistentState = persistentState
		this.playlistImpl.assignedAbSessions = assignedAbSessions
		this.playlistImpl.trackedAbSessions = trackedAbSessions

		this.#playlistHasChanged = true
	}

	setPartInstanceAsNext(
		partInstance: PlayoutPartInstanceModel | null,
		setManually: boolean,
		consumesQueuedSegmentId: boolean,
		nextTimeOffset?: number
	): void {
		if (partInstance) {
			const storedPartInstance = this.allPartInstances.get(partInstance.partInstance._id)
			if (!storedPartInstance) throw new Error(`PartInstance being set as next was not constructed correctly`)
			// Make sure we were given the exact same object
			if (storedPartInstance !== partInstance) throw new Error(`PartInstance being set as next is not current`)
		}

		if (partInstance) {
			this.playlistImpl.nextPartInfo = literal<SelectedPartInstance>({
				partInstanceId: partInstance.partInstance._id,
				rundownId: partInstance.partInstance.rundownId,
				manuallySelected: !!(setManually || partInstance.partInstance.orphaned),
				consumesQueuedSegmentId,
			})
			this.playlistImpl.nextTimeOffset = nextTimeOffset || null
		} else {
			this.playlistImpl.nextPartInfo = null
			this.playlistImpl.nextTimeOffset = null
		}

		this.#playlistHasChanged = true
	}

	setQueuedSegment(segment: PlayoutSegmentModel | null): void {
		this.playlistImpl.queuedSegmentId = segment?.segment?._id ?? undefined

		this.#playlistHasChanged = true
	}

	setRundownStartedPlayback(rundownId: RundownId, timestamp: number): void {
		if (!this.playlistImpl.rundownsStartedPlayback) {
			this.playlistImpl.rundownsStartedPlayback = {}
		}

		// If the partInstance is "untimed", it will not update the playlist's startedPlayback and will not count time in the GUI:
		const rundownIdStr = unprotectString(rundownId)
		if (!this.playlistImpl.rundownsStartedPlayback[rundownIdStr]) {
			this.playlistImpl.rundownsStartedPlayback[rundownIdStr] = timestamp
		}

		if (!this.playlistImpl.startedPlayback) {
			this.playlistImpl.startedPlayback = timestamp
		}

		this.#playlistHasChanged = true
	}

	setTimeline(timelineObjs: TimelineObjGeneric[], generationVersions: TimelineCompleteGenerationVersions): void {
		this.timelineImpl = {
			_id: this.context.studioId,
			timelineHash: getRandomId(), // randomized on every timeline change
			generated: getCurrentTime(),
			timelineBlob: serializeTimelineBlob(timelineObjs),
			generationVersions: generationVersions,
		}
		this.#timelineHasChanged = true
	}

	setExpectedPackagesForStudioBaseline(packages: ExpectedPackageDBFromStudioBaselineObjects[]): void {
		this.#baselineHelper.setExpectedPackages(packages)
	}
	setExpectedPlayoutItemsForStudioBaseline(playoutItems: ExpectedPlayoutItemStudio[]): void {
		this.#baselineHelper.setExpectedPlayoutItems(playoutItems)
	}

	setQuickLoopMarker(type: 'start' | 'end', marker: QuickLoopMarker | null): void {
		if (this.playlistImpl.quickLoop?.locked) {
			throw new Error('Looping is locked')
		}
		this.playlistImpl.quickLoop = {
			running: false,
			locked: false,
			...this.playlistImpl.quickLoop,
			forceAutoNext: this.context.studio.settings.forceQuickLoopAutoNext ?? ForceQuickLoopAutoNext.DISABLED,
		}
		if (type === 'start') {
			if (marker == null) {
				delete this.playlistImpl.quickLoop.start
			} else {
				this.playlistImpl.quickLoop.start = marker
			}
		} else {
			if (marker == null) {
				delete this.playlistImpl.quickLoop.end
			} else {
				this.playlistImpl.quickLoop.end = marker
			}
		}

		this.updateQuickLoopState()
		this.#playlistHasChanged = true
	}

	/** Lifecycle */

	/** @deprecated */
	deferBeforeSave(fcn: DeferredFunction): void {
		this.#deferredBeforeSaveFunctions.push(fcn)
	}
	/** @deprecated */
	deferAfterSave(fcn: DeferredAfterSaveFunction): void {
		this.#deferredAfterSaveFunctions.push(fcn)
	}

	/** BaseModel */

	/**
	 * Assert that no changes should have been made to the model, will throw an Error otherwise. This can be used in
	 * place of `saveAllToDatabase()`, when the code controlling the model expects no changes to have been made and any
	 * changes made are an error and will cause issues.
	 */
	assertNoChanges(): void {
		const span = this.context.startSpan('PlayoutModelImpl.assertNoChanges')

		function logOrThrowError(error: Error) {
			if (!IS_PRODUCTION) {
				throw error
			} else {
				logger.error(error)
			}
		}

		if (this.#deferredBeforeSaveFunctions.length > 0)
			logOrThrowError(
				new Error(
					`Failed no changes in model assertion, there were ${
						this.#deferredBeforeSaveFunctions.length
					} deferred functions`
				)
			)

		if (this.#deferredAfterSaveFunctions.length > 0)
			logOrThrowError(
				new Error(
					`Failed no changes in model assertion, there were ${
						this.#deferredAfterSaveFunctions.length
					} after-save deferred functions`
				)
			)

		if (this.#timelineHasChanged)
			logOrThrowError(new Error(`Failed no changes in model assertion, Timeline has been changed`))

		if (this.#playlistHasChanged)
			logOrThrowError(new Error(`Failed no changes in model assertion, Playlist has been changed`))

		if (this.rundownsImpl.find((rd) => rd.ScratchPadSegmentHasChanged))
			logOrThrowError(new Error(`Failed no changes in model assertion, a scratchpad Segment has been changed`))

		if (
			Array.from(this.allPartInstances.values()).find(
				(part) => !part || part.partInstanceHasChanges || part.changedPieceInstanceIds().length > 0
			)
		)
			logOrThrowError(new Error(`Failed no changes in model assertion, a PartInstance has been changed`))

		if (span) span.end()
	}

	/**
	 * Discards all documents in this model, and marks it as unusable
	 */
	dispose(): void {
		this.#disposed = true

		// Discard any hooks too
		this.#deferredAfterSaveFunctions.length = 0
		this.#deferredBeforeSaveFunctions.length = 0
	}
}
