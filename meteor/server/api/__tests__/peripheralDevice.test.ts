import * as chai from 'chai'
import StubCollections from 'meteor/hwillson:stub-collections'
import { Random } from 'meteor/random'
import {} from 'mocha'

import { PeripheralDevices } from '../../../lib/collections/PeripheralDevices'
import { RunningOrder, RunningOrders } from '../../../lib/collections/RunningOrders'
import { Segment, Segments } from '../../../lib/collections/Segments'
import { SegmentLine, SegmentLines } from '../../../lib/collections/SegmentLines'
import { SegmentLineItem, SegmentLineItems } from '../../../lib/collections/SegmentLineItems'

import {
	ServerPeripheralDeviceAPI
} from '../peripheralDevice'
import { PeripheralDeviceAPI } from '../../../lib/api/peripheralDevice'

import { getCurrentTime, literal } from '../../../lib/lib'
import { MOS } from 'tv-automation-sofie-blueprints-integration'
import { roId, segmentLineId, getRO } from '../integration/mos'
import { segmentId } from '../runningOrder'

const expect = chai.expect
const assert = chai.assert

const mod = { // standard modifier
	sort: {_rank: 1}
}

// Note: The data below is copied straight from the test data in mos-connection
let xmlApiData = {
	'roCreate':  literal<MOS.IMOSRunningOrder>({
		ID: new MOS.MosString128('96857485'),
		Slug: new MOS.MosString128('5PM RUNDOWN'),
		// DefaultChannel?: MOS.MosString128,
		EditorialStart: new MOS.MosTime('2009-04-17T17:02:00'),
		EditorialDuration: new MOS.MosDuration('00:58:25'), // @todo: change this into a real Duration
		// Trigger?: any // TODO: Johan frågar vad denna gör,
		// MacroIn?: MOS.MosString128,
		// MacroOut?: MOS.MosString128,
		// MosExternalMetaData?: Array<IMOSExternalMetaData>,
		Stories: [
			literal<MOS.IMOSROStory>({
				ID: new MOS.MosString128('5983A501:0049B924:8390EF2B'),
				Slug: new MOS.MosString128('COLSTAT MURDER'),
				Number: new MOS.MosString128('A5'),
				// MosExternalMetaData: Array<IMOSExternalMetaData>
				Items: [
					literal<MOS.IMOSItem>({
						ID: new MOS.MosString128('0'),
						Slug: new MOS.MosString128('OLSTAT MURDER:VO'),
						ObjectID: new MOS.MosString128('M000224'),
						MOSID: 'testmos.enps.com',
						// mosAbstract?: '',
						Paths: [
							literal<MOS.IMOSObjectPath>({Type: MOS.IMOSObjectPathType.PATH, Description: 'MPEG2 Video', Target: '\\server\media\clip392028cd2320s0d.mxf'}),
							literal<MOS.IMOSObjectPath>({Type: MOS.IMOSObjectPathType.PROXY_PATH, Description: 'WM9 750Kbps', Target: 'http://server/proxy/clipe.wmv'}),
							literal<MOS.IMOSObjectPath>({Type: MOS.IMOSObjectPathType.METADATA_PATH, Description: 'MOS Object', Target: 'http://server/proxy/clipe.xml'})
						],
						// Channel?: new MOS.MosString128(),
						// EditorialStart?: MOS.MosTime
						EditorialDuration: 645,
						UserTimingDuration: 310,
						Trigger: 'CHAINED' // TODO: Johan frågar
						// MacroIn?: new MOS.MosString128(),
						// MacroOut?: new MOS.MosString128(),
						// MosExternalMetaData?: Array<IMOSExternalMetaData>
					})
				]
			}),
			literal<MOS.IMOSROStory>({
				ID: new MOS.MosString128('3854737F:0003A34D:983A0B28'),
				Slug: new MOS.MosString128('AIRLINE INSPECTIONS'),
				Number: new MOS.MosString128('A6'),
				// MosExternalMetaData: Array<IMOSExternalMetaData>
				Items: [
					literal<MOS.IMOSItem>({
						ID: new MOS.MosString128('0'),
						// Slug: new MOS.MosString128(''),
						ObjectID: new MOS.MosString128('M000133'),
						MOSID: 'testmos.enps.com',
						// mosAbstract?: '',
						// Channel?: new MOS.MosString128(),
						EditorialStart: 55,
						EditorialDuration: 310,
						UserTimingDuration: 200
						// Trigger: 'CHAINED' // TODO: Johan frågar
						// MacroIn?: new MOS.MosString128(),
						// MacroOut?: new MOS.MosString128(),
						// MosExternalMetaData?: Array<IMOSExternalMetaData>
					})
				]
			})
		]
	}),
	'roReplace':  literal<MOS.IMOSRunningOrder>({
		ID: new MOS.MosString128('96857485'),
		Slug: new MOS.MosString128('5PM RUNDOWN'),
		// DefaultChannel?: MOS.MosString128,
		// EditorialStart: new MOS.MosTime('2009-04-17T17:02:00'),
		// EditorialDuration: '00:58:25', // @todo: change this into a real Duration
		// Trigger?: any // TODO: Johan frågar vad denna gör,
		// MacroIn?: MOS.MosString128,
		// MacroOut?: MOS.MosString128,
		// MosExternalMetaData?: Array<IMOSExternalMetaData>,
		Stories: [
			literal<MOS.IMOSROStory>({
				ID: new MOS.MosString128('5983A501:0049B924:8390EF2B'),
				Slug: new MOS.MosString128('COLSTAT MURDER'),
				Number: new MOS.MosString128('A1'),
				// MosExternalMetaData: Array<IMOSExternalMetaData>
				Items: [
					literal<MOS.IMOSItem>({
						ID: new MOS.MosString128('0'),
						Slug: new MOS.MosString128('OLSTAT MURDER:VO'),
						ObjectID: new MOS.MosString128('M000224'),
						MOSID: 'testmos.enps.com',
						// mosAbstract?: '',
						Paths: [
							literal<MOS.IMOSObjectPath>({Type: MOS.IMOSObjectPathType.PATH, Description: 'MPEG2 Video', Target: '\\server\media\clip392028cd2320s0d.mxf'}),
							literal<MOS.IMOSObjectPath>({Type: MOS.IMOSObjectPathType.PROXY_PATH, Description: 'WM9 750Kbps', Target: 'http://server/proxy/clipe.wmv'}),
							literal<MOS.IMOSObjectPath>({Type: MOS.IMOSObjectPathType.METADATA_PATH, Description: 'MOS Object', Target: 'http://server/proxy/clipe.xml'})
						],
						// Channel?: new MOS.MosString128(),
						// EditorialStart?: MOS.MosTime
						EditorialDuration: 645,
						UserTimingDuration: 310,
						Trigger: 'CHAINED' // TODO: Johan frågar
						// MacroIn?: new MOS.MosString128(),
						// MacroOut?: new MOS.MosString128(),
						// MosExternalMetaData?: Array<IMOSExternalMetaData>
					})
				]
			}),
			literal<MOS.IMOSROStory>({
				ID: new MOS.MosString128('3852737F:0013A64D:923A0B28'),
				Slug: new MOS.MosString128('AIRLINE SAFETY'),
				Number: new MOS.MosString128('A2'),
				// MosExternalMetaData: Array<IMOSExternalMetaData>
				Items: [
					literal<MOS.IMOSItem>({
						ID: new MOS.MosString128('0'),
						// Slug: new MOS.MosString128(''),
						ObjectID: new MOS.MosString128('M000295'),
						MOSID: 'testmos.enps.com',
						// mosAbstract?: '',
						// Channel?: new MOS.MosString128(),
						EditorialStart: 500,
						EditorialDuration: 600,
						UserTimingDuration: 310
						// Trigger: 'CHAINED' // TODO: Johan frågar
						// MacroIn?: new MOS.MosString128(),
						// MacroOut?: new MOS.MosString128(),
						// MosExternalMetaData?: Array<IMOSExternalMetaData>
					})
				]
			})
		]
	}),
	'roDelete':  49478285,
	'roList':  literal<MOS.IMOSObject>({
		ID: new MOS.MosString128('M000123'),
		Slug: new MOS.MosString128('Hotel Fire'),
		// MosAbstract: string,
		Group: 'Show 7',
		Type: MOS.IMOSObjectType.VIDEO,
		TimeBase: 59.94,
		Revision: 1,
		Duration: 1800,
		Status: MOS.IMOSObjectStatus.NEW,
		AirStatus: MOS.IMOSObjectAirStatus.READY,
		Paths: [
			{Type: MOS.IMOSObjectPathType.PATH, Description: 'MPEG2 Video', Target: '\\server\media\clip392028cd2320s0d.mxf'},
			{Type: MOS.IMOSObjectPathType.PROXY_PATH, Description: 'WM9 750Kbps', Target: 'http://server/proxy/clipe.wmv'},
			{Type: MOS.IMOSObjectPathType.METADATA_PATH, Description: 'MOS Object', Target: 'http://server/proxy/clipe.xml'}
		],
		CreatedBy: new MOS.MosString128('Chris'),
		Created: new MOS.MosTime('2009-10-31T23:39:12'),
		ChangedBy: new MOS.MosString128('Chris'),
		Changed: new MOS.MosTime('2009-10-31T23:39:12')
		// Description: string
		// mosExternalMetaData?: Array<IMOSExternalMetaData>
	}),
	'roMetadataReplace':  literal<MOS.IMOSRunningOrderBase>({
		ID: new MOS.MosString128('96857485'),
		Slug: new MOS.MosString128('5PM RUNDOWN'),
		// DefaultChannel?: new MOS.MosString128(''),
		EditorialStart: new MOS.MosTime('2009-04-17T17:02:00'),
		EditorialDuration: new MOS.MosDuration('00:58:25')
		// Trigger?: any // TODO: Johan frågar vad denna gör
		// MacroIn?: new MOS.MosString128(''),
		// MacroOut?: new MOS.MosString128(''),
		// MosExternalMetaData?: Array<IMOSExternalMetaData>
	}),
	'roElementStat_ro':  literal<MOS.IMOSRunningOrderStatus>({
		ID: new MOS.MosString128('5PM'),
		Status: MOS.IMOSObjectStatus.MANUAL_CTRL,
		Time: new MOS.MosTime('2009-04-11T14:13:53')
	}),
	'roElementStat_story':  literal<MOS.IMOSStoryStatus>({
		RunningOrderId: new MOS.MosString128('5PM'),
		ID: new MOS.MosString128('HOTEL FIRE'),
		Status: MOS.IMOSObjectStatus.PLAY,
		Time: new MOS.MosTime('1999-04-11T14:13:53')
	}),
	'roElementStat_item':  literal<MOS.IMOSItemStatus>({
		RunningOrderId: new MOS.MosString128('5PM'),
		StoryId: new MOS.MosString128('HOTEL FIRE '),
		ID: new MOS.MosString128('0'),
		ObjectId: new MOS.MosString128('A0295'),
		Channel: new MOS.MosString128('B'),
		Status: MOS.IMOSObjectStatus.PLAY,
		Time: new MOS.MosTime('2009-04-11T14:13:53')
	}),
	'roReadyToAir':  literal<MOS.IMOSROReadyToAir>({
		ID: new MOS.MosString128('5PM'),
		Status: MOS.IMOSObjectAirStatus.READY
	}),
	'roElementAction_insert_story_Action':  literal<MOS.IMOSStoryAction>({
		RunningOrderID: new MOS.MosString128('5PM'),
		StoryID: new MOS.MosString128('2')
	}),
	'roElementAction_insert_story_Stories':  [
		literal<MOS.IMOSROStory>({
			ID: new MOS.MosString128('17'),
			Slug: new MOS.MosString128('Barcelona Football'),
			Number: new MOS.MosString128('A2'),
			// MosExternalMetaData?: Array<IMOSExternalMetaData>,
			Items: [
				literal<MOS.IMOSItem>({
					ID: new MOS.MosString128('27'),
					// Slug?: new MOS.MosString128(''),
					ObjectID: new MOS.MosString128('M73627'),
					MOSID: 'testmos',
					// mosAbstract?: '',
					Paths: [
						{Type: MOS.IMOSObjectPathType.PATH, Description: 'MPEG2 Video', Target: '\\server\media\clip392028cd2320s0d.mxf'},
						{Type: MOS.IMOSObjectPathType.PROXY_PATH, Description: 'WM9 750Kbps', Target: 'http://server/proxy/clipe.wmv'},
						{Type: MOS.IMOSObjectPathType.METADATA_PATH, Description: 'MOS Object', Target: 'http://server/proxy/clipe.xml'}
					],
					EditorialStart: 0,
					EditorialDuration: 715,
					UserTimingDuration: 415
				}),
				literal<MOS.IMOSItem>({
					ID: new MOS.MosString128('28'),
					ObjectID: new MOS.MosString128('M73628'),
					MOSID: 'testmos',
					// mosAbstract?: '',
					EditorialStart: 0,
					EditorialDuration: 315
				})
			]
		})
	],
	'roElementAction_insert_item_Action':  literal<MOS.IMOSItemAction>({
		RunningOrderID: new MOS.MosString128('5PM'),
		StoryID: new MOS.MosString128('2'),
		ItemID: new MOS.MosString128('23')
	}),
	'roElementAction_insert_item_Items':  [
		literal<MOS.IMOSItem>({
			ID: new MOS.MosString128('27'),
			Slug: new MOS.MosString128('NHL PKG'),
			ObjectID: new MOS.MosString128('M19873'),
			MOSID: 'testmos',
			Paths: [
				{Type: MOS.IMOSObjectPathType.PATH, Description: 'MPEG2 Video', Target: '\\server\media\clip392028cd2320s0d.mxf'},
				{Type: MOS.IMOSObjectPathType.PROXY_PATH, Description: 'WM9 750Kbps', Target: 'http://server/proxy/clipe.wmv'},
				{Type: MOS.IMOSObjectPathType.METADATA_PATH, Description: 'MOS Object', Target: 'http://server/proxy/clipe.xml'}
			],
			EditorialStart: 0,
			EditorialDuration: 700,
			UserTimingDuration: 690
		})
	],
	'roElementAction_replace_story_Action':  literal<MOS.IMOSStoryAction>({
		RunningOrderID: new MOS.MosString128('5PM'),
		StoryID: new MOS.MosString128('2')
	}),
	'roElementAction_replace_story_Stories':  [
		literal<MOS.IMOSROStory>({
			ID: new MOS.MosString128('17'),
			Slug: new MOS.MosString128('Porto Football'),
			Number: new MOS.MosString128('A2'),
			// MosExternalMetaData?: Array<IMOSExternalMetaData>,
			Items: [
				literal<MOS.IMOSItem>({
					ID: new MOS.MosString128('27'),
					// Slug?: new MOS.MosString128(''),
					ObjectID: new MOS.MosString128('M73627'),
					MOSID: 'testmos',
					// mosAbstract?: '',
					Paths: [
						{Type: MOS.IMOSObjectPathType.PATH, Description: 'MPEG2 Video', Target: '\\server\media\clip392028cd2320s0d.mxf'},
						{Type: MOS.IMOSObjectPathType.PROXY_PATH, Description: 'WM9 750Kbps', Target: 'http://server/proxy/clipe.wmv'},
						{Type: MOS.IMOSObjectPathType.METADATA_PATH, Description: 'MOS Object', Target: 'http://server/proxy/clipe.xml'}
					],
					EditorialStart: 0,
					EditorialDuration: 715,
					UserTimingDuration: 415
				}),
				literal<MOS.IMOSItem>({
					ID: new MOS.MosString128('28'),
					ObjectID: new MOS.MosString128('M73628'),
					MOSID: 'testmos',
					// mosAbstract?: '',
					EditorialStart: 0,
					EditorialDuration: 315
				})
			]
		})
	],
	'roElementAction_replace_item_Action':  literal<MOS.IMOSItemAction>({
		RunningOrderID: new MOS.MosString128('5PM'),
		StoryID: new MOS.MosString128('2'),
		ItemID: new MOS.MosString128('23')
	}),
	'roElementAction_replace_item_Items':  [
		literal<MOS.IMOSItem>({
			ID: new MOS.MosString128('27'),
			Slug: new MOS.MosString128('NHL PKG'),
			ObjectID: new MOS.MosString128('M19873'),
			MOSID: 'testmos',
			Paths: [
				{Type: MOS.IMOSObjectPathType.PATH, Description: 'MPEG2 Video', Target: '\\server\media\clip392028cd2320s0d.mxf'},
				{Type: MOS.IMOSObjectPathType.PROXY_PATH, Description: 'WM9 750Kbps', Target: 'http://server/proxy/clipe.wmv'},
				{Type: MOS.IMOSObjectPathType.METADATA_PATH, Description: 'MOS Object', Target: 'http://server/proxy/clipe.xml'}
			],
			EditorialStart: 0,
			EditorialDuration: 700,
			UserTimingDuration: 690
		})
	],
	'roElementAction_move_story_Action':  literal<MOS.IMOSStoryAction>({
		RunningOrderID: new MOS.MosString128('5PM'),
		StoryID: new MOS.MosString128('2')
	}),
	'roElementAction_move_story_Stories':  [
		new MOS.MosString128('7')
	],
	'roElementAction_move_stories_Action':  literal<MOS.IMOSStoryAction>({
		RunningOrderID: new MOS.MosString128('5PM'),
		StoryID: new MOS.MosString128('2')
	}),
	'roElementAction_move_stories_Stories':  [
		new MOS.MosString128('7'),
		new MOS.MosString128('12')
	],
	'roElementAction_move_items_Action':  literal<MOS.IMOSItemAction>({
		RunningOrderID: new MOS.MosString128('5PM'),
		StoryID: new MOS.MosString128('2'),
		ItemID: new MOS.MosString128('12')
	}),
	'roElementAction_move_items_Items':  [
		new MOS.MosString128('23'),
		new MOS.MosString128('24')
	],
	'roElementAction_delete_story_Action':  literal<MOS.IMOSROAction>({
		RunningOrderID: new MOS.MosString128('5PM')
	}),
	'roElementAction_delete_story_Stories':  [
		new MOS.MosString128('3')
	],
	'roElementAction_delete_items_Action':  literal<MOS.IMOSStoryAction>({
		RunningOrderID: new MOS.MosString128('5PM'),
		StoryID: new MOS.MosString128('2')
	}),
	'roElementAction_delete_items_Items':  [
		new MOS.MosString128('23'),
		new MOS.MosString128('24')
	],
	'roElementAction_swap_stories_Action':  literal<MOS.IMOSROAction>({
		RunningOrderID: new MOS.MosString128('5PM')
	}),
	'roElementAction_swap_stories_StoryId0':  new MOS.MosString128('3'),
	'roElementAction_swap_stories_StoryId1':  new MOS.MosString128('5'),
	'roElementAction_swap_items_Action':  literal<MOS.IMOSStoryAction>({
		RunningOrderID: new MOS.MosString128('5PM'),
		StoryID: new MOS.MosString128('2')
	}),
	'roElementAction_swap_items_ItemId0':  new MOS.MosString128('23'),
	'roElementAction_swap_items_ItemId1':  new MOS.MosString128('24')
}

