import { RundownId, RundownPlaylistId, PartInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { saveIntoDb } from '../../db/changes'
import { ensureNextPartIsValid as ensureNextPartIsValidRaw } from '../updateNext'
import { MockJobContext, setupDefaultJobEnvironment } from '../../__mocks__/context'
import { runJobWithPlayoutCache } from '../../playout/lock'

jest.mock('../../playout/playout')
import { setNextPartInner } from '../../playout/playout'
type TsetNextPartInner = jest.MockedFunction<typeof setNextPartInner>
const setNextPartInnerMock = setNextPartInner as TsetNextPartInner
setNextPartInnerMock.mockImplementation(() => Promise.resolve()) // Default mock

const rundownId: RundownId = protectString('mock_ro')
const rundownPlaylistId: RundownPlaylistId = protectString('mock_rpl')
async function createMockRO(context: MockJobContext): Promise<RundownId> {
	await context.directCollections.RundownPlaylists.insertOne({
		_id: rundownPlaylistId,
		externalId: 'mock_rpl',
		name: 'Mock',
		studioId: context.studioId,
		created: 0,
		modified: 0,
		currentPartInstanceId: null,
		nextPartInstanceId: null,
		previousPartInstanceId: null,
		activationId: protectString('active'),
	})

	await context.directCollections.Rundowns.insertOne({
		_id: rundownId,
		externalId: 'mock_ro',
		name: 'Mock',
		studioId: context.studioId,
		showStyleBaseId: protectString(''),
		showStyleVariantId: protectString(''),
		peripheralDeviceId: protectString(''),
		created: 0,
		modified: 0,
		importVersions: {} as any,
		playlistId: rundownPlaylistId,
		_rank: 0,
		externalNRCSName: 'mockNRCS',
		organizationId: protectString(''),
	})

	await saveIntoDb(
		context,
		context.directCollections.Segments,
		{
			rundownId: rundownId,
		},
		[
			literal<DBSegment>({
				_id: protectString('mock_segment1'),
				_rank: 1,
				externalId: 's1',
				rundownId: rundownId,
				name: 'Segment1',
				externalModified: 1,
			}),
			literal<DBSegment>({
				_id: protectString('mock_segment2'),
				_rank: 2,
				externalId: 's2',
				rundownId: rundownId,
				name: 'Segment2',
				externalModified: 1,
			}),
			literal<DBSegment>({
				_id: protectString('mock_segment3'),
				_rank: 3,
				externalId: 's3',
				rundownId: rundownId,
				name: 'Segment3',
				externalModified: 1,
			}),
			literal<DBSegment>({
				_id: protectString('mock_segment4'),
				_rank: 4,
				externalId: 's4',
				rundownId: rundownId,
				name: 'Segment4',
				externalModified: 1,
			}),
		]
	)

	const rawInstances = [
		// Segment 1
		literal<DBPartInstance>({
			_id: protectString('mock_part_instance1'),
			rundownId: rundownId,
			segmentId: protectString('mock_segment1'),
			playlistActivationId: protectString('active'),
			segmentPlayoutId: protectString(''),
			takeCount: 0,
			rehearsal: false,
			part: literal<DBPart>({
				_id: protectString('mock_part1'),
				_rank: 1,
				rundownId: rundownId,
				segmentId: protectString('mock_segment1'),
				externalId: 'p1',
				title: 'Part 1',
			}),
		}),
		literal<DBPartInstance>({
			_id: protectString('mock_part_instance2'),
			rundownId: rundownId,
			segmentId: protectString('mock_segment1'),
			playlistActivationId: protectString('active'),
			segmentPlayoutId: protectString(''),
			takeCount: 0,
			rehearsal: false,
			part: literal<DBPart>({
				_id: protectString('mock_part2'),
				_rank: 2,
				rundownId: rundownId,
				segmentId: protectString('mock_segment1'),
				externalId: 'p2',
				title: 'Part 2',
			}),
		}),
		literal<DBPartInstance>({
			_id: protectString('mock_part_instance3'),
			rundownId: rundownId,
			segmentId: protectString('mock_segment1'),
			playlistActivationId: protectString('active'),
			segmentPlayoutId: protectString(''),
			takeCount: 0,
			rehearsal: false,
			part: literal<DBPart>({
				_id: protectString('mock_part3'),
				_rank: 3,
				rundownId: rundownId,
				segmentId: protectString('mock_segment1'),
				externalId: 'p3',
				title: 'Part 3',
			}),
		}),
		// Segment 2
		literal<DBPartInstance>({
			_id: protectString('mock_part_instance4'),
			rundownId: rundownId,
			segmentId: protectString('mock_segment2'),
			playlistActivationId: protectString('active'),
			segmentPlayoutId: protectString(''),
			takeCount: 0,
			rehearsal: false,
			part: literal<DBPart>({
				_id: protectString('mock_part4'),
				_rank: 0,
				rundownId: rundownId,
				segmentId: protectString('mock_segment2'),
				externalId: 'p4',
				title: 'Part 4',
			}),
		}),
		literal<DBPartInstance>({
			_id: protectString('mock_part_instance5'),
			rundownId: rundownId,
			segmentId: protectString('mock_segment2'),
			playlistActivationId: protectString('active'),
			segmentPlayoutId: protectString(''),
			takeCount: 0,
			rehearsal: false,
			part: literal<DBPart>({
				_id: protectString('mock_part5'),
				_rank: 1,
				rundownId: rundownId,
				segmentId: protectString('mock_segment2'),
				externalId: 'p5',
				title: 'Part 5',
			}),
		}),
		// Segment 3
		literal<DBPartInstance>({
			_id: protectString('mock_part_instance6'),
			rundownId: rundownId,
			segmentId: protectString('mock_segment3'),
			playlistActivationId: protectString('active'),
			segmentPlayoutId: protectString(''),
			takeCount: 0,
			rehearsal: false,
			part: literal<DBPart>({
				_id: protectString('mock_part6'),
				_rank: 0,
				rundownId: rundownId,
				segmentId: protectString('mock_segment3'),
				externalId: 'p6',
				title: 'Part 6',
			}),
		}),
		// Segment 4
		literal<DBPartInstance>({
			_id: protectString('mock_part_instance7'),
			rundownId: rundownId,
			segmentId: protectString('mock_segment4'),
			playlistActivationId: protectString('active'),
			segmentPlayoutId: protectString(''),
			takeCount: 0,
			rehearsal: false,
			part: literal<DBPart>({
				_id: protectString('mock_part7'),
				_rank: 0,
				rundownId: rundownId,
				segmentId: protectString('mock_segment4'),
				externalId: 'p7',
				title: 'Part 7',
			}),
		}),
		literal<DBPartInstance>({
			_id: protectString('mock_part_instance8'),
			rundownId: rundownId,
			segmentId: protectString('mock_segment4'),
			playlistActivationId: protectString('active'),
			segmentPlayoutId: protectString(''),
			takeCount: 0,
			rehearsal: false,
			part: literal<DBPart>({
				_id: protectString('mock_part8'),
				_rank: 1,
				rundownId: rundownId,
				segmentId: protectString('mock_segment4'),
				externalId: 'p8',
				title: 'Part 8',
				floated: true,
			}),
		}),
		literal<DBPartInstance>({
			_id: protectString('mock_part_instance9'),
			rundownId: rundownId,
			segmentId: protectString('mock_segment4'),
			playlistActivationId: protectString('active'),
			segmentPlayoutId: protectString(''),
			takeCount: 0,
			rehearsal: false,
			part: literal<DBPart>({
				_id: protectString('mock_part9'),
				_rank: 2,
				rundownId: rundownId,
				segmentId: protectString('mock_segment4'),
				externalId: 'p9',
				title: 'Part 9',
			}),
		}),

		literal<DBPartInstance>({
			_id: protectString('orphan_part_instance1'), // after mock_part_instance8
			rundownId: rundownId,
			segmentId: protectString('mock_segment4'),
			playlistActivationId: protectString('active'),
			segmentPlayoutId: protectString(''),
			takeCount: 0,
			rehearsal: false,
			part: literal<DBPart>({
				_id: protectString('orphan_1'),
				_rank: 1.5,
				rundownId: rundownId,
				segmentId: protectString('mock_segment4'),
				externalId: 'o1',
				title: 'Orphan 1',
			}),
			orphaned: 'adlib-part',
		}),
	]

	await saveIntoDb(
		context,
		context.directCollections.PartInstances,
		{
			rundownId: rundownId,
		},
		rawInstances
	)
	await saveIntoDb(
		context,
		context.directCollections.Parts,
		{
			rundownId: rundownId,
		},
		rawInstances.filter((p) => !p.orphaned).map((i) => i.part)
	)

	return rundownId
}

describe('ensureNextPartIsValid', () => {
	let context: MockJobContext

	beforeEach(async () => {
		context = setupDefaultJobEnvironment()
		await createMockRO(context)
		jest.clearAllMocks()
	})

	async function resetPartIds(
		currentPartInstanceId: string | PartInstanceId | null,
		nextPartInstanceId: string | PartInstanceId | null,
		nextPartManual?: boolean
	) {
		await context.directCollections.RundownPlaylists.update(rundownPlaylistId, {
			$set: {
				nextPartInstanceId: nextPartInstanceId as any,
				currentPartInstanceId: currentPartInstanceId as any,
				previousPartInstanceId: null,
				nextPartManual: nextPartManual || false,
			},
		})
	}
	async function ensureNextPartIsValid() {
		await runJobWithPlayoutCache(context, { playlistId: rundownPlaylistId }, null, async (cache) =>
			ensureNextPartIsValidRaw(context, cache)
		)
	}

	test('Start with null', async () => {
		await resetPartIds(null, null)

		await ensureNextPartIsValid()

		expect(setNextPartInnerMock).toHaveBeenCalledTimes(1)
		expect(setNextPartInnerMock).toHaveBeenCalledWith(
			context,
			expect.objectContaining({ PlaylistId: rundownPlaylistId }),
			expect.objectContaining({ _id: 'mock_part1' })
		)
	})
	test('Missing next PartInstance', async () => {
		await resetPartIds('mock_part_instance3', 'fake_part')

		await ensureNextPartIsValid()

		expect(setNextPartInnerMock).toHaveBeenCalledTimes(1)
		expect(setNextPartInnerMock).toHaveBeenCalledWith(
			context,
			expect.objectContaining({ PlaylistId: rundownPlaylistId }),
			expect.objectContaining({ _id: 'mock_part4' })
		)

		// expectNextPartId('mock_part4')
	})
	// test('Missing distant future part', () => {
	// 	resetPartIds('mock_part_instance3', 'mock_part_instance4')

	// 	UpdateNext.ensureNextPartIsValid(getRundownPlaylist())

	// 	expectNextPartId(null)
	// })
	test('Missing current PartInstance with valid next', async () => {
		await resetPartIds('fake_part', 'mock_part_instance4')

		await ensureNextPartIsValid()

		expect(setNextPartInnerMock).toHaveBeenCalledTimes(0)
	})
	test('Missing current and next PartInstance', async () => {
		await resetPartIds('fake_part', 'not_real_either')

		await ensureNextPartIsValid()

		expect(setNextPartInnerMock).toHaveBeenCalledTimes(1)
		expect(setNextPartInnerMock).toHaveBeenCalledWith(
			context,
			expect.objectContaining({ PlaylistId: rundownPlaylistId }),
			expect.objectContaining({ _id: 'mock_part1' })
		)
	})
	test('Ensure correct PartInstance doesnt change', async () => {
		await resetPartIds('mock_part_instance3', 'mock_part_instance4')

		await ensureNextPartIsValid()

		expect(setNextPartInnerMock).not.toHaveBeenCalled()
	})
	test('Ensure manual PartInstance doesnt change', async () => {
		await resetPartIds('mock_part_instance3', 'mock_part_instance5', true)

		await ensureNextPartIsValid()

		expect(setNextPartInnerMock).not.toHaveBeenCalled()
	})
	test('Ensure non-manual PartInstance does change', async () => {
		await resetPartIds('mock_part_instance3', 'mock_part_instance5', false)

		await ensureNextPartIsValid()

		expect(setNextPartInnerMock).toHaveBeenCalledTimes(1)
		expect(setNextPartInnerMock).toHaveBeenCalledWith(
			context,
			expect.objectContaining({ PlaylistId: rundownPlaylistId }),
			expect.objectContaining({ _id: 'mock_part4' })
		)
	})
	test('Ensure manual but missing PartInstance does change', async () => {
		await resetPartIds('mock_part_instance3', 'fake_part', true)

		await ensureNextPartIsValid()

		expect(setNextPartInnerMock).toHaveBeenCalledTimes(1)
		expect(setNextPartInnerMock).toHaveBeenCalledWith(
			context,
			expect.objectContaining({ PlaylistId: rundownPlaylistId }),
			expect.objectContaining({ _id: 'mock_part4' })
		)
	})
	test('Ensure manual but floated PartInstance does change', async () => {
		await resetPartIds('mock_part_instance7', 'mock_part_instance8', true)

		await ensureNextPartIsValid()

		expect(setNextPartInnerMock).toHaveBeenCalledTimes(1)
		expect(setNextPartInnerMock).toHaveBeenCalledWith(
			context,
			expect.objectContaining({ PlaylistId: rundownPlaylistId }),
			expect.objectContaining({ _id: 'mock_part9' })
		)
	})
	test('Ensure floated PartInstance does change', async () => {
		await resetPartIds('mock_part_instance7', 'mock_part_instance8', false)

		await ensureNextPartIsValid()

		expect(setNextPartInnerMock).toHaveBeenCalledTimes(1)
		expect(setNextPartInnerMock).toHaveBeenCalledWith(
			context,
			expect.objectContaining({ PlaylistId: rundownPlaylistId }),
			expect.objectContaining({ _id: 'mock_part9' })
		)
	})
	test('Next part instance is orphaned: "deleted"', async () => {
		// Insert a temporary instance
		const instanceId: PartInstanceId = protectString('orphaned_first_part')
		await context.directCollections.PartInstances.insertOne(
			literal<DBPartInstance>({
				_id: instanceId,
				rundownId: rundownId,
				segmentId: protectString('mock_segment1'),
				playlistActivationId: protectString('active'),
				segmentPlayoutId: protectString(''),
				takeCount: 0,
				rehearsal: false,
				part: literal<DBPart>({
					_id: protectString('orphan_1'),
					_rank: 1.5,
					rundownId: rundownId,
					segmentId: protectString('mock_segment4'),
					externalId: 'o1',
					title: 'Orphan 1',
				}),
				orphaned: 'deleted',
			})
		)

		await resetPartIds(null, instanceId, false)

		await ensureNextPartIsValid()

		expect(setNextPartInnerMock).toHaveBeenCalledTimes(1)
		expect(setNextPartInnerMock).toHaveBeenCalledWith(
			context,
			expect.objectContaining({ PlaylistId: rundownPlaylistId }),
			expect.objectContaining({ _id: 'mock_part1' })
		)
	})
})
