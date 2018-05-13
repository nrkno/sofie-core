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
					name: 'Skjerm',
					isPGM: false,
				}
			],
			sourceLayers: [
				{
					_id: 'studio0-lower-third0',
					_rank: 10,
					name: 'Super',
					type: RundownAPI.SourceLayerType.LOWER_THIRD,
					unlimited: true,
					onPGMClean: false
				},
				{
					_id: 'studio0-split0',
					_rank: 15,
					name: 'Split',
					type: RundownAPI.SourceLayerType.SPLITS,
					unlimited: false,
					onPGMClean: true,
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
					_id: 'studio0-live-speak0',
					_rank: 50,
					name: 'STK',
					type: RundownAPI.SourceLayerType.LIVE_SPEAK,
					unlimited: true,
					onPGMClean: false
				},
				{
					_id: 'studio0-remote0',
					_rank: 60,
					name: 'RM1',
					type: RundownAPI.SourceLayerType.REMOTE,
					unlimited: false,
					onPGMClean: true,
					isRemoteInput: true
				},
				{
					_id: 'studio0-vt0',
					_rank: 80,
					name: 'VB',
					type: RundownAPI.SourceLayerType.VT,
					unlimited: true,
					onPGMClean: true,
				},
				{
					_id: 'studio0-mic0',
					_rank: 90,
					name: 'Mic',
					type: RundownAPI.SourceLayerType.MIC,
					unlimited: false,
					onPGMClean: true,
				},
				{
					_id: 'studio0-camera0',
					_rank: 100,
					name: 'Kam',
					type: RundownAPI.SourceLayerType.CAMERA,
					unlimited: false,
					onPGMClean: true,
				},
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
		Meteor.call('debug_setOnAirLine', 'ro1-seg0-line0')

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
			_rank: 1,
			mosId: 'MOCK_RO0_SEG1',
			runningOrderId: roId,
			name: 'Ordfører skeptisk til Liberstad',
			number: '1'
		}
		let seg2: Segment = {
			_id: roId + '-seg2',
			_rank: 2,
			mosId: 'MOCK_RO0_SEG2',
			runningOrderId: roId,
			name: 'Savnet i Sør-Afrika',
			number: '1'
		}
		let seg3: Segment = {
			_id:  roId + '-seg3',
			_rank: 3,
			mosId: 'MOCK_RO0_SEG3',
			runningOrderId: roId,
			name: 'Havarist kan havne i Tyrkia',
			number: '1'
		}
		let seg4: Segment = {
			_id:  roId + '-seg4',
			_rank: 4,
			mosId: 'MOCK_RO0_SEG4',
			runningOrderId: roId,
			name: 'Skatepark i Mandal',
			number: '1'
		}
		let seg5: Segment = {
			_id:  roId + '-seg5',
			_rank: 5,
			mosId: 'MOCK_RO0_SEG5',
			runningOrderId: roId,
			name: 'Paddeparring',
			number: '1'
		}
		let seg6: Segment = {
			_id:  roId + '-seg6',
			_rank: 6,
			mosId: 'MOCK_RO0_SEG6',
			runningOrderId: roId,
			name: 'Cup oppsett',
			number: '1'
		}
		let seg7: Segment = {
			_id:  roId + '-seg7',
			_rank: 7,
			mosId: 'MOCK_RO0_SEG7',
			runningOrderId: roId,
			name: 'Været',
			number: '1'
		}
		let seg8: Segment = {
			_id:  roId + '-seg8',
			_rank: 8,
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
				runningOrderId: seg0.runningOrderId,
				expectedDuration: 5
			}
			SegmentLines.insert(segLine)

			let
			// Opening title VT
				segmentLineItem = literal<SegmentLineItem>({
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
					expectedDuration: 5,
					disabled: false
				})
				SegmentLineItems.insert(segmentLineItem)

			// Fribyen
				segLine = {
					_id: seg0._id + '-line' + line,
					_rank: line++,
					mosId: seg0.mosId + '_LINE' + line++,
					segmentId: seg0._id,
					runningOrderId: seg0.runningOrderId,
					expectedDuration: 7
				}
				SegmentLines.insert(segLine)

				segmentLineItem = literal<SegmentLineItem>({
					_id: segLine._id + ':' + Random.id(5),
					mosId: segLine.mosId,
					segmentLineId: segLine._id,
					runningOrderId: roId,
					name: 'Norges første...||...i en privat by.',
					trigger: {
						type: 0,
						value: 0
					},
					status: RundownAPI.LineItemStatusCode.OK,
					transitions: {
						inTransition: {
							type: Transition.MIX,
							duration: 0.5,
							easing: Ease.EASEINOUTSINE,
							direction: Direction.RIGHT
						},
						outTransition: {
							type: Transition.CUT,
							duration: 0.0,
							easing: Ease.NONE,
							direction: Direction.RIGHT
						}
					},
					sourceLayerId: 'studio0-mic0',
					outputLayerId: 'studio0-pgm0',
					expectedDuration: 7,
					disabled: false
				})
				SegmentLineItems.insert(segmentLineItem)

				segmentLineItem = literal<SegmentLineItem>({
					_id: segLine._id + ':' + Random.id(5),
					mosId: segLine.mosId,
					segmentLineId: segLine._id,
					runningOrderId: roId,
					name: 'Fribyen tar form',
					trigger: {
						type: 0,
						value: 0.5
					},
					status: RundownAPI.LineItemStatusCode.OK,
					sourceLayerId: 'studio0-graphics0',
					outputLayerId: 'studio0-pgm0',
					expectedDuration: 6.4,
					disabled: false
				})
				SegmentLineItems.insert(segmentLineItem)

				segmentLineItem = literal<SegmentLineItem>({
					_id: segLine._id + ':' + Random.id(5),
					mosId: segLine.mosId,
					segmentLineId: segLine._id,
					runningOrderId: roId,
					name: 'Fribyen',
					trigger: {
						type: 0,
						value: 0.0
					},
					status: RundownAPI.LineItemStatusCode.OK,
					sourceLayerId: 'studio0-live-speak0',
					outputLayerId: 'studio0-pgm0',
					expectedDuration: 6.9,
					disabled: false
				})
				SegmentLineItems.insert(segmentLineItem)

			// Padder
				segLine = {
					_id: seg0._id + '-line' + line,
					_rank: line++,
					mosId: seg0.mosId + '_LINE' + line++,
					segmentId: seg0._id,
					runningOrderId: seg0.runningOrderId,
					expectedDuration: 7
				}
				SegmentLines.insert(segLine)

				segmentLineItem = literal<SegmentLineItem>({
					_id: segLine._id + ':' + Random.id(5),
					mosId: segLine.mosId,
					segmentLineId: segLine._id,
					runningOrderId: roId,
					name: 'Nå er padd...||...på direkten.',
					trigger: {
						type: 0,
						value: 0
					},
					status: RundownAPI.LineItemStatusCode.OK,
					transitions: {
						inTransition: {
							type: Transition.CUT,
							duration: 0.0,
							easing: Ease.NONE,
							direction: Direction.RIGHT
						}
					},
					sourceLayerId: 'studio0-mic0',
					outputLayerId: 'studio0-pgm0',
					expectedDuration: 6.3,
					disabled: false
				})
				SegmentLineItems.insert(segmentLineItem)

				segmentLineItem = literal<SegmentLineItem>({
					_id: segLine._id + ':' + Random.id(5),
					mosId: segLine.mosId,
					segmentLineId: segLine._id,
					runningOrderId: roId,
					name: 'Våryre padder',
					trigger: {
						type: 0,
						value: 0.5
					},
					status: RundownAPI.LineItemStatusCode.OK,
					sourceLayerId: 'studio0-graphics0',
					outputLayerId: 'studio0-pgm0',
					expectedDuration: 6.5,
					disabled: false
				})
				SegmentLineItems.insert(segmentLineItem)

				segmentLineItem = literal<SegmentLineItem>({
					_id: segLine._id + ':' + Random.id(5),
					mosId: segLine.mosId,
					segmentLineId: segLine._id,
					runningOrderId: roId,
					name: 'Padder',
					trigger: {
						type: 0,
						value: 0.0
					},
					status: RundownAPI.LineItemStatusCode.OK,
					sourceLayerId: 'studio0-live-speak0',
					outputLayerId: 'studio0-pgm0',
					expectedDuration: 7,
					disabled: false
				})
				SegmentLineItems.insert(segmentLineItem)



		/* Segment 1 */
			line = 0
			segLine = {
				_id: seg1._id + '-line' + line,
				_rank: line++,
				mosId: seg1.mosId + '_LINE' + line++,
				segmentId: seg1._id,
				runningOrderId: seg1.runningOrderId,
				expectedDuration: 7.5
			}
			SegmentLines.insert(segLine)

			// Bumper VT
			segmentLineItem = literal<SegmentLineItem>({
				_id: segLine._id + ':' + Random.id(5),
				mosId: segLine.mosId,
				segmentLineId: segLine._id,
				runningOrderId: roId,
				name: 'Wipe Bumper',
				trigger: {
					type: 0,
					value: 0
				},
				status: RundownAPI.LineItemStatusCode.OK,
				sourceLayerId: 'studio0-vt0',
				outputLayerId: 'studio0-pgm0',
				expectedDuration: 0.5,
				disabled: false
			})
			SegmentLineItems.insert(segmentLineItem)

			// Camera 1
				let cameraStartSegmentLineItemId = segLine._id + ':' + Random.id(5)
				segmentLineItem = literal<SegmentLineItem>({
					_id: cameraStartSegmentLineItemId,
					mosId: segLine.mosId,
					segmentLineId: segLine._id,
					runningOrderId: roId,
					name: '1',
						trigger: {
						type: 0,
						value: 0
					},
					status: RundownAPI.LineItemStatusCode.OK,
					sourceLayerId: 'studio0-camera0',
					outputLayerId: 'studio0-pgm0',
					expectedDuration: Number.POSITIVE_INFINITY,
					disabled: false
				})
				SegmentLineItems.insert(segmentLineItem)
				
			// Script
				segmentLineItem = literal<SegmentLineItem>({
					_id: segLine._id + ':' + Random.id(5),
					mosId: segLine.mosId,
					segmentLineId: segLine._id,
					runningOrderId: roId,
					name: 'God fredagskveld, vi ska først...||...til heile prosjektet.',
					trigger: {
						type: 0,
						value: 0.5
					},
					status: RundownAPI.LineItemStatusCode.OK,
					sourceLayerId: 'studio0-mic0',
					outputLayerId: 'studio0-pgm0',
					expectedDuration: 7,
					disabled: false
				})
				SegmentLineItems.insert(segmentLineItem)

			// Name
				segmentLineItem = literal<SegmentLineItem>({
					_id: segLine._id + ':' + Random.id(5),
					mosId: segLine.mosId,
					segmentLineId: segLine._id,
					runningOrderId: roId,
					name: 'Knut Knudsen Eigeland',
						trigger: {
						type: 0,
						value: 2.5
					},
					status: RundownAPI.LineItemStatusCode.OK,
					sourceLayerId: 'studio0-lower-third0',
					outputLayerId: 'studio0-pgm0',
					expectedDuration: 3.5,
					disabled: false
				})
				SegmentLineItems.insert(segmentLineItem)

			// Next	
				segLine = {
					_id: seg1._id + '-line' + line,
					_rank: line++,
					mosId: seg1.mosId + '_LINE' + line++,
					segmentId: seg1._id,
					runningOrderId: seg1.runningOrderId,
					expectedDuration: 20
				}
				SegmentLines.insert(segLine)

			// Studio screen
				segmentLineItem = literal<SegmentLineItem>({
					_id: segLine._id + ':' + Random.id(5),
					mosId: segLine.mosId,
					segmentLineId: segLine._id,
					runningOrderId: roId,
					name: 'Liberstad skjerm',
					trigger: {
						type: 0,
						value: 0
					},
					transitions: {
						inTransition: {
							type: Transition.WIPE,
							duration: 0.5,
							easing: Ease.EASEINOUTSINE,
							direction: Direction.LEFT
						}
					},

					content: {
						loop: true
					},
	
					status: RundownAPI.LineItemStatusCode.OK,
					sourceLayerId: 'studio0-vt0',
					outputLayerId: 'studio0-monitor0',
					expectedDuration: 20,
					disabled: false
				})
				SegmentLineItems.insert(segmentLineItem)

			// Cam	
				let nextCameraSegmentLineItemId = segLine._id + ':' + Random.id(5)
				segmentLineItem = literal<SegmentLineItem>({
					_id: nextCameraSegmentLineItemId,
					mosId: segLine.mosId,
					segmentLineId: segLine._id,
					runningOrderId: roId,
					name: '1',
					trigger: {
						type: 0,
						value: 0
					},
					status: RundownAPI.LineItemStatusCode.OK,
					sourceLayerId: 'studio0-camera0',
					outputLayerId: 'studio0-pgm0',
					expectedDuration: Number.POSITIVE_INFINITY,
					disabled: false,
					continuesRefId: cameraStartSegmentLineItemId
				})
				SegmentLineItems.insert(segmentLineItem)

				cameraStartSegmentLineItemId = nextCameraSegmentLineItemId

			// Next	
				segLine = {
					_id: seg1._id + '-line' + line,
					_rank: line++,
					mosId: seg1.mosId + '_LINE' + line++,
					segmentId: seg1._id,
					runningOrderId: seg1.runningOrderId,
					expectedDuration: 103
				}
				SegmentLines.insert(segLine)

			// VT
				segmentLineItem = literal<SegmentLineItem>({
					_id: segLine._id + ':' + Random.id(5),
					mosId: segLine.mosId,
					segmentLineId: segLine._id,
					runningOrderId: roId,
					name: 'Liberstad VB||...som de da planlegger.',
					trigger: {
						type: 0,
						value: 0
					},
					status: RundownAPI.LineItemStatusCode.OK,
					sourceLayerId: 'studio0-vt0',
					outputLayerId: 'studio0-pgm0',
					expectedDuration: 103,
					disabled: false
				})
				SegmentLineItems.insert(segmentLineItem)


			// Name
				segmentLineItem = literal<SegmentLineItem>({
					_id: segLine._id + ':' + Random.id(5),
					mosId: segLine.mosId,
					segmentLineId: segLine._id,
					runningOrderId: roId,
					name: 'Siv Kristin Sællmann||reporter',
						trigger: {
						type: 0,
						value: 2.5
					},
					status: RundownAPI.LineItemStatusCode.OK,
					sourceLayerId: 'studio0-lower-third0',
					outputLayerId: 'studio0-pgm0',
					expectedDuration: 4,
					disabled: false
				})
				SegmentLineItems.insert(segmentLineItem)
		
			// Name
				segmentLineItem = literal<SegmentLineItem>({
					_id: segLine._id + ':' + Random.id(5),
					mosId: segLine.mosId,
					segmentLineId: segLine._id,
					runningOrderId: roId,
					name: 'Helge Sandåker||ordfører Marnadal (Ap)',
						trigger: {
						type: 0,
						value: 26
					},
					status: RundownAPI.LineItemStatusCode.OK,
					sourceLayerId: 'studio0-lower-third0',
					outputLayerId: 'studio0-pgm0',
					expectedDuration: 4,
					disabled: false
				})
				SegmentLineItems.insert(segmentLineItem)
		
			// Graphics	
				segmentLineItem = literal<SegmentLineItem>({
					_id: segLine._id + ':' + Random.id(5),
					mosId: segLine.mosId,
					segmentLineId: segLine._id,
					runningOrderId: roId,
					name: 'Foto: Dag Lauvland/Lindesnes Avis',
					trigger: {
						type: 0,
						value: 39
					},
					status: RundownAPI.LineItemStatusCode.OK,
					sourceLayerId: 'studio0-graphics0',
					outputLayerId: 'studio0-pgm0',
					expectedDuration: 4,
					disabled: false
				})
				SegmentLineItems.insert(segmentLineItem)

				segmentLineItem = literal<SegmentLineItem>({
					_id: segLine._id + ':' + Random.id(5),
					mosId: segLine.mosId,
					segmentLineId: segLine._id,
					runningOrderId: roId,
					name: 'Foto/redigering Geir Ingar Egeland',
					trigger: {
						type: 0,
						value: 97
					},
					status: RundownAPI.LineItemStatusCode.OK,
					sourceLayerId: 'studio0-graphics0',
					outputLayerId: 'studio0-pgm0',
					expectedDuration: 4,
					disabled: false
				})
				SegmentLineItems.insert(segmentLineItem)

			// Cam	
				segmentLineItem = literal<SegmentLineItem>({
					_id: segLine._id + ':' + Random.id(5),
					mosId: segLine.mosId,
					segmentLineId: segLine._id,
					runningOrderId: roId,
					name: '1',
					trigger: {
						type: 0,
						value: 0
					},
					status: RundownAPI.LineItemStatusCode.OK,
					sourceLayerId: 'studio0-camera0',
					outputLayerId: 'studio0-pgm0',
					expectedDuration: Number.POSITIVE_INFINITY,
					disabled: false,
					continuesRefId: cameraStartSegmentLineItemId
				})
				SegmentLineItems.insert(segmentLineItem)

			// Split	
				segmentLineItem = literal<SegmentLineItem>({
					_id: segLine._id + ':' + Random.id(5),
					mosId: segLine.mosId,
					segmentLineId: segLine._id,
					runningOrderId: roId,
					name: 'Split Demo',
					trigger: {
						type: 0,
						value: 50
					},
					status: RundownAPI.LineItemStatusCode.OK,
					sourceLayerId: 'studio0-split0',
					outputLayerId: 'studio0-pgm0',
					expectedDuration: 10,
					disabled: false
				})
				SegmentLineItems.insert(segmentLineItem)

			// Live In
				segmentLineItem = literal<SegmentLineItem>({
					_id: segLine._id + ':' + Random.id(5),
					mosId: segLine.mosId,
					segmentLineId: segLine._id,
					runningOrderId: roId,
					name: 'RM0 LIVE HELSINKI',
					trigger: {
						type: 0,
						value: 50
					},
					status: RundownAPI.LineItemStatusCode.OK,
					sourceLayerId: 'studio0-remote0',
					outputLayerId: 'studio0-pgm0',
					expectedDuration: 10,
					disabled: false
				})
				SegmentLineItems.insert(segmentLineItem)
		// Segment 2
			line = 0
			segLine = {
				_id: seg2._id + '-line' + line,
				_rank: line++,
				mosId: seg2.mosId + '_LINE' + line++,
				segmentId: seg2._id,
				runningOrderId: seg1.runningOrderId,
				expectedDuration: 64
			}
			SegmentLines.insert(segLine)

			// STK
				segmentLineItem = literal<SegmentLineItem>({
					_id: segLine._id + ':' + Random.id(5),
					mosId: segLine.mosId,
					segmentLineId: segLine._id,
					runningOrderId: roId,
					name: 'Savnet VB||...som de da planlegger.',
					trigger: {
						type: 0,
						value: 0
					},
					status: RundownAPI.LineItemStatusCode.OK,
					sourceLayerId: 'studio0-live-speak0',
					outputLayerId: 'studio0-pgm0',
					expectedDuration: 64,
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
					transitions: {
						inTransition: {
							type: Transition.MIX,
							duration: 0.5,
							easing: Ease.EASEINOUTSINE,
							direction: Direction.LEFT
						}
					},
					status: RundownAPI.LineItemStatusCode.OK,
					sourceLayerId: 'studio0-vt0',
					outputLayerId: 'studio0-pgm0',
					expectedDuration: Math.floor(Random.fraction() * 645),
					disabled: false
				})
