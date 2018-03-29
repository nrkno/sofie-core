import { Mongo } from 'meteor/mongo'
import { RundownAPI } from '../../lib/api/rundown'
import { Time } from '../../lib/lib'

/** This is a very uncomplete mock-up of the Rundown object */
export interface RunningOrder {
	_id: string,
	/** ID of the object in MOS */
	mosId: string,
	studioInstallationId: string,
	showStyleId: string,
	name: string,
	created: Time,
	// There should be something like a Owner user here somewhere?
	currentSegmentLineId: string,
	nextSegmentLineId: string
}

export const RunningOrders = new Mongo.Collection<RunningOrder>('rundowns')
