import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { Random } from 'meteor/random'
import {
	AsRunLogEventBase,
	AsRunLog,
	AsRunLogEvent
} from '../../lib/collections/AsRunLog'
import {
	getCurrentTime,
	Time,
	asyncCollectionInsert,
	waitForPromise,
	pushOntoPath,
	waitForPromiseAll,
	asyncCollectionFindOne,
	asyncCollectionUpdate,
	extendMandadory
} from '../../lib/lib'
import {
	RunningOrder,
	RunningOrders
} from '../../lib/collections/RunningOrders'
import { SegmentLine, SegmentLines } from '../../lib/collections/SegmentLines'
import { SegmentLineItem, SegmentLineItems } from '../../lib/collections/SegmentLineItems'
import { logger } from '../../lib/logging'
import { getBlueprintOfRunningOrder, AsRunEventContext } from './blueprints'
import { IBlueprintExternalMessageQueueObj, IBlueprintAsRunLogEventContent } from 'tv-automation-sofie-blueprints-integration'
import { queueExternalMessages } from './ExternalMessageQueue'

const EVENT_WAIT_TIME = 500

export function pushAsRunLogAsync (eventBase: AsRunLogEventBase, rehersal: boolean, timestamp?: Time): Promise<AsRunLogEvent> {
	if (!timestamp) timestamp = getCurrentTime()

	let event: AsRunLogEvent = extendMandadory<AsRunLogEventBase, AsRunLogEvent>(eventBase, {
		_id: Random.id(),
		timestamp: timestamp,
		rehersal: rehersal
	})

	return asyncCollectionInsert(AsRunLog, event)
	.then(() => {
		return event
	})
}
export function pushAsRunLog (eventBase: AsRunLogEventBase, rehersal: boolean, timestamp?: Time): AsRunLogEvent {
	let p = pushAsRunLogAsync(eventBase, rehersal, timestamp)

	return waitForPromise(p)
}

/**
 * Called after an asRun log event occurs
 * @param event
 */
function handleEvent (event: AsRunLogEvent): void {
	// wait EVENT_WAIT_TIME, because blueprint.onAsRunEvent() might depend on events that
	// might havent been reported yet
	Meteor.setTimeout(() => {
		try {
			if (event.runningOrderId) {

				let runningOrder = RunningOrders.findOne(event.runningOrderId) as RunningOrder
				if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${event.runningOrderId}" not found!`)

				let bp = getBlueprintOfRunningOrder(runningOrder)

				if (bp.onAsRunEvent) {
					const context = new AsRunEventContext(runningOrder, event)

					Promise.resolve(bp.onAsRunEvent(context))
					.then((messages: Array<IBlueprintExternalMessageQueueObj>) => {

						queueExternalMessages(runningOrder, messages)
					})
					.catch(error => logger.error(error))
				}

			}
		} catch (e) {
			logger.error(e)
		}
	}, EVENT_WAIT_TIME)
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

		let event = pushAsRunLog({
			studioId: runningOrder.studioInstallationId,
			runningOrderId: runningOrder._id,
			content: IBlueprintAsRunLogEventContent.STARTEDPLAYBACK,
			content2: 'runningOrder'
		}, !!runningOrder.rehearsal, timestamp)
		handleEvent(event)
	} else logger.error(`runningOrder not found in reportRunningOrderHasStarted "${runningOrderOrId}"`)
}
// export function reportSegmentHasStarted (segment: Segment, timestamp?: Time) {
// }
export function reportSegmentLineHasStarted (segmentLineOrId: SegmentLine | string , timestamp: Time) {

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
					stoppedPlayback: false,
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
		segmentLine.stoppedPlayback = false
		pushOntoPath(segmentLine, 'timings.startedPlayback', timestamp)

		if (runningOrder) {
			let event = pushAsRunLog({
				studioId:			runningOrder.studioInstallationId,
				runningOrderId:		runningOrder._id,
				segmentId:			segmentLine.segmentId,
				segmentLineId:		segmentLine._id,
				content:			IBlueprintAsRunLogEventContent.STARTEDPLAYBACK,
				content2: 			'segmentLine'
			}, !!runningOrder.rehearsal, timestamp)
			handleEvent(event)
		} else logger.error(`runningOrder "${segmentLine.runningOrderId}" not found in reportSegmentLineHasStarted "${segmentLine._id}"`)
	} else logger.error(`segmentLine not found in reportSegmentLineHasStarted "${segmentLineOrId}"`)
}
export function reportSegmentLineHasStopped (segmentLineOrId: SegmentLine | string , timestamp: Time) {

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
					stoppedPlayback: true,
				},
				$push: {
					'timings.stoppedPlayback': timestamp
				}
			}),
			asyncCollectionFindOne(RunningOrders, segmentLine.runningOrderId)
		])
		runningOrder = r[1]
		// also update local object:
		segmentLine.stoppedPlayback = true
		pushOntoPath(segmentLine, 'timings.stoppedPlayback', timestamp)

		if (runningOrder) {
			let event = pushAsRunLog({
				studioId:			runningOrder.studioInstallationId,
				runningOrderId:		runningOrder._id,
				segmentId:			segmentLine.segmentId,
				segmentLineId:		segmentLine._id,
				content:			IBlueprintAsRunLogEventContent.STOPPEDPLAYBACK,
				content2: 			'segmentLine'
			}, !!runningOrder.rehearsal, timestamp)
			handleEvent(event)
		} else logger.error(`runningOrder "${segmentLine.runningOrderId}" not found in reportSegmentLineHasStopped "${segmentLine._id}"`)
	} else logger.error(`segmentLine not found in reportSegmentLineHasStopped "${segmentLineOrId}"`)
}

