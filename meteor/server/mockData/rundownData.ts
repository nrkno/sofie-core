import { Meteor } from 'meteor/meteor'
import { RunningOrders } from '../../lib/collections/RunningOrders'
import { SegmentLineItems } from '../../lib/collections/SegmentLineItems'
import { Random } from 'meteor/random'
import * as _ from 'underscore'
import { logger } from '../logging'
import { MediaObjects } from '../../lib/collections/MediaObjects'
import { setMeteorMethods } from '../methods'
import { getCurrentTime } from '../../lib/lib'
import { check } from 'meteor/check'
import { SegmentLines, SegmentLine } from '../../lib/collections/SegmentLines'
import { RunningOrderDataCache, RunningOrderDataCacheObj } from '../../lib/collections/RunningOrderDataCache'
import { updateStory, getSegmentLine } from '../api/integration/mos'
import { PeripheralDevices, PeripheralDevice } from '../../lib/collections/PeripheralDevices'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import { updateSourceLayerInfinitesAfterLine } from '../api/playout'
import { MosString128 } from 'mos-connection';

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
	},

	'debug_roRunBlueprints' (roId: string) {
		check(roId, String)

		const ro = RunningOrders.findOne(roId)
		if (!ro) throw new Meteor.Error(404, 'Running order not found')

		const unsynced = ro.unsynced

		const segmentLines = SegmentLines.find({ runningOrderId: ro._id }).fetch()
		segmentLines.forEach((sl: SegmentLine) => {
			if (!sl.externalId || sl.externalId === '' || sl.externalId === '-') {
				logger.warn('debug_roRunBlueprints: skipping sl ' + sl._id + ' due to missing externalId')
				return
			}

			let story = RunningOrderDataCache.findOne({
				roId: ro._id,
				'data.ID' : sl.externalId
			})
			if (!story) {
				logger.warn('debug_roRunBlueprints: skipping sl ' + sl._id + ' due to missing data cache')
				return
			}

			try {
				updateStory(ro, sl, story.data)

			} catch (e) {
				//
				logger.warn('debug_roRunBlueprints: sl ' + sl._id + ' failed: ' + e)
			}
		})

		logger.info('debug_roRunBlueprints: infinites')
		updateSourceLayerInfinitesAfterLine(ro)

		if (unsynced) RunningOrders.update(ro._id, { $set: { unsynced }})

		logger.info('debug_roRunBlueprints: done')
	},

	'debug_roRunMosData' (roId: string) {
		check(roId, String)

		const ro = RunningOrders.findOne(roId)
		if (!ro) throw new Meteor.Error(404, 'Running order not found')

		const unsynced = ro.unsynced

		const mosData = RunningOrderDataCache.find({ roId: ro._id }).fetch()

		const roCreates = mosData.filter(d => d._id.indexOf('roCreate') !== -1)
		if (roCreates.length !== 1) {
			throw new Meteor.Error(500, 'bad number of roCreate entries')
		}

		// TODO - this should choose one in a better way
		let pd = PeripheralDevices.findOne({
			type: PeripheralDeviceAPI.DeviceType.MOSDEVICE
		}) as PeripheralDevice
		if (!pd) {
			throw new Meteor.Error(404, 'MOS Device not found to be used for mock running order!')
		}
		let id = pd._id
		let token = pd.token

		// Delete the existing copy, to ensure this is a clean import
		try {
			Meteor.call(PeripheralDeviceAPI.methods.mosRoDelete, id, token, new MosString128(roCreates[0].data.ID))
		} catch (e) {
			// Ignore. likely doesnt exist
		}

		// Create the RO
		Meteor.call(PeripheralDeviceAPI.methods.mosRoCreate, id, token, roCreates[0].data)

		const stories = mosData.filter(d => d._id.indexOf('fullStory') !== -1)
		stories.forEach((s: RunningOrderDataCacheObj) => {
			try {
				const sl = getSegmentLine(new MosString128(ro.externalId), new MosString128(s.data.ID))
				updateStory(ro, sl, s.data)

			} catch (e) {
				//
				logger.warn('debug_roRunMosData: chunk ' + s._id + ' failed: ' + e)
			}
		})

		logger.info('debug_roRunMosData: infinites')
		updateSourceLayerInfinitesAfterLine(ro)

		if (unsynced) RunningOrders.update(ro._id, { $set: { unsynced }})

		logger.info('debug_roRunMosData: done')
	},

	'debug_updateSourceLayerInfinitesAfterLine' (roId: string, previousSlId?: string, runToEnd?: boolean) {
		check(roId, String)
		if (previousSlId) check(previousSlId, String)
		if (runToEnd !== undefined) check(runToEnd, Boolean)

		const ro = RunningOrders.findOne(roId)
		if (!ro) throw new Meteor.Error(404, 'Running order not found')

		const prevSl = previousSlId ? SegmentLines.findOne(previousSlId) : undefined

		updateSourceLayerInfinitesAfterLine(ro, prevSl, runToEnd)

		logger.info('debug_updateSourceLayerInfinitesAfterLine: done')
	}
})
