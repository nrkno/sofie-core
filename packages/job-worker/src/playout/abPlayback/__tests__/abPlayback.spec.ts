import {
	ABResolverConfiguration,
	ABResolverOptions,
	IBlueprintPieceType,
	PieceLifespan,
	TSR,
} from '@sofie-automation/blueprints-integration'
import { EmptyPieceTimelineObjectsBlob, PieceStatusCode } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { PieceInstancePiece, ResolvedPieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { ABSessionAssignments } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { OnGenerateTimelineObjExt } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { CommonContext } from '../../../blueprints/context'
import { AssignmentResult, resolveAbAssignmentsFromRequests, SessionRequest } from '../abPlaybackResolver'
import { calculateSessionTimeRanges } from '../abPlaybackSessions'
import { AbSessionHelper } from '../abSessionHelper'
import { applyAbPlayerObjectAssignments } from '../applyAssignments'

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
): ResolvedPieceInstance {
	const piece = literal<PieceInstancePiece>({
		_id: protectString(id),
		externalId: id,
		name: id,
		enable: {
			start,
		},
		sourceLayerId: '',
		outputLayerId: '',
		metaData: {},
		lifespan: PieceLifespan.WithinPart,
		timelineObjectsString: EmptyPieceTimelineObjectsBlob,
		content: {},
		invalid: false,
		startPartId: protectString(''),
		status: PieceStatusCode.UNKNOWN,
		pieceType: IBlueprintPieceType.Normal,
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

	return literal<ResolvedPieceInstance>({
		_id: protectString(`inst_${id}`),
		partInstanceId: protectString(''),
		rundownId: protectString(''),
		playlistActivationId: protectString(''),
		piece,
		resolvedStart: start,
		resolvedDuration: duration,
	})
}

function resolveAbSessions(
	abSessionHelper: AbSessionHelper,
	resolverOptions: ABResolverOptions,
	resolvedPieces: ResolvedPieceInstance[],
	timelineObjs: OnGenerateTimelineObjExt[],
	previousAssignmentMap: ABSessionAssignments,
	sessionPool: string,
	playerIds: number[],
	now: number
): AssignmentResult {
	const sessionRequests = calculateSessionTimeRanges(
		abSessionHelper,
		resolvedPieces,
		timelineObjs,
		previousAssignmentMap,
		sessionPool
	)

	return resolveAbAssignmentsFromRequests(resolverOptions, playerIds, sessionRequests, now)
}

describe('resolveMediaPlayers', () => {
	// TODO - rework this to use an interface instead of mocking the methods
	const abSessionHelper = new AbSessionHelper([], [])

	const mockGetPieceSessionId: jest.MockedFunction<typeof abSessionHelper.getPieceABSessionId> = jest.fn()
	const mockGetObjectSessionId: jest.MockedFunction<typeof abSessionHelper.getTimelineObjectAbSessionId> = jest.fn()

	abSessionHelper.getPieceABSessionId = mockGetPieceSessionId
	abSessionHelper.getTimelineObjectAbSessionId = mockGetObjectSessionId

	beforeEach(() => {
		mockGetPieceSessionId.mockReset().mockImplementation(() => {
			throw new Error('Method not implemented.')
		})
		mockGetObjectSessionId.mockReset().mockImplementation(() => {
			throw new Error('Method not implemented.')
		})
	})

	test('no pieces', () => {
		const assignments = resolveAbSessions(abSessionHelper, resolverOptions, [], [], {}, POOL_NAME, [1, 2], 5000)
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
			abSessionHelper,
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
			{ end: 5400, id: 'inst_0_clip_abc', playerId: 1, start: 400, optional: false },
			{ end: 5400, id: 'inst_1_clip_def', playerId: 2, start: 400, optional: false },
			{ end: 4800, id: 'inst_2_clip_ghi', playerId: undefined, start: 800, optional: false }, // Massive overlap
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
			abSessionHelper,
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
			{ end: 7400, id: 'tmp_clip_abc', playerId: 1, start: 400, optional: false },
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
			abSessionHelper,
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
			{ end: 5400, id: 'inst_0_clip_abc', playerId: 1, start: 400, optional: false },
			{ end: 4800, id: 'inst_1_clip_def', playerId: 2, start: 800, optional: false },
			{ end: 7400, id: 'inst_3_clip_ghi', playerId: 2, start: 6400, optional: false },
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
			abSessionHelper,
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
			{ end: 5400, id: 'inst_0_clip_abc', playerId: 1, start: 400, optional: false },
			{ end: 6800, id: 'inst_1_clip_def', playerId: 2, start: 800, optional: false },
			{ end: 6400, id: 'inst_3_clip_ghi', playerId: 1, start: 5400, optional: false },
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
			abSessionHelper,
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
			{ end: 5400, id: 'inst_0_clip_abc', playerId: 1, start: 400, optional: false },
			{ end: 6800, id: 'inst_1_clip_def', playerId: 2, start: 800, optional: false },
			{ end: 6400, id: 'inst_3_clip_ghi', playerId: 1, start: 5400, optional: false },
		])

		expect(mockGetPieceSessionId).toHaveBeenCalledTimes(3)
		expect(mockGetObjectSessionId).toHaveBeenCalledTimes(0)
		expect(mockGetPieceSessionId).toHaveBeenNthCalledWith(1, pieces[0], 'clip_abc')
		expect(mockGetPieceSessionId).toHaveBeenNthCalledWith(2, pieces[1], 'clip_def')
		expect(mockGetPieceSessionId).toHaveBeenNthCalledWith(3, pieces[2], 'clip_ghi')
	})

	test('basic reassignment', () => {
		const previousAssignments: ABSessionAssignments = {
			inst_0_clip_abc: {
				sessionId: 'inst_0_clip_abc',
				playerId: 5,
				lookahead: false,
				_rank: 1,
			},
			inst_1_clip_def: {
				sessionId: 'inst_1_clip_def',
				playerId: 3,
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
			abSessionHelper,
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
			{ end: 7400, id: 'inst_0_clip_abc', playerId: 5, start: 2400, optional: false },
			{ end: 7400, id: 'inst_1_clip_def', playerId: 3, start: 2400, optional: false },
			{ end: 6800, id: 'inst_2_clip_ghi', playerId: 1, start: 2800, optional: false },
		])

		expect(mockGetPieceSessionId).toHaveBeenCalledTimes(3)
		expect(mockGetObjectSessionId).toHaveBeenCalledTimes(0)
		expect(mockGetPieceSessionId).toHaveBeenNthCalledWith(1, pieces[0], 'clip_abc')
		expect(mockGetPieceSessionId).toHaveBeenNthCalledWith(2, pieces[1], 'clip_def')
		expect(mockGetPieceSessionId).toHaveBeenNthCalledWith(3, pieces[2], 'clip_ghi')
	})

	test('optional gets discarded', () => {
		const previousAssignments: ABSessionAssignments = {
			inst_0_clip_abc: {
				sessionId: 'inst_0_clip_abc',
				playerId: 2,
				lookahead: false,
				_rank: 1,
			},
			inst_1_clip_def: {
				sessionId: 'inst_1_clip_def',
				playerId: 1,
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
			abSessionHelper,
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
			{ end: 7400, id: 'inst_0_clip_abc', playerId: 2, start: 2400, optional: false },
			{ end: 7400, id: 'inst_1_clip_def', playerId: undefined, start: 2400, optional: true },
			{ end: 6800, id: 'inst_2_clip_ghi', playerId: 1, start: 2800, optional: false },
		])

		expect(mockGetPieceSessionId).toHaveBeenCalledTimes(3)
		expect(mockGetObjectSessionId).toHaveBeenCalledTimes(0)
		expect(mockGetPieceSessionId).toHaveBeenNthCalledWith(1, pieces[0], 'clip_abc')
		expect(mockGetPieceSessionId).toHaveBeenNthCalledWith(2, pieces[1], 'clip_def')
		expect(mockGetPieceSessionId).toHaveBeenNthCalledWith(3, pieces[2], 'clip_ghi')
	})

	// TODO add some tests which check lookahead
})

