import { Time } from './common'

export interface IBlueprintAsRunLogEvent {
	_id: string

	studioId: string
	rundownId: string
	segmentId?: string
	partInstanceId?: string
	pieceInstanceId?: string

	/** Name/id of the content */
	content: IBlueprintAsRunLogEventContent
	/** Name/id of the sub-content */
	content2?: string // TODO - this is not read anywhere, and is implied based on what ids are set
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
