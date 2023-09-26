import { PartId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { ReadonlyDeep } from 'type-fest'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { RundownBaselineObj } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineObj'
import { SegmentWithParts } from './SegmentWithParts'

export interface RundownWithSegments {
	readonly Rundown: ReadonlyDeep<DBRundown>
	readonly Segments: readonly SegmentWithParts[]

	readonly BaselineObjects: ReadonlyDeep<RundownBaselineObj[]>

	getSegmentIds(): SegmentId[]

	getSegment(id: SegmentId): SegmentWithParts | undefined

	getAllPartIds(): PartId[]

	getAllOrderedParts(): ReadonlyDeep<DBPart>[]

	insertScratchpadSegment(): SegmentId
	removeScratchpadSegment(): boolean
	getScratchpadSegment(): SegmentWithParts | undefined
	setScratchpadSegmentRank(rank: number): void
}
