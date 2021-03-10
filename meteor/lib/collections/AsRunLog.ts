import { TransformedCollection } from '../typings/meteor'
import { Time, registerCollection, ProtectedString, ProtectedStringProperties } from '../lib'
import { IBlueprintAsRunLogEvent } from '@sofie-automation/blueprints-integration'
import { createMongoCollection } from './lib'
import { RundownId } from './Rundowns'
import { StudioId } from './Studios'
import { SegmentId } from './Segments'
import { PartInstanceId } from './PartInstances'
import { PieceInstanceId } from './PieceInstances'
import { registerIndex } from '../database'

export type AsRunLogEventBase = Omit<AsRunLogEvent, '_id' | 'timestamp' | 'rehersal'>

/** A string, identifying a AsRunLogEvent */
export type AsRunLogEventId = ProtectedString<'AsRunLogEventId'>

export interface AsRunLogEvent
	extends ProtectedStringProperties<
		IBlueprintAsRunLogEvent,
		'_id' | 'rundownId' | 'studioId' | 'segmentId' | 'partInstanceId' | 'pieceInstanceId'
	> {
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