/* 				let lowerthirdSegmentLineItem = literal<SegmentLineItem>({
					_id: segmentLine._id + ':' + Random.id(5),
					mosId: segmentLine.mosId,
					segmentLineId: segmentLine._id,
					runningOrderId: runningOrder._id,
					name: 'Åge Øyvindsen',
					trigger: {
						type: 0,
						value: 0
					},
					status: RundownAPI.LineItemStatusCode.OK,
					sourceLayerId: 'studio0-lower-third0',
					outputLayerId: 'studio0-pgm0',
					expectedDuration: 10,
					disabled: false
				})
				SegmentLineItems.insert(segmentLineItem)
				SegmentLineItems.insert(lowerthirdSegmentLineItem)
*/
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

	'debug_takeNext' (roId) {
		let runningOrder = RunningOrders.findOne(roId || 'ro1')

		if (runningOrder) {
			let nextLine: SegmentLine | null = null
			let segment: Segment | null = null

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
				segment = Segments.findOne(nextLine.segmentId)
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
	},

	'debug_setOnAirLine' (liveId) {
		let segmentLine = SegmentLines.findOne(liveId || 'ro0-seg0-line0')

		if (segmentLine) {
			let runningOrder = RunningOrders.findOne(segmentLine.runningOrderId)
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
