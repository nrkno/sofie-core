import * as chai from 'chai'
import * as _ from 'underscore'
import {} from 'mocha'

import { Rundown, DBRundown, RundownData } from '../../../lib/collections/Rundowns'
import { SegmentLine, DBSegmentLine } from '../../../lib/collections/SegmentLines'
import { Piece } from '../../../lib/collections/Pieces'

import { buildTimelineObjsForRundown } from '../playout'
import { getSlGroupId, getSlFirstObjectId, getPieceGroupId, getPieceFirstObjectId } from 'tv-automation-sofie-blueprints-integration/dist/timeline'
import { TriggerType } from 'superfly-timeline'
import { RundownAPI } from '../../../lib/api/rundown'

const expect = chai.expect
const assert = chai.assert

function createEmptyRundownData () {
	const rundown: DBRundown = {
		_id: 'mock',
		mosId: '',
		studioInstallationId: '',
		showStyleBaseId: '',
		showStyleVariantId: '',
		peripheralDeviceId: '',
		name: 'Mock',
		created: 0,
		modified: 0,
		previousSegmentLineId: null,
		currentSegmentLineId: null,
		nextSegmentLineId: null,
		dataSource: ''
	}
	const rundownData: RundownData = {
		rundown: rundown as Rundown,
		segments: [],
		segmentsMap: {},
		segmentLines: [],
		segmentLinesMap: {},
		pieces: []
	}
	return rundownData
}

