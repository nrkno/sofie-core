import { PartId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { ReadonlyDeep } from 'type-fest'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { RundownBaselineObj } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineObj'
import { RundownWithSegments } from '../RundownWithSegments'
import { SegmentWithParts } from '../SegmentWithParts'
import { UserError, UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import { SegmentOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { getRandomId } from '@sofie-automation/corelib/dist/lib'
import { getCurrentTime } from '../../../lib'
import { SegmentWithPartsImpl } from './SegmentWithPartsImpl'

export class RundownWithSegmentsImpl implements RundownWithSegments {
	readonly Rundown: ReadonlyDeep<DBRundown>
	readonly #segments: SegmentWithPartsImpl[]

	readonly BaselineObjects: ReadonlyDeep<RundownBaselineObj[]>

	#scratchPadSegmentHasChanged = false
	get ScratchPadSegmentHasChanged(): boolean {
		return this.#scratchPadSegmentHasChanged
	}
	clearScratchPadSegmentChangedFlag(): void {
		this.#scratchPadSegmentHasChanged = false
	}

	constructor(
		rundown: ReadonlyDeep<DBRundown>,
		segments: SegmentWithPartsImpl[],
		baselineObjects: ReadonlyDeep<RundownBaselineObj[]>
	) {
		segments.sort((a, b) => a.Segment._rank - b.Segment._rank) // nocommit - check order

		this.Rundown = rundown
		this.#segments = segments
		this.BaselineObjects = baselineObjects
	}

	get Segments(): readonly SegmentWithParts[] {
		return this.#segments
	}

	getSegmentIds(): SegmentId[] {
		return this.Segments.map((segment) => segment.Segment._id)
	}

	getSegment(id: SegmentId): SegmentWithParts | undefined {
		return this.Segments.find((segment) => segment.Segment._id === id)
	}

	getAllPartIds(): PartId[] {
		return this.getAllOrderedParts().map((p) => p._id)
	}

	getAllOrderedParts(): ReadonlyDeep<DBPart>[] {
		return this.Segments.flatMap((segment) => segment.Parts)
	}

	insertScratchpadSegment(): SegmentId {
		const existingSegment = this.Segments.find((s) => s.Segment.orphaned === SegmentOrphanedReason.SCRATCHPAD)
		if (existingSegment) throw UserError.create(UserErrorMessage.ScratchpadAlreadyActive)

		const minSegmentRank = Math.min(0, ...this.Segments.map((s) => s.Segment._rank))

		const segmentId: SegmentId = getRandomId()
		this.#segments.unshift(
			new SegmentWithPartsImpl(
				{
					_id: segmentId,
					_rank: minSegmentRank - 1,
					externalId: '__scratchpad__',
					externalModified: getCurrentTime(),
					rundownId: this.Rundown._id,
					orphaned: SegmentOrphanedReason.SCRATCHPAD,
					name: '',
				},
				[]
			)
		)

		this.#scratchPadSegmentHasChanged = true

		return segmentId
	}

	removeScratchpadSegment(): boolean {
		const index = this.#segments.findIndex((s) => s.Segment.orphaned === SegmentOrphanedReason.SCRATCHPAD)
		if (index === -1) return false

		this.#segments.splice(index, 1)
		this.#scratchPadSegmentHasChanged = true

		return true
	}

	getScratchpadSegment(): SegmentWithParts | undefined {
		// Note: this assumes there will be up to one per rundown
		return this.#segments.find((s) => s.Segment.orphaned === SegmentOrphanedReason.SCRATCHPAD)
	}

	setScratchpadSegmentRank(rank: number): void {
		const segment = this.#segments.find((s) => s.Segment.orphaned === SegmentOrphanedReason.SCRATCHPAD)
		if (!segment) throw new Error('Scratchpad segment does not exist!')

		segment.setScratchpadRank(rank)
		this.#scratchPadSegmentHasChanged = true
	}
}
