import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import { addMigrationSteps } from './databaseMigration'
import { setExpectedVersion } from './lib'

// Release 34
export const addSteps = addMigrationSteps('1.34.0', [
	setExpectedVersion(
		'expectedVersion.mediaManager',
		PeripheralDeviceAPI.DeviceType.MEDIA_MANAGER,
		'_process',
		'1.9.0-release34.0'
	),
])
