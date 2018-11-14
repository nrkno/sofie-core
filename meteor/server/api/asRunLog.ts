import * as _ from 'underscore'
import { AsRunLogEventBase, AsRunLog, AsRunLogEvent } from '../../lib/collections/AsRunLog'
import { getCurrentTime, Time, asyncCollectionInsert, waitForPromise, pushOntoPath, waitForPromiseAll, asyncCollectionFindOne, asyncCollectionUpdate } from '../../lib/lib'
import { RunningOrder, RunningOrders } from '../../lib/collections/RunningOrders'
import { Segment } from '../../lib/collections/Segments'
import { SegmentLine, SegmentLines } from '../../lib/collections/SegmentLines'
import { SegmentLineItem, SegmentLineItems } from '../../lib/collections/SegmentLineItems'
import { logger } from '../../lib/logging'

export function pushAsRunLogAsync (eventBase: AsRunLogEventBase, rehersal: boolean, timestamp?: Time) {
	if (!timestamp) timestamp = getCurrentTime()

	let event: AsRunLogEvent = _.extend({}, eventBase, {
		timestamp: timestamp,
		rehersal: rehersal
	})

	return asyncCollectionInsert(AsRunLog, event)
}
export function pushAsRunLog (eventBase: AsRunLogEventBase, rehersal: boolean, timestamp?: Time) {
	let p = pushAsRunLogAsync(eventBase, rehersal, timestamp)

	return waitForPromise(p)
}

// Convenience functions:

export function reportRunningOrderHasStarted (runningOrderOrId: RunningOrder | string, timestamp?: Time) {
	// Called when the first item in runningOrder starts playing

	let runningOrder = (
		_.isString(runningOrderOrId) ?
		RunningOrders.findOne(runningOrderOrId) :
		runningOrderOrId
	)
	if (runningOrder) {
		RunningOrders.update(runningOrder._id, {
			$set: {
				startedPlayback: timestamp
			}
		})
		// also update local object:
		runningOrder.startedPlayback = timestamp

		pushAsRunLog({
			studioId: runningOrder.studioInstallationId,
			runningOrderId: runningOrder._id,
			content: 'startedPlayback',
			content2: 'runningOrder'
		}, !!runningOrder.rehearsal, timestamp)
	} else logger.error(`runningOrder not found in reportRunningOrderHasStarted "${runningOrderOrId}"`)
}
// export function reportSegmentHasStarted (segment: Segment, timestamp?: Time) {
// }
export function reportSegmentLineHasStarted (segmentLineOrId: SegmentLine | string , timestamp?: Time) {

	let segmentLine = (
		_.isString(segmentLineOrId) ?
		SegmentLines.findOne(segmentLineOrId) :
		segmentLineOrId
	)
	if (segmentLine) {
		let runningOrder: RunningOrder

		let r = waitForPromiseAll<any>([
			asyncCollectionUpdate(SegmentLines, segmentLine._id, {
				$set: {
					startedPlayback: true,
				},
				$push: {
					'timings.startedPlayback': timestamp
				}
			}),
			asyncCollectionFindOne(RunningOrders, segmentLine.runningOrderId)
		])
		runningOrder = r[1]
		// also update local object:
		segmentLine.startedPlayback = true
		pushOntoPath(segmentLine, 'timings.startedPlayback', timestamp)

		if (runningOrder) {
			pushAsRunLog({
				studioId:			runningOrder.studioInstallationId,
				runningOrderId:		runningOrder._id,
				segmentId:			segmentLine.segmentId,
				segmentLineId:		segmentLine._id,
				content:			'startedPlayback',
				content2: 			'segmentLine'
			}, !!runningOrder.rehearsal, timestamp)
		} else logger.error(`runningOrder "${segmentLine.runningOrderId}" not found in reportSegmentLineHasStarted "${segmentLine._id}"`)
	} else logger.error(`segmentLine not found in reportSegmentLineHasStarted "${segmentLineOrId}"`)
}

export function reportSegmentLineItemHasStarted (segmentLineItemOrId: SegmentLineItem | string, timestamp?: Time) {

	let segmentLineItem = (
		_.isString(segmentLineItemOrId) ?
		SegmentLineItems.findOne(segmentLineItemOrId) :
		segmentLineItemOrId
	)
	if (segmentLineItem) {

		let runningOrder: RunningOrder
		let segmentLine: SegmentLine
		let r = waitForPromiseAll<any>([
			asyncCollectionUpdate(SegmentLineItems, segmentLineItem._id, {
				$set: {
					startedPlayback: timestamp
				},
				$push: {
					'timings.startedPlayback': timestamp
				}
			}),
			asyncCollectionFindOne(RunningOrders, segmentLineItem.runningOrderId),
			asyncCollectionFindOne(SegmentLines, segmentLineItem.segmentLineId)
		])
		runningOrder = r[1]
		segmentLine = r[2]
		// also update local object:
		segmentLineItem.startedPlayback = timestamp
		pushOntoPath(segmentLineItem, 'timings.startedPlayback', timestamp)

		if (runningOrder) {
			pushAsRunLog({
				studioId:			runningOrder.studioInstallationId,
				runningOrderId:		runningOrder._id,
				segmentId:			segmentLine.segmentId,
				segmentLineId:		segmentLineItem._id,
				segmentLineItemId:	segmentLineItem._id,
				content:			'startedPlayback',
				content2: 			'segmentLineItem'
			}, !!runningOrder.rehearsal, timestamp)
		} else logger.error(`runningOrder "${segmentLine.runningOrderId}" not found in reportSegmentLineHasStarted "${segmentLine._id}"`)

	} else logger.error(`segmentLineItem not found in reportSegmentLineItemHasStarted "${segmentLineItemOrId}"`)
}
