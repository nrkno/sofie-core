import * as _ from 'underscore'
import { PeripheralDevices, PeripheralDevice } from '../../lib/collections/PeripheralDevices'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import { StatusCode } from '../../server/systemStatus'

export function getMockPeripheralDevice (type: PeripheralDeviceAPI.DeviceType, doc?: Partial<PeripheralDevice>) {
	doc = doc || {}
	const device = _.extend({
		_id: 'string',
		name: 'string',
		type: type,
		created: 1234,
		status: {
			statusCode: StatusCode.GOOD,
		},
		lastSeen: 1234,
		lastConnected: 1234,
		connected: true,
		connectionId: 'myConnectionId',
		token: 'mockToken'
	}, doc)

	PeripheralDevices.insert(device)

	return device
}