export function reportSegmentLineItemHasStarted (segmentLineItemOrId: SegmentLineItem | string, timestamp: Time) {

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
					startedPlayback: timestamp,
					stoppedPlayback: 0
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
		segmentLineItem.stoppedPlayback = 0
		pushOntoPath(segmentLineItem, 'timings.startedPlayback', timestamp)

		if (runningOrder) {
			let event = pushAsRunLog({
				studioId:			runningOrder.studioInstallationId,
				runningOrderId:		runningOrder._id,
				segmentId:			segmentLine.segmentId,
				segmentLineId:		segmentLineItem.segmentLineId,
				segmentLineItemId:	segmentLineItem._id,
				content:			IBlueprintAsRunLogEventContent.STARTEDPLAYBACK,
				content2: 			'segmentLineItem'
			}, !!runningOrder.rehearsal, timestamp)
			handleEvent(event)
		} else logger.error(`runningOrder "${segmentLine.runningOrderId}" not found in reportSegmentLineItemHasStarted "${segmentLine._id}"`)

	} else logger.error(`segmentLineItem not found in reportSegmentLineItemHasStarted "${segmentLineItemOrId}"`)
}
export function reportSegmentLineItemHasStopped (segmentLineItemOrId: SegmentLineItem | string, timestamp: Time) {

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
					stoppedPlayback: timestamp
				},
				$push: {
					'timings.stoppedPlayback': timestamp
				}
			}),
			asyncCollectionFindOne(RunningOrders, segmentLineItem.runningOrderId),
			asyncCollectionFindOne(SegmentLines, segmentLineItem.segmentLineId)
		])
		runningOrder = r[1]
		segmentLine = r[2]
		// also update local object:
		segmentLineItem.stoppedPlayback = timestamp
		pushOntoPath(segmentLineItem, 'timings.stoppedPlayback', timestamp)

		if (runningOrder) {
			let event = pushAsRunLog({
				studioId:			runningOrder.studioInstallationId,
				runningOrderId:		runningOrder._id,
				segmentId:			segmentLine.segmentId,
				segmentLineId:		segmentLineItem.segmentLineId,
				segmentLineItemId:	segmentLineItem._id,
				content:			IBlueprintAsRunLogEventContent.STOPPEDPLAYBACK,
				content2: 			'segmentLineItem'
			}, !!runningOrder.rehearsal, timestamp)
			handleEvent(event)
		} else logger.error(`runningOrder "${segmentLine.runningOrderId}" not found in reportSegmentLineItemHasStopped "${segmentLine._id}"`)

	} else logger.error(`segmentLineItem not found in reportSegmentLineItemHasStopped "${segmentLineItemOrId}"`)
}
