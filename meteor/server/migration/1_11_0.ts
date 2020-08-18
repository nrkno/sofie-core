import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import { CoreSystem } from '../../lib/collections/CoreSystem'
import { addMigrationSteps } from './databaseMigration'
import { setExpectedVersion } from './lib'

// Release 23
addMigrationSteps('1.11.0', [
	{
		id: 'Fix serviceMessages in CoreSystem',
		canBeRunAutomatically: true,
		validate: () => {
			const core = CoreSystem.findOne()
			if (core) {
				for (let [key, message] of Object.entries(core.serviceMessages)) {
					if (typeof message.timestamp === 'string') {
						return true
					}
				}
				return false
			}
			return false
		},
		migrate: () => {
			const core = CoreSystem.findOne()
			if (core) {
				for (let [key, message] of Object.entries(core.serviceMessages)) {
					if (typeof message.timestamp !== 'number') {
						core.serviceMessages[key] = {
							...message,
							timestamp: new Date(message.timestamp).getTime(),
						}
					}
				}
			}
		},
	},
	setExpectedVersion('expectedVersion.playoutDevice', PeripheralDeviceAPI.DeviceType.PLAYOUT, '_process', '^1.10.0'),
	// setExpectedVersion('expectedVersion.mosDevice', PeripheralDeviceAPI.DeviceType.MOS, '_process', '^1.4.3'),
])
