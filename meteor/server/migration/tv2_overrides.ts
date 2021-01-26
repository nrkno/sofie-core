import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import { CURRENT_SYSTEM_VERSION } from './currentSystemVersion'
import { addMigrationSteps } from './databaseMigration'
import { setExpectedVersion } from './lib'

export const addSteps = addMigrationSteps(CURRENT_SYSTEM_VERSION, [
	setExpectedVersion('expectedVersion.playoutDevice', PeripheralDeviceAPI.DeviceType.PLAYOUT, '_process', '0.0.0'),
	setExpectedVersion('expectedVersion.mosDevice', PeripheralDeviceAPI.DeviceType.MOS, '_process', '^0.0.0'),
	setExpectedVersion(
		'expectedVersion.mediaManager',
		PeripheralDeviceAPI.DeviceType.MEDIA_MANAGER,
		'_process',
		'0.0.0'
	),
])
