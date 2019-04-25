import { Meteor } from 'meteor/meteor'
import { Random } from 'meteor/random'
import * as MOS from 'mos-connection'
import { PeripheralDeviceAPI } from '../../../../lib/api/peripheralDevice'
import {
	setupDefaultStudioEnvironment
} from '../../../../__mocks__/helpers/database'
import { Rundowns, Rundown } from '../../../../lib/collections/Rundowns'
import { setLoggerLevel } from '../../logger'
import { testInFiber } from '../../../../__mocks__/helpers/jest'
import { Segments } from '../../../../lib/collections/Segments'
import { Parts } from '../../../../lib/collections/Parts'
import { IngestRundown } from 'tv-automation-sofie-blueprints-integration'

require('../api.ts') // include in order to create the Meteor methods needed

describe('Test recieved mos actions', () => {

	testInFiber('dataRundownCreate', () => {
		// setLoggerLevel('debug')

		expect(Rundowns.findOne()).toBeFalsy()

		const { device } = setupDefaultStudioEnvironment()

		const rundownId = Random.id()

		const rundownData: IngestRundown = {
			externalId: 'abcde',
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

		Meteor.call(PeripheralDeviceAPI.methods.dataRundownCreate, device._id, device.token, rundownId, rundownData)

		const rundown = Rundowns.findOne() as Rundown
		expect(rundown).toMatchObject({
			externalId: rundownData.externalId
		})

		const segments = Segments.find({ rundownId: rundown._id }).fetch()
		expect(segments).toHaveLength(2)

		const parts0 = Parts.find({ rundownId: rundown._id, segmentId: segments[0]._id }).fetch()
		expect(parts0).toHaveLength(2)

		const parts1 = Parts.find({ rundownId: rundown._id, segmentId: segments[1]._id }).fetch()
		expect(parts1).toHaveLength(1)
	})
})
