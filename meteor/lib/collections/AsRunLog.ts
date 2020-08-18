import { Meteor } from 'meteor/meteor'
import { IBlueprintAsRunLogEvent } from 'tv-automation-sofie-blueprints-integration'
import { Omit, ProtectedString, ProtectedStringProperties, registerCollection, Time } from '../lib'
import { TransformedCollection } from '../typings/meteor'
import { createMongoCollection } from './lib'
import { PartInstanceId } from './PartInstances'
import { PieceInstanceId } from './PieceInstances'
import { RundownId } from './Rundowns'
import { SegmentId } from './Segments'
import { StudioId } from './Studios'
import { TimelineObjId } from './Timeline'

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

Meteor.startup(() => {
	if (Meteor.isServer) {
		AsRunLog._ensureIndex({
			rundownId: 1,
		})
		AsRunLog._ensureIndex({
			timestamp: 1,
		})
	}
})
