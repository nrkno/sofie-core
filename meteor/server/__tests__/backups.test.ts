
import { restoreRundown } from '../backups'
import { PeripheralDevices } from '../../lib/collections/PeripheralDevices'
import { getCurrentTime } from '../../lib/lib'
import { StatusCode } from '../systemStatus/systemStatus'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import { Rundowns } from '../../lib/collections/Rundowns'
import { MeteorMock } from '../../__mocks__/meteor'

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

		MeteorMock.mockMethods[PeripheralDeviceAPI.methods.mosRoDelete] = jest.fn()
		MeteorMock.mockMethods[PeripheralDeviceAPI.methods.mosRoCreate] = jest.fn()
		MeteorMock.mockMethods[PeripheralDeviceAPI.methods.mosRoFullStory] = jest.fn()

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

		expect(MeteorMock.mockMethods[PeripheralDeviceAPI.methods.mosRoDelete]).toHaveBeenCalledTimes(1)
		expect(MeteorMock.mockMethods[PeripheralDeviceAPI.methods.mosRoCreate]).toHaveBeenCalledTimes(1)
		expect(MeteorMock.mockMethods[PeripheralDeviceAPI.methods.mosRoFullStory]).toHaveBeenCalledTimes(1)
	})
})
