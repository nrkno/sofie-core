import { Meteor } from 'meteor/meteor'
import * as MOS from 'mos-connection'
import { PeripheralDeviceAPI } from '../../../../../lib/api/peripheralDevice'
import {
	setupDefaultStudioEnvironment
} from '../../../../../__mocks__/helpers/database'
import { Rundowns, Rundown } from '../../../../../lib/collections/Rundowns'
import { setLoggerLevel } from '../../../logger'
import { testInFiber } from '../../../../../__mocks__/helpers/jest'
import { Segments } from '../../../../../lib/collections/Segments'
import { Parts } from '../../../../../lib/collections/Parts'

require('../api.ts') // include in order to create the Meteor methods needed

describe('Test recieved mos actions', () => {

	testInFiber('mosRoCreate', () => {
		// setLoggerLevel('debug')

		expect(Rundowns.findOne()).toBeFalsy()

		const { device } = setupDefaultStudioEnvironment()

		const mosRunningOrder: MOS.IMOSRunningOrder = {
			ID: new MOS.MosString128('abc'),
			Slug: new MOS.MosString128('mySlug'),
			Stories: [{
				ID: new MOS.MosString128('story0'),
				Slug: new MOS.MosString128('INTRO;Intro'),
				Number: new MOS.MosString128('A1'),
				Items: []
			},{
				ID: new MOS.MosString128('story1'),
				Slug: new MOS.MosString128('INTRO;Top stories'),
				Number: new MOS.MosString128('A2'),
				Items: []
			},{
				ID: new MOS.MosString128('story2'),
				Slug: new MOS.MosString128('HEAD;Hello'),
				Number: new MOS.MosString128('B1'),
				Items: []
			}]
		}

		Meteor.call(PeripheralDeviceAPI.methods.mosRoCreate, device._id, device.token, mosRunningOrder)

		const rundown = Rundowns.findOne() as Rundown
		expect(rundown).toMatchObject({
			externalId: mosRunningOrder.ID.toString()
		})

		const segments = Segments.find({ rundownId: rundown._id }).fetch()
		expect(segments).toHaveLength(2)

		const parts0 = Parts.find({ rundownId: rundown._id, segmentId: segments[0]._id }).fetch()
		expect(parts0).toHaveLength(2)

		const parts1 = Parts.find({ rundownId: rundown._id, segmentId: segments[1]._id }).fetch()
		expect(parts1).toHaveLength(1)
	})
})
