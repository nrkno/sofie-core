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

export class PlayoutModelReadonlyImpl implements PlayoutModelReadonly {
	public readonly PlaylistId: RundownPlaylistId

	public readonly PlaylistLock: PlaylistLock

	public readonly PeripheralDevices: ReadonlyDeep<PeripheralDevice[]>

	protected readonly PlaylistImpl: DBRundownPlaylist
	public get Playlist(): ReadonlyDeep<DBRundownPlaylist> {
		return this.PlaylistImpl
	}

	protected readonly RundownsImpl: readonly PlayoutRundownModelImpl[]
	public get Rundowns(): readonly PlayoutRundownModel[] {
		return this.RundownsImpl
	}

	protected TimelineImpl: TimelineComplete | null
	public get Timeline(): TimelineComplete | null {
		return this.TimelineImpl
	}

	protected AllPartInstances: Map<PartInstanceId, PlayoutPartInstanceModelImpl | null>

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
		this.PlaylistId = playlistId
		this.PlaylistLock = playlistLock

		this.PeripheralDevices = peripheralDevices
		this.PlaylistImpl = playlist

		this.RundownsImpl = rundowns

		this.TimelineImpl = timeline ?? null

		this.AllPartInstances = normalizeArrayToMapFunc(partInstances, (p) => p.PartInstance._id)
	}

	public get OlderPartInstances(): PlayoutPartInstanceModel[] {
		const allPartInstances = this.LoadedPartInstances

		const ignoreIds = new Set(this.SelectedPartInstanceIds)

		return allPartInstances.filter((partInstance) => !ignoreIds.has(partInstance.PartInstance._id))
	}
	public get PreviousPartInstance(): PlayoutPartInstanceModel | null {
		if (!this.Playlist.previousPartInfo?.partInstanceId) return null
		const partInstance = this.AllPartInstances.get(this.Playlist.previousPartInfo.partInstanceId)
		if (!partInstance) return null // throw new Error('PreviousPartInstance is missing')
		return partInstance
	}
	public get CurrentPartInstance(): PlayoutPartInstanceModel | null {
		if (!this.Playlist.currentPartInfo?.partInstanceId) return null
		const partInstance = this.AllPartInstances.get(this.Playlist.currentPartInfo.partInstanceId)
		if (!partInstance) return null // throw new Error('CurrentPartInstance is missing')
		return partInstance
	}
	public get NextPartInstance(): PlayoutPartInstanceModel | null {
		if (!this.Playlist.nextPartInfo?.partInstanceId) return null
		const partInstance = this.AllPartInstances.get(this.Playlist.nextPartInfo.partInstanceId)
		if (!partInstance) return null // throw new Error('NextPartInstance is missing')
		return partInstance
	}

	public get SelectedPartInstanceIds(): PartInstanceId[] {
		return _.compact([
			this.Playlist.previousPartInfo?.partInstanceId,
			this.Playlist.currentPartInfo?.partInstanceId,
			this.Playlist.nextPartInfo?.partInstanceId,
		])
	}

	public get SelectedPartInstances(): PlayoutPartInstanceModel[] {
		return _.compact([this.CurrentPartInstance, this.PreviousPartInstance, this.NextPartInstance])
	}

	public get LoadedPartInstances(): PlayoutPartInstanceModel[] {
		return Array.from(this.AllPartInstances.values()).filter((v): v is PlayoutPartInstanceModelImpl => v !== null)
	}

	public get SortedLoadedPartInstances(): PlayoutPartInstanceModel[] {
		const allInstances = this.LoadedPartInstances
		allInstances.sort((a, b) => a.PartInstance.takeCount - b.PartInstance.takeCount)

		return allInstances
	}

	public getPartInstance(partInstanceId: PartInstanceId): PlayoutPartInstanceModel | undefined {
		return this.AllPartInstances.get(partInstanceId) ?? undefined
	}

	/**
	 * Search for a Part through the whole Playlist
	 * @param id
	 */
	findPart(id: PartId): ReadonlyDeep<DBPart> | undefined {
		for (const rundown of this.Rundowns) {
			for (const segment of rundown.Segments) {
				const part = segment.getPart(id)
				if (part) return part
			}
		}

		return undefined
	}
	getAllOrderedParts(): ReadonlyDeep<DBPart>[] {
		return this.Rundowns.flatMap((rundown) => rundown.getAllOrderedParts())
	}

	findSegment(id: SegmentId): ReadonlyDeep<PlayoutSegmentModel> | undefined {
		for (const rundown of this.Rundowns) {
			const segment = rundown.getSegment(id)
			if (segment) return segment
		}

		return undefined
	}
	getAllOrderedSegments(): ReadonlyDeep<PlayoutSegmentModel>[] {
		return this.Rundowns.flatMap((rundown) => rundown.Segments)
	}

	getRundown(id: RundownId): PlayoutRundownModel | undefined {
		return this.Rundowns.find((rundown) => rundown.Rundown._id === id)
	}
	getRundownIds(): RundownId[] {
		return sortRundownIDsInPlaylist(
			this.Playlist.rundownIdsInOrder,
			this.Rundowns.map((rd) => rd.Rundown._id)
		)
	}

	findPieceInstance(
		id: PieceInstanceId
	): { partInstance: PlayoutPartInstanceModel; pieceInstance: PlayoutPieceInstanceModel } | undefined {
		for (const partInstance of this.LoadedPartInstances) {
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
				const playoutDevices = this.PeripheralDevices.filter(
					(device) => device.type === PeripheralDeviceType.PLAYOUT
				)
				this.#isMultiGatewayMode = playoutDevices.length > 1
			}
		}
		return this.#isMultiGatewayMode
	}
}

