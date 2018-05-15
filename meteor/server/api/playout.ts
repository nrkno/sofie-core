import { Meteor } from 'meteor/meteor'
import { RunningOrder, RunningOrders } from '../../lib/collections/RunningOrders'
import { ShowStyle, ShowStyles } from '../../lib/collections/ShowStyles'
import { SegmentLine, SegmentLines } from '../../lib/collections/SegmentLines'
import { SegmentLineItem, SegmentLineItems } from '../../lib/collections/SegmentLineItems'
import { StudioInstallation, StudioInstallations } from '../../lib/collections/StudioInstallations'
import { getCurrentTime, saveIntoDb, literal, DBObj, partialExceptId } from '../../lib/lib'
import { RundownAPI } from '../../lib/api/rundown'
import { TimelineTransition } from '../../lib/collections/Timeline'
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

		let nextLine: SegmentLine = SegmentLines.findOne(runningOrder.nextSegmentLineId)
		let segment: Segment = Segments.findOne(nextLine.segmentId)

		let allSegmentLines = runningOrder.getSegmentLines({
			_rank: {$gt: nextLine._rank}
		})

		// RunningOrders.update(runningOrder._id, {$set: {
		// 	currentSegmentLineId: null,
		// 	nextSegmentLineId: null
		// }})

	}
})

