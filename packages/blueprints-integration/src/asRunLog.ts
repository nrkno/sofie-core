import { Time } from './common'

export interface IBlueprintAsRunLogEvent {
	_id: string

	studioId: string
	rundownId: string
	segmentId?: string
	partInstanceId?: string
	pieceInstanceId?: string
	timelineObjectId?: string

	/** Name/id of the content */
	content: IBlueprintAsRunLogEventContent
	/** Name/id of the sub-content */
	content2?: string
	/** Metadata about the content */
	metadata?: any

	/** Timestamp of the event */
	timestamp: Time
	/** If the event was done in rehersal */
	rehersal: boolean
}
export enum IBlueprintAsRunLogEventContent {
	DATACHANGED = 'dataChanged',
	STARTEDPLAYBACK = 'startedPlayback',
	STOPPEDPLAYBACK = 'stoppedPlayback',
}
