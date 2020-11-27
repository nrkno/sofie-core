import { addMigrationSteps } from './databaseMigration'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import { setExpectedVersion } from './lib'

// 1.8.0 (Release 20)
export const addSteps = addMigrationSteps('1.8.0', [
	setExpectedVersion('expectedVersion.playoutDevice', PeripheralDeviceAPI.DeviceType.PLAYOUT, '_process', '^1.7.0'),
	setExpectedVersion('expectedVersion.mosDevice', PeripheralDeviceAPI.DeviceType.MOS, '_process', '^1.2.0'),
])
