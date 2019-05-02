import { Meteor } from 'meteor/meteor'
import { Random } from 'meteor/random'
import * as MOS from 'mos-connection'
import { PeripheralDeviceAPI } from '../../../../lib/api/peripheralDevice'
import {
	setupDefaultStudioEnvironment
} from '../../../../__mocks__/helpers/database'
import { Rundowns, Rundown } from '../../../../lib/collections/Rundowns'
import { PeripheralDevice } from '../../../../lib/collections/PeripheralDevices'
import { setLoggerLevel } from '../../logger'
import { testInFiber } from '../../../../__mocks__/helpers/jest'
import { Segments } from '../../../../lib/collections/Segments'
import { Parts } from '../../../../lib/collections/Parts'
import { IngestRundown } from 'tv-automation-sofie-blueprints-integration'

require('../api.ts') // include in order to create the Meteor methods needed

describe('Test ingest actions for rundown', () => {

	let device: PeripheralDevice
	let externalId = 'abcde'
	beforeAll(() => {
		device = setupDefaultStudioEnvironment().device
	})

	testInFiber('dataRundownCreate', () => {
		setLoggerLevel('debug')

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

	/* testInFiber('dataRundownUpdate remove a segment', () => {
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
	}) */

	/* testInFiber('dataRundownUpdate remove a part', () => {
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
	}) */

	testInFiber('dataRundownDelete', () => {
		expect(Rundowns.findOne()).toBeTruthy()
		Meteor.call(PeripheralDeviceAPI.methods.dataRundownDelete, device._id, device.token, externalId)
		expect(Rundowns.findOne()).toBeFalsy()
		expect(Segments.find().count()).toBe(0)
		expect(Parts.find().count()).toBe(0)
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

})

describe('Test ingest actions for rundown', () => {

	let device: PeripheralDevice
	let externalId = 'abcde'
	let segmentId =
	beforeAll(() => {
		device = setupDefaultStudioEnvironment().device
	})

	testInFiber('dataSegmentCreate', () => {
		expect(1).toBe(1)
	})
})
