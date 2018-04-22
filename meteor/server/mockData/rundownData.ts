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
					_rank: 0,
					name: 'PGM',
					isPGM: true,
				},
				{
					_id: 'studio0-monitor0',
					_rank: 1,
					name: 'Studio 1',
					isPGM: false,
				}
			],
			sourceLayers: [
				{
					_id: 'studio0-camera0',
					_rank: 100,
					name: 'CAMS',
					type: RundownAPI.SourceLayerType.CAMERA,
					unlimited: false,
					onPGMClean: true,
				},
				{
					_id: 'studio0-vt0',
					_rank: 80,
					name: 'VT',
					type: RundownAPI.SourceLayerType.VT,
					unlimited: true,
					onPGMClean: true,
				},
				{
					_id: 'studio0-lower-third0',
					_rank: 10,
					name: 'Lower-third',
					type: RundownAPI.SourceLayerType.LOWER_THIRD,
					unlimited: true,
					onPGMClean: false
				},
				{
					_id: 'studio0-live-speak0',
					_rank: 10,
					name: 'Live Speak',
					type: RundownAPI.SourceLayerType.LIVE_SPEAK,
					unlimited: true,
					onPGMClean: false
				},
				{
					_id: 'studio0-graphics0',
					_rank: 20,
					name: 'GFX',
					type: RundownAPI.SourceLayerType.GRAPHICS,
					unlimited: true,
					onPGMClean: false
				},
				{
					_id: 'studio0-remote0',
					_rank: 50,
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

	'debug_demoRundown' () {
		Meteor.call('debug_emptyDatabase')
		Meteor.call('debug_sampleSetup')
		Meteor.call('debug_sampleShowStyle')

		let roId = 'ro1'

		let oldRo = RunningOrders.findOne({_id: roId})
		if (oldRo) {
			RunningOrders.remove({_id: roId})
		}

		let ro: RunningOrder = {
			_id: roId,
			mosId: 'MOCK_RO0',
			studioInstallationId: 'studio0',
			showStyleId: 'dummyShow0',
			name: 'Distriktsnyheter Sørlandet',
			created: Date.now(),
			currentSegmentLineId: null,
			nextSegmentLineId: null
		}
		RunningOrders.insert(ro)

		let seg0: Segment = {
			_id: roId + '-seg0',
			_rank: 0,
			mosId: 'MOCK_RO0_SEG0',
			runningOrderId: roId,
			name: 'Vignett',
			number: '0'
		}
		let seg1: Segment = {
			_id: roId + '-seg1',
			_rank: 0,
			mosId: 'MOCK_RO0_SEG1',
			runningOrderId: roId,
			name: 'Ordfører skeptisk til Liberstad',
			number: '1'
		}
		let seg2: Segment = {
			_id: roId + '-seg2',
			_rank: 0,
			mosId: 'MOCK_RO0_SEG2',
			runningOrderId: roId,
			name: 'Savnet i Sør-Afrika',
			number: '1'
		}
		let seg3: Segment = {
			_id:  roId + '-seg3',
			_rank: 0,
			mosId: 'MOCK_RO0_SEG3',
			runningOrderId: roId,
			name: 'Havarist kan havne i Tyrkia',
			number: '1'
		}
		let seg4: Segment = {
			_id:  roId + '-seg4',
			_rank: 0,
			mosId: 'MOCK_RO0_SEG4',
			runningOrderId: roId,
			name: 'Skatepark i Mandal',
			number: '1'
		}
		let seg5: Segment = {
			_id:  roId + '-seg5',
			_rank: 0,
			mosId: 'MOCK_RO0_SEG5',
			runningOrderId: roId,
			name: 'Paddeparring',
			number: '1'
		}
		let seg6: Segment = {
			_id:  roId + '-seg6',
			_rank: 0,
			mosId: 'MOCK_RO0_SEG6',
			runningOrderId: roId,
			name: 'Cup oppsett',
			number: '1'
		}
		let seg7: Segment = {
			_id:  roId + '-seg7',
			_rank: 0,
			mosId: 'MOCK_RO0_SEG7',
			runningOrderId: roId,
			name: 'Været',
			number: '1'
		}
		let seg8: Segment = {
			_id:  roId + '-seg8',
			_rank: 0,
			mosId: 'MOCK_RO0_SEG8',
			runningOrderId: roId,
			name: 'Seerbilde',
			number: '1'
		}
		Segments.insert(seg0)
		Segments.insert(seg1)
		Segments.insert(seg2)
		Segments.insert(seg3)
		Segments.insert(seg4)
		Segments.insert(seg5)
		Segments.insert(seg6)
		Segments.insert(seg7)

		/* Segment 0 */
		let line = 0
		let segLine: SegmentLine = {
			_id: seg0._id + '-line' + line,
			_rank: line++,
			mosId: seg0.mosId + '_LINE' + line++,
			segmentId: seg0._id,
			runningOrderId: seg0.runningOrderId
		}
		SegmentLines.insert(segLine)

		// Opening title VT
		let segmentLineItem = literal<SegmentLineItem>({
			_id: segLine._id + ':' + Random.id(5),
			mosId: segLine.mosId,
			segmentLineId: segLine._id,
			runningOrderId: roId,
			name: 'Vignett',
			trigger: {
				type: 0,
				value: 0
			},
			status: RundownAPI.LineItemStatusCode.OK,
			sourceLayerId: 'studio0-vt0',
			outputLayerId: 'studio0-pgm0',
			expectedDuration: 3.5,
			disabled: false
		})
		SegmentLineItems.insert(segmentLineItem)

		//Studio screen
		segmentLineItem = literal<SegmentLineItem>({
			_id: segLine._id + ':' + Random.id(5),
			mosId: segLine.mosId,
			segmentLineId: segLine._id,
			runningOrderId: roId,
			name: 'Skjermloop',
			trigger: {
				type: 0,
				value: 0
			},
			status: RundownAPI.LineItemStatusCode.OK,
			sourceLayerId: 'studio0-vt0',
			outputLayerId: 'studio0-monitor0',
			expectedDuration: 400,
			disabled: false
		})
		SegmentLineItems.insert(segmentLineItem)

		//Graphics: NRK logo
		segmentLineItem = literal<SegmentLineItem>({
			_id: segLine._id + ':' + Random.id(5),
			mosId: segLine.mosId,
			segmentLineId: segLine._id,
			runningOrderId: roId,
			name: 'NRK Nyheter Logo',
			trigger: {
				type: 0,
				value: 0
			},
			status: RundownAPI.LineItemStatusCode.OK,
			sourceLayerId: 'studio0-graphics0',
			outputLayerId: 'studio0-pgm0',
			expectedDuration: 4,
			disabled: false
		})
		SegmentLineItems.insert(segmentLineItem)

		//Lower-third: Name
		segmentLineItem = literal<SegmentLineItem>({
			_id: segLine._id + ':' + Random.id(5),
			mosId: segLine.mosId,
			segmentLineId: segLine._id,
			runningOrderId: roId,
			name: 'Knut Knudsen Eigeland',
				trigger: {
				type: 0,
				value: 22
			},
			status: RundownAPI.LineItemStatusCode.OK,
			sourceLayerId: 'studio0-lower-third0',
			outputLayerId: 'studio0-pgm0',
			expectedDuration: 3.5,
			disabled: false
		})
		SegmentLineItems.insert(segmentLineItem)

	},

	'debug_sampleRundown' () {
		let ro: RunningOrder = {
			_id: 'ro0',
			mosId: 'MOCK_RO0',
			studioInstallationId: 'studio0',
			showStyleId: 'dummyShow0',
			name: '5PM NEWSCAST',
			created: Date.now(),
			currentSegmentLineId: null,
			nextSegmentLineId: null
		}
		RunningOrders.insert(ro)

		let seg0: Segment = {
			_id: 'ro0-seg0',
			_rank: 0,
			mosId: 'MOCK_RO0_SEG0',
			runningOrderId: 'ro0',
			name: 'SHOW OPEN',
			number: '0'
		}
		let seg1: Segment = {
			_id: 'ro0-seg1',
			_rank: 0,
			mosId: 'MOCK_RO0_SEG1',
			runningOrderId: 'ro0',
			name: 'MAILMEN ON STRIKE',
			number: '1'
		}
		let seg2: Segment = {
			_id: 'ro0-seg2',
			_rank: 0,
			mosId: 'MOCK_RO0_SEG2',
			runningOrderId: 'ro0',
			name: 'WALKING ON BROKEN GLASS',
			number: '1'
		}
		let seg3: Segment = {
			_id: 'ro0-seg3',
			_rank: 0,
			mosId: 'MOCK_RO0_SEG3',
			runningOrderId: 'ro0',
			name: 'CENTENNIAL CELEBRATIONS',
			number: '1'
		}
		Segments.insert(seg0)
		Segments.insert(seg1)
		Segments.insert(seg2)
		Segments.insert(seg3)

		let segs = [ seg0, seg1, seg2, seg3 ]
		segs.map((seg) => {
			let maxSeg = Math.round(Math.random() * 3) + 1
			for (let i = 0; i < maxSeg; i++) {
				let segLine: SegmentLine = {
					_id: seg._id + '-line' + i.toString(),
					_rank: i,
					mosId: seg.mosId + '_LINE' + i.toString(),
					segmentId: seg._id,
					runningOrderId: seg.runningOrderId
				}
				SegmentLines.insert(segLine)
			}
		})
	},

	'debug_mockRelationships' () {
		let runningOrder = RunningOrders.findOne()
		let segments = Segments.find({ runningOrderId: runningOrder._id }).fetch()
		_.each(segments, (segment) => {
			let segmentLines = SegmentLines.find({ segmentId: segment._id }).fetch()
			_.each(segmentLines, (segmentLine) => {
				let segmentLineItem = literal<SegmentLineItem>({
					_id: segmentLine._id + ':' + Random.id(5),
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
				let lowerthirdSegmentLineItem = literal<SegmentLineItem>({
					_id: segmentLine._id + ':' + Random.id(5),
					mosId: segmentLine.mosId,
					segmentLineId: segmentLine._id,
					runningOrderId: runningOrder._id,
					name: 'Åge Øyvindsen',
					trigger: {
						type: 0,
						value: 10
					},
					status: RundownAPI.LineItemStatusCode.OK,
					sourceLayerId: 'studio0-lower-third0',
					outputLayerId: 'studio0-pgm0',
					expectedDuration: 10,
					disabled: false
				})
				SegmentLineItems.insert(segmentLineItem)
				SegmentLineItems.insert(lowerthirdSegmentLineItem)
			})
		})
	},

	'debug_additionalItems' () {
		let segmentLine = SegmentLines.findOne({ _id: 'ro0-seg0-line0'})
		let remoteSegmentItem = literal<SegmentLineItem>({
			_id: segmentLine._id + ':' + Random.id(5),
			mosId: segmentLine.mosId,
			segmentLineId: segmentLine._id,
			runningOrderId: segmentLine.runningOrderId,
			name: 'Remote Finland',
			trigger: {
				type: 0,
				value: 120
			},
			status: RundownAPI.LineItemStatusCode.OK,
			sourceLayerId: 'studio0-remote0',
			outputLayerId: 'studio0-pgm0',
			expectedDuration: 60,
			disabled: false
		})
		let studioIdentLoopItem = literal<SegmentLineItem>({
			_id: segmentLine._id + ':' + Random.id(5),
			mosId: segmentLine.mosId,
			segmentLineId: segmentLine._id,
			runningOrderId: segmentLine.runningOrderId,
			name: 'Program Ident',
			trigger: {
				type: 0,
				value: 0
			},
			status: RundownAPI.LineItemStatusCode.OK,
			sourceLayerId: 'studio0-vt0',
			outputLayerId: 'studio0-monitor0',
			expectedDuration: Math.floor(Random.fraction() * 645),
			disabled: false
		})
		SegmentLineItems.insert(studioIdentLoopItem)
		SegmentLineItems.insert(remoteSegmentItem)
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
	},

	'debug_setOnAirLine' () {
		let segmentLine = SegmentLines.findOne('ro0-seg0-line0')

		if (segmentLine) {
			let runningOrder = RunningOrders.findOne('ro0')
			RunningOrders.update({_id: runningOrder._id}, {
				$set: { currentSegmentLineId: segmentLine._id }
			})
		}
	},

	'debug_setNextLine' (nextId) {
		let segmentLine = SegmentLines.findOne(nextId || 'ro0-seg1-line0')

		if (segmentLine) {
			let runningOrder = RunningOrders.findOne(segmentLine.runningOrderId)
			RunningOrders.update({ _id: runningOrder._id }, {
				$set: { nextSegmentLineId: segmentLine._id }
			})
		}
	}
})
