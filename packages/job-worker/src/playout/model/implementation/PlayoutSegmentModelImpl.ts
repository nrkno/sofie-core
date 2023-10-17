import { PartId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReadonlyDeep } from 'type-fest'
import { DBSegment, SegmentOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { PlayoutSegmentModel } from '../PlayoutSegmentModel'

export class PlayoutSegmentModelImpl implements PlayoutSegmentModel {
	readonly #Segment: DBSegment
	readonly Parts: ReadonlyDeep<DBPart[]>

	get Segment(): ReadonlyDeep<DBSegment> {
		return this.#Segment
	}

	constructor(segment: DBSegment, parts: DBPart[]) {
		parts.sort((a, b) => a._rank - b._rank)

		this.#Segment = segment
		this.Parts = parts
	}

	getPart(id: PartId): ReadonlyDeep<DBPart> | undefined {
		return this.Parts.find((part) => part._id === id)
	}

	getPartIds(): PartId[] {
		return this.Parts.map((part) => part._id)
	}

	/**
	 * Internal mutation 'hack' to modify the rank of the ScratchPad segment
	 * This segment belongs to Playout, so is allowed to be modified in this way
	 * @param rank New rank for the segment
	 */
	setScratchpadRank(rank: number): void {
		if (this.#Segment.orphaned !== SegmentOrphanedReason.SCRATCHPAD)
			throw new Error('setScratchpadRank can only be used on a SCRATCHPAD segment')

		this.#Segment._rank = rank
	}
}
