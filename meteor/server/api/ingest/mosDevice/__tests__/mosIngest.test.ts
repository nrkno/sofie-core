import { Meteor } from 'meteor/meteor'
import * as MOS from 'mos-connection'
import * as _ from 'underscore'
import { PeripheralDeviceAPI } from '../../../../../lib/api/peripheralDevice'
import {
	setupDefaultStudioEnvironment
} from '../../../../../__mocks__/helpers/database'
import { Rundowns, Rundown } from '../../../../../lib/collections/Rundowns'
import { setLoggerLevel } from '../../../logger'
import { testInFiber } from '../../../../../__mocks__/helpers/jest'
import { Segments, DBSegment } from '../../../../../lib/collections/Segments'
import { Parts, DBPart, Part } from '../../../../../lib/collections/Parts'
import { PeripheralDevice } from '../../../../../lib/collections/PeripheralDevices'
import { literal } from '../../../../../lib/lib'

import { mockRO } from './mock-mos-data'

require('../api.ts') // include in order to create the Meteor methods needed

function getPartIdMap (segments: DBSegment[], parts: DBPart[]) {
	const sortedParts = _.sortBy(parts, p => p._rank)
	const groupedParts = _.groupBy(sortedParts, p => p.segmentId)
	const arr: [string, DBPart[]][] = _.pairs(groupedParts)
	const idMap = _.map(arr, g => ({
		segment: g[0],
		parts: _.map(g[1], p => p.externalId)
	}))
	return _.sortBy(idMap, s => {
		const obj = _.find(segments, s2 => s2._id === s.segment)
		return obj ? obj._rank : 99999
	})
}

