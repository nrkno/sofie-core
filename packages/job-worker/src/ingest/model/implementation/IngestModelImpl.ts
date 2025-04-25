import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { ExpectedMediaItemRundown } from '@sofie-automation/corelib/dist/dataModel/ExpectedMediaItem'
import {
	ExpectedPackageDB,
	ExpectedPackageDBType,
	ExpectedPackageFromRundown,
} from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
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
import { DBRundown, RundownOrphanedReason, RundownSource } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { CoreUserEditingDefinition } from '@sofie-automation/corelib/dist/dataModel/UserEditingDefinitions'
import { RundownBaselineAdLibAction } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibAction'
import { RundownBaselineAdLibItem } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibPiece'
import { RundownBaselineObj } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineObj'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { JobContext, ProcessedShowStyleBase, ProcessedShowStyleVariant } from '../../../jobs'
import { LazyInitialise, LazyInitialiseReadonly } from '../../../lib/lazy'
import { getRundownId, getSegmentId } from '../../lib'
import { RundownLock } from '../../../jobs/lock'
import { IngestSegmentModel } from '../IngestSegmentModel'
import { IngestSegmentModelImpl } from './IngestSegmentModelImpl'
import { IngestPartModel } from '../IngestPartModel'
import {
	clone,
	Complete,
	deleteAllUndefinedProperties,
	getRandomId,
	groupByToMap,
	literal,
} from '@sofie-automation/corelib/dist/lib'
import { IngestPartModelImpl } from './IngestPartModelImpl'
import { DatabasePersistedModel } from '../../../modelBase'
import { ExpectedPackagesStore } from './ExpectedPackagesStore'
import { ReadonlyDeep } from 'type-fest'
import {
	ExpectedPackageForIngestModel,
	ExpectedPackageForIngestModelBaseline,
	IngestModel,
	IngestReplaceSegmentType,
} from '../IngestModel'
import { RundownNote } from '@sofie-automation/corelib/dist/dataModel/Notes'
import { diffAndReturnLatestObjects } from './utils'
import _ = require('underscore')
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { IBlueprintRundown } from '@sofie-automation/blueprints-integration'
import { getCurrentTime, getSystemVersion } from '../../../lib'
import { WrappedShowStyleBlueprint } from '../../../blueprints/cache'
import { SaveIngestModelHelper } from './SaveIngestModel'
import { generateWriteOpsForLazyDocuments } from './DocumentChangeTracker'
import { IS_PRODUCTION } from '../../../environment'
import { logger } from '../../../logging'
import { NotificationsModelHelper } from '../../../notifications/NotificationsModelHelper'

export interface IngestModelImplExistingData {
	rundown: DBRundown
	segments: DBSegment[]
	parts: DBPart[]
	pieces: Piece[]
	adLibPieces: AdLibPiece[]
	adLibActions: AdLibAction[]
	expectedMediaItems: ExpectedMediaItemRundown[]
	expectedPlayoutItems: ExpectedPlayoutItemRundown[]
	expectedPackages: ExpectedPackageDB[]
}

/**
 * A light wrapper around the IngestSegmentModel, so that we can track the deletions while still accessing the contents
 */
interface SegmentWrapper {
	segmentModel: IngestSegmentModelImpl
	deleted: boolean
}

/**
 * Cache of relevant documents for an Ingest Operation
 */
export class IngestModelImpl implements IngestModel, DatabasePersistedModel {
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

	readonly #notificationsHelper: NotificationsModelHelper

	public get rundownId(): RundownId {
		return this.#rundownImpl?._id ?? getRundownId(this.context.studioId, this.rundownExternalId)
	}

	public get displayName(): string {
		return `IngestModel "${this.rundownExternalId}"`
	}

	protected readonly segmentsImpl: Map<SegmentId, SegmentWrapper>

	readonly #rundownBaselineExpectedPackagesStore: ExpectedPackagesStore<ExpectedPackageForIngestModelBaseline>

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

			const rundownExpectedPackages = existingData.expectedPackages.filter(
				(pkg): pkg is ExpectedPackageFromRundown =>
					pkg.fromPieceType === ExpectedPackageDBType.PIECE ||
					pkg.fromPieceType === ExpectedPackageDBType.ADLIB_PIECE ||
					pkg.fromPieceType === ExpectedPackageDBType.ADLIB_ACTION
			)
			const groupedExpectedPackages = groupByToMap(rundownExpectedPackages, 'partId')
			const baselineExpectedPackages = existingData.expectedPackages.filter(
				(pkg): pkg is ExpectedPackageForIngestModelBaseline =>
					pkg.fromPieceType === ExpectedPackageDBType.BASELINE_ADLIB_ACTION ||
					pkg.fromPieceType === ExpectedPackageDBType.BASELINE_ADLIB_PIECE ||
					pkg.fromPieceType === ExpectedPackageDBType.RUNDOWN_BASELINE_OBJECTS
			)