describe('peripheralDevice: general API methods', function () {

	beforeEach(function () {
		StubCollections.stub(PeripheralDevices)
	})

	afterEach(function () {
		StubCollections.restore()
	})

	it('peripheralDevice.initialize()', function () {

		let deviceId = Random.id()
		let token = Random.id()
		let options: PeripheralDeviceAPI.InitOptions = {
			type: 0,
			name: 'test',
			connectionId: 'test'
		}

		let returnedId = ServerPeripheralDeviceAPI.initialize(deviceId, token, options)

		expect(deviceId).to.equal(returnedId)

		// check that there is an object
		let md = PeripheralDevices.findOne(deviceId)

		expect(md).to.be.an('object')
		if (md) {
			expect(md).to.have.property('_id')
			expect(md._id).to.be.equal(deviceId)
			expect(md.created).to.be.closeTo(getCurrentTime(), 1000)
		}

	})

	it('peripheralDevice.setStatus()', function () {

		let deviceId = Random.id()
		let token = Random.id()
		let options: PeripheralDeviceAPI.InitOptions = {
			type: 0,
			name: 'test',
			connectionId: 'test'
		}

		let returnedId = ServerPeripheralDeviceAPI.initialize(deviceId, token, options)

		let returnedStatus = ServerPeripheralDeviceAPI.setStatus(deviceId, token, {
			statusCode: PeripheralDeviceAPI.StatusCode.GOOD,
			messages: ["It's all good"]
		})

		// check that there is an object
		let pd = PeripheralDevices.findOne(deviceId)
		expect(pd).to.be.an('object')
		if (pd) {
			// Check object status:
			expect(pd.status).to.be.an('object')
			expect(pd.status.statusCode).to.be.equal(PeripheralDeviceAPI.StatusCode.GOOD)
			expect(pd.status.messages).to.have.length(1)
		}
	})

	it('peripheralDevice.initialize() with bad arguments', async function () {
		let deviceId = Random.id()
		let token = Random.id()

		let options: PeripheralDeviceAPI.InitOptions = {
			type: 0,
			name: 'test',
			connectionId: 'test'
		}

		expect(() => {
			return ServerPeripheralDeviceAPI.initialize('', token, options) // missing id
		}).to.throw()

		expect(() => {
			return ServerPeripheralDeviceAPI.initialize(deviceId, '', options) // missing token
		}).to.throw()

		expect(() => {

			return ServerPeripheralDeviceAPI.initialize(deviceId, token, null as any) // missing options
		}).to.throw()

		expect(() => {

			return ServerPeripheralDeviceAPI.initialize(deviceId, token, {} as any) // bad options
		}).to.throw()
	})

	it('peripheralDevice.setStatus() with bad arguments', async function () {
		let deviceId = Random.id()
		let token = Random.id()
		let options: PeripheralDeviceAPI.InitOptions = {
			type: 0,
			name: 'test',
			connectionId: 'test'
		}

		expect(() => {
			return ServerPeripheralDeviceAPI.setStatus(deviceId, token, {
				statusCode: PeripheralDeviceAPI.StatusCode.GOOD
			})
		}).to.throw() // because device is not initialized yet

		let returnedId = ServerPeripheralDeviceAPI.initialize(deviceId, token, options)

		expect(() => {
			return ServerPeripheralDeviceAPI.setStatus(deviceId, token, {
				statusCode: PeripheralDeviceAPI.StatusCode.GOOD
			})
		}).to.not.throw()

		// try with bad arguments:
		expect(() => {
			return ServerPeripheralDeviceAPI.setStatus(deviceId, token, {} as any ) // missing statusCode
		}).to.throw()

		expect(() => {
			return ServerPeripheralDeviceAPI.setStatus(deviceId, token, null as any) // missing status
		}).to.throw()

		expect(() => {
			return ServerPeripheralDeviceAPI.setStatus(deviceId, '', { // missing token
				statusCode: PeripheralDeviceAPI.StatusCode.GOOD
			})
		}).to.throw()

		expect(() => {
			return ServerPeripheralDeviceAPI.setStatus('', token, { // missing id
				statusCode: PeripheralDeviceAPI.StatusCode.GOOD
			})
		}).to.throw()

	})
})