describe('Test recieved mos actions', () => {

	let device: PeripheralDevice
	beforeAll(() => {
		device = setupDefaultStudioEnvironment().device
	})

	testInFiber('mosRoCreate', () => {
		// setLoggerLevel('debug')

		expect(Rundowns.findOne()).toBeFalsy()

		const roData = mockRO.roCreate()
		Meteor.call(PeripheralDeviceAPI.methods.mosRoCreate, device._id, device.token, roData)

		const rundown = Rundowns.findOne() as Rundown
		expect(rundown).toMatchObject({
			externalId: roData.ID.toString()
		})

		const segments = Segments.find({ rundownId: rundown._id }).fetch()
		const parts = Parts.find({ rundownId: rundown._id }).fetch()

		expect(getPartIdMap(segments, parts)).toEqual(mockRO.segmentIdMap())
	})

	testInFiber('mosRoCreate: replace existing', () => {
		// setLoggerLevel('debug')

		const roData = mockRO.roCreate()
		const s = roData.Stories.splice(7, 1)
		roData.Stories.splice(4, 0, ...s)

		expect(Rundowns.findOne({ externalId: roData.ID.toString() })).toBeTruthy()

		Meteor.call(PeripheralDeviceAPI.methods.mosRoCreate, device._id, device.token, roData)

		const rundown = Rundowns.findOne() as Rundown
		expect(rundown).toMatchObject({
			externalId: roData.ID.toString()
		})

		const segments = Segments.find({ rundownId: rundown._id }).fetch()
		const parts = Parts.find({ rundownId: rundown._id }).fetch()

		const partMap2 = mockRO.segmentIdMap()
		partMap2[1].parts.splice(1, 0, ...partMap2[3].parts)
		partMap2.splice(3, 1)

		expect(getPartIdMap(segments, parts)).toEqual(partMap2)
	})

	testInFiber('mosRoDelete', () => {
		const roData = mockRO.roCreate()
		expect(Rundowns.findOne({ externalId: roData.ID.toString() })).toBeTruthy()

		Meteor.call(PeripheralDeviceAPI.methods.mosRoDelete, device._id, device.token, roData.ID)

		expect(Rundowns.findOne()).toBeFalsy()
	})

	testInFiber('mosRoDelete: Does not exist', () => {
		const roData = mockRO.roCreate()
		expect(Rundowns.findOne()).toBeFalsy()

		try {
			Meteor.call(PeripheralDeviceAPI.methods.mosRoDelete, device._id, device.token, roData.ID)
			expect(true).toBe(false) // Please throw and don't get here
		} catch (e) {
			expect(e.message).toBe(`[404] Rundown ${roData.ID.toString()} not found`)
		}
	})

	testInFiber('mosRoStatus: Update ro', () => {
		// Reset RO
		Meteor.call(PeripheralDeviceAPI.methods.mosRoCreate, device._id, device.token, mockRO.roCreate())

		const newStatus = MOS.IMOSObjectStatus.BUSY

		let rundown = Rundowns.findOne() as Rundown
		expect(rundown).toBeTruthy()
		expect(rundown.status).not.toEqual(newStatus.toString())

		const payload = literal<MOS.IMOSRunningOrderStatus>({
			ID: new MOS.MosString128(rundown.externalId),
			Status: newStatus,
			Time: new MOS.MosTime(0)
		})

		Meteor.call(PeripheralDeviceAPI.methods.mosRoStatus, device._id, device.token, payload)

		rundown = Rundowns.findOne({ _id: rundown._id }) as Rundown
		expect(rundown).toBeTruthy()
		expect(rundown.status).toEqual(newStatus.toString())
	})

	testInFiber('mosRoStatus: Missing ro', () => {
		const newStatus = MOS.IMOSObjectStatus.BUSY

		const externalId = 'fakeId'
		expect(Rundowns.findOne({ externalId: externalId })).toBeFalsy()

		const payload = literal<MOS.IMOSRunningOrderStatus>({
			ID: new MOS.MosString128(externalId),
			Status: newStatus,
			Time: new MOS.MosTime(0)
		})

		try {
			Meteor.call(PeripheralDeviceAPI.methods.mosRoStatus, device._id, device.token, payload)
			expect(true).toBe(false) // Please throw and don't get here
		} catch (e) {
			expect(e.message).toBe(`[404] Rundown ${externalId} not found`)
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

		Meteor.call(PeripheralDeviceAPI.methods.mosRoReadyToAir, device._id, device.token, payload)

		rundown = Rundowns.findOne({ _id: rundown._id }) as Rundown
		expect(rundown).toBeTruthy()
		expect(rundown.airStatus).toEqual(newStatus.toString())
	})

	testInFiber('mosRoReadyToAir: Missing ro', () => {
		const newStatus = MOS.IMOSObjectAirStatus.READY

		const externalId = 'fakeId'
		expect(Rundowns.findOne({ externalId: externalId })).toBeFalsy()

		const payload = literal<MOS.IMOSROReadyToAir>({
			ID: new MOS.MosString128(externalId),
			Status: newStatus
		})

		try {
			Meteor.call(PeripheralDeviceAPI.methods.mosRoReadyToAir, device._id, device.token, payload)
			expect(true).toBe(false) // Please throw and don't get here
		} catch (e) {
			expect(e.message).toBe(`[404] Rundown ${externalId} not found`)
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
			Time: new MOS.MosTime(0)
		})

		Meteor.call(PeripheralDeviceAPI.methods.mosRoStoryStatus, device._id, device.token, payload)

		part = Parts.findOne(part._id) as Part
		expect(part).toBeTruthy()
		expect(part.status).toEqual(newStatus.toString())
	})

	testInFiber('mosRoStatus: Wrong ro for part', () => {
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
			Time: new MOS.MosTime(0)
		})

		try {
			Meteor.call(PeripheralDeviceAPI.methods.mosRoStoryStatus, device._id, device.token, payload)
			expect(true).toBe(false) // Please throw and don't get here
		} catch (e) {
			expect(e.message).toBe(`[404] Rundown ${rundownExternalId} not found`)
		}
	})

	testInFiber('mosRoStatus: Missing part', () => {
		const newStatus = MOS.IMOSObjectStatus.PLAY

		const rundown = Rundowns.findOne() as Rundown
		expect(rundown).toBeTruthy()

		const partExternalId = 'fakeId'

		const payload = literal<MOS.IMOSStoryStatus>({
			RunningOrderId: new MOS.MosString128(rundown.externalId),
			ID: new MOS.MosString128(partExternalId),
			Status: newStatus,
			Time: new MOS.MosTime(0)
		})

		try {
			Meteor.call(PeripheralDeviceAPI.methods.mosRoStoryStatus, device._id, device.token, payload)
			expect(true).toBe(false) // Please throw and don't get here
		} catch (e) {
			expect(e.message).toBe(`[404] Part ${partExternalId} in rundown ${rundown.externalId} not found`)
		}
	})

	testInFiber('mosRoStoryInsert: Into segment', () => {
		const rundown = Rundowns.findOne() as Rundown
		expect(rundown).toBeTruthy()

		const newPartData = mockRO.newItem('ro1;s1;newPart1', 'SEGMENT1;new1')

		const action = literal<MOS.IMOSStoryAction>({
			RunningOrderID: new MOS.MosString128(rundown.externalId),
			StoryID: new MOS.MosString128('ro1;s1;p3'),
		})

		Meteor.call(PeripheralDeviceAPI.methods.mosRoStoryInsert, device._id, device.token, action, [newPartData])

		const segments = Segments.find({ rundownId: rundown._id }).fetch()
		const parts = Parts.find({ rundownId: rundown._id }).fetch()

		const partMap = mockRO.segmentIdMap()
		partMap[0].parts.splice(2, 0, newPartData.ID.toString())
		expect(getPartIdMap(segments, parts)).toEqual(partMap)
	})

	testInFiber('mosRoStoryInsert: New segment', () => {
		const rundown = Rundowns.findOne() as Rundown
		expect(rundown).toBeTruthy()

		Parts.remove({ externalId: 'ro1;s1;newPart1' })

		const newPartData = mockRO.newItem('ro1;s1b;newPart1', 'SEGMENT1B;new1')

		const action = literal<MOS.IMOSStoryAction>({
			RunningOrderID: new MOS.MosString128(rundown.externalId),
			StoryID: new MOS.MosString128('ro1;s2;p1'),
		})

		Meteor.call(PeripheralDeviceAPI.methods.mosRoStoryInsert, device._id, device.token, action, [newPartData])

		const segments = Segments.find({ rundownId: rundown._id }).fetch()
		const parts = Parts.find({ rundownId: rundown._id }).fetch()

		const partMap = mockRO.segmentIdMap()
		partMap.splice(1, 0, {
			segment: '8CruCv_msUpxN9xQ55Tx_5i6alo_',
			parts: [newPartData.ID.toString()]
		})
		partMap[2].segment = 'r3rgFPVtqCdSPJjFqKTL80ZSMHE_'
		partMap[3].segment = '1Q7TyY1yvptTCGmcLBq9Bm7O7lQ_'
		partMap[4].segment = 'K7WgS_P4x0U3kupauhsLBP92q4c_'
		expect(getPartIdMap(segments, parts)).toEqual(partMap)
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
			Meteor.call(PeripheralDeviceAPI.methods.mosRoStoryInsert, device._id, device.token, action, [newPartData])
			expect(true).toBe(false) // Please throw and don't get here
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
			Meteor.call(PeripheralDeviceAPI.methods.mosRoStoryInsert, device._id, device.token, action, [newPartData])
			expect(true).toBe(false) // Please throw and don't get here
		} catch (e) {
			expect(e.message).toBe(`[500] Parts ${newPartData.ID.toString()} already exist in rundown ${rundown.externalId}`)
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
	// 	// 	Meteor.call(PeripheralDeviceAPI.methods.mosRoStoryInsert, device._id, device.token, action, [newPartData])
	// 	// 	expect(true).toBe(false) // Please throw and don't get here
	// 	// } catch (e) {
	// 	// 	expect(e.message).toBe(`[404] Part ${action.StoryID.toString()} in rundown ${rundown.externalId} not found`)
	// 	// }

	// 	// expect(Parts.findOne({ externalId: newPartData.ID.toString() })).toBeFalsy()
	// })

	testInFiber('mosRoStoryReplace: Same segment', () => {
		// Reset RO
		Meteor.call(PeripheralDeviceAPI.methods.mosRoCreate, device._id, device.token, mockRO.roCreate())

		const rundown = Rundowns.findOne() as Rundown
		expect(rundown).toBeTruthy()

		Parts.remove({ externalId: 'ro1;s1;newPart1' })

		const newPartData = mockRO.newItem('ro1;s1;newPart1', 'SEGMENT1;new1')

		const action = literal<MOS.IMOSStoryAction>({
			RunningOrderID: new MOS.MosString128(rundown.externalId),
			StoryID: new MOS.MosString128('ro1;s1;p2'),
		})

		Meteor.call(PeripheralDeviceAPI.methods.mosRoStoryReplace, device._id, device.token, action, [newPartData])

		const segments = Segments.find({ rundownId: rundown._id }).fetch()
		const parts = Parts.find({ rundownId: rundown._id }).fetch()

		const partMap = mockRO.segmentIdMap()
		partMap[0].parts[1] = newPartData.ID.toString()
		expect(getPartIdMap(segments, parts)).toEqual(partMap)
	})

	testInFiber('mosRoStoryReplace: Unknown ID', () => {
		const rundown = Rundowns.findOne() as Rundown
		expect(rundown).toBeTruthy()

		Parts.remove({ externalId: 'ro1;s1;newPart1' })

		const newPartData = mockRO.newItem('ro1;s1;newPart1', 'SEGMENT1;new1')

		const action = literal<MOS.IMOSStoryAction>({
			RunningOrderID: new MOS.MosString128(rundown.externalId),
			StoryID: new MOS.MosString128('fakeId2'),
		})

		try {
			Meteor.call(PeripheralDeviceAPI.methods.mosRoStoryReplace, device._id, device.token, action, [newPartData])
			expect(true).toBe(false) // Please throw and don't get here
		} catch (e) {
			expect(e.message).toBe(`[404] Part ${action.StoryID.toString()} in rundown ${rundown.externalId} not found`)
		}

		expect(Parts.findOne({ externalId: newPartData.ID.toString() })).toBeFalsy()
	})

	testInFiber('mosRoStoryDelete: Remove segment', () => {
		// Reset RO
		Meteor.call(PeripheralDeviceAPI.methods.mosRoCreate, device._id, device.token, mockRO.roCreate())

		const rundown = Rundowns.findOne() as Rundown
		expect(rundown).toBeTruthy()

		const partExternalIds = ['ro1;s3;p1', 'ro1;s3;p2']

		const action = literal<MOS.IMOSROAction>({
			RunningOrderID: new MOS.MosString128(rundown.externalId),
		})

		Meteor.call(PeripheralDeviceAPI.methods.mosRoStoryDelete, device._id, device.token, action, partExternalIds)

		expect(Parts.find({ externalId: { $in: partExternalIds } }).count()).toEqual(0)

		const segments = Segments.find({ rundownId: rundown._id }).fetch()
		const parts = Parts.find({ rundownId: rundown._id }).fetch()

		const partMap = mockRO.segmentIdMap()
		partMap[1].parts.push(...partMap[3].parts)
		partMap.splice(2, 2)
		expect(getPartIdMap(segments, parts)).toEqual(partMap)
	})

	testInFiber('mosRoStoryDelete: Remove invalid id', () => {
		const rundown = Rundowns.findOne() as Rundown
		expect(rundown).toBeTruthy()

		const partExternalIds = ['ro1;s1;p2', 'fakeId']

		const action = literal<MOS.IMOSROAction>({
			RunningOrderID: new MOS.MosString128(rundown.externalId),
		})

		try {
			Meteor.call(PeripheralDeviceAPI.methods.mosRoStoryDelete, device._id, device.token, action, partExternalIds)
			expect(true).toBe(false) // Please throw and don't get here
		} catch (e) {
			expect(e.message).toBe(`[404] Parts fakeId in rundown ${rundown.externalId} were not found`)
		}

		expect(Parts.find({ externalId: { $in: partExternalIds } }).count()).toEqual(1)
	})

	testInFiber('mosRoFullStory: Valid data', () => {
		// Reset RO
		Meteor.call(PeripheralDeviceAPI.methods.mosRoCreate, device._id, device.token, mockRO.roCreate())

		const rundown = Rundowns.findOne() as Rundown
		expect(rundown).toBeTruthy()

		const story = literal<MOS.IMOSROFullStory>({
			RunningOrderId: new MOS.MosString128(rundown.externalId),
			ID: new MOS.MosString128('ro1;s1;p2'),
			Body: []
		})

		Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, device._id, device.token, story)

		const part = Parts.findOne({ externalId: story.ID.toString() }) as Part
		expect(part).toBeTruthy()
		expect(part.metaData).toEqual(story)
	})

	testInFiber('mosRoFullStory: Unknown Part', () => {
		const rundown = Rundowns.findOne() as Rundown
		expect(rundown).toBeTruthy()

		const story = literal<MOS.IMOSROFullStory>({
			RunningOrderId: new MOS.MosString128(rundown.externalId),
			ID: new MOS.MosString128('fakeId'),
			Body: []
		})

		try {
			Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, device._id, device.token, story)
			expect(true).toBe(false) // Please throw and don't get here
		} catch (e) {
			expect(e.message).toBe(`[404] Part "${story.ID.toString()}" in rundown "${rundown.externalId}" is missing cached ingest data`)
		}
	})

	testInFiber('mosRoFullStory: Unknown Rundown', () => {
		const rundown = Rundowns.findOne() as Rundown
		expect(rundown).toBeTruthy()

		const story = literal<MOS.IMOSROFullStory>({
			RunningOrderId: new MOS.MosString128('fakeId'),
			ID: new MOS.MosString128('ro1;s1;p2'),
			Body: []
		})

		try {
			Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, device._id, device.token, story)
			expect(true).toBe(false) // Please throw and don't get here
		} catch (e) {
			expect(e.message).toBe(`[404] Rundown ${story.RunningOrderId.toString()} not found`)
		}
	})

	testInFiber('mosRoStorySwap: Within same segment', () => {
		// Reset RO
		Meteor.call(PeripheralDeviceAPI.methods.mosRoCreate, device._id, device.token, mockRO.roCreate())

		const rundown = Rundowns.findOne() as Rundown
		expect(rundown).toBeTruthy()

		const action = literal<MOS.IMOSROAction>({
			RunningOrderID: new MOS.MosString128(rundown.externalId),
		})
		const story0 = new MOS.MosString128('ro1;s1;p1')
		const story1 = new MOS.MosString128('ro1;s1;p3')

		Meteor.call(PeripheralDeviceAPI.methods.mosRoStorySwap, device._id, device.token, action, story0, story1)

		const segments = Segments.find({ rundownId: rundown._id }).fetch()
		const parts = Parts.find({ rundownId: rundown._id }).fetch()

		const partMap = mockRO.segmentIdMap()
		partMap[0].parts[0] = 'ro1;s1;p3'
		partMap[0].parts[2] = 'ro1;s1;p1'
		expect(getPartIdMap(segments, parts)).toEqual(partMap)
	})

	testInFiber('mosRoStorySwap: Swap with self', () => {
		const rundown = Rundowns.findOne() as Rundown
		expect(rundown).toBeTruthy()

		const action = literal<MOS.IMOSROAction>({
			RunningOrderID: new MOS.MosString128(rundown.externalId),
		})
		const story0 = new MOS.MosString128('ro1;s1;p1')

		try {
			Meteor.call(PeripheralDeviceAPI.methods.mosRoStorySwap, device._id, device.token, action, story0, story0)
			expect(true).toBe(false) // Please throw and don't get here
		} catch (e) {
			expect(e.message).toBe(`[400] Cannot swap part ${story0} with itself in rundown ${action.RunningOrderID.toString()}`)
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
			Meteor.call(PeripheralDeviceAPI.methods.mosRoStorySwap, device._id, device.token, action, story0, story1)
			expect(true).toBe(false) // Please throw and don't get here
		} catch (e) {
			expect(e.message).toBe(`[404] Story ${story1} not found in rundown ${action.RunningOrderID.toString()}`)
		}

		try {
			Meteor.call(PeripheralDeviceAPI.methods.mosRoStorySwap, device._id, device.token, action, story1, story0)
			expect(true).toBe(false) // Please throw and don't get here
		} catch (e) {
			expect(e.message).toBe(`[404] Story ${story1} not found in rundown ${action.RunningOrderID.toString()}`)
		}
	})



})
