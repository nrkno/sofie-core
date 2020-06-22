import { addMigrationSteps, CURRENT_SYSTEM_VERSION } from './databaseMigration'
import { setExpectedVersion } from './lib'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'

// Release 22
addMigrationSteps('1.10.0', [
	setExpectedVersion('expectedVersion.playoutDevice', PeripheralDeviceAPI.DeviceType.PLAYOUT, '_process', '^1.8.1'),
	setExpectedVersion('expectedVersion.mosDevice', PeripheralDeviceAPI.DeviceType.MOS, '_process', '^1.3.2'),
])
