import { PartId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { ReadonlyDeep } from 'type-fest'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { RundownBaselineObj } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineObj'
import { PlayoutSegmentModel } from './PlayoutSegmentModel'

export interface PlayoutRundownModel {
	readonly Rundown: ReadonlyDeep<DBRundown>
	readonly Segments: readonly PlayoutSegmentModel[]

	readonly BaselineObjects: ReadonlyDeep<RundownBaselineObj[]>

	getSegmentIds(): SegmentId[]

	getSegment(id: SegmentId): PlayoutSegmentModel | undefined

	getAllPartIds(): PartId[]

	getAllOrderedParts(): ReadonlyDeep<DBPart>[]

	insertScratchpadSegment(): SegmentId
	removeScratchpadSegment(): boolean
	getScratchpadSegment(): PlayoutSegmentModel | undefined
	setScratchpadSegmentRank(rank: number): void
}
