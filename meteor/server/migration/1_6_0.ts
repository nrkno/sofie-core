import { addMigrationSteps } from './databaseMigration'
import { setExpectedVersion } from './lib'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'

// 1.6.0 (Release 18)
export const addSteps = addMigrationSteps('1.6.0', [
	setExpectedVersion('expectedVersion.playoutDevice', PeripheralDeviceAPI.DeviceType.PLAYOUT, '_process', '^1.6.0'),
])
