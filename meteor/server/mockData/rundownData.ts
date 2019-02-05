import { Meteor } from 'meteor/meteor'
import { RunningOrders } from '../../lib/collections/RunningOrders'
import { SegmentLineItems } from '../../lib/collections/SegmentLineItems'
import { Random } from 'meteor/random'
import * as _ from 'underscore'
import { logger } from '../logging'
import { MediaObjects } from '../../lib/collections/MediaObjects'
import { setMeteorMethods } from '../methods'
import { getCurrentTime } from '../../lib/lib'

// These are temporary method to fill the rundown database with some sample data
// for development

setMeteorMethods({

	'debug_scrambleDurations' () {
		let segmentLineItems = SegmentLineItems.find().fetch()
		_.each(segmentLineItems, (segmentLineItem) => {
			SegmentLineItems.update(
				{ _id: segmentLineItem._id },
				{$inc: {
					expectedDuration: ((Random.fraction() * 500) - 250)
				}}
			)
		})
	},

	'debug_purgeMediaDB' () {
		MediaObjects.remove({})
	},

	'debug_roSetStarttimeSoon' () {
		let ro = RunningOrders.findOne({
			active: true
		})
		if (ro) {
			RunningOrders.update(ro._id, {$set: {
				expectedStart: getCurrentTime() + 70 * 1000
			}})
		}
	},

	'debug_removeRo' (id: string) {
		logger.debug('Remove ro "' + id + '"')

		const ro = RunningOrders.findOne(id)
		if (ro) ro.remove()
	},

	'debug_removeAllRos' () {
		logger.debug('Remove all runningOrders')

		RunningOrders.find({}).forEach((ro) => {
			ro.remove()
		})
	}
})
