import { ReadonlyDeep } from 'type-fest'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import _ = require('underscore')
import { IngestPartModel } from '../IngestPartModel'
import { RundownId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { ExpectedMediaItemRundown } from '@sofie-automation/corelib/dist/dataModel/ExpectedMediaItem'
import { ExpectedPlayoutItemRundown } from '@sofie-automation/corelib/dist/dataModel/ExpectedPlayoutItem'
import { ExpectedPackageFromRundown } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { ExpectedPackagesStore } from './ExpectedPackagesStore'

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

	#partHasChanges = false
	get partHasChanges(): boolean {
		return this.#partHasChanges
	}

	get part(): ReadonlyDeep<DBPart> {
		return this.#part
	}

	get pieces(): ReadonlyDeep<Piece>[] {
		return this.#pieces
	}

	get adLibPieces(): ReadonlyDeep<AdLibPiece>[] {
		return this.#adLibPieces
	}

	get adLibActions(): ReadonlyDeep<AdLibAction>[] {
		return this.#adLibActions
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
		part: DBPart,
		pieces: Piece[],
		adLibPieces: AdLibPiece[],
		adLibActions: AdLibAction[],
		expectedMediaItems: ExpectedMediaItemRundown[],
		expectedPlayoutItems: ExpectedPlayoutItemRundown[],
		expectedPackages: ExpectedPackageFromRundown[]
	) {
		// parts.sort((a, b) => a._rank - b._rank)

		this.#part = part
		this.#pieces = pieces
		this.#adLibPieces = adLibPieces
		this.#adLibActions = adLibActions

		this.#expectedPackagesStore = new ExpectedPackagesStore(
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
	 * Internal Method. This must only be called by the parent IngestSegment when its owners change
	 * @param segmentId Id of the owning parent
	 */
	setOwnerIds(rundownId: RundownId, segmentId: SegmentId): void {
		this.#compareAndSetPartValue('segmentId', segmentId)
		this.#compareAndSetPartValue('rundownId', rundownId)

		this.#expectedPackagesStore.setOwnerIds(rundownId, segmentId, this.part._id)

		// nocommit track changed docs
		for (const adLibPiece of this.#adLibPieces) {
			adLibPiece.partId = this.part._id
			adLibPiece.rundownId = rundownId
		}
		for (const adLibAction of this.#adLibActions) {
			adLibAction.partId = this.part._id
			adLibAction.rundownId = rundownId
		}
		for (const piece of this.#pieces) {
			piece.startPartId = this.part._id
			piece.startSegmentId = segmentId
			piece.startRundownId = rundownId
		}
	}

	setExpectedPlayoutItems(expectedPlayoutItems: ExpectedPlayoutItemRundown[]): void {
		this.#expectedPackagesStore.setExpectedPlayoutItems(expectedPlayoutItems)
	}
	setExpectedMediaItems(expectedMediaItems: ExpectedMediaItemRundown[]): void {
		this.#expectedPackagesStore.setExpectedMediaItems(expectedMediaItems)
	}
	setExpectedPackages(expectedPackages: ExpectedPackageFromRundown[]): void {
		this.#expectedPackagesStore.setExpectedPackages(expectedPackages)
	}
}
