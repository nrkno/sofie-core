import * as _ from 'underscore'
import { runInFiber } from '../../../../../__mocks__/Fibers'
import { testInFiber } from '../../../../../__mocks__/helpers/jest'
import { Rundowns, Rundown } from '../../../../../lib/collections/Rundowns'
import { Segments, DBSegment } from '../../../../../lib/collections/Segments'
import { Parts, DBPart } from '../../../../../lib/collections/Parts'
import { literal, saveIntoDb } from '../../../../../lib/lib'

import { UpdateNext } from '../updateNext'

import { ServerPlayoutAPI } from '../../../playout/playout'
jest.mock('../../../playout/playout')

require('../api.ts') // include in order to create the Meteor methods needed

const rundownId = 'mock_ro'
function createMockRO () {
	const existing = Rundowns.findOne(rundownId)
	if (existing) existing.remove()

	Rundowns.insert({
		_id: rundownId,
		externalId: 'mock_ro',
		name: 'Mock',
		studioId: '',
		showStyleBaseId: '',
		showStyleVariantId: '',
		peripheralDeviceId: '',
		dataSource: 'mock',
		created: 0,
		modified: 0,
		importVersions: {} as any,
		currentPartId: null,
		nextPartId: null,
		previousPartId: null,
	})

	saveIntoDb(Segments, {
		rundownId: rundownId
	}, [
		literal<DBSegment>({
			_id: 'mock_segment1',
			_rank: 1,
			externalId: 's1',
			rundownId: rundownId,
			name: 'Segment1'
		}),
		literal<DBSegment>({
			_id: 'mock_segment2',
			_rank: 2,
			externalId: 's2',
			rundownId: rundownId,
			name: 'Segment2'
		}),
		literal<DBSegment>({
			_id: 'mock_segment3',
			_rank: 3,
			externalId: 's3',
			rundownId: rundownId,
			name: 'Segment3'
		}),
		literal<DBSegment>({
			_id: 'mock_segment4',
			_rank: 4,
			externalId: 's4',
			rundownId: rundownId,
			name: 'Segment4'
		})
	])

	saveIntoDb(Parts, {
		rundownId: rundownId
	}, [
		// Segment 1
		literal<DBPart>({
			_id: 'mock_part1',
			_rank: 1,
			rundownId: rundownId,
			segmentId: 'mock_segment1',
			externalId: 'p1',
			title: 'Part 1',
			typeVariant: ''
		}),
		literal<DBPart>({
			_id: 'mock_part2',
			_rank: 2,
			rundownId: rundownId,
			segmentId: 'mock_segment1',
			externalId: 'p2',
			title: 'Part 2',
			typeVariant: ''
		}),
		literal<DBPart>({
			_id: 'mock_part3',
			_rank: 3,
			rundownId: rundownId,
			segmentId: 'mock_segment1',
			externalId: 'p3',
			title: 'Part 3',
			typeVariant: ''
		}),
		// Segment 2
		literal<DBPart>({
			_id: 'mock_part4',
			_rank: 4,
			rundownId: rundownId,
			segmentId: 'mock_segment2',
			externalId: 'p4',
			title: 'Part 4',
			typeVariant: ''
		}),
		literal<DBPart>({
			_id: 'mock_part5',
			_rank: 5,
			rundownId: rundownId,
			segmentId: 'mock_segment2',
			externalId: 'p5',
			title: 'Part 5',
			typeVariant: ''
		}),
		// Segment 3
		literal<DBPart>({
			_id: 'mock_part6',
			_rank: 6,
			rundownId: rundownId,
			segmentId: 'mock_segment3',
			externalId: 'p6',
			title: 'Part 6',
			typeVariant: ''
		}),
		// Segment 4
		literal<DBPart>({
			_id: 'mock_part7',
			_rank: 7,
			rundownId: rundownId,
			segmentId: 'mock_segment4',
			externalId: 'p7',
			title: 'Part 7',
			typeVariant: ''
		}),
		literal<DBPart>({
			_id: 'mock_part8',
			_rank: 8,
			rundownId: rundownId,
			segmentId: 'mock_segment4',
			externalId: 'p8',
			title: 'Part 8',
			typeVariant: ''
		}),
		literal<DBPart>({
			_id: 'mock_part9',
			_rank: 9,
			rundownId: rundownId,
			segmentId: 'mock_segment4',
			externalId: 'p9',
			title: 'Part 9',
			typeVariant: ''
		}),
	])

	return rundownId
}

