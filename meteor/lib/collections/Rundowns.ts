import { Mongo } from 'meteor/mongo';
import {RundownAPI} from '../../lib/api/rundown';
import {Time}                from '../../lib/lib';


/** This is a very uncomplete mock-up of the Rundown object */
export interface Rundown {
	_id: String,
  studioInstallationId: String,
  showStyleId: String,
	name: String,
	created: Time,
	// There should be something like a Owner user here somewhere?
  currentSegmentLineId: String,
  nextSegmentLineId: String
}

export const Rundowns = new Mongo.Collection<Rundown>('rundowns');
