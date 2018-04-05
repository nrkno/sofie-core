import { Meteor } from 'meteor/meteor'
import { RunningOrder, RunningOrders } from '../../lib/collections/RunningOrders'
import { ShowStyle, ShowStyles } from '../../lib/collections/ShowStyles'
import { SegmentLine, SegmentLines } from '../../lib/collections/SegmentLines'
import { SegmentLineItem, SegmentLineItems } from '../../lib/collections/SegmentLineItems'
import { StudioInstallation, StudioInstallations } from '../../lib/collections/StudioInstallations'
import { getCurrentTime, saveIntoDb, literal, DBObj, partialExceptId } from '../../lib/lib'
import { RundownAPI } from '../../lib/api/rundown'
import { Segment, Segments } from '../../lib/collections/Segments'
import { Random } from 'meteor/random'
import * as _ from 'underscore'

// These are temporary method to fill the rundown database with some sample data
// for development

Meteor.methods({
	'debug_sampleSetup' () {
		StudioInstallations.insert({
			_id: 'studio0',
			name: 'Dummy studio',
			outputLayers: [
				{
					_id: 'studio0-pgm0',
					name: 'PGM',
					isPGM: true,
				},
				{
					_id: 'studio0-monitor0',
					name: 'Studio 1',
					isPGM: false,
				}
			],
			sourceLayers: [
				{
					_id: 'studio0-camera0',
					name: 'Cams',
					type: RundownAPI.SourceLayerType.CAMERA,
					unlimited: false,
					onPGMClean: true,
				},
				{
					_id: 'studio0-vt0',
					name: 'VB',
					type: RundownAPI.SourceLayerType.VT,
					unlimited: true,
					onPGMClean: true,
				},
				{
					_id: 'studio0-graphics0',
					name: 'GFX',
					type: RundownAPI.SourceLayerType.GRAPHICS,
					unlimited: true,
					onPGMClean: false
				},
				{
					_id: 'studio0-remote0',
					name: 'RM1',
					type: RundownAPI.SourceLayerType.REMOTE,
					unlimited: false,
					onPGMClean: true
				}
			]
		})

		// Set all running orders without a studio installation to use the dummy one
		RunningOrders.update({studioInstallationId: { $not: { $exists: true } }}, {$set: { studioInstallationId: 'studio0' }})
	},

	'debug_scrambleDurations' () {
		let segmentLineItems = SegmentLineItems.find().fetch()
		_.each(segmentLineItems, (segmentLineItem) => {
			SegmentLineItems.update({ _id: segmentLineItem._id }, { $inc: { expectedDuration: ((Random.fraction() * 500) - 250) } })
		})
	},

	'debug_mockRelationships' () {
		let runningOrder = RunningOrders.findOne()
		let segments = Segments.find({ runningOrderId: runningOrder._id }).fetch()
		_.each(segments, (segment) => {
			let segmentLines = SegmentLines.find({ segmentId: segment._id }).fetch()
			_.each(segmentLines, (segmentLine) => {
				let segmentLineItem = literal<SegmentLineItem>({
					_id: segmentLine._id + ':' + getCurrentTime(),
					mosId: segmentLine.mosId,
					segmentLineId: segmentLine._id,
					runningOrderId: runningOrder._id,
					name: segment.name + ':VO',
					trigger: {
						type: 0,
						value: 0
					},
					status: RundownAPI.LineItemStatusCode.OK,
					sourceLayerId: 'studio0-vt0',
					outputLayerId: 'studio0-pgm0',
					expectedDuration: Math.floor(Random.fraction() * 645),
					disabled: false
				})
				SegmentLineItems.insert(segmentLineItem)
			})
		})
	},

	'debug_emptyDatabase' () {
		console.log('Clear the database')

		SegmentLineItems.remove({})
		SegmentLines.remove({})
		Segments.remove({})
		RunningOrders.remove({})
		ShowStyles.remove({})
		StudioInstallations.remove({})
	},

	'debug_sampleShowStyle' () {
		ShowStyles.insert({
			_id: 'dummyShow0',
			name: 'Dummy show style',
			splitConfigurations: [
				{
					// a still undefined split configuration object
				}
			],
			graphicsTemplates: [
				{
					// a still undefined graphics template object
				}
			],
			wipesAndBumpers: [
				{
					// a still undefined wipes and bumpers object
				}
			],
			logicalSegmentLineItems: [
				{
					// a still undefined logical objects definition object
				}
			]
		})

		RunningOrders.update({showStyleId: { $not: { $exists: true }}}, { $set: { showStyleId: 'dummyShow0' }})
	}
})
