import { Meteor } from 'meteor/meteor'
import { Random } from 'meteor/random'
import * as MOS from 'mos-connection'
import { runInFiber } from '../../../../../__mocks__/Fibers'
import { PeripheralDeviceAPI } from '../../../../../lib/api/peripheralDevice'
import { getMockPeripheralDevice } from '../../../../../__mocks__/helpers/peripheralDevice'
import { Rundowns } from '../../../../../lib/collections/Rundowns'

require('../../../../../server/api/ingest/mosDevice/api.ts') // include in order to create Meteor methods

describe ('Test recieved mos actions', () => {

	test('mosRoCreate', async () => {
		await runInFiber(() => {

			expect(Rundowns.findOne()).toBeFalsy()

			// expect(1).toEqual(1)
			const device = getMockPeripheralDevice(PeripheralDeviceAPI.DeviceType.MOSDEVICE)

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
			Meteor.call(PeripheralDeviceAPI.methods.mosRoCreate, device._id, device.token, mosRunningOrder )

			const rundown = Rundowns.findOne()
			console.log('c')
			expect(rundown).toBeTruthy()

			console.log('a')

		})
	})
})
