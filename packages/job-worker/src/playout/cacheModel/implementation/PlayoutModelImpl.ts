import {
	PartId,
	PartInstanceId,
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
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
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
import { RundownWithSegments } from '../RundownWithSegments'
import { RundownWithSegmentsImpl } from './RundownWithSegmentsImpl'
import { SegmentWithParts } from '../SegmentWithParts'
import { PartInstanceWithPiecesImpl } from './PartInstanceWithPiecesImpl'
import { PartInstanceWithPieces } from '../PartInstanceWithPieces'
import { getCurrentTime } from '../../../lib'
import { protectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { queuePartInstanceTimingEvent } from '../../timings/events'
import { IS_PRODUCTION } from '../../../environment'
import { DeferredAfterSaveFunction, DeferredFunction, PlayoutModel } from '../PlayoutModel'
import { writePartInstancesAndPieceInstances, writeScratchpadSegments } from './SavePlayoutModel'

/**
 * This is a cache used for playout operations.
 * It contains everything that is needed to generate the timeline, and everything except for pieces needed to update the partinstances.
 * Anything not in this cache should not be needed often, and only for specific operations (eg, AdlibActions needed to run one).
 */
export class PlayoutModelImpl implements PlayoutModel {
	#deferredBeforeSaveFunctions: DeferredFunction[] = []
	#deferredAfterSaveFunctions: DeferredAfterSaveFunction[] = []

	public readonly isPlayout = true
	public readonly PlaylistId: RundownPlaylistId

	public readonly PlaylistLock: PlaylistLock

	public readonly PeripheralDevices: ReadonlyDeep<PeripheralDevice[]>

	readonly #Playlist: DBRundownPlaylist
	public get Playlist(): ReadonlyDeep<DBRundownPlaylist> {
		return this.#Playlist
	}

	readonly #Rundowns: readonly RundownWithSegmentsImpl[]
	public get Rundowns(): readonly RundownWithSegments[] {
		return this.#Rundowns
	}

	#TimelineHasChanged = false
	#Timeline: TimelineComplete | null
	public get Timeline(): TimelineComplete | null {
		return this.#Timeline
	}

	#PendingPartInstanceTimingEvents = new Set<PartInstanceId>()

	#AllPartInstances: Map<PartInstanceId, PartInstanceWithPiecesImpl | null>

	public get OlderPartInstances(): PartInstanceWithPieces[] {
		const allPartInstances = this.LoadedPartInstances

		const ignoreIds = new Set(this.SelectedPartInstanceIds)

		return allPartInstances.filter((partInstance) => !ignoreIds.has(partInstance.PartInstance._id))
	}
	public get PreviousPartInstance(): PartInstanceWithPieces | null {
		if (!this.Playlist.previousPartInfo?.partInstanceId) return null
		const partInstance = this.#AllPartInstances.get(this.Playlist.previousPartInfo.partInstanceId)
		if (!partInstance) return null // throw new Error('PreviousPartInstance is missing')
		return partInstance
	}
	public get CurrentPartInstance(): PartInstanceWithPieces | null {
		if (!this.Playlist.currentPartInfo?.partInstanceId) return null
		const partInstance = this.#AllPartInstances.get(this.Playlist.currentPartInfo.partInstanceId)
		if (!partInstance) return null // throw new Error('CurrentPartInstance is missing')
		return partInstance
	}
	public get NextPartInstance(): PartInstanceWithPieces | null {
		if (!this.Playlist.nextPartInfo?.partInstanceId) return null
		const partInstance = this.#AllPartInstances.get(this.Playlist.nextPartInfo.partInstanceId)
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

	public get SelectedPartInstances(): PartInstanceWithPieces[] {
		return _.compact([this.CurrentPartInstance, this.PreviousPartInstance, this.NextPartInstance])
	}

	public get LoadedPartInstances(): PartInstanceWithPieces[] {
		return Array.from(this.#AllPartInstances.values()).filter((v): v is PartInstanceWithPiecesImpl => v !== null)
	}

	public get SortedLoadedPartInstances(): PartInstanceWithPieces[] {
		const allInstances = this.LoadedPartInstances
		allInstances.sort((a, b) => a.PartInstance.takeCount - b.PartInstance.takeCount) // nocommit check order

		return allInstances
	}

	public getPartInstance(partInstanceId: PartInstanceId): PartInstanceWithPieces | undefined {
		return this.#AllPartInstances.get(partInstanceId) ?? undefined
	}

	public constructor(
		protected readonly context: JobContext,
		playlistLock: PlaylistLock,
		playlistId: RundownPlaylistId,
		peripheralDevices: ReadonlyDeep<PeripheralDevice[]>,
		playlist: DBRundownPlaylist,
		partInstances: PartInstanceWithPiecesImpl[],
		rundowns: RundownWithSegmentsImpl[],
		timeline: TimelineComplete | undefined
	) {
		context.trackCache(this)

		this.PlaylistId = playlistId
		this.PlaylistLock = playlistLock

		this.PeripheralDevices = peripheralDevices
		this.#Playlist = playlist

		this.#Rundowns = rundowns

		this.#Timeline = timeline ?? null

		this.#AllPartInstances = normalizeArrayToMapFunc(partInstances, (p) => p.PartInstance._id)
	}

	public get DisplayName(): string {
		return `CacheForPlayout "${this.PlaylistId}"`
	}

	setTimeline(timelineObjs: TimelineObjGeneric[], generationVersions: TimelineCompleteGenerationVersions): void {
		this.#Timeline = {
			_id: this.context.studioId,
			timelineHash: getRandomId(), // randomized on every timeline change
			generated: getCurrentTime(),
			timelineBlob: serializeTimelineBlob(timelineObjs),
			generationVersions: generationVersions,
		}
		this.#TimelineHasChanged = true
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

	findSegment(id: SegmentId): ReadonlyDeep<SegmentWithParts> | undefined {
		for (const rundown of this.Rundowns) {
			const segment = rundown.getSegment(id)
			if (segment) return segment
		}

		return undefined
	}
	getAllOrderedSegments(): ReadonlyDeep<SegmentWithParts>[] {
		return this.Rundowns.flatMap((rundown) => rundown.Segments)
	}

	getRundown(id: RundownId): RundownWithSegments | undefined {
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
	): { partInstance: PartInstanceWithPieces; pieceInstance: ReadonlyDeep<PieceInstance> } | undefined {
		for (const partInstance of this.LoadedPartInstances) {
			const pieceInstance = partInstance.getPieceInstance(id)
			if (pieceInstance) return { partInstance, pieceInstance }
		}

		return undefined
	}

	createInstanceForPart(nextPart: ReadonlyDeep<DBPart>, pieceInstances: PieceInstance[]): PartInstanceWithPieces {
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

		for (const pieceInstance of pieceInstances) {
			// TODO - should these be PieceInstance already, or should that be handled here?
			pieceInstance.partInstanceId = newPartInstance._id
		}

		const partWithPieces = new PartInstanceWithPiecesImpl(newPartInstance, pieceInstances, true)
		this.#AllPartInstances.set(newPartInstance._id, partWithPieces)

		return partWithPieces
	}

	insertAdlibbedPartInstance(part: Omit<DBPart, 'segmentId' | 'rundownId'>): PartInstanceWithPieces {
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

		const partWithPieces = new PartInstanceWithPiecesImpl(newPartInstance, [], true)
		this.#AllPartInstances.set(newPartInstance._id, partWithPieces)

		return partWithPieces
	}

	insertScratchpadPartInstance(
		rundown: RundownWithSegments,
		part: Omit<DBPart, 'segmentId' | 'rundownId'>
	): PartInstanceWithPieces {
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

		const partWithPieces = new PartInstanceWithPiecesImpl(newPartInstance, [], true)
		this.#AllPartInstances.set(newPartInstance._id, partWithPieces)

		return partWithPieces
	}

	/**
	 * HACK: This allows for taking a copy of a `PartInstanceWithPieces` for use in `syncChangesToPartInstances`.
	 * This lets us discard the changes if the blueprint call throws.
	 * We should look at avoiding this messy/dangerous method, and find a better way to do this
	 */
	replacePartInstance(partInstance: PartInstanceWithPieces): void {
		if (!(partInstance instanceof PartInstanceWithPiecesImpl))
			throw new Error(`Expected PartInstanceWithPiecesImpl`)

		const currentPartInstance = this.CurrentPartInstance
		const nextPartInstance = this.NextPartInstance

		if (
			(currentPartInstance && partInstance.PartInstance._id === currentPartInstance.PartInstance._id) ||
			(nextPartInstance && partInstance.PartInstance._id === nextPartInstance.PartInstance._id)
		) {
			this.#AllPartInstances.set(partInstance.PartInstance._id, partInstance)
		} else {
			throw new Error('Cannot call `replacePartInstance` for arbitrary PartInstances')
		}
	}

	/** @deprecated HACK */
	removePartInstance(id: PartInstanceId): void {
		if (this.SelectedPartInstanceIds.includes(id))
			throw new Error('Cannot call removePartInstance for one of the selected PartInstances')

		this.#AllPartInstances.set(id, null)
	}

	setHoldState(newState: RundownHoldState): void {
		// TODO some validation?
		this.#Playlist.holdState = newState
	}

	setNextSegment(segment: SegmentWithParts | null): void {
		// TODO some validation?
		this.#Playlist.nextSegmentId = segment?.Segment?._id ?? undefined
	}

	cycleSelectedPartInstances(): void {
		this.#Playlist.previousPartInfo = this.#Playlist.currentPartInfo
		this.#Playlist.currentPartInfo = this.#Playlist.nextPartInfo
		this.#Playlist.nextPartInfo = null
		this.#Playlist.lastTakeTime = getCurrentTime()

		if (!this.#Playlist.holdState || this.#Playlist.holdState === RundownHoldState.COMPLETE) {
			this.#Playlist.holdState = RundownHoldState.NONE
		} else {
			this.#Playlist.holdState = this.#Playlist.holdState + 1
		}
	}

	setRundownStartedPlayback(rundownId: RundownId, timestamp: number): void {
		if (!this.#Playlist.rundownsStartedPlayback) {
			this.#Playlist.rundownsStartedPlayback = {}
		}

		// If the partInstance is "untimed", it will not update the playlist's startedPlayback and will not count time in the GUI:
		const rundownIdStr = unprotectString(rundownId)
		if (!this.#Playlist.rundownsStartedPlayback[rundownIdStr]) {
			this.#Playlist.rundownsStartedPlayback[rundownIdStr] = timestamp
		}

		if (!this.#Playlist.startedPlayback) {
			this.#Playlist.startedPlayback = timestamp
		}
	}

	setPartInstanceAsNext(
		partInstance: PartInstanceWithPieces | null,
		setManually: boolean,
		consumesNextSegmentId: boolean,
		nextTimeOffset?: number
	): void {
		if (partInstance) {
			const storedPartInstance = this.#AllPartInstances.get(partInstance.PartInstance._id)
			if (!storedPartInstance) throw new Error(`PartInstance being set as next was not constructed correctly`)
			// Make sure we were given the exact same object
			if (storedPartInstance !== partInstance) throw new Error(`PartInstance being set as next is not current`)
		}

		if (partInstance) {
			this.#Playlist.nextPartInfo = literal<SelectedPartInstance>({
				partInstanceId: partInstance.PartInstance._id,
				rundownId: partInstance.PartInstance.rundownId,
				manuallySelected: !!(setManually || partInstance.PartInstance.orphaned),
				consumesNextSegmentId,
			})
			this.#Playlist.nextTimeOffset = nextTimeOffset || null
		} else {
			this.#Playlist.nextPartInfo = null
			this.#Playlist.nextTimeOffset = null
		}
	}

	clearSelectedPartInstances(): void {
		this.#Playlist.currentPartInfo = null
		this.#Playlist.nextPartInfo = null
		this.#Playlist.previousPartInfo = null
		this.#Playlist.holdState = RundownHoldState.NONE

		delete this.#Playlist.lastTakeTime
		delete this.#Playlist.nextSegmentId
	}

	activatePlaylist(rehearsal: boolean): RundownPlaylistActivationId {
		this.#Playlist.activationId = getRandomId()
		this.#Playlist.rehearsal = rehearsal

		return this.#Playlist.activationId
	}

	deactivatePlaylist(): void {
		delete this.#Playlist.activationId

		// this.clearSelectedPartInstances() // TODO?
	}

	removeUntakenPartInstances(): void {
		for (const partInstance of this.OlderPartInstances) {
			if (!partInstance.PartInstance.isTaken) {
				this.#AllPartInstances.set(partInstance.PartInstance._id, null)
			}
		}
	}

	/**
	 * Reset the playlist for playout
	 */
	resetPlaylist(regenerateActivationId: boolean): void {
		this.#Playlist.previousPartInfo = null
		this.#Playlist.currentPartInfo = null
		this.#Playlist.holdState = RundownHoldState.NONE
		this.#Playlist.resetTime = getCurrentTime()

		delete this.#Playlist.lastTakeTime
		delete this.#Playlist.startedPlayback
		delete this.#Playlist.rundownsStartedPlayback
		delete this.#Playlist.previousPersistentState
		delete this.#Playlist.trackedAbSessions
		delete this.#Playlist.nextSegmentId

		if (regenerateActivationId) this.#Playlist.activationId = getRandomId()
	}

	setOnTimelineGenerateResult(
		persistentState: unknown | undefined,
		assignedAbSessions: Record<string, ABSessionAssignments>,
		trackedAbSessions: ABSessionInfo[]
	): void {
		this.#Playlist.previousPersistentState = persistentState
		this.#Playlist.assignedAbSessions = assignedAbSessions
		this.#Playlist.trackedAbSessions = trackedAbSessions
	}

	queuePartInstanceTimingEvent(partInstanceId: PartInstanceId): void {
		this.#PendingPartInstanceTimingEvents.add(partInstanceId)
	}

	/**
	 * Discard all changes to documents in the cache.
	 * This essentially acts as rolling back this transaction, and lets the cache be reused for another operation instead
	 */
	discardChanges(): void {
		// nocommit - reimplement
		// super.discardChanges()

		// Discard any hooks too
		this.#deferredAfterSaveFunctions.length = 0
		this.#deferredBeforeSaveFunctions.length = 0

		this.assertNoChanges()
	}

	/**
	 * Discards all documents in this cache, and marks it as unusable
	 */
	dispose(): void {
		// nocommit - reimplement
		// const { allDBs } = this.getAllCollections()
		// for (const coll of allDBs) {
		// 	coll.dispose()
		// }

		// Discard any hooks too
		this.#deferredAfterSaveFunctions.length = 0
		this.#deferredBeforeSaveFunctions.length = 0
	}

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

		// const { allDBs } = this.getAllCollections()

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

		// nocommit - reimplement
		// for (const db of allDBs) {
		// 	if (db.isModified()) {
		// 		logOrThrowError(
		// 			new Error(`Failed no changes in cache assertion, cache was modified: collection: ${db.name}`)
		// 		)
		// 	}
		// }

		if (span) span.end()
	}

	hasChanges(): boolean {
		// const { allDBs } = this.getAllCollections()

		if (this.#deferredBeforeSaveFunctions.length > 0) {
			logger.silly(`hasChanges: _deferredBeforeSaveFunctions.length=${this.#deferredBeforeSaveFunctions.length}`)
			return true
		}

		if (this.#deferredAfterSaveFunctions.length > 0) {
			logger.silly(`hasChanges: _deferredAfterSaveFunctions.length=${this.#deferredAfterSaveFunctions.length}`)
			return true
		}

		// nocommit - reimplement
		// for (const db of allDBs) {
		// 	if (db.isModified()) {
		// 		logger.silly(`hasChanges: db=${db.name}`)
		// 		return true
		// 	}
		// }

		return false
	}

	/** @deprecated */
	deferBeforeSave(fcn: DeferredFunction): void {
		this.#deferredBeforeSaveFunctions.push(fcn)
	}
	/** @deprecated */
	deferAfterSave(fcn: DeferredAfterSaveFunction): void {
		this.#deferredAfterSaveFunctions.push(fcn)
	}

	async saveAllToDatabase(): Promise<void> {
		logger.silly('saveAllToDatabase')
		// TODO - ideally we should make sure to preserve the lock during this operation
		if (!this.PlaylistLock.isLocked) {
			throw new Error('Cannot save changes with released playlist lock')
		}

		const span = this.context.startSpan('Cache.saveAllToDatabase')

		// Execute cache.deferBeforeSave()'s
		for (const fn of this.#deferredBeforeSaveFunctions) {
			await fn(this as any)
		}
		this.#deferredBeforeSaveFunctions.length = 0 // clear the array

		// Prioritise the timeline for publication reasons
		if (this.#TimelineHasChanged && this.#Timeline) {
			await this.context.directCollections.Timelines.replace(this.#Timeline)
			if (!process.env.JEST_WORKER_ID) {
				// Wait a little bit before saving the rest.
				// The idea is that this allows for the high priority publications to update (such as the Timeline),
				// sending the updated timeline to Playout-gateway
				await sleep(2)
			}
		}

		await Promise.all([
			this.context.directCollections.RundownPlaylists.replace(this.#Playlist),
			...writePartInstancesAndPieceInstances(this.context, this.#AllPartInstances),
			writeScratchpadSegments(this.context, this.#Rundowns),
		])

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

		if (span) span.end()
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
