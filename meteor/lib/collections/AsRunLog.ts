import { TransformedCollection } from '../typings/meteor'
import { Time, registerCollection, Omit, ProtectedString, ProtectedStringProperties } from '../lib'
import { Meteor } from 'meteor/meteor'
import { IBlueprintAsRunLogEvent, IBlueprintAsRunLogEventContent } from 'tv-automation-sofie-blueprints-integration'
import { createMongoCollection } from './lib'
import { RundownId } from './Rundowns'
import { StudioId } from './Studios'
import { SegmentId } from './Segments'
import { PartInstanceId } from './PartInstances'
import { PieceInstanceId } from './PieceInstances'
import { TimelineObjId } from './Timeline'
import { registerIndex } from '../database'

export type AsRunLogEventBase = Omit<
	ProtectedStringProperties<
		IBlueprintAsRunLogEvent,
		'rundownId' | 'studioId' | 'segmentId' | 'partInstanceId' | 'pieceInstanceId' | 'timelineObjectId'
	>,
	'_id' | 'timestamp' | 'rehersal'
>

/** A string, identifying a AsRunLogEvent */
export type AsRunLogEventId = ProtectedString<'AsRunLogEventId'>

export interface AsRunLogEvent extends AsRunLogEventBase {
	_id: AsRunLogEventId
	/** Timestamp of the event */
	timestamp: Time
	/** If the event was done in rehersal */
	rehersal: boolean

	rundownId: RundownId
	studioId: StudioId
	segmentId?: SegmentId
	partInstanceId?: PartInstanceId
	pieceInstanceId?: PieceInstanceId
	timelineObjectId?: TimelineObjId
}

export const AsRunLog: TransformedCollection<AsRunLogEvent, AsRunLogEvent> = createMongoCollection<AsRunLogEvent>(
	'asRunLog'
)
registerCollection('AsRunLog', AsRunLog)

registerIndex(AsRunLog, {
	rundownId: 1,
})
registerIndex(AsRunLog, {
	timestamp: 1,
})
