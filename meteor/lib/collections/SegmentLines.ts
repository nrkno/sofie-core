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

	metaData?: Array<IMOSExternalMetaData>
	status?: IMOSObjectStatus
}

export const SegmentLines = new Mongo.Collection<SegmentLine>('segmentLines')
