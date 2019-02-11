import * as chai from 'chai'
import * as _ from 'underscore'
import {} from 'mocha'

import { RunningOrder, DBRunningOrder, RoData } from '../../../lib/collections/RunningOrders'
import { SegmentLine, DBSegmentLine } from '../../../lib/collections/SegmentLines'
import { SegmentLineItem } from '../../../lib/collections/SegmentLineItems'

import { buildTimelineObjs } from '../playout'
import { getSlGroupId, getSlFirstObjectId, TriggerType, getSliGroupId, getSliFirstObjectId } from 'tv-automation-sofie-blueprints-integration/dist/timeline';
import { RunningOrderAPI } from '../../../lib/api/runningOrder';

const expect = chai.expect
const assert = chai.assert

function createEmptyRoData () {
	const ro: DBRunningOrder = {
		_id: 'mock',
		mosId: '',
		studioInstallationId: '',
		showStyleId: '',
		mosDeviceId: '',
		name: 'Mock',
		created: 0,
		modified: 0,
		previousSegmentLineId: null,
		currentSegmentLineId: null,
		nextSegmentLineId: null,
		dataSource: ''
	}
	const roData: RoData = {
		runningOrder: ro as RunningOrder,
		segments: [],
		segmentsMap: {},
		segmentLines: [],
		segmentLinesMap: {},
		segmentLineItems: []
	}
	return roData
}

function createEmptySegmentLine (id: string, roData: RoData) {
	const sl: DBSegmentLine = {
		_id: id,
		_rank: 1,
		mosId: '',
		segmentId: '',
		runningOrderId: roData.runningOrder._id,
		slug: '',
		typeVariant: ''
	}
	const sl2 = sl as SegmentLine
	sl2.getAllSegmentLineItems = () => {
		return roData.segmentLineItems.filter(i => i.segmentLineId === sl2._id)
	}
	sl2.getLastStartedPlayback = () => {
		if (sl2.startedPlayback && sl2.timings && sl2.timings.startedPlayback) {
			return _.last(sl2.timings.startedPlayback)
		}

		return undefined
	}

	return sl2
}

function addStartedPlayback (sl: SegmentLine, time: number) {
	if (!sl.timings) {
		sl.timings = {
			take: [],
			takeDone: [],
			takeOut: [],
			startedPlayback: [],
			stoppedPlayback: [],
			next: []
		}
	}

	sl.startedPlayback = true
	sl.timings.startedPlayback.push(time)
}

function createEmptySegmentLineItem (id: string, slId: string) {
	const sli: SegmentLineItem = {
		_id: id,
		mosId: id,
		segmentLineId: slId,
		runningOrderId: '',
		name: 'Mock SLI',
		trigger: {
			type: TriggerType.TIME_ABSOLUTE,
			value: 0
		},
		status: RunningOrderAPI.LineItemStatusCode.UNKNOWN,
		sourceLayerId: 'source0',
		outputLayerId: 'output0',
		expectedDuration: 0,
		content: {
			timelineObjects: []
		}
	}
	return sli
}