describe('applyMediaPlayersAssignments', () => {
	const abSessionHelper = new AbSessionHelper([], [])

	const mockGetPieceSessionId: jest.MockedFunction<typeof abSessionHelper.getPieceABSessionId> = jest.fn()
	const mockGetObjectSessionId: jest.MockedFunction<typeof abSessionHelper.getTimelineObjectAbSessionId> = jest.fn()

	const context = new CommonContext({
		name: 'test',
		identifier: 'test',
	})

	const abConfiguration: Pick<ABResolverConfiguration, 'timelineObjectLayerChangeRules' | 'customApplyToObject'> = {}

	abSessionHelper.getPieceABSessionId = mockGetPieceSessionId
	abSessionHelper.getTimelineObjectAbSessionId = mockGetObjectSessionId
	beforeEach(() => {
		mockGetPieceSessionId.mockReset().mockImplementation(() => {
			throw new Error('Method not implemented.')
		})
		mockGetObjectSessionId.mockReset().mockImplementation(() => {
			throw new Error('Method not implemented.')
		})
	})

	test('no assignments', () => {
		const res = applyAbPlayerObjectAssignments(abSessionHelper, context, abConfiguration, [], {}, [], POOL_NAME)
		expect(res).toEqual({})
	})

	test('only previous assignments', () => {
		const previousAssignments: ABSessionAssignments = {
			abc: {
				sessionId: 'abc',
				playerId: 5,
				lookahead: false,
				_rank: 1,
			},
			def: {
				sessionId: 'def',
				playerId: 3,
				lookahead: true,
				_rank: 2,
			},
		}

		const res = applyAbPlayerObjectAssignments(
			abSessionHelper,
			context,
			abConfiguration,
			[],
			previousAssignments,
			[],
			POOL_NAME
		)
		expect(res).toEqual({})
	})

	test('object with unmatched assignments', () => {
		const previousAssignments: ABSessionAssignments = {
			piece0_clip_def: {
				sessionId: 'piece0_clip_def',
				playerId: 3,
				lookahead: false,
				_rank: 1,
			},
		}
		const pieceInstanceId = 'piece0'
		const partInstanceId = protectString('part0')

		mockGetObjectSessionId.mockImplementation((obj, name) => `${obj.pieceInstanceId}_${name}`)

		const objects = [
			literal<OnGenerateTimelineObjExt>({
				// This should not get assigned, as it is truely unknown, and could cause all kinds of chaos
				id: '0',
				layer: '0',
				enable: {
					start: 900,
					duration: 1000,
				},
				content: {
					deviceType: TSR.DeviceType.ABSTRACT,
				},
				abSessions: [
					{
						name: 'abc',
						pool: POOL_NAME,
					},
				],
				metaData: null,
				pieceInstanceId: pieceInstanceId,
				partInstanceId: partInstanceId,
			}),
			literal<OnGenerateTimelineObjExt>({
				// This should get assigned, as it was previously known
				id: '1',
				layer: '1',
				enable: {
					start: 3000,
					duration: 1000,
				},
				content: {
					deviceType: TSR.DeviceType.ABSTRACT,
				},
				abSessions: [
					{
						name: 'def',
						pool: POOL_NAME,
					},
				],
				metaData: null,
				pieceInstanceId: pieceInstanceId,
				partInstanceId: partInstanceId,
			}),
		]

		const res = applyAbPlayerObjectAssignments(
			abSessionHelper,
			context,
			abConfiguration,
			objects,
			previousAssignments,
			[],
			POOL_NAME
		)
		// expect(context._getNotes()).toHaveLength(0)
		expect(res).toMatchObject({
			piece0_clip_def: {
				sessionId: 'piece0_clip_def',
				playerId: 3,
				lookahead: false,
			},
		})
	})

	// TODO - more tests
})

