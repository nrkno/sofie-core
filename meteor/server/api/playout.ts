import { Meteor } from 'meteor/meteor'
import { RunningOrders } from '../../lib/collections/RunningOrders'
import { SegmentLine, SegmentLines } from '../../lib/collections/SegmentLines'
import { SegmentLineItem, SegmentLineItems, ITimelineTrigger } from '../../lib/collections/SegmentLineItems'
import { SegmentLineAdLibItems, SegmentLineAdLibItem } from '../../lib/collections/SegmentLineAdLibItems'
import { RunningOrderBaselineItems, RunningOrderBaselineItem } from '../../lib/collections/RunningOrderBaselineItems'
import { getCurrentTime, saveIntoDb, literal, Time } from '../../lib/lib'
import { Timeline, TimelineObj, TimelineObjGroupSegmentLine, TimelineContentTypeOther, TimelineObjAbstract, TimelineObjGroup } from '../../lib/collections/Timeline'
import { TriggerType } from 'superfly-timeline'
import { Segments } from '../../lib/collections/Segments'
import { Random } from 'meteor/random'
import * as _ from 'underscore'
import { logger } from './../logging'
import { PeripheralDevice, PeripheralDevices, PlayoutDeviceSettings } from '../../lib/collections/PeripheralDevices'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import { IMOSRunningOrder, IMOSObjectStatus, MosString128 } from 'mos-connection'
import { PlayoutTimelinePrefixes } from '../../lib/api/playout'
import { TemplateContext, TemplateResultAfterPost, runNamedTemplate } from './templates/templates'
import { RunningOrderBaselineAdLibItem, RunningOrderBaselineAdLibItems } from '../../lib/collections/RunningOrderBaselineAdLibItems'
import { setStoryStatus } from './peripheralDevice'

