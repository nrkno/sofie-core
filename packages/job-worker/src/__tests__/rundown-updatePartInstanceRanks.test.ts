import { RundownId, SegmentId, PartId, PartInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { MockJobContext, setupDefaultJobEnvironment } from '../__mocks__/context'
import { setupDefaultRundownPlaylist, setupMockShowStyleCompound } from '../__mocks__/presetCollections'
import { updatePartInstanceRanks } from '../rundown'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { JobContext } from '../jobs'
import { CacheForIngest } from '../ingest/cache'
import { BeforePartMapItem } from '../ingest/commit'
import { getRundownId } from '../ingest/lib'
import { runWithRundownLock } from '../ingest/lock'

// require('../rundown') // include in order to create the Meteor methods needed

describe('updatePartInstanceRanks', () => {
	let context: MockJobContext
	// let playlistId!: RundownPlaylistId
	const rundownExternalId = 'rundown00'
	let rundownId!: RundownId
	let segmentId!: SegmentId

	beforeAll(async () => {
		context = setupDefaultJobEnvironment()

		await setupMockShowStyleCompound(context)

		// Set up a playlist:
		const info = await setupDefaultRundownPlaylist(
			context,
			undefined,
			getRundownId(context.studio._id, rundownExternalId)
		)
		await context.mockCollections.RundownPlaylists.update(info.playlistId, {
			$set: { activationId: protectString('active') },
		})

		// playlistId = info.playlistId
		rundownId = info.rundownId

		const segment0 = (await context.mockCollections.Segments.findOne({ rundownId })) as DBSegment
		// eslint-disable-next-line jest/no-standalone-expect
		expect(segment0).toBeTruthy()
		segmentId = segment0._id
	})

	async function insertPart(id: string, rank: number): Promise<void> {
		await context.mockCollections.Parts.insertOne({
			_id: protectString(id),
			_rank: rank,
			rundownId,
			segmentId,
			externalId: id,
			title: id,
			expectedDurationWithPreroll: undefined,
		})
	}

	beforeEach(async () => {
		await context.mockCollections.Parts.remove({ segmentId })
		await context.mockCollections.PartInstances.remove({ segmentId })

		await insertPart('part01', 1)
		await insertPart('part02', 2)
		await insertPart('part03', 3)
		await insertPart('part04', 4)
		await insertPart('part05', 5)
	})

	async function getParts(): Promise<DBPart[]> {
		return context.mockCollections.Parts.findFetch({ segmentId })
	}
	async function getPartInstances(): Promise<DBPartInstance[]> {
		return context.mockCollections.PartInstances.findFetch({ segmentId })
	}

	async function getPartRanks(): Promise<Array<{ id: PartId; rank: number }>> {
		const parts = await getParts()
		return parts.map((p) => ({ id: p._id, rank: p._rank }))
	}
	type InstanceRanks = Array<{ id: PartInstanceId; partId: PartId; rank: number; orphaned?: string }>
	async function getPartInstanceRanks(): Promise<InstanceRanks> {
		const pi = await getPartInstances()
		return pi.map((p) => ({
			id: p._id,
			partId: p.part._id,
			rank: p.part._rank,
			orphaned: p.orphaned,
		}))
	}

	async function insertPartInstance(part: DBPart, orphaned?: DBPartInstance['orphaned']): Promise<PartInstanceId> {
		const id: PartInstanceId = protectString(`${part._id}_instance`)
		await context.mockCollections.PartInstances.insertOne({
			_id: id,
			rehearsal: false,
			takeCount: 0,
			rundownId,
			segmentId,
			playlistActivationId: protectString('active'),
			segmentPlayoutId: protectString(''),
			part,
			orphaned: orphaned,
		})
		return id
	}

	async function insertAllPartInstances(): Promise<void> {
		for (const part of await getParts()) {
			await insertPartInstance(part)
		}
	}

	async function updateRanksForSegment(
		context: JobContext,
		segmentId: SegmentId,
		initialRanks: BeforePartMapItem[]
	): Promise<void> {
		await runWithRundownLock(context, rundownId, async (_rundown, lock) => {
			const cache = await CacheForIngest.create(context, lock, rundownExternalId)

			const changeMap = new Map<SegmentId, Array<{ id: PartId; rank: number }>>()
			changeMap.set(segmentId, initialRanks)
			await updatePartInstanceRanks(context, cache, null, [segmentId], changeMap)

			await cache.saveAllToDatabase()
		})
	}

	test('sync from parts: no change', async () => {
		const initialRanks = await getPartRanks()
		expect(initialRanks).toHaveLength(5)

		await insertAllPartInstances()

		const initialInstanceRanks = await getPartInstanceRanks()
		expect(initialInstanceRanks).toHaveLength(5)

		await updateRanksForSegment(context, segmentId, initialRanks)

		const newInstanceRanks = await getPartInstanceRanks()
		expect(newInstanceRanks).toEqual(initialInstanceRanks)
	})

	async function updatePartRank(expectedRanks: InstanceRanks, id: string, newRank: number): Promise<void> {
		const partId = protectString(id)
		const updated = await context.mockCollections.Parts.update(partId, { $set: { _rank: newRank } })

		for (const e of expectedRanks) {
			if (e.partId === partId) {
				e.rank = newRank
				if (updated === 0) {
					e.orphaned = 'deleted'
				}
			}
		}
	}

	async function updatePartInstanceRank(
		expectedRanks: InstanceRanks,
		partId: string,
		newRank: number
	): Promise<void> {
		const partInstanceId = protectString(`${partId}_instance`)
		await context.mockCollections.PartInstances.update(partInstanceId, { $set: { 'part._rank': newRank } })

		for (const e of expectedRanks) {
			if (e.id === partInstanceId) {
				e.rank = newRank
			}
		}
	}

	test('sync from parts: swap part order', async () => {
		const initialRanks = await getPartRanks()
		expect(initialRanks).toHaveLength(5)

		await insertAllPartInstances()

		const initialInstanceRanks = await getPartInstanceRanks()
		expect(initialInstanceRanks).toHaveLength(5)

		// swap the middle ones
		await updatePartRank(initialInstanceRanks, 'part02', 3)
		await updatePartRank(initialInstanceRanks, 'part03', 4)
		await updatePartRank(initialInstanceRanks, 'part04', 2)

		await updateRanksForSegment(context, segmentId, initialRanks)

		const newInstanceRanks = await getPartInstanceRanks()
		expect(newInstanceRanks).toEqual(initialInstanceRanks)

		// now lets try swapping the first and last
		await updatePartRank(initialInstanceRanks, 'part01', 5)
		await updatePartRank(initialInstanceRanks, 'part02', 0)
		await updatePartRank(initialInstanceRanks, 'part05', 1)

		await updateRanksForSegment(context, segmentId, initialRanks)

		const newInstanceRanks2 = await getPartInstanceRanks()
		expect(newInstanceRanks2).toEqual(initialInstanceRanks)
	})

	test('sync from parts: missing part', async () => {
		const initialRanks = await getPartRanks()
		expect(initialRanks).toHaveLength(5)

		await insertAllPartInstances()

		const initialInstanceRanks = await getPartInstanceRanks()
		expect(initialInstanceRanks).toHaveLength(5)

		// remove one and offset the others
		await updatePartRank(initialInstanceRanks, 'part04', 3)
		await updatePartRank(initialInstanceRanks, 'part05', 4)
		await context.mockCollections.Parts.remove(protectString('part03'))
		await updatePartRank(initialInstanceRanks, 'part03', 2.5)

		await updateRanksForSegment(context, segmentId, initialRanks)

		const newInstanceRanks = await getPartInstanceRanks()
		expect(newInstanceRanks).toEqual(initialInstanceRanks)
	})

	test('sync from parts: missing first part', async () => {
		const initialRanks = await getPartRanks()
		expect(initialRanks).toHaveLength(5)

		await insertAllPartInstances()

		const initialInstanceRanks = await getPartInstanceRanks()
		expect(initialInstanceRanks).toHaveLength(5)

		// remove one and offset the others
		await updatePartRank(initialInstanceRanks, 'part02', 1)
		await updatePartRank(initialInstanceRanks, 'part03', 2)
		await updatePartRank(initialInstanceRanks, 'part04', 3)
		await updatePartRank(initialInstanceRanks, 'part05', 4)
		await context.mockCollections.Parts.remove(protectString('part01'))
		await updatePartRank(initialInstanceRanks, 'part01', 0)

		await updateRanksForSegment(context, segmentId, initialRanks)

		const newInstanceRanks = await getPartInstanceRanks()
		expect(newInstanceRanks).toEqual(initialInstanceRanks)
	})

	test('sync from parts: adlib part after missing part', async () => {
		const initialRanks = await getPartRanks()
		expect(initialRanks).toHaveLength(5)

		await insertAllPartInstances()

		const initialInstanceRanks = await getPartInstanceRanks()
		expect(initialInstanceRanks).toHaveLength(5)

		// insert an adlib part
		const adlibId = 'adlib0'
		await insertPartInstance(
			{
				_id: protectString(adlibId),
				_rank: 3.5, // after part03
				rundownId,
				segmentId,
				externalId: adlibId,
				title: adlibId,
				expectedDurationWithPreroll: undefined,
			},
			'adlib-part'
		)

		// remove one and offset the others
		await updatePartRank(initialInstanceRanks, 'part04', 3)
		await updatePartRank(initialInstanceRanks, 'part05', 4)
		await context.mockCollections.Parts.remove(protectString('part03'))
		await updatePartRank(initialInstanceRanks, 'part03', 2.3333333333333335)
		initialInstanceRanks.push({
			id: protectString(`${adlibId}_instance`),
			partId: protectString(adlibId),
			orphaned: 'adlib-part',
			rank: 2.666666666666667,
		})

		await updateRanksForSegment(context, segmentId, initialRanks)

		const newInstanceRanks = await getPartInstanceRanks()
		expect(newInstanceRanks).toEqual(initialInstanceRanks)
	})

	test('sync from parts: delete and insert segment', async () => {
		const initialRanks = await getPartRanks()
		expect(initialRanks).toHaveLength(5)

		await insertAllPartInstances()

		const initialInstanceRanks = await getPartInstanceRanks()
		expect(initialInstanceRanks).toHaveLength(5)

		// Delete the segment
		await context.mockCollections.Parts.remove({ segmentId })
		for (const e of initialInstanceRanks) {
			e.rank-- // Offset to match the generated order
			e.orphaned = 'deleted'
		}

		await updateRanksForSegment(context, segmentId, initialRanks)

		const newInstanceRanks = await getPartInstanceRanks()
		expect(newInstanceRanks).toEqual(initialInstanceRanks)

		const initialRanks2 = await getPartRanks()
		expect(initialRanks2).toHaveLength(0)

		// Insert new segment
		await insertPart('part10', 0)
		await insertPart('part11', 1)
		await insertPart('part12', 2)
		await updatePartInstanceRank(initialInstanceRanks, 'part01', -5)
		await updatePartInstanceRank(initialInstanceRanks, 'part02', -4)
		await updatePartInstanceRank(initialInstanceRanks, 'part03', -3)
		await updatePartInstanceRank(initialInstanceRanks, 'part04', -2)
		await updatePartInstanceRank(initialInstanceRanks, 'part05', -1)

		await updateRanksForSegment(context, segmentId, initialRanks2)

		const newInstanceRanks2 = await getPartInstanceRanks()
		expect(newInstanceRanks2).toEqual(initialInstanceRanks)
	})

	test('sync from parts: replace segment', async () => {
		const initialRanks = await getPartRanks()
		expect(initialRanks).toHaveLength(5)

		await insertAllPartInstances()

		const initialInstanceRanks = await getPartInstanceRanks()
		expect(initialInstanceRanks.filter((r) => r.orphaned)).toHaveLength(0)
		expect(initialInstanceRanks).toHaveLength(5)

		// Delete the segment
		await context.mockCollections.Parts.remove({ segmentId })
		for (const e of initialInstanceRanks) {
			e.orphaned = 'deleted'
		}
		// Insert new segment
		await insertPart('part10', 0.5)
		await insertPart('part11', 1)
		await insertPart('part12', 2)
		await updatePartInstanceRank(initialInstanceRanks, 'part01', -4.5)
		await updatePartInstanceRank(initialInstanceRanks, 'part02', -3.5)
		await updatePartInstanceRank(initialInstanceRanks, 'part03', -2.5)
		await updatePartInstanceRank(initialInstanceRanks, 'part04', -1.5)
		await updatePartInstanceRank(initialInstanceRanks, 'part05', -0.5)

		await updateRanksForSegment(context, segmentId, initialRanks)

		const newInstanceRanks = await getPartInstanceRanks()
		expect(newInstanceRanks).toEqual(initialInstanceRanks)
	})
})
