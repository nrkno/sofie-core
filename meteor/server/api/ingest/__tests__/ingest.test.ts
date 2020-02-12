import { Meteor } from 'meteor/meteor'
import { PeripheralDeviceAPI } from '../../../../lib/api/peripheralDevice'
import { setupDefaultStudioEnvironment } from '../../../../__mocks__/helpers/database'
import { Rundowns, Rundown } from '../../../../lib/collections/Rundowns'
import { PeripheralDevice } from '../../../../lib/collections/PeripheralDevices'
import { testInFiber } from '../../../../__mocks__/helpers/jest'
import { Segment, Segments } from '../../../../lib/collections/Segments'
import { Part, Parts } from '../../../../lib/collections/Parts'
import { IngestRundown, IngestSegment, IngestPart } from 'tv-automation-sofie-blueprints-integration'
import { updatePartRanks } from '../../rundown'

require('../api.ts') // include in order to create the Meteor methods needed

describe('Test ingest actions for rundowns and segments', () => {

	let device: PeripheralDevice
	let externalId = 'abcde'
	let segExternalId = 'zyxwv'
	beforeAll(() => {
		device = setupDefaultStudioEnvironment().ingestDevice
	})

	testInFiber('dataRundownCreate', () => {
		// setLoggerLevel('debug')

		expect(Rundowns.findOne()).toBeFalsy()

		const rundownData: IngestRundown = {
			externalId: externalId,
			name: 'MyMockRundown',
			type: 'mock',
			// payload: {},
			segments: [
				{
					externalId: 'segment0',
					name: 'Segment 0',
					rank: 0,
					// payload?: any,
					parts: [
						{
							externalId: 'part0',
							name: 'Part 0',
							rank: 0,
							// payload?: any,
						},
						{
							externalId: 'part1',
							name: 'Part 1',
							rank: 0,
							// payload?: any,
						}
					]
				},
				{
					externalId: 'segment1',
					name: 'Segment 1',
					rank: 0,
					// payload?: any,
					parts: [
						{
							externalId: 'part2',
							name: 'Part 2',
							rank: 0,
							// payload?: any,
						}
					]
				}
			]
		}

		Meteor.call(PeripheralDeviceAPI.methods.dataRundownCreate, device._id, device.token, rundownData)

		const rundown = Rundowns.findOne() as Rundown
		expect(rundown).toMatchObject({
			externalId: rundownData.externalId
		})
		expect(typeof rundown.touch).toEqual('function')

		const segments = Segments.find({ rundownId: rundown._id }).fetch()
		expect(segments).toHaveLength(2)

		const parts0 = Parts.find({ rundownId: rundown._id, segmentId: segments[0]._id }).fetch()
		expect(parts0).toHaveLength(2)

		const parts1 = Parts.find({ rundownId: rundown._id, segmentId: segments[1]._id }).fetch()
		expect(parts1).toHaveLength(1)
	})

	testInFiber('dataRundownUpdate change name', () => {
		expect(Rundowns.findOne()).toBeTruthy()
		const rundownData: IngestRundown = {
			externalId: externalId,
			name: 'MyMockRundownRenamed',
			type: 'mock',
			// payload: {},
			segments: [
				{
					externalId: 'segment0',
					name: 'Segment 0',
					rank: 0,
					// payload?: any,
					parts: [
						{
							externalId: 'part0',
							name: 'Part 0',
							rank: 0,
							// payload?: any,
						},
						{
							externalId: 'part1',
							name: 'Part 1',
							rank: 0,
							// payload?: any,
						}
					]
				},
				{
					externalId: 'segment1',
					name: 'Segment 1',
					rank: 0,
					// payload?: any,
					parts: [
						{
							externalId: 'part2',
							name: 'Part 2',
							rank: 0,
							// payload?: any,
						}
					]
				}
			]
		}
		Meteor.call(PeripheralDeviceAPI.methods.dataRundownUpdate, device._id, device.token, rundownData)

		const rundown = Rundowns.findOne() as Rundown
		expect(rundown).toMatchObject({
			externalId: rundownData.externalId,
			name: rundownData.name
		})
		expect(typeof rundown.touch).toEqual('function')
		expect(Rundowns.find().count()).toBe(1)

		const segments = Segments.find({ rundownId: rundown._id }).fetch()
		expect(segments).toHaveLength(2)

		const parts0 = Parts.find({ rundownId: rundown._id, segmentId: segments[0]._id }).fetch()
		expect(parts0).toHaveLength(2)

		const parts1 = Parts.find({ rundownId: rundown._id, segmentId: segments[1]._id }).fetch()
		expect(parts1).toHaveLength(1)
	})

	testInFiber('dataRundownUpdate add a segment', () => {
		expect(Rundowns.findOne()).toBeTruthy()
		const rundownData: IngestRundown = {
			externalId: externalId,
			name: 'MyMockRundown',
			type: 'mock',
			// payload: {},
			segments: [
				{
					externalId: 'segment0',
					name: 'Segment 0',
					rank: 0,
					// payload?: any,
					parts: [
						{
							externalId: 'part0',
							name: 'Part 0',
							rank: 0,
							// payload?: any,
						},
						{
							externalId: 'part1',
							name: 'Part 1',
							rank: 0,
							// payload?: any,
						}
					]
				},
				{
					externalId: 'segment1',
					name: 'Segment 1',
					rank: 0,
					// payload?: any,
					parts: [
						{
							externalId: 'part2',
							name: 'Part 2',
							rank: 0,
							// payload?: any,
						}
					]
				},
				{
					externalId: 'segment2',
					name: 'Segment 2',
					rank: 0,
					// payload?: any,
					parts: [
						{
							externalId: 'part3',
							name: 'Part 3',
							rank: 0,
							// payload?: any,
						}
					]
				}
			]
		}
		Meteor.call(PeripheralDeviceAPI.methods.dataRundownUpdate, device._id, device.token, rundownData)

		const rundown = Rundowns.findOne() as Rundown
		expect(rundown).toMatchObject({
			externalId: rundownData.externalId
		})
		expect(typeof rundown.touch).toEqual('function')
		expect(Rundowns.find().count()).toBe(1)

		const segments = Segments.find({ rundownId: rundown._id }).fetch()
		expect(segments).toHaveLength(3)

		const parts0 = Parts.find({ rundownId: rundown._id, segmentId: segments[0]._id }).fetch()
		expect(parts0).toHaveLength(2)

		const parts1 = Parts.find({ rundownId: rundown._id, segmentId: segments[1]._id }).fetch()
		expect(parts1).toHaveLength(1)

		const parts2 = Parts.find({ rundownId: rundown._id, segmentId: segments[2]._id }).fetch()
		expect(parts2).toHaveLength(1)
	})

	testInFiber('dataRundownUpdate add a part', () => {
		expect(Rundowns.findOne()).toBeTruthy()
		const rundownData: IngestRundown = {
			externalId: externalId,
			name: 'MyMockRundown',
			type: 'mock',
			// payload: {},
			segments: [
				{
					externalId: 'segment0',
					name: 'Segment 0',
					rank: 0,
					// payload?: any,
					parts: [
						{
							externalId: 'part0',
							name: 'Part 0',
							rank: 0,
							// payload?: any,
						},
						{
							externalId: 'part1',
							name: 'Part 1',
							rank: 0,
							// payload?: any,
						}
					]
				},
				{
					externalId: 'segment1',
					name: 'Segment 1',
					rank: 0,
					// payload?: any,
					parts: [
						{
							externalId: 'part2',
							name: 'Part 2',
							rank: 0,
							// payload?: any,
						},
						{
							externalId: 'partZ',
							name: 'Part Z',
							rank: 0,
						}
					]
				},
				{
					externalId: 'segment2',
					name: 'Segment 2',
					rank: 0,
					// payload?: any,
					parts: [
						{
							externalId: 'part3',
							name: 'Part 3',
							rank: 0,
							// payload?: any,
						}
					]
				}
			]
		}
		Meteor.call(PeripheralDeviceAPI.methods.dataRundownUpdate, device._id, device.token, rundownData)

		const rundown = Rundowns.findOne() as Rundown
		expect(rundown).toMatchObject({
			externalId: rundownData.externalId
		})
		expect(typeof rundown.touch).toEqual('function')
		expect(Rundowns.find().count()).toBe(1)

		const segments = Segments.find({ rundownId: rundown._id }).fetch()
		expect(segments).toHaveLength(3)

		const parts0 = Parts.find({ rundownId: rundown._id, segmentId: segments[0]._id }).fetch()
		expect(parts0).toHaveLength(2)

		const parts1 = Parts.find({ rundownId: rundown._id, segmentId: segments[1]._id }).fetch()
		expect(parts1).toHaveLength(2)
		expect(parts1.map(x => x.title)).toEqual(['Part 2', 'Part Z'])

		const parts2 = Parts.find({ rundownId: rundown._id, segmentId: segments[2]._id }).fetch()
		expect(parts2).toHaveLength(1)
	})

	testInFiber('dataRundownUpdate remove a segment', () => {
		expect(Rundowns.findOne()).toBeTruthy()
		const rundownData: IngestRundown = {
			externalId: externalId,
			name: 'MyMockRundown',
			type: 'mock',
			// payload: {},
			segments: [
				{
					externalId: 'segment0',
					name: 'Segment 0',
					rank: 0,
					// payload?: any,
					parts: [
						{
							externalId: 'part0',
							name: 'Part 0',
							rank: 0,
							// payload?: any,
						},
						{
							externalId: 'part1',
							name: 'Part 1',
							rank: 0,
							// payload?: any,
						}
					]
				},
				{
					externalId: 'segment2',
					name: 'Segment 2',
					rank: 0,
					// payload?: any,
					parts: [
						{
							externalId: 'part3',
							name: 'Part 3',
							rank: 0,
							// payload?: any,
						}
					]
				}
			]
		}
		Meteor.call(PeripheralDeviceAPI.methods.dataRundownUpdate, device._id, device.token, rundownData)

		const rundown = Rundowns.findOne() as Rundown
		expect(rundown).toMatchObject({
			externalId: rundownData.externalId
		})
		expect(typeof rundown.touch).toEqual('function')
		expect(Rundowns.find().count()).toBe(1)

		const segments = Segments.find({ rundownId: rundown._id }).fetch()
		expect(segments).toHaveLength(2)

		const parts0 = Parts.find({ rundownId: rundown._id, segmentId: segments[0]._id }).fetch()
		expect(parts0).toHaveLength(2)

		const parts1 = Parts.find({ rundownId: rundown._id, segmentId: segments[1]._id }).fetch()
		expect(parts1).toHaveLength(1)
	})

	testInFiber('dataRundownUpdate remove a part', () => {
		expect(Rundowns.findOne()).toBeTruthy()
		const rundownData: IngestRundown = {
			externalId: externalId,
			name: 'MyMockRundown',
			type: 'mock',
			// payload: {},
			segments: [
				{
					externalId: 'segment0',
					name: 'Segment 0',
					rank: 0,
					// payload?: any,
					parts: [
						{
							externalId: 'part1',
							name: 'Part 1',
							rank: 0,
							// payload?: any,
						}
					]
				},
				{
					externalId: 'segment2',
					name: 'Segment 2',
					rank: 0,
					// payload?: any,
					parts: [
						{
							externalId: 'part3',
							name: 'Part 3',
							rank: 0,
							// payload?: any,
						}
					]
				}
			]
		}
		Meteor.call(PeripheralDeviceAPI.methods.dataRundownUpdate, device._id, device.token, rundownData)

		const rundown = Rundowns.findOne() as Rundown
		expect(rundown).toMatchObject({
			externalId: rundownData.externalId
		})
		expect(typeof rundown.touch).toEqual('function')
		expect(Rundowns.find().count()).toBe(1)

		const segments = Segments.find({ rundownId: rundown._id }).fetch()
		expect(segments).toHaveLength(2)

		const parts0 = Parts.find({ rundownId: rundown._id, segmentId: segments[0]._id }).fetch()
		expect(parts0).toHaveLength(1)
		expect(parts0[0].externalId).toBe('part1')

		const parts1 = Parts.find({ rundownId: rundown._id, segmentId: segments[1]._id }).fetch()
		expect(parts1).toHaveLength(1)
	})

	testInFiber('dataRundownDelete', () => {
		expect(Rundowns.findOne()).toBeTruthy()
		Meteor.call(PeripheralDeviceAPI.methods.dataRundownDelete, device._id, device.token, externalId)
		expect(Rundowns.findOne()).toBeFalsy()
		expect(Segments.find().count()).toBe(0)
		expect(Parts.find().count()).toBe(0)
	})

	testInFiber('dataRundownDelete for a second time', () => {
		expect(Rundowns.findOne()).toBeFalsy()
		try {
			Meteor.call(PeripheralDeviceAPI.methods.dataRundownDelete, device._id, device.token, externalId)
			expect(true).toBe(false) // Please throw and don't get here
		} catch (e) {
			expect(e.message).toBe(`[404] Rundown ${externalId} not found`)
		}
	})

	testInFiber('dataRundownDelete bad device', () => {
		expect(Rundowns.findOne()).toBeFalsy()
		try {
			Meteor.call(PeripheralDeviceAPI.methods.dataRundownDelete, device._id.slice(0, -1), device.token, externalId)
			expect(true).toBe(false) // Please throw and don't get here
		} catch (e) {
			expect(e.message).toBe('[404] PeripheralDevice "mockDevice" not found')
		}
		try {
			Meteor.call(PeripheralDeviceAPI.methods.dataRundownDelete, device._id, device.token.slice(0, -1), externalId)
			expect(true).toBe(false) // Please throw and don't get here
		} catch (e) {
			expect(e.message).toBe('[401] Not allowed access to peripheralDevice')
		}
	})

	// Allow update even though no preceeding create
	testInFiber('dataRundownUpdate even though not yet created', () => {
		expect(Rundowns.findOne()).toBeFalsy()
		const rundownData: IngestRundown = {
			externalId: externalId,
			name: 'MyMockRundown',
			type: 'mock',
			// payload: {},
			segments: [
				{
					externalId: 'segment0',
					name: 'Segment 0',
					rank: 0,
					// payload?: any,
					parts: [
						{
							externalId: 'part1',
							name: 'Part 1',
							rank: 0,
							// payload?: any,
						}
					]
				},
				{
					externalId: 'segment2',
					name: 'Segment 2',
					rank: 0,
					// payload?: any,
					parts: [
						{
							externalId: 'part3',
							name: 'Part 3',
							rank: 0,
							// payload?: any,
						}
					]
				}
			]
		}
		Meteor.call(PeripheralDeviceAPI.methods.dataRundownUpdate, device._id, device.token, rundownData)
		expect(Rundowns.findOne()).toBeTruthy()
	})

	testInFiber('dataSegmentCreate', () => {
		expect(Rundowns.findOne()).toBeTruthy()
		const rundown = Rundowns.findOne() as Rundown
		expect(Segments.find({ rundownId: rundown._id }).count()).toBe(2)
		const ingestSegment: IngestSegment = {
			externalId: segExternalId,
			name: 'MyMockSegment',
			rank: 0,
			// payload?: any;
			parts: []
		}
		Meteor.call(PeripheralDeviceAPI.methods.dataSegmentCreate, device._id, device.token, externalId, ingestSegment)

		const segment = Segments.find({ externalId: segExternalId }).fetch()
		expect(segment).toHaveLength(1)
		expect(segment[0]).toMatchObject({
			externalId: ingestSegment.externalId,
			name: 'MyMockSegment' // fails here because name is set to segments externalId instead
		})

		const segments = Segments.find({ rundownId: rundown._id }).fetch()
		expect(segments).toHaveLength(3)
	})

	testInFiber('dataSegmentUpdate add a part', () => {

		const rundown = Rundowns.findOne() as Rundown
		expect(Segments.find({ rundownId: rundown._id }).count()).toBe(3)

		const ingestSegment: IngestSegment = {
			externalId: segExternalId,
			name: 'MyMockSegment',
			rank: 0,
			// payload?: any;
			parts: [
				{
					externalId: 'part42',
					name: 'Part 42',
					rank: 0
				}
			]
		}
		Meteor.call(PeripheralDeviceAPI.methods.dataSegmentUpdate, device._id, device.token, externalId, ingestSegment)

		const segments = Segments.find({ rundownId: rundown._id }).fetch()
		expect(segments).toHaveLength(3)

		const parts3 = Parts.find({ rundownId: rundown._id, segmentId: segments[2]._id }).fetch()
		expect(parts3).toHaveLength(1)
		expect(parts3[0]).toMatchObject({
			externalId: 'part42',
			title: 'Part 42'
		})
	})

	testInFiber('dataSegmentUpdate non-existant rundown', () => {
		const ingestSegment: IngestSegment = {
			externalId: segExternalId,
			name: 'MyMockSegment',
			rank: 0,
			// payload?: any;
			parts: [],
		}

		try {
			Meteor.call(PeripheralDeviceAPI.methods.dataSegmentUpdate, device._id, device.token, 'wibble', ingestSegment)
			expect(true).toBe(false)
		} catch (e) {
			expect(e.message).toBe(`[404] Rundown wibble not found`)
		}
	})

	testInFiber('dataSegmentUpdate no change', () => {

		const rundown = Rundowns.findOne() as Rundown
		expect(Segments.find({ rundownId: rundown._id }).count()).toBe(3)

		const ingestSegment: IngestSegment = {
			externalId: segExternalId,
			name: 'MyMockSegment',
			rank: 0,
			// payload?: any;
			parts: [
				{
					externalId: 'part42',
					name: 'Part 42',
					rank: 0
				}
			]
		}
		Meteor.call(PeripheralDeviceAPI.methods.dataSegmentUpdate, device._id, device.token, externalId, ingestSegment)

		const segments = Segments.find({ rundownId: rundown._id }).fetch()
		expect(segments).toHaveLength(3)

		const parts3 = Parts.find({ rundownId: rundown._id, segmentId: segments[2]._id }).fetch()
		expect(parts3).toHaveLength(1)
		expect(parts3[0]).toMatchObject({
			externalId: 'part42',
			title: 'Part 42'
		})
	})

	testInFiber('dataSegmentUpdate remove a part', () => {
		const rundown = Rundowns.findOne() as Rundown
		expect(Segments.find({ rundownId: rundown._id }).count()).toBe(3)

		const ingestSegment: IngestSegment = {
			externalId: segExternalId,
			name: 'MyMockSegment',
			rank: 0,
			// payload?: any;
			parts: []
		}
		Meteor.call(PeripheralDeviceAPI.methods.dataSegmentUpdate, device._id, device.token, externalId, ingestSegment)

		const segments = Segments.find({ rundownId: rundown._id }).fetch()
		expect(segments).toHaveLength(3)

		const parts3 = Parts.find({ rundownId: rundown._id, segmentId: segments[2]._id }).fetch()
		expect(parts3).toHaveLength(0)
	})

	testInFiber('dataSegmentUpdate no external id', () => {
		const rundown = Rundowns.findOne() as Rundown
		expect(Segments.find({ rundownId: rundown._id }).count()).toBe(3)
		const ingestSegment: IngestSegment = {
			externalId: '',
			name: 'MyMockSegment',
			rank: 0,
			// payload?: any;
			parts: []
		}
		try {
			Meteor.call(PeripheralDeviceAPI.methods.dataSegmentUpdate, device._id, device.token, externalId, ingestSegment)
			expect(false).toBe(true)
		} catch (e) {
			expect(e.message).toBe(`[401] getSegmentId: segmentExternalId must be set!`)
		}
	})

	testInFiber('dataSegmentDelete', () => {
		const rundown = Rundowns.findOne() as Rundown
		expect(Segments.find({ rundownId: rundown._id }).count()).toBe(3)

		Meteor.call(PeripheralDeviceAPI.methods.dataSegmentDelete, device._id, device.token, externalId, segExternalId)

		expect(Segments.find({ rundownId: rundown._id }).count()).toBe(2)
		expect(Segments.findOne({ externalId: segExternalId })).toBeFalsy()
	})

	testInFiber('dataSegmentDelete for a second time', () => {
		const rundown = Rundowns.findOne() as Rundown
		expect(Segments.find({ rundownId: rundown._id, externalID: segExternalId }).count()).toBe(0)

		try {
			Meteor.call(PeripheralDeviceAPI.methods.dataSegmentDelete, device._id, device.token, externalId, segExternalId)
			expect(true).toBe(false) // Should throw rather than run this test
		} catch (e) {
			expect(e.message).toBe(`[404] Segment ${segExternalId} not found`)
		}

		expect(Segments.find({ rundownId: rundown._id }).count()).toBe(2)
	})

	testInFiber('dataSegmentDelete from non-existant rundown', () => {
		const rundown = Rundowns.findOne() as Rundown
		expect(Segments.find({ rundownId: rundown._id }).count()).toBe(2)

		try {
			Meteor.call(PeripheralDeviceAPI.methods.dataSegmentDelete, device._id, device.token, 'wibble', segExternalId)
			expect(true).toBe(false) // Should throw rather than run this test
		} catch (e) {
			expect(e.message).toBe(`[404] Rundown wibble not found`)
		}
	})

	testInFiber('dataSegmentCreate non-existant rundown', () => {
		expect(Rundowns.findOne()).toBeTruthy()

		const ingestSegment: IngestSegment = {
			externalId: segExternalId,
			name: 'MyMockSegment',
			rank: 0,
			// payload?: any;
			parts: []
		}
		try {
			Meteor.call(PeripheralDeviceAPI.methods.dataSegmentCreate, device._id, device.token, 'wibble', ingestSegment)
			expect(true).toBe(false)
		} catch (e) {
			expect(e.message).toBe(`[404] Rundown wibble not found`)
		}
	})

	testInFiber('dataRundownCreate with not enough arguments', () => {
		try {
			Meteor.call(PeripheralDeviceAPI.methods.dataSegmentCreate)
			expect(0).toBe(1)
		} catch (e) {
			expect(e).toBeTruthy()
		}
		try {
			Meteor.call(PeripheralDeviceAPI.methods.dataSegmentCreate, device._id)
			expect(0).toBe(1)
		} catch (e) {
			expect(e).toBeTruthy()
		}
		try {
			Meteor.call(PeripheralDeviceAPI.methods.dataSegmentCreate, device._id, device.token)
			expect(0).toBe(1)
		} catch (e) {
			expect(e).toBeTruthy()
		}
		try {
			Meteor.call(PeripheralDeviceAPI.methods.dataSegmentCreate, device._id, device.token, null)
			expect(0).toBe(1)
		} catch (e) {
			expect(e).toBeTruthy()
		}
	})

	testInFiber('dataSegmentCreate with not enough arguments', () => {
		try {
			Meteor.call(PeripheralDeviceAPI.methods.dataSegmentCreate)
			expect(0).toBe(1)
		} catch (e) {
			expect(e).toBeTruthy()
		}
		try {
			Meteor.call(PeripheralDeviceAPI.methods.dataSegmentCreate, device._id)
			expect(0).toBe(1)
		} catch (e) {
			expect(e).toBeTruthy()
		}
		try {
			Meteor.call(PeripheralDeviceAPI.methods.dataSegmentCreate, device._id, device.token)
			expect(0).toBe(1)
		} catch (e) {
			expect(e).toBeTruthy()
		}
		try {
			Meteor.call(PeripheralDeviceAPI.methods.dataSegmentCreate, device._id, device.token, externalId)
			expect(0).toBe(1)
		} catch (e) {
			expect(e).toBeTruthy()
		}
		try {
			Meteor.call(PeripheralDeviceAPI.methods.dataSegmentCreate, device._id, device.token, externalId, null)
			expect(0).toBe(1)
		} catch (e) {
			expect(e).toBeTruthy()
		}
	})

	testInFiber('dataPartCreate', () => {
		const rundown = Rundowns.findOne() as Rundown
		const segment = Segments.findOne({ externalId: 'segment0' }) as Segment
		expect(Parts.find({ rundownId: rundown._id, segmentId: segment._id }).count()).toBe(1)

		const ingestPart: IngestPart = {
			externalId: 'party',
			name: 'Part Y',
			rank: 0,
			// payload: any?
		}

		Meteor.call(PeripheralDeviceAPI.methods.dataPartCreate, device._id, device.token, externalId, segment.externalId, ingestPart)

		expect(Parts.find({ rundownId: rundown._id, segmentId: segment._id }).count()).toBe(2)

		let part = Parts.findOne({ externalId: 'party' }) as Part
		expect(part).toMatchObject({
			externalId: ingestPart.externalId,
			title: ingestPart.name
		})
	})

	testInFiber('dataPartUpdate', () => {
		const rundown = Rundowns.findOne() as Rundown
		const segment = Segments.findOne({ externalId: 'segment0' }) as Segment
		expect(Parts.find({ rundownId: rundown._id, segmentId: segment._id }).count()).toBe(2)

		const ingestPart: IngestPart = {
			externalId: 'party',
			name: 'Part Z',
			rank: 0,
			// payload: any?
		}

		Meteor.call(PeripheralDeviceAPI.methods.dataPartUpdate, device._id, device.token, externalId, segment.externalId, ingestPart)

		expect(Parts.find({ rundownId: rundown._id, segmentId: segment._id }).count()).toBe(2)

		let part = Parts.findOne({ externalId: 'party' }) as Part
		expect(part).toMatchObject({
			externalId: ingestPart.externalId,
			title: ingestPart.name
		})
	})

	testInFiber('dataPartDelete', () => {
		const rundown = Rundowns.findOne() as Rundown
		const segment = Segments.findOne({ rundownId: rundown._id, externalId: 'segment0' }) as Segment
		expect(Parts.find({ rundownId: rundown._id, segmentId: segment._id }).count()).toBe(2)

		Meteor.call(PeripheralDeviceAPI.methods.dataPartDelete, device._id, device.token, externalId, segment.externalId, 'party')

		expect(Parts.find({ rundownId: rundown._id, segmentId: segment._id }).count()).toBe(1)
		expect(Parts.findOne({ externalId: 'party' })).toBeFalsy()
	})

	// TODO Part tests are minimal/happy path only on the assumption the API gets little use

	testInFiber('dataRundownUpdate remove dynamicInserted Part', () => {
		Rundowns.remove({})
		expect(Rundowns.findOne()).toBeFalsy()
		const rundownData: IngestRundown = {
			externalId: externalId,
			name: 'MyMockRundown',
			type: 'mock',
			// payload: {},
			segments: [
				{
					externalId: 'segment0',
					name: 'Segment 0',
					rank: 1,
					// payload?: any,
					parts: [
						{
							externalId: 'part0',
							name: 'Part 0',
							rank: 1,
							// payload?: any,
						},
						{
							externalId: 'part1',
							name: 'Part 1',
							rank: 2,
							// payload?: any,
						}
					]
				},
				{
					externalId: 'segment1',
					name: 'Segment 1',
					rank: 2,
					// payload?: any,
					parts: [
						{
							externalId: 'part2',
							name: 'Part 2',
							rank: 1,
							// payload?: any,
						}
					]
				}
			]
		}
		Meteor.call(PeripheralDeviceAPI.methods.dataRundownCreate, device._id, device.token, rundownData)

		const rundown = Rundowns.findOne() as Rundown
		expect(rundown).toBeTruthy()

		const part = Parts.findOne({ externalId: 'part1' }) as Part
		expect(part).toBeTruthy()

		const dynamicPartId = 'dynamic1'
		Parts.insert({
			_id: dynamicPartId,
			_rank: 999999,
			rundownId: rundown._id,
			segmentId: part.segmentId,
			externalId: '',
			title: 'Dynamic',
			typeVariant: 'dynamic',
			dynamicallyInserted: true,
			afterPart: part._id
		})
		expect(Parts.findOne(dynamicPartId)).toBeTruthy()

		// Let the logic generate the correct rank first
		updatePartRanks(rundown._id)
		let dynamicPart = Parts.findOne(dynamicPartId) as Part
		expect(dynamicPart).toBeTruthy()
		expect(dynamicPart._rank).toEqual(1.5) // TODO - this value is bad

		// Update the rundown and it should have been removed
		Meteor.call(PeripheralDeviceAPI.methods.dataRundownUpdate, device._id, device.token, rundownData)

		dynamicPart = Parts.findOne(dynamicPartId) as Part
		expect(dynamicPart).toBeFalsy() // TODO - is this the desired behaviour
	})

	testInFiber('dataSegmentUpdate update dynamicInserted Part', () => {
		Rundowns.remove({})
		expect(Rundowns.findOne()).toBeFalsy()
		const rundownData: IngestRundown = {
			externalId: externalId,
			name: 'MyMockRundown',
			type: 'mock',
			// payload: {},
			segments: [
				{
					externalId: 'segment0',
					name: 'Segment 0',
					rank: 1,
					// payload?: any,
					parts: [
						{
							externalId: 'part0',
							name: 'Part 0',
							rank: 1,
							// payload?: any,
						},
						{
							externalId: 'part1',
							name: 'Part 1',
							rank: 2,
							// payload?: any,
						}
					]
				},
				{
					externalId: 'segment1',
					name: 'Segment 1',
					rank: 2,
					// payload?: any,
					parts: [
						{
							externalId: 'part2',
							name: 'Part 2',
							rank: 1,
							// payload?: any,
						}
					]
				}
			]
		}
		Meteor.call(PeripheralDeviceAPI.methods.dataRundownCreate, device._id, device.token, rundownData)

		const rundown = Rundowns.findOne() as Rundown
		expect(rundown).toBeTruthy()

		const part = Parts.findOne({ externalId: 'part1' }) as Part
		expect(part).toBeTruthy()

		const dynamicPartId = 'dynamic1'
		Parts.insert({
			_id: dynamicPartId,
			_rank: 999999,
			rundownId: rundown._id,
			segmentId: part.segmentId,
			externalId: '',
			title: 'Dynamic',
			typeVariant: 'dynamic',
			dynamicallyInserted: true,
			afterPart: part._id
		})
		expect(Parts.findOne(dynamicPartId)).toBeTruthy()

		// Let the logic generate the correct rank first
		updatePartRanks(rundown._id)
		let dynamicPart = Parts.findOne(dynamicPartId) as Part
		expect(dynamicPart).toBeTruthy()
		expect(dynamicPart._rank).toEqual(1.5)

		// Update the segment owning the part and it should remain
		const segmentData = rundownData.segments[0]
		Meteor.call(PeripheralDeviceAPI.methods.dataSegmentUpdate, device._id, device.token, rundownData.externalId, segmentData)
		dynamicPart = Parts.findOne(dynamicPartId) as Part
		expect(dynamicPart).toBeTruthy()

		// Change the rank of the part it belongs to and this rank should update
		segmentData.parts[0].rank = 5
		Meteor.call(PeripheralDeviceAPI.methods.dataSegmentUpdate, device._id, device.token, rundownData.externalId, segmentData)
		dynamicPart = Parts.findOne(dynamicPartId) as Part
		expect(dynamicPart).toBeTruthy()
		expect(dynamicPart._rank).toEqual(0.5)

		// // Invalidate the part it is set to be after, and it should be removed
		// segmentData.parts[0].rank = 0
		// Parts.update(dynamicPartId, { $set: { afterPart: 'not-a-real-part' } })
		// Meteor.call(PeripheralDeviceAPI.methods.dataSegmentUpdate, device._id, device.token, rundownData.externalId, segmentData)
		// dynamicPart = Parts.findOne(dynamicPartId) as Part
		// expect(dynamicPart).toBeFalsy()
	})
})
