
import { restoreRundown } from '../backups'
import { PeripheralDevices } from '../../lib/collections/PeripheralDevices'
import { getCurrentTime } from '../../lib/lib'
import { StatusCode } from '../systemStatus'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import { Rundowns } from '../../lib/collections/Rundowns'
import { MeteorMock } from '../../__mocks__/meteor'

jest.mock('meteor/meteor', require('../../__mocks__/meteor').setup, { virtual: true })
jest.mock('meteor/random', require('../../__mocks__/random').setup, { virtual: true })
jest.mock('meteor/meteorhacks:picker', require('../../__mocks__/meteorhacks-picker').setup, { virtual: true })
jest.mock('meteor/mongo', require('../../__mocks__/mongo').setup, { virtual: true })

describe('backups', () => {

	test('restoreRundown', () => {

		PeripheralDevices.insert({
			_id: 'mockMos',
			type: PeripheralDeviceAPI.DeviceType.MOSDEVICE,
			name: '',

			created: getCurrentTime(),
			status: {
				statusCode: StatusCode.GOOD,
			},
			lastSeen: getCurrentTime(),
			lastConnected: getCurrentTime(),

			connected: true,
			connectionId: 'abcConnectionId',
			token: 'abcToken'

		})

		MeteorMock.mockMethods[PeripheralDeviceAPI.methods.mosRundownDelete] = jest.fn()
		MeteorMock.mockMethods[PeripheralDeviceAPI.methods.mosRundownCreate] = jest.fn()
		MeteorMock.mockMethods[PeripheralDeviceAPI.methods.mosRundownFullStory] = jest.fn()

		restoreRundown({
			type: 'rundownCache',
			data: [
				{
					type: 'rundownCreate',
					data: {
						ID: 'rundown0',
						Stories: [
							{
								ID: 'story0'
							}
						]
					}
				},
				{
					type: 'fullStory',
					data: {
						ID: 'story0'
					}
				}
			]
		})

		expect(MeteorMock.mockMethods[PeripheralDeviceAPI.methods.mosRundownDelete]).toHaveBeenCalledTimes(1)
		expect(MeteorMock.mockMethods[PeripheralDeviceAPI.methods.mosRundownCreate]).toHaveBeenCalledTimes(1)
		expect(MeteorMock.mockMethods[PeripheralDeviceAPI.methods.mosRundownFullStory]).toHaveBeenCalledTimes(1)
	})
})
