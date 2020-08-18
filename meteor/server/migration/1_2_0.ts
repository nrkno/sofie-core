import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import { getCoreSystem, setCoreSystemStorePath } from '../../lib/collections/CoreSystem'
import { addMigrationSteps } from './databaseMigration'
import { setExpectedVersion } from './lib'

// 1.2.0 (Release 14)
addMigrationSteps('1.2.0', [
	{
		id: 'CoreSystem.storePath fix',
		// Fix a bug where CoreSystemPath is the string "undefined", ref (https://github.com/nrkno/tv-automation-server-core/pull/91)
		canBeRunAutomatically: true,
		validate: () => {
			let system = getCoreSystem()
			if (system && system.storePath === 'undefined') {
				return 'CoreSystem.storePath is "undefined"'
			}
			return false
		},
		migrate: () => {
			let system = getCoreSystem()
			if (system && system.storePath === 'undefined') {
				setCoreSystemStorePath(undefined)
			}
		},
	},
	setExpectedVersion('expectedVersion.playoutDevice', PeripheralDeviceAPI.DeviceType.PLAYOUT, '_process', '^1.2.0'),
	setExpectedVersion('expectedVersion.mosDevice', PeripheralDeviceAPI.DeviceType.MOS, '_process', '^1.0.1'),
])
