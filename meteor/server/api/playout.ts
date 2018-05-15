import { Meteor } from 'meteor/meteor'
import { RunningOrder, RunningOrders } from '../../lib/collections/RunningOrders'
import { ShowStyle, ShowStyles } from '../../lib/collections/ShowStyles'
import { SegmentLine, SegmentLines } from '../../lib/collections/SegmentLines'
import { SegmentLineItem, SegmentLineItems } from '../../lib/collections/SegmentLineItems'
import { StudioInstallation, StudioInstallations } from '../../lib/collections/StudioInstallations'
import { getCurrentTime, saveIntoDb, literal, DBObj, partialExceptId, Time } from '../../lib/lib'
import { RundownAPI } from '../../lib/api/rundown'
import { TimelineTransition, Timeline, TimelineObj } from '../../lib/collections/Timeline'
import { Transition, Ease, Direction } from '../../lib/constants/casparcg'
import { Segment, Segments } from '../../lib/collections/Segments'
import { Random } from 'meteor/random'
import * as _ from 'underscore'

Meteor.methods({
	/**
	 * Activates the RunningOrder:
	 * TODO: Set up the Timeline
	 * Set first item on Next queue
	 */
	'playout_activate': (roId: string) => {
		let runningOrder = RunningOrders.findOne(roId)
		if (!runningOrder) throw new Meteor.Error(404, 'RunningOrder "' + roId + '" not found!')

		let anyOtherActiveRunningOrders = RunningOrders.find({
			studioInstallationId: runningOrder.studioInstallationId,
			active: true
		}).fetch()

		if (anyOtherActiveRunningOrders.length) {
			throw new Meteor.Error(400, 'Only one running-order can be active at the same time. Active runningOrders: ' + _.pluck(anyOtherActiveRunningOrders,'_id'))
		}
		let segmentLines = runningOrder.getSegmentLines()

		RunningOrders.update(runningOrder._id, {$set: {
			active: true,
			currentSegmentLineId: null,
			nextSegmentLineId: segmentLines[0]._id // put the first on queue
		}})
	},
	/**
	 * Inactivates the RunningOrder
	 * TODO: Clear the Timeline (?)
	 */
	'playout_inactivate': (roId: string) => {
		let runningOrder = RunningOrders.findOne(roId)
		if (!runningOrder) throw new Meteor.Error(404, 'RunningOrder "' + roId + '" not found!')

		RunningOrders.update(runningOrder._id, {$set: {
			active: false,
			currentSegmentLineId: null,
			nextSegmentLineId: null
		}})
	},
	/**
	 * Perform the TAKE action, i.e start playing a segmentLineItem
	 */
	'playout_take': (roId: string) => {
		let runningOrder = RunningOrders.findOne(roId)
		if (!runningOrder) throw new Meteor.Error(404, 'RunningOrder "' + roId + '" not found!')
		if (!runningOrder.nextSegmentLineId) throw new Meteor.Error(500, 'nextSegmentLineId is not set!')

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
			currentSegmentLineId: takeSegmentLine._id,
			nextSegmentLineId: nextSegmentLine._id
		}})

		updateTimeline(runningOrder.studioInstallationId)
	},

	'playout_setNext': (roId: string, nextSlId: string) => {

		let runningOrder = RunningOrders.findOne(roId)
		if (!runningOrder) throw new Meteor.Error(404, 'RunningOrder "' + roId + '" not found!')

		RunningOrders.update(runningOrder._id, {$set: {
			nextSegmentLineId: nextSlId
		}})

		// remove old auto-next from timeline, and add new one
		updateTimeline(runningOrder.studioInstallationId)
	}
})

function transformSegmentLineIntoTimeline (segmentLine: SegmentLine): Array<TimelineObj> {
	let timelineObjs: Array<TimelineObj> = []
	let items = segmentLine.getSegmentLinesItems()

	_.each(items, (item: SegmentLineItem) => {
		if (
			item.content &&
			item.content.timelineObjects
		) {
			let tos = item.content.timelineObjects

			_.each(tos, (o: TimelineObj) => {
				timelineObjs.push(o)
			})
		}
	})
	return timelineObjs
}

function updateTimeline (studioInstallationId: string) {
	const activeRunningOrder = RunningOrders.findOne({
		studioInstallationId: studioInstallationId,
		active: true
	})

	if (activeRunningOrder) {
		// remove anything not related to active running order:
		Timeline.remove({
			siId: studioInstallationId,
			roId: activeRunningOrder._id
		})
		// Todo: Add default objects:
		let timelineObjs: Array<TimelineObj> = []

		// Generate timeline: -------------------------------------------------

		// Default timelineobjects

		// Currently playing

		let currentSegmentLine: SegmentLine | undefined
		let nextSegmentLine: SegmentLine | undefined
		if (activeRunningOrder.currentSegmentLineId) {
			currentSegmentLine = SegmentLines.findOne(activeRunningOrder.currentSegmentLineId)
			if (!currentSegmentLine) throw new Meteor.Error(404, 'SegmentLine "' + activeRunningOrder.currentSegmentLineId + '" not found!')

			// fetch items
			// fetch the timelineobjs in items
			timelineObjs = timelineObjs.concat(transformSegmentLineIntoTimeline(currentSegmentLine))

		}

		if (activeRunningOrder.nextSegmentLineId) {
			// We may be at the beginning of a show, and there can be no currentSegmentLine and we are waiting for the user to Take
			nextSegmentLine = SegmentLines.findOne(activeRunningOrder.nextSegmentLineId)
			if (!nextSegmentLine) throw new Meteor.Error(404, 'SegmentLine "' + activeRunningOrder.nextSegmentLineId + '" not found!')

			timelineObjs = timelineObjs.concat(transformSegmentLineIntoTimeline(nextSegmentLine))
		}
	
		if (!activeRunningOrder.nextSegmentLineId && !activeRunningOrder.currentSegmentLineId) {
			// maybe at the end of the show
		}


		// next (on pvw (or on pgm if first))

		// Pre-process the timelineObjects
		_.each(timelineObjs, (o) => {
			o.roId = activeRunningOrder._id
			o.siId = activeRunningOrder.studioInstallationId
		})

		console.log('timelineObjs', timelineObjs)

		saveIntoDb<TimelineObj, TimelineObj>(Timeline, {
			roId: activeRunningOrder._id
		}, timelineObjs)
	} else {
		// remove everything:
		Timeline.remove({
			siId: studioInstallationId
		})
	}



}
