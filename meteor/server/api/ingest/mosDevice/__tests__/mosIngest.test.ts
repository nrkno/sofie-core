import * as MOS from 'mos-connection'
import * as _ from 'underscore'
import { setupDefaultStudioEnvironment } from '../../../../../__mocks__/helpers/database'
import { testInFiber } from '../../../../../__mocks__/helpers/jest'
import { Rundowns, Rundown, DBRundown } from '../../../../../lib/collections/Rundowns'
import { Segments, DBSegment, SegmentId, Segment } from '../../../../../lib/collections/Segments'
import { Parts, DBPart, Part } from '../../../../../lib/collections/Parts'
import { PeripheralDevice } from '../../../../../lib/collections/PeripheralDevices'
import { literal, waitForPromise, protectString } from '../../../../../lib/lib'

import { mockRO } from './mock-mos-data'
import { UpdateNext } from '../../updateNext'
import { fixSnapshot } from '../../../../../__mocks__/helpers/snapshot'
import { Pieces } from '../../../../../lib/collections/Pieces'
import { RundownPlaylists, RundownPlaylist } from '../../../../../lib/collections/RundownPlaylists'
import { MeteorCall } from '../../../../../lib/api/methods'
import { IngestDataCache, IngestCacheType } from '../../../../../lib/collections/IngestDataCache'
import { getPartId } from '../../lib'
import { PartInstance } from '../../../../../lib/collections/PartInstances'
import { resetRandomId, restartRandomId } from '../../../../../__mocks__/random'

jest.mock('../../updateNext')

require('../../../peripheralDevice.ts') // include in order to create the Meteor methods needed
require('../../../userActions.ts') // include in order to create the Meteor methods needed

function getPartIdMap(segments: DBSegment[], parts: DBPart[]) {
	const sortedParts = RundownPlaylist._sortPartsInner(parts, segments)

	const groupedParts = _.groupBy(sortedParts, (p) => p.segmentId)
	const arr: [string, DBPart[]][] = _.pairs(groupedParts)
	const idMap = _.map(arr, (g) => ({
		segmentId: protectString<SegmentId>(g[0]),
		parts: _.map(g[1], (p) => p.externalId),
	}))
	return _.sortBy(idMap, (s) => {
		const obj = _.find(segments, (s2) => s2._id === s.segmentId)
		return obj ? obj._rank : 99999
	})
}