describe('Test mos update next part helpers', () => {

	beforeAll(async () => {
		// const env = setupDefaultStudioEnvironment()
		await runInFiber(createMockRO)
	})
	beforeEach(() => {
		jest.clearAllMocks()
	})

	function resetPartIds (currentPartId: string | null, nextPartId: string | null, nextPartManual?: boolean) {
		Rundowns.update(rundownId, { $set: {
			nextPartId: nextPartId,
			currentPartId: currentPartId,
			previousPartId: null,
			nextPartManual: nextPartManual || false,
		}})
	}
	function getRundown () {
		const rundown = Rundowns.findOne(rundownId) as Rundown
		expect(rundown).toBeTruthy()
		return rundown
	}

	testInFiber('ensureNextPartIsValid: Start with null', () => {
		resetPartIds(null, null)

		UpdateNext.ensureNextPartIsValid(getRundown())

		expect(ServerPlayoutAPI.setNextPartInner).not.toHaveBeenCalled()
	})
	testInFiber('ensureNextPartIsValid: Missing next part', () => {
		resetPartIds('mock_part3', 'fake_part')

		UpdateNext.ensureNextPartIsValid(getRundown())

		expect(ServerPlayoutAPI.setNextPartInner).toHaveBeenCalledTimes(1)
		expect(ServerPlayoutAPI.setNextPartInner).toHaveBeenCalledWith(expect.objectContaining({ _id: rundownId }), expect.objectContaining({ _id: 'mock_part4' }))
		// expectNextPartId('mock_part4')
	})
	// testInFiber('ensureNextPartIsValid: Missing distant future part', () => {
	// 	resetPartIds('mock_part3', 'mock_part4')

	// 	UpdateNext.ensureNextPartIsValid(getRundown())

	// 	expectNextPartId(null)
	// })
	testInFiber('ensureNextPartIsValid: Missing current part with valid next', () => {
		resetPartIds('fake_part', 'mock_part4')

		UpdateNext.ensureNextPartIsValid(getRundown())

		expect(ServerPlayoutAPI.setNextPartInner).toHaveBeenCalledTimes(0)
	})
	testInFiber('ensureNextPartIsValid: Missing current and next parts', () => {
		resetPartIds('fake_part', 'not_real_either')

		UpdateNext.ensureNextPartIsValid(getRundown())

		expect(ServerPlayoutAPI.setNextPartInner).toHaveBeenCalledTimes(1)
		expect(ServerPlayoutAPI.setNextPartInner).toHaveBeenCalledWith(expect.objectContaining({ _id: rundownId }), null)
	})
	testInFiber('ensureNextPartIsValid: Ensure correct part doesnt change', () => {
		resetPartIds('mock_part3', 'mock_part4')

		UpdateNext.ensureNextPartIsValid(getRundown())

		expect(ServerPlayoutAPI.setNextPartInner).not.toHaveBeenCalled()
	})
	testInFiber('ensureNextPartIsValid: Ensure manual part doesnt change', () => {
		resetPartIds('mock_part3', 'mock_part5', true)

		UpdateNext.ensureNextPartIsValid(getRundown())

		expect(ServerPlayoutAPI.setNextPartInner).not.toHaveBeenCalled()
	})
	testInFiber('ensureNextPartIsValid: Ensure non-manual part does change', () => {
		resetPartIds('mock_part3', 'mock_part5', false)

		UpdateNext.ensureNextPartIsValid(getRundown())

		expect(ServerPlayoutAPI.setNextPartInner).toHaveBeenCalledTimes(1)
		expect(ServerPlayoutAPI.setNextPartInner).toHaveBeenCalledWith(expect.objectContaining({ _id: rundownId }), expect.objectContaining({ _id: 'mock_part4' }))
	})
	testInFiber('ensureNextPartIsValid: Ensure manual but missing part does change', () => {
		resetPartIds('mock_part3', 'fake_part', true)

		UpdateNext.ensureNextPartIsValid(getRundown())

		expect(ServerPlayoutAPI.setNextPartInner).toHaveBeenCalledTimes(1)
		expect(ServerPlayoutAPI.setNextPartInner).toHaveBeenCalledWith(expect.objectContaining({ _id: rundownId }), expect.objectContaining({ _id: 'mock_part4' }))
	})

	testInFiber('afterInsertParts: Did not remove previous', () => {
		resetPartIds('fake_part', 'not_real_either')

		// The params should be ignored, so fill with a few instances of junk to check the call to ensureNextPartIsValid gets done

		const ensureMock = jest.spyOn(UpdateNext, 'ensureNextPartIsValid').mockImplementation(jest.fn())
		UpdateNext.afterInsertParts(getRundown(), [''], false)
		expect(ensureMock).toHaveBeenCalledTimes(1)

		ensureMock.mockClear()
		UpdateNext.afterInsertParts(getRundown(), null as any, false)
		expect(ensureMock).toHaveBeenCalledTimes(1)

		ensureMock.mockClear()
		UpdateNext.afterInsertParts(getRundown(), ['p3'], false)
		expect(ensureMock).toHaveBeenCalledTimes(1)

		// Try again with the next manually set
		resetPartIds('fake_part', 'not_real_either', true)

		ensureMock.mockClear()
		UpdateNext.afterInsertParts(getRundown(), null as any, false)
		expect(ensureMock).toHaveBeenCalledTimes(1)

		expect(ServerPlayoutAPI.setNextPartInner).not.toHaveBeenCalled()
	})

	testInFiber('afterInsertParts: Next part no longer exists', () => {
		resetPartIds('mock_part2', 'fake_part', true)

		const ensureMock = jest.spyOn(UpdateNext, 'ensureNextPartIsValid').mockImplementation(jest.fn())

		UpdateNext.afterInsertParts(getRundown(), ['p4', 'p5'], true)
		expect(ensureMock).not.toHaveBeenCalled()
		expect(ServerPlayoutAPI.setNextPartInner).toHaveBeenCalledWith(expect.objectContaining({ _id: rundownId }), expect.objectContaining({ _id: 'mock_part4' }))
	})

	testInFiber('afterInsertParts: Next part no longer exists, missing new parts', () => {
		resetPartIds('mock_part2', 'fake_part', true)

		const ensureMock = jest.spyOn(UpdateNext, 'ensureNextPartIsValid').mockImplementation(jest.fn())

		UpdateNext.afterInsertParts(getRundown(), ['p99'], true)
		expect(ensureMock).toHaveBeenCalledTimes(1)
		expect(ServerPlayoutAPI.setNextPartInner).not.toHaveBeenCalled()
	})

	testInFiber('afterInsertParts: Next part was not affected', () => {
		resetPartIds('mock_part2', 'mock_part5', true)

		const ensureMock = jest.spyOn(UpdateNext, 'ensureNextPartIsValid').mockImplementation(jest.fn())

		UpdateNext.afterInsertParts(getRundown(), ['p3', 'p4'], true)
		expect(ensureMock).not.toHaveBeenCalled()
		expect(ServerPlayoutAPI.setNextPartInner).not.toHaveBeenCalled()
	})

	testInFiber('afterInsertParts: Next part was not affected2', () => {
		resetPartIds('mock_part1', 'mock_part2', true)

		const ensureMock = jest.spyOn(UpdateNext, 'ensureNextPartIsValid').mockImplementation(jest.fn())

		UpdateNext.afterInsertParts(getRundown(), ['p4', 'p5'], true)
		expect(ensureMock).not.toHaveBeenCalled()
		expect(ServerPlayoutAPI.setNextPartInner).not.toHaveBeenCalled()
	})

})
