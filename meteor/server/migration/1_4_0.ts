import { addMigrationSteps } from './databaseMigration'
import { setExpectedVersion } from './lib'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'

// 1.4.0 (Release 16)
export const addSteps = addMigrationSteps('1.4.0', [
	setExpectedVersion('expectedVersion.playoutDevice', PeripheralDeviceAPI.DeviceType.PLAYOUT, '_process', '^1.4.0'),
])
