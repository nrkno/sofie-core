import { PartId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReadonlyDeep } from 'type-fest'
import { DBSegment, SegmentOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { IngestReplacePartType, IngestSegmentModel } from '../IngestSegmentModel.js'
import _ from 'underscore'
import { IngestPartModelImpl } from './IngestPartModelImpl.js'
import { IngestPartModel } from '../IngestPartModel.js'
import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { calculatePartExpectedDurationWithTransition } from '@sofie-automation/corelib/dist/playout/timings'
import { clone } from '@sofie-automation/corelib/dist/lib'
import { getPartId } from '../../lib.js'

/**
 * A light wrapper around the IngestPartModel, so that we can track the deletions while still accessing the contents
 */
interface PartWrapper {
	partModel: IngestPartModelImpl
	deleted: boolean
}

export class IngestSegmentModelImpl implements IngestSegmentModel {
	readonly segmentImpl: DBSegment
	readonly partsImpl: Map<PartId, PartWrapper>

	#setSegmentValue<T extends keyof DBSegment>(key: T, newValue: DBSegment[T]): void {
		if (newValue === undefined) {
			delete this.segmentImpl[key]
		} else {
			this.segmentImpl[key] = newValue
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

		const oldValue = this.segmentImpl[key]

		const areEqual = deepEqual ? _.isEqual(oldValue, newValue) : oldValue === newValue

		if (!areEqual) {
			this.#setSegmentValue(key, newValue)

			return true
		} else {
			return false
		}
	}

	clearChangedFlags(): void {
		this.#segmentHasChanges = false
		for (const [partId, part] of this.partsImpl) {
			if (part.deleted) {
				this.partsImpl.delete(partId)
			} else {
				part.partModel.clearChangedFlags()
			}
		}
	}

	checkNoChanges(): Error | undefined {
		if (this.#segmentHasChanges) return new Error(`Failed no changes in model assertion, Segment has been changed`)

		for (const part of this.partsImpl.values()) {
			if (part.deleted) {
				return new Error(`Failed no changes in model assertion, Part has been changed`)
			} else {
				const err = part.partModel.checkNoChanges()
				if (err) return err
			}
		}

		return undefined
	}

	#segmentHasChanges = false
	get segmentHasChanges(): boolean {
		return this.#segmentHasChanges
	}

	get parts(): IngestPartModel[] {
		const parts: IngestPartModel[] = []
		for (const part of this.partsImpl.values()) {
			if (!part.deleted) {
				parts.push(part.partModel)
			}
		}
		return parts
	}

	get segment(): ReadonlyDeep<DBSegment> {
		return this.segmentImpl
	}

	constructor(
		isBeingCreated: boolean,
		segment: DBSegment,
		currentParts: IngestPartModelImpl[],
		previousSegment?: IngestSegmentModelImpl
	) {
		currentParts.sort((a, b) => a.part._rank - b.part._rank)

		this.#segmentHasChanges = isBeingCreated
		this.segmentImpl = segment
		this.partsImpl = new Map()
		for (const part of currentParts) {
			this.partsImpl.set(part.part._id, {
				partModel: part,
				deleted: false,
			})
		}

		if (previousSegment) {
			// This Segment replaces an existing one. This requires some more work to track any changes

			if (
				this.#segmentHasChanges ||
				previousSegment.#segmentHasChanges ||
				!_.isEqual(this.segmentImpl, previousSegment.segmentImpl)
			) {
				this.#segmentHasChanges = true
			}

			for (const [partId, oldPart] of previousSegment.partsImpl.entries()) {
				const newPart = this.partsImpl.get(partId)
				if (newPart) {
					// Merge the old part into the new part
					newPart.partModel.compareToPreviousModel(oldPart.partModel)
				} else {
					// Store the old part, marked as deleted
					this.partsImpl.set(partId, {
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
		this.segmentImpl._id = id

		for (const part of this.partsImpl.values()) {
			if (part && !part.deleted) part.partModel.setOwnerIds(this.segmentImpl.rundownId, id)
		}
	}

	getPartIdFromExternalId(externalId: string): PartId {
		return getPartId(this.segment.rundownId, externalId)
	}

	getPart(id: PartId): IngestPartModel | undefined {
		const partEntry = this.partsImpl.get(id)
		if (partEntry && !partEntry.deleted) return partEntry.partModel
		return undefined
	}

	getPartIds(): PartId[] {
		const ids: PartId[] = []
		for (const part of this.partsImpl.values()) {
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
		for (const part of this.partsImpl.values()) {
			if (part && !part.deleted) {
				ids.push(part.partModel.part._id)
				part.deleted = true
			}
		}
		return ids
	}

	replacePart(
		rawPart: IngestReplacePartType,
		pieces: Piece[],
		adLibPiece: AdLibPiece[],
		adLibActions: AdLibAction[]
	): IngestPartModel {
		const part: DBPart = {
			...rawPart,
			_id: this.getPartIdFromExternalId(rawPart.externalId),
			rundownId: this.segment.rundownId,
			segmentId: this.segment._id,
			expectedDurationWithTransition: calculatePartExpectedDurationWithTransition(rawPart, pieces),
		}

		// We don't need to worry about this being present on other Segments. The caller must make sure it gets removed if needed,
		// and when persisting a duplicates check is performed. If there is a copy on another Segment, every document will have changes
		// due to the segmentId

		const oldPart = this.partsImpl.get(part._id)

		const partModel = new IngestPartModelImpl(
			!oldPart,
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

		this.partsImpl.set(part._id, { partModel, deleted: false })

		return partModel
	}
}
