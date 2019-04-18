import * as _ from 'underscore'
import { PeripheralDevices, PeripheralDevice } from '../../lib/collections/PeripheralDevices'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import { StatusCode } from '../../server/systemStatus'
import { Studio, Studios, DBStudio } from '../../lib/collections/Studios'

let dbI: number = 0
export function setupMockPeripheralDevice (type: PeripheralDeviceAPI.DeviceType, studio: Studio, doc?: Partial<PeripheralDevice>) {
	doc = doc || {}

	const defaultDevice: PeripheralDevice = {
		_id: 'mockDevice' + (dbI++),
		name: 'mockDevice',
		studioId: studio._id,
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
	}

	const device = _.extend(defaultDevice, doc)

	PeripheralDevices.insert(device)

	return device
}
export function setupMockStudio (doc?: Partial<DBStudio>): Studio {
	doc = doc || {}

	const defaultStudio: DBStudio = {
		_id: 'mockStudio' + (dbI++),
		name: 'mockStudio',
		// blueprintId?: string
		mappings: {},
		supportedShowStyleBase: [],
		config: [],
		// testToolsConfig?: ITestToolsConfig
		settings: {
			mediaPreviewsUrl: '',
			sofieUrl: ''
		},
		_rundownVersionHash: 'asdf'
	}

	const studio = _.extend(defaultStudio, doc)

	Studios.insert(studio)

	return studio
}
