import { Mongo } from 'meteor/mongo'

import {
	IMOSExternalMetaData,
	IMOSObjectStatus
} from 'mos-connection'

/** A "Title" in NRK Lingo / "Stories" in ENPS Lingo. */
export interface Segment {
	_id: string
	/** Position inside running order */
	_rank: number
	/** ID of the source object in MOS */
	mosId: string
  /** The running order this segment belongs to */
	runningOrderId: string
  /** User-presentable name (Slug) for the Title */
	name: string

	metaData?: Array<IMOSExternalMetaData>
	status?: IMOSObjectStatus
	expanded?: boolean
}

export const Segments = new Mongo.Collection<Segment>('segments')
