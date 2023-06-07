import {
	IBlueprintPieceDB,
	IBlueprintResolvedPieceInstance,
	PieceLifespan,
} from '@sofie-automation/blueprints-integration'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { resolveAbSessions, SessionToPlayerMap } from '../abPlayback'
import { ABResolverOptions } from '../abPlaybackResolver'
import { AbSessionHelper } from '../helper'

const POOL_NAME = 'clip'

const resolverOptions: ABResolverOptions = {
	idealGapBefore: 1000,
	nowWindow: 2000,
}

function createBasicResolvedPieceInstance(
	id: string,
	start: number,
	duration: number | undefined,
	reqId: string | undefined,
	optional?: boolean
): IBlueprintResolvedPieceInstance {
	const piece = literal<IBlueprintPieceDB>({
		_id: id,
		externalId: id,
		name: id,
		enable: {
			start,
		},
		sourceLayerId: '',
		outputLayerId: '',
		metaData: {},
		lifespan: PieceLifespan.WithinPart,
		content: {
			timelineObjects: [],
		},
	})

	if (reqId !== undefined) {
		piece.abSessions = [
			{
				name: reqId,
				pool: POOL_NAME,
				optional: optional,
			},
		]
	}

	return literal<IBlueprintResolvedPieceInstance>({
		_id: `inst_${id}`,
		partInstanceId: '',
		piece,
		resolvedStart: start,
		resolvedDuration: duration,
	})
}

