import { PartId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReadonlyDeep } from 'type-fest'
import { DBSegment, SegmentOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { IngestSegmentModel } from '../IngestSegmentModel'
import _ = require('underscore')
import { IngestPartModelImpl } from './IngestPartModelImpl'
import { IngestPartModel } from '../IngestPartModel'
import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { calculatePartExpectedDurationWithPreroll } from '@sofie-automation/corelib/dist/playout/timings'
import { clone, normalizeArrayToMapFunc } from '@sofie-automation/corelib/dist/lib'

export class IngestSegmentModelImpl implements IngestSegmentModel {
	readonly #segment: DBSegment
	readonly #parts: Map<PartId, IngestPartModelImpl | null>

	#setSegmentValue<T extends keyof DBSegment>(key: T, newValue: DBSegment[T]): void {
		if (newValue === undefined) {
			delete this.#segment[key]
		} else {
			this.#segment[key] = newValue
		}

		this.#segmentHasChanges = true
	}
	#compareAndSetSegmentValue<T extends keyof DBSegment>(
		key: T,
		newValue: DBSegment[T],
		alwaysCompare = false,
		deepEqual = false
	): boolean {
		if (!alwaysCompare && this.#segmentHasChanges) {
			// Fast-path if there are already changes
			this.#setSegmentValue(key, newValue)
			return true
		}

		const oldValue = this.#segment[key]

		const areEqual = deepEqual ? _.isEqual(oldValue, newValue) : oldValue === newValue

		if (!areEqual) {
			this.#setSegmentValue(key, newValue)

			return true
		} else {
			return false
		}
	}

	#segmentHasChanges = false
	get segmentHasChanges(): boolean {
		return this.#segmentHasChanges
	}

	get parts(): IngestPartModel[] {
		return Array.from(this.#parts.values()).filter((p): p is IngestPartModelImpl => p !== null)
	}

	get segment(): ReadonlyDeep<DBSegment> {
		return this.#segment
	}

	constructor(segment: DBSegment, parts: IngestPartModelImpl[]) {
		parts.sort((a, b) => a.part._rank - b.part._rank)

		this.#segment = segment
		this.#parts = normalizeArrayToMapFunc(parts, (p) => p.part._id)
	}

	/**
	 * Internal Method. This must only be called by the parent IngestModel as the storage may need updating to match
	 * @param id New id for the segment
	 */
	setOwnerIds(id: SegmentId): void {
		this.#segment._id = id

		for (const part of this.#parts.values()) {
			if (part) part.setOwnerIds(this.#segment.rundownId, id)
		}
	}

	getPart(id: PartId): IngestPartModel | undefined {
		return this.#parts.get(id) ?? undefined
	}

	getPartIds(): PartId[] {
		const ids: PartId[] = []
		for (const part of this.#parts.values()) {
			if (part) {
				ids.push(part.part._id)
			}
		}
		return ids
	}

	setRank(rank: number): boolean {
		return this.#compareAndSetSegmentValue('_rank', rank)
	}

	setOrphaned(orphaned: SegmentOrphanedReason | undefined): void {
		this.#compareAndSetSegmentValue('orphaned', orphaned)
	}

	setHidden(hidden: boolean): void {
		this.#compareAndSetSegmentValue('isHidden', hidden)
	}

	removeAllParts(): PartId[] {
		const ids: PartId[] = []
		for (const [id, part] of this.#parts.entries()) {
			if (part) {
				ids.push(part.part._id)
				this.#parts.set(id, null)
			}
		}
		return ids
	}

	replacePart(part: DBPart, pieces: Piece[], adLibPiece: AdLibPiece[], adLibActions: AdLibAction[]): IngestPartModel {
		part.expectedDurationWithPreroll = calculatePartExpectedDurationWithPreroll(part, pieces)

		// nocommit we should track which documents have changed, and ensure the expectedPackage.created property can be persisted as intended
		const partModel = new IngestPartModelImpl(
			clone(part),
			clone(pieces),
			clone(adLibPiece),
			clone(adLibActions),
			[],
			[],
			[]
		)
		partModel.setOwnerIds(this.segment.rundownId, this.segment._id)

		return partModel
	}
}