Meteor.methods({
	/**
	 * Activates the RunningOrder:
	 * TODO: Set up the Timeline
	 * Set first item on Next queue
	 */
	'playout_reload_data': (roId: string) => {
		let runningOrder = RunningOrders.findOne(roId)
		if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)

		PeripheralDeviceAPI.executeFunction(runningOrder.mosDeviceId, (err: any, ro: IMOSRunningOrder) => {
			if (err) {
				logger.error(err)
			} else {
				// TODO: what to do with the result?
				console.log('Recieved reply for triggerGetRunningOrder', ro)
			}
		}, 'triggerGetRunningOrder', runningOrder.mosId)
	},
	'playout_activate': (roId: string) => {
		let runningOrder = RunningOrders.findOne(roId)
		if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)

		let anyOtherActiveRunningOrders = RunningOrders.find({
			studioInstallationId: runningOrder.studioInstallationId,
			active: true
		}).fetch()

		if (anyOtherActiveRunningOrders.length) {
			throw new Meteor.Error(400, 'Only one running-order can be active at the same time. Active runningOrders: ' + _.pluck(anyOtherActiveRunningOrders,'_id'))
		}
		let segmentLines = runningOrder.getSegmentLines()

		SegmentLines.update({ runningOrderId: runningOrder._id }, { $unset: {
			startedPlayback: 0,
			duration: 0
		}}, {
			multi: true
		})

		// Remove all segment line items that have been created using an adLib item
		SegmentLineItems.remove({
			runningOrderId: runningOrder._id,
			adLibSourceId: {
				$exists: true
			}
		})

		// Remove duration on segmentLineItems, as this is set by the ad-lib playback editing
		SegmentLineItems.update({ runningOrderId: runningOrder._id }, { $unset: {
			duration: 0
		}}, {
			multi: true
		})

		RunningOrders.update(runningOrder._id, {$set: {
			active: true,
			previousSegmentLineId: null,
			currentSegmentLineId: null,
			nextSegmentLineId: segmentLines[0]._id // put the first on queue
		}, $unset: {
			startedPlayback: 0
		}})

		logger.info('Building baseline items...')

		const showStyle = runningOrder.getShowStyle()
		if (showStyle.baselineTemplate) {
			const result: TemplateResultAfterPost = runNamedTemplate(showStyle.baselineTemplate, literal<TemplateContext>({
				runningOrderId: runningOrder._id,
				segmentLine: runningOrder.getSegmentLines()[0]
			}), {
				// Rummy object, not used in this template:
				RunningOrderId: new MosString128(''),
				Body: [],
				ID: new MosString128(''),

			})

			if (result.baselineItems) {
				logger.info(`... got ${result.baselineItems.length} items from template.`)
				saveIntoDb<RunningOrderBaselineItem, RunningOrderBaselineItem>(RunningOrderBaselineItems, {
					runningOrderId: runningOrder._id
				}, result.baselineItems)
			}

			if (result.segmentLineAdLibItems) {
				logger.info(`... got ${result.segmentLineAdLibItems.length} adLib items from template.`)
				saveIntoDb<RunningOrderBaselineAdLibItem, RunningOrderBaselineAdLibItem>(RunningOrderBaselineAdLibItems, {
					runningOrderId: runningOrder._id
				}, result.segmentLineAdLibItems)
			}
		}

		updateTimeline(runningOrder.studioInstallationId)
	},
	/**
	 * Inactivates the RunningOrder
	 * TODO: Clear the Timeline (?)
	 */
	'playout_inactivate': (roId: string) => {
		let runningOrder = RunningOrders.findOne(roId)
		if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)

		let previousSegmentLine = (runningOrder.currentSegmentLineId ?
			SegmentLines.findOne(runningOrder.currentSegmentLineId)
			: null
		)
		RunningOrders.update(runningOrder._id, {$set: {
			active: false,
			previousSegmentLineId: null,
			currentSegmentLineId: null,
			nextSegmentLineId: null
		}})

		// clean up all runtime baseline items
		RunningOrderBaselineItems.remove({
			runningOrderId: runningOrder._id
		})

		RunningOrderBaselineAdLibItems.remove({
			runningOrderId: runningOrder._id
		})

		updateTimeline(runningOrder.studioInstallationId)

		if (previousSegmentLine) {
			setStoryStatus(runningOrder.mosDeviceId, runningOrder.mosId, previousSegmentLine.mosId, IMOSObjectStatus.STOP)
		}
	},

	'debug__printTime': () => {
		let now = getCurrentTime()
		console.log(new Date(now))
		return now
	},

	/**
	 * Perform the TAKE action, i.e start playing a segmentLineItem
	 */
	'playout_take': (roId: string) => {
		let runningOrder = RunningOrders.findOne(roId)
		if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)
		if (!runningOrder.nextSegmentLineId) throw new Meteor.Error(500, 'nextSegmentLineId is not set!')

		let previousSegmentLine = (runningOrder.currentSegmentLineId ?
			SegmentLines.findOne(runningOrder.currentSegmentLineId)
			: null
		)
		let takeSegmentLine = SegmentLines.findOne(runningOrder.nextSegmentLineId)
		if (!takeSegmentLine) throw new Meteor.Error(404, 'takeSegmentLine not found!')
		let takeSegment = Segments.findOne(takeSegmentLine.segmentId)

		let segmentLinesAfter = runningOrder.getSegmentLines({
			_rank: {
				$gt: takeSegmentLine._rank,
			},
			_id: {$ne: takeSegmentLine._id}
		})

		let nextSegmentLine: SegmentLine | null = segmentLinesAfter[0] || null

		RunningOrders.update(runningOrder._id, {$set: {
			previousSegmentLineId: runningOrder.currentSegmentLineId,
			currentSegmentLineId: takeSegmentLine._id,
			nextSegmentLineId: nextSegmentLine ? nextSegmentLine._id : null
		}})

		if (nextSegmentLine) {
			clearNextLineStartedPlaybackAndDuration(roId, nextSegmentLine._id)
		}

		updateTimeline(runningOrder.studioInstallationId)

		if (previousSegmentLine) {
			setStoryStatus(runningOrder.mosDeviceId, runningOrder.mosId, previousSegmentLine.mosId, IMOSObjectStatus.STOP)
		}
		setStoryStatus(runningOrder.mosDeviceId, runningOrder.mosId, takeSegmentLine.mosId, IMOSObjectStatus.PLAY)
	},

	'playout_setNext': (roId: string, nextSlId: string) => {

		let runningOrder = RunningOrders.findOne(roId)
		if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)

		RunningOrders.update(runningOrder._id, {$set: {
			nextSegmentLineId: nextSlId
		}})

		clearNextLineStartedPlaybackAndDuration(roId, nextSlId)

		// remove old auto-next from timeline, and add new one
		updateTimeline(runningOrder.studioInstallationId)
	},

	'playout_segmentLinePlaybackStart': (roId: string, slId: string, startedPlayback: Time) => {
		let runningOrder = RunningOrders.findOne(roId)
		if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)
		let segLine = SegmentLines.findOne({
			_id: slId,
			runningOrderId: roId
		})

		if (segLine) {
			// make sure we don't run multiple times, even if TSR calls us multiple times
			if (!segLine.startedPlayback) {
				logger.info(`Playout reports segment line "${slId}" has started playback on timestamp ${(new Date(startedPlayback)).toISOString()}`)

				if (runningOrder.currentSegmentLineId === slId) {
					// this is the current segment line, it has just started playback
					if (runningOrder.previousSegmentLineId) {
						let prevSegLine = SegmentLines.findOne(runningOrder.previousSegmentLineId)

						if (!prevSegLine) {
							// We couldn't find the previous segment line: this is not a critical issue, but is clearly is a symptom of a larger issue
							logger.error(`Previous segment line "${runningOrder.previousSegmentLineId}" on running order "${roId}" could not be found.`)
						} else {
							setPreviousLinePlaybackDuration(roId, prevSegLine, startedPlayback)
						}
					}

					setRunningOrderStartedPlayback(runningOrder, startedPlayback) // Set startedPlayback on the running order if this is the first item to be played

					RunningOrders.update(runningOrder._id, {
						$set: {
							previousSegmentLineId: null
						}
					})
				} else if (runningOrder.nextSegmentLineId === slId) {
					// this is the next segment line, clearly an autoNext has taken place
					if (runningOrder.currentSegmentLineId) {
						let prevSegLine = SegmentLines.findOne(runningOrder.currentSegmentLineId)

						if (!prevSegLine) {
							// We couldn't find the previous segment line: this is not a critical issue, but is clearly is a symptom of a larger issue
							logger.error(`Previous segment line "${runningOrder.currentSegmentLineId}" on running order "${roId}" could not be found.`)
						} else {
							setPreviousLinePlaybackDuration(roId, prevSegLine, startedPlayback)
						}
					}

					setRunningOrderStartedPlayback(runningOrder, startedPlayback) // Set startedPlayback on the running order if this is the first item to be played

					let segmentLinesAfter = runningOrder.getSegmentLines({
						_rank: {
							$gt: segLine._rank,
						},
						_id: { $ne: segLine._id }
					})

					let nextSegmentLine: SegmentLine | null = segmentLinesAfter[0] || null

					RunningOrders.update(runningOrder._id, {
						$set: {
							previousSegmentLineId: null,
							currentSegmentLineId: segLine._id,
							nextSegmentLineId: nextSegmentLine._id
						}
					})

					clearNextLineStartedPlaybackAndDuration(roId, nextSegmentLine._id)
				} else {
					// a segment line is being played that has not been selected for playback by Core
					// show must go on, so find next segmentLine and update the RunningOrder, but log an error
					let segmentLinesAfter = runningOrder.getSegmentLines({
						_rank: {
							$gt: segLine._rank,
						},
						_id: { $ne: segLine._id }
					})

					let nextSegmentLine: SegmentLine | null = segmentLinesAfter[0] || null

					setRunningOrderStartedPlayback(runningOrder, startedPlayback) // Set startedPlayback on the running order if this is the first item to be played

					RunningOrders.update(runningOrder._id, {
						$set: {
							previousSegmentLineId: null,
							currentSegmentLineId: segLine._id,
							nextSegmentLineId: nextSegmentLine._id
						}
					})

					clearNextLineStartedPlaybackAndDuration(roId, nextSegmentLine._id)

					logger.error(`Segment Line "${segLine._id}" has started playback by the TSR, but has not been selected for playback!`)
				}

				SegmentLines.update(segLine._id, {$set: {
					startedPlayback
				}})
				updateTimeline(runningOrder.studioInstallationId, startedPlayback)
			}
		} else {
			throw new Meteor.Error(404, `Segment line "${slId}" in running order "${roId}" not found!`)
		}
	},
	'playout_segmentAdLibLineItemStart': (roId: string, slId: string, slaiId: string) => {
		let runningOrder = RunningOrders.findOne(roId)
		if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)
		let segLine = SegmentLines.findOne({
			_id: slId,
			runningOrderId: roId
		})
		if (!segLine) throw new Meteor.Error(404, `Segment Line "${slId}" not found!`)
		let adLibItem = SegmentLineAdLibItems.findOne({
			_id: slaiId,
			runningOrderId: roId
		})
		if (!adLibItem) throw new Meteor.Error(404, `Segment Line Ad Lib Item "${slaiId}" not found!`)
		if (!runningOrder.active) throw new Meteor.Error(403, `Segment Line Ad Lib Items can be only placed in an active running order!`)
		if (runningOrder.currentSegmentLineId !== segLine._id) throw new Meteor.Error(403, `Segment Line Ad Lib Items can be only placed in a current segment line!`)

		let newSegmentLineItem = convertAdLibToSLineItem(adLibItem, segLine)
		SegmentLineItems.insert(newSegmentLineItem)

		// console.log('adLibItemStart', newSegmentLineItem)

		updateTimeline(runningOrder.studioInstallationId)
	},
	'playout_runningOrderBaselineAdLibItemStart': (roId: string, slId: string, robaliId: string) => {
		let runningOrder = RunningOrders.findOne(roId)
		if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)
		let segLine = SegmentLines.findOne({
			_id: slId,
			runningOrderId: roId
		})
		if (!segLine) throw new Meteor.Error(404, `Segment Line "${slId}" not found!`)
		let adLibItem = RunningOrderBaselineAdLibItems.findOne({
			_id: robaliId,
			runningOrderId: roId
		})
		if (!adLibItem) throw new Meteor.Error(404, `Running Order Baseline Ad Lib Item "${robaliId}" not found!`)
		if (!runningOrder.active) throw new Meteor.Error(403, `Running Order Baseline Ad Lib Items can be only placed in an active running order!`)
		if (runningOrder.currentSegmentLineId !== segLine._id) throw new Meteor.Error(403, `Running Order Baseline Ad Lib Items can be only placed in a current segment line!`)

		let newSegmentLineItem = convertAdLibToSLineItem(adLibItem, segLine)
		SegmentLineItems.insert(newSegmentLineItem)

		// console.log('adLibItemStart', newSegmentLineItem)

		updateTimeline(runningOrder.studioInstallationId)
	},
	'playout_segmentAdLibLineItemStop': (roId: string, slId: string, sliId: string) => {
		let runningOrder = RunningOrders.findOne(roId)
		if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)
		let segLine = SegmentLines.findOne({
			_id: slId,
			runningOrderId: roId
		})
		if (!segLine) throw new Meteor.Error(404, `Segment Line "${slId}" not found!`)
		let alCopyItem = SegmentLineItems.findOne({
			_id: sliId,
			runningOrderId: roId
		})
		// To establish playback time, we need to look at the actual Timeline
		let alCopyItemTObj = Timeline.findOne({
			_id: PlayoutTimelinePrefixes.SEGMENT_LINE_ITEM_GROUP_PREFIX + sliId
		})
		let parentOffset = 0
		if (!alCopyItem) throw new Meteor.Error(404, `Segment Line Ad Lib Copy Item "${sliId}" not found!`)
		if (!alCopyItemTObj) throw new Meteor.Error(404, `Segment Line Ad Lib Copy Item "${sliId}" not found in the playout Timeline!`)
		if (!runningOrder.active) throw new Meteor.Error(403, `Segment Line Ad Lib Copy Items can be only manipulated in an active running order!`)
		if (runningOrder.currentSegmentLineId !== segLine._id) throw new Meteor.Error(403, `Segment Line Ad Lib Copy Items can be only manipulated in a current segment line!`)
		if (!alCopyItem.adLibSourceId) throw new Meteor.Error(501, `"${sliId}" does not appear to be a Segment Line Ad Lib Copy Item!`)

		// The ad-lib item positioning will be relative to the startedPlayback of the segment line
		if (segLine.startedPlayback) {
			parentOffset = segLine.startedPlayback
		}

		let newExpectedDuration = 1 // smallest, non-zero duration
		if (alCopyItemTObj.trigger.type === TriggerType.TIME_ABSOLUTE && _.isNumber(alCopyItemTObj.trigger.value)) {
			const actualStartTime = parentOffset + alCopyItemTObj.trigger.value
			newExpectedDuration = getCurrentTime() - actualStartTime
		} else {
			logger.warn(`"${sliId}" timeline object is not positioned absolutely or is still set to play now, assuming it's about to be played.`)
		}

		SegmentLineItems.update({
			_id: sliId
		}, {$set: {
			duration: newExpectedDuration
		}})

		updateTimeline(runningOrder.studioInstallationId)
	},
	'playout_sourceLayerOnLineStop': (roId: string, slId: string, sourceLayerId: string) => {
		let runningOrder = RunningOrders.findOne(roId)
		if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)
		let segLine = SegmentLines.findOne({
			_id: slId,
			runningOrderId: roId
		})
		if (!segLine) throw new Meteor.Error(404, `Segment Line "${slId}" not found!`)
		let slItems = SegmentLineItems.find({
			runningOrderId: roId,
			segmentLineId: slId,
			sourceLayerId: sourceLayerId
		}).fetch()
		if (!runningOrder.active) throw new Meteor.Error(403, `Segment Line Items can be only manipulated in an active running order!`)
		if (runningOrder.currentSegmentLineId !== segLine._id) throw new Meteor.Error(403, `Segment Line Items can be only manipulated in a current segment line!`)

		let parentOffset = 0
		if (segLine.startedPlayback) {
			parentOffset = segLine.startedPlayback
		}

		const now = getCurrentTime()
		slItems.forEach((item) => {
			let newExpectedDuration = 1 // smallest, non-zero duration
			if (item.trigger.type === TriggerType.TIME_ABSOLUTE && _.isNumber(item.trigger.value)) {
				const actualStartTime = parentOffset + item.trigger.value
				newExpectedDuration = now - actualStartTime
			} else {
				logger.warn(`"${item._id}" timeline object is not positioned absolutely or is still set to play now, assuming it's about to be played.`)
			}

			// Only update if the new duration is shorter than the old one, since we are supposed to cut stuff short
			if ((newExpectedDuration < item.expectedDuration) || (item.expectedDuration === 0)) {
				SegmentLineItems.update({
					_id: item._id
				}, {$set: {
					duration: newExpectedDuration
				}})
			}
		})

		updateTimeline(runningOrder.studioInstallationId)
	},
	'playout_timelineTriggerTimeUpdate': (timelineObjId: string, time: number) => {
		let tObj = Timeline.findOne(timelineObjId)
		if (!tObj) throw new Meteor.Error(404, `Timeline obj "${timelineObjId}" not found!`)

		if (tObj.metadata && tObj.metadata.segmentLineItemId) {
			console.log('Update segment line item: ', tObj.metadata.segmentLineItemId, (new Date(time)).toTimeString())
			SegmentLineItems.update({
				_id: tObj.metadata.segmentLineItemId
			}, {$set: {
				trigger: {
					type: TriggerType.TIME_ABSOLUTE,
					value: time
				}
			}})
		}
	}
})