describe('resolveMediaPlayers', () => {
	// TODO - rework this to use an interface instead of mocking the methods
	const context = new AbSessionHelper([], [], [])

	const mockGetPieceSessionId: jest.MockedFunction<typeof context.getPieceABSessionId> = jest.fn()
	const mockGetObjectSessionId: jest.MockedFunction<typeof context.getTimelineObjectAbSessionId> = jest.fn()

	context.getPieceABSessionId = mockGetPieceSessionId
	context.getTimelineObjectAbSessionId = mockGetObjectSessionId

	beforeEach(() => {
		mockGetPieceSessionId.mockReset().mockImplementation(() => {
			throw new Error('Method not implemented.')
		})
		mockGetObjectSessionId.mockReset().mockImplementation(() => {
			throw new Error('Method not implemented.')
		})
	})

	test('no pieces', () => {
		const assignments = resolveAbSessions(context, resolverOptions, [], [], {}, POOL_NAME, [1, 2], 5000)
		expect(assignments.failedRequired).toHaveLength(0)
		expect(assignments.failedOptional).toHaveLength(0)
		expect(assignments.requests).toHaveLength(0)
	})

	test('basic pieces', () => {
		const previousAssignments = {}
		const pieces = [
			createBasicResolvedPieceInstance('0', 400, 5000, 'abc'),
			createBasicResolvedPieceInstance('1', 400, 5000, 'def'),
			createBasicResolvedPieceInstance('2', 800, 4000, 'ghi'),
		]

		mockGetPieceSessionId.mockImplementation((piece, name) => `${piece._id}_${name}`)

		const assignments = resolveAbSessions(
			context,
			resolverOptions,
			pieces,
			[],
			previousAssignments,
			POOL_NAME,
			[1, 2],
			4500
		)
		expect(assignments.failedRequired).toEqual(['inst_2_clip_ghi'])
		expect(assignments.failedOptional).toHaveLength(0)
		expect(assignments.requests).toHaveLength(3)
		expect(assignments.requests).toEqual([
			{ end: 5400, id: 'inst_0_clip_abc', player: 1, start: 400, optional: false },
			{ end: 5400, id: 'inst_1_clip_def', player: 2, start: 400, optional: false },
			{ end: 4800, id: 'inst_2_clip_ghi', player: undefined, start: 800, optional: false }, // Massive overlap
		])

		expect(mockGetPieceSessionId).toHaveBeenCalledTimes(3)
		expect(mockGetObjectSessionId).toHaveBeenCalledTimes(0)
		expect(mockGetPieceSessionId).toHaveBeenNthCalledWith(1, pieces[0], 'clip_abc')
		expect(mockGetPieceSessionId).toHaveBeenNthCalledWith(2, pieces[1], 'clip_def')
		expect(mockGetPieceSessionId).toHaveBeenNthCalledWith(3, pieces[2], 'clip_ghi')
	})

	test('Multiple pieces same id', () => {
		const previousAssignments = {}
		const pieces = [
			createBasicResolvedPieceInstance('0', 400, 5000, 'abc'), // First
			createBasicResolvedPieceInstance('1', 800, 4000, 'abc'), // Overlap
			createBasicResolvedPieceInstance('2', 5400, 1000, 'abc'), // Flush with last
			createBasicResolvedPieceInstance('3', 6400, 1000, 'abc'), // Gap before
		]

		mockGetPieceSessionId.mockImplementation((_piece, name) => `tmp_${name}`)

		const assignments = resolveAbSessions(
			context,
			resolverOptions,
			pieces,
			[],
			previousAssignments,
			POOL_NAME,
			[1, 2],
			2500
		)
		expect(assignments.failedRequired).toHaveLength(0)
		expect(assignments.failedOptional).toHaveLength(0)
		expect(assignments.requests).toHaveLength(1)
		expect(assignments.requests).toEqual([
			{ end: 7400, id: 'tmp_clip_abc', player: 1, start: 400, optional: false },
		])

		expect(mockGetPieceSessionId).toHaveBeenCalledTimes(4)
		expect(mockGetObjectSessionId).toHaveBeenCalledTimes(0)
		expect(mockGetPieceSessionId).toHaveBeenNthCalledWith(1, pieces[0], 'clip_abc')
		expect(mockGetPieceSessionId).toHaveBeenNthCalledWith(2, pieces[1], 'clip_abc')
		expect(mockGetPieceSessionId).toHaveBeenNthCalledWith(3, pieces[2], 'clip_abc')
		expect(mockGetPieceSessionId).toHaveBeenNthCalledWith(4, pieces[3], 'clip_abc')
	})

	test('Reuse after gap', () => {
		const previousAssignments = {}
		const pieces = [
			createBasicResolvedPieceInstance('0', 400, 5000, 'abc'), // First
			createBasicResolvedPieceInstance('1', 800, 4000, 'def'), // Second
			createBasicResolvedPieceInstance('3', 6400, 1000, 'ghi'), // Wait, then reuse first
		]

		mockGetPieceSessionId.mockImplementation((piece, name) => `${piece._id}_${name}`)

		const assignments = resolveAbSessions(
			context,
			resolverOptions,
			pieces,
			[],
			previousAssignments,
			POOL_NAME,
			[1, 2],
			2500
		)
		expect(assignments.failedRequired).toHaveLength(0)
		expect(assignments.failedOptional).toHaveLength(0)
		expect(assignments.requests).toHaveLength(3)
		expect(assignments.requests).toEqual([
			{ end: 5400, id: 'inst_0_clip_abc', player: 1, start: 400, optional: false },
			{ end: 4800, id: 'inst_1_clip_def', player: 2, start: 800, optional: false },
			{ end: 7400, id: 'inst_3_clip_ghi', player: 2, start: 6400, optional: false },
		])

		expect(mockGetPieceSessionId).toHaveBeenCalledTimes(3)
		expect(mockGetObjectSessionId).toHaveBeenCalledTimes(0)
		expect(mockGetPieceSessionId).toHaveBeenNthCalledWith(1, pieces[0], 'clip_abc')
		expect(mockGetPieceSessionId).toHaveBeenNthCalledWith(2, pieces[1], 'clip_def')
		expect(mockGetPieceSessionId).toHaveBeenNthCalledWith(3, pieces[2], 'clip_ghi')
	})

	test('Reuse immediately', () => {
		const previousAssignments = {}
		const pieces = [
			createBasicResolvedPieceInstance('0', 400, 5000, 'abc'), // First
			createBasicResolvedPieceInstance('1', 800, 6000, 'def'), // Second
			createBasicResolvedPieceInstance('3', 5400, 1000, 'ghi'), // Wait, then reuse first
		]

		mockGetPieceSessionId.mockImplementation((piece, name) => `${piece._id}_${name}`)

		const assignments = resolveAbSessions(
			context,
			resolverOptions,
			pieces,
			[],
			previousAssignments,
			POOL_NAME,
			[1, 2],
			2500
		)
		expect(assignments.failedRequired).toHaveLength(0)
		expect(assignments.failedOptional).toHaveLength(0)
		expect(assignments.requests).toHaveLength(3)
		expect(assignments.requests).toEqual([
			{ end: 5400, id: 'inst_0_clip_abc', player: 1, start: 400, optional: false },
			{ end: 6800, id: 'inst_1_clip_def', player: 2, start: 800, optional: false },
			{ end: 6400, id: 'inst_3_clip_ghi', player: 1, start: 5400, optional: false },
		])

		expect(mockGetPieceSessionId).toHaveBeenCalledTimes(3)
		expect(mockGetObjectSessionId).toHaveBeenCalledTimes(0)
		expect(mockGetPieceSessionId).toHaveBeenNthCalledWith(1, pieces[0], 'clip_abc')
		expect(mockGetPieceSessionId).toHaveBeenNthCalledWith(2, pieces[1], 'clip_def')
		expect(mockGetPieceSessionId).toHaveBeenNthCalledWith(3, pieces[2], 'clip_ghi')
	})

	test('Reuse immediately dense', () => {
		const previousAssignments = {}
		const pieces = [
			createBasicResolvedPieceInstance('0', 400, 5000, 'abc'), // First
			createBasicResolvedPieceInstance('1', 800, 6000, 'def'), // Second
			createBasicResolvedPieceInstance('3', 5400, 1000, 'ghi'), // Wait, then reuse first
		]

		mockGetPieceSessionId.mockImplementation((piece, name) => `${piece._id}_${name}`)

		const assignments = resolveAbSessions(
			context,
			resolverOptions,
			pieces,
			[],
			previousAssignments,
			POOL_NAME,
			[1, 2],
			4000
		)
		expect(assignments.failedRequired).toHaveLength(0)
		expect(assignments.failedOptional).toHaveLength(0)
		expect(assignments.requests).toHaveLength(3)
		expect(assignments.requests).toEqual([
			{ end: 5400, id: 'inst_0_clip_abc', player: 1, start: 400, optional: false },
			{ end: 6800, id: 'inst_1_clip_def', player: 2, start: 800, optional: false },
			{ end: 6400, id: 'inst_3_clip_ghi', player: 1, start: 5400, optional: false },
		])

		expect(mockGetPieceSessionId).toHaveBeenCalledTimes(3)
		expect(mockGetObjectSessionId).toHaveBeenCalledTimes(0)
		expect(mockGetPieceSessionId).toHaveBeenNthCalledWith(1, pieces[0], 'clip_abc')
		expect(mockGetPieceSessionId).toHaveBeenNthCalledWith(2, pieces[1], 'clip_def')
		expect(mockGetPieceSessionId).toHaveBeenNthCalledWith(3, pieces[2], 'clip_ghi')
	})

	test('basic reassignment', () => {
		const previousAssignments: SessionToPlayerMap = {
			inst_0_clip_abc: {
				sessionId: 'inst_0_clip_abc',
				slotId: 5,
				lookahead: false,
				_rank: 1,
			},
			inst_1_clip_def: {
				sessionId: 'inst_1_clip_def',
				slotId: 3,
				lookahead: true,
				_rank: 2,
			},
		}
		const pieces = [
			createBasicResolvedPieceInstance('0', 2400, 5000, 'abc'),
			createBasicResolvedPieceInstance('1', 2400, 5000, 'def'),
			createBasicResolvedPieceInstance('2', 2800, 4000, 'ghi'),
		]

		mockGetPieceSessionId.mockImplementation((piece, name) => `${piece._id}_${name}`)

		const assignments = resolveAbSessions(
			context,
			resolverOptions,
			pieces,
			[],
			previousAssignments,
			POOL_NAME,
			[1, 2],
			0
		)
		expect(assignments.failedRequired).toHaveLength(0)
		expect(assignments.failedOptional).toHaveLength(0)
		expect(assignments.requests).toHaveLength(3)
		expect(assignments.requests).toEqual([
			{ end: 7400, id: 'inst_0_clip_abc', player: 5, start: 2400, optional: false },
			{ end: 7400, id: 'inst_1_clip_def', player: 3, start: 2400, optional: false },
			{ end: 6800, id: 'inst_2_clip_ghi', player: 1, start: 2800, optional: false },
		])

		expect(mockGetPieceSessionId).toHaveBeenCalledTimes(3)
		expect(mockGetObjectSessionId).toHaveBeenCalledTimes(0)
		expect(mockGetPieceSessionId).toHaveBeenNthCalledWith(1, pieces[0], 'clip_abc')
		expect(mockGetPieceSessionId).toHaveBeenNthCalledWith(2, pieces[1], 'clip_def')
		expect(mockGetPieceSessionId).toHaveBeenNthCalledWith(3, pieces[2], 'clip_ghi')
	})

	test('optional gets discarded', () => {
		const previousAssignments: SessionToPlayerMap = {
			inst_0_clip_abc: {
				sessionId: 'inst_0_clip_abc',
				slotId: 2,
				lookahead: false,
				_rank: 1,
			},
			inst_1_clip_def: {
				sessionId: 'inst_1_clip_def',
				slotId: 1,
				lookahead: false,
				_rank: 2,
			},
		}
		const pieces = [
			createBasicResolvedPieceInstance('0', 2400, 5000, 'abc'),
			createBasicResolvedPieceInstance('1', 2400, 5000, 'def', true),
			createBasicResolvedPieceInstance('2', 2800, 4000, 'ghi'),
		]

		mockGetPieceSessionId.mockImplementation((piece, name) => `${piece._id}_${name}`)

		const assignments = resolveAbSessions(
			context,
			resolverOptions,
			pieces,
			[],
			previousAssignments,
			POOL_NAME,
			[1, 2],
			0
		)
		expect(assignments.failedRequired).toHaveLength(0)
		expect(assignments.failedOptional).toEqual(['inst_1_clip_def'])
		expect(assignments.requests).toHaveLength(3)
		expect(assignments.requests).toEqual([
			{ end: 7400, id: 'inst_0_clip_abc', player: 2, start: 2400, optional: false },
			{ end: 7400, id: 'inst_1_clip_def', player: undefined, start: 2400, optional: true },
			{ end: 6800, id: 'inst_2_clip_ghi', player: 1, start: 2800, optional: false },
		])

		expect(mockGetPieceSessionId).toHaveBeenCalledTimes(3)
		expect(mockGetObjectSessionId).toHaveBeenCalledTimes(0)
		expect(mockGetPieceSessionId).toHaveBeenNthCalledWith(1, pieces[0], 'clip_abc')
		expect(mockGetPieceSessionId).toHaveBeenNthCalledWith(2, pieces[1], 'clip_def')
		expect(mockGetPieceSessionId).toHaveBeenNthCalledWith(3, pieces[2], 'clip_ghi')
	})

	// TODO add some tests which check lookahead
})
