import { Meteor } from 'meteor/meteor'
import { RunningOrder, RunningOrders } from '../../lib/collections/RunningOrders'
import { ShowStyleBases } from '../../lib/collections/ShowStyleBases'
import { SegmentLine, SegmentLines } from '../../lib/collections/SegmentLines'
import { SegmentLineItems } from '../../lib/collections/SegmentLineItems'
import { StudioInstallations } from '../../lib/collections/StudioInstallations'
import { SourceLayerType } from 'tv-automation-sofie-blueprints-integration'
import { Segment, Segments } from '../../lib/collections/Segments'
import { Random } from 'meteor/random'
import * as _ from 'underscore'
import { DeviceType as PlayoutDeviceType } from 'timeline-state-resolver-types'
import { logger } from '../logging'
import { LookaheadMode } from '../../lib/api/playout'
import { MediaObjects } from '../../lib/collections/MediaObjects'
import { setMeteorMethods } from '../methods'
import { ShowStyleVariants } from '../../lib/collections/ShowStyleVariants';

// These are temporary method to fill the rundown database with some sample data
// for development

setMeteorMethods({
	'debug_sampleSetup' () {
		StudioInstallations.insert({
			_id: 'studio0',
			name: 'Dummy studio',
			defaultShowStyleVariant: 'dummyShow0',
			supportedShowStyleBase: [],
			// outputLayers: [
			// 	{
			// 		_id: 'studio0-pgm0',
			// 		_rank: 0,
			// 		name: 'PGM',
			// 		isPGM: true,
			// 	},
			// 	{
			// 		_id: 'studio0-monitor0',
			// 		_rank: 1,
			// 		name: 'Skjerm',
			// 		isPGM: false,
			// 	}
			// ],
			// sourceLayers: [
			// 	{
			// 		_id: 'studio0-lower-third0',
			// 		_rank: 10,
			// 		name: 'Super',
			// 		type: SourceLayerType.LOWER_THIRD,
			// 		unlimited: true,
			// 		onPGMClean: false
			// 	},
			// 	{
			// 		_id: 'studio0-split0',
			// 		_rank: 15,
			// 		name: 'Split',
			// 		type: SourceLayerType.SPLITS,
			// 		unlimited: false,
			// 		onPGMClean: true,
			// 	},
			// 	{
			// 		_id: 'studio0-graphics0',
			// 		_rank: 20,
			// 		name: 'GFX',
			// 		type: SourceLayerType.GRAPHICS,
			// 		unlimited: true,
			// 		onPGMClean: false
			// 	},
			// 	{
			// 		_id: 'studio0-live-speak0',
			// 		_rank: 50,
			// 		name: 'STK',
			// 		type: SourceLayerType.LIVE_SPEAK,
			// 		unlimited: true,
			// 		onPGMClean: false
			// 	},
			// 	{
			// 		_id: 'studio0-remote0',
			// 		_rank: 60,
			// 		name: 'RM1',
			// 		type: SourceLayerType.REMOTE,
			// 		unlimited: false,
			// 		onPGMClean: true,
			// 		isRemoteInput: true
			// 	},
			// 	{
			// 		_id: 'studio0-vt0',
			// 		_rank: 80,
			// 		name: 'VB',
			// 		type: SourceLayerType.VT,
			// 		unlimited: true,
			// 		onPGMClean: true,
			// 	},
			// 	{
			// 		_id: 'studio0-mic0',
			// 		_rank: 90,
			// 		name: 'Mic',
			// 		type: SourceLayerType.MIC,
			// 		unlimited: false,
			// 		onPGMClean: true,
			// 	},
			// 	{
			// 		_id: 'studio0-camera0',
			// 		_rank: 100,
			// 		name: 'Kam',
			// 		type: SourceLayerType.CAMERA,
			// 		unlimited: false,
			// 		onPGMClean: true,
			// 	},
			// ],
			mappings: {
				'layer0': {
					device: PlayoutDeviceType.CASPARCG,
					lookahead: LookaheadMode.NONE,
					deviceId: 'casparcg0'
				}
			},

			config: [
				{
					_id: 'nora_group',
					value: 'dksl'
				},
				{
					_id: 'nora_apikey',
					value: ''
				},
				{
					_id: 'slack_evaluation',
					value: ''
				}
			]
		})

		// Set all running orders without a studio installation to use the dummy one
		RunningOrders.update({studioInstallationId: { $not: { $exists: true } }}, {$set: { studioInstallationId: 'studio0' }})
	},

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

	/*
	'debug_emptyDatabase' () {
		logger.debug('Clear the database')

		ShowStyleBases.remove({})
		ShowStyleVariants.remove({})
		StudioInstallations.remove({})
		Meteor.call('debug_removeAllRos')
	},
	*/

	'debug_purgeMediaDB' () {
		MediaObjects.remove({})
	},

	'debug_removeAllRos' () {
		logger.debug('Remove all runningOrders')

		// SegmentLineItems.remove({})
		// SegmentLines.remove({})
		// Segments.remove({})
		// RunningOrders.remove({})

		RunningOrders.find({}).forEach((ro) => {
			ro.remove()
		})
	},

	'debug_sampleShowStyle' () {
		ShowStyleBases.insert({
			_id: 'dummyShow0',
			name: 'Dummy show style',
			blueprintId: '',
			outputLayers: [],
			sourceLayers: [],
			config: []
		})

		RunningOrders.update({showStyleBaseId: { $not: { $exists: true }}}, { $set: { showStyleBaseId: 'dummyShow0' }})
	},

	'debug_takeNext' (roId) {
		let runningOrder = RunningOrders.findOne(roId || 'ro1')

		if (runningOrder) {
			let nextLine: SegmentLine | undefined
			let segment: Segment | undefined

			if (!runningOrder.currentSegmentLineId) {
				segment = Segments.findOne({
					'runningOrderId': {
						'$eq': runningOrder._id
					}
				}, {
					sort: {
						'_rank': 1
					}
				})
				if (segment) {
					nextLine = SegmentLines.findOne({
						'segmentId': {
							'$eq': segment._id
						}
					}, {
						sort: {
							'_rank': 1
						}
					})
				}
			} else if (runningOrder.nextSegmentLineId) {
				nextLine = SegmentLines.findOne(runningOrder.nextSegmentLineId)
				if (nextLine) segment = Segments.findOne(nextLine.segmentId)
			}

			if (nextLine && segment) {
				RunningOrders.update(runningOrder._id, {
					'$set': {
						'currentSegmentLineId': nextLine._id
					}
				})

				let nextPlusLine = SegmentLines.findOne({
					'runningOrderId': {
						'$eq': runningOrder._id
					},
					'segmentId': {
						'$eq': nextLine.segmentId
					},
					'_rank': {
						'$gt': nextLine._rank
					}
				}, {
					sort: {
						'_rank': 1
					}
				})

				// if found next+1 line in current segment, go with that
				if (nextPlusLine) {
					RunningOrders.update(runningOrder._id, {
						'$set': {
							'nextSegmentLineId': nextPlusLine._id
						}
					})
				// if not, try next segment
				} else {
					let newSegment = Segments.findOne({
						'runningOrderId': {
							'$eq': runningOrder._id
						},
						'_rank': {
							'$gt': segment._rank
						}
					}, {
						sort: {
							'_rank': 1
						}
					})

					// if next segment found
					if (newSegment) {
						segment = newSegment
						nextPlusLine = SegmentLines.findOne({
							'runningOrderId': {
								'$eq': runningOrder._id
							},
							'segmentId': {
								'$eq': segment._id
							}
						}, {
							sort: {
								'_rank': 1
							}
						})

						// if next segmentLine found in next segment
						if (nextPlusLine) {
							RunningOrders.update(runningOrder._id, {
								'$set': {
									'nextSegmentLineId': nextPlusLine._id
								}
							})
						}
					} else {
						RunningOrders.update(runningOrder._id, {
							'$set': {
								'nextSegmentLineId': null
							}
						})
					}
				}
			}
		}
	}
})
