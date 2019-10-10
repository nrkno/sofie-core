import * as _ from 'underscore'
import { clone } from '../../lib/lib'
import { TimelineObjGeneric } from '../../lib/collections/Timeline'
import { DBRundown } from '../../lib/collections/Rundowns'

// About snapshot testing: https://jestjs.io/docs/en/snapshot-testing

type Data = TimelineObjGeneric | DBRundown
/**
 * Remove certain fields from data that change often, so that it can be used in snapshots
 * @param data
 */
export function fixSnapshot (
	data: Data | Array<Data>
) {
	if (_.isArray(data)) {
		return _.map(data, fixSnapshot)
	} else {
		let o = clone(data)
		if (isTimelineObj(o)) {
			delete o['modified']
			delete o['objHash']
			if (o.content) {
				delete o.content['modified']

			}
		} else if (isRundown(o)) {
			delete o['created']
			delete o['modified']
		}
		return o
	}
}
function isTimelineObj (o): o is TimelineObjGeneric {
	return o.enable && o._id && o.id && o.studioId
}
function isRundown (o): o is DBRundown {
	return o._id && _.has(o, 'currentPartId')
}
