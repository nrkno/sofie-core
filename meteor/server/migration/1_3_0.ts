import { addMigrationSteps } from './databaseMigration'
import { setExpectedVersion } from './lib'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'

// 1.3.0 (Release 15)
export const addSteps = addMigrationSteps('1.3.0', [
	setExpectedVersion('expectedVersion.playoutDevice', PeripheralDeviceAPI.DeviceType.PLAYOUT, '_process', '^1.3.0'),
])
