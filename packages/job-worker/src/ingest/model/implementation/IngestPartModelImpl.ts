import { ReadonlyDeep } from 'type-fest'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import _ = require('underscore')
import { IngestPartModel } from '../IngestPartModel'
import { AdLibActionId, PieceId, RundownId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { ExpectedMediaItemRundown } from '@sofie-automation/corelib/dist/dataModel/ExpectedMediaItem'
import { ExpectedPlayoutItemRundown } from '@sofie-automation/corelib/dist/dataModel/ExpectedPlayoutItem'
import { ExpectedPackageFromRundown } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { ExpectedPackagesStore } from './ExpectedPackagesStore'
import { diffAndStoreObjects, setValuesAndTrackChanges } from './utils'

export class IngestPartModelImpl implements IngestPartModel {
	readonly #part: DBPart
	readonly #pieces: Piece[]
	readonly #adLibPieces: AdLibPiece[]
	readonly #adLibActions: AdLibAction[]
	readonly #expectedPackagesStore: ExpectedPackagesStore<ExpectedPackageFromRundown>

	#setPartValue<T extends keyof DBPart>(key: T, newValue: DBPart[T]): void {
		if (newValue === undefined) {
			delete this.#part[key]
		} else {
			this.#part[key] = newValue
		}

		this.#partHasChanges = true
	}
	#compareAndSetPartValue<T extends keyof DBPart>(
		key: T,
		newValue: DBPart[T],
		alwaysCompare = false,
		deepEqual = false
	): boolean {
		if (!alwaysCompare && this.#partHasChanges) {
			// Fast-path if there are already changes
			this.#setPartValue(key, newValue)
			return true
		}

		const oldValue = this.#part[key]

		const areEqual = deepEqual ? _.isEqual(oldValue, newValue) : oldValue === newValue

		if (!areEqual) {
			this.#setPartValue(key, newValue)

			return true
		} else {
			return false
		}
	}

	#piecesWithChanges = new Set<PieceId>()
	#adLibPiecesWithChanges = new Set<PieceId>()
	#adLibActionsWithChanges = new Set<AdLibActionId>()

	#partHasChanges = false
	get partHasChanges(): boolean {
		return this.#partHasChanges
	}

	get part(): ReadonlyDeep<DBPart> {
		return this.#part
	}

	get pieces(): ReadonlyDeep<Piece>[] {
		return [...this.#pieces]
	}

	get adLibPieces(): ReadonlyDeep<AdLibPiece>[] {
		return [...this.#adLibPieces]
	}

	get adLibActions(): ReadonlyDeep<AdLibAction>[] {
		return [...this.#adLibActions]
	}

	get expectedMediaItems(): ReadonlyDeep<ExpectedMediaItemRundown>[] {
		return [...this.#expectedPackagesStore.expectedMediaItems]
	}
	get expectedPlayoutItems(): ReadonlyDeep<ExpectedPlayoutItemRundown>[] {
		return [...this.#expectedPackagesStore.expectedPlayoutItems]
	}
	get expectedPackages(): ReadonlyDeep<ExpectedPackageFromRundown>[] {
		return [...this.#expectedPackagesStore.expectedPackages]
	}

	constructor(
		isBeingCreated: boolean,
		part: DBPart,
		pieces: Piece[],
		adLibPieces: AdLibPiece[],
		adLibActions: AdLibAction[],
		expectedMediaItems: ExpectedMediaItemRundown[],
		expectedPlayoutItems: ExpectedPlayoutItemRundown[],
		expectedPackages: ExpectedPackageFromRundown[]
	) {
		this.#part = part
		this.#pieces = pieces
		this.#adLibPieces = adLibPieces
		this.#adLibActions = adLibActions

		if (isBeingCreated) {
			// This PartModel is being created by an ingest operation, so mark everything as having changed
			this.#partHasChanges = isBeingCreated
			for (const piece of pieces) {
				this.#piecesWithChanges.add(piece._id)
			}
			for (const adLibPiece of adLibPieces) {
				this.#adLibPiecesWithChanges.add(adLibPiece._id)
			}
			for (const adLibAction of adLibActions) {
				this.#adLibActionsWithChanges.add(adLibAction._id)
			}
		}

		this.#expectedPackagesStore = new ExpectedPackagesStore(
			isBeingCreated,
			part.rundownId,
			part.segmentId,
			part._id,
			expectedMediaItems,
			expectedPlayoutItems,
			expectedPackages
		)
	}

	setInvalid(invalid: boolean): void {
		this.#compareAndSetPartValue('invalid', invalid)
	}

	/**
	 * This IngestPartModel replaces an existing one.
	 * Run some comparisons to ensure that
	 * @param previousModel
	 */
	compareToPreviousModel(previousModel: IngestPartModelImpl): void {
		this.#expectedPackagesStore.compareToPreviousData(previousModel.#expectedPackagesStore)

		if (this.#partHasChanges || previousModel.#partHasChanges || !_.isEqual(this.#part, previousModel.#part)) {
			this.#partHasChanges = true
		}

		// Diff the objects, but don't update the stored copies
		diffAndStoreObjects(this.#piecesWithChanges, previousModel.#pieces, this.#pieces)
		diffAndStoreObjects(this.#adLibPiecesWithChanges, previousModel.#adLibPieces, this.#adLibPieces)
		diffAndStoreObjects(this.#adLibActionsWithChanges, previousModel.#adLibActions, this.#adLibActions)
	}

	/**
	 * Internal Method. This must only be called by the parent IngestSegment when its owners change
	 * @param segmentId Id of the owning parent
	 */
	setOwnerIds(rundownId: RundownId, segmentId: SegmentId): void {
		this.#compareAndSetPartValue('segmentId', segmentId)
		this.#compareAndSetPartValue('rundownId', rundownId)

		this.#expectedPackagesStore.setOwnerIds(rundownId, segmentId, this.part._id)

		setValuesAndTrackChanges(this.#piecesWithChanges, this.#pieces, {
			startRundownId: rundownId,
			startSegmentId: segmentId,
			startPartId: this.part._id,
		})
		setValuesAndTrackChanges(this.#adLibPiecesWithChanges, this.#adLibPieces, {
			rundownId,
			partId: this.part._id,
		})
		setValuesAndTrackChanges(this.#adLibActionsWithChanges, this.#adLibActions, {
			rundownId,
			partId: this.part._id,
		})
	}

	setExpectedPlayoutItems(expectedPlayoutItems: ExpectedPlayoutItemRundown[]): void {
		this.#expectedPackagesStore.setExpectedPlayoutItems(expectedPlayoutItems)
	}
	setExpectedMediaItems(expectedMediaItems: ExpectedMediaItemRundown[]): void {
		this.#expectedPackagesStore.setExpectedMediaItems(expectedMediaItems)
	}
	setExpectedPackages(expectedPackages: ExpectedPackageFromRundown[]): void {
		// Future: should these be here, or held as part of each adlib/piece?
		this.#expectedPackagesStore.setExpectedPackages(expectedPackages)
	}
}