function createEmptySegmentLine (id: string, rundownData: RundownData) {
	const sl: DBSegmentLine = {
		_id: id,
		_rank: 1,
		mosId: '',
		segmentId: '',
		rundownId: rundownData.rundown._id,
		slug: '',
		typeVariant: ''
	}
	const sl2 = sl as SegmentLine
	sl2.getAllPieces = () => {
		return rundownData.pieces.filter(i => i.segmentLineId === sl2._id)
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

function createEmptyPiece (id: string, slId: string) {
	const piece: Piece = {
		_id: id,
		mosId: id,
		segmentLineId: slId,
		rundownId: '',
		name: 'Mock Piece',
		trigger: {
			type: TriggerType.TIME_ABSOLUTE,
			value: 0
		},
		status: RundownAPI.LineItemStatusCode.UNKNOWN,
		sourceLayerId: 'source0',
		outputLayerId: 'output0',
		expectedDuration: 0,
		content: {
			timelineObjects: []
		}
	}
	return piece

}

describe('playout: buildTimelineObjsForRundown', function () {

	it('Empty rundown', function () {
		const rundownData = createEmptyRundownData()

		const res = buildTimelineObjsForRundown(rundownData, [])
		expect(res).lengthOf(1)
		expect(res[0]._id).to.eq('mock_status')
	})

	it('Simple rundown', function () {
		const rundownData = createEmptyRundownData()
		rundownData.segmentLinesMap = {
			a: createEmptySegmentLine('a', rundownData),
			b: createEmptySegmentLine('b', rundownData)
		}
		rundownData.segmentLines = _.values(rundownData.segmentLinesMap)
		rundownData.rundown.previousSegmentLineId = 'a'
		rundownData.rundown.currentSegmentLineId = 'b'

		const res = buildTimelineObjsForRundown(rundownData, [])
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
		const rundownData = createEmptyRundownData()

		const slA = createEmptySegmentLine('a', rundownData)
		slA.expectedDuration = 1000
		addStartedPlayback(slA, 700)

		const slB = createEmptySegmentLine('b', rundownData)
		addStartedPlayback(slB, 5000)
		slB.expectedDuration = 4000
		slB.prerollDuration = prerollDuration
		slB.transitionPrerollDuration = transitionPrerollDuration
		slB.transitionKeepaliveDuration = transitionKeepaliveDuration
		slB.autoNext = true
		slB.autoNextOverlap = 500

		const slC = createEmptySegmentLine('c', rundownData)
		slC.expectedDuration = 0

		const pieceA1 = createEmptyPiece('a_1', 'a')
		const pieceB1 = createEmptyPiece('b_1', 'b')
		const pieceBTrans = createEmptyPiece('b_trans', 'b')
		pieceBTrans.isTransition = true
		pieceBTrans.expectedDuration = 2500

		rundownData.segmentLinesMap = {
			a: slA,
			b: slB,
			c: slC
		}
		rundownData.segmentLines = _.values(rundownData.segmentLinesMap)
		rundownData.pieces = [
			pieceA1,
			pieceB1, pieceBTrans
		]

		rundownData.rundown.previousSegmentLineId = 'a'
		rundownData.rundown.currentSegmentLineId = 'b'
		rundownData.rundown.nextSegmentLineId = 'c'

		return rundownData
	}

	function createBasicNextTransitionScenario (prerollDuration: number, transitionPrerollDuration: number, transitionKeepaliveDuration: number) {
		const rundownData = createEmptyRundownData()

		const slA = createEmptySegmentLine('a', rundownData)
		slA.expectedDuration = 1000
		addStartedPlayback(slA, 700)
		slA.autoNext = true
		slA.autoNextOverlap = 670

		const slB = createEmptySegmentLine('b', rundownData)
		slB.expectedDuration = 0
		slB.prerollDuration = prerollDuration
		slB.transitionPrerollDuration = transitionPrerollDuration
		slB.transitionKeepaliveDuration = transitionKeepaliveDuration

		const pieceA1 = createEmptyPiece('a_1', 'a')
		const pieceB1 = createEmptyPiece('b_1', 'b')
		const pieceBTrans = createEmptyPiece('b_trans', 'b')
		pieceBTrans.isTransition = true
		pieceBTrans.expectedDuration = 2500

		rundownData.segmentLinesMap = {
			a: slA,
			b: slB
		}
		rundownData.segmentLines = _.values(rundownData.segmentLinesMap)
		rundownData.pieces = [
			pieceA1,
			pieceB1, pieceBTrans
		]

		rundownData.rundown.currentSegmentLineId = 'a'
		rundownData.rundown.nextSegmentLineId = 'b'

		return rundownData
	}

	function createBasicCutScenario (autoNext: boolean) {
		const rundownData = createEmptyRundownData()

		const slA = createEmptySegmentLine('a', rundownData)
		slA.expectedDuration = 1000
		addStartedPlayback(slA, 700)

		const slB = createEmptySegmentLine('b', rundownData)
		addStartedPlayback(slB, 5000)
		slB.expectedDuration = 4000
		slB.prerollDuration = 250 // content starts this far into the sl
		if (autoNext) {
			slB.autoNext = true
			slB.autoNextOverlap = 500
		}

		const slC = createEmptySegmentLine('c', rundownData)
		slC.expectedDuration = 0
		slC.prerollDuration = 350

		const pieceA1 = createEmptyPiece('a_1', 'a')
		const pieceB1 = createEmptyPiece('b_1', 'b')

		rundownData.segmentLinesMap = {
			a: slA,
			b: slB,
			c: slC
		}
		rundownData.segmentLines = _.values(rundownData.segmentLinesMap)
		rundownData.pieces = [
			pieceA1,
			pieceB1
		]

		rundownData.rundown.previousSegmentLineId = 'a'
		rundownData.rundown.currentSegmentLineId = 'b'
		rundownData.rundown.nextSegmentLineId = 'c'

		return rundownData
	}

	it('Overlap - no transition (cut)', function () {
		const rundownData = createBasicCutScenario(false)

		const res = buildTimelineObjsForRundown(rundownData, [])
		expect(res).not.empty

		const ids = res.map(o => o._id)
		expect(ids.sort()).eql([
			'mock_status',
			'previous_' + getSlGroupId('a'),
			'previous_' + getPieceGroupId('a_1'),
			'previous_' + getPieceFirstObjectId('a_1'),
			getSlGroupId('b'),
			getSlFirstObjectId('b'),
			getPieceGroupId('b_1'),
			getPieceFirstObjectId('b_1')
		].sort())

		const grpA = res.find(o => o._id === 'previous_' + getSlGroupId('a'))
		expect(grpA).not.undefined
		expect(grpA.trigger).eql({ type: TriggerType.TIME_ABSOLUTE, value: 700 })
		expect(grpA.duration).eql(`#${getSlGroupId('b')}.start + 250 - #.start`)

		const grpB = res.find(o => o._id === getSlGroupId('b'))
		expect(grpB).not.undefined
		expect(grpB.trigger).eql({ type: TriggerType.TIME_ABSOLUTE, value: 5000 })
		expect(grpB.duration).eql(0)

		const grpB1 = res.find(o => o._id === getPieceGroupId('b_1'))
		expect(grpB1).not.undefined
		expect(grpB1.trigger).eql({ type: TriggerType.TIME_ABSOLUTE, value: 0 })
		expect(grpB1.duration).eql(0)
	})

	it('Overlap - no transition (cut) and autonext', function () {
		const rundownData = createBasicCutScenario(true)

		const res = buildTimelineObjsForRundown(rundownData, [])
		expect(res).not.empty

		const ids = res.map(o => o._id)
		expect(ids.sort()).eql([
			'mock_status',
			'previous_' + getSlGroupId('a'),
			'previous_' + getPieceGroupId('a_1'),
			'previous_' + getPieceFirstObjectId('a_1'),
			getSlGroupId('b'),
			getSlFirstObjectId('b'),
			getPieceGroupId('b_1'),
			getPieceFirstObjectId('b_1'),
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

		const grpB1 = res.find(o => o._id === getPieceGroupId('b_1'))
		expect(grpB1).not.undefined
		expect(grpB1.trigger).eql({ type: TriggerType.TIME_ABSOLUTE, value: 0 })
		expect(grpB1.duration).eql(0)

		const grpC = res.find(o => o._id === getSlGroupId('c'))
		expect(grpC).not.undefined
		expect(grpC.trigger).eql({ type: TriggerType.TIME_RELATIVE, value: `#${getSlGroupId('b')}.end - 850` })
		expect(grpC.duration).eql(0)
	})

	it('Overlap - "normal" transition with gap', function () {
		const rundownData = createBasicTransitionScenario(300, 500, 400)

		const res = buildTimelineObjsForRundown(rundownData, [])
		expect(res).not.empty

		const ids = res.map(o => o._id)
		expect(ids.sort()).eql([
			'mock_status',
			'previous_' + getSlGroupId('a'),
			'previous_' + getPieceGroupId('a_1'),
			'previous_' + getPieceFirstObjectId('a_1'),
			getSlGroupId('b'),
			getSlFirstObjectId('b'),
			getPieceGroupId('b_1'),
			getPieceFirstObjectId('b_1'),
			getPieceGroupId('b_trans'),
			getPieceFirstObjectId('b_trans'),
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

		const grpBTrans = res.find(o => o._id === getPieceGroupId('b_trans'))
		expect(grpBTrans).not.undefined
		expect(grpBTrans.trigger).eql({ type: TriggerType.TIME_ABSOLUTE, value: 0 })
		expect(grpBTrans.duration).eql(2500)

		const grpB1 = res.find(o => o._id === getPieceGroupId('b_1'))
		expect(grpB1).not.undefined
		expect(grpB1.trigger).eql({ type: TriggerType.TIME_RELATIVE, value: `#${getPieceGroupId('b_trans')}.start + 200` })
		expect(grpB1.duration).eql(0)

		const grpC = res.find(o => o._id === getSlGroupId('c'))
		expect(grpC).not.undefined
		expect(grpC.trigger).eql({ type: TriggerType.TIME_RELATIVE, value: `#${getSlGroupId('b')}.end - 500` })
		expect(grpC.duration).eql(0)
	})

	it('Overlap - "normal" transition no gap', function () {
		const rundownData = createBasicTransitionScenario(300, 500, 500)

		const res = buildTimelineObjsForRundown(rundownData, [])
		expect(res).not.empty

		const ids = res.map(o => o._id)
		expect(ids.sort()).eql([
			'mock_status',
			'previous_' + getSlGroupId('a'),
			'previous_' + getPieceGroupId('a_1'),
			'previous_' + getPieceFirstObjectId('a_1'),
			getSlGroupId('b'),
			getSlFirstObjectId('b'),
			getPieceGroupId('b_1'),
			getPieceFirstObjectId('b_1'),
			getPieceGroupId('b_trans'),
			getPieceFirstObjectId('b_trans'),
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

		const grpBTrans = res.find(o => o._id === getPieceGroupId('b_trans'))
		expect(grpBTrans).not.undefined
		expect(grpBTrans.trigger).eql({ type: TriggerType.TIME_ABSOLUTE, value: 0 })
		expect(grpBTrans.duration).eql(2500)

		const grpB1 = res.find(o => o._id === getPieceGroupId('b_1'))
		expect(grpB1).not.undefined
		expect(grpB1.trigger).eql({ type: TriggerType.TIME_RELATIVE, value: `#${getPieceGroupId('b_trans')}.start + 200` })
		expect(grpB1.duration).eql(0)

		const grpC = res.find(o => o._id === getSlGroupId('c'))
		expect(grpC).not.undefined
		expect(grpC.trigger).eql({ type: TriggerType.TIME_RELATIVE, value: `#${getSlGroupId('b')}.end - 500` })
		expect(grpC.duration).eql(0)
	})

	it('Overlap - "fast" transition with gap', function () {
		const rundownData = createBasicTransitionScenario(500, 300, 200)

		const res = buildTimelineObjsForRundown(rundownData, [])
		expect(res).not.empty

		const ids = res.map(o => o._id)
		expect(ids.sort()).eql([
			'mock_status',
			'previous_' + getSlGroupId('a'),
			'previous_' + getPieceGroupId('a_1'),
			'previous_' + getPieceFirstObjectId('a_1'),
			getSlGroupId('b'),
			getSlFirstObjectId('b'),
			getPieceGroupId('b_1'),
			getPieceFirstObjectId('b_1'),
			getPieceGroupId('b_trans'),
			getPieceFirstObjectId('b_trans'),
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

		const grpBTrans = res.find(o => o._id === getPieceGroupId('b_trans'))
		expect(grpBTrans).not.undefined
		expect(grpBTrans.trigger).eql({ type: TriggerType.TIME_ABSOLUTE, value: 200 })
		expect(grpBTrans.duration).eql(2500)

		const grpB1 = res.find(o => o._id === getPieceGroupId('b_1'))
		expect(grpB1).not.undefined
		expect(grpB1.trigger).eql({ type: TriggerType.TIME_RELATIVE, value: `#${getPieceGroupId('b_trans')}.start - 200` })
		expect(grpB1.duration).eql(0)

		const grpC = res.find(o => o._id === getSlGroupId('c'))
		expect(grpC).not.undefined
		expect(grpC.trigger).eql({ type: TriggerType.TIME_RELATIVE, value: `#${getSlGroupId('b')}.end - 500` })
		expect(grpC.duration).eql(0)
	})

	it('Overlap - "fast" transition no gap', function () {
		const rundownData = createBasicTransitionScenario(500, 300, 400)

		const res = buildTimelineObjsForRundown(rundownData, [])
		expect(res).not.empty

		const ids = res.map(o => o._id)
		expect(ids.sort()).eql([
			'mock_status',
			'previous_' + getSlGroupId('a'),
			'previous_' + getPieceGroupId('a_1'),
			'previous_' + getPieceFirstObjectId('a_1'),
			getSlGroupId('b'),
			getSlFirstObjectId('b'),
			getPieceGroupId('b_1'),
			getPieceFirstObjectId('b_1'),
			getPieceGroupId('b_trans'),
			getPieceFirstObjectId('b_trans'),
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

		const grpBTrans = res.find(o => o._id === getPieceGroupId('b_trans'))
		expect(grpBTrans).not.undefined
		expect(grpBTrans.trigger).eql({ type: TriggerType.TIME_ABSOLUTE, value: 200 })
		expect(grpBTrans.duration).eql(2500)

		const grpB1 = res.find(o => o._id === getPieceGroupId('b_1'))
		expect(grpB1).not.undefined
		expect(grpB1.trigger).eql({ type: TriggerType.TIME_RELATIVE, value: `#${getPieceGroupId('b_trans')}.start - 200` })
		expect(grpB1.duration).eql(0)

		const grpC = res.find(o => o._id === getSlGroupId('c'))
		expect(grpC).not.undefined
		expect(grpC.trigger).eql({ type: TriggerType.TIME_RELATIVE, value: `#${getSlGroupId('b')}.end - 500` })
		expect(grpC.duration).eql(0)
	})

	it('Overlap - next is "normal" transition with gap', function () {
		const rundownData = createBasicNextTransitionScenario(300, 500, 400)

		const res = buildTimelineObjsForRundown(rundownData, [])
		expect(res).not.empty

		const ids = res.map(o => o._id)
		expect(ids.sort()).eql([
			'mock_status',
			getSlGroupId('a'),
			getSlFirstObjectId('a'),
			getPieceGroupId('a_1'),
			getPieceFirstObjectId('a_1'),
			getSlGroupId('b'),
			getSlFirstObjectId('b'),
			getPieceGroupId('b_1'),
			getPieceFirstObjectId('b_1'),
			getPieceGroupId('b_trans'),
			getPieceFirstObjectId('b_trans')
		].sort())

		const grpA = res.find(o => o._id === getSlGroupId('a'))
		expect(grpA).not.undefined
		expect(grpA.trigger).eql({ type: TriggerType.TIME_ABSOLUTE, value: 700 })
		expect(grpA.duration).eql(1670)

		const grpB = res.find(o => o._id === getSlGroupId('b'))
		expect(grpB).not.undefined
		expect(grpB.trigger).eql({ type: TriggerType.TIME_RELATIVE, value: `#${getSlGroupId('a')}.end - 1070` })
		expect(grpB.duration).eql(0)

		const grpBTrans = res.find(o => o._id === getPieceGroupId('b_trans'))
		expect(grpBTrans).not.undefined
		expect(grpBTrans.trigger).eql({ type: TriggerType.TIME_ABSOLUTE, value: 0 })
		expect(grpBTrans.duration).eql(2500)

		const grpB1 = res.find(o => o._id === getPieceGroupId('b_1'))
		expect(grpB1).not.undefined
		expect(grpB1.trigger).eql({ type: TriggerType.TIME_RELATIVE, value: `#${getPieceGroupId('b_trans')}.start + 200` })
		expect(grpB1.duration).eql(0)
	})

	it('Overlap - next is "normal" transition no gap', function () {
		const rundownData = createBasicNextTransitionScenario(300, 500, 500)

		const res = buildTimelineObjsForRundown(rundownData, [])
		expect(res).not.empty

		const ids = res.map(o => o._id)
		expect(ids.sort()).eql([
			'mock_status',
			getSlGroupId('a'),
			getSlFirstObjectId('a'),
			getPieceGroupId('a_1'),
			getPieceFirstObjectId('a_1'),
			getSlGroupId('b'),
			getSlFirstObjectId('b'),
			getPieceGroupId('b_1'),
			getPieceFirstObjectId('b_1'),
			getPieceGroupId('b_trans'),
			getPieceFirstObjectId('b_trans')
		].sort())

		const grpA = res.find(o => o._id === getSlGroupId('a'))
		expect(grpA).not.undefined
		expect(grpA.trigger).eql({ type: TriggerType.TIME_ABSOLUTE, value: 700 })
		expect(grpA.duration).eql(1670)

		const grpB = res.find(o => o._id === getSlGroupId('b'))
		expect(grpB).not.undefined
		expect(grpB.trigger).eql({ type: TriggerType.TIME_RELATIVE, value: `#${getSlGroupId('a')}.end - 1170` })
		expect(grpB.duration).eql(0)

		const grpBTrans = res.find(o => o._id === getPieceGroupId('b_trans'))
		expect(grpBTrans).not.undefined
		expect(grpBTrans.trigger).eql({ type: TriggerType.TIME_ABSOLUTE, value: 0 })
		expect(grpBTrans.duration).eql(2500)

		const grpB1 = res.find(o => o._id === getPieceGroupId('b_1'))
		expect(grpB1).not.undefined
		expect(grpB1.trigger).eql({ type: TriggerType.TIME_RELATIVE, value: `#${getPieceGroupId('b_trans')}.start + 200` })
		expect(grpB1.duration).eql(0)
	})

	it('Overlap - next is "fast" transition with gap', function () {
		const rundownData = createBasicNextTransitionScenario(500, 300, 200)

		const res = buildTimelineObjsForRundown(rundownData, [])
		expect(res).not.empty

		const ids = res.map(o => o._id)
		expect(ids.sort()).eql([
			'mock_status',
			getSlGroupId('a'),
			getSlFirstObjectId('a'),
			getPieceGroupId('a_1'),
			getPieceFirstObjectId('a_1'),
			getSlGroupId('b'),
			getSlFirstObjectId('b'),
			getPieceGroupId('b_1'),
			getPieceFirstObjectId('b_1'),
			getPieceGroupId('b_trans'),
			getPieceFirstObjectId('b_trans')
		].sort())

		const grpA = res.find(o => o._id === getSlGroupId('a'))
		expect(grpA).not.undefined
		expect(grpA.trigger).eql({ type: TriggerType.TIME_ABSOLUTE, value: 700 })
		expect(grpA.duration).eql(1670)

		const grpB = res.find(o => o._id === getSlGroupId('b'))
		expect(grpB).not.undefined
		expect(grpB.trigger).eql({ type: TriggerType.TIME_RELATIVE, value: `#${getSlGroupId('a')}.end - 1070` })
		expect(grpB.duration).eql(0)

		const grpBTrans = res.find(o => o._id === getPieceGroupId('b_trans'))
		expect(grpBTrans).not.undefined
		expect(grpBTrans.trigger).eql({ type: TriggerType.TIME_ABSOLUTE, value: 200 })
		expect(grpBTrans.duration).eql(2500)

		const grpB1 = res.find(o => o._id === getPieceGroupId('b_1'))
		expect(grpB1).not.undefined
		expect(grpB1.trigger).eql({ type: TriggerType.TIME_RELATIVE, value: `#${getPieceGroupId('b_trans')}.start - 200` })
		expect(grpB1.duration).eql(0)
	})

	it('Overlap - next is "fast" transition no gap', function () {
		const rundownData = createBasicNextTransitionScenario(500, 300, 400)

		const res = buildTimelineObjsForRundown(rundownData, [])
		expect(res).not.empty

		const ids = res.map(o => o._id)
		expect(ids.sort()).eql([
			'mock_status',
			getSlGroupId('a'),
			getSlFirstObjectId('a'),
			getPieceGroupId('a_1'),
			getPieceFirstObjectId('a_1'),
			getSlGroupId('b'),
			getSlFirstObjectId('b'),
			getPieceGroupId('b_1'),
			getPieceFirstObjectId('b_1'),
			getPieceGroupId('b_trans'),
			getPieceFirstObjectId('b_trans')
		].sort())

		const grpA = res.find(o => o._id === getSlGroupId('a'))
		expect(grpA).not.undefined
		expect(grpA.trigger).eql({ type: TriggerType.TIME_ABSOLUTE, value: 700 })
		expect(grpA.duration).eql(1670)

		const grpB = res.find(o => o._id === getSlGroupId('b'))
		expect(grpB).not.undefined
		expect(grpB.trigger).eql({ type: TriggerType.TIME_RELATIVE, value: `#${getSlGroupId('a')}.end - 1270` })
		expect(grpB.duration).eql(0)

		const grpBTrans = res.find(o => o._id === getPieceGroupId('b_trans'))
		expect(grpBTrans).not.undefined
		expect(grpBTrans.trigger).eql({ type: TriggerType.TIME_ABSOLUTE, value: 200 })
		expect(grpBTrans.duration).eql(2500)

		const grpB1 = res.find(o => o._id === getPieceGroupId('b_1'))
		expect(grpB1).not.undefined
		expect(grpB1.trigger).eql({ type: TriggerType.TIME_RELATIVE, value: `#${getPieceGroupId('b_trans')}.start - 200` })
		expect(grpB1.duration).eql(0)
	})

})