/**
 * This is a cache used for playout operations.
 * It contains everything that is needed to generate the timeline, and everything except for pieces needed to update the partinstances.
 * Anything not in this cache should not be needed often, and only for specific operations (eg, AdlibActions needed to run one).
 */
export class PlayoutModelImpl extends PlayoutModelReadonlyImpl implements PlayoutModel, DatabasePersistedModel {
	readonly #baselineHelper: StudioBaselineHelper

	#deferredBeforeSaveFunctions: DeferredFunction[] = []
	#deferredAfterSaveFunctions: DeferredAfterSaveFunction[] = []
	#disposed = false

	#PlaylistHasChanged = false
	#TimelineHasChanged = false

	#PendingPartInstanceTimingEvents = new Set<PartInstanceId>()
	#PendingNotifyCurrentlyPlayingPartEvent = new Map<RundownId, string | null>()

	get HackDeletedPartInstanceIds(): PartInstanceId[] {
		const result: PartInstanceId[] = []
		for (const [id, doc] of this.AllPartInstances) {
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

	public get DisplayName(): string {
		return `PlayoutModel "${this.PlaylistId}"`
	}

	activatePlaylist(rehearsal: boolean): RundownPlaylistActivationId {
		this.PlaylistImpl.activationId = getRandomId()
		this.PlaylistImpl.rehearsal = rehearsal

		this.#PlaylistHasChanged = true

		return this.PlaylistImpl.activationId
	}

	clearSelectedPartInstances(): void {
		this.PlaylistImpl.currentPartInfo = null
		this.PlaylistImpl.nextPartInfo = null
		this.PlaylistImpl.previousPartInfo = null
		this.PlaylistImpl.holdState = RundownHoldState.NONE

		delete this.PlaylistImpl.lastTakeTime
		delete this.PlaylistImpl.queuedSegmentId

		this.#PlaylistHasChanged = true
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
		const currentPartInstance = this.CurrentPartInstance
		if (!currentPartInstance) throw new Error('No currentPartInstance')

		const newPartInstance: DBPartInstance = {
			_id: getRandomId(),
			rundownId: currentPartInstance.PartInstance.rundownId,
			segmentId: currentPartInstance.PartInstance.segmentId,
			playlistActivationId: currentPartInstance.PartInstance.playlistActivationId,
			segmentPlayoutId: currentPartInstance.PartInstance.segmentPlayoutId,
			takeCount: currentPartInstance.PartInstance.takeCount + 1,
			rehearsal: currentPartInstance.PartInstance.rehearsal,
			orphaned: 'adlib-part',
			part: {
				...part,
				rundownId: currentPartInstance.PartInstance.rundownId,
				segmentId: currentPartInstance.PartInstance.segmentId,
			},
		}

		this.#fixupPieceInstancesForPartInstance(newPartInstance, infinitePieceInstances)

		const partInstance = new PlayoutPartInstanceModelImpl(newPartInstance, infinitePieceInstances, true)

		for (const piece of pieces) {
			partInstance.insertAdlibbedPiece(piece, fromAdlibId)
		}

		partInstance.recalculateExpectedDurationWithPreroll()

		this.AllPartInstances.set(newPartInstance._id, partInstance)

		return partInstance
	}

	createInstanceForPart(nextPart: ReadonlyDeep<DBPart>, pieceInstances: PieceInstance[]): PlayoutPartInstanceModel {
		const playlistActivationId = this.Playlist.activationId
		if (!playlistActivationId) throw new Error(`Playlist is not active`)

		const currentPartInstance = this.CurrentPartInstance

		const newTakeCount = currentPartInstance ? currentPartInstance.PartInstance.takeCount + 1 : 0 // Increment
		const segmentPlayoutId: SegmentPlayoutId =
			currentPartInstance && nextPart.segmentId === currentPartInstance.PartInstance.segmentId
				? currentPartInstance.PartInstance.segmentPlayoutId
				: getRandomId()

		const newPartInstance: DBPartInstance = {
			_id: protectString<PartInstanceId>(`${nextPart._id}_${getRandomId()}`),
			rundownId: nextPart.rundownId,
			segmentId: nextPart.segmentId,
			playlistActivationId: playlistActivationId,
			segmentPlayoutId,
			takeCount: newTakeCount,
			rehearsal: !!this.Playlist.rehearsal,
			part: clone<DBPart>(nextPart),
			timings: {
				setAsNext: getCurrentTime(),
			},
		}

		this.#fixupPieceInstancesForPartInstance(newPartInstance, pieceInstances)

		const partInstance = new PlayoutPartInstanceModelImpl(newPartInstance, pieceInstances, true)
		partInstance.recalculateExpectedDurationWithPreroll()

		this.AllPartInstances.set(newPartInstance._id, partInstance)

		return partInstance
	}

	createScratchpadPartInstance(
		rundown: PlayoutRundownModel,
		part: Omit<DBPart, 'segmentId' | 'rundownId'>
	): PlayoutPartInstanceModel {
		const currentPartInstance = this.CurrentPartInstance
		if (!currentPartInstance) throw new Error('No currentPartInstance')

		const scratchpadSegment = rundown.getScratchpadSegment()
		if (!scratchpadSegment) throw new Error('No scratchpad segment')
		if (this.LoadedPartInstances.find((p) => p.PartInstance.segmentId === scratchpadSegment.Segment._id))
			throw new Error('Scratchpad segment already has content')

		const activationId = this.Playlist.activationId
		if (!activationId) throw new Error('Playlist is not active')

		const newPartInstance: DBPartInstance = {
			_id: getRandomId(),
			rundownId: rundown.Rundown._id,
			segmentId: scratchpadSegment.Segment._id,
			playlistActivationId: activationId,
			segmentPlayoutId: getRandomId(),
			takeCount: 1,
			rehearsal: !!this.Playlist.rehearsal,
			orphaned: 'adlib-part',
			part: {
				...part,
				rundownId: rundown.Rundown._id,
				segmentId: scratchpadSegment.Segment._id,
			},
		}

		const partInstance = new PlayoutPartInstanceModelImpl(newPartInstance, [], true)
		partInstance.recalculateExpectedDurationWithPreroll()

		this.AllPartInstances.set(newPartInstance._id, partInstance)

		return partInstance
	}

	cycleSelectedPartInstances(): void {
		this.PlaylistImpl.previousPartInfo = this.PlaylistImpl.currentPartInfo
		this.PlaylistImpl.currentPartInfo = this.PlaylistImpl.nextPartInfo
		this.PlaylistImpl.nextPartInfo = null
		this.PlaylistImpl.lastTakeTime = getCurrentTime()

		if (!this.PlaylistImpl.holdState || this.PlaylistImpl.holdState === RundownHoldState.COMPLETE) {
			this.PlaylistImpl.holdState = RundownHoldState.NONE
		} else {
			this.PlaylistImpl.holdState = this.PlaylistImpl.holdState + 1
		}

		this.#PlaylistHasChanged = true
	}

	deactivatePlaylist(): void {
		delete this.PlaylistImpl.activationId

		this.clearSelectedPartInstances()

		this.#PlaylistHasChanged = true
	}

	queuePartInstanceTimingEvent(partInstanceId: PartInstanceId): void {
		this.#PendingPartInstanceTimingEvents.add(partInstanceId)
	}

	queueNotifyCurrentlyPlayingPartEvent(rundownId: RundownId, partInstance: PlayoutPartInstanceModel | null): void {
		if (partInstance && partInstance.PartInstance.part.shouldNotifyCurrentPlayingPart) {
			this.#PendingNotifyCurrentlyPlayingPartEvent.set(rundownId, partInstance.PartInstance.part.externalId)
		} else if (!partInstance) {
			this.#PendingNotifyCurrentlyPlayingPartEvent.set(rundownId, null)
		}
	}

	removeAllRehearsalPartInstances(): void {
		const partInstancesToRemove: PartInstanceId[] = []

		for (const [id, partInstance] of this.AllPartInstances.entries()) {
			if (partInstance?.PartInstance.rehearsal) {
				this.AllPartInstances.set(id, null)
				partInstancesToRemove.push(id)
			}
		}

		// Defer ones which arent loaded
		this.deferAfterSave(async (playoutModel) => {
			const rundownIds = playoutModel.getRundownIds()
			// We need to keep any for PartInstances which are still existent in the cache (as they werent removed)
			const partInstanceIdsInCache = playoutModel.LoadedPartInstances.map((p) => p.PartInstance._id)

			// Find all the partInstances which are not loaded, but should be removed
			const removeFromDb = await this.context.directCollections.PartInstances.findFetch(
				{
					// Not any which are in the cache, as they have already been done if needed
					_id: { $nin: partInstanceIdsInCache },
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
		for (const partInstance of this.OlderPartInstances) {
			if (!partInstance.PartInstance.isTaken) {
				this.AllPartInstances.set(partInstance.PartInstance._id, null)
			}
		}
	}

	/**
	 * Reset the playlist for playout
	 */
	resetPlaylist(regenerateActivationId: boolean): void {
		this.PlaylistImpl.previousPartInfo = null
		this.PlaylistImpl.currentPartInfo = null
		this.PlaylistImpl.nextPartInfo = null
		this.PlaylistImpl.holdState = RundownHoldState.NONE
		this.PlaylistImpl.resetTime = getCurrentTime()

		delete this.PlaylistImpl.lastTakeTime
		delete this.PlaylistImpl.startedPlayback
		delete this.PlaylistImpl.rundownsStartedPlayback
		delete this.PlaylistImpl.previousPersistentState
		delete this.PlaylistImpl.trackedAbSessions
		delete this.PlaylistImpl.queuedSegmentId

		if (regenerateActivationId) this.PlaylistImpl.activationId = getRandomId()

		this.#PlaylistHasChanged = true
	}

	async saveAllToDatabase(): Promise<void> {
		if (this.#disposed) {
			throw new Error('Cannot save disposed PlayoutModel')
		}

		// TODO - ideally we should make sure to preserve the lock during this operation
		if (!this.PlaylistLock.isLocked) {
			throw new Error('Cannot save changes with released playlist lock')
		}

		const span = this.context.startSpan('PlayoutModelImpl.saveAllToDatabase')

		// Execute cache.deferBeforeSave()'s
		for (const fn of this.#deferredBeforeSaveFunctions) {
			await fn(this as any)
		}
		this.#deferredBeforeSaveFunctions.length = 0 // clear the array

		// Prioritise the timeline for publication reasons
		if (this.#TimelineHasChanged && this.TimelineImpl) {
			await this.context.directCollections.Timelines.replace(this.TimelineImpl)
			if (!process.env.JEST_WORKER_ID) {
				// Wait a little bit before saving the rest.
				// The idea is that this allows for the high priority publications to update (such as the Timeline),
				// sending the updated timeline to Playout-gateway
				await sleep(2)
			}
		}
		this.#TimelineHasChanged = false

		await Promise.all([
			this.#PlaylistHasChanged
				? this.context.directCollections.RundownPlaylists.replace(this.PlaylistImpl)
				: undefined,
			...writePartInstancesAndPieceInstances(this.context, this.AllPartInstances),
			writeScratchpadSegments(this.context, this.RundownsImpl),
			this.#baselineHelper.saveAllToDatabase(),
		])

		this.#PlaylistHasChanged = false

		// Execute cache.deferAfterSave()'s
		for (const fn of this.#deferredAfterSaveFunctions) {
			await fn(this as any)
		}
		this.#deferredAfterSaveFunctions.length = 0 // clear the array

		for (const partInstanceId of this.#PendingPartInstanceTimingEvents) {
			// Run in the background, we don't want to hold onto the lock to do this
			queuePartInstanceTimingEvent(this.context, this.PlaylistId, partInstanceId)
		}
		this.#PendingPartInstanceTimingEvents.clear()

		for (const [rundownId, partExternalId] of this.#PendingNotifyCurrentlyPlayingPartEvent) {
			// This is low-prio, defer so that it's executed well after publications has been updated,
			// so that the playout gateway has had the chance to learn about the timeline changes
			this.context
				.queueEventJob(EventsJobs.NotifyCurrentlyPlayingPart, {
					rundownId: rundownId,
					isRehearsal: !!this.Playlist.rehearsal,
					partExternalId: partExternalId,
				})
				.catch((e) => {
					logger.warn(`Failed to queue NotifyCurrentlyPlayingPart job: ${e}`)
				})
		}
		this.#PendingNotifyCurrentlyPlayingPartEvent.clear()

		if (span) span.end()
	}

	setHoldState(newState: RundownHoldState): void {
		this.PlaylistImpl.holdState = newState

		this.#PlaylistHasChanged = true
	}

	setOnTimelineGenerateResult(
		persistentState: unknown | undefined,
		assignedAbSessions: Record<string, ABSessionAssignments>,
		trackedAbSessions: ABSessionInfo[]
	): void {
		this.PlaylistImpl.previousPersistentState = persistentState
		this.PlaylistImpl.assignedAbSessions = assignedAbSessions
		this.PlaylistImpl.trackedAbSessions = trackedAbSessions

		this.#PlaylistHasChanged = true
	}

	setPartInstanceAsNext(
		partInstance: PlayoutPartInstanceModel | null,
		setManually: boolean,
		consumesQueuedSegmentId: boolean,
		nextTimeOffset?: number
	): void {
		if (partInstance) {
			const storedPartInstance = this.AllPartInstances.get(partInstance.PartInstance._id)
			if (!storedPartInstance) throw new Error(`PartInstance being set as next was not constructed correctly`)
			// Make sure we were given the exact same object
			if (storedPartInstance !== partInstance) throw new Error(`PartInstance being set as next is not current`)
		}

		if (partInstance) {
			this.PlaylistImpl.nextPartInfo = literal<SelectedPartInstance>({
				partInstanceId: partInstance.PartInstance._id,
				rundownId: partInstance.PartInstance.rundownId,
				manuallySelected: !!(setManually || partInstance.PartInstance.orphaned),
				consumesQueuedSegmentId,
			})
			this.PlaylistImpl.nextTimeOffset = nextTimeOffset || null
		} else {
			this.PlaylistImpl.nextPartInfo = null
			this.PlaylistImpl.nextTimeOffset = null
		}

		this.#PlaylistHasChanged = true
	}

	setQueuedSegment(segment: PlayoutSegmentModel | null): void {
		this.PlaylistImpl.queuedSegmentId = segment?.Segment?._id ?? undefined

		this.#PlaylistHasChanged = true
	}

	setRundownStartedPlayback(rundownId: RundownId, timestamp: number): void {
		if (!this.PlaylistImpl.rundownsStartedPlayback) {
			this.PlaylistImpl.rundownsStartedPlayback = {}
		}

		// If the partInstance is "untimed", it will not update the playlist's startedPlayback and will not count time in the GUI:
		const rundownIdStr = unprotectString(rundownId)
		if (!this.PlaylistImpl.rundownsStartedPlayback[rundownIdStr]) {
			this.PlaylistImpl.rundownsStartedPlayback[rundownIdStr] = timestamp
		}

		if (!this.PlaylistImpl.startedPlayback) {
			this.PlaylistImpl.startedPlayback = timestamp
		}

		this.#PlaylistHasChanged = true
	}

	setTimeline(timelineObjs: TimelineObjGeneric[], generationVersions: TimelineCompleteGenerationVersions): void {
		this.TimelineImpl = {
			_id: this.context.studioId,
			timelineHash: getRandomId(), // randomized on every timeline change
			generated: getCurrentTime(),
			timelineBlob: serializeTimelineBlob(timelineObjs),
			generationVersions: generationVersions,
		}
		this.#TimelineHasChanged = true
	}

	setExpectedPackagesForStudioBaseline(packages: ExpectedPackageDBFromStudioBaselineObjects[]): void {
		this.#baselineHelper.setExpectedPackages(packages)
	}
	setExpectedPlayoutItemsForStudioBaseline(playoutItems: ExpectedPlayoutItemStudio[]): void {
		this.#baselineHelper.setExpectedPlayoutItems(playoutItems)
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

	/** ICacheBase */

	/**
	 * Assert that no changes should have been made to the cache, will throw an Error otherwise. This can be used in
	 * place of `saveAllToDatabase()`, when the code controlling the cache expects no changes to have been made and any
	 * changes made are an error and will cause issues.
	 */
	assertNoChanges(): void {
		const span = this.context.startSpan('Cache.assertNoChanges')

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
					`Failed no changes in cache assertion, there were ${
						this.#deferredBeforeSaveFunctions.length
					} deferred functions`
				)
			)

		if (this.#deferredAfterSaveFunctions.length > 0)
			logOrThrowError(
				new Error(
					`Failed no changes in cache assertion, there were ${
						this.#deferredAfterSaveFunctions.length
					} after-save deferred functions`
				)
			)

		if (this.#TimelineHasChanged)
			logOrThrowError(new Error(`Failed no changes in cache assertion, Timeline has been changed`))

		if (this.#PlaylistHasChanged)
			logOrThrowError(new Error(`Failed no changes in cache assertion, Playlist has been changed`))

		if (this.RundownsImpl.find((rd) => rd.ScratchPadSegmentHasChanged))
			logOrThrowError(new Error(`Failed no changes in cache assertion, a scratchpad Segment has been changed`))

		if (
			Array.from(this.AllPartInstances.values()).find(
				(part) => !part || part.PartInstanceHasChanges || part.ChangedPieceInstanceIds().length > 0
			)
		)
			logOrThrowError(new Error(`Failed no changes in cache assertion, a PartInstance has been changed`))

		if (span) span.end()
	}

	/**
	 * Discards all documents in this cache, and marks it as unusable
	 */
	dispose(): void {
		this.#disposed = true

		// Discard any hooks too
		this.#deferredAfterSaveFunctions.length = 0
		this.#deferredBeforeSaveFunctions.length = 0
	}
}
