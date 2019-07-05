import { Meteor } from 'meteor/meteor'
import { Rundowns, Rundown } from '../../lib/collections/Rundowns'
import { Pieces } from '../../lib/collections/Pieces'
import { Random } from 'meteor/random'
import * as _ from 'underscore'
import { logger } from '../logging'
import { MediaObjects } from '../../lib/collections/MediaObjects'
import { setMeteorMethods } from '../methods'
import { getCurrentTime } from '../../lib/lib'
import { check } from 'meteor/check'
import { Parts } from '../../lib/collections/Parts'
import { updateSourceLayerInfinitesAfterPart } from '../api/playout/infinites'
import { updateExpectedMediaItemsOnRundown } from '../api/expectedMediaItems'

// These are temporary method to fill the rundown database with some sample data
// for development

setMeteorMethods({

	'debug_scrambleDurations' () {
		let pieces = Pieces.find().fetch()
		_.each(pieces, (piece) => {
			Pieces.update(
				{ _id: piece._id },
				{$inc: {
					expectedDuration: ((Random.fraction() * 500) - 250)
				}}
			)
		})
	},

	'debug_purgeMediaDB' () {
		MediaObjects.remove({})
	},

	'debug_rundownSetStarttimeSoon' () {
		let rundown = Rundowns.findOne({
			active: true
		})
		if (rundown) {
			Rundowns.update(rundown._id, {$set: {
				expectedStart: getCurrentTime() + 70 * 1000
			}})
		}
	},

	'debug_removeRundown' (id: string) {
		logger.debug('Remove rundown "' + id + '"')

		const rundown = Rundowns.findOne(id)
		if (rundown) rundown.remove()
	},

	'debug_removeAllRos' () {
		logger.debug('Remove all rundowns')

		Rundowns.find({}).forEach((rundown) => {
			rundown.remove()
		})
	},

	'debug_updateSourceLayerInfinitesAfterPart' (rundownId: string, previousPartId?: string, runToEnd?: boolean) {
		check(rundownId, String)
		if (previousPartId) check(previousPartId, String)
		if (runToEnd !== undefined) check(runToEnd, Boolean)

		const rundown = Rundowns.findOne(rundownId)
		if (!rundown) throw new Meteor.Error(404, 'Rundown not found')

		const prevPart = previousPartId ? Parts.findOne(previousPartId) : undefined

		updateSourceLayerInfinitesAfterPart(rundown, prevPart, runToEnd)

		logger.info('debug_updateSourceLayerInfinitesAfterPart: done')
	},

	'debug_recreateExpectedMediaItems' () {
		const rundowns = Rundowns.find().fetch()

		rundowns.map((i) => updateExpectedMediaItemsOnRundown(i._id))
	}
})
