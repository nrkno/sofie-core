import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import { addMigrationSteps } from './databaseMigration'
import { setExpectedVersion } from './lib'

// 1.6.0 (Release 18)
addMigrationSteps('1.6.0', [
	setExpectedVersion('expectedVersion.playoutDevice', PeripheralDeviceAPI.DeviceType.PLAYOUT, '_process', '^1.6.0'),
])
