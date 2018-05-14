import { Mongo } from 'meteor/mongo'

import {
	IMOSExternalMetaData,
	IMOSObjectStatus
} from 'mos-connection'

/** A "Line" in NRK Lingo. */
export interface SegmentLine {
	_id: string
  /** Position inside the segment */
	_rank: number
  /** ID of the source object in MOS */
	mosId: string
  /** The segment ("Title") this line belongs to */
	segmentId: string
  /** The running order this line belongs to */
	runningOrderId: string
	/** The story Slug (like a title, but slimier) */
	slug: string
	/** Should this item be taken live automatically */
	autoNext?: boolean

	metaData?: Array<IMOSExternalMetaData>
	status?: IMOSObjectStatus

	/** Expected duration of the line, in milliseconds */
	expectedDuration?: number

	/** The time the system started playback of this segment line, null if not yet played back (milliseconds since epoch) */
	startedPlayback?: number
	/** The time the system played back this segment line, null if not yet finished playing, in milliseconds */
	duration?: number
}

export const SegmentLines = new Mongo.Collection<SegmentLine>('segmentLines')
