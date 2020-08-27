import { RundownId } from '../../../lib/collections/Rundowns'
import { PartNote } from '../../../lib/api/notes'
import {
	PartEndState,
	Timeline as BPTimeline,
	PieceLifespan,
	BaseContent,
} from 'tv-automation-sofie-blueprints-integration'
import { PartId, PartTimings } from '../../../lib/collections/Parts'
import { SegmentId } from '../../../lib/collections/Segments'
import { PieceId } from '../../../lib/collections/Pieces'
import { RundownAPI } from '../../../lib/api/rundown'
import { TimelineObjGeneric } from '../../../lib/collections/Timeline'
import { TransformedCollection } from '../../../lib/typings/meteor'
import { createMongoCollection } from '../../../lib/collections/lib'

export interface Part {
	// extends ProtectedStringProperties<IBlueprintPartDB, '_id' | 'segmentId'> {
	_id: PartId
	_rank: number

	rundownId: RundownId
	segmentId: SegmentId

	status?: string

	startedPlayback?: boolean
	stoppedPlayback?: boolean
	taken?: boolean

	duration?: number
	previousPartEndState?: PartEndState

	notes?: Array<PartNote>
	afterPart?: PartId
	dynamicallyInserted?: boolean

	runtimeArguments?: any // BlueprintRuntimeArguments
	dirty?: boolean
	identifier?: string
}

export interface PieceGeneric {
	//  extends IBlueprintPieceGeneric
	_id: PieceId
	externalId: string

	status: RundownAPI.PieceStatusCode
	disabled?: boolean
	hidden?: boolean
	virtual?: boolean
	continuesRefId?: PieceId
	adLibSourceId?: PieceId
	dynamicallyInserted?: boolean
	startedPlayback?: number
	timings?: PartTimings
	playoutDuration?: number

	isTransition?: boolean
	extendOnHold?: boolean
}
export interface RundownPieceGeneric extends PieceGeneric {
	rundownId: RundownId
	partId?: PartId
}
export interface Piece extends RundownPieceGeneric {
	// ProtectedStringProperties<Omit<IBlueprintPieceDB, '_id' | 'partId' | 'continuesRefId'>, 'infiniteId'> {

	partId: PartId
	userDuration?: Pick<BPTimeline.TimelineEnable, 'duration' | 'end'>
	infiniteMode?: PieceLifespan
	definitelyEnded?: number
	originalInfiniteMode?: PieceLifespan
	infiniteId?: PieceId

	content?: BaseContent
	stoppedPlayback?: number
	overflows?: boolean
}
export const Timeline: TransformedCollection<TimelineObjGeneric, TimelineObjGeneric> = createMongoCollection<
	TimelineObjGeneric
>('timeline')
