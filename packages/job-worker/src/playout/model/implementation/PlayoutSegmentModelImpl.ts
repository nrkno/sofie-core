import { PartId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReadonlyDeep } from 'type-fest'
import { DBSegment, SegmentOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { PlayoutSegmentModel } from '../PlayoutSegmentModel'

export class PlayoutSegmentModelImpl implements PlayoutSegmentModel {
	readonly #segment: DBSegment
	readonly parts: ReadonlyDeep<DBPart[]>

	get segment(): ReadonlyDeep<DBSegment> {
		return this.#segment
	}

	constructor(segment: DBSegment, parts: DBPart[]) {
		parts.sort((a, b) => a._rank - b._rank)

		this.#segment = segment
		this.parts = parts
	}

	getPart(id: PartId): ReadonlyDeep<DBPart> | undefined {
		return this.parts.find((part) => part._id === id)
	}

	getPartIds(): PartId[] {
		return this.parts.map((part) => part._id)
	}

	/**
	 * Internal mutation 'hack' to modify the rank of the ScratchPad segment
	 * This segment belongs to Playout, so is allowed to be modified in this way
	 * @param rank New rank for the segment
	 */
	setScratchpadRank(rank: number): boolean {
		if (this.#segment.orphaned !== SegmentOrphanedReason.SCRATCHPAD)
			throw new Error('setScratchpadRank can only be used on a SCRATCHPAD segment')

		if (this.#segment._rank == rank) return false

		this.#segment._rank = rank
		return true
	}
}