function convertAdLibToSLineItem (adLibItem: SegmentLineAdLibItem, segmentLine: SegmentLine): SegmentLineItem {
	const oldId = adLibItem._id
	const newId = Random.id()
	const newSLineItem = literal<SegmentLineItem>(_.extend(
		adLibItem,
		{
			_id: newId,
			trigger: {
				type: TriggerType.TIME_ABSOLUTE,
				value: 'now'
			},
			segmentLineId: segmentLine._id,
			adLibSourceId: adLibItem._id,
			expectedDuration: adLibItem.expectedDuration || 0 // set duration to infinite if not set by AdLibItem
		}
	))
	if (newSLineItem.content && newSLineItem.content.timelineObjects) {
		let contentObjects = newSLineItem.content.timelineObjects
		newSLineItem.content.timelineObjects = _.compact(contentObjects).map(
			(item) => {
				const itemCpy = _.extend(item, {
					_id: newId + '_' + item!._id,
					id: newId + '_' + item!._id
				})
				return itemCpy as TimelineObj
			}
		)
	}
	return newSLineItem
}

function setRunningOrderStartedPlayback (runningOrder, startedPlayback) {
	if (!runningOrder.startedPlayback) { // Set startedPlayback on the running order if this is the first item to be played
		RunningOrders.update(runningOrder._id, {
			$set: {
				startedPlayback
			}
		})
	}
}