describe('peripheralDevice: MOS Basic functions', function () {

	beforeEach(function () {
		StubCollections.stub(RunningOrders)
		StubCollections.stub(Segments)
		StubCollections.stub(SegmentLines)
		StubCollections.stub(SegmentLineItems)

		let roID = roId(new MOS.MosString128('ro0'))
		// Prepare database:
		RunningOrders.insert({
			_id: roID,
			mosId: 'ro0',
			studioInstallationId: 'studio0',
			showStyleBaseId: 'showStyle0',
			showStyleVariantId: 'variant0',
			name: 'test ro',
			created: 1000,
			currentSegmentLineId: null,
			nextSegmentLineId: null,
			previousSegmentLineId: null,
			dataSource: 'mock',
			peripheralDeviceId: 'testMosDevice',
			modified: getCurrentTime(),
		})
		let segmentID = segmentId(roID, '', 0)
		Segments.insert({
			_id: segmentID,
			_rank: 0,
			mosId: 'segment00',
			runningOrderId: roID,
			name: 'Fire',
			number: ''
		})
		SegmentLines.insert({
			_id: segmentLineId(segmentID, new MOS.MosString128('segmentLine000')),
			_rank: 0,
			mosId: 'segmentLine000',
			segmentId: segmentID,
			runningOrderId: roID,
			slug: ''
		})
		SegmentLines.insert({
			_id: segmentLineId(segmentID, new MOS.MosString128('segmentLine001')),
			_rank: 1,
			mosId: 'segmentLine001',
			segmentId: segmentID,
			runningOrderId: roID,
			slug: ''
		})
		Segments.insert({
			number: '',
			_id: segmentId(roID, '', 1),
			_rank: 1,
			mosId: 'segment01',
			runningOrderId: roID,
			name: 'Water'
		})
		Segments.insert({
			number: '',
			_id: segmentId(roID, '', 2),
			_rank: 2,
			mosId: 'segment02',
			runningOrderId: roID,
			name: 'Earth'
		})
		roID = roId(new MOS.MosString128('ro1'))
		RunningOrders.insert({
			_id: roID,
			mosId: 'ro1',
			studioInstallationId: 'studio0',
			showStyleBaseId: 'showStyle1',
			showStyleVariantId: 'variant0',
			name: 'test ro 1',
			created: 2000,
			currentSegmentLineId: null,
			nextSegmentLineId: null,
			previousSegmentLineId: null,
			dataSource: 'mock',
			peripheralDeviceId: 'testMosDevice',
			modified: getCurrentTime(),
		})
		Segments.insert({
			number: '',
			_id: segmentId(roID, '', 10),
			_rank: 0,
			mosId: 'segment10',
			runningOrderId: roID,
			name: 'Fire'
		})
		RunningOrders.insert({
			_id: roId(new MOS.MosString128('ro2')),
			mosId: 'ro2',
			studioInstallationId: 'studio0',
			showStyleBaseId: 'showStyle1',
			showStyleVariantId: 'variant0',
			name: 'test ro 2',
			created: 2000,
			currentSegmentLineId: null,
			nextSegmentLineId: null,
			previousSegmentLineId: null,
			dataSource: 'mock',
			peripheralDeviceId: 'testMosDevice',
			modified: getCurrentTime(),
		})
	})

	afterEach(function () {
		StubCollections.restore()
	})
	it('getRO', function () {
		let ro = getRO(new MOS.MosString128('ro1'))

		expect(ro).to.be.an('object')
		expect(ro._id).to.be.equal('ro_ro1')
		expect(ro.mosId).to.be.equal('ro1')

		expect(() => {
			let ro = getRO(new MOS.MosString128('unknown'))
		}).to.throw()
	})
	it('getSegment', function () {
		let segment = getSegment(new MOS.MosString128('ro1'), new MOS.MosString128('segment10'))

		expect(segment).to.be.an('object')
		expect(segment._id).to.be.equal('ro_ro1_segment10')
		expect(segment.mosId).to.be.equal('segment10')

		expect(() => {
			let segment = getSegment(new MOS.MosString128('ro0'), new MOS.MosString128('unknown'))
		}).to.throw()

		expect(() => {
			let segment = getSegment(new MOS.MosString128('unknown'), new MOS.MosString128('segment00'))
		}).to.throw()
	})
	it('getSegmentLine', function () {
		let segmentLine = getSegmentLine(
			new MOS.MosString128('ro0'),
			new MOS.MosString128('segment00'),
			new MOS.MosString128('segmentLine000')
		)

		expect(segmentLine).to.be.an('object')
		expect(segmentLine._id).to.be.equal('ro_ro0_segment00_segmentLine000')
		expect(segmentLine.mosId).to.be.equal('segmentLine000')

		expect(() => {
			let segmentLine = getSegmentLine(new MOS.MosString128('ro0'), new MOS.MosString128('segment00'), new MOS.MosString128('unknown'))
		}).to.throw()

		expect(() => {
			let segmentLine = getSegmentLine(new MOS.MosString128('ro0'), new MOS.MosString128('unknown'), new MOS.MosString128('segmentLine000'))
		}).to.throw()

		expect(() => {
			let segmentLine = getSegmentLine(new MOS.MosString128('unknown'), new MOS.MosString128('segment00'), new MOS.MosString128('segmentLine000'))
		}).to.throw()
	})
	it('convertToSegment', function () {

		let story = xmlApiData.roElementAction_insert_story_Stories[0]
		let segment = convertToSegment(story, 'ro_ro0', 123)

		expect(segment).to.be.an('object')
		expect(segment.mosId).to.equal(story.ID.toString())
		expect(segment.runningOrderId).to.equal('ro_ro0')
		expect(segment._rank).to.equal(123)
	})
	it('convertToSegmentLine', function () {

		let item = xmlApiData.roElementAction_insert_item_Items[0]
		let segmentLine = convertToSegmentLine(item, 'ro_ro0', 'segment00', 123)

		expect(segmentLine).to.be.an('object')
		expect(segmentLine.mosId).to.equal(item.ID.toString())
		expect(segmentLine.runningOrderId).to.equal('ro_ro0')
		expect(segmentLine.segmentId).to.equal('segment00')
		expect(segmentLine._rank).to.equal(123)
	})
	it('insertSegment', function () {
		let story = xmlApiData.roElementAction_insert_story_Stories[0]
		let roID = 'ro_ro0'
		insertSegment(story, roID, 123)

		let dbSegment = Segments.findOne(segmentId(roID, '', story.ID))

		expect(dbSegment).to.be.an('object')
		expect(dbSegment.mosId).to.equal(story.ID.toString())
		expect(dbSegment._rank).to.equal(123)
		expect(dbSegment.runningOrderId).to.equal('ro_ro0')

		let dbSegmentLines = SegmentLines.find({
			runningOrderId: dbSegment.runningOrderId,
			segmentId: dbSegment._id
		},mod).fetch()

		expect(dbSegmentLines).to.have.length(story.Items.length)

		expect(dbSegmentLines[0]._id).to.equal( segmentLineId(dbSegment._id, story.Items[0].ID))
	})
	it('removeSegment', function () {
		let dbSegment = Segments.findOne(segmentId('ro_ro0','',  new MOS.MosString128('segment00')))
		expect(dbSegment).to.be.an('object')
		expect(dbSegment.mosId).to.equal('segment00')
		expect(dbSegment.runningOrderId).to.equal('ro_ro0')
		expect(
			SegmentLines.find({segmentId: dbSegment._id}).fetch().length
		).to.be.greaterThan(0)

		removeSegment( dbSegment._id, dbSegment.runningOrderId)

		expect(Segments.find(dbSegment._id).fetch()).to.have.length(0)
		expect(
			SegmentLines.find({segmentId: dbSegment._id}).fetch()
		).to.have.length(0)
	})
	it('fetchBefore & fetchAfter', function () {
		let segment00 = Segments.findOne(segmentId('ro_ro0','',  new MOS.MosString128('segment00')))
		let segment00Before = fetchBefore(Segments, { runningOrderId: segment00.runningOrderId}, segment00._rank)
		let segment00After = fetchAfter(Segments, { runningOrderId: segment00.runningOrderId}, segment00._rank)

		expect(segment00Before).to.equal(undefined)
		expect(segment00After).to.be.an('object')
		expect(segment00After.mosId).to.equal('segment01')

		let segment01 = Segments.findOne(segmentId('ro_ro0','',  new MOS.MosString128('segment01')))
		let segment01Before = fetchBefore(Segments, { runningOrderId: segment01.runningOrderId}, segment01._rank)
		let segment01After = fetchAfter(Segments, { runningOrderId: segment01.runningOrderId}, segment01._rank)

		expect(segment01Before).to.be.an('object')
		expect(segment01Before.mosId).to.equal('segment00')
		expect(segment01After).to.be.an('object')
		expect(segment01After.mosId).to.equal('segment02')

		let segment02 = Segments.findOne(segmentId('ro_ro0','',  new MOS.MosString128('segment02')))
		let segment02Before = fetchBefore(Segments, { runningOrderId: segment02.runningOrderId}, segment02._rank)
		let segment02After = fetchAfter(Segments, { runningOrderId: segment02.runningOrderId}, segment02._rank)

		expect(segment02Before).to.be.an('object')
		expect(segment02Before.mosId).to.equal('segment01')
		expect(segment02After).to.equal(undefined)
	})
	it('getRank', function () {

		let before = {_rank: 10}
		let after = {_rank: 22}

		// insert 1 in between
		expect(getRank(before, after, 0, 1)).to.equal(16)
		// insert 2 in between
		expect(getRank(before, after, 0, 2)).to.equal(14)
		expect(getRank(before, after, 1, 2)).to.equal(18)
		// insert 3 in between
		expect(getRank(before, after, 0, 3)).to.equal(13)
		expect(getRank(before, after, 1, 3)).to.equal(16)
		expect(getRank(before, after, 2, 3)).to.equal(19)
		// insert 1 first
		expect(getRank(null, before, 0, 1)).to.be.lessThan(10)
		// insert 2 first
		expect(getRank(null, before, 0, 2)).to.be.lessThan(10)
		expect(getRank(null, before, 1, 2)).to.be.lessThan(10)
		// insert 1 last
		expect(getRank(after, null, 0, 1)).to.be.greaterThan(22)
		// insert 2 last
		expect(getRank(after, null, 0, 2)).to.be.greaterThan(22)
		expect(getRank(after, null, 1, 2)).to.be.greaterThan(22)
	})
})
describe('peripheralDevice: MOS API methods', function () {
	beforeEach(function () {
		StubCollections.stub(RunningOrders)
		StubCollections.stub(Segments)
		StubCollections.stub(SegmentLines)
		StubCollections.stub(SegmentLineItems)
	})
	afterEach(function () {
		StubCollections.restore()
	})
	it('mosRoCreate', function () {
		// Test data:
		let ro = xmlApiData.roCreate
		let story = ro.Stories[0]
		let item = story.Items[0]

		ServerPeripheralDeviceAPI.mosRoCreate(ro)

		let dbRo = RunningOrders.findOne(roId(ro.ID))
		expect(dbRo).to.be.an('object')
		expect(dbRo.mosId).to.equal(ro.ID.toString())
		expect(dbRo.name).to.equal(ro.Slug.toString())

		let dbSegments = Segments.find({
			runningOrderId: dbRo._id
		}, mod).fetch()
		expect(dbSegments).to.have.length(ro.Stories.length)
		let dbSegment = dbSegments[0]
		expect(dbSegment.mosId).to.equal(story.ID.toString())

		let dbSegmentLines = SegmentLines.find({
			runningOrderId: dbRo._id,
			segmentId: dbSegment._id
		}, mod).fetch()
		expect(dbSegmentLines).to.have.length(story.Items.length)
		let dbSegmentLine = dbSegmentLines[0]
		expect(dbSegmentLine.mosId).to.equal(item.ID.toString())
	})
	it('mosRoDelete', function () {
		// Test data:
		let ro = xmlApiData.roCreate
		let story = ro.Stories[0]
		let item = story.Items[0]

		let roID = roId(ro.ID)
		// first create:
		ServerPeripheralDeviceAPI.mosRoCreate(ro)
		expect(RunningOrders.find(roID).fetch()).to.have.length(1)
		// Then delete:
		ServerPeripheralDeviceAPI.mosRoDelete(ro.ID)

		expect(RunningOrders.find(roID).fetch()).to.have.length(0)
		expect(Segments.find({
			runningOrderId: roID
		}).fetch()).to.have.length(0)
		expect(SegmentLines.find({
			runningOrderId: roID
		}).fetch()).to.have.length(0)
		expect(SegmentLineItems.find({
			runningOrderId: roID
		}).fetch()).to.have.length(0)
	})
	it('mosRoMetadata', function () {
		// Test data:
		let ro = xmlApiData.roCreate
		let md = xmlApiData.roMetadataReplace

		// first create the ro:
		ServerPeripheralDeviceAPI.mosRoCreate(ro)
		// Then delete:
		ServerPeripheralDeviceAPI.mosRoMetadata(md)

		let dbRo = RunningOrders.findOne(roId(ro.ID))
		expect(dbRo).to.be.an('object')
		expect(dbRo.mosId).to.equal(ro.ID.toString())
		// expect(dbRo.metaData).to.be.an('object')
		// TODO: Make a test (and testdata?) for this?

	})
	it('mosRoStatus', function () {
		// Test data:
		let ro = xmlApiData.roCreate
		let status0: MOS.IMOSRunningOrderStatus = {
			ID: ro.ID,
			Status: MOS.IMOSObjectStatus.MANUAL_CTRL,
			Time: new MOS.MosTime('2009-04-11T14:13:53')
		}
		let status1: MOS.IMOSRunningOrderStatus = {
			ID: ro.ID,
			Status: MOS.IMOSObjectStatus.READY,
			Time: new MOS.MosTime('2009-04-11T14:13:53')
		}
		let statusUnknown: MOS.IMOSRunningOrderStatus = {
			ID: new MOS.MosString128('unknown'),
			Status: MOS.IMOSObjectStatus.MOVED,
			Time: new MOS.MosTime('2009-04-11T14:13:53')
		}
		// first create the ro:
		ServerPeripheralDeviceAPI.mosRoCreate(ro)
		// Set status:
		ServerPeripheralDeviceAPI.mosRoStatus(status0)
		expect(RunningOrders.findOne(roId(ro.ID)).status).to.be.equal(status0.Status)
		ServerPeripheralDeviceAPI.mosRoStatus(status1)
		expect(RunningOrders.findOne(roId(ro.ID)).status).to.be.equal(status1.Status)
		expect(() => {
			ServerPeripheralDeviceAPI.mosRoStatus(statusUnknown)
		}).to.throw(/404/)
		expect(RunningOrders.findOne(roId(ro.ID)).status).to.be.equal(status1.Status) // keep the previous status
	})
	it('mosRoStoryStatus', function () {
		// Test data:
		let ro = xmlApiData.roCreate
		let story = ro.Stories[0]
		let status0: MOS.IMOSStoryStatus = {
			ID: story.ID,
			RunningOrderId: ro.ID,
			Status: MOS.IMOSObjectStatus.MANUAL_CTRL,
			Time: new MOS.MosTime('2009-04-11T14:13:53')
		}
		let status1: MOS.IMOSStoryStatus = {
			ID: story.ID,
			RunningOrderId: ro.ID,
			Status: MOS.IMOSObjectStatus.READY,
			Time: new MOS.MosTime('2009-04-11T14:13:53')
		}
		let statusUnknown0: MOS.IMOSStoryStatus = {
			ID: new MOS.MosString128('unknown'),
			RunningOrderId: ro.ID,
			Status: MOS.IMOSObjectStatus.NOT_READY,
			Time: new MOS.MosTime('2009-04-11T14:13:53')
		}
		let statusUnknown1: MOS.IMOSStoryStatus = {
			ID: story.ID,
			RunningOrderId: new MOS.MosString128('unknown'),
			Status: MOS.IMOSObjectStatus.UPDATED,
			Time: new MOS.MosTime('2009-04-11T14:13:53')
		}
		let segmentID = segmentId(roId(ro.ID), story.ID)
		// first create the ro:
		ServerPeripheralDeviceAPI.mosRoCreate(ro)
		// Set status:
		ServerPeripheralDeviceAPI.mosRoStoryStatus(status0)
		expect(Segments.findOne(segmentID).status).to.be.equal(status0.Status)
		ServerPeripheralDeviceAPI.mosRoStoryStatus(status1)
		expect(Segments.findOne(segmentID).status).to.be.equal(status1.Status)
		expect(() => {
			ServerPeripheralDeviceAPI.mosRoStoryStatus(statusUnknown0)
		}).to.throw(/404/)
		expect(Segments.findOne(segmentID).status).to.be.equal(status1.Status) // keep the previous status
		expect(() => {
			ServerPeripheralDeviceAPI.mosRoStoryStatus(statusUnknown1)
		}).to.throw(/404/)
		expect(Segments.findOne(segmentID).status).to.be.equal(status1.Status) // keep the previous status
	})
	it('mosRoItemStatus', function () {
		// Test data:
		let ro = xmlApiData.roCreate
		let story = ro.Stories[0]
		let item = story.Items[0]

		let status0: MOS.IMOSItemStatus = {
			ID: item.ID,
			StoryId: story.ID,
			RunningOrderId: ro.ID,
			Status: MOS.IMOSObjectStatus.MANUAL_CTRL,
			Time: new MOS.MosTime('2009-04-11T14:13:53')
		}
		let status1: MOS.IMOSItemStatus = {
			ID: item.ID,
			RunningOrderId: ro.ID,
			StoryId: story.ID,
			Status: MOS.IMOSObjectStatus.READY,
			Time: new MOS.MosTime('2009-04-11T14:13:53')
		}
		let statusUnknown0: MOS.IMOSItemStatus = {
			ID: new MOS.MosString128('unknown'),
			RunningOrderId: ro.ID,
			StoryId: story.ID,
			Status: MOS.IMOSObjectStatus.NOT_READY,
			Time: new MOS.MosTime('2009-04-11T14:13:53')
		}
		let statusUnknown1: MOS.IMOSItemStatus = {
			ID: item.ID,
			StoryId: new MOS.MosString128('unknown'),
			RunningOrderId: ro.ID,
			Status: MOS.IMOSObjectStatus.UPDATED,
			Time: new MOS.MosTime('2009-04-11T14:13:53')
		}
		let statusUnknown2: MOS.IMOSItemStatus = {
			ID: item.ID,
			StoryId: story.ID,
			RunningOrderId: new MOS.MosString128('unknown'),
			Status: MOS.IMOSObjectStatus.BUSY,
			Time: new MOS.MosTime('2009-04-11T14:13:53')
		}
		let segmentID = segmentId(roId(ro.ID), story.ID)
		let segmentLineID = segmentLineId(segmentID, item.ID)
		// first create the ro:
		ServerPeripheralDeviceAPI.mosRoCreate(ro)
		// Set status:
		ServerPeripheralDeviceAPI.mosRoItemStatus(status0)
		expect(SegmentLines.findOne(segmentLineID).status).to.be.equal(status0.Status)
		ServerPeripheralDeviceAPI.mosRoItemStatus(status1)
		expect(SegmentLines.findOne(segmentLineID).status).to.be.equal(status1.Status)
		expect(() => {
			ServerPeripheralDeviceAPI.mosRoItemStatus(statusUnknown0)
		}).to.throw(/404/)
		expect(SegmentLines.findOne(segmentLineID).status).to.be.equal(status1.Status) // keep the previous status
		expect(() => {
			ServerPeripheralDeviceAPI.mosRoItemStatus(statusUnknown1)
		}).to.throw(/404/)
		expect(SegmentLines.findOne(segmentLineID).status).to.be.equal(status1.Status) // keep the previous status
		expect(() => {
			ServerPeripheralDeviceAPI.mosRoItemStatus(statusUnknown2)
		}).to.throw(/404/)
		expect(SegmentLines.findOne(segmentLineID).status).to.be.equal(status1.Status) // keep the previous status
	})
	it('mosRoStoryInsert', function () {
		// Test data:
		let ro = xmlApiData.roCreate
		let story0 = ro.Stories[0]
		let story1 = ro.Stories[1]

		let action0: MOS.IMOSStoryAction = {
			RunningOrderID: ro.ID,
			StoryID: story1.ID // will insert a story before this
		}
		let stories0 = xmlApiData.roElementAction_insert_story_Stories

		// first create the ro:
		ServerPeripheralDeviceAPI.mosRoCreate(ro)
		let dbRo = RunningOrders.findOne(roId(ro.ID))
		let dbSegments0 = Segments.find({ runningOrderId: dbRo._id }).fetch()

		// Insert story:
		ServerPeripheralDeviceAPI.mosRoStoryInsert(action0, stories0)
		let dbSegments1 = Segments.find({
			runningOrderId: dbRo._id
		}, mod).fetch()
		expect(dbSegments1.length).to.be.greaterThan(dbSegments0.length)
		expect(dbSegments1.length).to.equal(dbSegments0.length + stories0.length)
		expect(dbSegments1[1].mosId).to.equal(stories0[0].ID.toString())

	})
	it('mosRoItemInsert', function () {
		// Test data:
		let ro = xmlApiData.roCreate
		let story = ro.Stories[0]
		let item0 = story.Items[0]

		let action0: MOS.IMOSItemAction = {
			RunningOrderID: ro.ID,
			StoryID: story.ID,
			ItemID: item0.ID // will insert an item before this

		}
		let items0 = xmlApiData.roElementAction_insert_item_Items

		// first create the ro:
		ServerPeripheralDeviceAPI.mosRoCreate(ro)
		let dbRo = RunningOrders.findOne(roId(ro.ID))
		let dbSegment0 = Segments.findOne( segmentId(roId(ro.ID), story.ID))
		let dbSegmentLines0 = SegmentLines.find({ runningOrderId: dbRo._id, segmentId: dbSegment0._id }).fetch()

		// Insert item:
		ServerPeripheralDeviceAPI.mosRoItemInsert(action0, items0)
		let dbSegmentLines1 = SegmentLines.find({ runningOrderId: dbRo._id, segmentId: dbSegment0._id }, mod).fetch()
		expect(dbSegmentLines1.length).to.be.greaterThan(dbSegmentLines0.length)
		expect(dbSegmentLines1.length).to.equal(dbSegmentLines0.length + items0.length)
		expect(dbSegmentLines1[0].mosId).to.equal(items0[0].ID.toString())

	})
	it('mosRoStoryReplace', function () {
		// Test data:
		let ro = xmlApiData.roCreate
		let story = ro.Stories[0]

		let action0: MOS.IMOSStoryAction = {
			RunningOrderID: ro.ID,
			StoryID: story.ID // will replace this story

		}
		let stories0 = xmlApiData.roElementAction_replace_story_Stories

		// first create the ro:
		ServerPeripheralDeviceAPI.mosRoCreate(ro)
		let dbRo = RunningOrders.findOne(roId(ro.ID))
		let dbSegments0 = Segments.find({ runningOrderId: dbRo._id }).fetch()

		// Replace story:
		ServerPeripheralDeviceAPI.mosRoStoryReplace(action0, stories0)
		let dbSegments1 = Segments.find({
			runningOrderId: dbRo._id
		}, mod).fetch()
		expect(dbSegments1.length).to.equal(dbSegments0.length - 1 + stories0.length)
		expect(dbSegments1[0].mosId).to.equal(stories0[0].ID.toString())

	})
	it('mosRoItemReplace', function () {
		// Test data:
		let ro = xmlApiData.roCreate
		let story = ro.Stories[0]
		let item0 = story.Items[0]

		let action0: MOS.IMOSItemAction = {
			RunningOrderID: ro.ID,
			StoryID: story.ID,
			ItemID: item0.ID // will replace this item

		}
		let items0 = xmlApiData.roElementAction_replace_item_Items

		// first create the ro:
		ServerPeripheralDeviceAPI.mosRoCreate(ro)
		let dbRo = RunningOrders.findOne(roId(ro.ID))
		let dbSegment0 = Segments.findOne( segmentId(roId(ro.ID), story.ID))
		let dbSegmentLines0 = SegmentLines.find({ runningOrderId: dbRo._id, segmentId: dbSegment0._id }).fetch()

		// Replace item:
		ServerPeripheralDeviceAPI.mosRoItemReplace(action0, items0)
		let dbSegmentLines1 = SegmentLines.find({ runningOrderId: dbRo._id, segmentId: dbSegment0._id }, mod).fetch()
		expect(dbSegmentLines1.length).to.equal(dbSegmentLines0.length - 1 + items0.length)
		expect(dbSegmentLines1[0].mosId).to.equal(items0[0].ID.toString())

	})
	it('mosRoStoryMove', function () {
		// Test data:
		let ro = xmlApiData.roCreate
		let story0 = ro.Stories[0]
		let story1 = ro.Stories[1]

		let action0: MOS.IMOSStoryAction = {
			RunningOrderID: ro.ID,
			StoryID: story0.ID // will move a story to before this story
		}

		// first create the ro:
		ServerPeripheralDeviceAPI.mosRoCreate(ro)
		let dbRo = RunningOrders.findOne(roId(ro.ID))
		let dbSegments0 = Segments.find({ runningOrderId: dbRo._id }).fetch()

		// Move story:
		ServerPeripheralDeviceAPI.mosRoStoryMove(action0, [story1.ID])
		let dbSegments1 = Segments.find({
			runningOrderId: dbRo._id
		}, mod).fetch()
		expect(dbSegments1.length).to.equal(dbSegments0.length)
		expect(dbSegments1[0].mosId).to.equal(story1.ID.toString())
		expect(dbSegments1[1].mosId).to.equal(story0.ID.toString())

	})
	it('mosRoItemMove', function () {
		// Test data:
		let ro = xmlApiData.roCreate
		let story = ro.Stories[0]
		let item0 = story.Items[0]

		let action0: MOS.IMOSItemAction = {
			RunningOrderID: ro.ID,
			StoryID: story.ID,
			ItemID: item0.ID // will move before this item
		}
		let items0 = xmlApiData.roElementAction_insert_item_Items

		// first create the ro:
		ServerPeripheralDeviceAPI.mosRoCreate(ro)
		ServerPeripheralDeviceAPI.mosRoItemInsert(action0, items0)

		let dbRo = RunningOrders.findOne(roId(ro.ID))
		let dbSegment0 = Segments.findOne( segmentId(roId(ro.ID), story.ID))
		let dbSegmentLines0 = SegmentLines.find({ runningOrderId: dbRo._id, segmentId: dbSegment0._id }).fetch()

		// Move item:
		ServerPeripheralDeviceAPI.mosRoItemMove(action0, [new MOS.MosString128(dbSegmentLines0[0].mosId)])
		let dbSegmentLines1 = SegmentLines.find({ runningOrderId: dbRo._id, segmentId: dbSegment0._id }, mod).fetch()
		expect(dbSegmentLines1.length).to.equal(dbSegmentLines0.length)
		expect(dbSegmentLines1[0].mosId).to.equal(dbSegmentLines0[1].mosId)
		expect(dbSegmentLines1[1].mosId).to.equal(dbSegmentLines0[0].mosId)

	})
	it('mosRoStoryDelete', function () {
		// Test data:
		let ro = xmlApiData.roCreate
		let story0 = ro.Stories[0]
		let story1 = ro.Stories[1]

		let action0: MOS.IMOSStoryAction = {
			RunningOrderID: ro.ID,
			StoryID: story0.ID // will delete this story
		}

		// first create the ro:
		ServerPeripheralDeviceAPI.mosRoCreate(ro)
		let dbRo = RunningOrders.findOne(roId(ro.ID))
		let dbSegments0 = Segments.find({ runningOrderId: dbRo._id }).fetch()

		// Delete story:
		ServerPeripheralDeviceAPI.mosRoStoryDelete(action0, [story1.ID])
		let dbSegments1 = Segments.find({
			runningOrderId: dbRo._id
		}, mod).fetch()
		expect(dbSegments1.length).to.equal(dbSegments0.length - 1)

	})
	it('mosRoItemDelete', function () {
		// Test data:
		let ro = xmlApiData.roCreate
		let story = ro.Stories[0]
		let item0 = story.Items[0]

		let action0: MOS.IMOSItemAction = {
			RunningOrderID: ro.ID,
			StoryID: story.ID,
			ItemID: item0.ID // will delete this item

		}
		let items0 = xmlApiData.roElementAction_insert_item_Items

		// first create the ro:
		ServerPeripheralDeviceAPI.mosRoCreate(ro)
		ServerPeripheralDeviceAPI.mosRoItemInsert(action0, items0)

		let dbRo = RunningOrders.findOne(roId(ro.ID))
		let dbSegment0 = Segments.findOne( segmentId(roId(ro.ID), story.ID))
		let dbSegmentLines0 = SegmentLines.find({ runningOrderId: dbRo._id, segmentId: dbSegment0._id }).fetch()

		// Delete item:
		ServerPeripheralDeviceAPI.mosRoItemDelete(action0, [new MOS.MosString128(dbSegmentLines0[0].mosId)])
		let dbSegmentLines1 = SegmentLines.find({ runningOrderId: dbRo._id, segmentId: dbSegment0._id }, mod).fetch()
		expect(dbSegmentLines1.length).to.equal(dbSegmentLines0.length - 1)

	})
	it('mosRoStorySwap', function () {
		// Test data:
		let ro = xmlApiData.roCreate
		let story0 = ro.Stories[0]
		let story1 = ro.Stories[1]

		let action0: MOS.IMOSROAction = {
			RunningOrderID: ro.ID
		}

		// first create the ro:
		ServerPeripheralDeviceAPI.mosRoCreate(ro)
		let dbRo = RunningOrders.findOne(roId(ro.ID))
		let dbSegments0 = Segments.find({ runningOrderId: dbRo._id }).fetch()

		// Swap stories:
		ServerPeripheralDeviceAPI.mosRoStorySwap(action0, story0.ID, story1.ID)
		let dbSegments1 = Segments.find({
			runningOrderId: dbRo._id
		}, mod).fetch()
		expect(dbSegments1.length).to.equal(dbSegments0.length)
		expect(dbSegments1[0].mosId).to.equal(story1.ID.toString())
		expect(dbSegments1[1].mosId).to.equal(story0.ID.toString())

	})
	it('mosRoItemSwap', function () {
		// Test data:
		let ro = xmlApiData.roCreate
		let story = ro.Stories[0]
		let item0 = story.Items[0]

		let action0: MOS.IMOSItemAction = {
			RunningOrderID: ro.ID,
			StoryID: story.ID,
			ItemID: item0.ID // will move before this item
		}
		let action1: MOS.IMOSStoryAction = {
			RunningOrderID: ro.ID,
			StoryID: story.ID
		}
		let items0 = xmlApiData.roElementAction_insert_item_Items

		// first create the ro:
		ServerPeripheralDeviceAPI.mosRoCreate(ro)
		ServerPeripheralDeviceAPI.mosRoItemInsert(action0, items0)

		let dbRo = RunningOrders.findOne(roId(ro.ID))
		let dbSegment0 = Segments.findOne( segmentId(roId(ro.ID), story.ID))
		let dbSegmentLines0 = SegmentLines.find({ runningOrderId: dbRo._id, segmentId: dbSegment0._id }).fetch()

		// Swap items:
		ServerPeripheralDeviceAPI.mosRoItemSwap(action1, item0.ID, items0[0].ID)
		let dbSegmentLines1 = SegmentLines.find({ runningOrderId: dbRo._id, segmentId: dbSegment0._id }, mod).fetch()
		expect(dbSegmentLines1.length).to.equal(dbSegmentLines0.length)
		expect(dbSegmentLines1[0].mosId).to.equal(dbSegmentLines0[1].mosId)
		expect(dbSegmentLines1[1].mosId).to.equal(dbSegmentLines0[0].mosId)

	})
	it('mosRoReadyToAir', function () {
		// Test data:
		let ro = xmlApiData.roCreate
		let story = ro.Stories[0]
		let item0 = story.Items[0]

	
			ID: ro.ID,
			Status: MOS.IMOSObjectAirStatus.READY
		}
	
			ID: ro.ID,
			Status: MOS.IMOSObjectAirStatus.NOT_READY
		}

		// first create the ro:
		ServerPeripheralDeviceAPI.mosRoCreate(ro)
		let dbRo = RunningOrders.findOne(roId(ro.ID))

		// Set ready to air status:
		ServerPeripheralDeviceAPI.mosRoReadyToAir(status0)
		expect(RunningOrders.findOne(dbRo._id).airStatus).to.equal(status0.Status)

		ServerPeripheralDeviceAPI.mosRoReadyToAir(status1)
		expect(RunningOrders.findOne(dbRo._id).airStatus).to.equal(status1.Status)

	})
})