describe('playout: buildTimelineObjs', function () {

	it('Empty RO', function () {
		const roData = createEmptyRoData()

		const res = buildTimelineObjs(roData, [])
		expect(res).empty
	})

	it('Simple RO', function () {
		const roData = createEmptyRoData()
		roData.segmentLinesMap = {
			a: createEmptySegmentLine('a', roData),
			b: createEmptySegmentLine('b', roData)
		}
		roData.segmentLines = _.values(roData.segmentLinesMap)
		roData.runningOrder.previousSegmentLineId = 'a'
		roData.runningOrder.currentSegmentLineId = 'b'

		const res = buildTimelineObjs(roData, [])
		expect(res).not.empty

		// Not defined as no startedPlayback on a
		const grpA = res.find(o => o._id === getSlGroupId('a'))
		expect(grpA).undefined

		const grpB = res.find(o => o._id === getSlGroupId('b'))
		expect(grpB).not.undefined
		const objB = res.find(o => o._id === getSlFirstObjectId('b'))
		expect(objB).not.undefined
	})

	function createBasicTransitionScenario (prerollDuration: number, transitionPrerollDuration: number, transitionKeepaliveDuration: number) {
		const roData = createEmptyRoData()

		const slA = createEmptySegmentLine('a', roData)
		slA.expectedDuration = 1000
		addStartedPlayback(slA, 700)

		const slB = createEmptySegmentLine('b', roData)
		addStartedPlayback(slB, 5000)
		slB.expectedDuration = 4000
		slB.prerollDuration = prerollDuration
		slB.transitionPrerollDuration = transitionPrerollDuration
		slB.transitionKeepaliveDuration = transitionKeepaliveDuration
		slB.autoNext = true
		slB.autoNextOverlap = 500

		const slC = createEmptySegmentLine('c', roData)
		slC.expectedDuration = 0

		const sliA1 = createEmptySegmentLineItem('a_1', 'a')
		const sliB1 = createEmptySegmentLineItem('b_1', 'b')
		const sliBTrans = createEmptySegmentLineItem('b_trans', 'b')
		sliBTrans.isTransition = true
		sliBTrans.expectedDuration = 2500

		roData.segmentLinesMap = {
			a: slA,
			b: slB,
			c: slC
		}
		roData.segmentLines = _.values(roData.segmentLinesMap)
		roData.segmentLineItems = [
			sliA1,
			sliB1, sliBTrans
		]

		roData.runningOrder.previousSegmentLineId = 'a'
		roData.runningOrder.currentSegmentLineId = 'b'
		roData.runningOrder.nextSegmentLineId = 'c'

		return roData
	}

	function createBasicNextTransitionScenario (prerollDuration: number, transitionPrerollDuration: number, transitionKeepaliveDuration: number) {
		const roData = createEmptyRoData()

		const slA = createEmptySegmentLine('a', roData)
		slA.expectedDuration = 1000
		addStartedPlayback(slA, 700)
		slA.autoNext = true
		slA.autoNextOverlap = 670

		const slB = createEmptySegmentLine('b', roData)
		slB.expectedDuration = 0
		slB.prerollDuration = prerollDuration
		slB.transitionPrerollDuration = transitionPrerollDuration
		slB.transitionKeepaliveDuration = transitionKeepaliveDuration

		const sliA1 = createEmptySegmentLineItem('a_1', 'a')
		const sliB1 = createEmptySegmentLineItem('b_1', 'b')
		const sliBTrans = createEmptySegmentLineItem('b_trans', 'b')
		sliBTrans.isTransition = true
		sliBTrans.expectedDuration = 2500

		roData.segmentLinesMap = {
			a: slA,
			b: slB
		}
		roData.segmentLines = _.values(roData.segmentLinesMap)
		roData.segmentLineItems = [
			sliA1,
			sliB1, sliBTrans
		]

		roData.runningOrder.currentSegmentLineId = 'a'
		roData.runningOrder.nextSegmentLineId = 'b'

		return roData
	}

	function createBasicCutScenario (autoNext: boolean) {
		const roData = createEmptyRoData()

		const slA = createEmptySegmentLine('a', roData)
		slA.expectedDuration = 1000
		addStartedPlayback(slA, 700)

		const slB = createEmptySegmentLine('b', roData)
		addStartedPlayback(slB, 5000)
		slB.expectedDuration = 4000
		slB.prerollDuration = 250 // content starts this far into the sl
		if (autoNext) {
			slB.autoNext = true
			slB.autoNextOverlap = 500
		}

		const slC = createEmptySegmentLine('c', roData)
		slC.expectedDuration = 0
		slC.prerollDuration = 350

		const sliA1 = createEmptySegmentLineItem('a_1', 'a')
		const sliB1 = createEmptySegmentLineItem('b_1', 'b')

		roData.segmentLinesMap = {
			a: slA,
			b: slB,
			c: slC
		}
		roData.segmentLines = _.values(roData.segmentLinesMap)
		roData.segmentLineItems = [
			sliA1,
			sliB1
		]

		roData.runningOrder.previousSegmentLineId = 'a'
		roData.runningOrder.currentSegmentLineId = 'b'
		roData.runningOrder.nextSegmentLineId = 'c'

		return roData
	}

	it('Overlap - no transition (cut)', function () {
		const roData = createBasicCutScenario(false)

		const res = buildTimelineObjs(roData, [])
		expect(res).not.empty

		const ids = res.map(o => o._id)
		expect(ids.sort()).eql([
			'previous_' + getSlGroupId('a'),
			'previous_' + getSliGroupId('a_1'),
			'previous_' + getSliFirstObjectId('a_1'),
			getSlGroupId('b'),
			getSlFirstObjectId('b'),
			getSliGroupId('b_1'),
			getSliFirstObjectId('b_1')
		].sort())

		const grpA = res.find(o => o._id === 'previous_' + getSlGroupId('a'))
		expect(grpA).not.undefined
		expect(grpA.trigger).eql({ type: TriggerType.TIME_ABSOLUTE, value: 700 })
		expect(grpA.duration).eql(`#${getSlGroupId('b')}.start + 250 - #.start`)

		const grpB = res.find(o => o._id === getSlGroupId('b'))
		expect(grpB).not.undefined
		expect(grpB.trigger).eql({ type: TriggerType.TIME_ABSOLUTE, value: 5000 })
		expect(grpB.duration).eql(0)

		const grpB1 = res.find(o => o._id === getSliGroupId('b_1'))
		expect(grpB1).not.undefined
		expect(grpB1.trigger).eql({ type: TriggerType.TIME_ABSOLUTE, value: 0 })
		expect(grpB1.duration).eql(0)
	})

	it('Overlap - no transition (cut) and autonext', function () {
		const roData = createBasicCutScenario(true)

		const res = buildTimelineObjs(roData, [])
		expect(res).not.empty

		const ids = res.map(o => o._id)
		expect(ids.sort()).eql([
			'previous_' + getSlGroupId('a'),
			'previous_' + getSliGroupId('a_1'),
			'previous_' + getSliFirstObjectId('a_1'),
			getSlGroupId('b'),
			getSlFirstObjectId('b'),
			getSliGroupId('b_1'),
			getSliFirstObjectId('b_1'),
			getSlGroupId('c'),
			getSlFirstObjectId('c')
		].sort())

		const grpA = res.find(o => o._id === 'previous_' + getSlGroupId('a'))
		expect(grpA).not.undefined
		expect(grpA.trigger).eql({ type: TriggerType.TIME_ABSOLUTE, value: 700 })
		expect(grpA.duration).eql(`#${getSlGroupId('b')}.start + 250 - #.start`)

		const grpB = res.find(o => o._id === getSlGroupId('b'))
		expect(grpB).not.undefined
		expect(grpB.trigger).eql({ type: TriggerType.TIME_ABSOLUTE, value: 5000 })
		expect(grpB.duration).eql(4750)

		const grpB1 = res.find(o => o._id === getSliGroupId('b_1'))
		expect(grpB1).not.undefined
		expect(grpB1.trigger).eql({ type: TriggerType.TIME_ABSOLUTE, value: 0 })
		expect(grpB1.duration).eql(0)

		const grpC = res.find(o => o._id === getSlGroupId('c'))
		expect(grpC).not.undefined
		expect(grpC.trigger).eql({ type: TriggerType.TIME_RELATIVE, value: `#${getSlGroupId('b')}.end - 850` })
		expect(grpC.duration).eql(0)
	})

	it('Overlap - "normal" transition with gap', function () {
		const roData = createBasicTransitionScenario(300, 500, 400)

		const res = buildTimelineObjs(roData, [])
		expect(res).not.empty

		const ids = res.map(o => o._id)
		expect(ids.sort()).eql([
			'previous_' + getSlGroupId('a'),
			'previous_' + getSliGroupId('a_1'),
			'previous_' + getSliFirstObjectId('a_1'),
			getSlGroupId('b'),
			getSlFirstObjectId('b'),
			getSliGroupId('b_1'),
			getSliFirstObjectId('b_1'),
			getSliGroupId('b_trans'),
			getSliFirstObjectId('b_trans'),
			getSlGroupId('c'),
			getSlFirstObjectId('c')
		].sort())

		const grpA = res.find(o => o._id === 'previous_' + getSlGroupId('a'))
		expect(grpA).not.undefined
		expect(grpA.trigger).eql({ type: TriggerType.TIME_ABSOLUTE, value: 700 })
		expect(grpA.duration).eql(`#${getSlGroupId('b')}.start + 400 - #.start`)

		const grpB = res.find(o => o._id === getSlGroupId('b'))
		expect(grpB).not.undefined
		expect(grpB.trigger).eql({ type: TriggerType.TIME_ABSOLUTE, value: 5000 })
		expect(grpB.duration).eql(5000)

		const grpBTrans = res.find(o => o._id === getSliGroupId('b_trans'))
		expect(grpBTrans).not.undefined
		expect(grpBTrans.trigger).eql({ type: TriggerType.TIME_ABSOLUTE, value: 0 })
		expect(grpBTrans.duration).eql(2500)

		const grpB1 = res.find(o => o._id === getSliGroupId('b_1'))
		expect(grpB1).not.undefined
		expect(grpB1.trigger).eql({ type: TriggerType.TIME_RELATIVE, value: `#${getSliGroupId('b_trans')}.start + 200` })
		expect(grpB1.duration).eql(0)

		const grpC = res.find(o => o._id === getSlGroupId('c'))
		expect(grpC).not.undefined
		expect(grpC.trigger).eql({ type: TriggerType.TIME_RELATIVE, value: `#${getSlGroupId('b')}.end - 500` })
		expect(grpC.duration).eql(0)
	})

	it('Overlap - "normal" transition no gap', function () {
		const roData = createBasicTransitionScenario(300, 500, 500)

		const res = buildTimelineObjs(roData, [])
		expect(res).not.empty

		const ids = res.map(o => o._id)
		expect(ids.sort()).eql([
			'previous_' + getSlGroupId('a'),
			'previous_' + getSliGroupId('a_1'),
			'previous_' + getSliFirstObjectId('a_1'),
			getSlGroupId('b'),
			getSlFirstObjectId('b'),
			getSliGroupId('b_1'),
			getSliFirstObjectId('b_1'),
			getSliGroupId('b_trans'),
			getSliFirstObjectId('b_trans'),
			getSlGroupId('c'),
			getSlFirstObjectId('c')
		].sort())

		const grpA = res.find(o => o._id === 'previous_' + getSlGroupId('a'))
		expect(grpA).not.undefined
		expect(grpA.trigger).eql({ type: TriggerType.TIME_ABSOLUTE, value: 700 })
		expect(grpA.duration).eql(`#${getSlGroupId('b')}.start + 500 - #.start`)

		const grpB = res.find(o => o._id === getSlGroupId('b'))
		expect(grpB).not.undefined
		expect(grpB.trigger).eql({ type: TriggerType.TIME_ABSOLUTE, value: 5000 })
		expect(grpB.duration).eql(5000)

		const grpBTrans = res.find(o => o._id === getSliGroupId('b_trans'))
		expect(grpBTrans).not.undefined
		expect(grpBTrans.trigger).eql({ type: TriggerType.TIME_ABSOLUTE, value: 0 })
		expect(grpBTrans.duration).eql(2500)

		const grpB1 = res.find(o => o._id === getSliGroupId('b_1'))
		expect(grpB1).not.undefined
		expect(grpB1.trigger).eql({ type: TriggerType.TIME_RELATIVE, value: `#${getSliGroupId('b_trans')}.start + 200` })
		expect(grpB1.duration).eql(0)

		const grpC = res.find(o => o._id === getSlGroupId('c'))
		expect(grpC).not.undefined
		expect(grpC.trigger).eql({ type: TriggerType.TIME_RELATIVE, value: `#${getSlGroupId('b')}.end - 500` })
		expect(grpC.duration).eql(0)
	})

	it('Overlap - "fast" transition with gap', function () {
		const roData = createBasicTransitionScenario(500, 300, 200)

		const res = buildTimelineObjs(roData, [])
		expect(res).not.empty

		const ids = res.map(o => o._id)
		expect(ids.sort()).eql([
			'previous_' + getSlGroupId('a'),
			'previous_' + getSliGroupId('a_1'),
			'previous_' + getSliFirstObjectId('a_1'),
			getSlGroupId('b'),
			getSlFirstObjectId('b'),
			getSliGroupId('b_1'),
			getSliFirstObjectId('b_1'),
			getSliGroupId('b_trans'),
			getSliFirstObjectId('b_trans'),
			getSlGroupId('c'),
			getSlFirstObjectId('c')
		].sort())

		const grpA = res.find(o => o._id === 'previous_' + getSlGroupId('a'))
		expect(grpA).not.undefined
		expect(grpA.trigger).eql({ type: TriggerType.TIME_ABSOLUTE, value: 700 })
		expect(grpA.duration).eql(`#${getSlGroupId('b')}.start + 400 - #.start`)

		const grpB = res.find(o => o._id === getSlGroupId('b'))
		expect(grpB).not.undefined
		expect(grpB.trigger).eql({ type: TriggerType.TIME_ABSOLUTE, value: 5000 })
		expect(grpB.duration).eql(4800)

		const grpBTrans = res.find(o => o._id === getSliGroupId('b_trans'))
		expect(grpBTrans).not.undefined
		expect(grpBTrans.trigger).eql({ type: TriggerType.TIME_ABSOLUTE, value: 200 })
		expect(grpBTrans.duration).eql(2500)

		const grpB1 = res.find(o => o._id === getSliGroupId('b_1'))
		expect(grpB1).not.undefined
		expect(grpB1.trigger).eql({ type: TriggerType.TIME_RELATIVE, value: `#${getSliGroupId('b_trans')}.start - 200` })
		expect(grpB1.duration).eql(0)

		const grpC = res.find(o => o._id === getSlGroupId('c'))
		expect(grpC).not.undefined
		expect(grpC.trigger).eql({ type: TriggerType.TIME_RELATIVE, value: `#${getSlGroupId('b')}.end - 500` })
		expect(grpC.duration).eql(0)
	})

	it('Overlap - "fast" transition no gap', function () {
		const roData = createBasicTransitionScenario(500, 300, 400)

		const res = buildTimelineObjs(roData, [])
		expect(res).not.empty

		const ids = res.map(o => o._id)
		expect(ids.sort()).eql([
			'previous_' + getSlGroupId('a'),
			'previous_' + getSliGroupId('a_1'),
			'previous_' + getSliFirstObjectId('a_1'),
			getSlGroupId('b'),
			getSlFirstObjectId('b'),
			getSliGroupId('b_1'),
			getSliFirstObjectId('b_1'),
			getSliGroupId('b_trans'),
			getSliFirstObjectId('b_trans'),
			getSlGroupId('c'),
			getSlFirstObjectId('c')
		].sort())

		const grpA = res.find(o => o._id === 'previous_' + getSlGroupId('a'))
		expect(grpA).not.undefined
		expect(grpA.trigger).eql({ type: TriggerType.TIME_ABSOLUTE, value: 700 })
		expect(grpA.duration).eql(`#${getSlGroupId('b')}.start + 600 - #.start`)

		const grpB = res.find(o => o._id === getSlGroupId('b'))
		expect(grpB).not.undefined
		expect(grpB.trigger).eql({ type: TriggerType.TIME_ABSOLUTE, value: 5000 })
		expect(grpB.duration).eql(4800)

		const grpBTrans = res.find(o => o._id === getSliGroupId('b_trans'))
		expect(grpBTrans).not.undefined
		expect(grpBTrans.trigger).eql({ type: TriggerType.TIME_ABSOLUTE, value: 200 })
		expect(grpBTrans.duration).eql(2500)

		const grpB1 = res.find(o => o._id === getSliGroupId('b_1'))
		expect(grpB1).not.undefined
		expect(grpB1.trigger).eql({ type: TriggerType.TIME_RELATIVE, value: `#${getSliGroupId('b_trans')}.start - 200` })
		expect(grpB1.duration).eql(0)

		const grpC = res.find(o => o._id === getSlGroupId('c'))
		expect(grpC).not.undefined
		expect(grpC.trigger).eql({ type: TriggerType.TIME_RELATIVE, value: `#${getSlGroupId('b')}.end - 500` })
		expect(grpC.duration).eql(0)
	})

	it('Overlap - next is "normal" transition with gap', function () {
		const roData = createBasicNextTransitionScenario(300, 500, 400)

		const res = buildTimelineObjs(roData, [])
		expect(res).not.empty

		const ids = res.map(o => o._id)
		expect(ids.sort()).eql([
			getSlGroupId('a'),
			getSlFirstObjectId('a'),
			getSliGroupId('a_1'),
			getSliFirstObjectId('a_1'),
			getSlGroupId('b'),
			getSlFirstObjectId('b'),
			getSliGroupId('b_1'),
			getSliFirstObjectId('b_1'),
			getSliGroupId('b_trans'),
			getSliFirstObjectId('b_trans')
		].sort())

		const grpA = res.find(o => o._id === getSlGroupId('a'))
		expect(grpA).not.undefined
		expect(grpA.trigger).eql({ type: TriggerType.TIME_ABSOLUTE, value: 700 })
		expect(grpA.duration).eql(1670)

		const grpB = res.find(o => o._id === getSlGroupId('b'))
		expect(grpB).not.undefined
		expect(grpB.trigger).eql({ type: TriggerType.TIME_RELATIVE, value: `#${getSlGroupId('a')}.end - 1070` })
		expect(grpB.duration).eql(0)

		const grpBTrans = res.find(o => o._id === getSliGroupId('b_trans'))
		expect(grpBTrans).not.undefined
		expect(grpBTrans.trigger).eql({ type: TriggerType.TIME_ABSOLUTE, value: 0 })
		expect(grpBTrans.duration).eql(2500)

		const grpB1 = res.find(o => o._id === getSliGroupId('b_1'))
		expect(grpB1).not.undefined
		expect(grpB1.trigger).eql({ type: TriggerType.TIME_RELATIVE, value: `#${getSliGroupId('b_trans')}.start + 200` })
		expect(grpB1.duration).eql(0)
	})

	it('Overlap - next is "normal" transition no gap', function () {
		const roData = createBasicNextTransitionScenario(300, 500, 500)

		const res = buildTimelineObjs(roData, [])
		expect(res).not.empty

		const ids = res.map(o => o._id)
		expect(ids.sort()).eql([
			getSlGroupId('a'),
			getSlFirstObjectId('a'),
			getSliGroupId('a_1'),
			getSliFirstObjectId('a_1'),
			getSlGroupId('b'),
			getSlFirstObjectId('b'),
			getSliGroupId('b_1'),
			getSliFirstObjectId('b_1'),
			getSliGroupId('b_trans'),
			getSliFirstObjectId('b_trans')
		].sort())

		const grpA = res.find(o => o._id === getSlGroupId('a'))
		expect(grpA).not.undefined
		expect(grpA.trigger).eql({ type: TriggerType.TIME_ABSOLUTE, value: 700 })
		expect(grpA.duration).eql(1670)

		const grpB = res.find(o => o._id === getSlGroupId('b'))
		expect(grpB).not.undefined
		expect(grpB.trigger).eql({ type: TriggerType.TIME_RELATIVE, value: `#${getSlGroupId('a')}.end - 1170` })
		expect(grpB.duration).eql(0)

		const grpBTrans = res.find(o => o._id === getSliGroupId('b_trans'))
		expect(grpBTrans).not.undefined
		expect(grpBTrans.trigger).eql({ type: TriggerType.TIME_ABSOLUTE, value: 0 })
		expect(grpBTrans.duration).eql(2500)

		const grpB1 = res.find(o => o._id === getSliGroupId('b_1'))
		expect(grpB1).not.undefined
		expect(grpB1.trigger).eql({ type: TriggerType.TIME_RELATIVE, value: `#${getSliGroupId('b_trans')}.start + 200` })
		expect(grpB1.duration).eql(0)
	})

	it('Overlap - next is "fast" transition with gap', function () {
		const roData = createBasicNextTransitionScenario(500, 300, 200)

		const res = buildTimelineObjs(roData, [])
		expect(res).not.empty

		const ids = res.map(o => o._id)
		expect(ids.sort()).eql([
			getSlGroupId('a'),
			getSlFirstObjectId('a'),
			getSliGroupId('a_1'),
			getSliFirstObjectId('a_1'),
			getSlGroupId('b'),
			getSlFirstObjectId('b'),
			getSliGroupId('b_1'),
			getSliFirstObjectId('b_1'),
			getSliGroupId('b_trans'),
			getSliFirstObjectId('b_trans')
		].sort())

		const grpA = res.find(o => o._id === getSlGroupId('a'))
		expect(grpA).not.undefined
		expect(grpA.trigger).eql({ type: TriggerType.TIME_ABSOLUTE, value: 700 })
		expect(grpA.duration).eql(1670)

		const grpB = res.find(o => o._id === getSlGroupId('b'))
		expect(grpB).not.undefined
		expect(grpB.trigger).eql({ type: TriggerType.TIME_RELATIVE, value: `#${getSlGroupId('a')}.end - 1070` })
		expect(grpB.duration).eql(0)

		const grpBTrans = res.find(o => o._id === getSliGroupId('b_trans'))
		expect(grpBTrans).not.undefined
		expect(grpBTrans.trigger).eql({ type: TriggerType.TIME_ABSOLUTE, value: 200 })
		expect(grpBTrans.duration).eql(2500)

		const grpB1 = res.find(o => o._id === getSliGroupId('b_1'))
		expect(grpB1).not.undefined
		expect(grpB1.trigger).eql({ type: TriggerType.TIME_RELATIVE, value: `#${getSliGroupId('b_trans')}.start - 200` })
		expect(grpB1.duration).eql(0)
	})

	it('Overlap - next is "fast" transition no gap', function () {
		const roData = createBasicNextTransitionScenario(500, 300, 400)

		const res = buildTimelineObjs(roData, [])
		expect(res).not.empty

		const ids = res.map(o => o._id)
		expect(ids.sort()).eql([
			getSlGroupId('a'),
			getSlFirstObjectId('a'),
			getSliGroupId('a_1'),
			getSliFirstObjectId('a_1'),
			getSlGroupId('b'),
			getSlFirstObjectId('b'),
			getSliGroupId('b_1'),
			getSliFirstObjectId('b_1'),
			getSliGroupId('b_trans'),
			getSliFirstObjectId('b_trans')
		].sort())

		const grpA = res.find(o => o._id === getSlGroupId('a'))
		expect(grpA).not.undefined
		expect(grpA.trigger).eql({ type: TriggerType.TIME_ABSOLUTE, value: 700 })
		expect(grpA.duration).eql(1670)

		const grpB = res.find(o => o._id === getSlGroupId('b'))
		expect(grpB).not.undefined
		expect(grpB.trigger).eql({ type: TriggerType.TIME_RELATIVE, value: `#${getSlGroupId('a')}.end - 1270` })
		expect(grpB.duration).eql(0)

		const grpBTrans = res.find(o => o._id === getSliGroupId('b_trans'))
		expect(grpBTrans).not.undefined
		expect(grpBTrans.trigger).eql({ type: TriggerType.TIME_ABSOLUTE, value: 200 })
		expect(grpBTrans.duration).eql(2500)

		const grpB1 = res.find(o => o._id === getSliGroupId('b_1'))
		expect(grpB1).not.undefined
		expect(grpB1.trigger).eql({ type: TriggerType.TIME_RELATIVE, value: `#${getSliGroupId('b_trans')}.start - 200` })
		expect(grpB1.duration).eql(0)
	})

})