			this.#rundownBaselineExpectedPackagesStore = new ExpectedPackagesStore(
				false,
				this.rundownId,
				undefined,
				undefined,
				groupedExpectedMediaItems.get(undefined) ?? [],
				groupedExpectedPlayoutItems.get(undefined) ?? [],
				baselineExpectedPackages
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
				this.segmentsImpl.set(segment._id, {
					segmentModel: new IngestSegmentModelImpl(false, segment, parts),
					deleted: false,
				})
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

		this.#notificationsHelper = new NotificationsModelHelper(context, `ingest:${this.rundownId}`, null)
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
		return this.getSegment(segmentId)
	}

	/**
	 * Get the internal `_id` of a segment from the `externalId`
	 * @param externalId External id of the Segment
	 */
	getSegmentIdFromExternalId(externalId: string): SegmentId {
		return getSegmentId(this.rundownId, externalId)
	}

	/**
	 * Get a Segment from the Rundown
	 * @param id Id of the Segment
	 */
	getSegment(id: SegmentId): IngestSegmentModel | undefined {
		const segment = this.segmentsImpl.get(id)
		if (segment && !segment.deleted) return segment.segmentModel
		return undefined
	}
	/**
	 * Get the Segments of this Rundown, in no particular order
	 */
	getAllSegments(): IngestSegmentModel[] {
		const segments: IngestSegmentModel[] = []

		for (const segment of this.segmentsImpl.values()) {
			if (!segment.deleted) segments.push(segment.segmentModel)
		}

		return segments
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
			if (!segment || segment.deleted) continue
			const part = segment.segmentModel.getPart(partId)
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
		const segment = this.segmentsImpl.get(id)
		if (segment) {
			segment.deleted = true
		}
	}

	replaceSegment(rawSegment: IngestReplaceSegmentType): IngestSegmentModel {
		const segment: DBSegment = {
			...rawSegment,
			_id: this.getSegmentIdFromExternalId(rawSegment.externalId),
			rundownId: this.rundownId,
		}
		const oldSegment = this.segmentsImpl.get(segment._id)

		const newSegment = new IngestSegmentModelImpl(true, segment, [], oldSegment?.segmentModel)
		this.segmentsImpl.set(segment._id, {
			segmentModel: newSegment,
			deleted: false,
		})

		return newSegment
	}

	changeSegmentId(oldId: SegmentId, newId: SegmentId): boolean {
		const existingSegment = this.segmentsImpl.get(oldId)
		if (!existingSegment || existingSegment.deleted) return false

		const existingSegmentWithNewId = this.segmentsImpl.get(newId)
		if (existingSegmentWithNewId && !existingSegmentWithNewId.deleted)
			throw new Error(`Cannot rename Segment ${oldId} to ${newId}. New id is already in use`)

		this.segmentsImpl.set(oldId, {
			// Make a minimal clone of the old segment, the reference is needed to issue a mongo delete
			segmentModel: new IngestSegmentModelImpl(false, clone<DBSegment>(existingSegment.segmentModel.segment), []),
			deleted: true,
		})

		this.segmentsImpl.set(newId, existingSegment)
		existingSegment.segmentModel.setOwnerIds(newId)

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

	setRundownData(
		rundownData: IBlueprintRundown,
		showStyleBase: ReadonlyDeep<ProcessedShowStyleBase>,
		showStyleVariant: ReadonlyDeep<ProcessedShowStyleVariant>,
		showStyleBlueprint: ReadonlyDeep<WrappedShowStyleBlueprint>,
		source: RundownSource,
		rundownNotes: RundownNote[],
		userEditOperations: CoreUserEditingDefinition[] | undefined
	): ReadonlyDeep<DBRundown> {
		const newRundown = literal<Complete<DBRundown>>({
			...clone(rundownData as Complete<IBlueprintRundown>),
			notes: clone(rundownNotes),
			_id: this.rundownId,
			externalId: this.rundownExternalId,
			organizationId: this.context.studio.organizationId,
			studioId: this.context.studio._id,
			showStyleVariantId: showStyleVariant._id,
			showStyleBaseId: showStyleBase._id,
			userEditOperations: clone(userEditOperations),
			orphaned: undefined,

			importVersions: {
				studio: this.context.studio._rundownVersionHash,
				showStyleBase: showStyleBase._rundownVersionHash,
				showStyleVariant: showStyleVariant._rundownVersionHash,
				blueprint: showStyleBlueprint.blueprint.blueprintVersion,
				core: getSystemVersion(),
			},

			created: this.rundown?.created ?? getCurrentTime(),
			modified: getCurrentTime(),

			source: source,

			// validated later
			playlistId: this.#rundownImpl?.playlistId ?? protectString(''),
			playlistIdIsSetInSofie: this.#rundownImpl?.playlistIdIsSetInSofie,

			// owned by elsewhere
			airStatus: this.#rundownImpl?.airStatus,
			status: this.#rundownImpl?.status,
			notifiedCurrentPlayingPartExternalId: this.#rundownImpl?.notifiedCurrentPlayingPartExternalId,
		})
		deleteAllUndefinedProperties(newRundown)

		if (!this.#rundownImpl || !_.isEqual(this.#rundownImpl, newRundown)) {
			this.#rundownImpl = newRundown
			this.#rundownHasChanged = true
		}

		return this.#rundownImpl
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

		if (this.#rundownImpl.playlistIdIsSetInSofie)
			throw new Error(`Rundown "${this.rundownId}" playlistId cannot be changed, it is set by the User`)

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

	/** Notifications */

	async getAllNotifications(
		...args: Parameters<NotificationsModelHelper['getAllNotifications']>
	): ReturnType<NotificationsModelHelper['getAllNotifications']> {
		return this.#notificationsHelper.getAllNotifications(...args)
	}
	clearNotification(
		...args: Parameters<NotificationsModelHelper['clearNotification']>
	): ReturnType<NotificationsModelHelper['clearNotification']> {
		return this.#notificationsHelper.clearNotification(...args)
	}
	setNotification(
		...args: Parameters<NotificationsModelHelper['setNotification']>
	): ReturnType<NotificationsModelHelper['setNotification']> {
		return this.#notificationsHelper.setNotification(...args)
	}
	clearAllNotifications(
		...args: Parameters<NotificationsModelHelper['clearAllNotifications']>
	): ReturnType<NotificationsModelHelper['clearAllNotifications']> {
		return this.#notificationsHelper.clearAllNotifications(...args)
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

		function logOrThrowError(error: Error) {
			if (!IS_PRODUCTION) {
				throw error
			} else {
				logger.error(error)
			}
		}

		const span = this.context.startSpan('IngestModelImpl.assertNoChanges')
		try {
			if (this.#rundownHasChanged)
				logOrThrowError(new Error(`Failed no changes in model assertion, Rundown has been changed`))

			if (this.#rundownBaselineObjsWithChanges.size)
				logOrThrowError(new Error(`Failed no changes in model assertion, RundownBaselineObjs has been changed`))

			if (this.#rundownBaselineAdLibPiecesWithChanges.size)
				logOrThrowError(
					new Error(`Failed no changes in model assertion, RundownBaselineAdlibPieces has been changed`)
				)

			if (this.#rundownBaselineAdLibActionsWithChanges.size)
				logOrThrowError(
					new Error(`Failed no changes in model assertion, RundownBaselineAdlibActions has been changed`)
				)

			if (this.#rundownBaselineExpectedPackagesStore.hasChanges)
				logOrThrowError(
					new Error(`Failed no changes in model assertion, RundownBaselineExpectedPackages has been changed`)
				)

			for (const segment of this.segmentsImpl.values()) {
				if (segment.deleted) {
					logOrThrowError(new Error(`Failed no changes in model assertion, Segment has been changed`))
				} else {
					const err = segment.segmentModel.checkNoChanges()
					if (err) logOrThrowError(err)
				}
			}
		} finally {
			if (span) span.end()
		}
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

		// Ensure there are no duplicate part ids
		const partIds = new Set<PartId>()
		for (const part of this.getAllOrderedParts()) {
			if (partIds.has(part.part._id)) throw new Error(`Duplicate PartId "${part.part._id}" in IngestModel`)
			partIds.add(part.part._id)
		}

		const saveHelper = new SaveIngestModelHelper()
		for (const [segmentId, segment] of this.segmentsImpl.entries()) {
			saveHelper.addSegment(segment.segmentModel, segment.deleted)
			if (segment.deleted) {
				this.segmentsImpl.delete(segmentId)
			} else {
				segment.segmentModel.clearChangedFlags()
			}
		}

		const [baselineObjsOps, baselineAdLibPiecesOps, baselineAdLibActionsOps] = await Promise.all([
			generateWriteOpsForLazyDocuments(this.#rundownBaselineObjs, this.#rundownBaselineObjsWithChanges),
			generateWriteOpsForLazyDocuments(
				this.#rundownBaselineAdLibPieces,
				this.#rundownBaselineAdLibPiecesWithChanges
			),
			generateWriteOpsForLazyDocuments(
				this.#rundownBaselineAdLibActions,
				this.#rundownBaselineAdLibActionsWithChanges
			),
		])

		saveHelper.addExpectedPackagesStore(this.#rundownBaselineExpectedPackagesStore)
		this.#rundownBaselineExpectedPackagesStore.clearChangedFlags()

		await Promise.all([
			this.#rundownHasChanged && this.#rundownImpl
				? this.context.directCollections.Rundowns.replace(this.#rundownImpl)
				: undefined,
			this.context.directCollections.RundownBaselineObjects.bulkWrite(baselineObjsOps),
			this.context.directCollections.RundownBaselineAdLibPieces.bulkWrite(baselineAdLibPiecesOps),
			this.context.directCollections.RundownBaselineAdLibActions.bulkWrite(baselineAdLibActionsOps),
			...saveHelper.commit(this.context),
			this.#notificationsHelper.saveAllToDatabase(),
		])

		this.#rundownHasChanged = false

		span?.end()
	}
}