function setPreviousLinePlaybackDuration (roId: string, prevSegLine: SegmentLine, lastChange: Time) {
	if (prevSegLine.startedPlayback && prevSegLine.startedPlayback > 0) {
		SegmentLines.update(prevSegLine._id, {
			$set: {
				duration: lastChange - prevSegLine.startedPlayback
			}
		})
	} else {
		logger.error(`Previous segment line "${prevSegLine._id}" has never started playback on running order "${roId}".`)
	}
}

function clearNextLineStartedPlaybackAndDuration (roId: string, nextSlId: string) {
	SegmentLines.update(nextSlId, {
		$unset: {
			duration: 0,
			startedPlayback: 0
		}
	})
}

function createSegmentLineGroup (segmentLine: SegmentLine, duration: Time): TimelineObj {
	let slGrp = literal<TimelineObjGroupSegmentLine>({
		_id: PlayoutTimelinePrefixes.SEGMENT_LINE_GROUP_PREFIX + segmentLine._id,
		siId: '', // added later
		roId: '', // added later
		deviceId: [],
		trigger: {
			type: TriggerType.TIME_ABSOLUTE,
			value: 'now'
		},
		duration: duration,
		LLayer: 'core_abstract',
		content: {
			type: TimelineContentTypeOther.GROUP,
			objects: []
		},
		isGroup: true,
		isSegmentLineGroup: true,
		// slId: segmentLine._id
	})

	return slGrp
}
function createSegmentLineGroupFirstObject (segmentLine: SegmentLine, segmentLineGroup: TimelineObj): TimelineObj {
	return literal<TimelineObjAbstract>({
		_id: PlayoutTimelinePrefixes.SEGMENT_LINE_GROUP_FIRST_ITEM_PREFIX + segmentLine._id,
		siId: '', // added later
		roId: '', // added later
		deviceId: [],
		trigger: {
			type: TriggerType.TIME_ABSOLUTE,
			value: 0
		},
		duration: 0,
		LLayer: 'core_abstract',
		content: {
			type: TimelineContentTypeOther.NOTHING,
		},
		// isGroup: true,
		inGroup: segmentLineGroup._id,
		slId: segmentLine._id
	})
}

