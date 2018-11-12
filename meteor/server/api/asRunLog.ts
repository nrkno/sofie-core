import * as _ from 'underscore'
import { AsRunLogEventBase, AsRunLog, AsRunLogEvent } from '../../lib/collections/AsRunLog'
import { getCurrentTime, Time, asyncCollectionInsert, waitForPromise } from '../../lib/lib'

export function pushAsRunLogAsync (eventBase: AsRunLogEventBase, timestamp?: Time) {
	if (!timestamp) timestamp = getCurrentTime()

	let event: AsRunLogEvent = _.extend({}, eventBase, {
		timestamp: timestamp
	})

	return asyncCollectionInsert(AsRunLog, event)
}
export function pushAsRunLog (eventBase: AsRunLogEventBase, timestamp?: Time) {
	let p = pushAsRunLogAsync(eventBase, timestamp)

	return waitForPromise(p)
}