describe('resolveAbAssignmentsFromRequests', () => {
	const TWO_SLOTS = [1, 2]
	const THREE_SLOTS = [1, 2, 3]

	function expectGotPlayer(res: AssignmentResult, id: string, playerId: number | undefined): void {
		const req = res.requests.find((r) => r.id === id)
		expect(req).toBeTruthy()
		expect(req?.playerId).toEqual(playerId)
	}

	test('No pending should do nothing', () => {
		const requests: SessionRequest[] = [
			// Note: these should all collide
			{
				id: 'a',
				start: 1000,
				end: undefined,
				playerId: 1,
			},
			{
				id: 'b',
				start: 1000,
				end: undefined,
				playerId: 1,
			},
			{
				id: 'c',
				start: 1000,
				end: undefined,
				playerId: 1,
			},
		]

		const res = resolveAbAssignmentsFromRequests(resolverOptions, TWO_SLOTS, requests, 10000)
		expect(res).toBeTruthy()
		expect(res.failedOptional).toEqual([])
		expect(res.failedRequired).toEqual([])
		expect(res.requests).toEqual(requests)
	})

	test('Very basic scenario', () => {
		const requests: SessionRequest[] = [
			{
				id: 'a',
				start: 1000,
				end: undefined,
			},
			{
				id: 'b',
				start: 2000,
				end: undefined,
			},
		]

		const res = resolveAbAssignmentsFromRequests(resolverOptions, TWO_SLOTS, requests, 10000)
		expect(res).toBeTruthy()
		expect(res.failedOptional).toEqual([])
		expect(res.failedRequired).toEqual([])
		expectGotPlayer(res, 'a', 1)
		expectGotPlayer(res, 'b', 2)
	})

	test('Very basic scenario - sticky', () => {
		const requests: SessionRequest[] = [
			{
				id: 'a',
				start: 1000,
				end: undefined,
				playerId: 2,
			},
			{
				id: 'b',
				start: 2000,
				end: undefined,
			},
		]

		const res = resolveAbAssignmentsFromRequests(resolverOptions, TWO_SLOTS, requests, 10000)
		expect(res).toBeTruthy()
		expect(res.failedOptional).toEqual([])
		expect(res.failedRequired).toEqual([])
		expectGotPlayer(res, 'a', 2)
		expectGotPlayer(res, 'b', 1)
	})

	test('Very basic collision', () => {
		const requests: SessionRequest[] = [
			{
				id: 'a',
				start: 1000,
				end: undefined,
			},
			{
				id: 'b',
				start: 2000,
				end: undefined,
			},
			{
				id: 'c',
				start: 3000,
				end: undefined,
			},
		]

		const res = resolveAbAssignmentsFromRequests(resolverOptions, TWO_SLOTS, requests, 10000)
		expect(res).toBeTruthy()
		expect(res.failedOptional).toEqual([])
		expect(res.failedRequired).toEqual(['c'])
		expectGotPlayer(res, 'a', 1)
		expectGotPlayer(res, 'b', 2)
		expectGotPlayer(res, 'c', undefined)
	})

	test('Very basic collision - sticky', () => {
		const requests: SessionRequest[] = [
			{
				id: 'a',
				start: 1000,
				end: undefined,
				playerId: 2,
			},
			{
				id: 'b',
				start: 2000,
				end: undefined,
			},
			{
				id: 'c',
				start: 3000,
				end: undefined,
				playerId: 1,
			},
		]

		const res = resolveAbAssignmentsFromRequests(resolverOptions, TWO_SLOTS, requests, 10000)
		expect(res).toBeTruthy()
		expect(res.failedOptional).toEqual([])
		expect(res.failedRequired).toEqual(['b'])
		expectGotPlayer(res, 'a', 2)
		expectGotPlayer(res, 'b', undefined)
		expectGotPlayer(res, 'c', 1)
	})

	test('Immediate playback', () => {
		const requests: SessionRequest[] = [
			{
				id: 'a',
				start: 1000,
				end: 10000,
				playerId: 2,
			},
			{
				id: 'b',
				start: 2000,
				end: 10500,
				playerId: 1,
			},
			{
				id: 'c',
				start: 10900,
				end: undefined,
			},
			{
				id: 'd',
				start: 10950,
				end: undefined,
			},
		]

		const res = resolveAbAssignmentsFromRequests(resolverOptions, TWO_SLOTS, requests, 10000)
		expect(res).toBeTruthy()
		expect(res.failedOptional).toEqual([])
		expect(res.failedRequired).toEqual([])
		expectGotPlayer(res, 'a', 2)
		expectGotPlayer(res, 'b', 1)
		expectGotPlayer(res, 'c', 1)
		expectGotPlayer(res, 'd', 2)
	})

	test('Immediate playback - gaps before', () => {
		const requests: SessionRequest[] = [
			{
				id: 'a',
				start: 1000,
				end: 9000,
				playerId: 2,
			},
			{
				id: 'b',
				start: 2000,
				end: 8500,
				playerId: 1,
			},
			{
				id: 'c',
				start: 10900,
				end: undefined,
			},
			{
				id: 'd',
				start: 10950,
				end: undefined,
			},
		]

		const res = resolveAbAssignmentsFromRequests(resolverOptions, TWO_SLOTS, requests, 10000)
		expect(res).toBeTruthy()
		expect(res.failedOptional).toEqual([])
		expect(res.failedRequired).toEqual([])
		expectGotPlayer(res, 'a', 2)
		expectGotPlayer(res, 'b', 1)
		expectGotPlayer(res, 'c', 1)
		expectGotPlayer(res, 'd', 2)
	})

	test('Future request', () => {
		const requests: SessionRequest[] = [
			{
				id: 'a',
				start: 1000,
				end: 15000,
				playerId: 3,
			},
			{
				id: 'b',
				start: 2000,
				end: 16000,
				playerId: 1,
			},
			{
				id: 'c',
				start: 20000,
				end: 40000,
			},
			{
				id: 'd',
				start: 30000,
				end: undefined,
				playerId: 1,
			},
			{
				id: 'e',
				start: 35000,
				end: undefined,
			},
		]

		const res = resolveAbAssignmentsFromRequests(resolverOptions, THREE_SLOTS, requests, 10000)
		expect(res).toBeTruthy()
		expect(res.failedOptional).toEqual([])
		expect(res.failedRequired).toEqual([])
		expectGotPlayer(res, 'a', 3)
		expectGotPlayer(res, 'b', 1)
		expectGotPlayer(res, 'c', 2)
		expectGotPlayer(res, 'd', 1)
		expectGotPlayer(res, 'e', 3)
	})

	test('Run adlib bak', () => {
		const requests: SessionRequest[] = [
			// current part
			{
				id: 'a',
				start: 1000,
				end: undefined,
				playerId: 2,
			},
			// adlib
			{
				id: 'b',
				start: 10000,
				end: undefined,
			},
			// lookaheads
			{
				id: 'c',
				start: Number.POSITIVE_INFINITY,
				end: undefined,
				playerId: 1,
				lookaheadRank: 1,
			},
			{
				id: 'd',
				start: Number.POSITIVE_INFINITY,
				end: undefined,
				lookaheadRank: 2,
			},
		]

		const res = resolveAbAssignmentsFromRequests(resolverOptions, TWO_SLOTS, requests, 10000)
		expect(res).toBeTruthy()
		expect(res.failedOptional).toEqual([])
		expect(res.failedRequired).toEqual([])
		expectGotPlayer(res, 'a', 2)
		expectGotPlayer(res, 'b', 1)
		expectGotPlayer(res, 'c', undefined)
		expectGotPlayer(res, 'd', undefined)
	})

	test('Run adlib bts', () => {
		const requests: SessionRequest[] = [
			// current part
			{
				id: 'a',
				start: 1000,
				end: 10500,
				playerId: 2,
			},
			// adlib
			{
				id: 'b',
				start: 10000,
				end: undefined,
			},
			// lookaheads (in order of future use)
			{
				id: 'c',
				start: Number.POSITIVE_INFINITY,
				end: undefined,
				playerId: 1,
				lookaheadRank: 1,
			},
			{
				id: 'd',
				start: Number.POSITIVE_INFINITY,
				end: undefined,
				playerId: 2,
				lookaheadRank: 2,
			},
		]

		const res = resolveAbAssignmentsFromRequests(resolverOptions, TWO_SLOTS, requests, 10000)
		expect(res).toBeTruthy()
		expect(res.failedOptional).toEqual([])
		expect(res.failedRequired).toEqual([])
		expectGotPlayer(res, 'a', 2)
		expectGotPlayer(res, 'b', 1)
		expectGotPlayer(res, 'c', 2)
		expectGotPlayer(res, 'd', undefined)
	})
	test('Run adlib bts x2', () => {
		const requests: SessionRequest[] = [
			// current part
			{
				id: 'a',
				start: 1000,
				end: 9500,
				playerId: 2,
			},
			// adlib
			{
				id: 'b',
				start: 10000,
				end: undefined,
			},
			// adlib
			{
				id: 'e',
				start: 10000,
				end: undefined,
			},
			// lookaheads (in order of future use)
			{
				id: 'c',
				start: Number.POSITIVE_INFINITY,
				end: undefined,
				playerId: 1,
				lookaheadRank: 1,
			},
			{
				id: 'd',
				start: Number.POSITIVE_INFINITY,
				end: undefined,
				playerId: 2,
				lookaheadRank: 2,
			},
		]

		const res = resolveAbAssignmentsFromRequests(resolverOptions, TWO_SLOTS, requests, 10000)
		expect(res).toBeTruthy()
		expect(res.failedOptional).toEqual([])
		expect(res.failedRequired).toEqual([])
		expectGotPlayer(res, 'a', 2)
		expectGotPlayer(res, 'b', 1)
		expectGotPlayer(res, 'e', 2)
		expectGotPlayer(res, 'c', undefined)
		expectGotPlayer(res, 'd', undefined)
	})

	test('Autonext run bts', () => {
		const requests: SessionRequest[] = [
			// current part
			{
				id: 'a',
				start: 1000,
				end: 10500,
				playerId: 2,
			},
			// adlib
			{
				id: 'b',
				start: 10000,
				end: 20500,
			},
			// next part
			{
				id: 'a',
				start: 20000,
				end: undefined,
				playerId: 1,
			},
			// lookaheads (in order of future use)
			{
				id: 'c',
				start: Number.POSITIVE_INFINITY,
				end: undefined,
				playerId: 2,
				lookaheadRank: 1,
			},
			{
				id: 'd',
				start: Number.POSITIVE_INFINITY,
				end: undefined,
				lookaheadRank: 2,
			},
		]

		const res = resolveAbAssignmentsFromRequests(resolverOptions, TWO_SLOTS, requests, 10000)
		expect(res).toBeTruthy()
		expect(res.failedOptional).toEqual([])
		expect(res.failedRequired).toEqual([])
		expectGotPlayer(res, 'a', 2)
		expectGotPlayer(res, 'b', 1)
		expectGotPlayer(res, 'c', 2)
		expectGotPlayer(res, 'd', undefined)
	})

	test('Autonext run bts in 5s', () => {
		const requests: SessionRequest[] = [
			// current part
			{
				id: 'a',
				start: 1000,
				end: 10500,
				playerId: 2,
			},
			// adlib
			{
				id: 'b',
				start: 10000,
				end: 20500,
			},
			// next part
			{
				id: 'e',
				start: 20000,
				end: undefined,
				playerId: 1,
			},
			// lookaheads (in order of future use)
			{
				id: 'c',
				start: Number.POSITIVE_INFINITY,
				end: undefined,
				playerId: 2,
				lookaheadRank: 1,
			},
			{
				id: 'd',
				start: Number.POSITIVE_INFINITY,
				end: undefined,
				lookaheadRank: 2,
			},
		]

		const res = resolveAbAssignmentsFromRequests(resolverOptions, TWO_SLOTS, requests, 5000)
		expect(res).toBeTruthy()
		expect(res.failedOptional).toEqual([])
		expect(res.failedRequired).toEqual([])
		expectGotPlayer(res, 'a', 2)
		expectGotPlayer(res, 'b', 1)
		expectGotPlayer(res, 'e', 2)
		expectGotPlayer(res, 'c', 1)
		expectGotPlayer(res, 'd', undefined)
	})

	test('Preserve on-air optional over a required', () => {
		const requests: SessionRequest[] = [
			// current part
			{
				id: 'a',
				start: 1000,
				end: undefined,
				playerId: 2,
			},
			// bak
			{
				id: 'b',
				start: 5000,
				optional: true,
				playerId: 1,
				end: undefined,
			},
			// adlib
			{
				id: 'c',
				start: 10000,
				end: undefined,
			},
			// lookaheads
			{
				id: 'd',
				start: Number.POSITIVE_INFINITY,
				end: undefined,
				lookaheadRank: 1,
			},
			{
				id: 'e',
				start: Number.POSITIVE_INFINITY,
				end: undefined,
				lookaheadRank: 2,
			},
		]

		const res = resolveAbAssignmentsFromRequests(resolverOptions, TWO_SLOTS, requests, 10000)
		expect(res).toBeTruthy()
		expect(res.failedOptional).toEqual([])
		expect(res.failedRequired).toEqual(['c'])
		expectGotPlayer(res, 'a', 2)
		expectGotPlayer(res, 'b', 1)
		expectGotPlayer(res, 'c', undefined)
		expectGotPlayer(res, 'd', undefined)
	})
	test('Preserve visible lookahead assignment', () => {
		const requests: SessionRequest[] = [
			// current clip
			{
				id: 'a',
				start: 1000,
				end: undefined,
				playerId: 2,
			},
			// previous clip
			{
				id: 'b',
				start: 0,
				playerId: 1,
				end: 5000,
			},
			// lookaheads
			{
				id: 'd',
				start: Number.POSITIVE_INFINITY,
				end: undefined,
				lookaheadRank: 1,
			},
			{
				id: 'e',
				start: Number.POSITIVE_INFINITY,
				playerId: 3, // From before
				end: undefined,
				lookaheadRank: 2,
			},
			{
				id: 'f',
				start: Number.POSITIVE_INFINITY,
				end: undefined,
				lookaheadRank: 3,
			},
		]

		const res = resolveAbAssignmentsFromRequests(resolverOptions, THREE_SLOTS, requests, 10000)
		expect(res).toBeTruthy()
		expect(res.failedOptional).toEqual([])
		expect(res.failedRequired).toEqual([])
		expectGotPlayer(res, 'a', 2)
		expectGotPlayer(res, 'b', 1)
		expectGotPlayer(res, 'd', 1)
		expectGotPlayer(res, 'e', 3)
		expectGotPlayer(res, 'f', undefined)
	})
})