function createSegmentLineItemGroup (item: SegmentLineItem | RunningOrderBaselineItem, duration: number, segmentLineGroup?: TimelineObj): TimelineObj {
	return literal<TimelineObjGroup>({
		_id: PlayoutTimelinePrefixes.SEGMENT_LINE_ITEM_GROUP_PREFIX + item._id,
		content: {
			type: TimelineContentTypeOther.GROUP,
			objects: []
		},
		inGroup: segmentLineGroup && segmentLineGroup._id,
		isGroup: true,
		siId: '',
		roId: '',
		deviceId: [],
		trigger: item.trigger,
		duration: duration,
		LLayer: item.sourceLayerId,
		metadata: {
			segmentLineItemId: item._id
		}
	})
}

function transformBaselineItemsIntoTimeline (items: RunningOrderBaselineItem[]): Array<TimelineObj> {
	let timelineObjs: Array<TimelineObj> = []
	_.each(items, (item: RunningOrderBaselineItem) => {
		if (
			item.content &&
			item.content.timelineObjects
		) {
			let tos = item.content.timelineObjects

			// the baseline items are layed out without any grouping
			_.each(tos, (o: TimelineObj) => {
				// do some transforms maybe?
				timelineObjs.push(o)
			})
		}
	})
	return timelineObjs
}

