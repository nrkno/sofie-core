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
import { clone } from '@sofie-automation/corelib/dist/lib'

/**
 * A light wrapper around the IngestPartModel, so that we can track the deletions while still accessing the contents
 */
interface PartWrapper {
	partModel: IngestPartModelImpl
	deleted: boolean
}

export class IngestSegmentModelImpl implements IngestSegmentModel {
	readonly #segment: DBSegment
	readonly #parts: Map<PartId, PartWrapper>

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
		const parts: IngestPartModel[] = []
		for (const part of this.#parts.values()) {
			if (!part.deleted) {
				parts.push(part.partModel)
			}
		}
		return parts
	}

	get segment(): ReadonlyDeep<DBSegment> {
		return this.#segment
	}

	constructor(segment: DBSegment, currentParts: IngestPartModelImpl[], previousSegment?: IngestSegmentModelImpl) {
		currentParts.sort((a, b) => a.part._rank - b.part._rank)

		this.#segment = segment
		this.#parts = new Map()
		for (const part of currentParts) {
			this.#parts.set(part.part._id, {
				partModel: part,
				deleted: false,
			})
		}

		if (previousSegment) {
			// This Segment replaces an existing one. This requires some more work to track any changes

			if (
				this.#segmentHasChanges ||
				previousSegment.#segmentHasChanges ||
				!_.isEqual(this.#segment, previousSegment.#segment)
			) {
				this.#segmentHasChanges = true
			}

			for (const [partId, oldPart] of previousSegment.#parts.entries()) {
				const newPart = this.#parts.get(partId)
				if (newPart) {
					// Merge the old part into the new part
					newPart.partModel.compareToPreviousModel(oldPart.partModel)
				} else {
					// Store the old part, marked as deleted
					this.#parts.set(partId, {
						partModel: oldPart.partModel,
						deleted: true,
					})
				}
			}
		}
	}

	/**
	 * Internal Method. This must only be called by the parent IngestModel as the storage may need updating to match
	 * @param id New id for the segment
	 */
	setOwnerIds(id: SegmentId): void {
		this.#segment._id = id

		for (const part of this.#parts.values()) {
			if (part && !part.deleted) part.partModel.setOwnerIds(this.#segment.rundownId, id)
		}
	}

	getPart(id: PartId): IngestPartModel | undefined {
		const partEntry = this.#parts.get(id)
		if (partEntry && !partEntry.deleted) return partEntry.partModel
		return undefined
	}

	getPartIds(): PartId[] {
		const ids: PartId[] = []
		for (const part of this.#parts.values()) {
			if (part && !part.deleted) {
				ids.push(part.partModel.part._id)
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
		for (const part of this.#parts.values()) {
			if (part && !part.deleted) {
				ids.push(part.partModel.part._id)
				part.deleted = true
			}
		}
		return ids
	}

	replacePart(part: DBPart, pieces: Piece[], adLibPiece: AdLibPiece[], adLibActions: AdLibAction[]): IngestPartModel {
		part.expectedDurationWithPreroll = calculatePartExpectedDurationWithPreroll(part, pieces)

		// We don't need to worry about this being present on other Segments. The caller must make sure it gets removed if needed,
		// and when persisting a duplicates check is performed. If there is a copy on another Segment, every document will have changes
		// due to the segmentId

		const oldPart = this.#parts.get(part._id)

		const partModel = new IngestPartModelImpl(
			!oldPart, // nocommit is this correct if it moved across segments?
			clone(part),
			clone(pieces),
			clone(adLibPiece),
			clone(adLibActions),
			[],
			[],
			[]
		)
		partModel.setOwnerIds(this.segment.rundownId, this.segment._id)

		if (oldPart) partModel.compareToPreviousModel(oldPart.partModel)

		this.#parts.set(part._id, { partModel, deleted: false })

		return partModel
	}
}
