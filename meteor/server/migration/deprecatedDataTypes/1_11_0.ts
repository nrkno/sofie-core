import { RundownId } from '../../../lib/collections/Rundowns'
import { PartNote } from '@sofie-automation/corelib/dist/dataModel/Notes'
import {
	PartEndState,
	Timeline as BPTimeline,
	PieceLifespan,
	BaseContent,
	Time,
} from '@sofie-automation/blueprints-integration'
import { PartId } from '../../../lib/collections/Parts'
import { SegmentId } from '../../../lib/collections/Segments'
import { PieceId, PieceStatusCode } from '../../../lib/collections/Pieces'

export interface IBlueprintPartDBTimings {
	/** Point in time the Part was taken, (ie the time of the user action) */
	take: Time[]
	/** Point in time the "take" action has finished executing */
	takeDone: Time[]
	/** Point in time the Part started playing (ie the time of the playout) */
	startedPlayback: Time[]
	/** Point in time the Part stopped playing (ie the time of the user action) */
	takeOut: Time[]
	/** Point in time the Part stopped playing (ie the time of the playout) */
	stoppedPlayback: Time[]
	/** Point in time the Part was set as Next (ie the time of the user action) */
	next: Time[]
}
export interface PartTimings extends IBlueprintPartDBTimings {
	/** The playback offset that was set for the last take */
	playOffset: Array<Time>
}

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

	status: PieceStatusCode
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
// export const Timeline: TransformedCollection<TimelineObjGeneric , TimelineObjGeneric> = Timeline120