function transformSegmentLineIntoTimeline (segmentLine: SegmentLine, segmentLineGroup?: TimelineObj, allowTransition?: boolean): Array<TimelineObj> {
	let timelineObjs: Array<TimelineObj> = []
	let items = segmentLine.getSegmentLinesItems()

	_.each(items, (item: SegmentLineItem) => {
		if (!allowTransition && item.isTransition) {
			return
		}

		if (
			item.content &&
			item.content.timelineObjects
		) {
			let tos = item.content.timelineObjects

			// create a segmentLineItem group for the items and then place all of them there
			let lineItemDuration = item.duration || item.expectedDuration || 0
			const segmentLineItemGroup = createSegmentLineItemGroup(item, lineItemDuration, segmentLineGroup)
			timelineObjs.push(segmentLineItemGroup)

			_.each(tos, (o: TimelineObj) => {
				if (segmentLineGroup) {
					o.inGroup = segmentLineItemGroup._id
					if (o.duration > lineItemDuration && lineItemDuration !== 0) {
						lineItemDuration = o.duration
					}
				}

				timelineObjs.push(o)
			})

			segmentLineItemGroup.duration = lineItemDuration
		}
	})
	return timelineObjs
}

/**
 * Updates the Timeline to reflect the state in the RunningOrder, Segments, Segmentlines etc...
 * @param studioInstallationId id of the studioInstallation to update
 * @param forceNowToTime if set, instantly forces all "now"-objects to that time (used in autoNext)
 */
