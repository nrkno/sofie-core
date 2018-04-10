import { Mongo } from 'meteor/mongo'
import { RundownAPI } from '../../lib/api/rundown'
import { Time } from '../../lib/lib'

import {
	IMOSExternalMetaData,
	IMOSObjectStatus,
	IMOSObjectAirStatus
} from 'mos-connection'

/** This is a very uncomplete mock-up of the Rundown object */
export interface RunningOrder {
	_id: string
	/** ID of the object in MOS */
	mosId: string
	studioInstallationId: string
	showStyleId: string
	/** Rundown slug - user-presentable name */
	name: string
	created: Time

	metaData?: Array<IMOSExternalMetaData>
	status?: IMOSObjectStatus
	airStatus?: IMOSObjectAirStatus
	// There should be something like a Owner user here somewhere?
	/** the id of the Live Segment Line - if empty, no segment line in this rundown is live */
	currentSegmentLineId: string | null
	/** the id of the Next Segment Line - if empty, no segment will follow Live Segment Line */
	nextSegmentLineId: string | null
}

export const RunningOrders = new Mongo.Collection<RunningOrder>('rundowns')
