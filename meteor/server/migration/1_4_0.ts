import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import { addMigrationSteps } from './databaseMigration'
import { setExpectedVersion } from './lib'

// 1.4.0 (Release 16)
addMigrationSteps('1.4.0', [
	setExpectedVersion('expectedVersion.playoutDevice', PeripheralDeviceAPI.DeviceType.PLAYOUT, '_process', '^1.4.0'),
])
