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
import { MosString128, IMOSRunningOrderStatus, IMOSObjectStatus, MosTime, IMOSStoryStatus, IMOSItemStatus, IMOSStoryAction, IMOSItemAction, IMOSROAction, IMOSObjectAirStatus, IMOSROReadyToAir } from 'mos-connection'
import { xmlApiData } from '../../mockData/mosData'
import { roId, segmentLineId, getRO } from '../integration/mos'
import { segmentId } from '../runningOrder'

const expect = chai.expect
const assert = chai.assert

const mod = { // standard modifier
	sort: {_rank: 1}
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

		let roID = roId(new MosString128('ro0'))
		// Prepare database:
		RunningOrders.insert({
			_id: roID,
			mosId: 'ro0',
			studioInstallationId: 'studio0',
			showStyleId: 'showStyle0',
			name: 'test ro',
			created: 1000,
			currentSegmentLineId: null,
			nextSegmentLineId: null,
			previousSegmentLineId: null,
			dataSource: 'mock',
			mosDeviceId: 'testMosDevice',
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
			_id: segmentLineId(segmentID, new MosString128('segmentLine000')),
			_rank: 0,
			mosId: 'segmentLine000',
			segmentId: segmentID,
			runningOrderId: roID,
			slug: ''
		})
		SegmentLines.insert({
			_id: segmentLineId(segmentID, new MosString128('segmentLine001')),
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
		roID = roId(new MosString128('ro1'))
		RunningOrders.insert({
			_id: roID,
			mosId: 'ro1',
			studioInstallationId: 'studio0',
			showStyleId: 'showStyle1',
			name: 'test ro 1',
			created: 2000,
			currentSegmentLineId: null,
			nextSegmentLineId: null,
			previousSegmentLineId: null,
			dataSource: 'mock',
			mosDeviceId: 'testMosDevice',
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
			_id: roId(new MosString128('ro2')),
			mosId: 'ro2',
			studioInstallationId: 'studio0',
			showStyleId: 'showStyle1',
			name: 'test ro 2',
			created: 2000,
			currentSegmentLineId: null,
			nextSegmentLineId: null,
			previousSegmentLineId: null,
			dataSource: 'mock',
			mosDeviceId: 'testMosDevice',
			modified: getCurrentTime(),
		})
	})

	afterEach(function () {
		StubCollections.restore()
	})
	it('getRO', function () {
		let ro = getRO(new MosString128('ro1'))

		expect(ro).to.be.an('object')
		expect(ro._id).to.be.equal('ro_ro1')
		expect(ro.mosId).to.be.equal('ro1')

		expect(() => {
			let ro = getRO(new MosString128('unknown'))
		}).to.throw()
	})
	it('getSegment', function () {
		let segment = getSegment(new MosString128('ro1'), new MosString128('segment10'))

		expect(segment).to.be.an('object')
		expect(segment._id).to.be.equal('ro_ro1_segment10')
		expect(segment.mosId).to.be.equal('segment10')

		expect(() => {
			let segment = getSegment(new MosString128('ro0'), new MosString128('unknown'))
		}).to.throw()

		expect(() => {
			let segment = getSegment(new MosString128('unknown'), new MosString128('segment00'))
		}).to.throw()
	})
	it('getSegmentLine', function () {
		let segmentLine = getSegmentLine(
			new MosString128('ro0'),
			new MosString128('segment00'),
			new MosString128('segmentLine000')
		)

		expect(segmentLine).to.be.an('object')
		expect(segmentLine._id).to.be.equal('ro_ro0_segment00_segmentLine000')
		expect(segmentLine.mosId).to.be.equal('segmentLine000')

		expect(() => {
			let segmentLine = getSegmentLine(new MosString128('ro0'), new MosString128('segment00'), new MosString128('unknown'))
		}).to.throw()

		expect(() => {
			let segmentLine = getSegmentLine(new MosString128('ro0'), new MosString128('unknown'), new MosString128('segmentLine000'))
		}).to.throw()

		expect(() => {
			let segmentLine = getSegmentLine(new MosString128('unknown'), new MosString128('segment00'), new MosString128('segmentLine000'))
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
		let dbSegment = Segments.findOne(segmentId('ro_ro0','',  new MosString128('segment00')))
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
		let segment00 = Segments.findOne(segmentId('ro_ro0','',  new MosString128('segment00')))
		let segment00Before = fetchBefore(Segments, { runningOrderId: segment00.runningOrderId}, segment00._rank)
		let segment00After = fetchAfter(Segments, { runningOrderId: segment00.runningOrderId}, segment00._rank)

		expect(segment00Before).to.equal(undefined)
		expect(segment00After).to.be.an('object')
		expect(segment00After.mosId).to.equal('segment01')

		let segment01 = Segments.findOne(segmentId('ro_ro0','',  new MosString128('segment01')))
		let segment01Before = fetchBefore(Segments, { runningOrderId: segment01.runningOrderId}, segment01._rank)
		let segment01After = fetchAfter(Segments, { runningOrderId: segment01.runningOrderId}, segment01._rank)

		expect(segment01Before).to.be.an('object')
		expect(segment01Before.mosId).to.equal('segment00')
		expect(segment01After).to.be.an('object')
		expect(segment01After.mosId).to.equal('segment02')

		let segment02 = Segments.findOne(segmentId('ro_ro0','',  new MosString128('segment02')))
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
		let status0: IMOSRunningOrderStatus = {
			ID: ro.ID,
			Status: IMOSObjectStatus.MANUAL_CTRL,
			Time: new MosTime('2009-04-11T14:13:53')
		}
		let status1: IMOSRunningOrderStatus = {
			ID: ro.ID,
			Status: IMOSObjectStatus.READY,
			Time: new MosTime('2009-04-11T14:13:53')
		}
		let statusUnknown: IMOSRunningOrderStatus = {
			ID: new MosString128('unknown'),
			Status: IMOSObjectStatus.MOVED,
			Time: new MosTime('2009-04-11T14:13:53')
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
		let status0: IMOSStoryStatus = {
			ID: story.ID,
			RunningOrderId: ro.ID,
			Status: IMOSObjectStatus.MANUAL_CTRL,
			Time: new MosTime('2009-04-11T14:13:53')
		}
		let status1: IMOSStoryStatus = {
			ID: story.ID,
			RunningOrderId: ro.ID,
			Status: IMOSObjectStatus.READY,
			Time: new MosTime('2009-04-11T14:13:53')
		}
		let statusUnknown0: IMOSStoryStatus = {
			ID: new MosString128('unknown'),
			RunningOrderId: ro.ID,
			Status: IMOSObjectStatus.NOT_READY,
			Time: new MosTime('2009-04-11T14:13:53')
		}
		let statusUnknown1: IMOSStoryStatus = {
			ID: story.ID,
			RunningOrderId: new MosString128('unknown'),
			Status: IMOSObjectStatus.UPDATED,
			Time: new MosTime('2009-04-11T14:13:53')
		}
		let segmentID = segmentId(roId(r'', o.ID), story.ID)
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

		let status0: IMOSItemStatus = {
			ID: item.ID,
			StoryId: story.ID,
			RunningOrderId: ro.ID,
			Status: IMOSObjectStatus.MANUAL_CTRL,
			Time: new MosTime('2009-04-11T14:13:53')
		}
		let status1: IMOSItemStatus = {
			ID: item.ID,
			RunningOrderId: ro.ID,
			StoryId: story.ID,
			Status: IMOSObjectStatus.READY,
			Time: new MosTime('2009-04-11T14:13:53')
		}
		let statusUnknown0: IMOSItemStatus = {
			ID: new MosString128('unknown'),
			RunningOrderId: ro.ID,
			StoryId: story.ID,
			Status: IMOSObjectStatus.NOT_READY,
			Time: new MosTime('2009-04-11T14:13:53')
		}
		let statusUnknown1: IMOSItemStatus = {
			ID: item.ID,
			StoryId: new MosString128('unknown'),
			RunningOrderId: ro.ID,
			Status: IMOSObjectStatus.UPDATED,
			Time: new MosTime('2009-04-11T14:13:53')
		}
		let statusUnknown2: IMOSItemStatus = {
			ID: item.ID,
			StoryId: story.ID,
			RunningOrderId: new MosString128('unknown'),
			Status: IMOSObjectStatus.BUSY,
			Time: new MosTime('2009-04-11T14:13:53')
		}
		let segmentID = segmentId(roId(r'', o.ID), story.ID)
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

		let action0: IMOSStoryAction = {
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

		let action0: IMOSItemAction = {
			RunningOrderID: ro.ID,
			StoryID: story.ID,
			ItemID: item0.ID // will insert an item before this

		}
		let items0 = xmlApiData.roElementAction_insert_item_Items

		// first create the ro:
		ServerPeripheralDeviceAPI.mosRoCreate(ro)
		let dbRo = RunningOrders.findOne(roId(ro.ID))
		let dbSegment0 = Segments.findOne( segmentId(roId(r'', o.ID), story.ID))
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

		let action0: IMOSStoryAction = {
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

		let action0: IMOSItemAction = {
			RunningOrderID: ro.ID,
			StoryID: story.ID,
			ItemID: item0.ID // will replace this item

		}
		let items0 = xmlApiData.roElementAction_replace_item_Items

		// first create the ro:
		ServerPeripheralDeviceAPI.mosRoCreate(ro)
		let dbRo = RunningOrders.findOne(roId(ro.ID))
		let dbSegment0 = Segments.findOne( segmentId(roId(r'', o.ID), story.ID))
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

		let action0: IMOSStoryAction = {
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

		let action0: IMOSItemAction = {
			RunningOrderID: ro.ID,
			StoryID: story.ID,
			ItemID: item0.ID // will move before this item
		}
		let items0 = xmlApiData.roElementAction_insert_item_Items

		// first create the ro:
		ServerPeripheralDeviceAPI.mosRoCreate(ro)
		ServerPeripheralDeviceAPI.mosRoItemInsert(action0, items0)

		let dbRo = RunningOrders.findOne(roId(ro.ID))
		let dbSegment0 = Segments.findOne( segmentId(roId(r'', o.ID), story.ID))
		let dbSegmentLines0 = SegmentLines.find({ runningOrderId: dbRo._id, segmentId: dbSegment0._id }).fetch()

		// Move item:
		ServerPeripheralDeviceAPI.mosRoItemMove(action0, [new MosString128(dbSegmentLines0[0].mosId)])
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

		let action0: IMOSStoryAction = {
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

		let action0: IMOSItemAction = {
			RunningOrderID: ro.ID,
			StoryID: story.ID,
			ItemID: item0.ID // will delete this item

		}
		let items0 = xmlApiData.roElementAction_insert_item_Items

		// first create the ro:
		ServerPeripheralDeviceAPI.mosRoCreate(ro)
		ServerPeripheralDeviceAPI.mosRoItemInsert(action0, items0)

		let dbRo = RunningOrders.findOne(roId(ro.ID))
		let dbSegment0 = Segments.findOne( segmentId(roId(r'', o.ID), story.ID))
		let dbSegmentLines0 = SegmentLines.find({ runningOrderId: dbRo._id, segmentId: dbSegment0._id }).fetch()

		// Delete item:
		ServerPeripheralDeviceAPI.mosRoItemDelete(action0, [new MosString128(dbSegmentLines0[0].mosId)])
		let dbSegmentLines1 = SegmentLines.find({ runningOrderId: dbRo._id, segmentId: dbSegment0._id }, mod).fetch()
		expect(dbSegmentLines1.length).to.equal(dbSegmentLines0.length - 1)

	})
	it('mosRoStorySwap', function () {
		// Test data:
		let ro = xmlApiData.roCreate
		let story0 = ro.Stories[0]
		let story1 = ro.Stories[1]

		let action0: IMOSROAction = {
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

		let action0: IMOSItemAction = {
			RunningOrderID: ro.ID,
			StoryID: story.ID,
			ItemID: item0.ID // will move before this item
		}
		let action1: IMOSStoryAction = {
			RunningOrderID: ro.ID,
			StoryID: story.ID
		}
		let items0 = xmlApiData.roElementAction_insert_item_Items

		// first create the ro:
		ServerPeripheralDeviceAPI.mosRoCreate(ro)
		ServerPeripheralDeviceAPI.mosRoItemInsert(action0, items0)

		let dbRo = RunningOrders.findOne(roId(ro.ID))
		let dbSegment0 = Segments.findOne( segmentId(roId(r'', o.ID), story.ID))
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

		let status0: IMOSROReadyToAir = {
			ID: ro.ID,
			Status: IMOSObjectAirStatus.READY
		}
		let status1: IMOSROReadyToAir = {
			ID: ro.ID,
			Status: IMOSObjectAirStatus.NOT_READY
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
