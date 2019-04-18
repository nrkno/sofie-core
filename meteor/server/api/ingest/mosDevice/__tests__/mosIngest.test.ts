import { Meteor } from 'meteor/meteor'
import { Random } from 'meteor/random'
import * as MOS from 'mos-connection'
import { PeripheralDeviceAPI } from '../../../../../lib/api/peripheralDevice'
import { setupMockPeripheralDevice, setupMockStudio, setupMockShowStyleBase, setupMockShowStyleVariant, setupMockStudioBlueprint } from '../../../../../__mocks__/helpers/database'
import { Rundowns } from '../../../../../lib/collections/Rundowns'
import { setLoggerLevel } from '../../../logger'
import { testInFiber } from '../../../../../__mocks__/helpers/jest'

require('../../../../../server/api/ingest/mosDevice/api.ts') // include in order to create the Meteor methods needed

describe ('Test recieved mos actions', () => {

	testInFiber('mosRoCreate', () => {
		setLoggerLevel('debug')

		expect(Rundowns.findOne()).toBeFalsy()

		// expect(1).toEqual(1)
		const studio = setupMockStudio()
		const device = setupMockPeripheralDevice(PeripheralDeviceAPI.DeviceType.MOSDEVICE, studio)

		const showStyleBaseId = Random.id()
		const showStyleBase = setupMockShowStyleBase(
			'', // showStyleBlueprint._id
			{ _id: showStyleBaseId }
		)
		const showStyleVariant = setupMockShowStyleVariant(showStyleBase._id)

		const studioBlueprint = setupMockStudioBlueprint(showStyleBaseId)

		// const showStyleBlueprint

		const mosRunningOrder: MOS.IMOSRunningOrder = {
			ID: new MOS.MosString128('abc'),
			Slug: new MOS.MosString128('mySlug'),
			// DefaultChannel?: new MOS.MosString128(''),
			// EditorialStart?: new MOS.MosTime(),
			// EditorialDuration?: new MOS.MosDuration(),
			// Trigger?: new MOS.MosString128(''),
			// MacroIn?: new MOS.MosString128(''),
			// MacroOut?: new MOS.MosString128(''),
			// MosExternalMetaData?: [], // Array<IMOSExternalMetaData>
			Stories: [] // Array<IMOSROStory>
		}
		// console.log('device', device)
		Meteor.call(PeripheralDeviceAPI.methods.mosRoCreate, device._id, device.token, mosRunningOrder )

		const rundown = Rundowns.findOne()

		expect(rundown).toBeTruthy()

	})
})
