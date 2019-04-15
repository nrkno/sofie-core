import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import {
	AsRunLogEventBase,
	AsRunLog,
	AsRunLogEvent
} from '../../lib/collections/AsRunLog'
import {
	getCurrentTime,
	Time,
	waitForPromise,
	pushOntoPath,
	waitForPromiseAll,
	asyncCollectionFindOne,
	asyncCollectionUpdate,
	extendMandadory,
	asyncCollectionUpsert,
	getHash
} from '../../lib/lib'
import {
	Rundown,
	Rundowns
} from '../../lib/collections/Rundowns'
import { SegmentLine, SegmentLines } from '../../lib/collections/SegmentLines'
import { SegmentLineItem, SegmentLineItems } from '../../lib/collections/SegmentLineItems'
import { logger } from '../../lib/logging'
import { IBlueprintExternalMessageQueueObj, IBlueprintAsRunLogEventContent } from 'tv-automation-sofie-blueprints-integration'
import { queueExternalMessages } from './ExternalMessageQueue'
import { getBlueprintOfRundown } from './blueprints/cache'
import { AsRunEventContext } from './blueprints/context'

const EVENT_WAIT_TIME = 500

export async function pushAsRunLogAsync (eventBase: AsRunLogEventBase, rehersal: boolean, timestamp?: Time): Promise<AsRunLogEvent | null> {
	if (!timestamp) timestamp = getCurrentTime()

	let event: AsRunLogEvent = extendMandadory<AsRunLogEventBase, AsRunLogEvent>(eventBase, {
		_id: getHash(JSON.stringify(eventBase) + timestamp + '_' + rehersal),
		timestamp: timestamp,
		rehersal: rehersal
	})

	let result = await asyncCollectionUpsert(AsRunLog, event._id, event)
	if (result.insertedId) {
		return event
	} else {
		return null
	}
}
export function pushAsRunLog (eventBase: AsRunLogEventBase, rehersal: boolean, timestamp?: Time): AsRunLogEvent | null {
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
			if (event.rundownId) {

				const rundown = Rundowns.findOne(event.rundownId) as Rundown
				if (!rundown) throw new Meteor.Error(404, `Rundown "${event.rundownId}" not found!`)

				let bp = getBlueprintOfRundown(rundown)

				if (bp.onAsRunEvent) {
					const context = new AsRunEventContext(rundown, undefined, event)

					Promise.resolve(bp.onAsRunEvent(context))
					.then((messages: Array<IBlueprintExternalMessageQueueObj>) => {

						queueExternalMessages(rundown, messages)
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

export function reportRundownHasStarted (rundownOrId: Rundown | string, timestamp?: Time) {
	// Called when the first item in rundown starts playing

	let rundown = (
		_.isString(rundownOrId) ?
		Rundowns.findOne(rundownOrId) :
		rundownOrId
	)
	if (rundown) {
		Rundowns.update(rundown._id, {
			$set: {
				startedPlayback: timestamp
			}
		})
		// also update local object:
		rundown.startedPlayback = timestamp

		let event = pushAsRunLog({
			studioId: rundown.studioInstallationId,
			rundownId: rundown._id,
			content: IBlueprintAsRunLogEventContent.STARTEDPLAYBACK,
			content2: 'rundown'
		}, !!rundown.rehearsal, timestamp)
		if (event) handleEvent(event)
	} else logger.error(`rundown not found in reportRundownHasStarted "${rundownOrId}"`)
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
		let rundown: Rundown

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
			asyncCollectionFindOne(Rundowns, segmentLine.rundownId)
		])
		rundown = r[1]
		// also update local object:
		segmentLine.startedPlayback = true
		segmentLine.stoppedPlayback = false
		pushOntoPath(segmentLine, 'timings.startedPlayback', timestamp)

		if (rundown) {
			let event = pushAsRunLog({
				studioId:			rundown.studioInstallationId,
				rundownId:		rundown._id,
				segmentId:			segmentLine.segmentId,
				segmentLineId:		segmentLine._id,
				content:			IBlueprintAsRunLogEventContent.STARTEDPLAYBACK,
				content2: 			'segmentLine'
			}, !!rundown.rehearsal, timestamp)
			if (event) handleEvent(event)
		} else logger.error(`rundown "${segmentLine.rundownId}" not found in reportSegmentLineHasStarted "${segmentLine._id}"`)
	} else logger.error(`segmentLine not found in reportSegmentLineHasStarted "${segmentLineOrId}"`)
}
export function reportSegmentLineHasStopped (segmentLineOrId: SegmentLine | string , timestamp: Time) {

	let segmentLine = (
		_.isString(segmentLineOrId) ?
		SegmentLines.findOne(segmentLineOrId) :
		segmentLineOrId
	)
	if (segmentLine) {
		let rundown: Rundown

		let r = waitForPromiseAll<any>([
			asyncCollectionUpdate(SegmentLines, segmentLine._id, {
				$set: {
					stoppedPlayback: true,
				},
				$push: {
					'timings.stoppedPlayback': timestamp
				}
			}),
			asyncCollectionFindOne(Rundowns, segmentLine.rundownId)
		])
		rundown = r[1]
		// also update local object:
		segmentLine.stoppedPlayback = true
		pushOntoPath(segmentLine, 'timings.stoppedPlayback', timestamp)

		if (rundown) {
			let event = pushAsRunLog({
				studioId:			rundown.studioInstallationId,
				rundownId:		rundown._id,
				segmentId:			segmentLine.segmentId,
				segmentLineId:		segmentLine._id,
				content:			IBlueprintAsRunLogEventContent.STOPPEDPLAYBACK,
				content2: 			'segmentLine'
			}, !!rundown.rehearsal, timestamp)
			if (event) handleEvent(event)
			return event
		} else logger.error(`rundown "${segmentLine.rundownId}" not found in reportSegmentLineHasStopped "${segmentLine._id}"`)
	} else logger.error(`segmentLine not found in reportSegmentLineHasStopped "${segmentLineOrId}"`)
}

export function reportSegmentLineItemHasStarted (segmentLineItemOrId: SegmentLineItem | string, timestamp: Time) {

	let segmentLineItem = (
		_.isString(segmentLineItemOrId) ?
		SegmentLineItems.findOne(segmentLineItemOrId) :
		segmentLineItemOrId
	)
	if (segmentLineItem) {

		let rundown: Rundown
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
			asyncCollectionFindOne(Rundowns, segmentLineItem.rundownId),
			asyncCollectionFindOne(SegmentLines, segmentLineItem.segmentLineId)
		])
		rundown = r[1]
		segmentLine = r[2]
		// also update local object:
		segmentLineItem.startedPlayback = timestamp
		segmentLineItem.stoppedPlayback = 0
		pushOntoPath(segmentLineItem, 'timings.startedPlayback', timestamp)

		if (rundown) {
			let event = pushAsRunLog({
				studioId:			rundown.studioInstallationId,
				rundownId:		rundown._id,
				segmentId:			segmentLine.segmentId,
				segmentLineId:		segmentLineItem.segmentLineId,
				segmentLineItemId:	segmentLineItem._id,
				content:			IBlueprintAsRunLogEventContent.STARTEDPLAYBACK,
				content2: 			'segmentLineItem'
			}, !!rundown.rehearsal, timestamp)
			if (event) handleEvent(event)
		} else logger.error(`rundown "${segmentLine.rundownId}" not found in reportSegmentLineItemHasStarted "${segmentLine._id}"`)

	} else logger.error(`segmentLineItem not found in reportSegmentLineItemHasStarted "${segmentLineItemOrId}"`)
}
export function reportSegmentLineItemHasStopped (segmentLineItemOrId: SegmentLineItem | string, timestamp: Time) {

	let segmentLineItem = (
		_.isString(segmentLineItemOrId) ?
		SegmentLineItems.findOne(segmentLineItemOrId) :
		segmentLineItemOrId
	)
	if (segmentLineItem) {

		let rundown: Rundown
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
			asyncCollectionFindOne(Rundowns, segmentLineItem.rundownId),
			asyncCollectionFindOne(SegmentLines, segmentLineItem.segmentLineId)
		])
		rundown = r[1]
		segmentLine = r[2]
		// also update local object:
		segmentLineItem.stoppedPlayback = timestamp
		pushOntoPath(segmentLineItem, 'timings.stoppedPlayback', timestamp)

		if (rundown) {
			let event = pushAsRunLog({
				studioId:			rundown.studioInstallationId,
				rundownId:		rundown._id,
				segmentId:			segmentLine.segmentId,
				segmentLineId:		segmentLineItem.segmentLineId,
				segmentLineItemId:	segmentLineItem._id,
				content:			IBlueprintAsRunLogEventContent.STOPPEDPLAYBACK,
				content2: 			'segmentLineItem'
			}, !!rundown.rehearsal, timestamp)
			if (event) handleEvent(event)
		} else logger.error(`rundown "${segmentLine.rundownId}" not found in reportSegmentLineItemHasStopped "${segmentLine._id}"`)

	} else logger.error(`segmentLineItem not found in reportSegmentLineItemHasStopped "${segmentLineItemOrId}"`)
}
