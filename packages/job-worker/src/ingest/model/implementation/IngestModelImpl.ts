import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { ExpectedMediaItemRundown } from '@sofie-automation/corelib/dist/dataModel/ExpectedMediaItem'
import { ExpectedPackageFromRundown } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { ExpectedPlayoutItemRundown } from '@sofie-automation/corelib/dist/dataModel/ExpectedPlayoutItem'
import {
	ExpectedPackageId,
	PartId,
	PieceId,
	RundownBaselineAdLibActionId,
	RundownBaselineObjId,
	RundownId,
	RundownPlaylistId,
	SegmentId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { Piece, PieceTimelineObjectsBlob } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { DBRundown, RundownOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { RundownBaselineAdLibAction } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibAction'
import { RundownBaselineAdLibItem } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibPiece'
import { RundownBaselineObj } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineObj'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { JobContext } from '../../../jobs'
import { LazyInitialise, LazyInitialiseReadonly } from '../../../lib/lazy'
import { getRundownId, getSegmentId } from '../../lib'
import { RundownLock } from '../../../jobs/lock'
import { IngestSegmentModel } from '../IngestSegmentModel'
import { IngestSegmentModelImpl } from './IngestSegmentModelImpl'
import { IngestPartModel } from '../IngestPartModel'
import { clone, Complete, getRandomId, groupByToMap } from '@sofie-automation/corelib/dist/lib'
import { IngestPartModelImpl } from './IngestPartModelImpl'
import { DatabasePersistedModel } from '../../../modelBase'
import { ExpectedPackagesStore } from './ExpectedPackagesStore'
import { ReadonlyDeep } from 'type-fest'
import {
	ExpectedPackageForIngestModel,
	ExpectedPackageForIngestModelBaseline,
	IngestModelReadonly,
} from '../IngestModel'
import { RundownNote } from '@sofie-automation/corelib/dist/dataModel/Notes'
import { diffAndReturnLatestObjects } from './utils'

export interface IngestModelImplExistingData {
	rundown: DBRundown
	segments: DBSegment[]
	parts: DBPart[]
	pieces: Piece[]
	adLibPieces: AdLibPiece[]
	adLibActions: AdLibAction[]
	expectedMediaItems: ExpectedMediaItemRundown[]
	expectedPlayoutItems: ExpectedPlayoutItemRundown[]
	expectedPackages: ExpectedPackageFromRundown[]
}

/**
 * Cache of relevant documents for an Ingest Operation
 */
export class IngestModelImpl implements IngestModelReadonly, DatabasePersistedModel {
	public readonly isIngest = true

	public readonly rundownLock: RundownLock
	public readonly rundownExternalId: string

	#disposed = false

	#rundownHasChanged = false
	#rundownImpl: DBRundown | undefined

	#rundownBaselineObjsWithChanges = new Set<RundownBaselineObjId>()
	#rundownBaselineAdLibPiecesWithChanges = new Set<PieceId>()
	#rundownBaselineAdLibActionsWithChanges = new Set<RundownBaselineAdLibActionId>()

	readonly #rundownBaselineObjs: LazyInitialise<RundownBaselineObj[]>
	readonly #rundownBaselineAdLibPieces: LazyInitialise<RundownBaselineAdLibItem[]>
	readonly #rundownBaselineAdLibActions: LazyInitialise<RundownBaselineAdLibAction[]>

	public get rundownId(): RundownId {
		return this.#rundownImpl?._id ?? getRundownId(this.context.studioId, this.rundownExternalId)
	}

	public get displayName(): string {
		return `IngestModel "${this.rundownExternalId}"`
	}

	protected readonly segmentsImpl: Map<SegmentId, IngestSegmentModelImpl | null>

	readonly #rundownBaselineExpectedPackagesStore: ExpectedPackagesStore<ExpectedPackageForIngestModelBaseline>
	// public get segments(): readonly IngestSegmentModel[] {
	// 	return this.segmentsImpl
	// }

	get rundownBaselineTimelineObjects(): LazyInitialiseReadonly<PieceTimelineObjectsBlob> {
		// Return a simplified view of what we store, of just `timelineObjectsString`
		const obj = this.#rundownBaselineObjs
		return {
			get: async () => {
				const objValue = await obj.get()
				return objValue[0].timelineObjectsString
			},

			getIfLoaded: () => {
				const objValue = obj.getIfLoaded()
				return objValue?.[0]?.timelineObjectsString
			},

			isLoaded: () => obj.isLoaded(),
		}
	}
	get rundownBaselineAdLibPieces(): LazyInitialiseReadonly<ReadonlyDeep<RundownBaselineAdLibItem[]>> {
		return this.#rundownBaselineAdLibPieces
	}
	get rundownBaselineAdLibActions(): LazyInitialiseReadonly<ReadonlyDeep<RundownBaselineAdLibAction[]>> {
		return this.#rundownBaselineAdLibActions
	}

	get expectedMediaItemsForRundownBaseline(): ReadonlyDeep<ExpectedMediaItemRundown>[] {
		return [...this.#rundownBaselineExpectedPackagesStore.expectedMediaItems]
	}
	get expectedPlayoutItemsForRundownBaseline(): ReadonlyDeep<ExpectedPlayoutItemRundown>[] {
		return [...this.#rundownBaselineExpectedPackagesStore.expectedPlayoutItems]
	}
	get expectedPackagesForRundownBaseline(): ReadonlyDeep<ExpectedPackageForIngestModelBaseline>[] {
		return [...this.#rundownBaselineExpectedPackagesStore.expectedPackages]
	}

	get rundown(): ReadonlyDeep<DBRundown> | undefined {
		return this.#rundownImpl
	}

	public constructor(
		protected readonly context: JobContext,
		rundownLock: RundownLock,
		rundownExternalId: string,
		existingData: IngestModelImplExistingData | undefined
	) {
		this.rundownLock = rundownLock
		this.rundownExternalId = rundownExternalId

		if (existingData) {
			this.#rundownImpl = existingData.rundown

			const groupedPieces = groupByToMap(existingData.pieces, 'startPartId')
			const groupedAdLibPieces = groupByToMap(existingData.adLibPieces, 'partId')
			const groupedAdLibActions = groupByToMap(existingData.adLibActions, 'partId')

			const groupedExpectedMediaItems = groupByToMap(existingData.expectedMediaItems, 'partId')
			const groupedExpectedPlayoutItems = groupByToMap(existingData.expectedPlayoutItems, 'partId')
			const groupedExpectedPackages = groupByToMap(existingData.expectedPackages, 'partId')

			this.#rundownBaselineExpectedPackagesStore = new ExpectedPackagesStore(
				false,
				this.rundownId,
				undefined,
				undefined,
				groupedExpectedMediaItems.get(undefined) ?? [],
				groupedExpectedPlayoutItems.get(undefined) ?? [],
				groupedExpectedPackages.get(undefined) ?? []
			)

			const groupedParts = groupByToMap(existingData.parts, 'segmentId')

			this.segmentsImpl = new Map()
			for (const segment of existingData.segments) {
				const rawParts = groupedParts.get(segment._id) ?? []
				const parts = rawParts.map(
					(part) =>
						new IngestPartModelImpl(
							false,
							part,
							groupedPieces.get(part._id) ?? [],
							groupedAdLibPieces.get(part._id) ?? [],
							groupedAdLibActions.get(part._id) ?? [],
							groupedExpectedMediaItems.get(part._id) ?? [],
							groupedExpectedPlayoutItems.get(part._id) ?? [],
							groupedExpectedPackages.get(part._id) ?? []
						)
				)
				this.segmentsImpl.set(segment._id, new IngestSegmentModelImpl(segment, parts))
			}

			this.#rundownBaselineObjs = new LazyInitialise(async () =>
				context.directCollections.RundownBaselineObjects.findFetch({
					rundownId: this.rundownId,
				})
			)
			this.#rundownBaselineAdLibPieces = new LazyInitialise(async () =>
				context.directCollections.RundownBaselineAdLibPieces.findFetch({
					rundownId: this.rundownId,
				})
			)
			this.#rundownBaselineAdLibActions = new LazyInitialise(async () =>
				context.directCollections.RundownBaselineAdLibActions.findFetch({
					rundownId: this.rundownId,
				})
			)
		} else {
			this.#rundownImpl = undefined

			this.#rundownBaselineExpectedPackagesStore = new ExpectedPackagesStore(
				true,
				this.rundownId,
				undefined,
				undefined,
				[],
				[],
				[]
			)

			this.segmentsImpl = new Map()

			this.#rundownBaselineObjs = new LazyInitialise(async () => [])
			this.#rundownBaselineAdLibPieces = new LazyInitialise(async () => [])
			this.#rundownBaselineAdLibActions = new LazyInitialise(async () => [])
		}
	}

	getRundown(): ReadonlyDeep<DBRundown> {
		const rundown = this.#rundownImpl
		if (!rundown) {
			throw new Error(`Rundown "${this.rundownId}" ("${this.rundownExternalId}") not found`)
		}
		return rundown
	}

	/**
	 * Get a Segment from the Rundown by `externalId`
	 * @param id Id of the Segment
	 */
	getSegmentByExternalId(externalId: string): IngestSegmentModel | undefined {
		const segmentId = getSegmentId(this.rundownId, externalId)
		return this.segmentsImpl.get(segmentId) ?? undefined
	}

	/**
	 * Get a Segment from the Rundown
	 * @param id Id of the Segment
	 */
	getSegment(id: SegmentId): IngestSegmentModel | undefined {
		return this.segmentsImpl.get(id) ?? undefined
	}
	/**
	 * Get the Segments of this Rundown, in order
	 */
	getAllSegments(): IngestSegmentModel[] {
		return Array.from(this.segmentsImpl.values()).filter((v): v is IngestSegmentModelImpl => !!v)
	}

	/**
	 * Get the Segments of this Rundown, in order
	 */
	getOrderedSegments(): IngestSegmentModel[] {
		const segments = this.getAllSegments()

		segments.sort((a, b) => a.segment._rank - b.segment._rank)

		return segments
	}

	/**
	 * Get the Parts of this Rundown, in order
	 */
	getAllOrderedParts(): IngestPartModel[] {
		return this.getOrderedSegments().flatMap((segment) => segment.parts)
	}

	/**
	 * Get the Pieces in this Rundown, in no particular order
	 */
	getAllPieces(): ReadonlyDeep<Piece>[] {
		return this.getAllOrderedParts().flatMap((part) => part.pieces)
	}

	findPart(partId: PartId): IngestPartModel | undefined {
		for (const segment of this.segmentsImpl.values()) {
			const part = segment?.getPart(partId)
			if (part) return part
		}
		return undefined
	}

	findAdlibPiece(adLibPieceId: PieceId): ReadonlyDeep<AdLibPiece> | undefined {
		for (const part of this.getAllOrderedParts()) {
			for (const adlib of part.adLibPieces) {
				if (adlib._id === adLibPieceId) return adlib
			}
		}
		return undefined
	}

	findExpectedPackage(packageId: ExpectedPackageId): ReadonlyDeep<ExpectedPackageForIngestModel> | undefined {
		const baselinePackage = this.#rundownBaselineExpectedPackagesStore.expectedPackages.find(
			(pkg) => pkg._id === packageId
		)
		if (baselinePackage) return baselinePackage

		for (const part of this.getAllOrderedParts()) {
			const partPackage = part.expectedPackages.find((pkg) => pkg._id === packageId)
			if (partPackage) return partPackage
		}

		return undefined
	}

	removeSegment(id: SegmentId): void {
		// nocommit If we keeping preserveUnsyncedPlayingSegmentContents, then this should not do a full delete, but just set a flag

		this.segmentsImpl.set(id, null)
	}

	replaceSegment(segment: DBSegment): IngestSegmentModel {
		const oldSegment = this.segmentsImpl.get(segment._id)

		const newSegment = new IngestSegmentModelImpl(segment, [], oldSegment ?? undefined)
		this.segmentsImpl.set(segment._id, newSegment)

		return newSegment
	}

	changeSegmentId(oldId: SegmentId, newId: SegmentId): boolean {
		const existingSegment = this.segmentsImpl.get(oldId)
		if (!existingSegment) return false

		if (this.segmentsImpl.has(newId))
			throw new Error(`Cannot rename Segment ${oldId} to ${newId}. New id is already in use`)

		this.segmentsImpl.delete(oldId)
		this.segmentsImpl.set(newId, existingSegment)

		existingSegment.setOwnerIds(newId)
		return true
	}

	setExpectedPlayoutItemsForRundownBaseline(expectedPlayoutItems: ExpectedPlayoutItemRundown[]): void {
		this.#rundownBaselineExpectedPackagesStore.setExpectedPlayoutItems(expectedPlayoutItems)
	}
	setExpectedMediaItemsForRundownBaseline(expectedMediaItems: ExpectedMediaItemRundown[]): void {
		this.#rundownBaselineExpectedPackagesStore.setExpectedMediaItems(expectedMediaItems)
	}
	setExpectedPackagesForRundownBaseline(expectedPackages: ExpectedPackageForIngestModelBaseline[]): void {
		// Future: should these be here, or held as part of each adlib?
		this.#rundownBaselineExpectedPackagesStore.setExpectedPackages(expectedPackages)
	}

	async setRundownBaseline(
		timelineObjectsBlob: PieceTimelineObjectsBlob,
		adlibPieces: RundownBaselineAdLibItem[],
		adlibActions: RundownBaselineAdLibAction[]
	): Promise<void> {
		const [loadedRundownBaselineObjs, loadedRundownBaselineAdLibPieces, loadedRundownBaselineAdLibActions] =
			await Promise.all([
				this.#rundownBaselineObjs.get(),
				this.#rundownBaselineAdLibPieces.get(),
				this.#rundownBaselineAdLibActions.get(),
			])

		// Compare and update the baseline timeline
		const newBaselineObj: Complete<RundownBaselineObj> = {
			_id: getRandomId(),
			rundownId: this.rundownId,
			timelineObjectsString: timelineObjectsBlob,
		}
		this.#rundownBaselineObjs.setValue(
			diffAndReturnLatestObjects(this.#rundownBaselineObjsWithChanges, loadedRundownBaselineObjs, [
				newBaselineObj,
			])
		)

		// Compare and update the adlibPieces
		const newAdlibPieces = adlibPieces.map((piece) => ({
			...clone(piece),
			partId: undefined,
			rundownId: this.rundownId,
		}))
		this.#rundownBaselineAdLibPieces.setValue(
			diffAndReturnLatestObjects(
				this.#rundownBaselineAdLibPiecesWithChanges,
				loadedRundownBaselineAdLibPieces,
				newAdlibPieces
			)
		)

		// Compare and update the adlibActions
		const newAdlibActions = adlibActions.map((action) => ({
			...clone(action),
			partId: undefined,
			rundownId: this.rundownId,
		}))
		this.#rundownBaselineAdLibActions.setValue(
			diffAndReturnLatestObjects(
				this.#rundownBaselineAdLibActionsWithChanges,
				loadedRundownBaselineAdLibActions,
				newAdlibActions
			)
		)
	}

	setRundownOrphaned(orphaned: RundownOrphanedReason | undefined): void {
		if (!this.#rundownImpl) throw new Error(`Rundown "${this.rundownId}" ("${this.rundownExternalId}") not found`)

		if (this.#rundownImpl.orphaned !== orphaned) {
			this.#rundownImpl.orphaned = orphaned

			this.#rundownHasChanged = true
		}
	}

	setRundownPlaylistId(playlistId: RundownPlaylistId): void {
		if (!this.#rundownImpl) throw new Error(`Rundown "${this.rundownId}" ("${this.rundownExternalId}") not found`)

		if (this.#rundownImpl.playlistId !== playlistId) {
			this.#rundownImpl.playlistId = playlistId

			this.#rundownHasChanged = true
		}
	}

	setRundownAirStatus(status: string | undefined): void {
		if (!this.#rundownImpl) throw new Error(`Rundown "${this.rundownId}" ("${this.rundownExternalId}") not found`)

		if (this.#rundownImpl.airStatus !== status) {
			this.#rundownImpl.airStatus = status

			this.#rundownHasChanged = true
		}
	}

	appendRundownNotes(...notes: RundownNote[]): void {
		// Future: this doesnt allow for removing notes
		if (!this.#rundownImpl) throw new Error(`Rundown "${this.rundownId}" ("${this.rundownExternalId}") not found`)

		this.#rundownImpl.notes = [...(this.#rundownImpl.notes ?? []), ...clone(notes)]
		this.#rundownHasChanged = true
	}

	/** BaseModel */

	/**
	 * Assert that no changes should have been made to the model, will throw an Error otherwise. This can be used in
	 * place of `saveAllToDatabase()`, when the code controlling the model expects no changes to have been made and any
	 * changes made are an error and will cause issues.
	 */
	assertNoChanges(): void {
		// Once disposed, it no longer has any changes
		if (this.#disposed) return

		throw new Error('Method not implemented.')
	}

	/**
	 * Discards all documents in this model, and marks it as unusable
	 */
	dispose(): void {
		this.#disposed = true
	}

	async saveAllToDatabase(): Promise<void> {
		if (this.#disposed) {
			throw new Error('Cannot save disposed IngestModel')
		}

		if (!this.rundownLock.isLocked) {
			throw new Error('Cannot save changes with released RundownLock')
		}

		const span = this.context.startSpan('IngestModelImpl.saveAllToDatabase')

		// nocommit TODO ensure we don't have a Part in here twice

		await Promise.all([
			this.#rundownHasChanged && this.#rundownImpl
				? this.context.directCollections.Rundowns.replace(this.#rundownImpl)
				: undefined,
			// nocommit TODO
			// ...writePartInstancesAndPieceInstances(this.context, this.allPartInstances),
			// writeScratchpadSegments(this.context, this.rundownsImpl),
			// this.#baselineHelper.saveAllToDatabase(),
		])

		this.#rundownHasChanged = false

		span?.end()
	}
}
