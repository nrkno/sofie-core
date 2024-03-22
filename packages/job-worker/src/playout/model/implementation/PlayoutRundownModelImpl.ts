import { PartId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { ReadonlyDeep } from 'type-fest'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { RundownBaselineObj } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineObj'
import { PlayoutRundownModel } from '../PlayoutRundownModel'
import { PlayoutSegmentModel } from '../PlayoutSegmentModel'
import { UserError, UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import { SegmentOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { getRandomId } from '@sofie-automation/corelib/dist/lib'
import { getCurrentTime } from '../../../lib'
import { PlayoutSegmentModelImpl } from './PlayoutSegmentModelImpl'

export class PlayoutRundownModelImpl implements PlayoutRundownModel {
	readonly rundown: ReadonlyDeep<DBRundown>
	readonly #segments: PlayoutSegmentModelImpl[]

	readonly baselineObjects: ReadonlyDeep<RundownBaselineObj[]>

	#scratchPadSegmentHasChanged = false
	/**
	 * Check if the Scratchpad Segment has unsaved changes
	 */
	get ScratchPadSegmentHasChanged(): boolean {
		return this.#scratchPadSegmentHasChanged
	}
	/**
	 * Clear the `ScratchPadSegmentHasChanged` flag
	 */
	clearScratchPadSegmentChangedFlag(): void {
		this.#scratchPadSegmentHasChanged = false
	}

	constructor(
		rundown: ReadonlyDeep<DBRundown>,
		segments: PlayoutSegmentModelImpl[],
		baselineObjects: ReadonlyDeep<RundownBaselineObj[]>
	) {
		segments.sort((a, b) => a.segment._rank - b.segment._rank)

		this.rundown = rundown
		this.#segments = segments
		this.baselineObjects = baselineObjects
	}

	get segments(): readonly PlayoutSegmentModel[] {
		return this.#segments
	}

	getSegment(id: SegmentId): PlayoutSegmentModel | undefined {
		return this.segments.find((segment) => segment.segment._id === id)
	}

	getSegmentIds(): SegmentId[] {
		return this.segments.map((segment) => segment.segment._id)
	}

	getAllPartIds(): PartId[] {
		return this.getAllOrderedParts().map((p) => p._id)
	}

	getAllOrderedParts(): ReadonlyDeep<DBPart>[] {
		return this.segments.flatMap((segment) => segment.parts)
	}

	insertScratchpadSegment(): SegmentId {
		const existingSegment = this.segments.find((s) => s.segment.orphaned === SegmentOrphanedReason.SCRATCHPAD)
		if (existingSegment) throw UserError.create(UserErrorMessage.ScratchpadAlreadyActive)

		const segmentId: SegmentId = getRandomId()
		this.#segments.unshift(
			new PlayoutSegmentModelImpl(
				{
					_id: segmentId,
					_rank: calculateRankForScratchpadSegment(this.#segments),
					externalId: '__scratchpad__',
					externalModified: getCurrentTime(),
					rundownId: this.rundown._id,
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
		const index = this.#segments.findIndex((s) => s.segment.orphaned === SegmentOrphanedReason.SCRATCHPAD)
		if (index === -1) return false

		this.#segments.splice(index, 1)
		this.#scratchPadSegmentHasChanged = true

		return true
	}

	getScratchpadSegment(): PlayoutSegmentModel | undefined {
		// Note: this assumes there will be up to one per rundown
		return this.#segments.find((s) => s.segment.orphaned === SegmentOrphanedReason.SCRATCHPAD)
	}

	updateScratchpadSegmentRank(): void {
		const segment = this.#segments.find((s) => s.segment.orphaned === SegmentOrphanedReason.SCRATCHPAD)
		if (!segment) return

		const changed = segment.setScratchpadRank(calculateRankForScratchpadSegment(this.#segments))
		if (!changed) return

		this.#segments.sort((a, b) => a.segment._rank - b.segment._rank)
		this.#scratchPadSegmentHasChanged = true
	}
}

function calculateRankForScratchpadSegment(segments: readonly PlayoutSegmentModel[]) {
	// Ensure the _rank is just before the real content

	return (
		Math.min(
			0,
			...segments.map((s) => (s.segment.orphaned === SegmentOrphanedReason.SCRATCHPAD ? 0 : s.segment._rank))
		) - 1
	)
}