describe('Test recieved mos ingest payloads', () => {
	let device: PeripheralDevice
	beforeAll(() => {
		// Start with ids not at the beginning
		resetRandomId()
		resetRandomId()

		device = setupDefaultStudioEnvironment().ingestDevice
	})
	beforeEach(() => {
		restartRandomId()
	})

	testInFiber('mosRoCreate', () => {
		// setLoggerLevel('debug')

		expect(Rundowns.findOne()).toBeFalsy()

		const roData = mockRO.roCreate()
		waitForPromise(MeteorCall.peripheralDevice.mosRoCreate(device._id, device.token, roData))

		const rundownPlaylist = RundownPlaylists.findOne() as RundownPlaylist
		const rundown = Rundowns.findOne() as Rundown
		expect(rundownPlaylist).toMatchObject({
			externalId: rundown._id,
		})

		expect(rundown).toMatchObject({
			externalId: roData.ID.toString(),
			playlistId: rundownPlaylist._id,
		})

		const segments = rundown.getSegments()
		const parts = rundown.getParts({}, undefined, segments)

		expect(getPartIdMap(segments, parts)).toEqual(mockRO.segmentIdMap())

		expect(fixSnapshot(RundownPlaylists.findOne(rundownPlaylist._id), true)).toMatchSnapshot()
		expect(fixSnapshot(Rundowns.findOne(rundown._id), true)).toMatchSnapshot()
		expect(fixSnapshot(Segments.find({ rundownId: rundown._id }).fetch(), true)).toMatchSnapshot()
		expect(fixSnapshot(Parts.find({ rundownId: rundown._id }).fetch(), true)).toMatchSnapshot()
	})

	testInFiber('mosRoCreate: replace existing', () => {
		// setLoggerLevel('debug')

		const roData = mockRO.roCreate()
		const s = roData.Stories.splice(7, 1)
		roData.Stories.splice(4, 0, ...s)

		expect(Rundowns.findOne({ externalId: roData.ID.toString() })).toBeTruthy()

		waitForPromise(MeteorCall.peripheralDevice.mosRoCreate(device._id, device.token, roData))

		const rundownPlaylist = RundownPlaylists.findOne() as RundownPlaylist
		const rundown = Rundowns.findOne() as Rundown
		expect(rundownPlaylist).toMatchObject({
			externalId: rundown._id,
		})

		expect(rundown).toMatchObject({
			externalId: roData.ID.toString(),
			playlistId: rundownPlaylist._id,
		})

		const segments = rundown.getSegments()
		const parts = rundown.getParts({}, undefined, segments)

		const partMap2 = mockRO.segmentIdMap()
		partMap2[1].parts.splice(1, 0, ...partMap2[3].parts)
		partMap2.splice(3, 1)

		expect(getPartIdMap(segments, parts)).toEqual(partMap2)

		expect(fixSnapshot(RundownPlaylists.findOne(rundownPlaylist._id), true)).toMatchSnapshot()
		expect(fixSnapshot(Rundowns.findOne(rundown._id), true)).toMatchSnapshot()
		expect(fixSnapshot(Segments.find({ rundownId: rundown._id }).fetch(), true)).toMatchSnapshot()
		expect(fixSnapshot(Parts.find({ rundownId: rundown._id }).fetch(), true)).toMatchSnapshot()
	})
	testInFiber('mosRoCreate: replace deleted', () => {
		const roData = mockRO.roCreate()

		Rundowns.update({ externalId: roData.ID.toString() }, { $set: { orphaned: 'deleted' } })
		expect(Rundowns.findOne({ externalId: roData.ID.toString() })).toBeTruthy()

		waitForPromise(MeteorCall.peripheralDevice.mosRoCreate(device._id, device.token, roData))

		const rundownPlaylist = RundownPlaylists.findOne() as RundownPlaylist
		const rundown = Rundowns.findOne() as Rundown
		expect(rundownPlaylist).toMatchObject({
			externalId: rundown._id,
		})

		expect(rundown).toMatchObject({
			externalId: roData.ID.toString(),
			playlistId: rundownPlaylist._id,
		})

		expect(rundown.orphaned).toBeUndefined()
	})
	testInFiber('mosRoDelete: already orphaned rundown', () => {
		const roData = mockRO.roCreate()
		Rundowns.update({ externalId: roData.ID.toString() }, { $set: { orphaned: 'deleted' } })

		const rundown = Rundowns.findOne({ externalId: roData.ID.toString() }) as DBRundown
		expect(rundown).toBeTruthy()
		expect(RundownPlaylists.findOne(rundown.playlistId)).toBeTruthy()

		waitForPromise(MeteorCall.peripheralDevice.mosRoDelete(device._id, device.token, roData.ID))

		expect(Rundowns.findOne()).toBeTruthy()
	})
	testInFiber('mosRoDelete', () => {
		const roData = mockRO.roCreate()
		Rundowns.update({ externalId: roData.ID.toString() }, { $unset: { orphaned: 1 } })
		const rundown = Rundowns.findOne({ externalId: roData.ID.toString() }) as DBRundown
		expect(rundown).toBeTruthy()
		expect(RundownPlaylists.findOne(rundown.playlistId)).toBeTruthy()

		waitForPromise(MeteorCall.peripheralDevice.mosRoDelete(device._id, device.token, roData.ID))

		expect(Rundowns.findOne()).toBeFalsy()

		expect(RundownPlaylists.findOne()).toBeFalsy()

		expect(fixSnapshot(RundownPlaylists.findOne(rundown.playlistId), true)).toMatchSnapshot()
		expect(fixSnapshot(Rundowns.findOne(rundown._id), true)).toMatchSnapshot()
		expect(fixSnapshot(Segments.find({ rundownId: rundown._id }).fetch(), true)).toMatchSnapshot()
		expect(fixSnapshot(Parts.find({ rundownId: rundown._id }).fetch(), true)).toMatchSnapshot()
	})

	testInFiber('mosRoDelete: Does not exist', () => {
		const roData = mockRO.roCreate()
		expect(Rundowns.findOne()).toBeFalsy()
		expect(RundownPlaylists.findOne()).toBeFalsy()

		try {
			waitForPromise(MeteorCall.peripheralDevice.mosRoDelete(device._id, device.token, roData.ID))
			fail('expected to throw')
		} catch (e) {
			expect(e.message).toMatch(/Rundown.*not found/i)
		}
	})

	testInFiber('mosRoStatus: Update ro', () => {
		// Reset RO
		waitForPromise(MeteorCall.peripheralDevice.mosRoCreate(device._id, device.token, mockRO.roCreate()))

		const newStatus = MOS.IMOSObjectStatus.BUSY

		let rundown = Rundowns.findOne() as Rundown
		expect(rundown).toBeTruthy()
		expect(rundown.status).not.toEqual(newStatus.toString())

		const payload = literal<MOS.IMOSRunningOrderStatus>({
			ID: new MOS.MosString128(rundown.externalId),
			Status: newStatus,
			Time: new MOS.MosTime(0),
		})

		waitForPromise(MeteorCall.peripheralDevice.mosRoStatus(device._id, device.token, payload))

		rundown = Rundowns.findOne({ _id: rundown._id }) as Rundown
		expect(rundown).toBeTruthy()
		expect(rundown.status).toEqual(newStatus.toString())

		expect(fixSnapshot(RundownPlaylists.findOne(rundown.playlistId), true)).toMatchSnapshot()
		expect(fixSnapshot(Rundowns.findOne(rundown._id), true)).toMatchSnapshot()
		expect(fixSnapshot(Segments.find({ rundownId: rundown._id }).fetch(), true)).toMatchSnapshot()
		expect(fixSnapshot(Parts.find({ rundownId: rundown._id }).fetch(), true)).toMatchSnapshot()
	})

	testInFiber('mosRoStatus: orphaned rundown', () => {
		Rundowns.update({}, { $set: { orphaned: 'deleted' } })

		const newStatus = MOS.IMOSObjectStatus.UPDATED

		let rundown = Rundowns.findOne() as Rundown
		expect(rundown).toBeTruthy()
		expect(rundown.status).not.toEqual(newStatus.toString())

		const payload = literal<MOS.IMOSRunningOrderStatus>({
			ID: new MOS.MosString128(rundown.externalId),
			Status: newStatus,
			Time: new MOS.MosTime(0),
		})

		waitForPromise(MeteorCall.peripheralDevice.mosRoStatus(device._id, device.token, payload))

		rundown = Rundowns.findOne({ _id: rundown._id }) as Rundown
		expect(rundown).toBeTruthy()
		expect(rundown.status).not.toEqual(newStatus.toString())
	})

	testInFiber('mosRoStatus: Missing ro', () => {
		Rundowns.update({}, { $unset: { orphaned: 1 } })

		const newStatus = MOS.IMOSObjectStatus.BUSY

		const externalId = 'fakeId'
		expect(Rundowns.findOne({ externalId: externalId })).toBeFalsy()

		const payload = literal<MOS.IMOSRunningOrderStatus>({
			ID: new MOS.MosString128(externalId),
			Status: newStatus,
			Time: new MOS.MosTime(0),
		})

		try {
			waitForPromise(MeteorCall.peripheralDevice.mosRoStatus(device._id, device.token, payload))
			fail('expected to throw')
		} catch (e) {
			expect(e.message).toMatch(/Rundown.*not found/i)
		}
	})

	testInFiber('mosRoReadyToAir: Update ro', () => {
		const newStatus = MOS.IMOSObjectAirStatus.READY

		let rundown = Rundowns.findOne() as Rundown
		expect(rundown).toBeTruthy()
		expect(rundown.status).not.toEqual(newStatus.toString())

		const payload = literal<MOS.IMOSROReadyToAir>({
			ID: new MOS.MosString128(rundown.externalId),
			Status: newStatus,
		})

		waitForPromise(MeteorCall.peripheralDevice.mosRoReadyToAir(device._id, device.token, payload))

		rundown = Rundowns.findOne({ _id: rundown._id }) as Rundown
		expect(rundown).toBeTruthy()
		expect(rundown.airStatus).toEqual(newStatus.toString())

		expect(fixSnapshot(RundownPlaylists.findOne(rundown.playlistId), true)).toMatchSnapshot()
		expect(fixSnapshot(Rundowns.findOne(rundown._id), true)).toMatchSnapshot()
		expect(fixSnapshot(Segments.find({ rundownId: rundown._id }).fetch(), true)).toMatchSnapshot()
		expect(fixSnapshot(Parts.find({ rundownId: rundown._id }).fetch(), true)).toMatchSnapshot()
	})

	testInFiber('mosRoReadyToAir: orphaned rundown', () => {
		Rundowns.update({}, { $set: { orphaned: 'deleted' } })

		const newStatus = MOS.IMOSObjectAirStatus.NOT_READY

		let rundown = Rundowns.findOne() as Rundown
		expect(rundown).toBeTruthy()
		expect(rundown.status).not.toEqual(newStatus.toString())

		const payload = literal<MOS.IMOSROReadyToAir>({
			ID: new MOS.MosString128(rundown.externalId),
			Status: newStatus,
		})

		waitForPromise(MeteorCall.peripheralDevice.mosRoReadyToAir(device._id, device.token, payload))

		rundown = Rundowns.findOne({ _id: rundown._id }) as Rundown
		expect(rundown).toBeTruthy()
		expect(rundown.airStatus).not.toEqual(newStatus.toString())
	})

	testInFiber('mosRoReadyToAir: Missing ro', () => {
		Rundowns.update({}, { $unset: { orphaned: 1 } })

		const newStatus = MOS.IMOSObjectAirStatus.READY

		const externalId = 'fakeId'
		expect(Rundowns.findOne({ externalId: externalId })).toBeFalsy()

		const payload = literal<MOS.IMOSROReadyToAir>({
			ID: new MOS.MosString128(externalId),
			Status: newStatus,
		})

		try {
			waitForPromise(MeteorCall.peripheralDevice.mosRoReadyToAir(device._id, device.token, payload))
			fail('expected to throw')
		} catch (e) {
			expect(e.message).toMatch(/Rundown.*not found/i)
		}
	})

	testInFiber('mosRoStoryStatus: Update part', () => {
		const newStatus = MOS.IMOSObjectStatus.BUSY

		let part = Parts.findOne() as Part
		expect(part).toBeTruthy()
		expect(part.status).not.toEqual(newStatus.toString())

		const rundown = Rundowns.findOne({ _id: part.rundownId }) as Rundown
		expect(rundown).toBeTruthy()

		const payload = literal<MOS.IMOSStoryStatus>({
			RunningOrderId: new MOS.MosString128(rundown.externalId),
			ID: new MOS.MosString128(part.externalId),
			Status: newStatus,
			Time: new MOS.MosTime(0),
		})

		waitForPromise(MeteorCall.peripheralDevice.mosRoStoryStatus(device._id, device.token, payload))

		part = Parts.findOne(part._id) as Part
		expect(part).toBeTruthy()
		expect(part.status).toEqual(newStatus.toString())

		expect(fixSnapshot(Rundowns.findOne(rundown._id), true)).toMatchSnapshot()
		expect(fixSnapshot(Segments.find({ rundownId: rundown._id }).fetch(), true)).toMatchSnapshot()
		expect(fixSnapshot(Parts.find({ rundownId: rundown._id }).fetch(), true)).toMatchSnapshot()
		expect(fixSnapshot(Pieces.find({ rundownId: rundown._id }).fetch(), true)).toMatchSnapshot()
	})

	testInFiber('mosRoStoryStatus: Wrong ro for part', () => {
		const newStatus = MOS.IMOSObjectStatus.STOP

		const rundownExternalId = 'fakeId'
		expect(Rundowns.findOne({ externalId: rundownExternalId })).toBeFalsy()

		let part = Parts.findOne() as Part
		expect(part).toBeTruthy()
		expect(part.status).not.toEqual(newStatus.toString())

		const payload = literal<MOS.IMOSStoryStatus>({
			RunningOrderId: new MOS.MosString128(rundownExternalId),
			ID: new MOS.MosString128(part.externalId),
			Status: newStatus,
			Time: new MOS.MosTime(0),
		})

		try {
			waitForPromise(MeteorCall.peripheralDevice.mosRoStoryStatus(device._id, device.token, payload))
			fail('expected to throw')
		} catch (e) {
			expect(e.message).toMatch(/Rundown.*not found/i)
		}
	})

	testInFiber('mosRoStoryStatus: Missing part', () => {
		const newStatus = MOS.IMOSObjectStatus.PLAY

		const rundown = Rundowns.findOne() as Rundown
		expect(rundown).toBeTruthy()

		const partExternalId = 'fakeId'

		const payload = literal<MOS.IMOSStoryStatus>({
			RunningOrderId: new MOS.MosString128(rundown.externalId),
			ID: new MOS.MosString128(partExternalId),
			Status: newStatus,
			Time: new MOS.MosTime(0),
		})

		try {
			waitForPromise(MeteorCall.peripheralDevice.mosRoStoryStatus(device._id, device.token, payload))
			fail('expected to throw')
		} catch (e) {
			expect(e.message).toBe(`[404] Part ${partExternalId} in rundown ${rundown.externalId} not found`)
		}
	})

	testInFiber('mosRoStoryInsert: Into segment', () => {
		const playlist = RundownPlaylists.findOne() as RundownPlaylist
		expect(playlist).toBeTruthy()
		const rundowns = playlist.getRundowns()
		expect(rundowns).toHaveLength(1)
		const rundown = rundowns[0]

		const newPartData = mockRO.newItem('ro1;s1;newPart1', 'SEGMENT1;new1')

		const action = literal<MOS.IMOSStoryAction>({
			RunningOrderID: new MOS.MosString128(rundown.externalId),
			StoryID: new MOS.MosString128('ro1;s1;p3'),
		})

		waitForPromise(MeteorCall.peripheralDevice.mosRoStoryInsert(device._id, device.token, action, [newPartData]))

		expect(UpdateNext.ensureNextPartIsValid).toHaveBeenCalledWith(expect.anything(), playlist)

		const segments = rundown.getSegments()
		const parts = rundown.getParts({}, undefined, segments)

		const partMap = mockRO.segmentIdMap()
		partMap[0].parts.splice(2, 0, newPartData.ID.toString())
		expect(getPartIdMap(segments, parts)).toEqual(partMap)

		expect(fixSnapshot(RundownPlaylists.findOne(rundown.playlistId), true)).toMatchSnapshot()
		expect(fixSnapshot(Rundowns.findOne(rundown._id), true)).toMatchSnapshot()
		expect(fixSnapshot(Segments.find({ rundownId: rundown._id }).fetch(), true)).toMatchSnapshot()
		expect(fixSnapshot(Parts.find({ rundownId: rundown._id }).fetch(), true)).toMatchSnapshot()
		expect(fixSnapshot(Pieces.find({ rundownId: rundown._id }).fetch(), true)).toMatchSnapshot()

		// Clean up after ourselves:
		const partsToRemove = Parts.find({ externalId: 'ro1;s1;newPart1' }).fetch()
		Parts.remove({ _id: { $in: partsToRemove.map((p) => p._id) } })
		IngestDataCache.remove({
			rundownId: rundown._id,
			type: IngestCacheType.PART,
			partId: { $in: partsToRemove.map((p) => p._id) },
		})
	})

	testInFiber('mosRoStoryInsert: orphaned rundown', () => {
		Rundowns.update({}, { $set: { orphaned: 'deleted' } })

		const playlist = RundownPlaylists.findOne() as RundownPlaylist
		expect(playlist).toBeTruthy()
		const rundowns = playlist.getRundowns()
		expect(rundowns).toHaveLength(1)
		const rundown = rundowns[0]

		const newPartData = mockRO.newItem('ro1;s1;newPart2', 'SEGMENT1;new2')

		const action = literal<MOS.IMOSStoryAction>({
			RunningOrderID: new MOS.MosString128(rundown.externalId),
			StoryID: new MOS.MosString128('ro1;s1;p3'),
		})

		waitForPromise(MeteorCall.peripheralDevice.mosRoStoryInsert(device._id, device.token, action, [newPartData]))

		const parts = rundown.getParts()

		expect(Rundowns.findOne(rundown._id)?.orphaned).toEqual('deleted')
		expect(parts.find((p) => p.externalId === newPartData.ID.toString())).toBeUndefined()
	})

	testInFiber('mosRoStoryInsert: New segment', () => {
		Rundowns.update({}, { $unset: { orphaned: 1 } })

		const playlist = RundownPlaylists.findOne() as RundownPlaylist
		expect(playlist).toBeTruthy()
		const rundowns = playlist.getRundowns()
		expect(rundowns).toHaveLength(1)
		const rundown = rundowns[0]

		const newPartData = mockRO.newItem('ro1;s1b;newPart1', 'SEGMENT1B;new1')

		const action = literal<MOS.IMOSStoryAction>({
			RunningOrderID: new MOS.MosString128(rundown.externalId),
			StoryID: new MOS.MosString128('ro1;s2;p1'),
		})

		waitForPromise(MeteorCall.peripheralDevice.mosRoStoryInsert(device._id, device.token, action, [newPartData]))

		expect(UpdateNext.ensureNextPartIsValid).toHaveBeenCalledWith(expect.anything(), playlist)

		const segments = rundown.getSegments()
		const parts = rundown.getParts({}, undefined, segments)

		const partMap = mockRO.segmentIdMap()
		partMap.splice(1, 0, {
			segmentId: '9VE_IbHiHyW6VjY6Fi8fMJEgtS4_',
			parts: [newPartData.ID.toString()],
		})
		partMap[2].segmentId = 'Qz1OqWVatX_W4Sp5C0m8VhTTfME_'
		partMap[3].segmentId = '8GUNgE7zUulco2K3yuhJ1Fyceeo_'
		partMap[4].segmentId = 'XF9ZBDI5IouvkmTbounEfoJ6ijY_'
		expect(getPartIdMap(segments, parts)).toEqual(partMap)

		expect(fixSnapshot(RundownPlaylists.findOne(rundown.playlistId), true)).toMatchSnapshot()
		expect(fixSnapshot(Rundowns.findOne(rundown._id), true)).toMatchSnapshot()
		expect(fixSnapshot(Segments.find({ rundownId: rundown._id }).fetch(), true)).toMatchSnapshot()
		expect(fixSnapshot(Parts.find({ rundownId: rundown._id }).fetch(), true)).toMatchSnapshot()
		expect(fixSnapshot(Pieces.find({ rundownId: rundown._id }).fetch(), true)).toMatchSnapshot()
	})

	testInFiber('mosRoStoryInsert: Invalid previous id', () => {
		const rundown = Rundowns.findOne() as Rundown
		expect(rundown).toBeTruthy()

		Parts.remove({ externalId: 'ro1;s1b;newPart1' })

		const newPartData = mockRO.newItem('ro1;s1;failPart1', 'SEGMENT1;fake1')

		const action = literal<MOS.IMOSStoryAction>({
			RunningOrderID: new MOS.MosString128(rundown.externalId),
			StoryID: new MOS.MosString128('newFakePart'),
		})

		try {
			waitForPromise(
				MeteorCall.peripheralDevice.mosRoStoryInsert(device._id, device.token, action, [newPartData])
			)
			fail('expected to throw')
		} catch (e) {
			expect(e.message).toBe(`[404] Part ${action.StoryID.toString()} in rundown ${rundown.externalId} not found`)
		}

		expect(Parts.findOne({ externalId: newPartData.ID.toString() })).toBeFalsy()
	})

	testInFiber('mosRoStoryInsert: Existing externalId', () => {
		const rundown = Rundowns.findOne() as Rundown
		expect(rundown).toBeTruthy()

		Parts.remove({ externalId: 'ro1;s1;failPart1' })

		const newPartData = mockRO.roCreate().Stories[0]

		const action = literal<MOS.IMOSStoryAction>({
			RunningOrderID: new MOS.MosString128(rundown.externalId),
			StoryID: new MOS.MosString128('ro1;s2;p1'),
		})

		try {
			waitForPromise(
				MeteorCall.peripheralDevice.mosRoStoryInsert(device._id, device.token, action, [newPartData])
			)
			fail('expected to throw')
		} catch (e) {
			expect(e.message).toBe(
				`[500] Parts ${newPartData.ID.toString()} already exist in rundown ${rundown.externalId}`
			)
		}
	})

	// TODO - check if this should be allowed
	// testInFiber('mosRoStoryInsert: Insert at end', () => {
	// 	const rundown = Rundowns.findOne() as Rundown
	// 	expect(rundown).toBeTruthy()

	// 	Parts.remove({ externalId: 'ro1;s1;newPart1' })

	// 	const newPartData = mockRO.newItem('ro1;s99;endPart1', 'SEGMENT99;end1')

	// 	const action = literal<MOS.IMOSStoryAction>({
	// 		RunningOrderID: new MOS.MosString128(rundown.externalId),
	// 		StoryID: new MOS.MosString128(''),
	// 	})

	// 	// try {
	// waitForPromise(MeteorCall.peripheralDevice.mosRoStoryInsert(device._id, device.token, action, [newPartData]))
	// 	// 	fail('expected to throw')
	// 	// } catch (e) {
	// 	// 	expect(e.message).toBe(`[404] Part ${action.StoryID.toString()} in rundown ${rundown.externalId} not found`)
	// 	// }

	// 	// expect(Parts.findOne({ externalId: newPartData.ID.toString() })).toBeFalsy()
	// })

	testInFiber('mosRoStoryReplace: Same segment', () => {
		// Reset RO
		waitForPromise(MeteorCall.peripheralDevice.mosRoCreate(device._id, device.token, mockRO.roCreate()))

		const playlist = RundownPlaylists.findOne() as RundownPlaylist
		expect(playlist).toBeTruthy()
		const rundowns = playlist.getRundowns()
		expect(rundowns).toHaveLength(1)
		const rundown = rundowns[0]

		Parts.remove({ externalId: 'ro1;s1;newPart1' })

		const newPartData = mockRO.newItem('ro1;s1;newPart1', 'SEGMENT1;new1')

		const action = literal<MOS.IMOSStoryAction>({
			RunningOrderID: new MOS.MosString128(rundown.externalId),
			StoryID: new MOS.MosString128('ro1;s1;p2'),
		})

		waitForPromise(MeteorCall.peripheralDevice.mosRoStoryReplace(device._id, device.token, action, [newPartData]))

		expect(UpdateNext.ensureNextPartIsValid).toHaveBeenCalledWith(expect.anything(), playlist)

		const segments = rundown.getSegments()
		const parts = rundown.getParts({}, undefined, segments)

		const partMap = mockRO.segmentIdMap()
		partMap[0].parts[1] = newPartData.ID.toString()
		expect(getPartIdMap(segments, parts)).toEqual(partMap)

		expect(fixSnapshot(RundownPlaylists.findOne(rundown.playlistId), true)).toMatchSnapshot()
		expect(fixSnapshot(Rundowns.findOne(rundown._id), true)).toMatchSnapshot()
		expect(fixSnapshot(Segments.find({ rundownId: rundown._id }).fetch(), true)).toMatchSnapshot()
		expect(fixSnapshot(Parts.find({ rundownId: rundown._id }).fetch(), true)).toMatchSnapshot()
		expect(fixSnapshot(Pieces.find({ rundownId: rundown._id }).fetch(), true)).toMatchSnapshot()
	})

	testInFiber('mosRoStoryReplace: orphaned rundown', () => {
		Rundowns.update({}, { $set: { orphaned: 'deleted' } })

		const playlist = RundownPlaylists.findOne() as RundownPlaylist
		expect(playlist).toBeTruthy()
		const rundowns = playlist.getRundowns()
		expect(rundowns).toHaveLength(1)
		const rundown = rundowns[0]

		const newPartData = mockRO.newItem('ro1;s1;newPart2', 'SEGMENT1;new2')

		const action = literal<MOS.IMOSStoryAction>({
			RunningOrderID: new MOS.MosString128(rundown.externalId),
			StoryID: new MOS.MosString128('ro1;s1;p3'),
		})

		waitForPromise(MeteorCall.peripheralDevice.mosRoStoryReplace(device._id, device.token, action, [newPartData]))

		const parts = rundown.getParts()

		expect(Rundowns.findOne(rundown._id)?.orphaned).toEqual('deleted')
		expect(parts.find((p) => p.externalId === newPartData.ID.toString())).toBeUndefined()
	})

	testInFiber('mosRoStoryReplace: Unknown ID', () => {
		Rundowns.update({}, { $unset: { orphaned: 1 } })

		const rundown = Rundowns.findOne() as Rundown
		expect(rundown).toBeTruthy()

		Parts.remove({ externalId: 'ro1;s1;newPart1' })

		const newPartData = mockRO.newItem('ro1;s1;newPart1', 'SEGMENT1;new1')

		const action = literal<MOS.IMOSStoryAction>({
			RunningOrderID: new MOS.MosString128(rundown.externalId),
			StoryID: new MOS.MosString128('fakeId2'),
		})

		try {
			waitForPromise(
				MeteorCall.peripheralDevice.mosRoStoryReplace(device._id, device.token, action, [newPartData])
			)
			fail('expected to throw')
		} catch (e) {
			expect(e.message).toBe(`[404] Part ${action.StoryID.toString()} in rundown ${rundown.externalId} not found`)
		}

		expect(Parts.findOne({ externalId: newPartData.ID.toString() })).toBeFalsy()
	})

	testInFiber('mosRoStoryDelete: Remove segment', () => {
		// Reset RO
		waitForPromise(MeteorCall.peripheralDevice.mosRoCreate(device._id, device.token, mockRO.roCreate()))

		const playlist = RundownPlaylists.findOne() as RundownPlaylist
		expect(playlist).toBeTruthy()
		const rundowns = playlist.getRundowns()
		expect(rundowns).toHaveLength(1)
		const rundown = rundowns[0]

		const partExternalIds = ['ro1;s3;p1', 'ro1;s3;p2']

		const action = literal<MOS.IMOSROAction>({
			RunningOrderID: new MOS.MosString128(rundown.externalId),
		})

		waitForPromise(MeteorCall.peripheralDevice.mosRoStoryDelete(device._id, device.token, action, partExternalIds))

		expect(Parts.find({ externalId: { $in: partExternalIds } }).count()).toEqual(0)

		expect(UpdateNext.ensureNextPartIsValid).toHaveBeenCalledWith(expect.anything(), playlist)

		const segments = rundown.getSegments()
		const parts = rundown.getParts({}, undefined, segments)

		const partMap = mockRO.segmentIdMap()
		partMap[1].parts.push(...partMap[3].parts)
		partMap.splice(2, 2)
		expect(getPartIdMap(segments, parts)).toEqual(partMap)

		expect(fixSnapshot(RundownPlaylists.findOne(rundown.playlistId), true)).toMatchSnapshot()
		expect(fixSnapshot(Rundowns.findOne(rundown._id), true)).toMatchSnapshot()
		expect(fixSnapshot(Segments.find({ rundownId: rundown._id }).fetch(), true)).toMatchSnapshot()
		expect(fixSnapshot(Parts.find({ rundownId: rundown._id }).fetch(), true)).toMatchSnapshot()
		expect(fixSnapshot(Pieces.find({ rundownId: rundown._id }).fetch(), true)).toMatchSnapshot()
	})

	testInFiber('mosRoStoryDelete: Remove invalid id', () => {
		const rundown = Rundowns.findOne() as Rundown
		expect(rundown).toBeTruthy()

		const partExternalIds = ['ro1;s1;p2', 'fakeId']

		const action = literal<MOS.IMOSROAction>({
			RunningOrderID: new MOS.MosString128(rundown.externalId),
		})

		try {
			waitForPromise(
				MeteorCall.peripheralDevice.mosRoStoryDelete(device._id, device.token, action, partExternalIds)
			)
			fail('expected to throw')
		} catch (e) {
			expect(e.message).toBe(`[404] Parts fakeId in rundown ${rundown.externalId} were not found`)
		}

		expect(Parts.find({ externalId: { $in: partExternalIds } }).count()).toEqual(1)
	})

	testInFiber('mosRoFullStory: Valid data', () => {
		// Reset RO
		waitForPromise(MeteorCall.peripheralDevice.mosRoCreate(device._id, device.token, mockRO.roCreate()))

		const rundown = Rundowns.findOne() as Rundown
		expect(rundown).toBeTruthy()

		const story = literal<MOS.IMOSROFullStory>({
			RunningOrderId: new MOS.MosString128(rundown.externalId),
			ID: new MOS.MosString128('ro1;s1;p2'),
			Body: [],
		})

		waitForPromise(MeteorCall.peripheralDevice.mosRoFullStory(device._id, device.token, story))

		const part = Parts.findOne({ externalId: story.ID.toString() }) as Part
		expect(part).toBeTruthy()
		expect(part.metaData).toEqual(story)

		expect(fixSnapshot(RundownPlaylists.findOne(rundown.playlistId), true)).toMatchSnapshot()
		expect(fixSnapshot(Rundowns.findOne(rundown._id), true)).toMatchSnapshot()
		expect(fixSnapshot(Segments.find({ rundownId: rundown._id }).fetch(), true)).toMatchSnapshot()
		expect(fixSnapshot(Parts.find({ rundownId: rundown._id }).fetch(), true)).toMatchSnapshot()
		expect(fixSnapshot(Pieces.find({ rundownId: rundown._id }).fetch(), true)).toMatchSnapshot()
	})

	testInFiber('mosRoFullStory: Unknown Part', () => {
		const rundown = Rundowns.findOne() as Rundown
		expect(rundown).toBeTruthy()

		const story = literal<MOS.IMOSROFullStory>({
			RunningOrderId: new MOS.MosString128(rundown.externalId),
			ID: new MOS.MosString128('fakeId'),
			Body: [],
		})

		try {
			waitForPromise(MeteorCall.peripheralDevice.mosRoFullStory(device._id, device.token, story))
			fail('expected to throw')
		} catch (e) {
			expect(e.message).toBe(
				`[404] Part "${story.ID.toString()}" in rundown "${rundown.externalId}" is missing cached ingest data`
			)
		}
	})

	testInFiber('mosRoFullStory: Unknown Rundown', () => {
		const rundown = Rundowns.findOne() as Rundown
		expect(rundown).toBeTruthy()

		const story = literal<MOS.IMOSROFullStory>({
			RunningOrderId: new MOS.MosString128('fakeId'),
			ID: new MOS.MosString128('ro1;s1;p2'),
			Body: [],
		})

		try {
			waitForPromise(MeteorCall.peripheralDevice.mosRoFullStory(device._id, device.token, story))
			fail('expected to throw')
		} catch (e) {
			expect(e.message).toMatch(/not found/)
		}
	})

	testInFiber('mosRoStorySwap: Within same segment', () => {
		// Reset RO
		waitForPromise(MeteorCall.peripheralDevice.mosRoCreate(device._id, device.token, mockRO.roCreate()))

		const playlist = RundownPlaylists.findOne() as RundownPlaylist
		expect(playlist).toBeTruthy()
		const rundowns = playlist.getRundowns()
		expect(rundowns).toHaveLength(1)
		const rundown = rundowns[0]

		const action = literal<MOS.IMOSROAction>({
			RunningOrderID: new MOS.MosString128(rundown.externalId),
		})
		const story0 = new MOS.MosString128('ro1;s1;p2')
		const story1 = new MOS.MosString128('ro1;s1;p3')

		waitForPromise(MeteorCall.peripheralDevice.mosRoStorySwap(device._id, device.token, action, story0, story1))

		expect(UpdateNext.ensureNextPartIsValid).toHaveBeenCalledWith(expect.anything(), playlist)

		const segments = rundown.getSegments()
		const parts = rundown.getParts({}, undefined, segments)

		const partMap = mockRO.segmentIdMap()
		partMap[0].parts[1] = 'ro1;s1;p3'
		partMap[0].parts[2] = 'ro1;s1;p2'
		expect(getPartIdMap(segments, parts)).toEqual(partMap)

		expect(fixSnapshot(RundownPlaylists.findOne(rundown.playlistId), true)).toMatchSnapshot()
		expect(fixSnapshot(Rundowns.findOne(rundown._id), true)).toMatchSnapshot()
		expect(fixSnapshot(Segments.find({ rundownId: rundown._id }).fetch(), true)).toMatchSnapshot()
		expect(fixSnapshot(Parts.find({ rundownId: rundown._id }).fetch(), true)).toMatchSnapshot()
		expect(fixSnapshot(Pieces.find({ rundownId: rundown._id }).fetch(), true)).toMatchSnapshot()
	})

	testInFiber('mosRoStorySwap: With first in same segment', () => {
		// Reset RO
		waitForPromise(MeteorCall.peripheralDevice.mosRoCreate(device._id, device.token, mockRO.roCreate()))

		const playlist = RundownPlaylists.findOne() as RundownPlaylist
		expect(playlist).toBeTruthy()
		const rundowns = playlist.getRundowns()
		expect(rundowns).toHaveLength(1)
		const rundown = rundowns[0]

		const action = literal<MOS.IMOSROAction>({
			RunningOrderID: new MOS.MosString128(rundown.externalId),
		})
		const story0 = new MOS.MosString128('ro1;s1;p1')
		const story1 = new MOS.MosString128('ro1;s1;p3')

		waitForPromise(MeteorCall.peripheralDevice.mosRoStorySwap(device._id, device.token, action, story0, story1))

		expect(UpdateNext.ensureNextPartIsValid).toHaveBeenCalledWith(expect.anything(), playlist)

		const segments = rundown.getSegments()
		const parts = rundown.getParts({}, undefined, segments)

		const partMap = mockRO.segmentIdMap()
		partMap[0].segmentId = 'apDVfF5nk1_StK474hEUxLMZIag_'
		partMap[0].parts[0] = 'ro1;s1;p3'
		partMap[0].parts[2] = 'ro1;s1;p1'
		expect(getPartIdMap(segments, parts)).toEqual(partMap)

		expect(fixSnapshot(RundownPlaylists.findOne(rundown.playlistId), true)).toMatchSnapshot()
		expect(fixSnapshot(Rundowns.findOne(rundown._id), true)).toMatchSnapshot()
		expect(fixSnapshot(Segments.find({ rundownId: rundown._id }).fetch(), true)).toMatchSnapshot()
		expect(fixSnapshot(Parts.find({ rundownId: rundown._id }).fetch(), true)).toMatchSnapshot()
		expect(fixSnapshot(Pieces.find({ rundownId: rundown._id }).fetch(), true)).toMatchSnapshot()
	})

	testInFiber('mosRoStorySwap: Swap with self', () => {
		const rundown = Rundowns.findOne() as Rundown
		expect(rundown).toBeTruthy()

		const action = literal<MOS.IMOSROAction>({
			RunningOrderID: new MOS.MosString128(rundown.externalId),
		})
		const story0 = new MOS.MosString128('ro1;s1;p1')

		try {
			waitForPromise(MeteorCall.peripheralDevice.mosRoStorySwap(device._id, device.token, action, story0, story0))
			fail('expected to throw')
		} catch (e) {
			expect(e.message).toBe(
				`[400] Cannot swap part ${story0} with itself in rundown ${action.RunningOrderID.toString()}`
			)
		}
	})

	testInFiber('mosRoStorySwap: Story not found', () => {
		const rundown = Rundowns.findOne() as Rundown
		expect(rundown).toBeTruthy()

		const action = literal<MOS.IMOSROAction>({
			RunningOrderID: new MOS.MosString128(rundown.externalId),
		})
		const story0 = new MOS.MosString128('ro1;s1;p1')
		const story1 = new MOS.MosString128('ro1;s1;p99')

		try {
			waitForPromise(MeteorCall.peripheralDevice.mosRoStorySwap(device._id, device.token, action, story0, story1))
			fail('expected to throw')
		} catch (e) {
			expect(e.message).toBe(`[404] Story ${story1} not found in rundown ${action.RunningOrderID.toString()}`)
		}

		try {
			waitForPromise(MeteorCall.peripheralDevice.mosRoStorySwap(device._id, device.token, action, story1, story0))
			fail('expected to throw')
		} catch (e) {
			expect(e.message).toBe(`[404] Story ${story1} not found in rundown ${action.RunningOrderID.toString()}`)
		}
	})

	testInFiber('mosRoStorySwap: Swap across segments', () => {
		// Reset RO
		waitForPromise(MeteorCall.peripheralDevice.mosRoCreate(device._id, device.token, mockRO.roCreate()))

		const playlist = RundownPlaylists.findOne() as RundownPlaylist
		expect(playlist).toBeTruthy()
		const rundowns = playlist.getRundowns()
		expect(rundowns).toHaveLength(1)
		const rundown = rundowns[0]

		const action = literal<MOS.IMOSROAction>({
			RunningOrderID: new MOS.MosString128(rundown.externalId),
		})
		const story0 = new MOS.MosString128('ro1;s3;p1')
		const story1 = new MOS.MosString128('ro1;s4;p1')

		waitForPromise(MeteorCall.peripheralDevice.mosRoStorySwap(device._id, device.token, action, story0, story1))

		expect(UpdateNext.ensureNextPartIsValid).toHaveBeenCalledWith(expect.anything(), playlist)

		const segments = rundown.getSegments()
		const parts = rundown.getParts({}, undefined, segments)

		const partMap = mockRO.segmentIdMap()
		partMap[1].parts.push('ro1;s4;p1')
		partMap[2].segmentId = 'sLfUx9cadyquE07Vw9byoX35G9I_'
		partMap[2].parts = partMap[2].parts.reverse()
		partMap.splice(3, 1)
		expect(getPartIdMap(segments, parts)).toEqual(partMap)

		expect(fixSnapshot(RundownPlaylists.findOne(rundown.playlistId), true)).toMatchSnapshot()
		expect(fixSnapshot(Rundowns.findOne(rundown._id), true)).toMatchSnapshot()
		expect(fixSnapshot(Segments.find({ rundownId: rundown._id }).fetch(), true)).toMatchSnapshot()
		expect(fixSnapshot(Parts.find({ rundownId: rundown._id }).fetch(), true)).toMatchSnapshot()
		expect(fixSnapshot(Pieces.find({ rundownId: rundown._id }).fetch(), true)).toMatchSnapshot()
	})

	testInFiber('mosRoStorySwap: Swap across segments2', () => {
		// Reset RO
		waitForPromise(MeteorCall.peripheralDevice.mosRoCreate(device._id, device.token, mockRO.roCreate()))

		const playlist = RundownPlaylists.findOne() as RundownPlaylist
		expect(playlist).toBeTruthy()
		const rundowns = playlist.getRundowns()
		expect(rundowns).toHaveLength(1)
		const rundown = rundowns[0]

		const action = literal<MOS.IMOSROAction>({
			RunningOrderID: new MOS.MosString128(rundown.externalId),
		})
		const story0 = new MOS.MosString128('ro1;s1;p2')
		const story1 = new MOS.MosString128('ro1;s2;p2')

		waitForPromise(MeteorCall.peripheralDevice.mosRoStorySwap(device._id, device.token, action, story0, story1))

		expect(UpdateNext.ensureNextPartIsValid).toHaveBeenCalledWith(expect.anything(), playlist)

		// Don't care about the result here, just making sure there isnt an exception while updating the db

		expect(fixSnapshot(RundownPlaylists.findOne(rundown.playlistId), true)).toMatchSnapshot()
		expect(fixSnapshot(Rundowns.findOne(rundown._id), true)).toMatchSnapshot()
		expect(fixSnapshot(Segments.find({ rundownId: rundown._id }).fetch(), true)).toMatchSnapshot()
		expect(fixSnapshot(Parts.find({ rundownId: rundown._id }).fetch(), true)).toMatchSnapshot()
		expect(fixSnapshot(Pieces.find({ rundownId: rundown._id }).fetch(), true)).toMatchSnapshot()
	})

	testInFiber('mosRoStoryMove: Within segment', () => {
		// Reset RO
		waitForPromise(MeteorCall.peripheralDevice.mosRoCreate(device._id, device.token, mockRO.roCreate()))

		const playlist = RundownPlaylists.findOne() as RundownPlaylist
		expect(playlist).toBeTruthy()
		const rundowns = playlist.getRundowns()
		expect(rundowns).toHaveLength(1)
		const rundown = rundowns[0]

		const action = literal<MOS.IMOSStoryAction>({
			RunningOrderID: new MOS.MosString128(rundown.externalId),
			StoryID: new MOS.MosString128('ro1;s1;p2'),
		})
		const story0 = 'ro1;s1;p3'

		waitForPromise(
			MeteorCall.peripheralDevice.mosRoStoryMove(device._id, device.token, action, [new MOS.MosString128(story0)])
		)

		expect(UpdateNext.ensureNextPartIsValid).toHaveBeenCalledWith(expect.anything(), playlist)

		const { segments, parts } = waitForPromise(playlist.getSegmentsAndParts())
		const partMap = mockRO.segmentIdMap()
		partMap[0].parts[1] = 'ro1;s1;p3'
		partMap[0].parts[2] = 'ro1;s1;p2'
		expect(getPartIdMap(segments, parts)).toEqual(partMap)

		expect(fixSnapshot(RundownPlaylists.findOne(rundown.playlistId), true)).toMatchSnapshot()
		expect(fixSnapshot(Rundowns.findOne(rundown._id), true)).toMatchSnapshot()
		expect(fixSnapshot(Segments.find({ rundownId: rundown._id }).fetch(), true)).toMatchSnapshot()
		expect(fixSnapshot(Parts.find({ rundownId: rundown._id }).fetch(), true)).toMatchSnapshot()
		expect(fixSnapshot(Pieces.find({ rundownId: rundown._id }).fetch(), true)).toMatchSnapshot()
	})

	testInFiber('mosRoStoryMove: Move whole segment to end', () => {
		// Reset RO
		waitForPromise(MeteorCall.peripheralDevice.mosRoCreate(device._id, device.token, mockRO.roCreate()))

		const playlist = RundownPlaylists.findOne() as RundownPlaylist
		expect(playlist).toBeTruthy()
		const rundowns = playlist.getRundowns()
		expect(rundowns).toHaveLength(1)
		const rundown = rundowns[0]

		const action = literal<MOS.IMOSStoryAction>({
			RunningOrderID: new MOS.MosString128(rundown.externalId),
			StoryID: new MOS.MosString128(''),
		})
		const stories = [
			new MOS.MosString128('ro1;s1;p1'),
			new MOS.MosString128('ro1;s1;p2'),
			new MOS.MosString128('ro1;s1;p3'),
		]

		waitForPromise(MeteorCall.peripheralDevice.mosRoStoryMove(device._id, device.token, action, stories))

		expect(UpdateNext.ensureNextPartIsValid).toHaveBeenCalledWith(expect.anything(), playlist)

		const { segments, parts } = waitForPromise(playlist.getSegmentsAndParts())
		const partMap = mockRO.segmentIdMap()
		const old = partMap.splice(0, 1)
		partMap.splice(3, 0, ...old)
		expect(getPartIdMap(segments, parts)).toEqual(partMap)

		expect(fixSnapshot(RundownPlaylists.findOne(rundown.playlistId), true)).toMatchSnapshot()
		expect(fixSnapshot(Rundowns.findOne(rundown._id), true)).toMatchSnapshot()
		expect(fixSnapshot(Segments.find({ rundownId: rundown._id }).fetch(), true)).toMatchSnapshot()
		expect(fixSnapshot(Parts.find({ rundownId: rundown._id }).fetch(), true)).toMatchSnapshot()
		expect(fixSnapshot(Pieces.find({ rundownId: rundown._id }).fetch(), true)).toMatchSnapshot()
	})

	testInFiber('mosRoStoryMove: Invalid before ID', () => {
		// Reset RO
		waitForPromise(MeteorCall.peripheralDevice.mosRoCreate(device._id, device.token, mockRO.roCreate()))

		const rundown = Rundowns.findOne() as Rundown
		expect(rundown).toBeTruthy()

		const action = literal<MOS.IMOSStoryAction>({
			RunningOrderID: new MOS.MosString128(rundown.externalId),
			StoryID: new MOS.MosString128('fakeId'),
		})
		const stories = [
			new MOS.MosString128('ro1;s1;p1'),
			new MOS.MosString128('ro1;s1;p2'),
			new MOS.MosString128('ro1;s1;p3'),
		]

		try {
			waitForPromise(MeteorCall.peripheralDevice.mosRoStoryMove(device._id, device.token, action, stories))
			fail('expected to throw')
		} catch (e) {
			expect(e.message).toBe(
				`[404] Part ${action.StoryID.toString()} was not found in rundown ${action.RunningOrderID.toString()}`
			)
		}
	})

	testInFiber('mosRoStoryMove: Invalid before self', () => {
		const rundown = Rundowns.findOne() as Rundown
		expect(rundown).toBeTruthy()

		const action = literal<MOS.IMOSStoryAction>({
			RunningOrderID: new MOS.MosString128(rundown.externalId),
			StoryID: new MOS.MosString128('ro1;s1;p2'),
		})
		const stories = [
			new MOS.MosString128('ro1;s1;p1'),
			new MOS.MosString128('ro1;s1;p2'),
			new MOS.MosString128('ro1;s1;p3'),
		]

		try {
			waitForPromise(MeteorCall.peripheralDevice.mosRoStoryMove(device._id, device.token, action, stories))
			fail('expected to throw')
		} catch (e) {
			expect(e.message).toBe(
				`[404] Part ${action.StoryID.toString()} was not found in rundown ${action.RunningOrderID.toString()}`
			)
		}
	})

	testInFiber('mosRoStoryMove: Bad ID', () => {
		// Reset RO
		waitForPromise(MeteorCall.peripheralDevice.mosRoCreate(device._id, device.token, mockRO.roCreate()))

		const rundown = Rundowns.findOne() as Rundown
		expect(rundown).toBeTruthy()

		const action = literal<MOS.IMOSStoryAction>({
			RunningOrderID: new MOS.MosString128(rundown.externalId),
			StoryID: new MOS.MosString128(''),
		})
		const stories = [
			new MOS.MosString128('ro1;s1;p1'),
			new MOS.MosString128('ro1;s1;p999'),
			new MOS.MosString128('ro1;s1;p3'),
		]

		try {
			waitForPromise(MeteorCall.peripheralDevice.mosRoStoryMove(device._id, device.token, action, stories))
			fail('expected to throw')
		} catch (e) {
			expect(e.message).toBe(
				`[404] Parts ro1;s1;p999 were not found in rundown ${action.RunningOrderID.toString()}`
			)
		}
	})

	testInFiber('mosRoStoryDelete: Remove first story in segment', () => {
		// Reset RO
		waitForPromise(MeteorCall.peripheralDevice.mosRoCreate(device._id, device.token, mockRO.roCreate()))

		const rundown = Rundowns.findOne() as Rundown
		expect(rundown).toBeTruthy()

		const partExternalId = 'ro1;s1;p1'

		const partToBeRemoved = rundown.getParts({ externalId: partExternalId })[0]
		expect(partToBeRemoved).toBeTruthy()

		const partsInSegmentBefore = rundown.getParts({ segmentId: partToBeRemoved.segmentId })
		expect(partsInSegmentBefore).toHaveLength(3)

		const action = literal<MOS.IMOSROAction>({
			RunningOrderID: new MOS.MosString128(rundown.externalId),
		})

		// This should only remove the first part in the segment. The other parts will be regenerated
		waitForPromise(MeteorCall.peripheralDevice.mosRoStoryDelete(device._id, device.token, action, [partExternalId]))

		expect(Segments.findOne(partToBeRemoved.segmentId)).toBeFalsy()

		const partAfter = Parts.findOne(partsInSegmentBefore[2]._id) as Part
		expect(partAfter).toBeTruthy()

		const partsInSegmentAfter = rundown.getParts({ segmentId: partAfter.segmentId })
		expect(partsInSegmentAfter).toHaveLength(2)

		// The other parts in the segment should not not have changed:
		expect(partsInSegmentAfter[0]).toMatchObject(_.omit(partsInSegmentBefore[1], ['segmentId', '_rank']))

		expect(partsInSegmentAfter[1]).toMatchObject(_.omit(partsInSegmentBefore[2], ['segmentId', '_rank']))
	})

	function mosReplaceBasicStory(
		runningOrderId: string,
		oldStoryId: string,
		newStoryId: string,
		newStoryName: string
	) {
		waitForPromise(
			MeteorCall.peripheralDevice.mosRoStoryReplace(
				device._id,
				device.token,
				literal<MOS.IMOSStoryAction>({
					RunningOrderID: new MOS.MosString128(runningOrderId),
					StoryID: new MOS.MosString128(oldStoryId),
				}),
				literal<Array<MOS.IMOSROStory>>([
					{
						ID: new MOS.MosString128(newStoryId),
						Slug: new MOS.MosString128(newStoryName),
						Items: [],
					},
				])
			)
		)
	}

	function applySegmentRenameToContents(
		oldName: string,
		newName: string,
		oldSegments: Segment[],
		newSegments: Segment[],
		oldParts: Part[],
		oldPartInstances: PartInstance[]
	) {
		for (const oldSegment of oldSegments) {
			if (oldSegment.name === oldName) {
				const newSegment = newSegments.find((s) => s.name === newName)
				if (newSegment) {
					const oldSegmentId = oldSegment._id
					expect(oldSegmentId).not.toEqual(newSegment._id) // If the id doesn't change, then the whole test is invalid
					oldSegment.name = newSegment.name
					oldSegment._id = newSegment._id
					oldSegment.externalId = newSegment.externalId

					// update parts
					for (const oldPart of oldParts) {
						if (oldPart.segmentId === oldSegmentId) {
							oldPart.segmentId = newSegment._id
							oldPart.title = newSegment.name + ';' + oldPart.title.split(';')[1]
							delete oldPart.metaData
						}
					}

					// update partInstances
					for (const oldPartInstance of oldPartInstances) {
						if (oldPartInstance.segmentId === oldSegmentId) {
							oldPartInstance.segmentId = newSegment._id
							oldPartInstance.part.segmentId = newSegment._id
						}
					}

					// Only the first matching segment
					break
				}
			}
		}
	}

	testInFiber('Rename segment during update while on air', () => {
		// Reset RO
		waitForPromise(MeteorCall.peripheralDevice.mosRoCreate(device._id, device.token, mockRO.roCreate()))

		const rundown = Rundowns.findOne() as Rundown
		expect(rundown).toBeTruthy()

		// activate and set on air
		waitForPromise(MeteorCall.userAction.activate('', rundown.playlistId, true))
		waitForPromise(MeteorCall.userAction.setNext('', rundown.playlistId, getPartId(rundown._id, 'ro1;s2;p1')))
		waitForPromise(MeteorCall.userAction.take('', rundown.playlistId))

		const partInstances0 = rundown.getAllPartInstances()
		const { segments: segments0, parts: parts0 } = waitForPromise(rundown.getSegmentsAndParts())

		mosReplaceBasicStory(rundown.externalId, 'ro1;s2;p1', 'ro1;s2;p1', 'SEGMENT2b;PART1')
		mosReplaceBasicStory(rundown.externalId, 'ro1;s2;p2', 'ro1;s2;p2', 'SEGMENT2b;PART2')

		const partInstances = rundown.getAllPartInstances()
		const { segments, parts } = waitForPromise(rundown.getSegmentsAndParts())

		// Update expected data, for just the segment name and ids changing
		applySegmentRenameToContents('SEGMENT2', 'SEGMENT2b', segments0, segments, parts0, partInstances0)

		expect(fixSnapshot(segments)).toMatchObject(fixSnapshot(segments0))
		expect(fixSnapshot(parts)).toMatchObject(fixSnapshot(parts0))
		expect(fixSnapshot(partInstances)).toMatchObject(fixSnapshot(partInstances0))
	})

	testInFiber('Rename segment during resync while on air', () => {
		const mosRO = mockRO.roCreate()

		// Reset RO
		waitForPromise(MeteorCall.peripheralDevice.mosRoCreate(device._id, device.token, mosRO))

		const rundown = Rundowns.findOne() as Rundown
		expect(rundown).toBeTruthy()
		expect(rundown.orphaned).toBeFalsy()

		// activate and set on air
		waitForPromise(MeteorCall.userAction.activate('', rundown.playlistId, true))
		waitForPromise(MeteorCall.userAction.setNext('', rundown.playlistId, getPartId(rundown._id, 'ro1;s2;p1')))
		waitForPromise(MeteorCall.userAction.take('', rundown.playlistId))

		const partInstances0 = rundown.getAllPartInstances()
		const { segments: segments0, parts: parts0 } = waitForPromise(rundown.getSegmentsAndParts())

		// rename the segment
		for (const story of mosRO.Stories) {
			// mutate the slugs of the second segment
			if (story.Slug && story.ID.toString().match(/;s2;/i)) {
				story.Slug = new MOS.MosString128('SEGMENT2b;' + story.Slug.toString().split(';')[1])
			}
		}

		// regenerate the rundown
		waitForPromise(MeteorCall.peripheralDevice.mosRoCreate(device._id, device.token, mosRO))

		{
			// still valid
			const rundown = Rundowns.findOne() as Rundown
			expect(rundown).toBeTruthy()
			expect(rundown.orphaned).toBeFalsy()
		}

		const partInstances = rundown.getAllPartInstances()
		const { segments, parts } = waitForPromise(rundown.getSegmentsAndParts())

		// Update expected data, for just the segment name and ids changing
		applySegmentRenameToContents('SEGMENT2', 'SEGMENT2b', segments0, segments, parts0, partInstances0)

		expect(fixSnapshot(segments)).toMatchObject(fixSnapshot(segments0))
		expect(fixSnapshot(parts)).toMatchObject(fixSnapshot(parts0))
		expect(fixSnapshot(partInstances)).toMatchObject(fixSnapshot(partInstances0))
	})
})
