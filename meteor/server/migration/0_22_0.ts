import { addMigrationSteps } from './databaseMigration'
import * as _ from 'underscore'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import { setExpectedVersion } from './lib'

// 0.22.0 (Release 7)
export const addSteps = addMigrationSteps('0.22.0', [
	setExpectedVersion('expectedVersion.playoutDevice', PeripheralDeviceAPI.DeviceType.PLAYOUT, '_process', '0.17.0'),
	setExpectedVersion('expectedVersion.mosDevice', PeripheralDeviceAPI.DeviceType.MOS, '_process', '0.5.2'),
])
