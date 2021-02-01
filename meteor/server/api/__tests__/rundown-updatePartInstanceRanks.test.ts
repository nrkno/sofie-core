import * as _ from 'underscore'
import { Meteor } from 'meteor/meteor'
import '../../../__mocks__/_extendJest'
import { testInFiber, testInFiberOnly } from '../../../__mocks__/helpers/jest'
import {
	setupDefaultStudioEnvironment,
	DefaultEnvironment,
	setupDefaultRundownPlaylist,
	setupDefaultRundown,
} from '../../../__mocks__/helpers/database'
import { protectString, literal, unprotectString } from '../../../lib/lib'
import { Rundowns, Rundown, RundownId } from '../../../lib/collections/Rundowns'
import { RundownPlaylists, RundownPlaylist, RundownPlaylistId } from '../../../lib/collections/RundownPlaylists'
import { ChangedSegmentsRankInfo, produceRundownPlaylistInfoFromRundown, updatePartInstanceRanks } from '../rundown'
import { updateRundownsInPlaylist } from '../ingest/rundownInput'
import { Segment, SegmentId, Segments } from '../../../lib/collections/Segments'
import { Part, PartId, Parts } from '../../../lib/collections/Parts'
import { PartInstance, PartInstanceId, PartInstances } from '../../../lib/collections/PartInstances'
import { wrapWithCacheForRundownPlaylist } from '../../DatabaseCaches'

require('../rundown') // include in order to create the Meteor methods needed

