import { addMigrationSteps, CURRENT_SYSTEM_VERSION } from './databaseMigration'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import { setExpectedVersion } from './lib'

// 1.8.0 (Release 20)
addMigrationSteps('1.8.0', [ // <--- To be set to an absolute version number when doing the release
	setExpectedVersion('expectedVersion.playoutDevice',	PeripheralDeviceAPI.DeviceType.PLAYOUT,			'_process', '^1.7.0'),
	setExpectedVersion('expectedVersion.mosDevice',		PeripheralDeviceAPI.DeviceType.MOS,				'_process', '^1.2.0'),
])