function updateTimeline (studioInstallationId: string, forceNowToTime?: Time) {
	const activeRunningOrder = RunningOrders.findOne({
		studioInstallationId: studioInstallationId,
		active: true
	})

	if (activeRunningOrder) {
		let studioInstallation = activeRunningOrder.getStudioInstallation()

		// remove anything not related to active running order:
		Timeline.remove({
			siId: studioInstallationId,
			roId: {
				$not: {
					$eq: activeRunningOrder._id
				}
			}
		})
		// Todo: Add default objects:
		let timelineObjs: Array<TimelineObj> = []

		// Generate timeline: -------------------------------------------------

		// Default timelineobjects

		console.log('Timeline update!')

		const baselineItems = RunningOrderBaselineItems.find({
			runningOrderId: activeRunningOrder._id
		}).fetch()

		if (baselineItems) {
			timelineObjs = timelineObjs.concat(transformBaselineItemsIntoTimeline(baselineItems))
		}

		// Currently playing

		let currentSegmentLine: SegmentLine | undefined
		let nextSegmentLine: SegmentLine | undefined
		let currentSegmentLineGroup: TimelineObj | undefined
		let previousSegmentLineGroup: TimelineObj | undefined

		// we get the nextSegmentLine first, because that affects how the currentSegmentLine will be treated
		if (activeRunningOrder.nextSegmentLineId) {
			// We may be at the beginning of a show, and there can be no currentSegmentLine and we are waiting for the user to Take
			nextSegmentLine = SegmentLines.findOne(activeRunningOrder.nextSegmentLineId)
			if (!nextSegmentLine) throw new Meteor.Error(404, `SegmentLine "${activeRunningOrder.nextSegmentLineId}" not found!`)
		}

		if (activeRunningOrder.currentSegmentLineId) {
			currentSegmentLine = SegmentLines.findOne(activeRunningOrder.currentSegmentLineId)
			if (!currentSegmentLine) throw new Meteor.Error(404, `SegmentLine "${activeRunningOrder.currentSegmentLineId}" not found!`)

			let allowTransition = false

			if (activeRunningOrder.previousSegmentLineId) {
				let previousSegmentLine = SegmentLines.findOne(activeRunningOrder.previousSegmentLineId)
				if (!previousSegmentLine) throw new Meteor.Error(404, `SegmentLine "${activeRunningOrder.previousSegmentLineId}" not found!`)

				allowTransition = !previousSegmentLine.disableOutTransition

				if (previousSegmentLine.startedPlayback && !previousSegmentLine.disableOutTransition) {
					const duration = getCurrentTime() - previousSegmentLine.startedPlayback
					if (duration > 0) {
						const transition = currentSegmentLine.getSegmentLinesItems().find((sl: SegmentLineItem) => sl.isTransition)
						previousSegmentLineGroup = createSegmentLineGroup(previousSegmentLine, duration + Math.max(transition ? transition.expectedDuration || 0 : 0, currentSegmentLine.overlapDuration || 0))
						previousSegmentLineGroup.priority = -1
						previousSegmentLineGroup.trigger = literal<ITimelineTrigger>({
							type: TriggerType.TIME_ABSOLUTE,
							value: previousSegmentLine.startedPlayback
						})

						timelineObjs = timelineObjs.concat(
							previousSegmentLineGroup,
							transformSegmentLineIntoTimeline(previousSegmentLine, previousSegmentLineGroup, false))
						timelineObjs.push(createSegmentLineGroupFirstObject(previousSegmentLine, previousSegmentLineGroup))
					}
				}
			}

			// fetch items
			// fetch the timelineobjs in items
			const isFollowed = nextSegmentLine && currentSegmentLine.autoNext
			currentSegmentLineGroup = createSegmentLineGroup(currentSegmentLine, (isFollowed ? (currentSegmentLine.expectedDuration || 0) : 0))
			timelineObjs = timelineObjs.concat(currentSegmentLineGroup, transformSegmentLineIntoTimeline(currentSegmentLine, currentSegmentLineGroup, allowTransition))

			timelineObjs.push(createSegmentLineGroupFirstObject(currentSegmentLine, currentSegmentLineGroup))
		}

		// only add the next objects into the timeline if the next segment is autoNext
		if (nextSegmentLine && currentSegmentLine && currentSegmentLine.autoNext) {
			let nextSegmentLineGroup = createSegmentLineGroup(nextSegmentLine, 0)
			if (currentSegmentLineGroup) {
				nextSegmentLineGroup.trigger = literal<ITimelineTrigger>({
					type: TriggerType.TIME_RELATIVE,
					value: `#${currentSegmentLineGroup._id}.end - ${nextSegmentLine.overlapDuration || 0}`
				})
			}
			timelineObjs = timelineObjs.concat(
				nextSegmentLineGroup,
				transformSegmentLineIntoTimeline(nextSegmentLine, nextSegmentLineGroup, currentSegmentLine && !currentSegmentLine.disableOutTransition))
			timelineObjs.push(createSegmentLineGroupFirstObject(nextSegmentLine, nextSegmentLineGroup))
		}

		if (!activeRunningOrder.nextSegmentLineId && !activeRunningOrder.currentSegmentLineId) {
			// maybe at the end of the show
			logger.info(`No next segmentLine and no current segment line set on running order "${activeRunningOrder._id}".`)
		}

		// next (on pvw (or on pgm if first))

		// Pre-process the timelineObjects:

		// create a mapping of which playout parent processes that has which playoutdevices:
		let deviceParentDevice: {[deviceId: string]: PeripheralDevice} = {}
		let peripheralDevicesInStudio = PeripheralDevices.find({
			studioInstallationId: studioInstallation._id,
			type: PeripheralDeviceAPI.DeviceType.PLAYOUT
		}).fetch()
		_.each(peripheralDevicesInStudio, (pd) => {
			if (pd.settings) {
				let settings = pd.settings as PlayoutDeviceSettings
				_.each(settings.devices, (device, deviceId) => {
					deviceParentDevice[deviceId] = pd
				})
			}
		})

		// first, split out any grouped objects, to make the timeline shallow:
		let fixObjectChildren = (o: TimelineObjGroup) => {
			if (o.isGroup && o.content && o.content.objects && o.content.objects.length) {
				// let o2 = o as TimelineObjGroup
				_.each(o.content.objects, (child) => {
					let childFixed: TimelineObj = _.extend(child, {
						inGroup: o._id,
						_id: child.id || child['_id']
					})
					delete childFixed['id']
					timelineObjs.push(childFixed)
					fixObjectChildren(childFixed as TimelineObjGroup)
				})
				delete o.content.objects
			}
		}
		_.each(timelineObjs, (o: TimelineObj) => {
			fixObjectChildren(o as TimelineObjGroup)
		})
		// Add deviceIds to all children objects
		let groupDeviceIds: {[groupId: string]: Array<string>} = {}
		_.each(timelineObjs, (o) => {

			o.roId = activeRunningOrder._id
			o.siId = studioInstallation._id
			if (!o.isGroup) {
				let LLayerMapping = (studioInstallation.mappings || {})[o.LLayer + '']
				if (LLayerMapping) {
					let parentDevice = deviceParentDevice[LLayerMapping.deviceId]
					if (!parentDevice) throw new Meteor.Error(404, 'No parent-device found for device "' + LLayerMapping.deviceId + '"')

					o.deviceId = [parentDevice._id]

					if (o.inGroup) {
						if (!groupDeviceIds[o.inGroup]) groupDeviceIds[o.inGroup] = []
						groupDeviceIds[o.inGroup].push(parentDevice._id)
					}

				} else logger.warn('TimelineObject "' + o._id + '" has an unknown LLayer: "' + o.LLayer + '"')
			}
		})
		let groupObjs = _.compact(_.map(timelineObjs, (o) => {
			if (o.isGroup) {
				return o
			}
			return null
		}))

		// add the children's deviceIds to their parent groups:
		let shouldNotRunAgain = true
		let shouldRunAgain = true
		for (let i = 0; i < 10; i++) {
			shouldNotRunAgain = true
			shouldRunAgain = false
			_.each(groupObjs, (o) => {
				if (o.inGroup) {
					if (!groupDeviceIds[o.inGroup]) groupDeviceIds[o.inGroup] = []
					groupDeviceIds[o.inGroup] = groupDeviceIds[o.inGroup].concat(o.deviceId)
					shouldNotRunAgain = false
				}
				if (o.isGroup) {
					let newDeviceId = _.uniq(groupDeviceIds[o._id] || [], false)

					if (!_.isEqual(o.deviceId, newDeviceId)) {
						shouldRunAgain = true
						o.deviceId = newDeviceId
					}
				}
			})
			if (!shouldRunAgain || shouldNotRunAgain) break
		}

		// console.log('timelineObjs', timelineObjs)

		if (forceNowToTime) {
			setNowToTimeInObjects(timelineObjs, forceNowToTime)
		}

		saveIntoDb<TimelineObj, TimelineObj>(Timeline, {
			roId: activeRunningOrder._id
		}, timelineObjs, {
			beforeUpdate: (o: TimelineObj, oldO: TimelineObj): TimelineObj => {
				// do not overwrite trigger when the trigger has been denowified
				if (o.trigger.value === 'now' && oldO.trigger.setFromNow) {
					o.trigger.type = oldO.trigger.type
					o.trigger.value = oldO.trigger.value
				}
				return o
			}
		})
	} else {
		// remove everything:
		Timeline.remove({
			siId: studioInstallationId
		})
	}
}

function setNowToTimeInObjects (timelineObjs: Array<TimelineObj>, now: Time): void {
	_.each(timelineObjs, (o) => {
		if (o.trigger.type === TriggerType.TIME_ABSOLUTE &&
			o.trigger.value === 'now'
		) {
			o.trigger.value = now
			o.trigger.setFromNow = true
		}
	})
}