describe('updatePartInstanceRanks', () => {
	let env: DefaultEnvironment
	let playlistId!: RundownPlaylistId
	let rundownId!: RundownId
	let segmentId!: SegmentId

	beforeAll(() => {
		env = setupDefaultStudioEnvironment()

		// Set up a playlist:
		const info = setupDefaultRundownPlaylist(env, protectString('rundown00'))
		const playlist0 = RundownPlaylists.findOne(info.playlistId) as RundownPlaylist
		expect(playlist0).toBeTruthy()

		playlistId = info.playlistId
		rundownId = info.rundownId

		const segment0 = Segments.findOne({ rundownId }) as Segment
		expect(segment0).toBeTruthy()
		segmentId = segment0._id
	})

	function insertPart(id: string, rank: number): void {
		Parts.insert({
			_id: protectString(id),
			_rank: rank,
			rundownId,
			segmentId,
			externalId: id,
			title: id,
		})
	}

	beforeEach(() => {
		Parts.remove({ segmentId })
		PartInstances.remove({ segmentId })

		insertPart('part01', 1)
		insertPart('part02', 2)
		insertPart('part03', 3)
		insertPart('part04', 4)
		insertPart('part05', 5)
	})

	function getPlaylist(): RundownPlaylist {
		const playlist0 = RundownPlaylists.findOne(playlistId) as RundownPlaylist
		expect(playlist0).toBeTruthy()
		return playlist0
	}

	function getParts(): Part[] {
		return Parts.find({ segmentId }).fetch()
	}
	function getPartInstances(): PartInstance[] {
		return PartInstances.find({ segmentId }).fetch()
	}

	function getPartRanks(): Array<{ id: PartId; rank: number }> {
		return getParts().map((p) => ({ id: p._id, rank: p._rank }))
	}
	type InstanceRanks = Array<{ id: PartInstanceId; partId: PartId; rank: number; orphaned?: string }>
	function getPartInstanceRanks(): InstanceRanks {
		return getPartInstances().map((p) => ({
			id: p._id,
			partId: p.part._id,
			rank: p.part._rank,
			orphaned: p.orphaned,
		}))
	}

	function insertPartInstance(part: Part, orphaned?: PartInstance['orphaned']): PartInstanceId {
		const id: PartInstanceId = protectString(`${part._id}_instance`)
		PartInstances.insert({
			_id: id,
			rehearsal: false,
			takeCount: 0,
			rundownId,
			segmentId,
			part,
			orphaned: orphaned,
		})
		return id
	}

	function insertAllPartInstances(): void {
		for (const part of getParts()) {
			insertPartInstance(part)
		}
	}

	testInFiber('sync from parts: no change', () => {
		const playlist = getPlaylist()

		const initialRanks = getPartRanks()
		expect(initialRanks).toHaveLength(5)

		insertAllPartInstances()

		const initialInstanceRanks = getPartInstanceRanks()
		expect(initialInstanceRanks).toHaveLength(5)

		wrapWithCacheForRundownPlaylist(playlist, (cache) =>
			updatePartInstanceRanks(cache, playlist, [{ segmentId, oldPartIdsAndRanks: initialRanks }])
		)

		const newInstanceRanks = getPartInstanceRanks()
		expect(newInstanceRanks).toEqual(initialInstanceRanks)
	})

	function updatePartRank(expectedRanks: InstanceRanks, id: string, newRank: number): void {
		const partId = protectString(id)
		const updated = Parts.update(partId, { $set: { _rank: newRank } })

		for (const e of expectedRanks) {
			if (e.partId === partId) {
				e.rank = newRank
				if (updated === 0) {
					e.orphaned = 'deleted'
				}
			}
		}
	}

	function updatePartInstanceRank(expectedRanks: InstanceRanks, partId: string, newRank: number): void {
		const partInstanceId = protectString(`${partId}_instance`)
		PartInstances.update(partInstanceId, { $set: { 'part._rank': newRank } })

		for (const e of expectedRanks) {
			if (e.id === partInstanceId) {
				e.rank = newRank
			}
		}
	}

	testInFiber('sync from parts: swap part order', () => {
		const playlist = getPlaylist()

		const initialRanks = getPartRanks()
		expect(initialRanks).toHaveLength(5)

		insertAllPartInstances()

		const initialInstanceRanks = getPartInstanceRanks()
		expect(initialInstanceRanks).toHaveLength(5)

		// swap the middle ones
		updatePartRank(initialInstanceRanks, 'part02', 3)
		updatePartRank(initialInstanceRanks, 'part03', 4)
		updatePartRank(initialInstanceRanks, 'part04', 2)

		wrapWithCacheForRundownPlaylist(playlist, (cache) =>
			updatePartInstanceRanks(cache, playlist, [{ segmentId, oldPartIdsAndRanks: initialRanks }])
		)

		const newInstanceRanks = getPartInstanceRanks()
		expect(newInstanceRanks).toEqual(initialInstanceRanks)

		// now lets try swapping the first and last
		updatePartRank(initialInstanceRanks, 'part01', 5)
		updatePartRank(initialInstanceRanks, 'part02', 0)
		updatePartRank(initialInstanceRanks, 'part05', 1)

		wrapWithCacheForRundownPlaylist(playlist, (cache) =>
			updatePartInstanceRanks(cache, playlist, [{ segmentId, oldPartIdsAndRanks: initialRanks }])
		)

		const newInstanceRanks2 = getPartInstanceRanks()
		expect(newInstanceRanks2).toEqual(initialInstanceRanks)
	})

	testInFiber('sync from parts: missing part', () => {
		const playlist = getPlaylist()

		const initialRanks = getPartRanks()
		expect(initialRanks).toHaveLength(5)

		insertAllPartInstances()

		const initialInstanceRanks = getPartInstanceRanks()
		expect(initialInstanceRanks).toHaveLength(5)

		// remove one and offset the others
		updatePartRank(initialInstanceRanks, 'part04', 3)
		updatePartRank(initialInstanceRanks, 'part05', 4)
		Parts.remove(protectString('part03'))
		updatePartRank(initialInstanceRanks, 'part03', 2.5)

		wrapWithCacheForRundownPlaylist(playlist, (cache) =>
			updatePartInstanceRanks(cache, playlist, [{ segmentId, oldPartIdsAndRanks: initialRanks }])
		)

		const newInstanceRanks = getPartInstanceRanks()
		expect(newInstanceRanks).toEqual(initialInstanceRanks)
	})

	testInFiber('sync from parts: adlib part after missing part', () => {
		const playlist = getPlaylist()

		const initialRanks = getPartRanks()
		expect(initialRanks).toHaveLength(5)

		insertAllPartInstances()

		const initialInstanceRanks = getPartInstanceRanks()
		expect(initialInstanceRanks).toHaveLength(5)

		// insert an adlib part
		const adlibId = 'adlib0'
		insertPartInstance(
			new Part({
				_id: protectString(adlibId),
				_rank: 3.5, // after part03
				rundownId,
				segmentId,
				externalId: adlibId,
				title: adlibId,
			}),
			'adlib-part'
		)

		// remove one and offset the others
		updatePartRank(initialInstanceRanks, 'part04', 3)
		updatePartRank(initialInstanceRanks, 'part05', 4)
		Parts.remove(protectString('part03'))
		updatePartRank(initialInstanceRanks, 'part03', 2.3333333333333335)
		initialInstanceRanks.push({
			id: protectString(`${adlibId}_instance`),
			partId: protectString(adlibId),
			orphaned: 'adlib-part',
			rank: 2.666666666666667,
		})

		wrapWithCacheForRundownPlaylist(playlist, (cache) =>
			updatePartInstanceRanks(cache, playlist, [{ segmentId, oldPartIdsAndRanks: initialRanks }])
		)

		const newInstanceRanks = getPartInstanceRanks()
		expect(newInstanceRanks).toEqual(initialInstanceRanks)
	})

	testInFiber('sync from parts: delete and insert segment', () => {
		const playlist = getPlaylist()

		const initialRanks = getPartRanks()
		expect(initialRanks).toHaveLength(5)

		insertAllPartInstances()

		const initialInstanceRanks = getPartInstanceRanks()
		expect(initialInstanceRanks).toHaveLength(5)

		// Delete the segment
		Parts.remove({ segmentId })
		for (const e of initialInstanceRanks) {
			e.rank-- // Offset to match the generated order
			e.orphaned = 'deleted'
		}

		wrapWithCacheForRundownPlaylist(playlist, (cache) =>
			updatePartInstanceRanks(cache, playlist, [{ segmentId, oldPartIdsAndRanks: initialRanks }])
		)

		const newInstanceRanks = getPartInstanceRanks()
		expect(newInstanceRanks).toEqual(initialInstanceRanks)

		const initialRanks2 = getPartRanks()
		expect(initialRanks2).toHaveLength(0)

		// Insert new segment
		insertPart('part10', 0)
		insertPart('part11', 1)
		insertPart('part12', 2)
		updatePartInstanceRank(initialInstanceRanks, 'part01', -5)
		updatePartInstanceRank(initialInstanceRanks, 'part02', -4)
		updatePartInstanceRank(initialInstanceRanks, 'part03', -3)
		updatePartInstanceRank(initialInstanceRanks, 'part04', -2)
		updatePartInstanceRank(initialInstanceRanks, 'part05', -1)

		wrapWithCacheForRundownPlaylist(playlist, (cache) =>
			updatePartInstanceRanks(cache, playlist, [{ segmentId, oldPartIdsAndRanks: initialRanks2 }])
		)

		const newInstanceRanks2 = getPartInstanceRanks()
		expect(newInstanceRanks2).toEqual(initialInstanceRanks)
	})

	testInFiber('sync from parts: replace segment', () => {
		const playlist = getPlaylist()

		const initialRanks = getPartRanks()
		expect(initialRanks).toHaveLength(5)

		insertAllPartInstances()

		const initialInstanceRanks = getPartInstanceRanks()
		expect(initialInstanceRanks).toHaveLength(5)

		// Delete the segment
		Parts.remove({ segmentId })
		for (const e of initialInstanceRanks) {
			e.orphaned = 'deleted'
		}
		// Insert new segment
		insertPart('part10', 0.5)
		insertPart('part11', 1)
		insertPart('part12', 2)
		updatePartInstanceRank(initialInstanceRanks, 'part01', -4.5)
		updatePartInstanceRank(initialInstanceRanks, 'part02', -3.5)
		updatePartInstanceRank(initialInstanceRanks, 'part03', -2.5)
		updatePartInstanceRank(initialInstanceRanks, 'part04', -1.5)
		updatePartInstanceRank(initialInstanceRanks, 'part05', -0.5)

		wrapWithCacheForRundownPlaylist(playlist, (cache) =>
			updatePartInstanceRanks(cache, playlist, [{ segmentId, oldPartIdsAndRanks: initialRanks }])
		)

		const newInstanceRanks = getPartInstanceRanks()
		expect(newInstanceRanks).toEqual(initialInstanceRanks)
	})
})
